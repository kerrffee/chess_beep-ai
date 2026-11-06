import './style.css';
import { initialGame, sq, type GameState } from './board';
import { movesFrom } from './moves';

const SYMBOLS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

const game: GameState = initialGame();
let selected: number | null = null;
let targets: number[] = []; // 선택한 기물이 갈 수 있는 칸들

function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '';

  const info = document.createElement('div');
  info.className = 'info';
  info.textContent = game.turn === 'w' ? '백 차례' : '흑 차례';
  app.appendChild(info);

  const boardEl = document.createElement('div');
  boardEl.className = 'board';

  for (let rank = 7; rank >= 0; rank--) {
    for (let file = 0; file < 8; file++) {
      const index = sq(file, rank);
      const cell = document.createElement('div');
      const isLight = (file + rank) % 2 === 1;
      cell.className = 'square ' + (isLight ? 'light' : 'dark');
      if (index === selected) cell.classList.add('selected');
      if (targets.includes(index)) cell.classList.add('target');

      const piece = game.board[index];
      if (piece) cell.textContent = SYMBOLS[piece.color + piece.type];

      cell.addEventListener('click', () => onSquareClick(index));
      boardEl.appendChild(cell);
    }
  }
  app.appendChild(boardEl);
}

function select(index: number | null) {
  selected = index;
  targets = index === null ? [] : movesFrom(game, index);
}

function onSquareClick(index: number) {
  const piece = game.board[index];

  if (selected === null) {
    if (piece && piece.color === game.turn) select(index);
  } else if (index === selected) {
    select(null);
  } else if (piece && piece.color === game.turn) {
    select(index);
  } else if (targets.includes(index)) {
    // 갈 수 있는 칸일 때만 이동
    game.board[index] = game.board[selected];
    game.board[selected] = null;
    select(null);
    game.turn = game.turn === 'w' ? 'b' : 'w';
  } else {
    // 못 가는 칸을 누르면 선택 취소
    select(null);
  }

  render();
}

render();