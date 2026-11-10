/// <reference types="node" />

// AI끼리 대결
// 쓰는 법 (터미널):  npx tsx ai-match.ts <AI1> <AI2> <판 수> <생각 시간 ms>
//   예: npx tsx ai-match.ts minimax greedy 10 200
//   AI 종류: random(랜덤), greedy(욕심쟁이), minimax(생각하는 AI)
//   백·흑은 한 판씩 번갈아 맡음. 생각 시간은 생각하는 AI에만 적용
import { initialGame, type Color } from './src/board';
import { gameStatus, makeMove, positionKey } from './src/moves';
import { chooseMove, type AIKind } from './src/ai';

const KINDS: AIKind[] = ['random', 'greedy', 'minimax'];
const [a = 'minimax', b = 'greedy', gamesArg = '10', msArg = '200'] = process.argv.slice(2);
if (!KINDS.includes(a as AIKind) || !KINDS.includes(b as AIKind)) {
  console.log(`AI 종류는 ${KINDS.join(', ')} 중에서 고르세요. 받은 값: ${a}, ${b}`);
  process.exit(1);
}
const ai1 = a as AIKind, ai2 = b as AIKind;
const GAMES = Number(gamesArg), MS = Number(msArg);

// 한 판 두고 결과 돌려주기: 'w' 승, 'b' 승, 무승부면 그 이유
function playGame(white: AIKind, black: AIKind): { result: Color | 'draw'; reason: string; moves: number } {
  const game = initialGame();
  const history = [positionKey(game)];
  let moves = 0;

  while (true) {
    const status = gameStatus(game, history);
    if (status === 'checkmate') return { result: game.turn === 'w' ? 'b' : 'w', reason: '체크메이트', moves }; // 둘 차례인 쪽이 짐
    if (status !== 'playing') return { result: 'draw', reason: status, moves };

    const kind = game.turn === 'w' ? white : black;
    makeMove(game, chooseMove(kind, game, history, MS));
    history.push(positionKey(game));
    moves++;
  }
}

const REASON: Record<string, string> = {
  stalemate: '스테일메이트', fifty: '50수', repetition: '3회 반복', material: '기물 부족',
};

console.log(`${ai1} vs ${ai2}, ${GAMES}판, 생각 시간 ${MS}ms\n`);
let win1 = 0, win2 = 0, draws = 0;
for (let i = 0; i < GAMES; i++) {
  const ai1White = i % 2 === 0;
  const { result, reason, moves } = ai1White ? playGame(ai1, ai2) : playGame(ai2, ai1);

  let text: string;
  if (result === 'draw') { draws++; text = `무승부 (${REASON[reason] ?? reason})`; }
  else if ((result === 'w') === ai1White) { win1++; text = `${ai1} 승 (${reason})`; }
  else { win2++; text = `${ai2} 승 (${reason})`; }
  console.log(`${i + 1}판 (${ai1White ? ai1 : ai2}이 백): ${text}, ${Math.ceil(moves / 2)}수`);
}
console.log(`\n${ai1} ${win1}승 / ${ai2} ${win2}승 / 무승부 ${draws}`);
