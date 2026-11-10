import { fromFEN, initialGame } from './src/board';
import { iterativeMove, stats } from './src/ai';

// 반복 심화 테스트: 1초 동안 몇 수 앞까지 보는지, 시간을 지키는지
const positions = [
  ['시작 배치', initialGame()],
  ['중반 배치', fromFEN('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4')],
  ['킹+폰 끝판', fromFEN('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1')],
] as const;
for (const [name, game] of positions) {
  stats.nodes = 0;
  const start = Date.now();
  const move = iterativeMove(structuredClone(game), 1000);
  console.log(`${name}: ${stats.depth}수 앞까지, ${Date.now() - start}ms, 장면 ${stats.nodes.toLocaleString()}개, 고른 수 ${move.from}→${move.to}`);
}

// 메이트 찾기: 백 퀸으로 한 수 만에 메이트 (퀸이 아래에서 7번째 줄로 가면 끝)
const mate = fromFEN('6k1/5ppp/8/8/8/8/8/3Q2K1 w - - 0 1');
const start = Date.now();
const m = iterativeMove(structuredClone(mate), 1000);
console.log(`1수 메이트: ${m.from}→${m.to} (59 = d8이면 정답), ${Date.now() - start}ms, ${stats.depth}수 앞에서 멈춤`);
