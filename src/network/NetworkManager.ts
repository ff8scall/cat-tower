
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';

export type MessageType = 'STATE_UPDATE' | 'ACTION' | 'JOIN_REQUEST' | 'JOIN_ACCEPT' | 'PLAYER_INFO' | 'SYNC_REQUEST';

export interface NetworkMessage {
    type: MessageType;
    payload: any;
}

export class NetworkManager {
    peer: Peer | null = null;
    connections: DataConnection[] = []; // For Host: list of guests. For Guest: [hostConnection]
    myId: string = '';
    onData: (data: NetworkMessage, conn: DataConnection) => void;
    onConnect: (conn: DataConnection) => void;

    constructor(onData: (data: NetworkMessage, conn: DataConnection) => void, onConnect: (conn: DataConnection) => void) {
        this.onData = onData;
        this.onConnect = onConnect;
    }

    init(id?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                // Create Peer. If ID is provided, try to use it (optional, usually random)
                // Add debug level to see logs in console
                this.peer = id ? new Peer(id, { debug: 2 }) : new Peer({ debug: 2 });

                const timeout = setTimeout(() => {
                    reject(new Error('Connection to PeerJS server timed out. Check your internet connection.'));
                }, 10000); // 10s timeout

                this.peer.on('open', (id) => {
                    clearTimeout(timeout);
                    console.log('My Peer ID:', id);
                    this.myId = id;
                    resolve(id);
                });

                this.peer.on('connection', (conn) => {
                    console.log('Incoming connection:', conn.peer);
                    this.handleConnection(conn);
                });

                this.peer.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('Peer error:', err);
                    reject(err);
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    connectToHost(hostId: string): Promise<DataConnection> {
        return new Promise((resolve, reject) => {
            if (!this.peer) return reject(new Error('Peer not initialized'));

            console.log('Connecting to host:', hostId);
            const conn = this.peer.connect(hostId);

            const timeout = setTimeout(() => {
                // Determine if we should close?
                conn.close();
                reject(new Error('Connection to Host timed out. Check Host ID or Network.'));
            }, 5000); // 5s timeout for P2P connection

            conn.on('open', () => {
                clearTimeout(timeout);
                console.log('Connection opened:', conn.peer);
                // handleConnection adds push/onConnect logic.
                resolve(conn);
            });

            conn.on('error', (err) => {
                clearTimeout(timeout);
                console.error('Connection error:', err);
                reject(err);
            });

            // Note: handleConnection adds listeners too. 
            // We should be careful not to duplicate 'open' logic or override.
            // But handleConnection is designed for *incoming* usually? 
            // Or generic.
            // Let's modify handleConnection to NOT listen to 'open' if we successfully resolve here?
            // actually handleConnection adds 'data', 'close'.
            // It ALSO adds 'open'. 
            // If we add 'open' listener here, both will fire. 
            // But handleConnection's 'open' does: push to connections, onConnect(conn).
            // We duplicate that logic here to ensure we resolve properly.
            // Actually, better: Pass valid conn to handleConnection AFTER resolve.
            // BUT handleConnection adds 'data' listener which is needed ASAP.
            // PeerJS `connect` returns `conn` immediately.

            // Improved flow:
            // 1. conn = peer.connect
            // 2. Setup Promise for Open/Error/Timeout.
            // 3. On Open -> resolve.
            // 4. Then call handleConnection(conn) ?
            // handleConnection adds 'open' listener... it might be too late if already open?
            // No, PeerJS events usually work. But better to setup all.

            // Let's just attach 'data'/'close' handlers here or reuse handleConnection but remove its 'open' listener?
            // Simplest: Don't use handleConnection for the INITIAL setup, use it for Data/Close.

            // Let's refactor handleConnection to separate 'open' handling? 
            // Or just allow redundant 'open' log.
            // The issue is `this.connections.push` might happen twice if we are not careful.

            this.handleConnection(conn);
            // handleConnection adds 'open' checking.
            // We just need to hook into it for Promise.
        });
    }

    handleConnection(conn: DataConnection) {
        conn.on('open', () => {
            console.log('Connection opened:', conn.peer);
            this.connections.push(conn);
            this.onConnect(conn);
        });

        conn.on('data', (data) => {
            // data is unknown, cast to NetworkMessage
            this.onData(data as NetworkMessage, conn);
        });

        conn.on('close', () => {
            console.log('Connection closed:', conn.peer);
            this.connections = this.connections.filter(c => c.peer !== conn.peer);
        });
    }

    send(conn: DataConnection, msg: NetworkMessage) {
        if (conn.open) {
            conn.send(msg);
        }
    }

    broadcast(msg: NetworkMessage) {
        this.connections.forEach(c => this.send(c, msg));
    }

    getConnectionsCount(): number {
        return this.connections.length;
    }
}
