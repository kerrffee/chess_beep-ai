import { fromFEN, initialGame, sq } from './src/board';
import { gameStatus, makeMove, positionKey, type Move } from './src/moves';

let ok = true;
function check(name: string, got: unknown, expected: unknown) {
  const mark = got === expected ? '✅' : '❌';
  if (got !== expected) ok = false;
  console.log(`${mark} ${name}: ${got} (기대 ${expected})`);
}

// 1. 50수 규칙 시계
const g = initialGame();
makeMove(g, { from: sq(6, 0), to: sq(5, 2) });   // 백 나이트 g1 → f3
check('나이트 이동 후 시계', g.halfmoveClock, 1);
makeMove(g, { from: sq(4, 6), to: sq(4, 4) });   // 흑 폰 e7 → e5
check('폰 이동 후 시계', g.halfmoveClock, 0);
check('시계 100인 배치', gameStatus(fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 100 1')), 'fifty');
check('시계 99인 배치', gameStatus(fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 99 1')), 'playing');

// 2. 3회 반복: 양쪽 나이트가 나갔다 들어오기를 두 번
const r = initialGame();
const history = [positionKey(r)];
const dance: Move[] = [
  { from: sq(6, 0), to: sq(5, 2) }, { from: sq(6, 7), to: sq(5, 5) },   // 나가기
  { from: sq(5, 2), to: sq(6, 0) }, { from: sq(5, 5), to: sq(6, 7) },   // 돌아오기
];
for (let round = 1; round <= 2; round++) {
  for (const m of dance) { makeMove(r, m); history.push(positionKey(r)); }
  check(`반복 ${round}바퀴 후`, gameStatus(r, history), round === 2 ? 'repetition' : 'playing');
}

// 3. 기물 부족
check('킹 vs 킹', gameStatus(fromFEN('4k3/8/8/8/8/8/8/4K3 w - - 0 1')), 'material');
check('킹+비숍 vs 킹', gameStatus(fromFEN('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1')), 'material');
check('킹+나이트 vs 킹', gameStatus(fromFEN('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1')), 'material');
check('같은 색 칸 비숍끼리', gameStatus(fromFEN('4kb2/8/8/8/8/8/8/2B1K3 w - - 0 1')), 'material');
check('다른 색 칸 비숍끼리', gameStatus(fromFEN('2b1k3/8/8/8/8/8/8/2B1K3 w - - 0 1')), 'playing');
check('킹+룩 vs 킹', gameStatus(fromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')), 'playing');
check('킹+폰 vs 킹', gameStatus(fromFEN('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1')), 'playing');

console.log(ok ? '\n전부 통과' : '\n실패한 항목이 있어요');