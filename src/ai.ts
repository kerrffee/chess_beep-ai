import type { GameState, PieceType } from './board';
import { legalMoves, makeMove, inCheck, type Move } from './moves';

export type AIKind = 'random' | 'greedy' | 'minimax';

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

// ---------- 미니맥스 ----------

const MATE = 100000; // 체크메이트 점수. 어떤 기물 점수보다도 훨씬 큼

// 평가함수 v1: 백 기물 점수 합 − 흑 기물 점수 합 (백 입장 점수)
// +면 백이 유리, −면 흑이 유리
function evaluate(game: GameState): number {
  let score = 0;
  for (const p of game.board) {
    if (!p) continue;
    score += p.color === 'w' ? VALUE[p.type] : -VALUE[p.type];
  }
  return score;
}

// depth수 더 내다봤을 때의 점수 (백 입장)
// 백 차례면 가장 큰 값, 흑 차례면 가장 작은 값을 고름
function minimax(game: GameState, depth: number): number {
  const moves = legalMoves(game);

  // 둘 수가 없으면 게임 끝: 체크메이트 또는 스테일메이트
  if (moves.length === 0) {
    if (!inCheck(game, game.turn)) return 0;              // 스테일메이트 = 무승부 = 0점
    // 남은 depth가 클수록 = 더 빨리 메이트 → 더 극단적인 점수
    return game.turn === 'w' ? -(MATE + depth) : MATE + depth;
  }
  if (depth === 0) return evaluate(game);

  if (game.turn === 'w') {
    let best = -Infinity;
    for (const move of moves) {
      const copy = structuredClone(game);
      makeMove(copy, move);
      best = Math.max(best, minimax(copy, depth - 1));
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const copy = structuredClone(game);
      makeMove(copy, move);
      best = Math.min(best, minimax(copy, depth - 1));
    }
    return best;
  }
}

// 지금 차례인 쪽에게 가장 좋은 수. 점수가 같은 수가 여러 개면 그중 아무거나
export function minimaxMove(game: GameState, depth: number): Move {
  const white = game.turn === 'w';
  let best = white ? -Infinity : Infinity;
  let bestMoves: Move[] = [];

  for (const move of legalMoves(game)) {
    const copy = structuredClone(game);
    makeMove(copy, move);
    const score = minimax(copy, depth - 1);

    const better = white ? score > best : score < best;
    if (better) {
      best = score;
      bestMoves = [move];
    } else if (score === best) {
      bestMoves.push(move);
    }
  }
  return pickRandom(bestMoves);
}

export const MINIMAX_DEPTH = 2; // 몇 수 앞까지 볼지 (내 수 + 상대 수)

export function chooseMove(kind: AIKind, game: GameState): Move {
  if (kind === 'random') return randomMove(game);
  if (kind === 'greedy') return greedyMove(game);
  return minimaxMove(game, MINIMAX_DEPTH);
}