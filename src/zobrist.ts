// ---------- Zobrist 해싱 ----------
// 장면 하나를 "지문 번호" 하나로 바꾸는 방법
// 1) (기물 종류 × 칸)마다, 차례마다, 캐슬링 권리마다, 앙파상 세로줄마다 무작위 번호를 하나씩 미리 정해 둠
// 2) 장면의 지문 = 그 장면에 "해당하는 번호들"을 전부 XOR(^)한 값
//    예: 백 킹 e1, 흑 킹 e8, 흑 차례 → 번호[백킹,e1] ^ 번호[흑킹,e8] ^ 번호[흑 차례]
// 같은 장면이면 항상 같은 지문, 다른 장면이면 거의 확실히 다른 지문이 나옴
// 자바스크립트 정수 비트 연산은 32비트라서, 32비트 두 개(hi, lo)를 붙여 64비트 지문으로 씀
// (64비트면 서로 다른 두 장면의 지문이 우연히 같을 확률이 무시할 만큼 작음)
import type { GameState } from './board';

// 항상 같은 무작위 번호가 나오게, 씨앗(seed)을 정해 둔 간단한 난수 생성기
function makeRandom(seed: number) {
  let a = seed >>> 0;
  return function next32(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) | 0;
  };
}
const next32 = makeRandom(20261110);

// 기물 12종(백 6 + 흑 6) × 64칸
const PIECE_INDEX: Record<string, number> = {
  wp: 0, wn: 1, wb: 2, wr: 3, wq: 4, wk: 5,
  bp: 6, bn: 7, bb: 8, br: 9, bq: 10, bk: 11,
};
const PIECE_HI = new Int32Array(12 * 64).map(() => next32());
const PIECE_LO = new Int32Array(12 * 64).map(() => next32());
const BLACK_HI = next32(), BLACK_LO = next32();                 // 흑 차례일 때
const CASTLE_HI = [next32(), next32(), next32(), next32()];      // K Q k q
const CASTLE_LO = [next32(), next32(), next32(), next32()];
const EP_HI = Array.from({ length: 8 }, () => next32());         // 앙파상 세로줄 a~h
const EP_LO = Array.from({ length: 8 }, () => next32());

// 계산 결과 (배열을 매번 새로 만들지 않으려고 변수 두 개에 담음)
export let hashHi = 0;
export let hashLo = 0;

// 앙파상 칸은 실제로 잡을 폰이 있을 때만 지문에 넣음 (positionKey와 같은 규칙)
function epCounts(game: GameState): boolean {
  const ep = game.enPassant;
  if (ep === null) return false;
  const f = ep % 8;
  const pawnRank = game.turn === 'w' ? Math.floor(ep / 8) - 1 : Math.floor(ep / 8) + 1;
  for (const df of [-1, 1]) {
    const nf = f + df;
    if (nf < 0 || nf > 7 || pawnRank < 0 || pawnRank > 7) continue;
    const p = game.board[pawnRank * 8 + nf];
    if (p && p.type === 'p' && p.color === game.turn) return true;
  }
  return false;
}

// 장면의 지문을 계산해서 hashHi, hashLo에 넣음
export function computeHash(game: GameState): void {
  let hi = 0, lo = 0;
  for (let s = 0; s < 64; s++) {
    const p = game.board[s];
    if (!p) continue;
    const i = PIECE_INDEX[p.color + p.type] * 64 + s;
    hi ^= PIECE_HI[i];
    lo ^= PIECE_LO[i];
  }
  if (game.turn === 'b') { hi ^= BLACK_HI; lo ^= BLACK_LO; }
  const c = game.castling;
  if (c.wK) { hi ^= CASTLE_HI[0]; lo ^= CASTLE_LO[0]; }
  if (c.wQ) { hi ^= CASTLE_HI[1]; lo ^= CASTLE_LO[1]; }
  if (c.bK) { hi ^= CASTLE_HI[2]; lo ^= CASTLE_LO[2]; }
  if (c.bQ) { hi ^= CASTLE_HI[3]; lo ^= CASTLE_LO[3]; }
  if (epCounts(game)) { hi ^= EP_HI[game.enPassant! % 8]; lo ^= EP_LO[game.enPassant! % 8]; }
  hashHi = hi;
  hashLo = lo;
}

// 화면이 보내 준 장면 이름표(positionKey 문자열)에서 바로 지문을 계산
// 이름표 모양: 64글자 배치 + " w " 또는 " b " + 캐슬링 글자들 + (있으면) " 앙파상칸번호"
export function hashFromKey(key: string): void {
  let hi = 0, lo = 0;
  for (let s = 0; s < 64; s++) {
    const ch = key[s];
    if (ch === '.') continue;
    const color = ch === ch.toUpperCase() ? 'w' : 'b';
    const i = PIECE_INDEX[color + ch.toLowerCase()] * 64 + s;
    hi ^= PIECE_HI[i];
    lo ^= PIECE_LO[i];
  }
  const [, turn, castling = '', ep] = key.slice(64).split(' ');
  if (turn === 'b') { hi ^= BLACK_HI; lo ^= BLACK_LO; }
  'KQkq'.split('').forEach((ch, i) => {
    if (castling.includes(ch)) { hi ^= CASTLE_HI[i]; lo ^= CASTLE_LO[i]; }
  });
  if (ep !== undefined && ep !== '') { const f = Number(ep) % 8; hi ^= EP_HI[f]; lo ^= EP_LO[f]; }
  hashHi = hi;
  hashLo = lo;
}
