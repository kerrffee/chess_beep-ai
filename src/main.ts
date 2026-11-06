import './style.css';
import { initialGame, sq, type GameState } from './board';
import { movesFrom, inCheck, gameStatus, makeMove } from './moves';

const SYMBOLS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

const game: GameState = initialGame();
let selected: number | null = null;
let targets: number[] = [];

function statusText(): string {
  const status = gameStatus(game);
  const side = game.turn === 'w' ? '백' : '흑';
  const other = game.turn === 'w' ? '흑' : '백';

  if (status === 'checkmate') return `체크메이트! ${other} 승리`;
  if (status === 'stalemate') return '스테일메이트 — 무승부';
  return `${side} 차례` + (inCheck(game, game.turn) ? ' — 체크!' : '');
}

function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '';

  const checked = inCheck(game, game.turn);

  const info = document.createElement('div');
  info.className = 'info';
  info.textContent = statusText();
  app.appendChild(info);

  const boardEl = document.createElement('div');
  boardEl.className = 'board';

  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const index = sq(file, rank);
      const piece = game.board[index];

      const cell = document.createElement('div');
      const isLight = (file + rank) % 2 === 1;
      cell.className = 'square ' + (isLight ? 'light' : 'dark');

      if (index === selected) cell.classList.add('selected');
      if (targets.includes(index)) cell.classList.add(piece ? 'capture' : 'target');
      if (checked && piece && piece.type === 'k' && piece.color === game.turn) {
        cell.classList.add('check');
      }

      if (piece) cell.textContent = SYMBOLS[piece.color + piece.type];

      cell.addEventListener('click', () => onSquareClick(index));
      boardEl.appendChild(cell);
    }
  }
  app.appendChild(boardEl);

  // 다시 시작 버튼
  const restart = document.createElement('button');
  restart.className = 'restart';
  restart.textContent = '다시 시작';
  restart.addEventListener('click', () => {
    Object.assign(game, initialGame()); // 게임 상태를 처음으로 덮어쓰기
    select(null);
    render();
  });
  app.appendChild(restart);
}

function select(index: number | null) {
  selected = index;
  targets = index === null ? [] : movesFrom(game, index);
}

function onSquareClick(index: number) {
  if (gameStatus(game) !== 'playing') return; // 게임이 끝났으면 클릭 무시

  const piece = game.board[index];

  if (selected === null) {
    if (piece && piece.color === game.turn) select(index);
  } else if (index === selected) {
    select(null);
  } else if (piece && piece.color === game.turn) {
    select(index);
  } else if (targets.includes(index)) {
       makeMove(game, { from: selected, to: index });    select(null);
  } else {
    select(null);
  }

  render();
}

render();