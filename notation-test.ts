import { initialGame, fromFEN, type GameState } from './src/board';
import { legalMoves, makeMove } from './src/moves';
import { fullSAN, squareName } from './src/notation';

// 표준 기보 표기 검사
const ok = (c: boolean, m: string) => console.log((c ? '✅ ' : '❌ ') + m);
function play(g: GameState, ucis: string[]): string[] {
  return ucis.map(u => {
    const m = legalMoves(g).find(x => squareName(x.from) + squareName(x.to) + (x.promotion ?? '') === u)!;
    const text = fullSAN(g, m);
    makeMove(g, m);
    return text;
  });
}
const ruy = play(initialGame(), ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5c6', 'd7c6', 'e1g1']);
ok(ruy.join(' ') === 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O', '루이 로페즈: ' + ruy.join(' '));
const mate = play(initialGame(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
ok(mate.join(' ') === 'f3 e5 g4 Qh4#', '바보 메이트: ' + mate.join(' '));
ok(play(fromFEN('4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1'), ['b1d2'])[0] === 'Nbd2', '나이트 구별(세로줄): Nbd2');
ok(play(fromFEN('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1'), ['a1a3'])[0] === 'R1a3', '룩 구별(가로줄): R1a3');
ok(play(fromFEN('k7/4P3/8/8/8/8/8/4K3 w - - 0 1'), ['e7e8q'])[0] === 'e8=Q+', '프로모션+체크: e8=Q+');
