import { fromFEN, initialGame } from './src/board';
import { alphaBetaMove, stats } from './src/ai';

// 1) 미끼 테스트: 흑 퀸이 d4 폰을 잡으면 e3 폰이 퀸을 다시 잡음
//    1수 앞만 보는 AI는 원래 "폰 하나 이득"으로 착각해서 미끼를 묾 (수평선 효과)
const bait = fromFEN('3qk3/8/8/8/3P4/4P3/8/4K3 b - - 0 1');
const D4 = 3 * 8 + 3; // 아래에서 4번째 줄, 왼쪽에서 4번째 칸
let bitten = 0;
for (let i = 0; i < 20; i++) {
  const move = alphaBetaMove(structuredClone(bait), 1);
  if (bait.board[move.from]?.type === 'q' && move.to === D4) bitten++;
}
console.log(`미끼 테스트 (1수 앞): 20번 중 ${bitten}번 미끼를 묾`);

// 2) 속도: 깊이 3에서 탐색한 장면 수와 시간
const positions = [
  ['시작 배치', initialGame()],
  ['중반 배치', fromFEN('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4')],
] as const;
for (const [name, game] of positions) {
  stats.nodes = 0;
  const start = Date.now();
  const move = alphaBetaMove(structuredClone(game), 3);
  console.log(`${name} 깊이 3: 장면 ${stats.nodes.toLocaleString()}개, ${Date.now() - start}ms, 고른 수 ${move.from}→${move.to}`);
}
