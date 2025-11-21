
import { BoardState, Move, Piece, PieceType, Position, Side } from '../types';

// Initial Board Setup
export const createInitialBoard = (): BoardState => {
  const board: BoardState = Array(10).fill(null).map(() => Array(9).fill(null));

  const setupRow = (row: number, side: Side) => {
    const types = [
      PieceType.ROOK, PieceType.HORSE, PieceType.ELEPHANT, PieceType.ADVISOR,
      PieceType.KING,
      PieceType.ADVISOR, PieceType.ELEPHANT, PieceType.HORSE, PieceType.ROOK
    ];
    types.forEach((type, col) => {
      board[row][col] = { type, side };
    });
  };

  // Black (Top)
  setupRow(0, Side.BLACK);
  board[2][1] = { type: PieceType.CANNON, side: Side.BLACK };
  board[2][7] = { type: PieceType.CANNON, side: Side.BLACK };
  [0, 2, 4, 6, 8].forEach(col => { board[3][col] = { type: PieceType.PAWN, side: Side.BLACK }; });

  // Red (Bottom)
  setupRow(9, Side.RED);
  board[7][1] = { type: PieceType.CANNON, side: Side.RED };
  board[7][7] = { type: PieceType.CANNON, side: Side.RED };
  [0, 2, 4, 6, 8].forEach(col => { board[6][col] = { type: PieceType.PAWN, side: Side.RED }; });

  return board;
};

export const cloneBoard = (board: BoardState): BoardState => {
  return board.map(row => [...row]);
};

// Basic rule validation (Movement patterns only)
export const isValidMove = (board: BoardState, move: Move, turn: Side): boolean => {
  const { from, to } = move;
  const piece = board[from.r][from.c];

  // Basic checks
  if (!piece) return false;
  if (piece.side !== turn) return false;
  if (from.r === to.r && from.c === to.c) return false;
  if (to.r < 0 || to.r > 9 || to.c < 0 || to.c > 8) return false;

  const target = board[to.r][to.c];
  if (target && target.side === piece.side) return false;

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const absDr = Math.abs(dr);
  const absDc = Math.abs(dc);

  switch (piece.type) {
    case PieceType.KING: // Jiang/Shuai
      if (absDr + absDc !== 1) return false;
      if (to.c < 3 || to.c > 5) return false;
      if (piece.side === Side.RED) {
        if (to.r < 7) return false;
      } else {
        if (to.r > 2) return false;
      }
      return true;

    case PieceType.ADVISOR: // Shi
      if (absDr !== 1 || absDc !== 1) return false;
      if (to.c < 3 || to.c > 5) return false;
      if (piece.side === Side.RED) {
        if (to.r < 7) return false;
      } else {
        if (to.r > 2) return false;
      }
      return true;

    case PieceType.ELEPHANT: // Xiang
      if (absDr !== 2 || absDc !== 2) return false;
      if (board[from.r + dr / 2][from.c + dc / 2]) return false;
      if (piece.side === Side.RED) {
        if (to.r < 5) return false;
      } else {
        if (to.r > 4) return false;
      }
      return true;

    case PieceType.HORSE: // Ma
      if (!((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2))) return false;
      if (absDr === 2) {
        if (board[from.r + (dr > 0 ? 1 : -1)][from.c]) return false;
      } else {
        if (board[from.r][from.c + (dc > 0 ? 1 : -1)]) return false;
      }
      return true;

    case PieceType.ROOK: // Ju
      if (from.r !== to.r && from.c !== to.c) return false;
      if (!isPathClear(board, from, to)) return false;
      return true;

    case PieceType.CANNON: // Pao
      if (from.r !== to.r && from.c !== to.c) return false;
      const piecesBetween = countPiecesBetween(board, from, to);
      if (target) {
        return piecesBetween === 1;
      } else {
        return piecesBetween === 0;
      }

    case PieceType.PAWN: // Bing/Zu
      const forward = piece.side === Side.RED ? -1 : 1;
      if (piece.side === Side.RED && dr > 0) return false;
      if (piece.side === Side.BLACK && dr < 0) return false;
      const crossedRiver = piece.side === Side.RED ? from.r <= 4 : from.r >= 5;
      
      if (crossedRiver) {
        if (absDr + absDc !== 1) return false;
      } else {
        if (dc !== 0) return false;
        if (dr !== forward) return false;
      }
      return true;
  }
};

const isPathClear = (board: BoardState, from: Position, to: Position): boolean => {
  return countPiecesBetween(board, from, to) === 0;
};

const countPiecesBetween = (board: BoardState, from: Position, to: Position): number => {
  let count = 0;
  if (from.r === to.r) {
    const min = Math.min(from.c, to.c);
    const max = Math.max(from.c, to.c);
    for (let c = min + 1; c < max; c++) {
      if (board[from.r][c]) count++;
    }
  } else {
    const min = Math.min(from.r, to.r);
    const max = Math.max(from.r, to.r);
    for (let r = min + 1; r < max; r++) {
      if (board[r][from.c]) count++;
    }
  }
  return count;
};

export const boardToFen = (board: BoardState, turn: Side): string => {
  let fen = "";
  for (let r = 0; r < 10; r++) {
    let emptyCount = 0;
    for (let c = 0; c < 9; c++) {
      const piece = board[r][c];
      if (piece) {
        if (emptyCount > 0) {
          fen += emptyCount.toString();
          emptyCount = 0;
        }
        const char = getPieceChar(piece);
        fen += char;
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) fen += emptyCount.toString();
    if (r < 9) fen += "/";
  }
  fen += ` ${turn === Side.RED ? 'w' : 'b'}`;
  return fen;
};

const getPieceChar = (piece: Piece): string => {
  const map: Record<PieceType, string> = {
    [PieceType.KING]: 'k',
    [PieceType.ADVISOR]: 'a',
    [PieceType.ELEPHANT]: 'e',
    [PieceType.HORSE]: 'h',
    [PieceType.ROOK]: 'r',
    [PieceType.CANNON]: 'c',
    [PieceType.PAWN]: 'p',
  };
  const char = map[piece.type];
  return piece.side === Side.RED ? char.toUpperCase() : char;
};

// --- Check / King Safety Logic ---

export const isKingInCheck = (board: BoardState, side: Side): boolean => {
  // Find King
  let kingPos: Position | null = null;
  for(let r=0; r<10; r++) {
    for(let c=0; c<9; c++) {
      const p = board[r][c];
      if(p && p.type === PieceType.KING && p.side === side) {
        kingPos = {r, c};
        break;
      }
    }
    if(kingPos) break;
  }
  
  if(!kingPos) return true; // King captured (shouldnt happen)

  const enemy = side === Side.RED ? Side.BLACK : Side.RED;

  // 1. Check Flying General (Kings facing)
  // Find other king
  let otherKingPos: Position | null = null;
  for(let r=0; r<10; r++) {
      for(let c=3; c<=5; c++) { // Optimization: King only in palace cols
          const p = board[r][c];
          if(p && p.type === PieceType.KING && p.side === enemy) {
              otherKingPos = {r, c};
              break;
          }
      }
  }
  if (otherKingPos && otherKingPos.c === kingPos.c) {
      if (isPathClear(board, kingPos, otherKingPos)) return true;
  }

  // 2. Check all enemy pieces attacks
  for(let r=0; r<10; r++) {
      for(let c=0; c<9; c++) {
          const p = board[r][c];
          if(p && p.side === enemy) {
              // Check if this piece can attack kingPos
              // We can reuse isValidMove, but we need to temporarily assume it's that piece's turn
              // However, isValidMove checks if destination is friendly. King is enemy, so OK.
              if (isValidMove(board, {from: {r,c}, to: kingPos}, enemy)) {
                  return true;
              }
          }
      }
  }

  return false;
};

export const makeMove = (board: BoardState, move: Move): BoardState => {
  const newBoard = cloneBoard(board);
  newBoard[move.to.r][move.to.c] = newBoard[move.from.r][move.from.c];
  newBoard[move.from.r][move.from.c] = null;
  return newBoard;
};

// Generate only moves that don't leave king in check
export const getLegalMovesForPiece = (board: BoardState, from: Position, side: Side): Position[] => {
  const moves: Position[] = [];
  for(let r=0; r<10; r++) {
    for(let c=0; c<9; c++) {
       const to = {r, c};
       if (isValidMove(board, {from, to}, side)) {
           // Try move
           const nextBoard = makeMove(board, {from, to});
           if (!isKingInCheck(nextBoard, side)) {
               moves.push(to);
           }
       }
    }
  }
  return moves;
};

export const PIECE_VALUES: Record<PieceType, number> = {
    [PieceType.KING]: 10000,
    [PieceType.ROOK]: 900,
    [PieceType.CANNON]: 450,
    [PieceType.HORSE]: 400,
    [PieceType.ELEPHANT]: 200,
    [PieceType.ADVISOR]: 200,
    [PieceType.PAWN]: 100,
};

export const evaluateBoard = (board: BoardState, side: Side): number => {
    // Basic evaluation for UI feedback if needed, though Engine has its own.
    // Keeping simple material count here.
    let score = 0;
    board.forEach(row => row.forEach(p => {
        if(p) {
            const val = PIECE_VALUES[p.type];
            score += p.side === side ? val : -val;
        }
    }));
    return score;
};
