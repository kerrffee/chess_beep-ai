// ---------- 대국 끝난 뒤 AI 복기 ----------
// 끝난 판의 장면을 하나씩 AI(기본 성격, 실수·취향 없음)에게 살펴보게 해서, 형세가 크게 나빠진 수를 짚어 줌
//
// 1) 장면 P0(처음) ~ Pn(끝)마다 형세 점수(백 입장)와 가장 좋은 수를 받음 (AI 일꾼 2~3개가 나눠서, 장면당 0.3초)
// 2) i번째 수를 둔 쪽 입장에서 "이길 확률"이 P(i) → P(i+1) 사이에 얼마나 떨어졌는지 봄
//    이길 확률 = 50 + 50 × (2 / (1 + e^(−0.00368 × 점수)) − 1)   (lichess와 같은 식, 점수는 1/100폰 단위)
//    점수 대신 이길 확률로 보는 이유: +15에서 +9가 된 건(어차피 이김) +1에서 −5가 된 것보다 훨씬 덜 아픔
// 3) 떨어진 만큼: 30 이상 큰 실수(??), 20 이상 실수(?), 10 이상 부정확(?!)
//    둔 수가 AI가 고른 가장 좋은 수와 같으면 0 (짧게 생각해서 생기는 점수 흔들림을 실수로 잡지 않게)
// 4) 정확도 = 수마다 103.17 × e^(−0.0435 × 떨어진 정도) − 3.17 (0~100)을 색별로 평균
import { cloneGame, type Color, type GameState } from './board';
import { legalMoves, makeMove, type Move } from './moves';
import { toSAN, squareName } from './notation';

export type Grade = 'blunder' | 'mistake' | 'inaccuracy';
export const GRADES: Record<Grade, { mark: string; name: string; min: number }> = {
  blunder: { mark: '??', name: '큰 실수', min: 30 },
  mistake: { mark: '?', name: '실수', min: 20 },
  inaccuracy: { mark: '?!', name: '부정확', min: 10 },
};

export type MoveReview = {
  ply: number;          // 몇 번째 수인지 (0부터)
  color: Color;         // 둔 쪽
  san: string;          // 둔 수 표기
  before: number;       // 두기 전 형세 (백 입장)
  after: number;        // 둔 뒤 형세 (백 입장)
  drop: number;         // 둔 쪽의 이길 확률이 떨어진 정도 (0~100)
  grade: Grade | null;
  bestSan: string | null; // AI가 고른 더 좋은 수 (둔 수와 같으면 null)
};

export const review = {
  key: '',                                 // 어떤 판을 복기했는지 (판이 바뀌면 지난 결과는 버림)
  status: 'idle' as 'idle' | 'running' | 'done',
  done: 0, total: 0,                       // 살펴본 장면 수 / 전체
  scores: [] as number[],                  // 장면마다 형세 (백 입장, P0 ~ Pn)
  moves: [] as MoveReview[],
  accuracy: { w: null, b: null } as Record<Color, number | null>,
};

export const THINK_MS = 300;    // 장면 하나에 생각하는 시간
const CLAMP = 1500;             // 메이트 점수는 ±15폰으로 잘라서 계산 (이길 확률 거의 100%)
export const MATE_LIKE = 90000; // 이보다 크면 메이트 점수

let listener = () => {};
export function onReviewChange(fn: () => void) { listener = fn; }

let workers: Worker[] = [];
let run = 0; // 몇 번째 복기인지 (그만둔 복기의 늦은 대답을 버리려고)

// 판을 알아보는 열쇠: 처음 장면 + 둔 수 전부
export const keyFor = (firstKey: string, ucis: string[]) => firstKey + '|' + ucis.join(' ');

const uciOf = (m: Move) => squareName(m.from) + squareName(m.to) + (m.promotion ?? '');
const winPct = (cp: number) => {
  const c = Math.max(-CLAMP, Math.min(CLAMP, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
};

export function stopReview() {
  run++;
  for (const w of workers) w.terminate();
  workers = [];
  review.status = 'idle';
  review.key = '';
  review.done = review.total = 0;
  review.scores = [];
  review.moves = [];
  review.accuracy = { w: null, b: null };
}

// 복기 시작. start = 처음 장면, ucis = 둔 수, sans = 기보 표기, history = 장면 열쇠 목록(P0 ~ Pn, 반복 무승부 판단용)
export function startReview(key: string, start: GameState, ucis: string[], sans: string[], history: string[]) {
  stopReview();
  const myRun = run;
  // 장면 P0 ~ Pn 만들기 (+ 수마다 Move)
  const positions: GameState[] = [cloneGame(start)];
  const moves: Move[] = [];
  for (const u of ucis) {
    const pos = cloneGame(positions[positions.length - 1]);
    const m = legalMoves(pos).find(x => uciOf(x) === u);
    if (!m) break; // 있을 수 없지만, 혹시 어긋나면 거기까지만
    moves.push(m);
    makeMove(pos, m);
    positions.push(pos);
  }
  review.key = key;
  review.status = 'running';
  review.total = positions.length;
  const scores: (number | null)[] = positions.map(() => null);
  const bests: (string | null)[] = positions.map(() => null);

  let next = 0;
  const count = Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
  const give = (w: Worker) => {
    if (next >= positions.length) return;
    const i = next++;
    w.postMessage({ type: 'analyze', id: i, game: positions[i], history: history.slice(0, i + 1), timeLimit: THINK_MS });
  };
  for (let k = 0; k < count; k++) {
    const w = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent) => {
      if (run !== myRun || e.data.type !== 'analysis') return;
      const i = e.data.id as number;
      if (scores[i] === null) review.done++;
      scores[i] = e.data.score;
      bests[i] = e.data.best;
      if (review.done === positions.length) finish(positions, moves, sans, scores as number[], bests);
      else give(w);
      listener();
    };
    workers.push(w);
    give(w);
  }
  listener();
}

function finish(positions: GameState[], moves: Move[], sans: string[], scores: number[], bests: (string | null)[]) {
  for (const w of workers) w.terminate();
  workers = [];
  const out: MoveReview[] = [];
  const acc: Record<Color, number[]> = { w: [], b: [] };
  moves.forEach((m, i) => {
    const pos = positions[i];
    const color = pos.turn;
    const sign = color === 'w' ? 1 : -1;
    const sameAsBest = bests[i] === uciOf(m);
    const drop = sameAsBest ? 0 : Math.max(0, winPct(sign * scores[i]) - winPct(sign * scores[i + 1]));
    const grade = (Object.keys(GRADES) as Grade[]).find(g => drop >= GRADES[g].min) ?? null;
    const bestMove = !sameAsBest && bests[i] ? legalMoves(pos).find(x => uciOf(x) === bests[i]) : undefined;
    out.push({
      ply: i, color, san: sans[i] ?? uciOf(m), before: scores[i], after: scores[i + 1], drop, grade,
      bestSan: bestMove ? toSAN(pos, bestMove) : null,
    });
    acc[color].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669)));
  });
  review.moves = out;
  review.scores = scores;
  review.accuracy = {
    w: acc.w.length ? acc.w.reduce((a, b) => a + b, 0) / acc.w.length : null,
    b: acc.b.length ? acc.b.reduce((a, b) => a + b, 0) / acc.b.length : null,
  };
  review.status = 'done';
}

// 형세를 사람이 읽는 글자로: +1.2 (백 유리), −0.8 (흑 유리), 메이트
export function scoreText(cp: number): string {
  if (Math.abs(cp) >= MATE_LIKE) return cp > 0 ? '백이 메이트' : '흑이 메이트';
  const v = cp / 100;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1);
}
