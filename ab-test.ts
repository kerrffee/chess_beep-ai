import { fromFEN, initialGame, type GameState } from './src/board';
import { legalMoves, makeMove } from './src/moves';
import { minimaxMove, alphaBetaMove, stats } from './src/ai';

// 같은 장면에서 두 방법이 같은 점수의 수를 고르는지, 일을 얼마나 했는지 비교
const positions: [string, GameState][] = [
  ['시작 배치', initialGame()],
  ['중반 배치', fromFEN('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4')],
  ['미끼 배치', fromFEN('3qk3/8/8/8/3P4/4P3/8/4K3 b - - 0 1')],
];

for (const [name, game] of positions) {
  console.log(`\n${name} (둘 수 있는 수 ${legalMoves(game).length}개)`);
  for (const depth of [2, 3]) {
    for (const [label, fn] of [['미니맥스', minimaxMove], ['알파-베타', alphaBetaMove]] as const) {
      if (label === '미니맥스' && depth === 3 && name === '중반 배치') {
        console.log(`  깊이 ${depth} ${label}: (너무 오래 걸려서 생략)`);
        continue;
      }
      stats.nodes = 0;
      const start = Date.now();
      const move = fn(structuredClone(game), depth);
      const ms = Date.now() - start;
      console.log(`  깊이 ${depth} ${label}: 장면 ${stats.nodes.toLocaleString()}개, ${ms}ms, 고른 수 ${move.from}→${move.to}`);
    }
  }
}
