
export enum Side {
  RED = 'r',
  BLACK = 'b',
}

export enum PieceType {
  KING = 'k',
  ADVISOR = 'a',
  ELEPHANT = 'e',
  HORSE = 'h',
  ROOK = 'r',
  CANNON = 'c',
  PAWN = 'p',
}

export interface Piece {
  type: PieceType;
  side: Side;
}

export interface Position {
  r: number;
  c: number;
}

export interface Move {
  from: Position;
  to: Position;
}

export type BoardState = (Piece | null)[][];

export enum GameStatus {
  PLAYING = 'playing',
  CHECKMATE = 'checkmate',
  STALEMATE = 'stalemate',
  RED_WIN = 'red_win',
  BLACK_WIN = 'black_win',
}

export enum Difficulty {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  EXPERT = 'Expert',
  MASTER = 'Master',
  GRANDMASTER = 'Grandmaster',
}

export enum Language {
  EN = 'en',
  CN = 'zh',
}

export interface MoveRecord {
  side: Side;
  from: Position;
  to: Position;
  captured: boolean;
}
