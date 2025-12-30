
import { useState, useEffect } from 'react';
import { useGame } from './hooks/useGame';
import { Sheet } from './components/Sheet';
import { Dice } from './components/Dice';
import { ScoreGuide } from './components/ScoreGuide';
import { Lobby } from './components/Lobby';
import './App.css';
import type { ItemType } from './game/types';

function App() {
  const { gameState, actions, gameMode, myPeerId, connectedPeers } = useGame();

  // Mobile / UI State
  const [showOpponents, setShowOpponents] = useState(true);

  // Auto-hide opponents on mobile start
  useEffect(() => {
    if (window.innerWidth < 768) {
      setShowOpponents(false);
    }
  }, []);

  if (!gameState) {
    return (
      <div className="app-container lobby-container">
        <h1>🐈 캣타워 (Cat Tower) 🏰</h1>
        <Lobby
          onStartLocal={(count) => actions.startGame(count)}
          onHostGame={actions.hostGame}
          onJoinGame={actions.joinGame}
          onStartMultiplayer={(count) => actions.startGame(count)}
          myPeerId={myPeerId}
          connectedPeers={connectedPeers}
          isHost={gameMode === 'HOST'}
        />
      </div>
    );
  }
  // If Guest: I need to know my ID.
  // Let's rely on standard ID assignment: p-0, p-1...
  // Host is p-0. Guest 1 is p-1.
  // If we are Guest, how do we know we are Guest 1?
  // We don't. 
  // CRITICAL FIX: We need identifying info.
  // But for now, let's assume Game Mode is Host vs 1 Guest (2 players).
  // Then Guest is always p-1.

  const realMyId = gameMode === 'LOCAL'
    ? (gameState.players.find(p => p.isHuman)?.id || 'p-0')
    : (gameMode === 'HOST' ? 'p-0' : 'p-1'); // Guest hardcoded to p-1 for MVP

  const myPlayer = gameState.players.find(p => p.id === realMyId) || gameState.players[0];

  // Logic for Turn Validity
  // Draft Phase: Strict Turn Order
  // Mark Phase: Simultaneous (Everyone who hasn't finished is "Active")
  const isMyTurn = gameState.phase === 'MARK'
    ? !gameState.turnCompleted?.[realMyId]
    : gameState.players[gameState.currentPlayerIndex].id === realMyId;

  const footprints = gameState.footprints[realMyId] || 0;

  // Checking if bonus selection is needed
  const isBonusPending = gameState.pendingBonusSelection === realMyId;
  const myBonuses = gameState.bonusScores[realMyId] || {};

  // Highlighting
  const validMoves = actions.getValidMoves(realMyId);

  const handleCellClick = (cellId: string) => {
    if (gameState.phase === 'MARK' && !isBonusPending) {
      actions.markItem(realMyId, cellId);
    }
  };

  const handleBonusSelect = (item: ItemType) => {
    actions.registerBonus(realMyId, item);
  };

  const bonusItems: ItemType[] = ['Yarn', 'Butterfly', 'Bowl', 'Cushion', 'Mouse'];
  const bonusIcons: Record<ItemType, string> = {
    'Yarn': '🧶', 'Butterfly': '🦋', 'Bowl': '🥣', 'Cushion': '🛋️', 'Mouse': '🐭', 'House': '🏠'
  };

  // --- Game Over Screen ---
  if (gameState.phase === 'END') {
    const winner = [...gameState.players].sort((a, b) => b.score - a.score)[0];
    const isWinner = winner.id === realMyId;

    return (
      <div className="app-container lobby">
        <div className="lobby-box" style={{ maxWidth: '800px', width: '90%' }}>
          <h1>🏁 게임 종료! 🏁</h1>
          <h2>{isWinner ? "축하합니다! 승리했습니다! 🎉" : "아쉽게도 패배했습니다."}</h2>

          <div className="scoreboard">
            {[...gameState.players]
              .sort((a, b) => b.score - a.score)
              .map((p, idx) => {
                const bd = actions.getScoreBreakdown!(p.id)?.breakdown;
                const isWinner = idx === 0;
                return (
                  <div key={p.id} className={`score-row ${isWinner ? 'winner' : ''}`} style={{ borderBottom: '1px solid #eee', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem' }}>
                      <span>{p.name} {isWinner && '👑'}</span>
                      <span>{Number.isInteger(p.score) ? p.score : p.score.toFixed(1)} 점</span>
                    </div>
                    {bd && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: 5, display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <span>🏆{bd.tower}</span>
                        <span>🧶{Number.isInteger(bd.yarn) ? bd.yarn : bd.yarn.toFixed(1)}</span>
                        <span>🏠{bd.bonus}</span>
                        <span>🦋{bd.butterfly}</span>
                        <span>🥣{bd.bowl}</span>
                        <span>🛋️{bd.cushion}</span>
                        <span>🐭{bd.mouse}</span>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <button className="btn-primary" onClick={() => window.location.reload()}>다시 하기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Bonus Modal Overlay */}
      {isBonusPending && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>🏠 집 건설 보너스!</h3>
            <p>3배 점수 아이템 선택:</p>
            <div className="bonus-options">
              {bonusItems.map(item => {
                const isTaken = myBonuses[item] !== undefined;
                const count = (gameState.sheets[realMyId] || []).filter(c => c.filledItem === item).length;
                return (
                  <button
                    key={item}
                    onClick={() => handleBonusSelect(item)}
                    disabled={isTaken}
                    style={{ opacity: isTaken ? 0.5 : 1, cursor: isTaken ? 'not-allowed' : 'pointer' }}
                  >
                    <div>{bonusIcons[item]} {item}</div>
                    <div style={{ fontSize: '0.8rem', marginTop: 2 }}>
                      ({count}개 → {count * 3}점)
                    </div>
                    {isTaken && <div style={{ fontSize: '0.8rem', color: 'red' }}>(사용됨)</div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <header>
        <div className="header-left">
          <h1>🐈 캣타워</h1>
          {gameMode !== 'LOCAL' && <span className="badge-net">{gameMode}</span>}
        </div>

        <div className="status-bar">
          Round {gameState.currentRound} | {gameState.phase === 'DRAFT' ? '주사위' : '배치'} |
          <span style={{ color: isMyTurn ? 'blue' : '#d35400', fontWeight: 'bold' }}>
            {isMyTurn ? ' 내 차례!' : ` ${gameState.players[gameState.currentPlayerIndex].name}의 차례`}
          </span>
        </div>

        <div className="header-right">
          {!isMyTurn && <span className="waiting-badge">⏳ 대기 중...</span>}
          {gameMode === 'GUEST' && (
            <button className="btn-small" onClick={() => actions.sync()} style={{ marginRight: 5 }} title="서버 상태 강제 동기화">
              🔄 Sync
            </button>
          )}
          <button className="btn-small" onClick={() => setShowOpponents(!showOpponents)}>
            {showOpponents ? '👀 상대 숨기기' : '👁️ 상대 보기'}
          </button>
        </div>
      </header>

      <main className="game-area">
        {/* Left Panel: Opponents (Toggleable) */}
        {showOpponents && (
          <div className="opponent-panel">
            {gameState.players.filter(p => p.id !== realMyId).map(opp => {
              const bd = actions.getScoreBreakdown!(opp.id)?.breakdown;
              return (
                <div key={opp.id} className="opponent-card">
                  <h4>{opp.name} ({opp.score}점) 🐾{gameState.footprints[opp.id]}</h4>
                  {bd && (
                    <div className="mini-stats">
                      <span>🏆{bd.tower}</span>
                      <span>🧶{bd.yarn}</span>
                      <span>🏠{bd.bonus}</span>
                      <span>🦋{bd.butterfly}</span>
                      <span>🥣{bd.bowl}</span>
                      <span>🛋️{bd.cushion}</span>
                      <span>🐭{bd.mouse}</span>
                    </div>
                  )}
                  <div className="sheet-preview">
                    <div className="sheet-scale">
                      <Sheet
                        cells={gameState.sheets[opp.id] || []}
                        onCellClick={() => { }}
                        towerClaims={gameState.towerClaims}
                        sheetOwnerId={opp.id}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Center Panel */}
        <div className="center-panel">
          <ScoreGuide />

          {gameState.phase === 'DRAFT' && (
            <div className="action-box">
              <h3>주사위 선택</h3>
              <div className="dice-pool">
                {gameState.availableDice.map((val, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <Dice
                      value={val}
                      onClick={() => isMyTurn && actions.draftDie(realMyId, idx)}
                      disabled={!isMyTurn}
                    />
                    {val === 3 && <span className="bonus-badge">🐾+1</span>}
                  </div>
                ))}
              </div>
              {!isMyTurn && <p>상대방이 선택 중입니다...</p>}
            </div>
          )}

          {gameState.phase === 'MARK' && (
            <div className="marking-pool">
              <h3>아이템 배치</h3>

              <div className="dice-control-row">
                <div className="dice-control">
                  <Dice value={gameState.draftedDice[realMyId]} label="내 주사위" disabled />
                  <div className="modifiers">
                    <button disabled={!isMyTurn || isBonusPending || footprints < 1 || gameState.draftedDice[realMyId] <= 1} onClick={() => actions.modifyDie(realMyId, 'my', -1)}>-</button>
                    <button disabled={!isMyTurn || isBonusPending || footprints < 1 || gameState.draftedDice[realMyId] >= 6} onClick={() => actions.modifyDie(realMyId, 'my', 1)}>+</button>
                  </div>
                </div>

                <div className="dice-control">
                  <Dice value={gameState.centerDie!} label="중앙 주사위" disabled />
                  <div className="modifiers">
                    <button disabled={!isMyTurn || isBonusPending || footprints < 1 || gameState.centerDie! <= 1} onClick={() => actions.modifyDie(realMyId, 'center', -1)}>-</button>
                    <button disabled={!isMyTurn || isBonusPending || footprints < 1 || gameState.centerDie! >= 6} onClick={() => actions.modifyDie(realMyId, 'center', 1)}>+</button>
                  </div>
                </div>
              </div>

              <p className="instruction">
                {isBonusPending ? "보너스 아이템을 선택하세요!" : "(발자국을 써서 주사위 값을 바꾸세요)"}
              </p>
              {!isBonusPending && isMyTurn && (
                <button className="btn-secondary" onClick={() => actions.skipTurn(realMyId)}>
                  턴 건너뛰기 (+1 🐾)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: My Tower */}
        <div className="player-panel">
          <div className="my-header">
            <h3>나: {myPlayer.name} ({myPlayer.score}점) 🐾{footprints}</h3>
          </div>

          {/* Real-time Breakdown */}
          {(() => {
            const bd = actions.getScoreBreakdown!(realMyId)?.breakdown;
            if (!bd) return null;
            return (
              <div className="stats-row">
                <span title="타워">🏆{bd.tower}</span>
                <span title="실타래">🧶{Number.isInteger(bd.yarn) ? bd.yarn : bd.yarn.toFixed(1)}</span>
                <span title="집">🏠{bd.bonus}</span>
                <span title="나비">🦋{bd.butterfly}</span>
                <span title="밥그릇">🥣{bd.bowl}</span>
                <span title="쿠션">🛋️{bd.cushion}</span>
                <span title="쥐">🐭{bd.mouse}</span>
              </div>
            )
          })()}

          <Sheet
            cells={gameState.sheets[realMyId] || []}
            onCellClick={handleCellClick}
            highlightedCells={validMoves}
            towerClaims={gameState.towerClaims}
            sheetOwnerId={realMyId}
          />

          <div className="bonus-display">
            {bonusItems.map(item => {
              const score = myBonuses[item];
              return (
                <div key={item} className={`bonus-item ${score !== undefined ? 'active' : ''}`}>
                  <span>{bonusIcons[item]}</span>
                  <span>{score !== undefined ? score : '-'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </main >
    </div >
  );
}

export default App;
