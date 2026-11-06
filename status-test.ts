import { fromFEN } from './src/board';
import { gameStatus, inCheck } from './src/moves';

// [이름, FEN, 기대하는 결과]
const tests: [string, string, string][] = [
  ['스테일메이트 (퀸이 킹을 가둠, 흑 차례)',
   'k7/8/1Q6/8/8/8/8/7K b - - 0 1',
   'stalemate'],
  ['체크메이트 (바보 메이트, 백 차례)',
   'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
   'checkmate'],
  ['진행 중 (위와 같은 배치, 백 차례)',
   'k7/8/1Q6/8/8/8/8/7K w - - 0 1',
   'playing'],
];

for (const [name, fen, expected] of tests) {
  const game = fromFEN(fen);
  const result = gameStatus(game);
  const check = inCheck(game, game.turn) ? '체크 O' : '체크 X';
  const mark = result === expected ? '✅' : '❌';
  console.log(`${mark} ${name}: ${result} (${check}, 기대 ${expected})`);
}