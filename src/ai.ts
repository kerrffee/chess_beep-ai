import type { GameState, PieceType } from './board';
import { legalMoves, type Move } from './moves';

export type AIKind = 'random' | 'greedy';

// 기물 가치 (킹은 잡을 일이 없으니 0)
const VALUE: Record<PieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

// 랜덤 AI: 둘 수 있는 수 중 아무거나
export function randomMove(game: GameState): Move {
  return pickRandom(legalMoves(game));
}

// 이 수로 "지금 당장" 얻는 점수: 잡은 기물 값 + 프로모션으로 늘어난 값
function immediateGain(game: GameState, move: Move): number {
  const piece = game.board[move.from]!;
  const target = game.board[move.to];

  let gain = 0;
  if (target) gain += VALUE[target.type];
  else if (piece.type === 'p' && move.to === game.enPassant) gain += VALUE.p; // 앙파상

  if (move.promotion) gain += VALUE[move.promotion] - VALUE.p;
  return gain;
}

// 욕심쟁이 AI: 당장 얻는 점수가 가장 큰 수. 같으면 그중 아무거나
// 상대가 다시 잡을지는 전혀 생각하지 않음
export function greedyMove(game: GameState): Move {
  const moves = legalMoves(game);
  let best = -1;
  let bestMoves: Move[] = [];

  for (const move of moves) {
    const gain = immediateGain(game, move);
    if (gain > best) {
      best = gain;
      bestMoves = [move];
    } else if (gain === best) {
      bestMoves.push(move);
    }
  }
  return pickRandom(bestMoves);
}

export function chooseMove(kind: AIKind, game: GameState): Move {
  return kind === 'random' ? randomMove(game) : greedyMove(game);
}