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
  stats.nodes++;
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

// ---------- 수 정렬 ----------

// 어떤 수부터 볼지 정하는 점수 (클수록 먼저 봄). 결과는 안 바뀌고 속도만 바뀜
// 잡는 수: 10 × 잡히는 기물 값 − 잡는 기물 값 → 비싼 기물을 싼 기물로 잡는 수가 앞
// 프로모션: 늘어나는 값만큼 더함. 아무것도 안 잡는 수는 0
function orderScore(game: GameState, move: Move): number {
  const piece = game.board[move.from]!;
  const target = game.board[move.to];

  let score = 0;
  if (target) score += 10 * VALUE[target.type] - VALUE[piece.type];
  else if (piece.type === 'p' && move.to === game.enPassant) score += 10 * VALUE.p - VALUE.p; // 앙파상

  if (move.promotion) score += 10 * (VALUE[move.promotion] - VALUE.p);
  return score;
}

// 둘 수 있는 수를 "좋아 보이는 순서"로 정렬해서 돌려줌
function orderedMoves(game: GameState): Move[] {
  return legalMoves(game)
    .map(move => ({ move, score: orderScore(game, move) }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.move);
}

// 탐색한 장면 수 (얼마나 일했는지 재보기용)
export const stats = { nodes: 0 };

// ---------- 정지 탐색 ----------

// 정해진 깊이를 다 본 뒤, 잡는 싸움이 끝날 때까지 "잡는 수만" 더 봄 (수평선 효과 막기)
// 차례인 쪽은 "안 잡고 멈추기"도 고를 수 있음 → 지금 장면 점수(standPat)가 최소 보장 점수
function quiesce(game: GameState, alpha: number, beta: number): number {
  stats.nodes++;
  const moves = orderedMoves(game);

  if (moves.length === 0) {
    if (!inCheck(game, game.turn)) return 0;
    return game.turn === 'w' ? -MATE : MATE;
  }

  const standPat = evaluate(game); // 여기서 멈추면 받는 점수

  if (game.turn === 'w') {
    let best = standPat;
    alpha = Math.max(alpha, best);
    if (alpha >= beta) return best;
    for (const move of moves) {
      if (orderScore(game, move) === 0) break; // 정렬돼 있어서, 여기부터는 전부 조용한 수
      const copy = structuredClone(game);
      makeMove(copy, move);
      best = Math.max(best, quiesce(copy, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = standPat;
    beta = Math.min(beta, best);
    if (alpha >= beta) return best;
    for (const move of moves) {
      if (orderScore(game, move) === 0) break;
      const copy = structuredClone(game);
      makeMove(copy, move);
      best = Math.min(best, quiesce(copy, alpha, beta));
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
}

// ---------- 알파-베타 ----------

// 미니맥스와 같은 값을 내지만, 결과에 영향 없는 가지는 잘라냄
// alpha: 백(최대 쪽)이 이미 확보한 점수, beta: 흑(최소 쪽)이 이미 확보한 점수
function alphaBeta(game: GameState, depth: number, alpha: number, beta: number): number {
  stats.nodes++;
  const moves = orderedMoves(game); // 좋아 보이는 수부터

  if (moves.length === 0) {
    if (!inCheck(game, game.turn)) return 0;
    return game.turn === 'w' ? -(MATE + depth) : MATE + depth;
  }
  if (depth === 0) return quiesce(game, alpha, beta); // 끝에서 바로 세지 않고, 잡는 싸움부터 마저 봄

  if (game.turn === 'w') {
    let best = -Infinity;
    for (const move of moves) {
      const copy = structuredClone(game);
      makeMove(copy, move);
      best = Math.max(best, alphaBeta(copy, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;   // 흑이 이쪽으로 안 옴 → 나머지 수는 안 봄
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const copy = structuredClone(game);
      makeMove(copy, move);
      best = Math.min(best, alphaBeta(copy, depth - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (alpha >= beta) break;   // 백이 이쪽으로 안 옴 → 나머지 수는 안 봄
    }
    return best;
  }
}

// 알파-베타로 고른 가장 좋은 수. 같은 점수의 수가 여러 개면 그중 아무거나
export function alphaBetaMove(game: GameState, depth: number): Move {
  const white = game.turn === 'w';
  let best = white ? -Infinity : Infinity;
  let bestMoves: Move[] = [];

  for (const move of orderedMoves(game)) {
    const copy = structuredClone(game);
    makeMove(copy, move);
    // 점수는 정수라서, 기준을 1 느슨하게 두면 "지금 최고와 같은 점수"까지 정확히 계산됨
    const score = white
      ? alphaBeta(copy, depth - 1, best - 1, Infinity)
      : alphaBeta(copy, depth - 1, -Infinity, best + 1);

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

export const SEARCH_DEPTH = 3; // 몇 수 앞까지 볼지

export function chooseMove(kind: AIKind, game: GameState): Move {
  if (kind === 'random') return randomMove(game);
  if (kind === 'greedy') return greedyMove(game);
  return alphaBetaMove(game, SEARCH_DEPTH);
}
