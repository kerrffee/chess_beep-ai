import { initialGame } from './src/board';
import { legalMoves, makeMove, unmakeMove, positionKey } from './src/moves';
import { computeHash, hashFromKey, hashHi, hashLo } from './src/zobrist';

// 지문 검사: 무작위 대국 장면에서
// 1) 판에서 계산한 지문 = 이름표에서 계산한 지문
// 2) 이름표가 다르면 지문도 달라야 함 (같은 지문인데 다른 장면 = 충돌)
const seen = new Map<string, string>(); // 지문 → 이름표
let checked = 0, mismatch = 0, collisions = 0;
for (let g = 0; g < 200; g++) {
  const game = initialGame();
  for (let ply = 0; ply < 80; ply++) {
    const key = positionKey(game);
    computeHash(game); const a = `${hashHi},${hashLo}`;
    hashFromKey(key); const b = `${hashHi},${hashLo}`;
    if (a !== b) mismatch++;
    const prev = seen.get(a);
    if (prev !== undefined && prev !== key) collisions++;
    seen.set(a, key);
    checked++;
    const moves = legalMoves(game);
    if (moves.length === 0) break;
    makeMove(game, moves[Math.floor(Math.random() * moves.length)]);
  }
}
console.log(`지문 검사 ${checked}장면 (서로 다른 장면 ${seen.size}개): 판↔이름표 불일치 ${mismatch}, 충돌 ${collisions} (둘 다 0이어야 함)`);

// 3) 순서만 다르고 같은 장면 → 같은 지문 (전치표가 노리는 바로 그 경우)
const x = initialGame(), y = initialGame();
for (const m of [{ from: 6, to: 21 }, { from: 62, to: 45 }, { from: 1, to: 18 }]) makeMove(x, m);  // Nf3 Nf6 Nc3
for (const m of [{ from: 1, to: 18 }, { from: 62, to: 45 }, { from: 6, to: 21 }]) makeMove(y, m);  // Nc3 Nf6 Nf3
computeHash(x); const hx = `${hashHi},${hashLo}`;
computeHash(y); const hy = `${hashHi},${hashLo}`;
console.log(`순서만 다른 같은 장면: ${hx === hy ? '같은 지문 ✅' : '다른 지문 ❌'}`);
