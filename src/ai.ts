import { cloneGame, type GameState, type PieceType } from './board';
import { legalMoves, makeMove, inCheck, type Move } from './moves';

export type AIKind = 'random' | 'greedy' | 'minimax';

// 기물 가치 (폰 = 100 단위. 킹은 잡을 일이 없으니 0)
// 100 단위인 이유: 좋은 칸 보너스를 "폰의 0.1개 = 10점"처럼 정수로 섞으려고
const VALUE: Record<PieceType, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };

// ---------- 기물별 좋은 칸 표 ----------
// 백 입장에서, 눈에 보이는 체스판 모양 그대로 적음:
// 첫 줄 = 맨 위(아래에서 8번째 줄, 흑 진영), 마지막 줄 = 맨 아래(아래에서 1번째 줄, 백 진영)
// 숫자 = 그 칸에 있을 때 받는 보너스 (폰 1개 = 100)
const PST: Record<PieceType, number[]> = {
  // 폰: 앞으로 나갈수록 +. 가운데 두 폰(d, e)은 처음 자리에 머물면 −
  p: [
      0,   0,   0,   0,   0,   0,   0,   0,
     50,  50,  50,  50,  50,  50,  50,  50,
     10,  10,  20,  30,  30,  20,  10,  10,
      5,   5,  10,  25,  25,  10,   5,   5,
      0,   0,   0,  20,  20,   0,   0,   0,
      5,  -5, -10,   0,   0, -10,  -5,   5,
      5,  10,  10, -20, -20,  10,  10,   5,
      0,   0,   0,   0,   0,   0,   0,   0,
  ],
  // 나이트: 가운데일수록 +, 구석은 크게 −
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20,   0,   0,   0,   0, -20, -40,
    -30,   0,  10,  15,  15,  10,   0, -30,
    -30,   5,  15,  20,  20,  15,   5, -30,
    -30,   0,  15,  20,  20,  15,   0, -30,
    -30,   5,  10,  15,  15,  10,   5, -30,
    -40, -20,   0,   5,   5,   0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  // 비숍: 가장자리는 −, 긴 대각선을 보는 칸이 +
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -10,   0,   5,  10,  10,   5,   0, -10,
    -10,   5,   5,  10,  10,   5,   5, -10,
    -10,   0,  10,  10,  10,  10,   0, -10,
    -10,  10,  10,  10,  10,  10,  10, -10,
    -10,   5,   0,   0,   0,   0,   5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  // 룩: 상대 진영 둘째 줄(아래에서 7번째 줄)이 +, 가운데 세로줄이 약간 +
  r: [
      0,   0,   0,   0,   0,   0,   0,   0,
      5,  10,  10,  10,  10,  10,  10,   5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
     -5,   0,   0,   0,   0,   0,   0,  -5,
      0,   0,   0,   5,   5,   0,   0,   0,
  ],
  // 퀸: 가운데 쪽이 조금 +, 가장자리는 조금 − (너무 일찍 나오지 않게 차이를 작게)
  q: [
    -20, -10, -10,  -5,  -5, -10, -10, -20,
    -10,   0,   0,   0,   0,   0,   0, -10,
    -10,   0,   5,   5,   5,   5,   0, -10,
     -5,   0,   5,   5,   5,   5,   0,  -5,
      0,   0,   5,   5,   5,   5,   0,  -5,
    -10,   5,   5,   5,   5,   5,   0, -10,
    -10,   0,   5,   0,   0,   0,   0, -10,
    -20, -10, -10,  -5,  -5, -10, -10, -20,
  ],
  // 킹(중반용): 캐슬링한 구석 자리가 +, 앞으로 나올수록 크게 −
  // 끝판에는 아래 KING_ENDGAME 표와 섞어서 씀
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
     20,  20,   0,   0,   0,   0,  20,  20,
     20,  30,  10,   0,   0,  10,  30,  20,
  ],
};

// 킹(끝판용): 기물이 다 빠지면 킹도 싸워야 함 → 가운데가 +, 구석은 −
const KING_ENDGAME: number[] = [
  -50, -40, -30, -20, -20, -30, -40, -50,
  -30, -20, -10,   0,   0, -10, -20, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -30,   0,   0,   0,   0, -30, -30,
  -50, -30, -30, -30, -30, -30, -30, -50,
];

// 칸 번호(a1 = 0 … h8 = 63) → 표에서 읽을 위치
// 표의 첫 줄이 맨 위 줄이라서, 백은 줄을 뒤집어 읽고(7 − rank) 흑은 그대로 읽음(위아래 대칭)
function tableIndex(color: 'w' | 'b', square: number): number {
  const file = square % 8;
  const rank = Math.floor(square / 8);
  const row = color === 'w' ? 7 - rank : rank;
  return row * 8 + file;
}

// ---------- 게임 단계 ----------
// 폰·킹을 뺀 기물이 얼마나 남았는지로 "중반 ↔ 끝판"을 0~24로 잼
// 나이트·비숍 1, 룩 2, 퀸 4 → 처음엔 (1+1+2)×2×2 + 4×2 = 24, 다 빠지면 0
const PHASE_WEIGHT: Record<PieceType, number> = { p: 0, n: 1, b: 1, r: 2, q: 4, k: 0 };
const MAX_PHASE = 24;

function gamePhase(game: GameState): number {
  let phase = 0;
  for (const p of game.board) if (p) phase += PHASE_WEIGHT[p.type];
  return Math.min(phase, MAX_PHASE); // 프로모션으로 24를 넘을 수도 있어서
}

// 킹 보너스: 중반 표와 끝판 표를 단계에 따라 섞음
// phase 24 → 중반 표 100%, phase 0 → 끝판 표 100%, 그 사이는 비율대로
// 점수를 정수로 유지하려고 반올림 (알파-베타의 best ± 1 기법 때문)
function kingBonus(color: 'w' | 'b', square: number, phase: number): number {
  const i = tableIndex(color, square);
  return Math.round((PST.k[i] * phase + KING_ENDGAME[i] * (MAX_PHASE - phase)) / MAX_PHASE);
}

function pstBonus(type: PieceType, color: 'w' | 'b', square: number, phase: number): number {
  if (type === 'k') return kingBonus(color, square, phase);
  return PST[type][tableIndex(color, square)];
}

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

// 평가함수 v2: (기물 값 + 그 칸의 보너스)를 백 전부 더한 것 − 흑 전부 더한 것 (백 입장 점수)
// +면 백이 유리, −면 흑이 유리
// 킹 표는 게임 단계(중반 ↔ 끝판)에 따라 섞어서 씀
export function evaluate(game: GameState): number {
  const phase = gamePhase(game);
  let score = 0;
  for (let s = 0; s < 64; s++) {
    const p = game.board[s];
    if (!p) continue;
    const v = VALUE[p.type] + pstBonus(p.type, p.color, s, phase);
    score += p.color === 'w' ? v : -v;
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
      const copy = cloneGame(game);
      makeMove(copy, move);
      best = Math.max(best, minimax(copy, depth - 1));
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const copy = cloneGame(game);
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
    const copy = cloneGame(game);
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
      const copy = cloneGame(game);
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
      const copy = cloneGame(game);
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
      const copy = cloneGame(game);
      makeMove(copy, move);
      best = Math.max(best, alphaBeta(copy, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;   // 흑이 이쪽으로 안 옴 → 나머지 수는 안 봄
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const copy = cloneGame(game);
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
    const copy = cloneGame(game);
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
