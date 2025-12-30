
import { useState, useRef, useEffect } from 'react';
import { GameEngine } from '../game/engine';
import { NetworkManager } from '../network/NetworkManager';
import type { NetworkMessage } from '../network/NetworkManager';
import type { GameState, ItemType } from '../game/types';

export type GameMode = 'LOCAL' | 'HOST' | 'GUEST';

export const useGame = () => {
    const engineRef = useRef<GameEngine | null>(null);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [gameMode, setGameMode] = useState<GameMode>('LOCAL');
    const [myPeerId, setMyPeerId] = useState<string>('');
    const [connectedPeers, setConnectedPeers] = useState<string[]>([]);

    // Network Manager Ref
    const netRef = useRef<NetworkManager | null>(null);

    const updateState = () => {
        if (engineRef.current) {
            const newState = { ...engineRef.current.state };
            setGameState(newState);
            // If Host, broadcast
            if (gameMode === 'HOST' && netRef.current) {
                netRef.current.broadcast({ type: 'STATE_UPDATE', payload: newState });
            }
        }
    };

    // Initialize Network
    const initNetwork = async (id?: string) => {
        const net = new NetworkManager(
            (msg, conn) => handleNetworkMessage(msg, conn),
            (conn) => {
                setConnectedPeers(prev => [...prev, conn.peer]);
                // If Host, send current state to new guest?
                // Or wait for game start.
                if (gameMode === 'HOST' && gameState) {
                    netRef.current?.send(conn, { type: 'STATE_UPDATE', payload: gameState });
                }
            }
        );
        const myId = await net.init(id);
        setMyPeerId(myId);
        netRef.current = net;
        return myId;
    };

    const handleNetworkMessage = (msg: NetworkMessage, _conn: any) => {
        // Handle incoming messages
        if (msg.type === 'STATE_UPDATE') {
            setGameState(msg.payload);
        } else if (msg.type === 'ACTION') {
            // Host receives action from Guest
            const { action, args } = msg.payload;
            handleAction(action, args);
        } else if (msg.type === 'SYNC_REQUEST') {
            if (gameMode === 'HOST' && gameState && netRef.current) {
                netRef.current.send(_conn, { type: 'STATE_UPDATE', payload: gameState });
            }
        }
    };

    // Heartbeat for Host: Broadcast state periodically to fix Desyncs
    // Better: Helper ref to current state? Or rely on closure?
    // If I put [gameState] in dep array, it runs on every update. That IS a broadcast.
    // I want EXTRA broadcast if idle?
    // Actually, `updateState` already broadcasts.
    // I just want a background looper.
    // Create a ref for latest state.

    const latestStateRef = useRef(gameState);
    useEffect(() => { latestStateRef.current = gameState; }, [gameState]);

    useEffect(() => {
        if (gameMode !== 'HOST') return;
        const interval = setInterval(() => {
            if (netRef.current && latestStateRef.current && netRef.current.getConnectionsCount() > 0) {
                netRef.current.broadcast({ type: 'STATE_UPDATE', payload: latestStateRef.current });
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [gameMode]);

    const handleAction = (action: string, args: any[]) => {
        if (!engineRef.current) return;

        switch (action) {
            case 'draftDie': engineRef.current.draftDie(args[0], args[1]); break;
            case 'markItem': engineRef.current.markItem(args[0], args[1]); break;
            case 'skipTurn': engineRef.current.skipTurn(args[0]); break;
            case 'modifyDie': engineRef.current.modifyDie(args[0], args[1], args[2]); break;
            case 'registerBonus': engineRef.current.registerBonus(args[0], args[1]); break;
        }
        updateState();
    };

    // Dispatcher: If Guest -> Send. If Host/Local -> Execute.
    const dispatchAction = (action: string, ...args: any[]) => {
        if (gameMode === 'GUEST') {
            netRef.current?.broadcast({ type: 'ACTION', payload: { action, args } }); // Guest has 1 connection to host
            return;
        }
        // Local or Host
        handleAction(action, args);
    };

    const actions = {
        // --- Network Setup ---
        hostGame: async () => {
            setGameMode('HOST');
            const id = await initNetwork();
            return id;
        },
        joinGame: async (hostId: string) => {
            setGameMode('GUEST');
            await initNetwork(); // random id
            if (!netRef.current) throw new Error('Network initialization failed');
            await netRef.current.connectToHost(hostId);
        },
        // --- Game Actions ---
        startGame: (playerCount: number) => {
            if (gameMode === 'GUEST') return; // Guests can't start

            // Setup Names
            const names = ['Host'];
            // If Networking, map peers to players?
            // For MVP Ver 3.0: 
            // - Host is P1.
            // - Connected Guest 1 is P2.
            // - Connected Guest 2 is P3.
            // - Rest AI.

            // To do this properly, we need to know who is who.
            // Let's assume sequential assignment for now or just generic names.
            // P1 = Host
            // P2 = Guest 1 ...

            connectedPeers.forEach((_pid, idx) => {
                if (idx + 1 < playerCount) names.push(`Guest ${idx + 1}`);
            });

            // Fill rest with AI
            while (names.length < playerCount) {
                names.push(`AI 봇 ${names.length}`);
            }

            engineRef.current = new GameEngine(names);
            // IMPORTANT: Engine assumes players[0] is current local?
            // Engine logic uses 'names' to create IDs 'p-0', 'p-1'.
            // Host is 'p-0'.
            // Guests need to know their ID. 
            // We need to send PLAYER_INFO to guests? "You are p-1".

            // For now, let's just start engine.
            engineRef.current.rollDice();
            updateState();

            // We need to tell Guests "You are P2".
            // Implementation detail: Guest needs to identify their own ID.
            // Currently `App.tsx` finds "isHuman".
            // But `GameEngine` marks 'isHuman' for ALL passed names?
            // `GameEngine` constructor: `names.forEach(n => ... isHuman: true)`?
            // Let's check Engine.

            // We need logic to assign IDs to Peers.
        },
        draftDie: (playerId: string, dieIndex: number) => dispatchAction('draftDie', playerId, dieIndex),
        markItem: (playerId: string, cellId: string) => dispatchAction('markItem', playerId, cellId),
        skipTurn: (playerId: string) => dispatchAction('skipTurn', playerId),
        modifyDie: (playerId: string, target: 'my' | 'center', delta: number) => dispatchAction('modifyDie', playerId, target, delta),
        registerBonus: (playerId: string, category: ItemType) => dispatchAction('registerBonus', playerId, category),

        // Read-only helpers (Run locally on state)
        isTowerComplete: (playerId: string, towerId: number) => {
            // Use local state
            if (!gameState) return false;
            // We can use static method or helper? Engine instance might not exist on Guest?
            // Actually Guest doesn't have engineRef?
            // Guest only has State.
            // We need to implement `isTowerComplete` based on `gameState` without engine class if possible.
            // OR Guest creates a dummy Engine with synced state?
            // Easiest: Guest uses `gameState`. We need helper function independent of Engine class?
            // Or we just checking state.
            const sheet = gameState.sheets[playerId];
            const towerCells = sheet.filter(c => c.towerId === towerId);
            return towerCells.length > 0 && towerCells.every(c => c.filledItem !== null);
        },
        getValidMoves: (playerId: string) => {
            // Logic is complex. Guest needs to run it.
            // We can create a temporary Engine instance with current state to run logic?
            if (!gameState) return [];
            const tempEngine = new GameEngine([]);
            tempEngine.state = JSON.parse(JSON.stringify(gameState)); // Deep copy?
            return tempEngine.getValidMoves(playerId);
        },
        getScoreBreakdown: (playerId: string) => {
            if (!gameState) return null;
            const tempEngine = new GameEngine([]);
            tempEngine.state = JSON.parse(JSON.stringify(gameState));
            return tempEngine.getScoreBreakdown(playerId);
        },
        sync: () => {
            if (gameMode === 'GUEST') {
                netRef.current?.broadcast({ type: 'SYNC_REQUEST', payload: {} });
            }
        }
    };

    return { gameState, gameMode, myPeerId, connectedPeers, actions };
};
