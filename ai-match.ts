/// <reference types="node" />

import { initialGame, type Color } from './src/board';
import { gameStatus, makeMove, positionKey } from './src/moves';
import { chooseMove, type AIKind } from './src/ai';

// 한 판 두고 결과 돌려주기: 'w' 승, 'b' 승, 'draw'
function playGame(white: AIKind, black: AIKind): Color | 'draw' {
  const game = initialGame();
  const history = [positionKey(game)];

  while (true) {
    const status = gameStatus(game, history);
    if (status === 'checkmate') return game.turn === 'w' ? 'b' : 'w'; // 둘 차례인 쪽이 짐
    if (status !== 'playing') return 'draw';

    const kind = game.turn === 'w' ? white : black;
    makeMove(game, chooseMove(kind, game));
    history.push(positionKey(game));
  }
}

const GAMES = 20; // 판 수 (백·흑을 번갈아 맡음)
let greedyWins = 0, randomWins = 0, draws = 0;

for (let i = 0; i < GAMES; i++) {
  const greedyIsWhite = i % 2 === 0;
  const result = greedyIsWhite ? playGame('greedy', 'random') : playGame('random', 'greedy');

  if (result === 'draw') draws++;
  else if ((result === 'w') === greedyIsWhite) greedyWins++;
  else randomWins++;

  process.stdout.write(`\r${i + 1}/${GAMES}판 진행 중...`);
}

console.log(`\n\n욕심쟁이 ${greedyWins}승 / 랜덤 ${randomWins}승 / 무승부 ${draws}`);