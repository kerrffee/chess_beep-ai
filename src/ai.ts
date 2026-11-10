import { cloneGame, type GameState, type PieceType } from './board';
import { legalMoves, makeMove, unmakeMove, inCheck, positionKey, insufficientMaterial, type Move } from './moves';
import { computeHash, hashFromKey, hashHi, hashLo } from './zobrist';

import type { Personality } from './personality';

// 기물 가치 (폰 = 100 단위. 킹은 잡을 일이 없으니 0)
// 100 단위인 이유: 좋은 칸 보너스를 "폰의 0.1개 = 10점"처럼 정수로 섞으려고
export const VALUE: Record<PieceType, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };

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

// ---------- 평가함수 v3: 위치 판단 항목 ----------
// 기물 값과 좋은 칸 표만으로는 못 보는 것들. 숫자는 전부 "폰 1개 = 100" 기준
// 성격마다 이 숫자들을 바꿔서 씀 (personality.ts)
export const EVAL_WEIGHTS = {
  doubledPawn: 15,     // 같은 세로줄에 내 폰이 2개 이상: 서로 막고, 지켜 주지 못함 (1개 더 있을 때마다 −)
  isolatedPawn: 15,    // 양옆 세로줄에 내 폰이 없음: 다른 폰이 지켜 줄 수 없음
  passedPawn: [0, 5, 10, 20, 35, 60, 100, 0], // 앞을 막을 상대 폰이 없는 폰. 몇 줄 나왔는지별 보너스(끝판엔 2배)
  bishopPair: 30,      // 비숍 2개를 다 갖고 있음: 흰 칸·검은 칸을 다 다룰 수 있음
  rookOpenFile: 20,    // 룩이 폰이 하나도 없는 세로줄에 있음
  rookHalfOpen: 10,    // 룩이 내 폰은 없고 상대 폰만 있는 세로줄에 있음
  kingShield1: 10,     // 킹 바로 앞 칸(3개 세로줄)의 내 폰 하나당 (중반에만)
  kingShield2: 5,      // 킹 두 칸 앞의 내 폰 하나당 (중반에만)
  kingOpenFile: 15,    // 킹 앞 3개 세로줄 중 내 폰이 없는 줄 하나당 − (중반에만)
  kingAttack: 0,       // 상대 킹 2칸 안에 있는 내 기물(폰·킹 제외) 하나당 (중반에만). 돌격대장용
  tradeAversion: 0,    // 판에 남은 기물(폰·킹 제외, 양쪽 모두) 하나당. 크면 교환을 싫어함. 겁쟁이용
};
export type EvalWeights = typeof EVAL_WEIGHTS;

// ---------- 성격 적용 ----------
// AI 쪽 색에는 성격의 기물 값·가중치를, 상대 색에는 기본값을 씀
// (예: 퀸 사랑꾼은 "내" 퀸만 아주 비싸게 봄 → 퀸끼리 바꾸는 것도 손해로 느낌)
const activeValues: Record<'w' | 'b', Record<PieceType, number>> = { w: VALUE, b: VALUE };
const activeWeights: Record<'w' | 'b', EvalWeights> = { w: EVAL_WEIGHTS, b: EVAL_WEIGHTS };

function applyPersonality(p: Personality | null, aiColor: 'w' | 'b') {
  const enemy = aiColor === 'w' ? 'b' : 'w';
  activeValues[enemy] = VALUE;
  activeWeights[enemy] = EVAL_WEIGHTS;
  activeValues[aiColor] = { ...VALUE, ...(p?.values ?? {}) };
  activeWeights[aiColor] = { ...EVAL_WEIGHTS, ...(p?.weights ?? {}) };
}

// 평가함수 v3: (기물 값 + 그 칸의 보너스) + 위치 판단 항목, 백 − 흑 (백 입장 점수)
// +면 백이 유리, −면 흑이 유리
// 킹 표와 킹 안전은 게임 단계(중반 ↔ 끝판)에 따라 섞어서 씀
export function evaluate(game: GameState): number {
  const phase = gamePhase(game);
  const b = game.board;
  let score = 0;

  // 한 번 훑으면서 기물 점수를 더하고, 폰 위치·비숍 수·킹 위치를 모아 둠
  const pawnsOnFile = { w: [0, 0, 0, 0, 0, 0, 0, 0], b: [0, 0, 0, 0, 0, 0, 0, 0] };
  const bishops = { w: 0, b: 0 };
  const king = { w: -1, b: -1 };
  let pieces = 0; // 판에 남은 기물 수 (폰·킹 제외, 양쪽 모두)
  for (let s = 0; s < 64; s++) {
    const p = b[s];
    if (!p) continue;
    const v = activeValues[p.color][p.type] + pstBonus(p.type, p.color, s, phase);
    score += p.color === 'w' ? v : -v;
    if (p.type === 'p') pawnsOnFile[p.color][s % 8]++;
    else if (p.type === 'k') king[p.color] = s;
    else {
      pieces++;
      if (p.type === 'b') bishops[p.color]++;
    }
  }

  // 백 기준으로 계산하고, 흑은 같은 계산을 거꾸로 해서 뺌
  for (const color of ['w', 'b'] as const) {
    const sign = color === 'w' ? 1 : -1;
    const enemy = color === 'w' ? 'b' : 'w';
    const mine = pawnsOnFile[color], theirs = pawnsOnFile[enemy];
    const W = activeWeights[color];
    const enemyKing = king[enemy];
    let s = 0;
    let attackers = 0; // 상대 킹 2칸 안에 있는 내 기물 수

    // 폰 구조: 겹친 폰, 고립된 폰
    for (let f = 0; f < 8; f++) {
      if (mine[f] > 1) s -= W.doubledPawn * (mine[f] - 1);
      if (mine[f] > 0 && (f === 0 || mine[f - 1] === 0) && (f === 7 || mine[f + 1] === 0)) {
        s -= W.isolatedPawn * mine[f];
      }
    }

    // 통과한 폰, 룩의 세로줄 (칸마다 보기)
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p || p.color !== color) continue;
      const f = sq % 8, r = Math.floor(sq / 8);
      if (p.type === 'p') {
        // 앞쪽(백은 위, 흑은 아래)의 같은 줄·옆 줄에 상대 폰이 하나도 없으면 통과한 폰
        let passed = true;
        for (let df = -1; df <= 1 && passed; df++) {
          const nf = f + df;
          if (nf < 0 || nf > 7) continue;
          for (let nr = r + (color === 'w' ? 1 : -1); nr >= 0 && nr <= 7; nr += color === 'w' ? 1 : -1) {
            const q = b[nr * 8 + nf];
            if (q && q.type === 'p' && q.color === enemy) { passed = false; break; }
          }
        }
        if (passed) {
          const advanced = color === 'w' ? r : 7 - r; // 몇 줄 나왔는지 (출발 줄 = 1)
          // 끝판일수록 통과한 폰이 중요 → 중반 1배 ~ 끝판 2배
          s += Math.round(W.passedPawn[advanced] * (2 * MAX_PHASE - phase) / MAX_PHASE);
        }
      } else if (p.type !== 'k') {
        if (p.type === 'r') {
          if (mine[f] === 0 && theirs[f] === 0) s += W.rookOpenFile;
          else if (mine[f] === 0) s += W.rookHalfOpen;
        }
        // 상대 킹과 가로·세로 모두 2칸 이내인지
        if (W.kingAttack !== 0 && enemyKing >= 0 &&
            Math.abs(f - enemyKing % 8) <= 2 && Math.abs(r - Math.floor(enemyKing / 8)) <= 2) attackers++;
      }
    }

    // 킹 공격 (중반일수록 중요)
    if (attackers > 0) s += Math.round(W.kingAttack * attackers * phase / MAX_PHASE);
    // 교환 싫어함: 판에 기물이 많이 남아 있을수록 좋다고 느낌
    if (W.tradeAversion !== 0) s += W.tradeAversion * pieces;

    // 비숍 두 개
    if (bishops[color] >= 2) s += W.bishopPair;

    // 킹 안전 (중반일수록 중요 → phase 비율만큼만 반영)
    const k = king[color];
    if (k >= 0 && phase > 0) {
      const kf = k % 8, kr = Math.floor(k / 8), up = color === 'w' ? 1 : -1;
      let shield = 0;
      for (let df = -1; df <= 1; df++) {
        const nf = kf + df;
        if (nf < 0 || nf > 7) continue;
        const r1 = kr + up, r2 = kr + 2 * up;
        const p1 = r1 >= 0 && r1 <= 7 ? b[r1 * 8 + nf] : null;
        const p2 = r2 >= 0 && r2 <= 7 ? b[r2 * 8 + nf] : null;
        if (p1 && p1.type === 'p' && p1.color === color) shield += W.kingShield1;
        else if (p2 && p2.type === 'p' && p2.color === color) shield += W.kingShield2;
        if (mine[nf] === 0) shield -= W.kingOpenFile;
      }
      s += Math.round(shield * phase / MAX_PHASE);
    }

    score += sign * s;
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
      const undo = makeMove(game, move);
      best = Math.max(best, minimax(game, depth - 1));
      unmakeMove(game, move, undo);
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const undo = makeMove(game, move);
      best = Math.min(best, minimax(game, depth - 1));
      unmakeMove(game, move, undo);
    }
    return best;
  }
}

// 지금 차례인 쪽에게 가장 좋은 수. 점수가 같은 수가 여러 개면 그중 아무거나
export function minimaxMove(original: GameState, depth: number): Move {
  const game = cloneGame(original); // 탐색은 복사본 위에서 (원래 판은 절대 안 건드림)
  const white = game.turn === 'w';
  let best = white ? -Infinity : Infinity;
  let bestMoves: Move[] = [];

  for (const move of legalMoves(game)) {
    const undo = makeMove(game, move);
    const score = minimax(game, depth - 1);
    unmakeMove(game, move, undo);

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

// ---------- 킬러 수 ----------
// 다른 가지에서 상대를 막아서(가지치기를 일으켜서) 잘라내게 한 "조용한 수"는
// 같은 깊이의 옆 가지에서도 좋은 경우가 많음 → 잡는 수 다음, 나머지 조용한 수보다 먼저 봄
// killers[ply] = 그 깊이(맨 위에서 몇 수째)에서 최근에 가지치기를 일으킨 조용한 수 최대 2개
let killers: Move[][] = [];
const KILLER_SCORE = 50; // 잡는 수(최소 100)보다는 낮고, 그냥 조용한 수(0)보다는 높게

function sameMove(a: Move, b: Move): boolean {
  return a.from === b.from && a.to === b.to && a.promotion === b.promotion;
}

function addKiller(ply: number, move: Move) {
  const list = killers[ply] ?? (killers[ply] = []);
  if (list.length > 0 && sameMove(list[0], move)) return;
  list.unshift(move);   // 맨 앞에 넣고
  if (list.length > 2) list.pop(); // 2개만 남김
}

// 둘 수 있는 수를 "좋아 보이는 순서"로 정렬해서 돌려줌
// ply를 주면 그 깊이의 킬러 수도 앞으로 당김. ttMove(전치표가 기억한 최선의 수)가 있으면 맨 앞
function orderedMoves(game: GameState, ply = -1, ttMove = -1): Move[] {
  const list = ply >= 0 ? killers[ply] : undefined;
  return legalMoves(game)
    .map(move => {
      let score = orderScore(game, move);
      if (ttMove >= 0 && encodeMove(move) === ttMove) score = TT_MOVE_SCORE;
      else if (score === 0 && list && list.some(k => sameMove(k, move))) score = KILLER_SCORE;
      return { move, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.move);
}

// 탐색한 장면 수 (얼마나 일했는지 재보기용), 마지막 탐색에서 끝까지 본 깊이
export const stats = { nodes: 0, depth: 0 };

// ---------- 시간 제한 ----------
// 시간이 다 되면 TimeUp을 던져서 탐색을 한 번에 빠져나옴 (try/catch로 받음)
class TimeUp extends Error {}
let deadline = Infinity; // 이 시각(ms)이 지나면 그만. 평소에는 무한대 = 제한 없음

// 장면 1024개마다 한 번씩만 시계를 봄 (매번 보면 그것도 느려서)
function checkTime() {
  if ((stats.nodes & 1023) === 0 && Date.now() > deadline) throw new TimeUp();
}

// ---------- 무승부 규칙 ----------
// historyHi/Lo: 실제 게임에서 나온 장면들의 지문 (지금 장면 포함, 화면이 보낸 이름표에서 계산)
// pathHi/Lo: 게임 기록 + 탐색하면서 지나온 장면들의 지문. 탐색 중 한 번이라도 같은 장면이 다시 나오면 무승부(0점)로 침
//   (실제 규칙은 3번이지만, 한 번 돌아온 장면은 또 돌아올 수 있어서 엔진들은 보통 이렇게 계산함)
// 지문은 32비트 두 개(hi, lo)라서 배열도 두 개
let historyHi: number[] = [], historyLo: number[] = [];
let pathHi: number[] = [], pathLo: number[] = [];

// 지금 장면이 앞에서 나온 적 있는지
// 잡거나 폰을 움직인 뒤로는 그 전 장면이 다시 나올 수 없어서, halfmoveClock만큼만 거슬러 봄
// 같은 쪽 차례인 장면끼리만 같을 수 있어서 2칸씩 건너뜀
function isRepetition(hi: number, lo: number, halfmoveClock: number): boolean {
  const n = pathHi.length;
  for (let i = n - 2; i >= 0 && i >= n - halfmoveClock; i -= 2) {
    if (pathHi[i] === hi && pathLo[i] === lo) return true;
  }
  return false;
}

// ---------- 전치표 (이미 본 장면 기억하기) ----------
// 체스는 다른 순서로 둬도 같은 장면이 자주 나옴 (나이트 f3 → 나이트 c3 = 나이트 c3 → 나이트 f3)
// 그래서 한 번 계산한 장면은 "지문 → 결과"로 적어 두고, 다시 나오면 계산 대신 꺼내 씀
// 칸 수가 정해진 표라서, 지문의 아랫부분으로 칸을 정하고 같은 칸에 새 결과가 오면 덮어씀
// 한 칸에 적는 것: 지문(진짜 같은 장면인지 확인용), 몇 수 앞까지 봤는지, 점수, 점수의 종류, 최선의 수
const TT_BITS = 20;                 // 칸 2^20개 (약 100만). 메모리 약 18MB
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const ttHi = new Int32Array(TT_SIZE);
const ttLo = new Int32Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE);
const ttScore = new Int32Array(TT_SIZE);
const ttFlag = new Uint8Array(TT_SIZE);   // 0 = 빈 칸
const ttMoveArr = new Int32Array(TT_SIZE);
// 점수의 종류: 알파-베타는 가지를 잘라서, 점수가 "정확한 값"이 아니라 "이 이상/이 이하"일 때가 있음
const EXACT = 1; // 정확한 점수
const LOWER = 2; // 진짜 점수 ≥ 적힌 점수 (더 좋은 수가 있어서 중간에 잘림)
const UPPER = 3; // 진짜 점수 ≤ 적힌 점수 (어떤 수도 기준을 못 넘음)
const TT_MOVE_SCORE = 1_000_000; // 전치표의 최선의 수는 무엇보다 먼저 봄
export const ttStats = { hits: 0 };

// 수를 숫자 하나로: 출발 칸 + 도착 칸×64 + 프로모션×4096
const PROMO_CODE: Record<string, number> = { q: 1, r: 2, b: 3, n: 4 };
function encodeMove(m: Move): number {
  return m.from | (m.to << 6) | ((m.promotion ? PROMO_CODE[m.promotion] : 0) << 12);
}

function clearTT() {
  ttFlag.fill(0);
}

// ---------- 정지 탐색 ----------

// 정해진 깊이를 다 본 뒤, 잡는 싸움이 끝날 때까지 "잡는 수만" 더 봄 (수평선 효과 막기)
// 차례인 쪽은 "안 잡고 멈추기"도 고를 수 있음 → 지금 장면 점수(standPat)가 최소 보장 점수
// 단, 체크당한 상태면 멈출 수 없음 → 체크를 피하는 수를 전부 봄
function quiesce(game: GameState, alpha: number, beta: number): number {
  stats.nodes++;
  checkTime();
  const moves = orderedMoves(game);
  const checked = inCheck(game, game.turn);

  if (moves.length === 0) {
    if (!checked) return 0;
    return game.turn === 'w' ? -MATE : MATE;
  }

  const white = game.turn === 'w';
  // 여기서 멈추면 받는 점수. 체크당했으면 멈추기가 없으니 "최악"에서 시작
  const standPat = checked ? (white ? -Infinity : Infinity) : evaluate(game);

  if (white) {
    let best = standPat;
    alpha = Math.max(alpha, best);
    if (alpha >= beta) return best;
    for (const move of moves) {
      if (!checked && orderScore(game, move) === 0) break; // 정렬돼 있어서, 여기부터는 전부 조용한 수
      const undo = makeMove(game, move);
      best = Math.max(best, quiesce(game, alpha, beta));
      unmakeMove(game, move, undo);
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = standPat;
    beta = Math.min(beta, best);
    if (alpha >= beta) return best;
    for (const move of moves) {
      if (!checked && orderScore(game, move) === 0) break;
      const undo = makeMove(game, move);
      best = Math.min(best, quiesce(game, alpha, beta));
      unmakeMove(game, move, undo);
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  }
}

// ---------- 알파-베타 ----------

const MAX_EXTEND_PLY = 20; // 체크 연장은 맨 위에서 이 수까지만 (체크가 끝없이 이어지는 걸 막으려고)

// 미니맥스와 같은 값을 내지만, 결과에 영향 없는 가지는 잘라냄
// alpha: 백(최대 쪽)이 이미 확보한 점수, beta: 흑(최소 쪽)이 이미 확보한 점수
function alphaBeta(game: GameState, depth: number, alpha: number, beta: number): number {
  stats.nodes++;
  checkTime();
  const ply = pathHi.length - historyHi.length; // 맨 위에서 몇 수째인지
  computeHash(game);
  const hi = hashHi, lo = hashLo;

  // 무승부 규칙: 같은 장면 반복, 50수, 메이트할 기물 부족 → 0점
  if (game.halfmoveClock >= 100 || isRepetition(hi, lo, game.halfmoveClock) || insufficientMaterial(game)) return 0;

  const checked = inCheck(game, game.turn);
  // 체크 연장: 체크당했으면 한 수 더 봄 (체크 다음에 결정적인 수가 오는 경우가 많아서)
  if (checked && ply < MAX_EXTEND_PLY) depth++;
  if (depth <= 0) return quiesce(game, alpha, beta); // 끝에서 바로 세지 않고, 잡는 싸움부터 마저 봄

  // 전치표 확인: 같은 장면을 이만큼 이상 깊이 본 적 있으면 그 결과를 씀
  const slot = lo & TT_MASK;
  let ttMove = -1;
  if (ttFlag[slot] !== 0 && ttHi[slot] === hi && ttLo[slot] === lo) {
    ttMove = ttMoveArr[slot]; // 깊이가 모자라도 "최선의 수"는 먼저 볼 후보로 씀
    if (ttDepth[slot] >= depth) {
      const score = ttScore[slot];
      const flag = ttFlag[slot];
      if (flag === EXACT) { ttStats.hits++; return score; }
      if (flag === LOWER) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) { ttStats.hits++; return score; }
    }
  }

  const moves = orderedMoves(game, ply, ttMove); // 전치표의 수 → 잡는 수 → 킬러 수 → 나머지
  if (moves.length === 0) {
    if (!checked) return 0;
    return game.turn === 'w' ? -(MATE + depth) : MATE + depth;
  }

  const alpha0 = alpha, beta0 = beta; // 점수 종류를 정할 때 쓰는 "탐색 시작할 때의 기준"
  const white = game.turn === 'w';
  let best = white ? -Infinity : Infinity;
  let bestMove = moves[0];

  pathHi.push(hi);
  pathLo.push(lo);
  try {
    for (const move of moves) {
      const undo = makeMove(game, move);
      const score = alphaBeta(game, depth - 1, alpha, beta);
      unmakeMove(game, move, undo);
      if (white ? score > best : score < best) { best = score; bestMove = move; }
      if (white) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (alpha >= beta) {        // 상대가 이쪽으로 안 옴 → 나머지 수는 안 봄
        if (orderScore(game, move) === 0) addKiller(ply, move);
        break;
      }
    }
  } finally {
    pathHi.pop();
    pathLo.pop();
  }

  // 전치표에 적기
  ttHi[slot] = hi;
  ttLo[slot] = lo;
  ttDepth[slot] = depth;
  ttScore[slot] = best;
  ttFlag[slot] = best <= alpha0 ? UPPER : best >= beta0 ? LOWER : EXACT;
  ttMoveArr[slot] = encodeMove(bestMove);
  return best;
}

// 맨 위(지금 장면)에서 moves를 주어진 순서대로 depth수 앞까지 봄
// 돌려주는 것: 가장 좋은 점수와, 그 점수를 내는 수 전부
function searchRoot(game: GameState, depth: number, moves: Move[]): { best: number; bestMoves: Move[] } {
  pathHi = historyHi.slice(); // 탐색 경로는 실제 게임 기록에서 시작
  pathLo = historyLo.slice();
  const white = game.turn === 'w';
  let best = white ? -Infinity : Infinity;
  let bestMoves: Move[] = [];

  for (const move of moves) {
    const undo = makeMove(game, move);
    // 점수는 정수라서, 기준을 1 느슨하게 두면 "지금 최고와 같은 점수"까지 정확히 계산됨
    const score = white
      ? alphaBeta(game, depth - 1, best - 1, Infinity)
      : alphaBeta(game, depth - 1, -Infinity, best + 1);
    unmakeMove(game, move, undo);

    const better = white ? score > best : score < best;
    if (better) {
      best = score;
      bestMoves = [move];
    } else if (score === best) {
      bestMoves.push(move);
    }
  }
  return { best, bestMoves };
}

// 탐색 시작 준비: 게임 기록을 지문으로 바꿔 두고(없으면 지금 장면만), 킬러 수와 전치표를 비움
function startSearch(game: GameState, history?: string[]) {
  const keys = history && history.length > 0 ? history : [positionKey(game)];
  historyHi = [];
  historyLo = [];
  for (const key of keys) {
    hashFromKey(key);
    historyHi.push(hashHi);
    historyLo.push(hashLo);
  }
  killers = [];
  clearTT(); // 새로 생각할 때마다 표를 비움 (게임 기록이 달라지면 무승부 점수도 달라질 수 있어서)
}

// 알파-베타로 고른 가장 좋은 수 (깊이 고정, 테스트용). 같은 점수의 수가 여러 개면 그중 아무거나
export function alphaBetaMove(original: GameState, depth: number, history?: string[]): Move {
  const game = cloneGame(original); // 탐색은 복사본 위에서
  applyPersonality(null, game.turn); // 테스트는 항상 기본 성격으로
  startSearch(game, history);
  return pickRandom(searchRoot(game, depth, orderedMoves(game)).bestMoves);
}

// 테스트용: depth수 앞까지 본 점수 (백 기준)
export function searchScore(original: GameState, depth: number, history?: string[]): number {
  const game = cloneGame(original);
  applyPersonality(null, game.turn);
  startSearch(game, history);
  return searchRoot(game, depth, orderedMoves(game)).best;
}

// ---------- 반복 심화 ----------
// 1수 앞 → 2수 앞 → 3수 앞 … 순서로 점점 깊이 보다가, 시간이 다 되면 멈춤
// 고르는 수 = "끝까지 다 본 깊이 중 가장 깊은 것"의 결과 (도중에 끊긴 깊이는 버림)
// 지난 깊이에서 가장 좋았던 수를 다음 깊이에서 맨 먼저 봐서, 알파-베타가 더 많이 잘라냄
export const TIME_LIMIT = 1000; // AI가 한 수에 쓰는 시간(ms)
const MAX_DEPTH = 30;           // 남은 수가 적어서 금방 끝나는 장면에서 끝없이 깊어지지 않게

export function iterativeMove(original: GameState, timeLimit: number, history?: string[]): Move {
  const start = Date.now();
  // 탐색은 복사본 위에서: 시간이 다 돼서 탐색 도중에 빠져나오면 판이 두다 만 상태로 남기 때문
  const game = cloneGame(original);
  startSearch(game, history);
  let moves = orderedMoves(game);
  if (moves.length === 1) { stats.depth = 0; return moves[0]; } // 둘 수 있는 게 하나뿐이면 바로

  // 1수 앞은 시간과 상관없이 끝까지 (그래야 낼 수가 항상 있음)
  let result = searchRoot(game, 1, moves);
  stats.depth = 1;

  deadline = start + timeLimit;
  try {
    for (let depth = 2; depth <= MAX_DEPTH; depth++) {
      if (Math.abs(result.best) >= MATE) break; // 메이트를 찾았으면(하든 당하든) 더 볼 필요 없음
      // 지난번 가장 좋았던 수들을 맨 앞으로, 나머지는 원래 순서대로
      const first = result.bestMoves;
      moves = [...first, ...moves.filter(m => !first.includes(m))];
      result = searchRoot(game, depth, moves); // 시간이 다 되면 여기서 TimeUp이 날아옴 → result는 그대로
      stats.depth = depth;
    }
  } catch (e) {
    if (!(e instanceof TimeUp)) throw e; // 진짜 오류는 그대로 알림
  } finally {
    deadline = Infinity; // 다음 탐색(테스트 등)에 시간 제한이 남지 않게
  }
  return pickRandom(result.bestMoves);
}

// ---------- 실수 ----------
// 성격의 실수 확률만큼, 최선의 수 대신 "그럭저럭 괜찮은 다른 수"를 둠
// 후보: 2수 앞까지 정확히 점수를 매겼을 때 최선보다 margin 이하로만 나쁜 수 (최선의 수 제외)
// 후보가 없으면(다른 수가 전부 크게 나쁘면) 그냥 최선의 수
export const mistakeStats = { made: 0 }; // 실수한 횟수 (테스트용)

function maybeMistake(original: GameState, best: Move, p: Personality, history?: string[]): Move {
  if (!p.mistakeChance || Math.random() >= p.mistakeChance) return best;
  const game = cloneGame(original);
  startSearch(game, history);
  pathHi = historyHi.slice();
  pathLo = historyLo.slice();
  const sign = game.turn === 'w' ? 1 : -1; // 점수를 "AI 입장"으로 바꾸려고
  const scored: { move: Move; score: number }[] = [];
  for (const move of orderedMoves(game)) {
    const undo = makeMove(game, move);
    // 기준 없이(-무한대 ~ +무한대) 봐야 수마다 정확한 점수가 나옴
    scored.push({ move, score: sign * alphaBeta(game, 1, -Infinity, Infinity) });
    unmakeMove(game, move, undo);
  }
  const top = Math.max(...scored.map(x => x.score));
  const margin = p.mistakeMargin ?? 100;
  const candidates = scored.filter(x => !sameMove(x.move, best) && x.score >= top - margin);
  if (candidates.length === 0) return best;
  mistakeStats.made++;
  return pickRandom(candidates).move;
}

// personality: 누가 두는지(성격). history: 실제 게임 장면 기록 (반복 무승부 판단용)
// timeLimit: 성격에 생각 시간이 정해져 있지 않을 때 쓸 시간(ms)
export function chooseMove(p: Personality, game: GameState, history?: string[], timeLimit = TIME_LIMIT): Move {
  if (p.kind === 'random') return randomMove(game);
  if (p.kind === 'greedy') return greedyMove(game);
  applyPersonality(p, game.turn); // 지금 차례인 쪽 = AI
  const best = iterativeMove(game, p.timeLimit ?? timeLimit, history);
  return maybeMistake(game, best, p, history);
}
