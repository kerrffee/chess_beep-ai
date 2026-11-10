import { initialGame } from './src/board';
import { legalMoves, makeMove } from './src/moves';
import { parsePGN, buildPGN, sansOf } from './src/pgn';

// PGN 읽기·쓰기 검사
const ok = (c: boolean, m: string) => console.log((c ? '✅ ' : '❌ ') + m);

// 1) 다른 사이트에서 받은 것 같은 PGN (주석, 변화수, 숫자 붙은 수, 0-0 표기 섞음)
const sample = `[Event "Casual"]
[White "Morphy"]
[Black "Duke"]
[Result "1-0"]

1.e4 e5 2. Nf3 d6 {필리도어} 3. d4 Bg4 (3... exd4 4. Nxd4) 4. dxe5 Bxf3 5. Qxf3 dxe5
6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. 0-0-0 Rd8
13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;
const g = parsePGN(sample);
if (typeof g === 'string') ok(false, '오페라 게임 읽기 실패: ' + g);
else {
  ok(g.moves.length === 33 && g.result === '1-0' && g.white === 'Morphy', `오페라 게임: ${g.moves.length}수, ${g.white} vs ${g.black}, ${g.result}`);
  ok(g.sans[g.sans.length - 1] === 'Rd8#' && g.sans.includes('O-O-O'), `마지막 수 ${g.sans[g.sans.length - 1]}, 0-0-0 → ${g.sans[22]}`);
}

// 2) 우리가 만든 PGN을 다시 읽으면 같은 수가 나와야 함 (무작위 대국 30판)
let same = 0;
for (let i = 0; i < 30; i++) {
  const pos = initialGame(); const moves = [];
  for (let ply = 0; ply < 60; ply++) {
    const ms = legalMoves(pos); if (!ms.length) break;
    const m = ms[Math.floor(Math.random() * ms.length)]; moves.push(m); makeMove(pos, m);
  }
  const sans = sansOf(initialGame(), moves);
  const back = parsePGN(buildPGN({ white: 'A', black: 'B', result: '*', sans, firstTurn: 'w' }));
  if (typeof back !== 'string' && JSON.stringify(back.moves) === JSON.stringify(moves)) same++;
}
ok(same === 30, `저장 → 다시 읽기: 30판 중 ${same}판 똑같음`);

// 3) 잘못된 기보는 어디가 문제인지 알려 줌
const bad = parsePGN('1. e4 e5 2. Ke3 Nc6');
ok(typeof bad === 'string', '잘못된 수 안내: ' + bad);
