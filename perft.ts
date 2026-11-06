import { fromFEN, type GameState } from './src/board';
import { legalMoves, makeMove } from './src/moves';

// depth수 동안 나올 수 있는 경우의 수
function perft(game: GameState, depth: number): number {
  if (depth === 0) return 1;

  let count = 0;
  for (const move of legalMoves(game)) {
    const copy = structuredClone(game);
    makeMove(copy, move);
    count += perft(copy, depth - 1);
  }
  return count;
}

// [이름, FEN, 깊이 1, 2, 3...의 정답]
const tests: [string, string, number[]][] = [
  ['시작 배치',
   'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
   [20, 400, 8902]],
  ['Kiwipete (캐슬링·앙파상·프로모션 섞인 배치)',
   'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
   [48, 2039]],
  ['엔드게임 (앙파상 함정)',
   '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
   [14, 191, 2812]],
  ['프로모션 많은 배치',
   'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
   [6, 264, 9467]],
];

for (const [name, fen, answers] of tests) {
  console.log(`\n${name}`);
  answers.forEach((answer, i) => {
    const depth = i + 1;
    const start = Date.now();
    const result = perft(fromFEN(fen), depth);
    const ms = Date.now() - start;
    const mark = result === answer ? '✅' : '❌';
    console.log(`  ${mark} 깊이 ${depth}: ${result} (정답 ${answer}) ${ms}ms`);
  });
}