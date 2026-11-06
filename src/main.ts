import './style.css';
import { initialGame, sq, type GameState } from './board';

const SYMBOLS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

const game: GameState = initialGame();
let selected: number | null = null; // 선택된 칸 번호, 없으면 null

function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '';

  // 누구 차례인지 표시
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

      const piece = game.board[index];
      if (piece) cell.textContent = SYMBOLS[piece.color + piece.type];

      cell.addEventListener('click', () => onSquareClick(index));
      boardEl.appendChild(cell);
    }
  }
  app.appendChild(boardEl);
}

function onSquareClick(index: number) {
  const piece = game.board[index];

  if (selected === null) {
    // 아직 선택 안 함: 내 차례 색의 기물만 선택 가능
    if (piece && piece.color === game.turn) selected = index;
  } else if (index === selected) {
    // 같은 칸을 다시 누름: 선택 취소
    selected = null;
  } else if (piece && piece.color === game.turn) {
    // 다른 내 기물을 누름: 선택 바꾸기
    selected = index;
  } else {
    // 빈 칸이나 상대 기물: 이동 (상대 기물이면 잡힘)
    game.board[index] = game.board[selected];
    game.board[selected] = null;
    selected = null;
    game.turn = game.turn === 'w' ? 'b' : 'w';
  }

  render(); // 바뀐 상태로 다시 그리기
}

render();