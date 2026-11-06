export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  color: Color;
  type: PieceType;
}

// 길이 64. 기물이 없으면 null
export type Board = (Piece | null)[];

// (file, rank) → 칸 번호
export function sq(file: number, rank: number): number {
  return rank * 8 + file;
}

export function initialBoard(): Board {
  const board: Board = new Array(64).fill(null);
  const back: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  for (let f = 0; f < 8; f++) {
    board[sq(f, 0)] = { color: 'w', type: back[f] };
    board[sq(f, 1)] = { color: 'w', type: 'p' };
    board[sq(f, 6)] = { color: 'b', type: 'p' };
    board[sq(f, 7)] = { color: 'b', type: back[f] };
  }
  return board;
}
export interface GameState {
  board: Board;
  turn: Color;              // 1. 누구 차례
  castling: {               // 2. 캐슬링 가능 여부
    wK: boolean; wQ: boolean;
    bK: boolean; bQ: boolean;
  };
  enPassant: number | null; // 3. 앙파상 가능한 칸
  halfmoveClock: number;    // 4. 50수 규칙 카운터
}

export function initialGame(): GameState {
  return {
    board: initialBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmoveClock: 0,
  };
}