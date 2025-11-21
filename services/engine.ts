
import { BoardState, Difficulty, Language, Move, Side, PieceType, Position } from "../types";
import { boardToFen } from "../utils/gameLogic";

// --- 0x88 Board Representation Constants ---
// Board is 16x16 (256 length array). Valid squares are: row 0-9, col 0-8.
// 0x88 test: square & 0x88 == 0 implies on board.
// Actually for 10 rows (0-9), 9 * 16 = 144. So 0x88 works for columns (0-7) but we have 9 cols (0-8).
// Standard 0x88 is for 8x8.
// For Xiangqi (9x10), we use a slightly larger mailbox or custom stride.
// Let's use Stride = 16.
// Valid: (sq & 0x0F) < 9 && (sq >> 4) < 10.

const BOARD_SIZE = 256;
const ROW_STRIDE = 16;

// Piece Encodings
// Color: Red = 8 (0x08), Black = 16 (0x10)
// Type: K=1, A=2, E=3, H=4, R=5, C=6, P=7
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

// Zobrist Keys
let ZOBRIST_TABLE: number[][] = []; // [square][piece_color_type]
let SIDE_KEY: number = 0;

const initZobrist = () => {
    ZOBRIST_TABLE = Array(256).fill(0).map(() => 
        Array(24).fill(0).map(() => (Math.random() * 0xFFFFFFFF) | 0)
    );
    SIDE_KEY = (Math.random() * 0xFFFFFFFF) | 0;
};
initZobrist();

// --- Engine State Class ---
class Engine {
    board: Int8Array;
    turn: number; // RED or BLACK
    redKingPos: number;
    blackKingPos: number;
    
    // Transposition Table
    // Map<hash, {depth, score, type, bestMove}>
    // type: 0=Exact, 1=LowerBound(Alpha), 2=UpperBound(Beta)
    tt: Map<number, {depth: number, score: number, type: number, move?: number}>;
    
    historyTable: Int32Array; // History Heuristic
    nodes: number;
    stopTime: number;
    abort: boolean;

    constructor() {
        this.board = new Int8Array(BOARD_SIZE);
        this.tt = new Map();
        this.historyTable = new Int32Array(BOARD_SIZE * BOARD_SIZE); // Simply from->to index
        this.nodes = 0;
        this.turn = RED;
        this.redKingPos = 0;
        this.blackKingPos = 0;
        this.stopTime = 0;
        this.abort = false;
    }

    // Import BoardState from UI
    loadBoard(uiBoard: BoardState, turnSide: Side) {
        this.board.fill(0);
        this.turn = turnSide === Side.RED ? RED : BLACK;
        
        for(let r=0; r<10; r++) {
            for(let c=0; c<9; c++) {
                const p = uiBoard[r][c];
                if (p) {
                    const sq = (r << 4) + c;
                    const color = p.side === Side.RED ? RED : BLACK;
                    let type = 0;
                    switch(p.type) {
                        case PieceType.KING: type = P_KING; break;
                        case PieceType.ADVISOR: type = P_ADVISOR; break;
                        case PieceType.ELEPHANT: type = P_ELEPHANT; break;
                        case PieceType.HORSE: type = P_HORSE; break;
                        case PieceType.ROOK: type = P_ROOK; break;
                        case PieceType.CANNON: type = P_CANNON; break;
                        case PieceType.PAWN: type = P_PAWN; break;
                    }
                    this.board[sq] = color | type;
                    if (type === P_KING) {
                        if (color === RED) this.redKingPos = sq;
                        else this.blackKingPos = sq;
                    }
                }
            }
        }
    }

    // Generate Zobrist Hash for current board
    getHash(): number {
        let h = 0;
        if (this.turn === BLACK) h ^= SIDE_KEY;
        for (let i = 0; i < BOARD_SIZE; i++) {
            if ((i & 0x0F) < 9 && (i >> 4) < 10) { // Valid square
                 const p = this.board[i];
                 if (p !== 0) {
                     h ^= ZOBRIST_TABLE[i][p];
                 }
            }
        }
        return h;
    }
    
    // --- Move Generation ---
    // Returns array of moves (packed integers: from << 8 | to)
    generateMoves(captureOnly: boolean = false): number[] {
        const moves: number[] = [];
        const side = this.turn;
        const enemy = side === RED ? BLACK : RED;
        
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const from = (r << 4) + c;
                const p = this.board[from];
                if (((p as number) & COLOR_MASK) !== side) continue;
                
                const type = p & TYPE_MASK;
                
                // Piece specific logic
                switch (type) {
                    case P_KING:
                        // Orthogonal 1 step, within palace
                        [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
                            const nr = r + dr, nc = c + dc;
                            if (nc >= 3 && nc <= 5 && ((side === RED && nr >= 7) || (side === BLACK && nr <= 2))) {
                                this.addMove(moves, from, (nr<<4)+nc, captureOnly);
                            }
                        });
                        break;
                    case P_ADVISOR:
                        // Diagonal 1 step, within palace
                        [[1,1], [1,-1], [-1,1], [-1,-1]].forEach(([dr, dc]) => {
                            const nr = r + dr, nc = c + dc;
                            if (nc >= 3 && nc <= 5 && ((side === RED && nr >= 7) || (side === BLACK && nr <= 2))) {
                                this.addMove(moves, from, (nr<<4)+nc, captureOnly);
                            }
                        });
                        break;
                    case P_ELEPHANT:
                        // Diagonal 2 steps, no river crossing, no blocking eye
                        [[2,2], [2,-2], [-2,2], [-2,-2]].forEach(([dr, dc]) => {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
                                // River check
                                if (side === RED && nr < 5) return;
                                if (side === BLACK && nr > 4) return;
                                // Eye check
                                const eyeR = r + dr/2, eyeC = c + dc/2;
                                if (this.board[(eyeR<<4)+eyeC] === 0) {
                                    this.addMove(moves, from, (nr<<4)+nc, captureOnly);
                                }
                            }
                        });
                        break;
                    case P_HORSE:
                        // Sun/L shape
                        [[-2,-1], [-2,1], [2,-1], [2,1], [-1,-2], [-1,2], [1,-2], [1,2]].forEach(([dr, dc]) => {
                            const nr = r + dr, nc = c + dc;
                            if (nr >= 0 && nr <= 9 && nc >= 0 && nc <= 8) {
                                // Leg check
                                const legR = r + (Math.abs(dr)===2 ? dr/2 : 0);
                                const legC = c + (Math.abs(dc)===2 ? dc/2 : 0);
                                if (this.board[(legR<<4)+legC] === 0) {
                                    this.addMove(moves, from, (nr<<4)+nc, captureOnly);
                                }
                            }
                        });
                        break;
                    case P_ROOK:
                        [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
                            for(let dist=1; dist<10; dist++) {
                                const nr = r + dr*dist, nc = c + dc*dist;
                                if (nr < 0 || nr > 9 || nc < 0 || nc > 8) break;
                                const to = (nr<<4)+nc;
                                const target = this.board[to];
                                if (target === 0) {
                                    if (!captureOnly) moves.push((from << 8) | to);
                                } else {
                                    if ((target & COLOR_MASK) === enemy) moves.push((from << 8) | to);
                                    break;
                                }
                            }
                        });
                        break;
                    case P_CANNON:
                         [[0,1], [0,-1], [1,0], [-1,0]].forEach(([dr, dc]) => {
                            let jump = false;
                            for(let dist=1; dist<10; dist++) {
                                const nr = r + dr*dist, nc = c + dc*dist;
                                if (nr < 0 || nr > 9 || nc < 0 || nc > 8) break;
                                const to = (nr<<4)+nc;
                                const target = this.board[to];
                                if (!jump) {
                                    if (target === 0) {
                                        if (!captureOnly) moves.push((from << 8) | to);
                                    } else {
                                        jump = true;
                                    }
                                } else {
                                    if (target !== 0) {
                                        if ((target & COLOR_MASK) === enemy) moves.push((from << 8) | to);
                                        break;
                                    }
                                }
                            }
                        });
                        break;
                    case P_PAWN:
                        const forward = side === RED ? -1 : 1;
                        const crossed = side === RED ? r <= 4 : r >= 5;
                        // Forward
                        const fr = r + forward;
                        if (fr >= 0 && fr <= 9) this.addMove(moves, from, (fr<<4)+c, captureOnly);
                        // Horizontal if crossed
                        if (crossed) {
                            if (c > 0) this.addMove(moves, from, (r<<4)+(c-1), captureOnly);
                            if (c < 8) this.addMove(moves, from, (r<<4)+(c+1), captureOnly);
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

        this.board[to] = piece;
        this.board[from] = 0;
        
        if ((piece & TYPE_MASK) === P_KING) {
            if ((piece & COLOR_MASK) === RED) this.redKingPos = to;
            else this.blackKingPos = to;
        }

        this.turn = this.turn === RED ? BLACK : RED;
        return { captured };
    }

    undoMove(move: number, captured: number) {
        const from = move >> 8;
        const to = move & 0xFF;
        const piece = this.board[to];

        this.board[from] = piece;
        this.board[to] = captured;

        if ((piece & TYPE_MASK) === P_KING) {
            if ((piece & COLOR_MASK) === RED) this.redKingPos = from;
            else this.blackKingPos = from;
        }

        this.turn = this.turn === RED ? BLACK : RED;
    }

    isKingInCheck(side: number): boolean {
        const kingPos = side === RED ? this.redKingPos : this.blackKingPos;
        const kingR = kingPos >> 4;
        const kingC = kingPos & 0x0F;
        const enemy = side === RED ? BLACK : RED;

        // 1. Check for Flying General
        const otherKing = side === RED ? this.blackKingPos : this.redKingPos;
        if ((otherKing & 0x0F) === kingC) {
            let blocked = false;
            const minR = Math.min(kingR, otherKing >> 4);
            const maxR = Math.max(kingR, otherKing >> 4);
            for(let r = minR + 1; r < maxR; r++) {
                if (this.board[(r<<4)+kingC] !== 0) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) return true;
        }

        // 2. Check normal attacks
        // Simulate by seeing if any enemy piece can attack kingPos
        // Optimized reverse check:
        // Can a Knight jump to King? Can a Rook slide to King?
        
        // Check Rook/Cannon lines
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
        for(const [dr, dc] of dirs) {
            let jump = false;
            for(let dist=1; dist<10; dist++) {
                const r = kingR + dr*dist;
                const c = kingC + dc*dist;
                if(r<0||r>9||c<0||c>8) break;
                const p = this.board[(r<<4)+c];
                if (p !== 0) {
                    const type = p & TYPE_MASK;
                    const color = p & COLOR_MASK;
                    if (color === enemy) {
                        if (!jump && (type === P_ROOK || type === P_KING || type === P_PAWN)) {
                             // Pawn check: only if 1 step forward/side
                             if (type === P_PAWN) {
                                 const forward = enemy === RED ? -1 : 1;
                                 const pDr = r - kingR;
                                 const pDc = c - kingC;
                                 // Enemy Red Pawn at r,c attacking Black King at kingR,kingC?
                                 // Enemy Red Pawn attacks 'forward' (decreases row index) or side
                                 // wait, 'forward' for Red is row--, so r should be > kingR
                                 // The distance is already calculated.
                                 if (Math.abs(pDr) + Math.abs(pDc) === 1) {
                                     // Must be valid pawn move
                                     const crossed = enemy === RED ? r <= 4 : r >= 5;
                                     if (!crossed) {
                                         // Must be forward only
                                         if (enemy === RED && pDr === 1 && pDc === 0) return true;
                                         if (enemy === BLACK && pDr === -1 && pDc === 0) return true;
                                     } else {
                                         // Forward or Side
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
                    else break; // Second piece blocks cannon
                }
            }
        }
        
        // Check Horse
        const horseLegs = [[-2,-1], [-2,1], [2,-1], [2,1], [-1,-2], [-1,2], [1,-2], [1,2]];
        for(const [dr, dc] of horseLegs) {
             const r = kingR + dr, c = kingC + dc;
             if(r>=0 && r<=9 && c>=0 && c<=8) {
                 const p = this.board[(r<<4)+c];
                 if (p !== 0 && (p & COLOR_MASK) === enemy && (p & TYPE_MASK) === P_HORSE) {
                     // Check leg blocking
                     const legR = kingR + (Math.abs(dr)===2 ? dr/2 : 0); // Reverse logic from horse to king? No, check from king to horse is symmetric leg.
                     // Actually, if Horse is at (r,c) attacking King at (kr, kc), 
                     // the leg is at (r - sign(dr)/2 ...). 
                     // Easier: Check if Horse at (r,c) is blocked from hitting (kr, kc).
                     // Horse move logic: from (r,c) to (kr,kc). Leg is at r + (kr-r)/2? No.
                     // Leg is standard.
                     const lR = r + (Math.abs(kingR-r)===2 ? (kingR-r)/2 : 0);
                     const lC = c + (Math.abs(kingC-c)===2 ? (kingC-c)/2 : 0);
                     if (this.board[(lR<<4)+lC] === 0) return true;
                 }
             }
        }
        
        return false;
    }

    evaluate(): number {
        // Simply Material + PST
        let score = 0;
        // Material weights
        const M = [0, 10000, 200, 200, 450, 900, 450, 100]; // K, A, E, H, R, C, P
        
        for(let i=0; i<BOARD_SIZE; i++) {
            if ((i&0x0F)<9 && (i>>4)<10) {
                const p = this.board[i];
                if (p !== 0) {
                    const type = p & TYPE_MASK;
                    const color = p & COLOR_MASK;
                    
                    let val = M[type];
                    // PST simplified bonuses
                    const r = i >> 4;
                    const c = i & 0x0F;
                    const isRed = color === RED;
                    // Flip row for Black to look up from Red perspective if PST is symmetric
                    // But here we just apply logical bonuses code-wise for speed
                    
                    if (type === P_PAWN) {
                        const crossed = isRed ? r <= 4 : r >= 5;
                        if (crossed) {
                            val += 20; // Over river
                            if ((isRed && r <= 1) || (!isRed && r >= 8)) val -= 10; // Too deep
                        } else {
                            // Home pawn weak except center?
                            if (c === 4) val += 10; 
                        }
                    } else if (type === P_HORSE) {
                        if (c === 4) val += 10; // Central horse
                        if (crossedRiver(r, isRed)) val += 20;
                    } else if (type === P_CANNON) {
                        // Central cannon good
                        if (c === 4) val += 20;
                    }

                    score += isRed ? val : -val;
                }
            }
        }
        
        // Mobility (Count legal moves for flexibility) - simplified
        // Doing full move gen for eval is slow. 
        // Maybe just penalty for trapped pieces.

        return this.turn === RED ? score : -score;
    }

    // --- Alpha Beta Search with Extensions ---
    search(depth: number, alpha: number, beta: number, ply: number, isNull: boolean): number {
        this.nodes++;
        if ((this.nodes & 2047) === 0) {
            if (Date.now() > this.stopTime) this.abort = true;
        }
        if (this.abort) return alpha;

        const isCheck = this.isKingInCheck(this.turn);

        // Checkmate/Stalemate detection logic happens if no moves found below.

        // Transposition Table Lookup
        // Simple key generation (should be Zobrist)
        // For now using basic depth check. 
        // Implementing simple hash map key.
        const hash = this.getHash();
        const ttEntry = this.tt.get(hash);
        if (ttEntry && ttEntry.depth >= depth && !isCheck) { // Don't cut on check
            if (ttEntry.type === 0) return ttEntry.score; // Exact
            if (ttEntry.type === 1 && ttEntry.score >= beta) return ttEntry.score; // Lower bound >= beta -> beta cut
            if (ttEntry.type === 2 && ttEntry.score <= alpha) return ttEntry.score; // Upper bound <= alpha -> alpha cut
        }

        if (depth <= 0) {
            return this.quiescence(alpha, beta);
        }

        // Null Move Pruning
        // If not in check, and depth is high enough, skip a turn and see if beta cut
        if (!isNull && !isCheck && depth >= 3) {
            this.turn = this.turn === RED ? BLACK : RED;
            const val = -this.search(depth - 1 - 2, -beta, -beta + 1, ply + 1, true);
            this.turn = this.turn === RED ? BLACK : RED;
            if (this.abort) return alpha;
            if (val >= beta) return beta;
        }

        let moves = this.generateMoves();
        // Move Ordering: TT Move -> Captures -> History
        moves.sort((a, b) => {
            if (ttEntry && ttEntry.move === a) return -1;
            if (ttEntry && ttEntry.move === b) return 1;
            
            // Capture heuristic
            const capA = this.board[a & 0xFF] !== 0 ? 1000 : 0;
            const capB = this.board[b & 0xFF] !== 0 ? 1000 : 0;
            
            // MVV-LVA could be added here
            
            // History
            const histA = this.historyTable[((a>>8)<<8) + (a&0xFF)] || 0;
            const histB = this.historyTable[((b>>8)<<8) + (b&0xFF)] || 0;
            
            return (capB + histB) - (capA + histA);
        });

        let legalMoves = 0;
        let bestScore = -Infinity;
        let bestMove = 0;
        let ttType = 2; // Alpha (Upper Bound) default

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const capture = this.makeMove(move);
            
            // Verify legality (King safety)
            if (this.isKingInCheck(this.turn === RED ? BLACK : RED)) { // We just swapped turn, check IF 'previous' side is in check
                 this.undoMove(move, capture.captured);
                 continue;
            }
            legalMoves++;

            // PVS (Principal Variation Search)
            let score;
            if (i === 0) {
                score = -this.search(depth - 1, -beta, -alpha, ply + 1, false);
            } else {
                // Late Move Reduction (LMR)
                // if (i > 4 && depth > 2 && !capture.captured && !isCheck) ...
                
                // Null Window Search
                score = -this.search(depth - 1, -alpha - 1, -alpha, ply + 1, false);
                if (score > alpha && score < beta) {
                    score = -this.search(depth - 1, -beta, -alpha, ply + 1, false); // Re-search
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
                ttType = 0; // Exact
            }
            
            if (alpha >= beta) {
                // Killer/History update
                if (capture.captured === 0) {
                    const idx = ((move>>8)<<8) + (move&0xFF); // Simple map key based on from/to? No, Array index.
                    // But from/to can be large.
                    // use smaller history table or map.
                    // current history table size 65536 (256*256).
                    // from<<8 | to is max 65535.
                    // idx is move itself if packed as short.
                    this.historyTable[move] = (this.historyTable[move] || 0) + depth * depth;
                }
                ttType = 1; // Lower Bound (Beta cut)
                break;
            }
        }

        if (legalMoves === 0) {
            return isCheck ? -20000 + ply : 0; // Mate vs Stalemate
        }

        // Store in TT
        this.tt.set(hash, { depth, score: bestScore, type: ttType, move: bestMove });
        
        return bestScore;
    }

    quiescence(alpha: number, beta: number): number {
        this.nodes++;
        const standPat = this.evaluate();
        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;

        const moves = this.generateMoves(true); // Captures only
        // Sort captures by MVV-LVA
        moves.sort((a, b) => {
             const vA = (this.board[a&0xFF] & TYPE_MASK) - (this.board[a>>8] & TYPE_MASK);
             const vB = (this.board[b&0xFF] & TYPE_MASK) - (this.board[b>>8] & TYPE_MASK);
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

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    }
}

// Helper for crossed river
const crossedRiver = (r: number, isRed: boolean) => isRed ? r <= 4 : r >= 5;

// --- Entry Point ---

const globalEngine = new Engine();

export const getBestMove = async (
  board: BoardState,
  turn: Side,
  difficulty: Difficulty,
  lang: Language
): Promise<{ move: Move; reasoning: string } | null> => {
    
    globalEngine.loadBoard(board, turn);
    globalEngine.abort = false;
    globalEngine.nodes = 0;
    
    let timeLimit = 1000;
    let maxDepth = 4;
    
    switch(difficulty) {
        case Difficulty.BEGINNER: maxDepth = 2; timeLimit = 500; break;
        case Difficulty.INTERMEDIATE: maxDepth = 4; timeLimit = 1000; break;
        case Difficulty.EXPERT: maxDepth = 6; timeLimit = 2000; break;
        case Difficulty.MASTER: maxDepth = 8; timeLimit = 3000; break;
        case Difficulty.GRANDMASTER: maxDepth = 20; timeLimit = 3000; break;
    }
    
    globalEngine.stopTime = Date.now() + timeLimit;
    
    let bestMoveVal = 0;
    let bestScore = 0;
    
    // Iterative Deepening
    for (let d = 1; d <= maxDepth; d++) {
        const score = globalEngine.search(d, -30000, 30000, 0, false);
        if (globalEngine.abort) break;
        
        // Retrieve best move from TT for root
        const hash = globalEngine.getHash();
        const entry = globalEngine.tt.get(hash);
        if (entry && entry.move) {
            bestMoveVal = entry.move;
            bestScore = score;
        }
        
        // Early exit on mate
        if (Math.abs(score) > 15000) break;
    }
    
    if (bestMoveVal === 0) {
        // Fallback
        const moves = globalEngine.generateMoves();
        if (moves.length > 0) bestMoveVal = moves[0];
        else return null; // Mate
    }
    
    // Convert internal move back to UI Move
    const fromIdx = bestMoveVal >> 8;
    const toIdx = bestMoveVal & 0xFF;
    const finalMove: Move = {
        from: { r: fromIdx >> 4, c: fromIdx & 0x0F },
        to: { r: toIdx >> 4, c: toIdx & 0x0F }
    };
    
    // Generate text
    const scoreText = bestScore > 0 ? `+${bestScore}` : `${bestScore}`;
    const nodesK = (globalEngine.nodes / 1000).toFixed(1) + 'k';
    const reasoning = lang === Language.CN 
        ? `深度 ${maxDepth} | 节点 ${nodesK} | 评分 ${scoreText} | 策略: 控制中枢`
        : `Depth ${maxDepth} | Nodes ${nodesK} | Eval ${scoreText} | Strategy: Control Center`;

    return {
        move: finalMove,
        reasoning: reasoning
    };
};
