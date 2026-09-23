/* Pure match-3 engine. Classic script supports file://; CommonJS supports tests. */
(function (root) {
    'use strict';
    function createEngine(options = {}) {
        const BOARD_SIZE = options.size || 8;
        const typeCount = options.typeCount || 5;
        if (!Number.isInteger(BOARD_SIZE) || BOARD_SIZE < 3 || !Number.isInteger(typeCount) || typeCount < 3) {
            throw new RangeError('Board size and food count must be at least 3');
        }
        let board = [];
        let rngState = (options.seed === undefined ? Date.now() : options.seed) >>> 0;
        let refill = [];
        function random() {
            rngState = (Math.imul(1664525, rngState) + 1013904223) >>> 0;
            return rngState / 4294967296;
        }
        function nextColor() {
            return refill.length ? refill.shift() : Math.floor(random() * typeCount);
        }
        function setRefill(colors) {
            if (!colors.every(c => Number.isInteger(c) && c >= 0 && c < typeCount)) throw new RangeError('Invalid refill');
            refill = colors.slice();
        }
        function setBoard(input) {
            if (input.length !== BOARD_SIZE || input.some(row => row.length !== BOARD_SIZE)) throw new RangeError('Invalid board size');
            const normalized = input.map(row => row.map(value => {
                if (value === null) return null;
                const tile = typeof value === 'number' ? makeTile(value) : makeTile(value.color, value.special || null);
                if (![null, 'row-clear', 'column-clear', 'bomb', 'color-clear'].includes(tile.special)) throw new RangeError('Invalid special');
                if (!['bomb', 'color-clear'].includes(tile.special) && (!Number.isInteger(tile.color) || tile.color < 0 || tile.color >= typeCount)) throw new RangeError('Invalid food');
                return tile;
            }));
            board = normalized;
        }
        function mostCommonColor() {
            const counts = Array(typeCount).fill(0);
            board.flat().forEach(t => { if (t && !t.special) counts[t.color]++; });
            return counts.indexOf(Math.max(...counts));
        }

        function tileColor(r, c) {
            const t = board[r] && board[r][c];
            if (t === null || typeof t === 'undefined') return null;
            return t.color;
        }

        function tileSpecial(r, c) {
            const t = board[r] && board[r][c];
            return t !== null && typeof t === 'object' && t.special ? t.special : null;
        }

        function makeTile(color, special = null) {
            return { color: ['bomb', 'color-clear'].includes(special) ? null : color, special: special };
        }

        function coordKey(r, c) {
            return r + ',' + c;
        }

        function parseCoordKey(key) {
            const parts = String(key).split(',');
            return { r: Number(parts[0]), c: Number(parts[1]) };
        }

        function getGroupCenter(cells) {
            if (!cells.length) return null;
            return cells[Math.floor(cells.length / 2)];
        }

        function findMatchGroups() {
            const groups = [];

            for (let r = 0; r < BOARD_SIZE; r++) {
                let start = 0;
                while (start < BOARD_SIZE) {
                    const firstColor = tileColor(r, start);
                    if (firstColor === null) {
                        start++;
                        continue;
                    }
                    let end = start + 1;
                    while (end < BOARD_SIZE && tileColor(r, end) === firstColor) {
                        end++;
                    }
                    if (end - start >= 3) {
                        const cells = [];
                        for (let c = start; c < end; c++) {
                            cells.push({ r, c });
                        }
                        groups.push({ cells, color: firstColor, direction: 'horizontal' });
                    }
                    start = end;
                }
            }

            for (let c = 0; c < BOARD_SIZE; c++) {
                let start = 0;
                while (start < BOARD_SIZE) {
                    const firstColor = tileColor(start, c);
                    if (firstColor === null) {
                        start++;
                        continue;
                    }
                    let end = start + 1;
                    while (end < BOARD_SIZE && tileColor(end, c) === firstColor) {
                        end++;
                    }
                    if (end - start >= 3) {
                        const cells = [];
                        for (let r = start; r < end; r++) {
                            cells.push({ r, c });
                        }
                        groups.push({ cells, color: firstColor, direction: 'vertical' });
                    }
                    start = end;
                }
            }

            return groups;
        }

        function detectSpecialTiles(groups, preferredPositions) {
            const generated = [];
            const prefs = Array.isArray(preferredPositions) ? preferredPositions : [];
            // Merge overlapping matched lines, never merely adjacent food.
            // Each transitive component earns exactly one special.
            const remaining = new Set(groups);
            while (remaining.size) {
                const first = remaining.values().next().value;
                remaining.delete(first);
                const component = [first];
                const cells = new Map(first.cells.map(p => [coordKey(p.r,p.c), p]));
                for (let i = 0; i < component.length; i++) {
                    for (const group of remaining) {
                        if (!group.cells.some(p => cells.has(coordKey(p.r,p.c)))) continue;
                        remaining.delete(group);
                        component.push(group);
                        group.cells.forEach(p => cells.set(coordKey(p.r,p.c), p));
                    }
                }
                const ordered = [...cells.values()].sort((a,b) => a.r-b.r || a.c-b.c);
                const lines = component.slice().sort((a,b) => b.cells.length-a.cells.length ||
                    a.cells[0].r-b.cells[0].r || a.cells[0].c-b.cells[0].c);
                const longest = lines[0];
                const intersections = ordered.filter(p => component.filter(g =>
                    g.cells.some(q => q.r === p.r && q.c === p.c)).length > 1);
                const special = longest.cells.length >= 5 ? 'color-clear' : intersections.length ? 'bomb' :
                    longest.cells.length === 4 ? (longest.direction === 'horizontal' ? 'row-clear' : 'column-clear') : null;
                if (!special) continue;
                // Five-in-a-row rewards stay on the qualifying line; bombs
                // prefer intersections. Never overwrite an existing special.
                const eligible = special === 'bomb' ? ordered : longest.cells;
                const preferred = prefs.filter(p => eligible.some(q => q.r === p.r && q.c === p.c));
                const candidates = special === 'bomb' ? [...intersections, ...preferred, ...ordered] :
                    [...preferred, getGroupCenter(eligible), ...eligible];
                const location = candidates.find(p => board[p.r][p.c] && !tileSpecial(p.r,p.c));
                if (!location) continue;
                board[location.r][location.c] = makeTile(tileColor(location.r, location.c), special);
                generated.push({ r: location.r, c: location.c, special: special });
            }
            return generated;
        }

        function expandSpecialEffects(initialCells, targetMap, protectedKeys = new Set(), effects = []) {
            const cellsToClear = new Set();
            const queue = [];
            const processed = new Set();

            function enqueue(key, targetColor) {
                if (!key || protectedKeys.has(key)) return;
                const { r, c } = parseCoordKey(key);
                if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
                if (board[r][c] === null) return;
                if (!cellsToClear.has(key)) cellsToClear.add(key);
                const special = tileSpecial(r, c);
                if (special && !processed.has(key)) {
                    queue.push({ key, targetColor: targetColor !== undefined ? targetColor : null });
                }
            }

            const keys = Array.from(initialCells || []);
            keys.forEach(function (key) {
                const explicitTarget = targetMap && targetMap[key];
                enqueue(key, explicitTarget);
            });

            while (queue.length) {
                const current = queue.shift();
                const { r, c } = parseCoordKey(current.key);
                if (board[r][c] === null) continue;
                const special = tileSpecial(r, c);
                if (!special || processed.has(current.key)) continue;
                processed.add(current.key);
                const effect = { r, c, special, cells: [] };
                effects.push(effect);
                function affect(rr, cc) {
                    const key = coordKey(rr, cc);
                    if (board[rr][cc] !== null && !protectedKeys.has(key)) effect.cells.push({r:rr,c:cc});
                    enqueue(key, null);
                }

                if (special === 'row-clear' || special === 'column-clear') {
                    for (let i = 0; i < BOARD_SIZE; i++) {
                        affect(special === 'row-clear' ? r : i, special === 'row-clear' ? i : c);
                    }
                    continue;
                }

                if (special === 'bomb') {
                    for (let rr = r - 1; rr <= r + 1; rr++) {
                        for (let cc = c - 1; cc <= c + 1; cc++) {
                            if (rr < 0 || rr >= BOARD_SIZE || cc < 0 || cc >= BOARD_SIZE) continue;
                            if (board[rr][cc] !== null) affect(rr, cc);
                        }
                    }
                    continue;
                }

                if (special === 'color-clear') {
                    const target = current.targetColor !== null && current.targetColor !== undefined
                        ? current.targetColor
                        : mostCommonColor();
                    if (target === null || typeof target === 'undefined') continue;
                    for (let rr = 0; rr < BOARD_SIZE; rr++) {
                        for (let cc = 0; cc < BOARD_SIZE; cc++) {
                            if (board[rr][cc] !== null && tileColor(rr, cc) === target) {
                                affect(rr, cc);
                            }
                        }
                    }
                }
            }

            return cellsToClear;
        }

        function resolveSpecialSwap(r1, c1, r2, c2, effects) {
            const special1 = tileSpecial(r1, c1);
            const special2 = tileSpecial(r2, c2);
            if (!special1 && !special2) return null;

            const key1 = coordKey(r1, c1);
            const key2 = coordKey(r2, c2);
            const initial = new Set();
            if (special1) initial.add(key1);
            if (special2) initial.add(key2);
            const targetMap = {};

            if (special1 === 'color-clear' && special2 === 'color-clear') {
                for (let r = 0; r < BOARD_SIZE; r++) {
                    for (let c = 0; c < BOARD_SIZE; c++) {
                        if (board[r][c] !== null) initial.add(coordKey(r, c));
                    }
                }
                effects.push({r:r1,c:c1,special:'all',cells:Array.from(initial, parseCoordKey)});
                return initial;
            }

            if (special1 === 'color-clear') targetMap[key1] = tileColor(r2, c2);
            if (special2 === 'color-clear') targetMap[key2] = tileColor(r1, c1);
            // A colorless bomb requests the ordinary-food majority fallback.
            // All combinations share the queue, including collateral line clears.
            return expandSpecialEffects(initial, targetMap, new Set(), effects);
        }
        function applyGravity() {
            for (let c = 0; c < BOARD_SIZE; c++) {
                let emptyRow = BOARD_SIZE - 1;
                for (let r = BOARD_SIZE - 1; r >= 0; r--) {
                    if (board[r][c] !== null) {
                        board[emptyRow][c] = board[r][c];
                        if (emptyRow !== r) board[r][c] = null;
                        emptyRow--;
                    }
                }
            }
        }

        function fillNewTiles() {
            const newTiles = new Set();
            for (let r = 0; r < BOARD_SIZE; r++) {
                for (let c = 0; c < BOARD_SIZE; c++) {
                    if (board[r][c] === null) {
                        board[r][c] = makeTile(nextColor());
                        newTiles.add(r + ',' + c);
                    }
                }
            }
            return newTiles;
        }
        function getFallMap() {
            const map = {};
            for (let c = 0; c < BOARD_SIZE; c++) {
                let holes = 0;
                for (let r = BOARD_SIZE - 1; r >= 0; r--) {
                    if (board[r][c] === null) {
                        holes++;
                    } else if (holes > 0) {
                        map[(r + holes) + ',' + c] = holes;
                    }
                }
            }
            return map;
        }
        function getBaseClearScore(count) {
            if (count >= 8) return 180;
            if (count === 7) return 140;
            if (count === 6) return 110;
            if (count === 5) return 80;
            if (count === 4) return 50;
            if (count === 3) return 30;
            return 0;
        }

        function getComboMultiplier(combo) {
            if (combo >= 7) return 4;
            if (combo === 6) return 3.5;
            if (combo === 5) return 3;
            if (combo === 4) return 2.5;
            if (combo === 3) return 2;
            if (combo === 2) return 1.5;
            return 1;
        }

        function getComboBonus(combo) {
            if (combo >= 7) return 100;
            if (combo === 6) return 80;
            if (combo === 5) return 60;
            if (combo === 4) return 40;
            if (combo === 3) return 20;
            if (combo === 2) return 10;
            return 0;
        }

        function calcClearScore(matchCount, combo) {
            return Math.round(getBaseClearScore(matchCount) * getComboMultiplier(combo) + getComboBonus(combo));
        }

        function swapTiles(r1, c1, r2, c2) {
            [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
        }
        function isAdjacent(r1, c1, r2, c2) {
            return [r1, c1, r2, c2].every(n => Number.isInteger(n) && n >= 0 && n < BOARD_SIZE) &&
                Math.abs(r1-r2) + Math.abs(c1-c2) === 1 && board[r1][c1] !== null && board[r2][c2] !== null;
        }
        function isLegalSwap(r1, c1, r2, c2) {
            if (!isAdjacent(r1, c1, r2, c2)) return false;
            if (tileSpecial(r1, c1) || tileSpecial(r2, c2)) return true;
            swapTiles(r1, c1, r2, c2);
            const legal = findMatchGroups().some(g => g.cells.some(p =>
                (p.r === r1 && p.c === c1) || (p.r === r2 && p.c === c2)));
            swapTiles(r1, c1, r2, c2);
            return legal;
        }
        function findLegalMove() {
            for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
                for (const [rr, cc] of [[r, c+1], [r+1, c]]) {
                    if (isLegalSwap(r, c, rr, cc)) return { r1: r, c1: c, r2: rr, c2: cc };
                }
            }
            return null;
        }
        function initBoard() {
            board = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(null));
            for (let r = 0; r < BOARD_SIZE; r++) for (let c = 0; c < BOARD_SIZE; c++) {
                const choices = Array.from({length: typeCount}, (_, i) => i).filter(color =>
                    !(c >= 2 && tileColor(r,c-1) === color && tileColor(r,c-2) === color) &&
                    !(r >= 2 && tileColor(r-1,c) === color && tileColor(r-2,c) === color));
                board[r][c] = makeTile(choices[Math.floor(random()*choices.length)]);
            }
            ensurePlayable();
            return board;
        }
        // Finite fallback: rebuild ordinary food with a guaranteed swap motif.
        // Existing special objects survive, without awarding score or moves.
        function rebuildPlayable(specials) {
            board = Array.from({length: BOARD_SIZE}, (_, r) => Array.from({length: BOARD_SIZE}, (_, c) => makeTile((r+c)%typeCount)));
            board[0][0] = makeTile(0); board[0][1] = makeTile(1); board[0][2] = makeTile(0);
            board[1][1] = makeTile(0);
            // Replace tiles only when doing so does not create a starting match.
            for (const tile of specials) {
                let placed = false;
                for (let r = 0; r < BOARD_SIZE && !placed; r++) for (let c = 0; c < BOARD_SIZE && !placed; c++) {
                    if (board[r][c].special) continue;
                    const previous = board[r][c];
                    board[r][c] = tile;
                    if (!findMatchGroups().length) placed = true;
                    else board[r][c] = previous;
                }
                if (!placed) return false;
            }
            return !findMatchGroups().length && !!findLegalMove();
        }
        function shuffle(maxAttempts = 120) {
            const original = board.map(row => row.slice());
            const tiles = board.flat();
            if (tiles.some(t => t === null)) throw new Error('Shuffle requires a full board');
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                for (let i = tiles.length-1; i > 0; i--) {
                    const j = Math.floor(random()*(i+1));
                    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
                }
                board = Array.from({length: BOARD_SIZE}, (_, r) => tiles.slice(r*BOARD_SIZE, (r+1)*BOARD_SIZE));
                if (!findMatchGroups().length && findLegalMove()) return { shuffled: true, rebuilt: false };
            }
            if (rebuildPlayable(tiles.filter(t => t.special))) return { shuffled: true, rebuilt: true };
            board = original;
            // Only malformed/custom boards can reach this case; preserve them for retry.
            return { shuffled: false, failed: true };
        }
        function ensurePlayable() {
            return findLegalMove() ? { shuffled: false } : shuffle();
        }
        function matchWave(preferred = []) {
            const groups = findMatchGroups();
            if (!groups.length) return null;
            const keys = new Set(groups.flatMap(g => g.cells.map(p => coordKey(p.r,p.c))));
            // Longer lines take precedence at intersections.
            const generated = detectSpecialTiles(groups.slice().sort((a,b) => b.cells.length-a.cells.length), preferred);
            const protectedKeys = new Set(generated.map(p => coordKey(p.r,p.c)));
            const effects = [];
            const cells = Array.from(expandSpecialEffects(keys, {}, protectedKeys, effects), parseCoordKey);
            return { cells, generated, effects };
        }
        // Prepare a wave, then the renderer may animate it before clearing.
        function beginSwap(r1,c1,r2,c2) {
            if (!isLegalSwap(r1,c1,r2,c2)) return null;
            swapTiles(r1,c1,r2,c2);
            const effects = [];
            const special = resolveSpecialSwap(r1,c1,r2,c2,effects);
            return special ? { cells: Array.from(special, parseCoordKey), generated: [], effects } : matchWave([{r:r2,c:c2},{r:r1,c:c1}]);
        }
        // Clone for preview: live board, RNG and refill queue stay untouched.
        function previewSwap(r1,c1,r2,c2) {
            const copy = createEngine({size:BOARD_SIZE,typeCount,seed:rngState});
            copy.setBoard(board);
            return copy.beginSwap(r1,c1,r2,c2);
        }
        function clearAndRefill(wave) {
            wave.cells.forEach(({r,c}) => { board[r][c] = null; });
            const fallMap = getFallMap();
            const newCountByCol = Array.from({length: BOARD_SIZE}, (_, c) => board.reduce((n,row) => n + (row[c] === null ? 1 : 0), 0));
            applyGravity();
            const newTiles = fillNewTiles();
            return { fallMap, newTiles, newCountByCol };
        }
        function finishMove(score, moves, goal) {
            const movesLeft = Math.max(0, moves-1);
            return { movesLeft, result: score >= goal ? 'won' : movesLeft === 0 ? 'lost' : null };
        }
        return {
            get board() { return board; }, get rngState() { return rngState; },
            set rngState(value) { rngState = value >>> 0; },
            setBoard, setRefill, initBoard, makeTile, tileColor, tileSpecial,
            findMatchGroups, findLegalMove, isLegalSwap, beginSwap, previewSwap, matchWave,
            clearAndRefill, expandSpecialEffects, shuffle, ensurePlayable,
            calcClearScore, finishMove
        };
    }
    const api = { createEngine };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NightMarketEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
