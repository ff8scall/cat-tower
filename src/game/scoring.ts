
import type { Cell, ItemType, TowerId } from './types';
import { TOWER_CONFIGS } from './boardData';

export const calculateScore = (cells: Cell[]): number => {
    let totalScore = 0;

    const butterflyCount = cells.filter(c => c.filledItem === 'Butterfly').length;
    totalScore += butterflyCount * 3;

    cells.filter(c => c.filledItem === 'Bowl').forEach(bowl => {
        const neighborItems = new Set<ItemType>();
        bowl.neighbors.forEach(nid => {
            const neighbor = cells.find(c => c.id === nid);
            if (neighbor && neighbor.filledItem) {
                neighborItems.add(neighbor.filledItem);
            }
        });
        totalScore += neighborItems.size * 2;
    });

    cells.filter(c => c.filledItem === 'Cushion').forEach(c => {
        totalScore += c.floor;
    });

    const mice = cells.filter(c => c.filledItem === 'Mouse');
    const visited = new Set<string>();

    mice.forEach(mouse => {
        if (visited.has(mouse.id)) return;
        let groupSize = 0;
        const queue = [mouse];
        visited.add(mouse.id);
        while (queue.length > 0) {
            const current = queue.shift()!;
            groupSize++;
            current.neighbors.forEach(nid => {
                const neighbor = cells.find(c => c.id === nid);
                if (neighbor && neighbor.filledItem === 'Mouse' && !visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    queue.push(neighbor);
                }
            });
        }
        totalScore += groupSize * groupSize;
    });

    return totalScore;
};

export const checkTowerCompletion = (cells: Cell[]): TowerId[] => {
    const completedTowers: TowerId[] = [];
    TOWER_CONFIGS.forEach(tower => {
        const towerCells = cells.filter(c => c.towerId === tower.id);
        const allFilled = towerCells.every(c => c.filledItem !== null);
        if (allFilled) {
            completedTowers.push(tower.id);
        }
    });
    return completedTowers;
};
