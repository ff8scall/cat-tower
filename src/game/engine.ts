
import type { GameState, Player, DieValue, Cell, ItemType } from './types';
import { createInitialCells } from './boardData';

export class GameEngine {
    state: GameState;

    constructor(playerNames: string[]) {
        this.state = this.initializeGame(playerNames);
    }

    // Helper to check completion (public for UI)
    public isTowerComplete(playerId: string, towerId: number): boolean {
        const sheet = this.state.sheets[playerId];
        const towerCells = sheet.filter(c => c.towerId === towerId);
        return towerCells.length > 0 && towerCells.every(c => c.filledItem !== null);
    }

    private initializeGame(names: string[]): GameState {
        const players: Player[] = names.map((name, idx) => ({
            id: `p-${idx}`,
            name,
            isHuman: !name.startsWith('AI'),
            score: 0
        }));

        const sheets: Record<string, Cell[]> = {};
        const footprints: Record<string, number> = {};


        const bonusScores: Record<string, Partial<Record<ItemType, number>>> = {};

        players.forEach(p => {
            sheets[p.id] = createInitialCells();
            footprints[p.id] = 1; // Start with 1 Footprint
            bonusScores[p.id] = {};
        });

        // Init Tower Claims
        const towerClaims: Record<number, { high: string | null; low: string | null }> = {};
        [0, 1, 2, 3, 4].forEach(tid => {
            towerClaims[tid] = { high: null, low: null };
        });

        return {
            currentRound: 1,
            maxRounds: 99,
            players,
            currentPlayerIndex: 0,
            rolledDice: [],
            availableDice: [],
            draftedDice: {},
            centerDie: null,
            sheets,
            footprints,
            bonusScores,
            towerClaims,
            pendingBonusSelection: null,
            phase: 'DRAFT'
        };
    }

    // Helper to get valid moves for highlighting
    getValidMoves(playerId: string): string[] {
        if (this.state.phase !== 'MARK') return [];
        if (this.state.pendingBonusSelection === playerId) return []; // Cannot move while selecting bonus

        const myDie = this.state.draftedDice[playerId];
        const centerDie = this.state.centerDie;
        if (!myDie || !centerDie) return [];

        const sheet = this.state.sheets[playerId];
        const validIds: string[] = [];

        const mapping = (d: number) => {
            const map: Record<number, any> = {
                1: 'House', 2: 'Yarn', 3: 'Butterfly', 4: 'Bowl', 5: 'Cushion', 6: 'Mouse'
            };
            return map[d];
        };

        sheet.forEach(cell => {
            if (cell.filledItem) return;

            let potentialItem = null;
            // Check combo 1: Floor = MyDie, Item = CenterDie
            if (cell.floor === myDie) potentialItem = mapping(centerDie);
            // Check combo 2: Floor = CenterDie, Item = MyDie
            else if (cell.floor === centerDie) potentialItem = mapping(myDie);

            if (potentialItem) {
                if (cell.isHouseOnly && potentialItem !== 'House') return;
                validIds.push(cell.id);
            }
        });

        return validIds;
    }

    // --- ACTIONS ---

    rollDice() {
        const count = this.state.players.length + 1;
        const newDice: DieValue[] = [];
        for (let i = 0; i < count; i++) {
            newDice.push((Math.floor(Math.random() * 6) + 1) as DieValue);
        }
        this.state.rolledDice = newDice;
        this.state.availableDice = [...newDice];
        this.state.draftedDice = {};
        this.state.centerDie = null;
        this.state.phase = 'DRAFT';
    }

    draftDie(playerId: string, availableIndex: number) {
        if (this.state.phase !== 'DRAFT') return;
        // Enforce Turn
        if (this.state.players[this.state.currentPlayerIndex].id !== playerId) return;

        if (availableIndex < 0 || availableIndex >= this.state.availableDice.length) return;

        const dieValue = this.state.availableDice[availableIndex];

        // Rule: Draft Butterfly (3) -> +1 Footprint
        if (dieValue === 3) {
            this.state.footprints[playerId] = (this.state.footprints[playerId] || 0) + 1;
        }

        this.state.availableDice.splice(availableIndex, 1);
        this.state.draftedDice[playerId] = dieValue;

        this.checkPhaseTransition();
    }

    modifyDie(playerId: string, target: 'my' | 'center', delta: number) {
        if (this.state.phase !== 'MARK') return;
        // In MARK phase, actions are simultaneous. Turn order is NOT enforced.
        if (this.state.turnCompleted?.[playerId]) return; // Already finished?

        const cost = Math.abs(delta);
        if (this.state.footprints[playerId] < cost) return;

        this.state.footprints[playerId] -= cost;

        if (target === 'my') {
            let val = this.state.draftedDice[playerId];
            // Wrap around logic? Or clamp? usually dice games wrap 1-6? 
            // User said "1 <-> 6 not connected".
            val = Math.max(1, Math.min(6, val + delta)) as DieValue;
            this.state.draftedDice[playerId] = val;
        } else {
            // Center die modification local only?
            // Actually Center Die is shared state.
            // If I modify it, does it stay modified for others?
            // Usually in Cat Tower, Center Die is fixed?
            // "발자국을 사용해 주사위 눈을 변경 가능" (Use footprints to change dice pip).
            // Usually applies to ANY die you use.
            // If I use Center Die, I verify against modified value.
            // But does it change for everyone?
            // If sequential marking: Yes?
            // Or only for my usage?
            // Let's assume shared modification for now as it's simpler.
            if (this.state.centerDie) {
                let val = this.state.centerDie;
                val = Math.max(1, Math.min(6, val + delta)) as DieValue;
                this.state.centerDie = val;
            }
        }
    }

    skipTurn(playerId: string) {
        if (this.state.phase !== 'MARK') return;
        // Gain Footprint
        this.state.footprints[playerId] += 1;
        this.finishTurn(playerId);
    }

    markItem(playerId: string, cellId: string) {
        if (this.state.phase !== 'MARK') return;
        // If pending bonus, must select bonus first!
        if (this.state.pendingBonusSelection) return;

        const myDie = this.state.draftedDice[playerId];
        const centerDie = this.state.centerDie!;
        const sheet = this.state.sheets[playerId];
        const cell = sheet.find(c => c.id === cellId);

        if (!cell || cell.filledItem) return;

        const mapping = (d: number) => {
            const map: Record<number, any> = {
                1: 'House', 2: 'Yarn', 3: 'Butterfly', 4: 'Bowl', 5: 'Cushion', 6: 'Mouse'
            };
            return map[d];
        };

        let itemToPlace: ItemType | null = null;

        if (myDie === cell.floor) itemToPlace = mapping(centerDie);
        else if (centerDie === cell.floor) itemToPlace = mapping(myDie);

        if (itemToPlace) {
            if (cell.isHouseOnly && itemToPlace !== 'House') return;
            cell.filledItem = itemToPlace;

            // Check Tower Completion & Claim
            if (this.isTowerComplete(playerId, cell.towerId)) {
                this.checkTowerCompletion(playerId, cell.towerId);
            }

            if (itemToPlace === 'House') {
                // Check if player has already claimed ALL 6 bonus types
                const currentBonuses = Object.keys(this.state.bonusScores[playerId] || {}).length;
                if (currentBonuses >= 6) {
                    // All bonuses claimed, skip selection
                    this.finishTurn(playerId);
                } else {
                    this.state.pendingBonusSelection = playerId;
                }
            } else {
                this.finishTurn(playerId);
            }
        }
    }

    // Check Tower Completion (Competition)
    checkTowerCompletion(playerId: string, towerId: number) {
        // Check claims
        const claim = this.state.towerClaims[towerId];

        // If I already claimed this tower, do nothing
        if (claim.high === playerId || claim.low === playerId) return;

        if (!claim.high) {
            claim.high = playerId;
        } else if (!claim.low) {
            claim.low = playerId;
        }
    }

    registerBonus(playerId: string, category: ItemType) {
        if (this.state.pendingBonusSelection !== playerId) return;
        // Prevent re-selection
        if (this.state.bonusScores[playerId][category] !== undefined) return;

        // IMMEDIATE SCORING LOGIC
        const sheet = this.state.sheets[playerId];
        const currentCount = sheet.filter(c => c.filledItem === category).length;
        const score = currentCount * 3;

        this.state.bonusScores[playerId][category] = score;
        this.state.pendingBonusSelection = null;

        this.finishTurn(playerId);
    }


    // Check game end condition
    private checkGameEnd() {
        // Condition: Any player has completed 3 towers?
        // Note: Rules say "End Round when..." or "Immediate"? 
        // User said: "3 towers built -> Game End".
        // Usually in Roll & Write, we finish the round. 
        // Since we are checking at "endRound", we are safe.

        let gameOver = false;

        this.state.players.forEach(p => {
            const completedCount = [0, 1, 2, 3, 4].filter(tid => this.isTowerComplete(p.id, tid)).length;
            if (completedCount >= 3) {
                gameOver = true;
            }
        });

        if (gameOver || this.state.currentRound >= this.state.maxRounds) {
            this.state.phase = 'END';
            this.calculateFinalScores();
        }
    }

    private calculateFinalScores() {
        this.state.players.forEach(p => {
            // Basic Score Implementation
            // This needs to be robust based on Scoring rules
            // For now, we update p.score based on current state (which should be updated live or here)
            p.score = this.calculateScore(p.id);
        });
    }

    // Detailed Score Breakdown
    getScoreBreakdown(playerId: string) {
        const sheet = this.state.sheets[playerId];
        const items = (type: ItemType) => sheet.filter(c => c.filledItem === type);

        // 1. Bonus Scores
        const bonuses = this.state.bonusScores[playerId] || {};
        const bonusTotal = Object.values(bonuses).reduce((a, b) => a + b, 0);

        // 2. Butterfly (3 pts each)
        const butterflies = items('Butterfly').length;
        const butterflyScore = butterflies * 3;

        // 3. Bowl (Adj Unique Types * 2)
        let bowlScore = 0;
        const getUniqueNeighborTypes = (c: Cell) => {
            const types = new Set<ItemType>();
            c.neighbors.forEach(nid => {
                const n = sheet.find(sc => sc.id === nid);
                if (n && n.filledItem) {
                    types.add(n.filledItem);
                }
            });
            return types.size;
        };
        items('Bowl').forEach(c => bowlScore += getUniqueNeighborTypes(c) * 2);

        // 4. Cushion (Floor pts)
        let cushionScore = 0;
        items('Cushion').forEach(c => cushionScore += c.floor);

        // 5. Mouse (Group^2)
        let mouseScore = 0;
        const visited = new Set<string>();
        items('Mouse').forEach(m => {
            if (visited.has(m.id)) return;
            const queue = [m];
            visited.add(m.id);
            let size = 0;
            while (queue.length > 0) {
                const curr = queue.shift()!;
                size++;
                curr.neighbors.forEach(nid => {
                    const n = sheet.find(sc => sc.id === nid);
                    if (n && n.filledItem === 'Mouse' && !visited.has(nid)) {
                        visited.add(nid);
                        queue.push(n);
                    }
                });
            }
            mouseScore += size * size;
        });

        // 6. Tower Claims
        let towerScore = 0;
        const TOWER_SCORES: Record<number, [number, number]> = {
            0: [6, 4], 1: [9, 5], 2: [7, 3], 3: [8, 4], 4: [3, 2]
        };
        [0, 1, 2, 3, 4].forEach(tid => {
            const claim = this.state.towerClaims[tid];
            if (claim.high === playerId) towerScore += TOWER_SCORES[tid][0];
            else if (claim.low === playerId) towerScore += TOWER_SCORES[tid][1];
        });

        // 7. Yarn (Per Tower Majority)
        // Rule: For each tower, Winner (Most Yarn) shares 9pts, Losers share 3pts.
        let yarnScore = 0;

        // We need to iterate all towers 0..4
        for (let tid = 0; tid < 5; tid++) {
            // 1. Count Yarns for this tower for ALL players
            const counts = this.state.players.map(p => {
                const count = this.state.sheets[p.id].filter(c => c.towerId === tid && c.filledItem === 'Yarn').length;
                return { pid: p.id, count };
            });

            const maxCount = Math.max(...counts.map(c => c.count));

            // If no one has yarn in this tower, no points? Or strictly following "others share 3"?
            // Usually if max is 0, no points distributed.
            if (maxCount === 0) continue;

            const winners = counts.filter(c => c.count === maxCount);
            const losers = counts.filter(c => c.count < maxCount);

            // Calculate Points
            // Winner Pot: 9. Split among winners.
            const winnerPoints = 9 / winners.length;

            // Loser Pot: 3. Split among losers.
            const loserPoints = losers.length > 0 ? (3 / losers.length) : 0;

            if (winners.some(w => w.pid === playerId)) {
                yarnScore += winnerPoints;
            } else if (losers.some(l => l.pid === playerId)) {
                yarnScore += loserPoints;
            }
        }

        // Round yarnScore? Usually floor or keep float?
        // User said "1 point each (3/3)". 3/3 is integer.
        // What if 2 winners? 4.5? Game usually uses integers.
        // Let's Floor or allow decimals? 
        // "3점을 반으로 나눠서" -> 1.5? 
        // Let's keep it float but display formatted? Or Floor?
        // Let's assume standard rounding or Floor. I'll keep decimals for accuracy or use Floor if required.
        // UI might look ugly with decimals. I'll use Math.floor for now to be safe, or just keep it.
        // User example 3/3 = 1 is clean. 
        // If 2 losers: 1.5. 
        // I will keep decimals for now.

        const total = bonusTotal + butterflyScore + bowlScore + cushionScore + mouseScore + towerScore + yarnScore;

        return {
            total,
            breakdown: {
                bonus: bonusTotal,
                butterfly: butterflyScore,
                bowl: bowlScore,
                cushion: cushionScore,
                mouse: mouseScore,
                tower: towerScore,
                yarn: yarnScore
            }
        };
    }

    calculateScore(playerId: string): number {
        return this.getScoreBreakdown(playerId).total;
    }

    private finishTurn(playerId: string) {
        // Update scores live for UI
        this.state.players.forEach(p => {
            p.score = this.calculateScore(p.id);
        });

        // Mark this player as done for this round
        if (!this.state.turnCompleted) {
            this.state.turnCompleted = {};
        }
        this.state.turnCompleted[playerId] = true;

        // Check if ALL players are done
        const allDone = this.state.players.every(p => this.state.turnCompleted![p.id]);

        if (allDone) {
            this.endRound();
        }
    }

    // ... (AI Logic same as before but uses skip if needed)

    private checkPhaseTransition() {
        if (this.state.phase === 'DRAFT') {
            const totalDrafted = Object.keys(this.state.draftedDice).length;
            if (totalDrafted === this.state.players.length) {
                if (this.state.availableDice.length === 1) {
                    this.state.centerDie = this.state.availableDice[0];
                    this.state.availableDice = [];
                }
                this.state.phase = 'MARK';
                this.processAIMoves();
            } else {
                this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
                const nextPlayer = this.state.players[this.state.currentPlayerIndex];
                if (!nextPlayer.isHuman) {
                    this.playAITurn();
                }
            }
        }
    }

    playAITurn() {
        // AI Draft
        const availableIndices = this.state.availableDice.map((_, i) => i);
        if (availableIndices.length === 0) return;
        // Simple AI: Prefer 3 (Butterfly)
        let pick = availableIndices.find(i => this.state.availableDice[i] === 3);
        if (pick === undefined) pick = Math.floor(Math.random() * availableIndices.length);

        this.draftDie(this.state.players[this.state.currentPlayerIndex].id, pick);
    }

    processAIMoves() {
        // Very Basic AI Marking
        this.state.players.forEach(p => {
            if (!p.isHuman) {
                // Logic to find valid move
                // If no valid move, SKIP
                const moveFound = this.aiFindMove(p.id);
                if (!moveFound) {
                    this.state.footprints[p.id] += 1; // AI Skip
                }
            }
        });
    }

    private aiFindMove(playerId: string): boolean {
        const myDie = this.state.draftedDice[playerId];
        const centerDie = this.state.centerDie!;
        const sheet = this.state.sheets[playerId];

        const candidates = [...sheet].filter(c => !c.filledItem);
        const mapping = (d: number) => (['', 'House', 'Yarn', 'Butterfly', 'Bowl', 'Cushion', 'Mouse'][d] as any);

        for (const cell of candidates) {
            let item = null;
            if (myDie === cell.floor) item = mapping(centerDie);
            else if (centerDie === cell.floor) item = mapping(myDie);

            if (item) {
                if (cell.isHouseOnly && item !== 'House') continue;
                cell.filledItem = item;
                if (item === 'House') {
                    // AI Random Bonus
                    this.registerBonus(playerId, 'Yarn');
                }
                return true;
            }
        }
        return false;
    }

    endRound() {
        this.checkGameEnd(); // CHECK HERE

        if (this.state.phase === 'END') return;

        this.state.currentRound++;
        this.state.phase = 'DRAFT';

        // Use Index Offset instead of Array Rotation to keep IDs stable
        // Round 1 start: 0. Round 2 start: 1.
        this.state.currentPlayerIndex = (this.state.currentRound - 1) % this.state.players.length;

        this.state.draftedDice = {};
        this.state.centerDie = null;
        this.state.turnCompleted = {};
        this.rollDice();

        // If starting player is AI, they draft
        if (!this.state.players[this.state.currentPlayerIndex].isHuman) {
            this.playAITurn();
        }
    }
}
