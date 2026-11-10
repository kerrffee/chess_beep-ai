/// <reference types="node" />

// AI끼리 대결
// 쓰는 법 (터미널):  npx tsx ai-match.ts <성격1> <성격2> <판 수> [생각 시간 ms]
//   예: npx tsx ai-match.ts master coward 4
//       npx tsx ai-match.ts master coward 4 100   ← 빨리 보고 싶을 때: 모든 생각하는 AI를 0.1초로
//   성격 id: master(대가), attacker(돌격대장), coward(겁쟁이), queenlover(퀸 사랑꾼),
//            bluffer(허세꾼), excuser(핑계왕), chaos(혼돈), greedy(욕심쟁이), random(랜덤)
//   백·흑은 한 판씩 번갈아 맡음
//   생각 시간을 적지 않으면 성격마다 정해진 시간(대가는 1초)
import { initialGame, type Color } from './src/board';
import { gameStatus, makeMove, positionKey } from './src/moves';
import { chooseMove, moveToUci } from './src/ai';
import { PERSONALITIES, type Personality } from './src/personality';

const [a = 'master', b = 'greedy', gamesArg = '4', msArg] = process.argv.slice(2);
const pick = (id: string): Personality => {
  const p = PERSONALITIES.find(x => x.id === id);
  if (!p) {
    console.log(`모르는 성격: ${id}. 가능한 값: ${PERSONALITIES.map(x => x.id).join(', ')}`);
    process.exit(1);
  }
  // 생각 시간을 적었으면 모든 생각하는 AI의 시간을 그걸로 맞춤
  return msArg ? { ...p, timeLimit: Number(msArg) } : p;
};
const p1 = pick(a), p2 = pick(b);
const GAMES = Number(gamesArg);

// 한 판 두고 결과 돌려주기: 'w' 승, 'b' 승, 무승부면 그 이유
function playGame(white: Personality, black: Personality): { result: Color | 'draw'; reason: string; moves: number } {
  const game = initialGame();
  const history = [positionKey(game)];
  const ucis: string[] = []; // 둔 수 목록 (성격별 오프닝용)
  let moves = 0;

  while (true) {
    const status = gameStatus(game, history);
    if (status === 'checkmate') return { result: game.turn === 'w' ? 'b' : 'w', reason: '체크메이트', moves }; // 둘 차례인 쪽이 짐
    if (status !== 'playing') return { result: 'draw', reason: status, moves };

    const p = game.turn === 'w' ? white : black;
    const move = chooseMove(p, game, history, undefined, ucis);
    makeMove(game, move);
    ucis.push(moveToUci(move));
    history.push(positionKey(game));
    moves++;
  }
}

const REASON: Record<string, string> = {
  stalemate: '스테일메이트', fifty: '50수', repetition: '3회 반복', material: '기물 부족',
};

console.log(`${p1.name} vs ${p2.name}, ${GAMES}판${msArg ? `, 생각 시간 ${msArg}ms` : ''}\n`);
let win1 = 0, win2 = 0, draws = 0;
for (let i = 0; i < GAMES; i++) {
  const p1White = i % 2 === 0;
  const { result, reason, moves } = p1White ? playGame(p1, p2) : playGame(p2, p1);

  let text: string;
  if (result === 'draw') { draws++; text = `무승부 (${REASON[reason] ?? reason})`; }
  else if ((result === 'w') === p1White) { win1++; text = `${p1.name} 승 (${reason})`; }
  else { win2++; text = `${p2.name} 승 (${reason})`; }
  console.log(`${i + 1}판 (${p1White ? p1.name : p2.name}이 백): ${text}, ${Math.ceil(moves / 2)}수`);
}
console.log(`\n${p1.name} ${win1}승 / ${p2.name} ${win2}승 / 무승부 ${draws}`);
