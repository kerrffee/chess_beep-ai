import './style.css';
import { initialGame, fromFEN, sq, type GameState, type PieceType } from './board';
import { movesFrom, inCheck, gameStatus, makeMove, legalMoves } from './moves';

const SYMBOLS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

// 테스트용: 주소 뒤에 ?fen=... 을 붙이면 그 배치로 시작
const startFEN = new URLSearchParams(location.search).get('fen');
function newGame(): GameState {
  return startFEN ? fromFEN(startFEN) : initialGame();
}

const game: GameState = newGame();
let selected: number | null = null;
let targets: number[] = [];
// 프로모션 고르는 중이면 그 수의 출발·도착 칸
let pendingPromotion: { from: number; to: number } | null = null;

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
    Object.assign(game, newGame()); // 게임 상태를 처음으로 덮어쓰기
    pendingPromotion = null;
    select(null);
    render();
  });
  app.appendChild(restart);

  if (pendingPromotion) app.appendChild(promotionPicker(pendingPromotion));
}

// 프로모션 고르기 창: 퀸·룩·비숍·나이트 + 취소
function promotionPicker(move: { from: number; to: number }): HTMLElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'promo-backdrop';

  const box = document.createElement('div');
  box.className = 'promo-box';

  const title = document.createElement('div');
  title.className = 'promo-title';
  title.textContent = '어떤 기물로 바꿀까요?';
  box.appendChild(title);

  const row = document.createElement('div');
  row.className = 'promo-row';
  for (const type of ['q', 'r', 'b', 'n'] as PieceType[]) {
    const btn = document.createElement('button');
    btn.className = 'promo-piece';
    btn.textContent = SYMBOLS[game.turn + type];
    btn.addEventListener('click', () => {
      makeMove(game, { from: move.from, to: move.to, promotion: type });
      pendingPromotion = null;
      select(null);
      render();
    });
    row.appendChild(btn);
  }
  box.appendChild(row);

  const cancel = document.createElement('button');
  cancel.className = 'restart';
  cancel.textContent = '취소';
  cancel.addEventListener('click', () => {
    pendingPromotion = null; // 수를 두지 않고 선택 상태로 돌아감
    render();
  });
  box.appendChild(cancel);

  backdrop.appendChild(box);
  return backdrop;
}

function select(index: number | null) {
  selected = index;
  targets = index === null ? [] : movesFrom(game, index);
}

// from → to 가 프로모션 수인지 (legalMoves가 promotion 붙은 수로 만들어 뒀는지)
function isPromotion(from: number, to: number): boolean {
  return legalMoves(game).some(m => m.from === from && m.to === to && m.promotion);
}

function onSquareClick(index: number) {
  if (gameStatus(game) !== 'playing') return; // 게임이 끝났으면 클릭 무시
  if (pendingPromotion) return;               // 고르는 중이면 판 클릭 무시

  const piece = game.board[index];

  if (selected === null) {
    if (piece && piece.color === game.turn) select(index);
  } else if (index === selected) {
    select(null);
  } else if (piece && piece.color === game.turn) {
    select(index);
  } else if (targets.includes(index)) {
    if (isPromotion(selected, index)) {
      pendingPromotion = { from: selected, to: index }; // 창을 띄우고 고를 때까지 기다림
    } else {
      makeMove(game, { from: selected, to: index });
      select(null);
    }
  } else {
    select(null);
  }

  render();
}

render();