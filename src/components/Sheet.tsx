
import React from 'react';
import styles from './Sheet.module.css';
import type { Cell } from '../game/types';
import { TOWER_CONFIGS } from '../game/boardData';

interface SheetProps {
    cells: Cell[];
    onCellClick: (cellId: string) => void;
    highlightedCells?: string[];
    towerClaims?: Record<number, { high: string | null; low: string | null }>;
    sheetOwnerId?: string;
}

// Adjusted for 5 Towers Vertical
const TOWER_WIDTH = 70;
const TOWER_GAP = 5;
const CELL_W = 50;
const LEFT_OFFSET = 30;
const FLOOR_HEIGHT = 60;
const BOTTOM_OFFSET = 60;
const STAGGER_Y = 40; // Amount to shift odd towers up

const ICONS: Record<string, string> = {
    House: '🏠',
    Yarn: '🧶',
    Butterfly: '🦋',
    Bowl: '🥣',
    Cushion: '🛋️',
    Mouse: '🐭'
};

export const Sheet: React.FC<SheetProps> = ({ cells, onCellClick, highlightedCells = [], towerClaims, sheetOwnerId }) => {

    return (
        <div className={styles.boardContainer}>
            <div className={styles.paperTexture}></div>
            {/* Render Towers */}
            {TOWER_CONFIGS.map((tower, tIdx) => {
                // Stagger: Shift Odd towers UP (or Even towers DOWN).
                // Let's shift ODD (1, 3) UP by STAGGER_Y.
                const stagger = tIdx % 2 !== 0 ? STAGGER_Y : 0;

                // Header is positioned from TOP. If we shift UP, TOP gets SMALLER.
                // But wait, if we shift elements UP from bottom, they go higher.
                // Header is at top: 20. If tower is higher, header should be higher?
                // Let's rely on BOTTOM for everything if possible, or adjust TOP.
                // Actually, let's keep header Top fixed or relative?
                // If tower moves up, header should probably follow.
                // If T0 is at bottom 0 (y=0), T1 is at bottom 40 (y=40).
                // Header for T0 is at Top 20. Header for T1 should be at Top 20 - 40? 
                // That might go off screen.
                // Let's shift EVEN towers DOWN?
                // If T0 is EVEN, shift DOWN (-40). 
                // Let's say Base is 0.
                // If we shift ODD towers UP, we need to make sure there's room on top.
                // Let's just adjust Bottom.

                // Claims
                const claim = towerClaims ? towerClaims[tower.id] : { high: null, low: null };
                const isHighTaken = claim.high !== null;
                const isLowTaken = claim.low !== null;

                // If viewing a specific player's sheet (sheetOwnerId provided)
                // Did THIS player claim it?
                const isHighMine = sheetOwnerId && claim.high === sheetOwnerId;
                const isLowMine = sheetOwnerId && claim.low === sheetOwnerId;

                return (
                    <React.Fragment key={tower.id}>
                        {/* Tower Header/Score */}
                        {/* Position: Absolute from TOP. Sticky header? 
                        If we stagger, the headers should stagger too.
                        If Odd tower is higher, header is higher (lower top value).
                    */}
                        <div
                            className={styles.towerHeader}
                            style={{
                                left: LEFT_OFFSET + tIdx * (TOWER_WIDTH + TOWER_GAP),
                                top: 20 - (stagger / 2),
                                color: tower.color,
                                display: 'flex', gap: 5, justifyContent: 'center',
                                zIndex: 10, fontWeight: 'bold', background: 'rgba(255,255,255,0.8)', padding: '2px 5px', borderRadius: 4
                            }}
                        >
                            {isHighTaken && !isHighMine ? (
                                <span style={{ color: '#aaa' }}>❌</span>
                            ) : (
                                <span style={{
                                    border: isHighMine ? '3px solid red' : 'none',
                                    borderRadius: '50%', padding: '0 4px',
                                    color: isHighMine ? 'red' : 'inherit'
                                }}>{tower.scoreHigh}</span>
                            )}

                            <span>/</span>

                            {isLowTaken && !isLowMine ? (
                                <span style={{ color: '#aaa' }}>❌</span>
                            ) : (
                                <span style={{
                                    border: isLowMine ? '3px solid blue' : 'none',
                                    borderRadius: '50%', padding: '0 4px',
                                    color: isLowMine ? 'blue' : 'inherit'
                                }}>{tower.scoreLow}</span>
                            )}
                        </div>

                        {/* Tower Pole (Visual Decoration) */}
                        <div style={{
                            position: 'absolute',
                            left: LEFT_OFFSET + tIdx * (TOWER_WIDTH + TOWER_GAP) + CELL_W / 2 - 5,
                            bottom: BOTTOM_OFFSET + stagger - 20, // Pole starts lower
                            width: 10,
                            height: 400,
                            backgroundColor: '#e59866',
                            borderRadius: 5,
                            opacity: 0.5
                        }}></div>

                        {/* Cells */}
                        {tower.floors.map(floor => {
                            const cellId = `${tower.id}-${floor}`;
                            const cell = cells.find(c => c.id === cellId);
                            if (!cell) return null;

                            const isHighlighted = highlightedCells.includes(cellId);
                            const itemType = cell.filledItem;
                            const houseOnly = cell.isHouseOnly;

                            return (
                                <div
                                    key={cellId}
                                    className={`${styles.cell} ${isHighlighted ? styles.highlight : ''} ${houseOnly ? styles.houseSlot : ''}`}
                                    style={{
                                        left: LEFT_OFFSET + tIdx * (TOWER_WIDTH + TOWER_GAP),
                                        bottom: (floor - 1) * FLOOR_HEIGHT + BOTTOM_OFFSET + stagger, // Apply Stagger
                                        width: CELL_W,
                                        height: CELL_W,
                                        borderColor: tower.color
                                    }}
                                    onClick={() => onCellClick(cellId)}
                                >
                                    <div className={styles.floorNum}>{floor}</div>

                                    {/* Item Rendering */}
                                    {itemType && <div className={styles.placedItem}>{ICONS[itemType]}</div>}

                                    {!itemType && houseOnly && <span className={styles.houseMark}>🏠</span>}
                                </div>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </div>
    );
};
