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

  const dir = piece.color === 'w' ? 1 : -1;       // 앞 방향: 백은 위(+1), 흑은 아래(-1)
  const startRank = piece.color === 'w' ? 1 : 6;  // 출발 줄: 백은 2랭크, 흑은 7랭크

  // 1. 앞으로 한 칸
  const oneRank = r + dir;
  if (onBoard(f, oneRank) && !game.board[sq(f, oneRank)]) {
    result.push(sq(f, oneRank));

    // 2. 출발 줄이면 두 칸 (한 칸 앞이 비어 있을 때만 여기까지 옴)
    const twoRank = r + 2 * dir;
    if (r === startRank && !game.board[sq(f, twoRank)]) {
      result.push(sq(f, twoRank));
    }
  }

  // 3. 대각선 잡기 (왼쪽, 오른쪽)
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

// from 칸의 기물이 갈 수 있는 칸 목록
export function movesFrom(game: GameState, from: number): number[] {
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