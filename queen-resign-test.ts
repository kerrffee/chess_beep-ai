// 퀸 사랑꾼의 "퀸이 먹힐 수밖에 없으면 기권"과 랜덤·욕심쟁이 형세 점수 확인
// 쓰는 법: npx tsx queen-resign-test.ts  (npm test에도 포함됨)
import { fromFEN, initialGame } from './src/board';
import { chooseMove, stats, scoreAfterMove } from './src/ai';
import { findPersonality } from './src/personality';
import { legalMoves } from './src/moves';

const fast = (id: string) => ({ ...findPersonality(id), timeLimit: 400 });
function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ` (${extra})` : ''}`);
}
function doomed(id: string, fen: string): boolean {
  chooseMove(fast(id), fromFEN(fen));
  return stats.queenDoomed;
}

// 1) 백 퀸이 e줄에서 킹에 핀됨. 흑 룩(e8)은 흑 킹이 지킴 → 퀸은 어디로 가도 먹힘
const pinned = '3kr3/8/8/8/8/8/4Q3/4K3 w - - 0 1';
check('핀으로 퀸이 갇힘 → 퀸 사랑꾼은 기권 판단', doomed('queenlover', pinned));
check('같은 장면, 대가는 기권 판단 안 함 (그 규칙이 없음)', !doomed('master', pinned));

// 2) 같은 장면에 나이트(c3)가 있어서 e4로 막을 수 있음 → 퀸을 지킬 수 있음
const blockable = '3kr3/8/8/8/8/2N5/4Q3/4K3 w - - 0 1';
check('나이트로 막을 수 있음 → 기권 안 함', !doomed('queenlover', blockable));

// 3) 그냥 시작 배치, 퀸이 이미 없는 장면 → 기권 안 함
check('시작 배치 → 기권 안 함', !doomed('queenlover', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'));
check('퀸이 이미 없음 → 기권 안 함', !doomed('queenlover', '3qk3/8/8/8/8/8/8/4K2R w - - 0 1'));

// 4) 퀸이 공격받지만 도망칠 칸이 있음 → 기권 안 함
check('퀸이 비숍에게 공격받지만 도망 가능 → 기권 안 함', !doomed('queenlover', 'k7/8/8/8/1b6/8/3Q4/4K3 w - - 0 1'));

// 5) 욕심쟁이·랜덤의 형세 점수
const g = initialGame();
const s0 = scoreAfterMove(g, legalMoves(g)[0]);
check('시작 배치 아무 수 → 점수가 작음', Math.abs(s0) < 150, `${s0}`);
// 흑 폰 d5를 백 퀸이 잡으면, 흑 퀸(d8)이 다시 잡음 → 욕심쟁이는 잡지만 점수는 크게 나쁨
const bait = fromFEN('3qk3/8/8/3p4/8/8/8/3QK3 w - - 0 1');
const greedy = chooseMove(findPersonality('greedy'), structuredClone(bait));
const gs = scoreAfterMove(bait, greedy);
check('욕심쟁이가 지켜진 폰을 퀸으로 잡음 → 점수가 크게 나쁨', gs < -500, `${gs}`);
// 공짜 룩을 잡으면 점수가 좋음
const free = fromFEN('4k3/8/8/3r4/8/8/8/3QK3 w - - 0 1');
const fs = scoreAfterMove(free, chooseMove(findPersonality('greedy'), structuredClone(free)));
check('공짜 룩을 잡음 → 점수가 좋음', fs > 300, `${fs}`);
