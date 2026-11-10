// ---------- 화면 조각 (여러 화면에서 같이 씀) ----------
// 체스판, 기보 목록, 버튼, 고르기 상자를 만드는 함수들
import { sq, type Color, type GameState } from './board';
import { inCheck, type Move } from './moves';

// 끝에 붙인 ︎ = "그림 문자(이모지) 말고 글자 모양으로 그려 줘"
// 이게 없으면 아이폰 등에서 흑 폰(♟)이 색깔 있는 이모지로 나옴
const TEXT_STYLE = '︎';
export const SYMBOLS: Record<string, string> = Object.fromEntries(Object.entries({
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}).map(([key, symbol]) => [key, symbol + TEXT_STYLE]));

// 체스판 그리기. flipped면 흑이 아래. onClick이 없으면 누를 수 없는 판(다시 보기용)
export function drawBoard(game: GameState, opts: {
  flipped?: boolean; lastMove?: Move | null; selected?: number | null; targets?: number[];
  onClick?: (index: number) => void;
} = {}): HTMLElement {
  const boardEl = document.createElement('div');
  boardEl.className = 'board';
  const checked = inCheck(game, game.turn);
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = opts.flipped ? row : 7 - row;
      const file = opts.flipped ? 7 - col : col;
      const index = sq(file, rank);
      const piece = game.board[index];

      const cell = document.createElement('div');
      cell.className = 'square ' + ((file + rank) % 2 === 1 ? 'light' : 'dark');
      const last = opts.lastMove;
      if (last && (index === last.from || index === last.to)) cell.classList.add('last');
      if (index === opts.selected) cell.classList.add('selected');
      if (opts.targets?.includes(index)) cell.classList.add(piece ? 'capture' : 'target');
      if (checked && piece && piece.type === 'k' && piece.color === game.turn) cell.classList.add('check');
      if (piece) cell.textContent = SYMBOLS[piece.color + piece.type];
      if (opts.onClick) cell.addEventListener('click', () => opts.onClick!(index));
      boardEl.appendChild(cell);
    }
  }
  return boardEl;
}

// 기보: "1. e4  e5" 처럼 한 줄에 백·흑 한 수씩
// current = 강조할 수의 번호(0부터), onClick이 있으면 수를 눌러서 그 장면으로 갈 수 있음
export function drawMoveList(texts: string[], firstTurn: Color, opts: {
  current?: number; onClick?: (moveIndex: number) => void;
} = {}): HTMLElement {
  const box = document.createElement('div');
  box.className = 'moves';
  if (texts.length === 0) { box.textContent = '아직 둔 수가 없어요'; return box; }
  // 흑부터 시작한 게임이면 첫 줄 백 자리는 비워 둠
  const offset = firstTurn === 'b' ? 1 : 0;
  const total = texts.length + offset;
  for (let i = 0; i < total; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = `${i / 2 + 1}.`;
    row.appendChild(num);
    for (const slot of [i, i + 1]) {
      const span = document.createElement('span');
      const moveIndex = slot - offset;
      if (moveIndex >= 0 && moveIndex < texts.length) {
        span.textContent = texts[moveIndex];
        if (moveIndex === opts.current) span.classList.add('move-current');
        if (opts.onClick) {
          span.classList.add('move-click');
          span.addEventListener('click', () => opts.onClick!(moveIndex));
        }
      } else if (slot === 0 && offset === 1) {
        span.textContent = '…';
      }
      row.appendChild(span);
    }
    box.appendChild(row);
  }
  return box;
}

export function makeButton(text: string, onClick: () => void, disabled = false, className = 'restart'): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = text;
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

// 고르기 상자 하나 만들기 (바꾸면 onChange 실행)
export function makeSelect<T extends string | number>(
  className: string, options: { value: T; label: string }[], current: T, onChange: (v: T) => void,
): HTMLSelectElement {
  const box = document.createElement('select');
  box.className = className;
  options.forEach((o, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = o.label;
    option.selected = o.value === current;
    box.appendChild(option);
  });
  box.addEventListener('change', () => onChange(options[Number(box.value)].value));
  return box;
}

// 기보가 길어지면 마지막(또는 강조한) 수가 보이게 스크롤
export function scrollMoves(root: HTMLElement) {
  const list = root.querySelector<HTMLElement>('.moves');
  if (!list) return;
  const current = list.querySelector<HTMLElement>('.move-current');
  if (current) list.scrollTop = current.offsetTop - list.offsetTop - list.clientHeight / 2;
  else list.scrollTop = list.scrollHeight;
}
