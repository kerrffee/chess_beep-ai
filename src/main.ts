import './style.css';
import { initialGame, fromFEN, sq, cloneGame, type Color, type GameState, type PieceType } from './board';
import { movesFrom, inCheck, gameStatus, makeMove, legalMoves, positionKey, type Move } from './moves';
import type { AIKind } from './ai';

const SYMBOLS: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

// 상대 고르기: 사람(둘이서) 또는 AI
type Opponent = 'human' | AIKind;
const OPPONENTS: { value: Opponent; label: string }[] = [
  { value: 'human', label: '사람 (둘이서)' },
  { value: 'random', label: '랜덤 AI' },
  { value: 'greedy', label: '욕심쟁이 AI' },
  { value: 'minimax', label: '생각하는 AI' },
];
// 생각하는 AI가 한 수에 쓰는 시간
const THINK_TIMES: { value: number; label: string }[] = [
  { value: 500, label: '0.5초' },
  { value: 1000, label: '1초' },
  { value: 3000, label: '3초' },
];
const AI_DELAY = 500; // AI가 두기 전에 기다리는 최소 시간(ms). 너무 빠르면 뭘 뒀는지 안 보임

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
// 지금까지 나온 장면들 (3회 반복 판정용)
let history: string[] = [positionKey(game)];
// 마지막으로 둔 수 (화면에 표시용)
let lastMove: Move | null = null;
let opponent: Opponent = 'human';
let playerColor: Color = 'w';   // 내가 두는 색. AI는 반대 색 (사람끼리면 판 방향만 정함)
let thinkTime = 1000;
let aiTimer: number | null = null;

// 무르기용: 수를 두기 "전" 상태를 차곡차곡 쌓아 둠
let snapshots: { state: GameState; lastMove: Move | null }[] = [];
// 기보: 둔 수를 글자로 (예: e2-e4, e4xd5, O-O, e7-e8=Q, 체크면 +, 메이트면 #)
let moveTexts: string[] = [];
let firstTurn: Color = game.turn; // 처음 장면의 차례 (FEN으로 흑부터 시작할 수도 있어서)

function aiColor(): Color {
  return playerColor === 'w' ? 'b' : 'w';
}

// ---------- AI 일꾼(Web Worker) ----------
// AI 계산은 일꾼에게 맡기고, 화면은 계속 움직임
let worker = makeWorker();
let aiRequest = 0;    // 몇 번째 부탁인지 (다시 시작·무르기 뒤 도착한 옛 대답을 버리려고)
let aiBusy = false;   // 일꾼이 지금 생각 중인지
let aiStart = 0;      // 부탁한 시각
let aiDepth = 0;      // 생각하는 AI가 지난 수에서 끝까지 본 깊이 (0이면 표시 안 함)

function makeWorker(): Worker {
  const w = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<{ id: number; move: Move; depth: number }>) =>
    onAIReply(e.data.id, e.data.move, e.data.depth);
  return w;
}

// AI를 멈춤: 기다리던 타이머를 끄고, 생각 중이면 일꾼을 새로 만듦(하던 계산은 버림)
function stopAI() {
  if (aiTimer !== null) clearTimeout(aiTimer);
  aiTimer = null;
  if (aiBusy) {
    worker.terminate();
    worker = makeWorker();
  }
  aiBusy = false;
  aiRequest++; // 혹시 오는 옛 대답은 번호가 안 맞아서 무시됨
}

// ---------- 기보 글자 ----------
const FILES = 'abcdefgh';
function squareName(s: number): string {
  return FILES[s % 8] + (Math.floor(s / 8) + 1);
}

// 수를 두기 "전" 장면에서 그 수의 글자를 만듦 (체크·메이트 표시는 둔 뒤에 붙임)
function moveText(before: GameState, move: Move): string {
  const piece = before.board[move.from]!;
  if (piece.type === 'k' && Math.abs((move.to % 8) - (move.from % 8)) === 2) {
    return move.to % 8 === 6 ? 'O-O' : 'O-O-O'; // 캐슬링
  }
  const capture = before.board[move.to] !== null || (piece.type === 'p' && move.to === before.enPassant);
  const letter = piece.type === 'p' ? '' : piece.type.toUpperCase(); // 폰은 글자 없이
  let text = letter + squareName(move.from) + (capture ? 'x' : '-') + squareName(move.to);
  if (move.promotion) text += '=' + move.promotion.toUpperCase();
  return text;
}

// 수를 두고 장면 기록·무르기 기록·기보까지 남기는 함수. 화면에서는 이것만 씀
function play(move: Move) {
  snapshots.push({ state: cloneGame(game), lastMove });
  let text = moveText(game, move);
  makeMove(game, move);
  history.push(positionKey(game));
  lastMove = move;
  const status = gameStatus(game, history);
  if (status === 'checkmate') text += '#';
  else if (inCheck(game, game.turn)) text += '+';
  moveTexts.push(text);
}

function restart() {
  stopAI();
  Object.assign(game, newGame()); // 게임 상태를 처음으로 덮어쓰기
  firstTurn = game.turn;
  history = [positionKey(game)];
  snapshots = [];
  moveTexts = [];
  lastMove = null;
  aiDepth = 0;
  pendingPromotion = null;
  select(null);
  render();
}

// 무르기: AI와 둘 때는 AI 수 + 내 수를 함께 되돌려서 다시 내 차례로
// (AI가 생각 중이면 내 수 하나만 되돌림). 사람끼리면 한 수만
function undo() {
  if (snapshots.length === 0) return;
  stopAI();
  let plies = 1;
  if (opponent !== 'human' && game.turn === playerColor) plies = 2;
  plies = Math.min(plies, snapshots.length);

  const snap = snapshots[snapshots.length - plies];
  snapshots.length -= plies;
  history.length -= plies;
  moveTexts.length -= plies;
  Object.assign(game, cloneGame(snap.state));
  lastMove = snap.lastMove;
  aiDepth = 0;
  pendingPromotion = null;
  select(null);
  render();
}

// 지금 AI가 둘 차례인지
function isAITurn(): boolean {
  return opponent !== 'human' && game.turn === aiColor() && gameStatus(game, history) === 'playing';
}

// AI 차례면 일꾼에게 지금 장면을 보내고 생각해 달라고 부탁함
function maybeAIMove() {
  if (!isAITurn() || aiBusy || aiTimer !== null) return;
  aiBusy = true;
  aiStart = Date.now();
  worker.postMessage({ id: ++aiRequest, kind: opponent as AIKind, game, history, timeLimit: thinkTime });
}

// 일꾼의 대답이 오면 둠. 다만 부탁한 지 AI_DELAY가 안 됐으면 그때까지 기다림
// (너무 빨리 두면 뭘 뒀는지 안 보여서)
function onAIReply(id: number, move: Move, depth: number) {
  if (id !== aiRequest) return; // 다시 시작·무르기 전에 한 부탁의 대답 → 버림
  aiBusy = false;
  const wait = Math.max(0, AI_DELAY - (Date.now() - aiStart));
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (!isAITurn()) return;
    play(move);
    aiDepth = depth;
    render();
  }, wait);
}

function statusText(): string {
  const status = gameStatus(game, history);
  const side = game.turn === 'w' ? '백' : '흑';
  const other = game.turn === 'w' ? '흑' : '백';

  if (status === 'checkmate') return `체크메이트! ${other} 승리`;
  if (status === 'stalemate') return '스테일메이트 — 무승부';
  if (status === 'fifty') return '50수 동안 잡기·폰 이동 없음 — 무승부';
  if (status === 'repetition') return '같은 장면 3회 반복 — 무승부';
  if (status === 'material') return '메이트할 기물 부족 — 무승부';
  const check = inCheck(game, game.turn) ? ' — 체크!' : '';
  const thinking = isAITurn() ? ' (AI 생각 중…)' : '';
  return `${side} 차례${check}${thinking}`;
}

// 고르기 상자 하나 만들기 (바꾸면 onChange 실행)
function makeSelect<T extends string | number>(
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

function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '';

  const checked = inCheck(game, game.turn);

  // ① 맨 위: 상대 / 내 색 / 생각 시간 (상대나 색을 바꾸면 새 게임)
  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.appendChild(makeSelect('opponent', OPPONENTS, opponent, v => { opponent = v; restart(); }));
  controls.appendChild(makeSelect('opponent', [
    { value: 'w' as Color, label: '나: 백' },
    { value: 'b' as Color, label: '나: 흑' },
  ], playerColor, v => { playerColor = v; restart(); }));
  if (opponent === 'minimax') {
    // 생각 시간은 바꿔도 게임이 이어짐 (다음 수부터 적용)
    controls.appendChild(makeSelect('opponent', THINK_TIMES, thinkTime, v => { thinkTime = v; render(); }));
  }
  app.appendChild(controls);

  const info = document.createElement('div');
  info.className = 'info';
  info.textContent = statusText();
  app.appendChild(info);

  // 생각하는 AI가 지난 수에서 몇 수 앞까지 봤는지
  const depthInfo = document.createElement('div');
  depthInfo.className = 'depth-info';
  depthInfo.textContent = aiDepth > 0 ? `AI가 지난 수에서 ${aiDepth}수 앞까지 봄` : '';
  app.appendChild(depthInfo);

  // ② 가운데: 판 + 기보
  const middle = document.createElement('div');
  middle.className = 'middle';

  const boardEl = document.createElement('div');
  boardEl.className = 'board';
  // 내가 흑이면 판을 뒤집어서 내 기물이 아래에 오게
  const flipped = playerColor === 'b';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const rank = flipped ? row : 7 - row;
      const file = flipped ? 7 - col : col;
      const index = sq(file, rank);
      const piece = game.board[index];

      const cell = document.createElement('div');
      const isLight = (file + rank) % 2 === 1;
      cell.className = 'square ' + (isLight ? 'light' : 'dark');

      if (lastMove && (index === lastMove.from || index === lastMove.to)) cell.classList.add('last');
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
  middle.appendChild(boardEl);
  middle.appendChild(moveList());
  app.appendChild(middle);

  // ③ 아래: 무르기 / 다시 시작
  const buttons = document.createElement('div');
  buttons.className = 'controls';
  const undoBtn = document.createElement('button');
  undoBtn.className = 'restart';
  undoBtn.textContent = '무르기';
  undoBtn.disabled = snapshots.length === 0;
  undoBtn.addEventListener('click', undo);
  buttons.appendChild(undoBtn);

  const restartBtn = document.createElement('button');
  restartBtn.className = 'restart';
  restartBtn.textContent = '다시 시작';
  restartBtn.addEventListener('click', restart);
  buttons.appendChild(restartBtn);
  app.appendChild(buttons);

  if (pendingPromotion) app.appendChild(promotionPicker(pendingPromotion));

  // 기보는 항상 마지막 수가 보이게 맨 아래로
  const list = app.querySelector('.moves');
  if (list) list.scrollTop = list.scrollHeight;

  maybeAIMove();
}

// 기보: "1. e2-e4  e7-e5" 처럼 한 줄에 백·흑 한 수씩
function moveList(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'moves';
  // 흑부터 시작한 게임이면 첫 줄 백 자리는 "…"
  const texts = firstTurn === 'b' ? ['…', ...moveTexts] : moveTexts;
  for (let i = 0; i < texts.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';
    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = `${i / 2 + 1}.`;
    const w = document.createElement('span');
    w.textContent = texts[i];
    const b = document.createElement('span');
    b.textContent = texts[i + 1] ?? '';
    row.append(num, w, b);
    box.appendChild(row);
  }
  if (texts.length === 0) box.textContent = '아직 둔 수가 없어요';
  return box;
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
      play({ from: move.from, to: move.to, promotion: type });
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
  if (gameStatus(game, history) !== 'playing') return; // 게임이 끝났으면 클릭 무시
  if (pendingPromotion) return;                        // 고르는 중이면 판 클릭 무시
  if (isAITurn()) return;                              // AI 차례면 클릭 무시

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
      play({ from: selected, to: index });
      select(null);
    }
  } else {
    select(null);
  }

  render();
}

render();
