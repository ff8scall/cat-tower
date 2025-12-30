
import React, { useState } from 'react';

interface LobbyProps {
    onStartLocal: (count: number) => void;
    onHostGame: () => Promise<string>; // returns ID
    onJoinGame: (id: string) => Promise<void>;
    onStartMultiplayer: (count: number) => void;
    myPeerId: string;
    connectedPeers: string[];
    isHost: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({ onStartLocal, onHostGame, onJoinGame, onStartMultiplayer, myPeerId, connectedPeers, isHost }) => {
    const [mode, setMode] = useState<'MAIN' | 'HOSTING' | 'JOINING'>('MAIN');
    const [joinId, setJoinId] = useState('');
    const [localCount, setLocalCount] = useState(2);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleHostGame = async () => {
        setMode('HOSTING');
        setIsLoading(true);
        setError(null);
        try {
            await onHostGame();
        } catch (e: any) {
            setError(e.message || 'Failed to initialize network');
            setIsLoading(false);
            // setMode('MAIN'); // Optional: stay in hosting screen to show error?
        }
    };

    const handleJoinClick = async () => {
        setMode('JOINING');
        // We usually init network only when "Join" page is opened?
        // Current logic: joinGame is called when button is clicked inside JOINING page?
        // No, initNetwork is needed TO CONNECT.
        // Actually, Guest needs PeerID to connect? PeerJS requires it?
        // Yes, Peer instance must exist.
        // Wait, `onJoinGame` in App/useGame takes ID and connects.
        // But `useGame` `joinGame` calls `initNetwork` then `connect`.
        // So for "JOINING" screen to be useful (showing "My Peer ID" if we want, or just readiness),
        // we might need to separate `init` and `connect`.
        // BUT `useGame` bundles them in `joinGame`.
        // Wait! Current `Lobby` code calls `onJoinGame` inside JOINING view when ID is submitted.
        // But the JOINING view checks `myPeerId` to say "Ready".
        // This implies `init` was called somewhere?
        // Ah, in previous `App.tsx`: `<button onClick={() => { setMode('JOINING'); }}>` -> does NOT call init.
        // So `myPeerId` is empty.
        // Inside `JOINING` view: `myPeerId ? ... : 'Network initializing...'`
        // It seems I missed calling `initNetwork` for Guest when entering JOINING mode.
        // OR `useGame` `joinGame` does it all?
        // `useGame` `joinGame` does: `await initNetwork(); connectToHost(id)`.
        // So `myPeerId` will be null until user clicks "Join" button?
        // BUT the UI shows "Network Initializing" IF `!myPeerId`. This suggests it expects `myPeerId` to be present BEFORE inputting ID?
        // Actually, standard PeerJS flow: Guest needs their own PeerID to handshake.
        // So Guest MUST init network first.

        // Fix: When entering JOINING mode, we should Init Network (as Guest).
        // BUT `useGame` doesn't expose `initNetwork` alone.
        // `useGame` `joinGame` does both.
        // If `useGame` `joinGame` does both, then the UI "Network Initializing" is misleading if we haven't called it yet.
        // I should change logic:
        // Guest enters Joining Screen -> Can input ID immediately.
        // Clicking "Join" -> Calls `onJoinGame` -> Inits Network -> Connects.

        // However, existing UI logic in `Lobby.tsx` (lines 56-62) hides input form until `myPeerId` exists?
        // If so, who calls init for Guest?
        // In `multi-buttons`: `onClick={() => { setMode('JOINING'); }}` -> No init called.
        // So `myPeerId` is null. UI shows "Network initializing..." forever.
        // THIS IS THE BUG.

        // I need to:
        // 1. Expose `initNetwork` in `useGame` actions?
        // OR
        // 2. Change `useGame` `joinGame` to be split?
        // OR
        // 3. Just let Guest input ID without `myPeerId`. `onJoinGame` will handle init.

        // Logic 3 is best. I will update Lobby to show Input Form independently of `myPeerId`.
    };

    if (error) {
        return (
            <div className="lobby-box">
                <h3 style={{ color: 'red' }}>Error</h3>
                <p>{error}</p>
                <button className="btn-secondary" onClick={() => { setError(null); setMode('MAIN'); }}>Back</button>
            </div>
        )
    }

    if (mode === 'HOSTING') {
        return (
            <div className="lobby-box">
                <h2>방 만들기 (Host)</h2>
                {isLoading && !myPeerId ? <p>네트워크 초기화 중...</p> : null}

                {myPeerId ? (
                    <div className="id-display">
                        <p>내 방 ID (친구에게 공유하세요):</p>
                        <div className="code-box">{myPeerId}</div>
                    </div>
                ) : null}

                <div className="connected-list">
                    <h3>참가자 목록:</h3>
                    <ul>
                        <li>나 (Host)</li>
                        {connectedPeers.map((p, i) => <li key={i}>Guest {i + 1} ({p.slice(0, 5)}...)</li>)}
                    </ul>
                </div>

                {isHost && (
                    <div className="controls">
                        <p>총 플레이어 수 (AI 포함):</p>
                        <select value={localCount} onChange={(e) => setLocalCount(Number(e.target.value))}>
                            {[2, 3, 4].map(n => <option key={n} value={n}>{n}명</option>)}
                        </select>

                        <div className="slot-preview" style={{ margin: '15px 0', padding: '10px', background: '#eee', borderRadius: '5px', textAlign: 'left' }}>
                            <strong>게임 구성 미리보기:</strong>
                            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                                <li>P1: 나 (Host)</li>
                                {Array.from({ length: localCount - 1 }).map((_, idx) => {
                                    // idx 0 -> P2.
                                    // Check if guest exists
                                    const guest = connectedPeers[idx];
                                    return (
                                        <li key={idx} style={{ color: guest ? 'blue' : '#666' }}>
                                            P{idx + 2}: {guest ? `Guest ${idx + 1}` : `🤖 AI 봇 (자동)`}
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>

                        <button className="btn-primary" onClick={() => onStartMultiplayer(localCount)}>게임 시작</button>
                    </div>
                )}
                <button className="btn-secondary" onClick={() => setMode('MAIN')}>뒤로가기</button>
            </div>
        );
    }

    if (mode === 'JOINING') {
        // Allow input immediately. init/connect happens on click.
        return (
            <div className="lobby-box">
                <h2>방 참가하기 (Guest)</h2>
                {/* 
                  Note: checking !myPeerId here is irrelevant if we init on click. 
                  But if we are 'Connecting...', we should show loading.
                */}
                {isLoading ? (
                    <p>접속 중입니다...</p>
                ) : (
                    <div className="form-group">
                        <label>방 ID 입력:</label>
                        <input value={joinId} onChange={e => setJoinId(e.target.value)} placeholder="상대방 ID를 붙여넣으세요" />
                        <button className="btn-primary" onClick={async () => {
                            setIsLoading(true);
                            setError(null);
                            try {
                                await onJoinGame(joinId);
                            } catch (e: any) {
                                setError(e.message || 'Connection failed');
                                setIsLoading(false);
                            }
                        }}>참가</button>
                    </div>
                )}
                {myPeerId && <p style={{ fontSize: '0.8rem', color: '#666' }}>내 ID: {myPeerId}</p>}
                <button className="btn-secondary" onClick={() => setMode('MAIN')}>뒤로가기</button>
            </div>
        )
    }

    return (
        <div className="lobby-box">
            <h2>게임 설정</h2>
            <div className="mode-selection">
                <button className="btn-large" onClick={() => onStartLocal(localCount)}>
                    👤 싱글 플레이 (vs AI)
                </button>
                <div className="local-options">
                    <label>AI 수:</label>
                    <select value={localCount} onChange={(e) => setLocalCount(Number(e.target.value))}>
                        <option value={2}>1명 (총 2인)</option>
                        <option value={3}>2명 (총 3인)</option>
                        <option value={4}>3명 (총 4인)</option>
                    </select>
                </div>
            </div>

            <hr />

            <div className="mode-selection">
                <h3>🌐 멀티플레이 (Beta)</h3>
                <div className="multi-buttons">
                    <button className="btn-secondary" onClick={handleHostGame}>방 만들기</button>
                    <button className="btn-secondary" onClick={handleJoinClick}>방 참가하기</button>
                </div>
            </div>
        </div>
    );
};
