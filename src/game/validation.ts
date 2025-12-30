
import type { Cell, DieValue, ItemType } from './types';

export const ITEM_MAPPING: Record<number, ItemType> = {
    1: 'House',
    2: 'Yarn',
    3: 'Butterfly',
    4: 'Bowl',
    5: 'Cushion',
    6: 'Mouse'
};

export interface Move {
    diceValueForItem: DieValue;
    diceValueForFloor: DieValue;
    targetCellId: string;
}

export const isValidMove = (cell: Cell, itemDie: DieValue, floorDie: DieValue): { valid: boolean; reason?: string } => {
    // 1. Check Floor
    if (cell.floor !== floorDie) {
        return { valid: false, reason: `Target cell is on floor ${cell.floor}, but floor die is ${floorDie}.` };
    }

    // 2. Check Empty
    if (cell.filledItem !== null) {
        return { valid: false, reason: 'Cell is already filled.' };
    }

    const itemType = ITEM_MAPPING[itemDie];

    // 3. Check House Specific Constraints
    if (cell.isHouseOnly) {
        if (itemType !== 'House') {
            return { valid: false, reason: 'This cell is reserved for House items only.' };
        }
    }

    // Implicit Logic: Can House go to non-House cell?
    // Game doesn't forbid it. So allowed.

    return { valid: true };
};

export const getAvailableMoves = (cells: Cell[], itemDie: DieValue, floorDie: DieValue): string[] => {
    return cells
        .filter(cell => isValidMove(cell, itemDie, floorDie).valid)
        .map(cell => cell.id);
};
