import { fromFEN, initialGame, type GameState } from './src/board';
import { legalMoves, makeMove } from './src/moves';
import { evaluate } from './src/ai';

// 평가함수 v3 항목별 검사: 하나만 다른 두 장면을 비교해서, 그 항목 때문에 점수가 맞는 쪽으로 움직이는지
const ev = (fen: string) => evaluate(fromFEN(fen));
function check(label: string, better: string, worse: string) {
  const a = ev(better), b = ev(worse);
  console.log(`${a > b ? '✅' : '❌'} ${label}: ${a} > ${b}`);
}
check('겹친 폰은 손해 (백 폰 c2·d2 vs c2·c3)',
  '4k3/8/8/8/8/8/2PP4/4K3 w - - 0 1', '4k3/8/8/8/8/2P5/2P5/4K3 w - - 0 1');
check('고립된 폰은 손해 (백 폰 b2·c2 vs a2·c2)',
  '4k3/p7/8/8/8/8/1PP5/4K3 w - - 0 1', '4k3/p7/8/8/8/8/P1P5/4K3 w - - 0 1');
check('통과한 폰은 이득 (흑 폰이 막는지 여부만 다름)',
  '4k3/p7/8/8/3P4/8/8/4K3 w - - 0 1', '4k3/3p4/8/8/3P4/8/8/4K3 w - - 0 1');
check('통과한 폰은 많이 나갈수록 이득 (d6 vs d4)',
  '4k3/8/3P4/8/8/8/8/4K3 w - - 0 1', '4k3/8/8/8/3P4/8/8/4K3 w - - 0 1');
check('비숍 두 개 보너스 (비숍+비숍 vs 비숍+나이트)',
  '4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1', '4k3/8/8/8/8/8/8/2B1KN2 w - - 0 1');
check('룩은 열린 세로줄이 좋음 (d줄 열림 vs 내 폰이 막음)',
  'rnbqkbnr/ppp1pppp/8/8/8/8/PPP1PPPP/3RK3 w - - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/3RK3 w - - 0 1');
check('중반 킹 앞 폰 방패 (g1 킹 앞 f2·g2·h2 vs g2·h2만 한 칸씩 전진)',
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQ1RK1 w kq - 0 1', 'rnbqkbnr/pppppppp/8/8/8/6PP/PPPPPP2/RNBQ1RK1 w kq - 0 1');

// 거울 검사: 무작위 장면을 위아래로 뒤집고 색을 바꾸면 점수 부호만 바뀌어야 함
function mirror(g: GameState): GameState {
  const board = new Array(64).fill(null);
  for (let s = 0; s < 64; s++) {
    const p = g.board[s];
    if (p) board[(7 - Math.floor(s / 8)) * 8 + (s % 8)] = { color: p.color === 'w' ? 'b' : 'w', type: p.type };
  }
  const c = g.castling;
  return { board, turn: g.turn === 'w' ? 'b' : 'w', castling: { wK: c.bK, wQ: c.bQ, bK: c.wK, bQ: c.wQ },
    enPassant: g.enPassant === null ? null : (7 - Math.floor(g.enPassant / 8)) * 8 + (g.enPassant % 8),
    halfmoveClock: g.halfmoveClock };
}
let n = 0, bad = 0;
for (let i = 0; i < 100; i++) {
  const g = initialGame();
  for (let ply = 0; ply < 60; ply++) {
    if (evaluate(g) !== -evaluate(mirror(g))) bad++;
    n++;
    const ms = legalMoves(g); if (!ms.length) break;
    makeMove(g, ms[Math.floor(Math.random() * ms.length)]);
  }
}
console.log(`${bad === 0 ? '✅' : '❌'} 거울 검사 ${n}장면: 어긋남 ${bad}개`);
