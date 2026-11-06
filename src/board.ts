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

// ---------- FEN 불러오기 ----------
// 예: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
// 공백으로 나눈 6칸: 배치 / 차례 / 캐슬링 / 앙파상 / 반수 시계 / 수 번호(우리는 안 씀)
export function fromFEN(fen: string): GameState {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0'] = fen.trim().split(/\s+/);

  // ① 배치: FEN은 맨 위 줄(rank 7)부터 아래로 내려옴
  const board: Board = new Array(64).fill(null);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error(`FEN 줄이 8개가 아니에요: ${placement}`);

  for (let i = 0; i < 8; i++) {
    const rank = 7 - i;
    let file = 0;

    for (const ch of rows[i]) {
      if (ch >= '1' && ch <= '8') {
        file += Number(ch);              // 숫자 = 빈칸 개수
      } else {
        const type = ch.toLowerCase();
        if (!'pnbrqk'.includes(type)) throw new Error(`모르는 기물 글자: ${ch}`);
        const color: Color = ch === type ? 'b' : 'w';   // 소문자 = 흑, 대문자 = 백
        board[sq(file, rank)] = { color, type: type as PieceType };
        file++;
      }
    }
    if (file !== 8) throw new Error(`${8 - i}번째 랭크 칸 수가 8이 아니에요: ${rows[i]}`);
  }

  // ④ 앙파상 칸: "e3" → 칸 번호
  let enPassant: number | null = null;
  if (ep !== '-') {
    const f = ep.charCodeAt(0) - 'a'.charCodeAt(0);
    const r = Number(ep[1]) - 1;
    enPassant = sq(f, r);
  }

  return {
    board,
    turn: turn === 'b' ? 'b' : 'w',            // ② 차례
    castling: {                                 // ③ 캐슬링 권리
      wK: castling.includes('K'),
      wQ: castling.includes('Q'),
      bK: castling.includes('k'),
      bQ: castling.includes('q'),
    },
    enPassant,
    halfmoveClock: Number(half),                // ⑤ 반수 시계
  };
}