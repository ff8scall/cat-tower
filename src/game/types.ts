
export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type ItemType = 'House' | 'Yarn' | 'Butterfly' | 'Bowl' | 'Cushion' | 'Mouse';
export type TowerId = 0 | 1 | 2 | 3 | 4;

export interface Cell {
    id: string; // "towerId-floor"
    towerId: TowerId;
    floor: number;
    filledItem: ItemType | null;
    isHouseOnly: boolean;
    neighbors: string[]; // List of cell IDs
}

export interface Player {
    id: string;
    name: string;
    isHuman: boolean;
    score: number;
}

export interface GameState {
    currentRound: number;
    maxRounds: number;
    players: Player[];
    currentPlayerIndex: number;

    rolledDice: DieValue[];
    availableDice: DieValue[];
    draftedDice: Record<string, DieValue>;
    centerDie: DieValue | null;

    sheets: Record<string, Cell[]>;
    footprints: Record<string, number>;

    // Track Tower Claims: towerId -> { high: playerId|null, low: playerId|null }
    towerClaims: Record<number, { high: string | null; low: string | null }>;

    // Track used bonuses keys
    bonusScores: Record<string, Partial<Record<ItemType, number>>>;

    pendingBonusSelection: string | null; // Player ID needing to select bonus

    phase: 'DRAFT' | 'MARK' | 'END';

    turnCompleted?: Record<string, boolean>;
}
