
import type { Cell, TowerId } from './types';

interface TowerConfig {
    id: TowerId;
    color: string;
    floors: number[];
    houseFloors: number[];
    scoreHigh: number;
    scoreLow: number;
}

// Visual Layout from Image (Left->Right):
// T0 (Yellow): 5 floors [1,2,3,4,5] (Lower?)
// T1 (Red): 6 floors [1,2,3,4,5,6] (Higher)
// T2 (Green): 6 floors [1,2,3,4,5,6] (Lower)
// T3 (Blue): 6 floors [1,2,3,4,5,6] (Higher)
// T4 (Purple): 4 floors [1,2,3,4] (Lower)
// Let's assume layout: 
// Even Cols (0, 2, 4) are SHIFTED DOWN (Y+0.5) or Odd Cols (1,3) are SHIFTED UP.
// Staggered layout.
export const TOWER_CONFIGS: TowerConfig[] = [
    { id: 0, color: '#D4AC0D', floors: [1, 2, 3, 4, 5], houseFloors: [3], scoreHigh: 6, scoreLow: 4 },
    { id: 1, color: '#C0392B', floors: [1, 2, 3, 4, 5, 6], houseFloors: [2], scoreHigh: 9, scoreLow: 5 },
    { id: 2, color: '#27AE60', floors: [1, 2, 3, 4, 5, 6], houseFloors: [5], scoreHigh: 7, scoreLow: 3 },
    { id: 3, color: '#2980B9', floors: [1, 2, 3, 4, 5, 6], houseFloors: [4], scoreHigh: 8, scoreLow: 4 },
    { id: 4, color: '#8E44AD', floors: [1, 2, 3, 4], houseFloors: [], scoreHigh: 3, scoreLow: 2 },
];

export const createInitialCells = (): Cell[] => {
    const cells: Cell[] = [];

    // Create Cells
    TOWER_CONFIGS.forEach(tower => {
        tower.floors.forEach(floor => {
            cells.push({
                id: `${tower.id}-${floor}`,
                towerId: tower.id,
                floor,
                filledItem: null,
                isHouseOnly: tower.houseFloors.includes(floor),
                neighbors: []
            });
        });
    });

    // Link Neighbors (HEX Staggered)
    // Assuming "Odd-Q" vertical layout (Columns).
    // Even cols (0, 2, 4) are low. Odd cols (1, 3) are high.
    // "High" means shifted UP visually (Y-0.5).
    // "Low" means shifted DOWN visually (Y+0.5).
    // Effectively: 
    // If Col is Even (Low):
    //   Left(Odd, High): (C-1, R), (C-1, R+1) ? 
    //   Let's think: Low(0,0) is adj to High(1,0) and High(1, -1)?
    //   Actually easier:
    //   If we align them by Floor Number visually?
    //   T0-F1 is bottom. T1-F1 is bottom.
    //   If bottom is aligned, they are just grid.
    //   User said "Hexagon shape".
    //   This implies: T0-F1 is adj to T1-F1 and T1-F2?
    //   Let's check the image logic roughly (Yellow 1 near Red 1,2?).
    //   Let's assume standard staggered connectivity:
    //   (T, F) neighbors:
    //   Vertical: (T, F-1), (T, F+1)
    //   Horizontal:
    //     If T is Even (0, 2, 4): (T-1, F), (T-1, F+1), (T+1, F), (T+1, F+1) (Assuming neighbors are "Up") 
    //     If T is Odd (1, 3): (T-1, F-1), (T-1, F), (T+1, F-1), (T+1, F) (Assuming neighbors are "Down")

    cells.forEach(cell => {
        const { towerId, floor } = cell;
        const isEvenTower = towerId % 2 === 0;

        const offsets: { t: number, f: number }[] = [
            { t: 0, f: 1 }, { t: 0, f: -1 }, // Vertical
        ];


        // FIXED LOGIC for ODD UP (+ Stagger):
        // Even(F) [Low] connects to Odd(F-1) [Below] and Odd(F) [Above]
        // Odd(F) [High] connects to Even(F) [Below] and Even(F+1) [Above]

        if (isEvenTower) {
            // Even Tower (Low)
            offsets.push({ t: -1, f: -1 }, { t: -1, f: 0 });
            offsets.push({ t: 1, f: -1 }, { t: 1, f: 0 });
        } else {
            // Odd Tower (High)
            offsets.push({ t: -1, f: 0 }, { t: -1, f: 1 });
            offsets.push({ t: 1, f: 0 }, { t: 1, f: 1 });
        }

        offsets.forEach(off => {
            const targetId = `${towerId + off.t}-${floor + off.f}`;
            const target = cells.find(c => c.id === targetId);
            if (target) {
                cell.neighbors.push(targetId);
            }
        });
    });

    return cells;
};
