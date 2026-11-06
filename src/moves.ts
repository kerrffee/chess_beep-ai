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

// 정해진 방향으로 "한 번만" 이동하는 기물(나이트, 킹)
function stepMoves(game: GameState, from: number, offsets: [number, number][]): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  for (const [df, dr] of offsets) {
    const nf = f + df;
    const nr = r + dr;
    if (!onBoard(nf, nr)) continue;           // 판 밖이면 버림

    const to = sq(nf, nr);
    const target = game.board[to];
    if (target && target.color === piece.color) continue; // 내 기물이 있으면 못 감

    result.push(to);
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
    default: {
      // 아직 규칙 없음: 내 기물이 없는 칸이면 어디든
      const all: number[] = [];
      for (let i = 0; i < 64; i++) {
        const t = game.board[i];
        if (!t || t.color !== piece.color) all.push(i);
      }
      return all;
    }
  }
}