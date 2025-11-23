
import { BoardState, Difficulty, Language, Move, Side, PieceType } from "../types";

// --- 0x88 Board Representation Constants ---
const BOARD_SIZE = 256;

// Piece Encodings
const RED: number = 8;
const BLACK: number = 16;
const COLOR_MASK: number = 24; // 0x18
const TYPE_MASK: number = 7;   // 0x07

const P_KING = 1;
const P_ADVISOR = 2;
const P_ELEPHANT = 3;
const P_HORSE = 4;
const P_ROOK = 5;
const P_CANNON = 6;
const P_PAWN = 7;

// 基础子力价值（用于评估 + MVV-LVA）
const PIECE_VALUE: number[] = [
    0,      // 0 - empty
    10000,  // 1 - King
    220,    // 2 - Advisor
    220,    // 3 - Elephant
    420,    // 4 - Horse
    950,    // 5 - Rook
    450,    // 6 - Cannon
    100     // 7 - Pawn
];

const MAX_PLY = 64;

// Zobrist Keys
let ZOBRIST_TABLE: number[][] = [];
let SIDE_KEY: number = 0;

export const initZobristWorld = () => {
    ZOBRIST_TABLE = Array(256)
        .fill(0)
        .map(() =>
            Array(24)
                .fill(0)
                .map(() => (Math.random() * 0xFFFFFFFF) | 0)
        );
    SIDE_KEY = (Math.random() * 0xFFFFFFFF) | 0;
};
initZobristWorld();

class EngineWorld {
    board: Int8Array;
    turn: number;
    redKingPos: number;
    blackKingPos: number;

    tt: Map<number, { depth: number; score: number; type: number; move?: number }>;
    historyTable: Int32Array; // 以 move(16bit: from<<8|to) 为索引
    killers: number[][];      // killers[ply][2]
    nodes: number;
    stopTime: number;
    abort: boolean;

    // 当前增量 Zobrist 哈希
    currentHash: number;

    constructor() {
        this.board = new Int8Array(BOARD_SIZE);
        this.turn = RED;
        this.redKingPos = 0;
        this.blackKingPos = 0;

        this.tt = new Map();
        this.historyTable = new Int32Array(BOARD_SIZE * BOARD_SIZE);
        this.killers = Array.from({ length: MAX_PLY }, () => [0, 0]);

        this.nodes = 0;
        this.stopTime = 0;
        this.abort = false;

        this.currentHash = 0;
        this.recomputeHash();
    }

    reset() {
        this.tt.clear();
        this.historyTable.fill(0);
        for (let i = 0; i < MAX_PLY; i++) {
            this.killers[i][0] = 0;
            this.killers[i][1] = 0;
        }
        initZobristWorld();
        this.recomputeHash();
    }

    loadBoard(uiBoard: BoardState, turnSide: Side) {
        this.board.fill(0);
        this.turn = turnSide === Side.RED ? RED : BLACK;
        this.redKingPos = 0;
        this.blackKingPos = 0;

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const p = uiBoard[r][c];
                if (p) {
                    const sq = (r << 4) + c;
                    const color = p.side === Side.RED ? RED : BLACK;
                    let type = 0;
                    switch (p.type) {
                        case PieceType.KING:
                            type = P_KING;
                            break;
                        case PieceType.ADVISOR:
                            type = P_ADVISOR;
                            break;
                        case PieceType.ELEPHANT:
                            type = P_ELEPHANT;
                            break;
                        case PieceType.HORSE:
                            type = P_HORSE;
                            break;
                        case PieceType.ROOK:
                            type = P_ROOK;
                            break;
                        case PieceType.CANNON:
                            type = P_CANNON;
                            break;
                        case PieceType.PAWN:
                            type = P_PAWN;
                            break;
                    }
                    const piece = color | type;
                    this.board[sq] = piece;
                    if (type === P_KING) {
                        if (color === RED) this.redKingPos = sq;
                        else this.blackKingPos = sq;
                    }
                }
            }
        }

        this.recomputeHash();
    }

    // 重新计算当前局面的 Zobrist 哈希
    private recomputeHash() {
        let h = 0;
        for (let i = 0; i < BOARD_SIZE; i++) {
            if ((i & 0x0F) < 9 && (i >> 4) < 10) {
                const p = this.board[i];
                if (p !== 0) {
                    h ^= ZOBRIST_TABLE[i][p];
                }
            }
        }
        if (this.turn === BLACK) {
            h ^= SIDE_KEY;
        }
        this.currentHash = h;
    }

    private switchSide() {
        this.turn = this.turn === RED ? BLACK : RED;
        this.currentHash ^= SIDE_KEY;
    }

    getHash(): number {
        return this.currentHash;
    }

    generateMoves(captureOnly: boolean = false): number[] {
        const moves: number[] = [];
        const side = this.turn;
        const enemy = side === RED ? BLACK : RED;

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const from = (r << 4) + c;
                const p = this.board[from];
                if ((p & COLOR_MASK) !== side) continue;

                const type = p & TYPE_MASK;

                switch (type) {
                    case P_KING:
                        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
                            const nr = r + dr,
                                nc = c + dc;
                            if (
                                nc >= 3 &&
                                nc <= 5 &&
                                ((side === RED && nr >= 7) || (side === BLACK && nr <= 2))
                            ) {
                                this.addMove(moves, from, (nr << 4) + nc, captureOnly);
                            }
                        });
                        break;
                    case P_ADVISOR:
                        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
                            const nr = r + dr,
                                nc = c + dc;
                            if (
                                nc >= 3 &&
                                nc <= 5 &&
                                ((side === RED && nr >= 7) || (side === BLACK && nr <= 2))
                            ) {
                                this.addMove(moves, from, (nr << 4) + nc, captureOnly);
                            }
                        });
                        break;
                    case P_ELEPHANT:
                        [[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(([dr, dc]) => {
                            const nr = r + dr,
                                nc = c + dc;
                            if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
                                if (side === RED && nr < 5) return;
                                if (side === BLACK && nr > 4) return;
                                const eyeR = r + dr / 2,
                                    eyeC = c + dc / 2;
                                if (this.board[(eyeR << 4) + eyeC] === 0) {
                                    this.addMove(moves, from, (nr << 4) + nc, captureOnly);
                                }
                            }
                        });
                        break;
                    case P_HORSE:
                        [
                            [-2, -1],
                            [-2, 1],
                            [2, -1],
                            [2, 1],
                            [-1, -2],
                            [-1, 2],
                            [1, -2],
                            [1, 2]
                        ].forEach(([dr, dc]) => {
                            const nr = r + dr,
                                nc = c + dc;
                            if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
                                const legR = r + (Math.abs(dr) === 2 ? dr / 2 : 0);
                                const legC = c + (Math.abs(dc) === 2 ? dc / 2 : 0);
                                if (this.board[(legR << 4) + legC] === 0) {
                                    this.addMove(moves, from, (nr << 4) + nc, captureOnly);
                                }
                            }
                        });
                        break;
                    case P_ROOK:
                        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
                            for (let dist = 1; dist < 10; dist++) {
                                const nr = r + dr * dist,
                                    nc = c + dc * dist;
                                if (nr < 0 || nr > 9 || nc < 0 || nc > 8) break;
                                const to = (nr << 4) + nc;
                                const target = this.board[to];
                                if (target === 0) {
                                    if (!captureOnly) moves.push((from << 8) | to);
                                } else {
                                    if ((target & COLOR_MASK) === enemy)
                                        moves.push((from << 8) | to);
                                    break;
                                }
                            }
                        });
                        break;
                    case P_CANNON:
                        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
                            let jump = false;
                            for (let dist = 1; dist < 10; dist++) {
                                const nr = r + dr * dist,
                                    nc = c + dc * dist;
                                if (nr < 0 || nr > 9 || nc < 0 || nc > 8) break;
                                const to = (nr << 4) + nc;
                                const target = this.board[to];
                                if (!jump) {
                                    if (target === 0) {
                                        if (!captureOnly) moves.push((from << 8) | to);
                                    } else {
                                        jump = true;
                                    }
                                } else {
                                    if (target !== 0) {
                                        if ((target & COLOR_MASK) === enemy)
                                            moves.push((from << 8) | to);
                                        break;
                                    }
                                }
                            }
                        });
                        break;
                    case P_PAWN:
                        const forward = side === RED ? -1 : 1;
                        const crossed = side === RED ? r <= 4 : r >= 5;
                        const fr = r + forward;
                        if (fr >= 0 && fr <= 9)
                            this.addMove(moves, from, (fr << 4) + c, captureOnly);
                        if (crossed) {
                            if (c > 0) this.addMove(moves, from, (r << 4) + (c - 1), captureOnly);
                            if (c < 8) this.addMove(moves, from, (r << 4) + (c + 1), captureOnly);
                        }
                        break;
                }
            }
        }
        return moves;
    }

    addMove(moves: number[], from: number, to: number, captureOnly: boolean) {
        const target = this.board[to];
        if (target === 0) {
            if (!captureOnly) moves.push((from << 8) | to);
        } else if ((target & COLOR_MASK) !== this.turn) {
            moves.push((from << 8) | to);
        }
    }

    makeMove(move: number): { captured: number } {
        const from = move >> 8;
        const to = move & 0xFF;
        const captured = this.board[to];
        const piece = this.board[from];

        // 更新 Zobrist：移除旧位置 & 被吃子
        if (piece) this.currentHash ^= ZOBRIST_TABLE[from][piece];
        if (captured) this.currentHash ^= ZOBRIST_TABLE[to][captured];

        // 移动棋子
        this.board[to] = piece;
        this.board[from] = 0;

        // 更新 Zobrist：加入新位置
        if (piece) this.currentHash ^= ZOBRIST_TABLE[to][piece];

        // 更新将的位置
        if ((piece & TYPE_MASK) === P_KING) {
            if ((piece & COLOR_MASK) === RED) this.redKingPos = to;
            else this.blackKingPos = to;
        }

        // 交换行棋方（同时更新 hash 的 side key）
        this.switchSide();

        return { captured };
    }

    undoMove(move: number, captured: number) {
        const from = move >> 8;
        const to = move & 0xFF;
        const piece = this.board[to];

        // 先还原行棋方
        this.switchSide();

        // 撤销 Zobrist：移除当前 to 的棋子，恢复被吃子和 from 的棋子
        if (piece) this.currentHash ^= ZOBRIST_TABLE[to][piece];
        if (captured) this.currentHash ^= ZOBRIST_TABLE[to][captured];
        if (piece) this.currentHash ^= ZOBRIST_TABLE[from][piece];

        // 撤销盘面
        this.board[from] = piece;
        this.board[to] = captured;

        // 更新将的位置
        if ((piece & TYPE_MASK) === P_KING) {
            if ((piece & COLOR_MASK) === RED) this.redKingPos = from;
            else this.blackKingPos = from;
        }
    }

    isKingInCheck(side: number): boolean {
        const kingPos = side === RED ? this.redKingPos : this.blackKingPos;
        const kingR = kingPos >> 4;
        const kingC = kingPos & 0x0F;
        const enemy = side === RED ? BLACK : RED;

        // 飞将
        const otherKing = side === RED ? this.blackKingPos : this.redKingPos;
        if ((otherKing & 0x0F) === kingC) {
            let blocked = false;
            const minR = Math.min(kingR, otherKing >> 4);
            const maxR = Math.max(kingR, otherKing >> 4);
            for (let r = minR + 1; r < maxR; r++) {
                if (this.board[(r << 4) + kingC] !== 0) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) return true;
        }

        // 车、炮、兵/将 沿直线
        const dirs = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0]
        ];
        for (const [dr, dc] of dirs) {
            let jump = false;
            for (let dist = 1; dist < 10; dist++) {
                const r = kingR + dr * dist;
                const c = kingC + dc * dist;
                if (r < 0 || r > 9 || c < 0 || c > 8) break;
                const p = this.board[(r << 4) + c];
                if (p !== 0) {
                    const type = p & TYPE_MASK;
                    const color = p & COLOR_MASK;
                    if (color === enemy) {
                        if (!jump && (type === P_ROOK || type === P_KING || type === P_PAWN)) {
                            if (type === P_PAWN) {
                                const pDr = r - kingR;
                                if (Math.abs(pDr) + Math.abs(c - kingC) === 1) {
                                    const crossed = enemy === RED ? r <= 4 : r >= 5;
                                    if (!crossed) {
                                        if (enemy === RED && pDr === 1) return true;
                                        if (enemy === BLACK && pDr === -1) return true;
                                    } else {
                                        if (enemy === RED && pDr >= 0) return true;
                                        if (enemy === BLACK && pDr <= 0) return true;
                                    }
                                }
                            } else if (type === P_ROOK) {
                                return true;
                            }
                        } else if (jump && type === P_CANNON) {
                            return true;
                        }
                    }
                    if (!jump) jump = true;
                    else break;
                }
            }
        }

        // 马腿将军
        const horseLegs = [
            [-2, -1],
            [-2, 1],
            [2, -1],
            [2, 1],
            [-1, -2],
            [-1, 2],
            [1, -2],
            [1, 2]
        ];
        for (const [dr, dc] of horseLegs) {
            const r = kingR + dr,
                c = kingC + dc;
            if (r >= 0 && r <= 9 && c >= 0 && c <= 8) {
                const p = this.board[(r << 4) + c];
                if (p !== 0 && (p & COLOR_MASK) === enemy && (p & TYPE_MASK) === P_HORSE) {
                    const moveDr = -dr;
                    const moveDc = -dc;
                    const legR = Math.abs(moveDr) === 2 ? (r + kingR) / 2 : r;
                    const legC = Math.abs(moveDc) === 2 ? (c + kingC) / 2 : c;
                    if (this.board[(legR << 4) + legC] === 0) return true;
                }
            }
        }

        return false;
    }

    private mvvLva(victim: number, attacker: number): number {
        const victimType = victim & TYPE_MASK;
        const attackerType = attacker & TYPE_MASK;
        return (PIECE_VALUE[victimType] << 4) - PIECE_VALUE[attackerType];
    }

    private orderMoves(
        moves: number[],
        ttEntry: { depth: number; score: number; type: number; move?: number } | undefined,
        ply: number
    ) {
        const plyIdx = ply < MAX_PLY ? ply : MAX_PLY - 1;
        const scores = new Int32Array(moves.length);

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            let score = 0;

            if (ttEntry && ttEntry.move === move) {
                score += 1_000_000; // 置换表着法优先
            }

            const from = move >> 8;
            const to = move & 0xff;
            const captured = this.board[to];

            if (captured !== 0) {
                const attacker = this.board[from];
                score += 500_000 + this.mvvLva(captured, attacker); // 吃子着
            } else {
                const killers = this.killers[plyIdx];
                if (killers[0] === move) {
                    score += 400_000;
                } else if (killers[1] === move) {
                    score += 300_000;
                }
                score += this.historyTable[move]; // 历史启发
            }

            scores[i] = score;
        }

        // 简单选择排序（避免 JS sort 额外开销）
        for (let i = 0; i < moves.length - 1; i++) {
            let best = i;
            for (let j = i + 1; j < moves.length; j++) {
                if (scores[j] > scores[best]) {
                    best = j;
                }
            }
            if (best !== i) {
                const tmpMove = moves[i];
                moves[i] = moves[best];
                moves[best] = tmpMove;

                const tmpScore = scores[i];
                scores[i] = scores[best];
                scores[best] = tmpScore;
            }
        }
    }

    evaluate(): number {
        let score = 0;

        for (let i = 0; i < BOARD_SIZE; i++) {
            if ((i & 0x0F) < 9 && (i >> 4) < 10) {
                const p = this.board[i];
                if (p !== 0) {
                    const type = p & TYPE_MASK;
                    const color = p & COLOR_MASK;
                    const isRed = color === RED;

                    let val = PIECE_VALUE[type];
                    const r = i >> 4;
                    const c = i & 0x0F;

                    if (type === P_PAWN) {
                        const crossed = isRed ? r <= 4 : r >= 5;
                        const advance = isRed ? 9 - r : r; // 越往前价值越高
                        val += advance * 2;
                        if (crossed) {
                            val += 30;
                            if (c >= 3 && c <= 5) val += 20;
                        }
                    } else if (type === P_HORSE) {
                        if (c === 4) val += 15;
                        if (crossedRiver(r, isRed)) val += 30;
                    } else if (type === P_CANNON) {
                        if (c === 4) val += 25;
                        if (crossedRiver(r, isRed)) val += 15;
                    } else if (type === P_ROOK) {
                        if (crossedRiver(r, isRed)) val += 20;
                        if (c >= 3 && c <= 5) val += 10;
                    } else if (type === P_KING) {
                        if ((isRed && r >= 8) || (!isRed && r <= 1)) {
                            val += 10; // 稍微奖励王在九宫内
                        } else {
                            val -= 20; // 王乱跑扣分
                        }
                    }

                    score += isRed ? val : -val;
                }
            }
        }

        // 轻微随机打分（基于 hash），避免完全对称时总是同一着法
        score += (this.getHash() & 0x1F) - 16;

        return this.turn === RED ? score : -score;
    }

    search(depth: number, alpha: number, beta: number, ply: number, isNull: boolean): number {
        this.nodes++;
        if ((this.nodes & 2047) === 0) {
            if (Date.now() > this.stopTime) this.abort = true;
        }
        if (this.abort) return alpha;

        const inCheck = this.isKingInCheck(this.turn);

        const hash = this.getHash();
        const ttEntry = this.tt.get(hash);
        if (ttEntry && ttEntry.depth >= depth && !inCheck) {
            if (ttEntry.type === 0) return ttEntry.score;
            if (ttEntry.type === 1 && ttEntry.score >= beta) return ttEntry.score;
            if (ttEntry.type === 2 && ttEntry.score <= alpha) return ttEntry.score;
        }

        // 检查延伸：在被将军时延伸一层
        if (depth <= 0) {
            if (!inCheck) return this.quiescence(alpha, beta);
            depth = 1;
        }

        // Null Move Pruning
        if (!isNull && !inCheck && depth >= 3) {
            const R = 2;
            this.switchSide();
            const val = -this.search(depth - 1 - R, -beta, -beta + 1, ply + 1, true);
            this.switchSide();
            if (this.abort) return alpha;
            if (val >= beta) {
                return beta;
            }
        }

        const moves = this.generateMoves();
        this.orderMoves(moves, ttEntry, ply);

        let legalMoves = 0;
        let bestScore = -Infinity;
        let bestMove = 0;
        let ttType = 2; // 0 exact, 1 lower, 2 upper

        const originalAlpha = alpha;

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const capture = this.makeMove(move);

            // 自己王不能被将军
            if (this.isKingInCheck(this.turn === RED ? BLACK : RED)) {
                this.undoMove(move, capture.captured);
                continue;
            }
            legalMoves++;

            let score: number;

            // PVS
            if (i === 0) {
                score = -this.search(depth - 1, -beta, -alpha, ply + 1, false);
            } else {
                let reduction = 0;
                if (depth >= 3 && legalMoves > 4 && capture.captured === 0 && !inCheck) {
                    reduction = 1; // LMR
                }

                score = -this.search(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, false);

                if (score > alpha && reduction > 0) {
                    // LMR 失败，重搜
                    score = -this.search(depth - 1, -alpha - 1, -alpha, ply + 1, false);
                }

                if (score > alpha && score < beta) {
                    score = -this.search(depth - 1, -beta, -alpha, ply + 1, false);
                }
            }

            this.undoMove(move, capture.captured);

            if (this.abort) return alpha;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }

            if (score > alpha) {
                alpha = score;
                ttType = 0; // exact
            }

            if (alpha >= beta) {
                ttType = 1; // lower bound
                // 更新 Killer & 历史启发表（安静着）
                if (capture.captured === 0) {
                    const plyIdx = ply < MAX_PLY ? ply : MAX_PLY - 1;
                    const killers = this.killers[plyIdx];
                    if (killers[0] !== move) {
                        killers[1] = killers[0];
                        killers[0] = move;
                    }
                    this.historyTable[move] += depth * depth;
                }
                break;
            }
        }

        if (legalMoves === 0) {
            return inCheck ? -20000 + ply : 0;
        }

        if (bestMove !== 0) {
            const storedType = bestScore <= originalAlpha ? 2 : ttType;
            this.tt.set(hash, { depth, score: bestScore, type: storedType, move: bestMove });
        }

        return bestScore;
    }

    quiescence(alpha: number, beta: number): number {
        this.nodes++;
        if ((this.nodes & 2047) === 0) {
            if (Date.now() > this.stopTime) this.abort = true;
        }
        if (this.abort) return alpha;

        const standPat = this.evaluate();
        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;

        const moves = this.generateMoves(true);
        moves.sort((a, b) => {
            const vA =
                (this.board[a & 0xFF] & TYPE_MASK) - (this.board[a >> 8] & TYPE_MASK);
            const vB =
                (this.board[b & 0xFF] & TYPE_MASK) - (this.board[b >> 8] & TYPE_MASK);
            return vB - vA;
        });

        for (const move of moves) {
            const capture = this.makeMove(move);
            if (this.isKingInCheck(this.turn === RED ? BLACK : RED)) {
                this.undoMove(move, capture.captured);
                continue;
            }
            const score = -this.quiescence(-beta, -alpha);
            this.undoMove(move, capture.captured);

            if (this.abort) return alpha;

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    }
}

const crossedRiver = (r: number, isRed: boolean) => (isRed ? r <= 4 : r >= 5);

const worldEngine = new EngineWorld();

export const resetEngineWorld = () => {
    worldEngine.reset();
};

export const getBestMoveWorld = async (
    board: BoardState,
    turn: Side,
    difficulty: Difficulty,
    lang: Language
): Promise<{ move: Move; reasoning: string; score: number } | null> => {
    worldEngine.loadBoard(board, turn);
    worldEngine.abort = false;
    worldEngine.nodes = 0;

    let timeLimit = 1500;
    let maxDepth = 6;

    switch (difficulty) {
        case Difficulty.BEGINNER:
            maxDepth = 3;
            timeLimit = 800;
            break;
        case Difficulty.INTERMEDIATE:
            maxDepth = 5;
            timeLimit = 1500;
            break;
        case Difficulty.EXPERT:
            maxDepth = 7;
            timeLimit = 2500;
            break;
        case Difficulty.MASTER:
            maxDepth = 10;
            timeLimit = 4000;
            break;
        case Difficulty.GRANDMASTER:
            maxDepth = 24;
            timeLimit = 6000;
            break;
    }

    worldEngine.stopTime = Date.now() + timeLimit;

    let bestMoveVal = 0;
    let bestScore = 0;
    let searchedDepth = 0;

    // Iterative Deepening with Aspiration Windows
    let alpha = -30000;
    let beta = 30000;

    for (let d = 1; d <= maxDepth; d++) {
        let score = worldEngine.search(d, alpha, beta, 0, false);

        // Aspiration Window Logic
        if (score <= alpha || score >= beta) {
            alpha = -30000;
            beta = 30000;
            score = worldEngine.search(d, alpha, beta, 0, false);
        } else {
            alpha = score - 50;
            beta = score + 50;
        }

        if (worldEngine.abort) break;

        const hash = worldEngine.getHash();
        const entry = worldEngine.tt.get(hash);
        if (entry && entry.move) {
            bestMoveVal = entry.move;
            bestScore = score;
            searchedDepth = d;
        }

        if (Math.abs(score) > 15000) break; // 发现杀棋，提前退出
    }

    if (bestMoveVal === 0) {
        const moves = worldEngine.generateMoves();
        if (moves.length > 0) {
            bestMoveVal = moves[Math.floor(Math.random() * moves.length)];
        } else return null;
    }

    const fromIdx = bestMoveVal >> 8;
    const toIdx = bestMoveVal & 0xFF;
    const finalMove: Move = {
        from: { r: fromIdx >> 4, c: fromIdx & 0x0F },
        to: { r: toIdx >> 4, c: toIdx & 0x0F }
    };

    const scoreText = bestScore > 0 ? `+${bestScore}` : `${bestScore}`;
    const nodesK = (worldEngine.nodes / 1000).toFixed(1) + "k";
    const depthText = searchedDepth || maxDepth;
    const reasoning =
        lang === Language.CN
            ? `[World] 深度 ${depthText} | 节点 ${nodesK} | 评分 ${scoreText} | 策略: 迭代加深 + Aspiration + 历史/Killer 启发`
            : `[World] Depth ${depthText} | Nodes ${nodesK} | Eval ${scoreText} | Strategy: ID + Aspiration + History/Killer Heuristics`;

    return {
        move: finalMove,
        reasoning,
        score: bestScore
    };
};
