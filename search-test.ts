import { fromFEN } from './src/board';
import { makeMove, positionKey } from './src/moves';
import { alphaBetaMove, iterativeMove, searchScore, stats } from './src/ai';

const name = (s: number) => 'abcdefgh'[s % 8] + (Math.floor(s / 8) + 1);

// 1) 반복 피하기: 백이 퀸 하나 더 있어서 이기는 중. 백 퀸 d1→d2를 두면 "전에 나온 장면"이 되게 기록을 만듦
//    → 이기는 쪽 AI는 그 수(무승부 0점)를 피해야 함
const win = fromFEN('4k3/8/8/8/8/8/8/3QK3 w - - 10 30');
const after = structuredClone(win);
makeMove(after, { from: 3, to: 11 }); // d1 → d2
const history = [positionKey(after), positionKey(win)]; // d2 장면이 이미 한 번 나왔던 것처럼
let repeated = 0;
for (let i = 0; i < 20; i++) {
  const m = alphaBetaMove(win, 3, history);
  if (m.from === 3 && m.to === 11) repeated++;
}
console.log(`반복 피하기: 20번 중 ${repeated}번 반복 수를 둠 (0이어야 함)`);
console.log(`  같은 수의 점수: 기록 없이 ${searchScore(after, 2)}, 반복이면 → 탐색에서 0점 처리`);

// 2) 체크 연장: 체크가 이어지는 메이트. 체크 연장이 없던 옛 코드는 깊이 2에서 이 메이트를 못 봤음(점수 2520)
//    체크당한 쪽에서 한 수씩 더 보니까, 깊이 2만 봐도 메이트까지 보임
const mate = fromFEN('6kb/pQ3N2/8/1B1rp2p/1P2Pn1R/4N3/2R3P1/2B3K1 w - - 0 1');
console.log(`체크 메이트 장면, 깊이 2 점수: ${searchScore(mate, 2)} (100000 이상이면 메이트를 봄)`);
const t = Date.now();
const m = iterativeMove(mate, 1000);
console.log(`같은 장면, 1초 AI: ${name(m.from)}→${name(m.to)}, ${Date.now() - t}ms, ${stats.depth}수 앞에서 메이트를 찾고 멈춤`);
