import { fromFEN, initialGame } from './src/board';
import { alphaBetaMove, evaluate } from './src/ai';

// 1) 대칭 검사: 시작 배치는 양쪽이 똑같으니 0점이어야 함
console.log(`시작 배치 점수: ${evaluate(initialGame())} (0이어야 함)`);

// 2) 거울 검사: 판을 위아래로 뒤집고 색을 바꾸면 점수 부호만 바뀌어야 함
const a = fromFEN('r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4');
const b = fromFEN('rnbqk2r/pppp1ppp/5n2/2b1p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R b KQkq - 4 4');
console.log(`거울 검사: ${evaluate(a)} 와 ${evaluate(b)} (부호만 반대여야 함)`);

// 3) 나이트 위치 비교: 가운데(아래에서 3번째 줄, 왼쪽에서 3번째) vs 구석(맨 아래 왼쪽)
const center = fromFEN('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1');
const corner = fromFEN('4k3/8/8/8/8/8/8/N3K3 w - - 0 1');
console.log(`나이트 가운데 ${evaluate(center)} > 구석 ${evaluate(corner)}`);

// 4) 시작 배치에서 생각하는 AI(3수 앞)가 첫 수로 무엇을 두는지 10번
const names = 'abcdefgh';
const name = (s: number) => names[s % 8] + (Math.floor(s / 8) + 1);
const counts: Record<string, number> = {};
for (let i = 0; i < 10; i++) {
  const g = initialGame();
  const m = alphaBetaMove(g, 3);
  const key = `${g.board[m.from]!.type} ${name(m.from)}→${name(m.to)}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log('시작 배치 첫 수 10번:', counts);
