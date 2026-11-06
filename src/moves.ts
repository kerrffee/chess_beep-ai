import { sq, type GameState } from './board';

function fileOf(index: number): number {
  return index % 8;
}
function rankOf(index: number): number {
  return Math.floor(index / 8);
}
function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

// (가로 이동, 세로 이동)
const KNIGHT_JUMPS: [number, number][] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_STEPS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN_DIRS: [number, number][] = [...ROOK_DIRS, ...BISHOP_DIRS];

// 정해진 방향으로 "한 번만" 이동하는 기물(나이트, 킹)
function stepMoves(game: GameState, from: number, offsets: [number, number][]): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  for (const [df, dr] of offsets) {
    const nf = f + df;
    const nr = r + dr;
    if (!onBoard(nf, nr)) continue;

    const to = sq(nf, nr);
    const target = game.board[to];
    if (target && target.color === piece.color) continue;

    result.push(to);
  }
  return result;
}

// 막힐 때까지 "미끄러지는" 기물(룩, 비숍, 퀸)
function slideMoves(game: GameState, from: number, dirs: [number, number][]): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  for (const [df, dr] of dirs) {
    let nf = f + df;
    let nr = r + dr;

    while (onBoard(nf, nr)) {
      const to = sq(nf, nr);
      const target = game.board[to];

      if (!target) {
        result.push(to);
      } else {
        if (target.color !== piece.color) result.push(to);
        break;
      }

      nf += df;
      nr += dr;
    }
  }
  return result;
}

// 폰 (기본 규칙만: 앞으로 1칸, 처음 2칸, 대각선 잡기)
function pawnMoves(game: GameState, from: number): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  const dir = piece.color === 'w' ? 1 : -1;
  const startRank = piece.color === 'w' ? 1 : 6;

  const oneRank = r + dir;
  if (onBoard(f, oneRank) && !game.board[sq(f, oneRank)]) {
    result.push(sq(f, oneRank));

    const twoRank = r + 2 * dir;
    if (r === startRank && !game.board[sq(f, twoRank)]) {
      result.push(sq(f, twoRank));
    }
  }

  for (const df of [-1, 1]) {
    const nf = f + df;
    if (!onBoard(nf, oneRank)) continue;
    const target = game.board[sq(nf, oneRank)];
    if (target && target.color !== piece.color) {
      result.push(sq(nf, oneRank));
    }
  }

  return result;
}

// 체크를 따지지 않은 "일단 갈 수 있는 칸"
function pseudoMoves(game: GameState, from: number): number[] {
  const piece = game.board[from];
  if (!piece) return [];

  switch (piece.type) {
    case 'n':
      return stepMoves(game, from, KNIGHT_JUMPS);
    case 'k':
      return stepMoves(game, from, KING_STEPS);
    case 'r':
      return slideMoves(game, from, ROOK_DIRS);
    case 'b':
      return slideMoves(game, from, BISHOP_DIRS);
    case 'q':
      return slideMoves(game, from, QUEEN_DIRS);
    case 'p':
      return pawnMoves(game, from);
  }
  return [];
}

// ---------- 체크 관련 ----------

// color 색 킹이 있는 칸 번호
function findKing(game: GameState, color: 'w' | 'b'): number {
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return -1;
}

// target 칸을 attacker 색 기물 중 하나라도 공격하고 있는지
function isAttacked(game: GameState, target: number, attacker: 'w' | 'b'): boolean {
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    if (p && p.color === attacker && pseudoMoves(game, i).includes(target)) {
      return true;
    }
  }
  return false;
}

// color 색 킹이 지금 체크 상태인지
export function inCheck(game: GameState, color: 'w' | 'b'): boolean {
  const king = findKing(game, color);
  const enemy = color === 'w' ? 'b' : 'w';
  return isAttacked(game, king, enemy);
}

// from 칸 기물이 "진짜로" 둘 수 있는 칸 (내 킹을 위험하게 만드는 수 제외)
export function movesFrom(game: GameState, from: number): number[] {
  const piece = game.board[from];
  if (!piece) return [];

  const legal: number[] = [];

  for (const to of pseudoMoves(game, from)) {
    // 1) 둬보기
    const captured = game.board[to];
    game.board[to] = piece;
    game.board[from] = null;

    // 2) 이 상태에서 내 킹이 공격받는지 확인
    const illegal = inCheck(game, piece.color);

    // 3) 되돌리기
    game.board[from] = piece;
    game.board[to] = captured;

    if (!illegal) legal.push(to);
  }
  return legal;
}