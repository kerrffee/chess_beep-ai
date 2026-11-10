import { cloneGame, type GameState, type PieceType } from './board';
import { legalMoves, makeMove, unmakeMove, inCheck, positionKey, insufficientMaterial, type Move } from './moves';

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
// ply를 주면 그 깊이의 킬러 수도 앞으로 당김
function orderedMoves(game: GameState, ply = -1): Move[] {
  const list = ply >= 0 ? killers[ply] : undefined;
  return legalMoves(game)
    .map(move => {
      let score = orderScore(game, move);
      if (score === 0 && list && list.some(k => sameMove(k, move))) score = KILLER_SCORE;
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
// gameHistory: 실제 게임에서 나온 장면들 (지금 장면 포함, 화면에서 받아옴)
// path: gameHistory + 탐색하면서 지나온 장면들. 탐색 중 한 번이라도 같은 장면이 다시 나오면 무승부(0점)로 침
//   (실제 규칙은 3번이지만, 한 번 돌아온 장면은 또 돌아올 수 있어서 엔진들은 보통 이렇게 계산함)
let gameHistory: string[] = [];
let path: string[] = [];

// 지금 장면(key)이 앞에서 나온 적 있는지
// 잡거나 폰을 움직인 뒤로는 그 전 장면이 다시 나올 수 없어서, halfmoveClock만큼만 거슬러 봄
// 같은 쪽 차례인 장면끼리만 같을 수 있어서 2칸씩 건너뜀
function isRepetition(key: string, halfmoveClock: number): boolean {
  const n = path.length;
  for (let i = n - 2; i >= 0 && i >= n - halfmoveClock; i -= 2) {
    if (path[i] === key) return true;
  }
  return false;
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
  const ply = path.length - gameHistory.length; // 맨 위에서 몇 수째인지

  // 무승부 규칙: 같은 장면 반복, 50수, 메이트할 기물 부족 → 0점
  const key = positionKey(game);
  if (game.halfmoveClock >= 100 || isRepetition(key, game.halfmoveClock) || insufficientMaterial(game)) return 0;

  const checked = inCheck(game, game.turn);
  const moves = orderedMoves(game, ply); // 좋아 보이는 수부터 (잡는 수 → 킬러 수 → 나머지)

  if (moves.length === 0) {
    if (!checked) return 0;
    return game.turn === 'w' ? -(MATE + depth) : MATE + depth;
  }
  // 체크 연장: 체크당했으면 한 수 더 봄 (체크 다음에 결정적인 수가 오는 경우가 많아서)
  if (checked && ply < MAX_EXTEND_PLY) depth++;
  if (depth <= 0) return quiesce(game, alpha, beta); // 끝에서 바로 세지 않고, 잡는 싸움부터 마저 봄

  path.push(key);
  try {
    if (game.turn === 'w') {
      let best = -Infinity;
      for (const move of moves) {
        const undo = makeMove(game, move);
        best = Math.max(best, alphaBeta(game, depth - 1, alpha, beta));
        unmakeMove(game, move, undo);
        alpha = Math.max(alpha, best);
        if (alpha >= beta) {      // 흑이 이쪽으로 안 옴 → 나머지 수는 안 봄
          if (orderScore(game, move) === 0) addKiller(ply, move);
          break;
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (const move of moves) {
        const undo = makeMove(game, move);
        best = Math.min(best, alphaBeta(game, depth - 1, alpha, beta));
        unmakeMove(game, move, undo);
        beta = Math.min(beta, best);
        if (alpha >= beta) {      // 백이 이쪽으로 안 옴 → 나머지 수는 안 봄
          if (orderScore(game, move) === 0) addKiller(ply, move);
          break;
        }
      }
      return best;
    }
  } finally {
    path.pop();
  }
}

// 맨 위(지금 장면)에서 moves를 주어진 순서대로 depth수 앞까지 봄
// 돌려주는 것: 가장 좋은 점수와, 그 점수를 내는 수 전부
function searchRoot(game: GameState, depth: number, moves: Move[]): { best: number; bestMoves: Move[] } {
  path = gameHistory.slice(); // 탐색 경로는 실제 게임 기록에서 시작
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

// 탐색 시작 준비: 게임 기록을 받아 두고(없으면 지금 장면만), 킬러 수를 비움
function startSearch(game: GameState, history?: string[]) {
  gameHistory = history && history.length > 0 ? history.slice() : [positionKey(game)];
  killers = [];
}

// 알파-베타로 고른 가장 좋은 수 (깊이 고정, 테스트용). 같은 점수의 수가 여러 개면 그중 아무거나
export function alphaBetaMove(original: GameState, depth: number, history?: string[]): Move {
  const game = cloneGame(original); // 탐색은 복사본 위에서
  startSearch(game, history);
  return pickRandom(searchRoot(game, depth, orderedMoves(game)).bestMoves);
}

// 테스트용: depth수 앞까지 본 점수 (백 기준)
export function searchScore(original: GameState, depth: number, history?: string[]): number {
  const game = cloneGame(original);
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

// history: 실제 게임 장면 기록 (반복 무승부 판단용). timeLimit: 생각하는 AI가 쓸 시간(ms)
export function chooseMove(kind: AIKind, game: GameState, history?: string[], timeLimit = TIME_LIMIT): Move {
  if (kind === 'random') return randomMove(game);
  if (kind === 'greedy') return greedyMove(game);
  return iterativeMove(game, timeLimit, history);
}
