import './style.css';
import { initialGame, fromFEN, sq, cloneGame, type Color, type GameState, type PieceType } from './board';
import { movesFrom, inCheck, gameStatus, makeMove, legalMoves, positionKey, type Move } from './moves';
import { PERSONALITIES, findPersonality, type SpeechEvent } from './personality';

// 끝에 붙인 \uFE0E = "그림 문자(이모지) 말고 글자 모양으로 그려 줘"
// 이게 없으면 아이폰 등에서 흑 폰(♟)이 색깔 있는 이모지로 나옴
const TEXT_STYLE = '\uFE0E';
const SYMBOLS: Record<string, string> = Object.fromEntries(Object.entries({
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
}).map(([key, symbol]) => [key, symbol + TEXT_STYLE]));

// 상대 고르기: 사람(둘이서) 또는 성격 있는 AI (personality.ts의 id)
type Opponent = 'human' | string;
const OPPONENTS: { value: Opponent; label: string }[] = [
  ...PERSONALITIES.map(p => ({ value: p.id, label: p.name })),
  { value: 'human', label: '사람 (둘이서)' },
];
// 생각 시간이 정해져 있지 않은 성격(대가)이 한 수에 쓰는 시간
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
let opponent: Opponent = PERSONALITIES[0].id; // 처음엔 대가
let playerColor: Color = 'w';   // 내가 두는 색. AI는 반대 색 (사람끼리면 판 방향만 정함)
let thinkTime = 1000;
let aiTimer: number | null = null;

// 무르기용: 수를 두기 "전" 상태를 차곡차곡 쌓아 둠
let snapshots: { state: GameState; lastMove: Move | null }[] = [];
// 기보: 둔 수를 글자로 (예: e2-e4, e4xd5, O-O, e7-e8=Q, 체크면 +, 메이트면 #)
let moveTexts: string[] = [];
let firstTurn: Color = game.turn; // 처음 장면의 차례 (FEN으로 흑부터 시작할 수도 있어서)
let moveUcis: string[] = [];      // 둔 수를 "출발칸도착칸" 글자로 (AI의 오프닝 확인용)

// ---------- 대사와 기권 ----------
let speech = '';                  // AI가 지금 하고 있는 말 (말풍선)
let lastScore: number | null = null; // AI가 지난번에 본 형세 점수 (AI 입장). 크게 변하면 대사
let lowCount = 0;                 // 기권 기준보다 나쁜 점수가 몇 번 연속인지
let resigned: Color | null = null; // 기권한 쪽 색 (없으면 null)

// 상황별로 말할 확률 (매 수마다 말하면 시끄러워서)
const SPEAK_CHANCE: Record<SpeechEvent, number> = {
  start: 1, win: 1, lose: 1, draw: 1, resign: 1,
  good: 0.8, bad: 0.8, lost: 0.6, capture: 0.5, check: 0.5, winning: 0.15, losing: 0.2,
};

// 지금 상대(성격)가 그 상황의 대사 중 하나를 말함. 대사가 없거나 확률에 걸리지 않으면 false
function say(event: SpeechEvent): boolean {
  if (opponent === 'human') return false;
  const lines = findPersonality(opponent).lines?.[event];
  if (!lines || lines.length === 0 || Math.random() >= SPEAK_CHANCE[event]) return false;
  speech = lines[Math.floor(Math.random() * lines.length)];
  return true;
}

// 수를 두기 "전"에 그 수가 기물을 잡는 수인지
function isCapture(move: Move): boolean {
  const piece = game.board[move.from];
  return game.board[move.to] !== null || (piece?.type === 'p' && move.to === game.enPassant);
}

// 게임이 끝났으면 AI 입장에서 'win' / 'lose' / 'draw', 아니면 null
function endEvent(): SpeechEvent | null {
  const status = gameStatus(game, history);
  if (status === 'playing') return null;
  if (status === 'checkmate') return game.turn === aiColor() ? 'lose' : 'win'; // 둘 차례인 쪽이 짐
  return 'draw';
}

// 사람이 수를 둔 뒤 AI의 반응
function reactToHuman(captured: boolean) {
  if (opponent === 'human') return;
  const end = endEvent();
  if (end) { say(end); return; }
  if (captured) say('lost');
}

// AI가 수를 둔 뒤의 대사. score = 이번에 본 형세 점수 (AI 입장)
function reactToAI(captured: boolean, score: number | null) {
  const end = endEvent();
  if (end) { say(end); return; }
  if (captured && say('capture')) return;
  if (inCheck(game, game.turn) && say('check')) return;
  if (score !== null && lastScore !== null) {
    const change = score - lastScore;
    if (change >= 150 && say('good')) return;
    if (change <= -150 && say('bad')) return;
  }
  if (score !== null && score > 300 && say('winning')) return;
  if (score !== null && score < -300 && say('losing')) return;
  speech = ''; // 할 말이 없으면 말풍선을 비움
}

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
let aiBook = false;   // AI가 지난 수를 오프닝 목록에서 뒀는지

function makeWorker(): Worker {
  const w = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<{ id: number; move: Move; depth: number; score: number; book: boolean }>) =>
    onAIReply(e.data.id, e.data.move, e.data.depth, e.data.score, e.data.book);
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
  moveUcis.push(squareName(move.from) + squareName(move.to) + (move.promotion ?? ''));
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
  moveUcis = [];
  lastMove = null;
  aiDepth = 0;
  aiBook = false;
  resetSpeech();
  say('start');
  pendingPromotion = null;
  select(null);
  render();
}

function resetSpeech() {
  speech = '';
  lastScore = null;
  lowCount = 0;
  resigned = null;
}

// 무르기 (기권한 뒤에도 가능): AI와 둘 때는 AI 수 + 내 수를 함께 되돌려서 다시 내 차례로
// (AI가 생각 중이면 내 수 하나만 되돌림). 사람끼리면 한 수만
function undo() {
  if (snapshots.length === 0 && !resigned) return;
  stopAI();
  let plies = 1;
  if (opponent !== 'human' && game.turn === playerColor) plies = 2;
  if (resigned && game.turn !== aiColor()) plies = 0; // 기권만 취소하면 되는 경우
  plies = Math.min(plies, snapshots.length);
  if (plies === 0) { resetSpeech(); render(); return; }

  const snap = snapshots[snapshots.length - plies];
  snapshots.length -= plies;
  history.length -= plies;
  moveTexts.length -= plies;
  moveUcis.length -= plies;
  Object.assign(game, cloneGame(snap.state));
  lastMove = snap.lastMove;
  aiDepth = 0;
  aiBook = false;
  resetSpeech();
  pendingPromotion = null;
  select(null);
  render();
}

// 지금 AI가 둘 차례인지
function isAITurn(): boolean {
  return opponent !== 'human' && !resigned && game.turn === aiColor() && gameStatus(game, history) === 'playing';
}

// AI 차례면 일꾼에게 지금 장면을 보내고 생각해 달라고 부탁함
function maybeAIMove() {
  if (!isAITurn() || aiBusy || aiTimer !== null) return;
  aiBusy = true;
  aiStart = Date.now();
  worker.postMessage({
    id: ++aiRequest, personalityId: opponent, game, history, timeLimit: thinkTime,
    moveHistory: startFEN ? undefined : moveUcis, // FEN으로 시작한 게임은 오프닝을 안 씀
  });
}

// 일꾼의 대답이 오면 둠. 다만 부탁한 지 AI_DELAY가 안 됐으면 그때까지 기다림
// (너무 빨리 두면 뭘 뒀는지 안 보여서)
function onAIReply(id: number, move: Move, depth: number, score: number, book: boolean) {
  if (id !== aiRequest) return; // 다시 시작·무르기 전에 한 부탁의 대답 → 버림
  aiBusy = false;
  const persona = findPersonality(opponent);
  // 생각해서 둔 수만 점수가 의미 있음 (랜덤·욕심쟁이·오프닝 목록 수는 점수 없음)
  const thought = persona.kind === 'search' && !book;
  const wait = Math.max(0, AI_DELAY - (Date.now() - aiStart));
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (!isAITurn()) return;
    // 기권: 점수가 기준보다 나쁜 게 2수 연속이면, 두지 않고 포기
    if (thought && persona.resignAt !== undefined) {
      lowCount = score < persona.resignAt ? lowCount + 1 : 0;
      if (lowCount >= 2) {
        resigned = aiColor();
        say('resign');
        render();
        return;
      }
    }
    const captured = isCapture(move);
    play(move);
    aiDepth = depth;
    aiBook = book;
    reactToAI(captured, thought ? score : null);
    if (thought) lastScore = score;
    render();
  }, wait);
}

function statusText(): string {
  if (resigned) {
    const who = resigned === aiColor() ? findPersonality(opponent).name : '나';
    return `${who} 기권! ${resigned === 'w' ? '흑' : '백'} 승리`;
  }
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
  const persona = opponent === 'human' ? null : findPersonality(opponent);
  if (persona && persona.kind === 'search' && persona.timeLimit === undefined) {
    // 생각 시간은 바꿔도 게임이 이어짐 (다음 수부터 적용)
    controls.appendChild(makeSelect('opponent', THINK_TIMES, thinkTime, v => { thinkTime = v; render(); }));
  }
  app.appendChild(controls);

  // 고른 상대의 성격 한 줄 설명
  const personaInfo = document.createElement('div');
  personaInfo.className = 'persona-info';
  personaInfo.textContent = persona ? persona.description : '한 화면에서 둘이 번갈아 둠';
  app.appendChild(personaInfo);

  const info = document.createElement('div');
  info.className = 'info';
  info.textContent = statusText();
  app.appendChild(info);

  // 생각하는 AI가 지난 수에서 몇 수 앞까지 봤는지
  const depthInfo = document.createElement('div');
  depthInfo.className = 'depth-info';
  depthInfo.textContent = aiBook ? 'AI가 좋아하는 오프닝으로 둠'
    : aiDepth > 0 ? `AI가 지난 수에서 ${aiDepth}수 앞까지 봄` : '';
  app.appendChild(depthInfo);

  // AI의 말풍선 (사람끼리 둘 때는 없음). 비어 있어도 자리를 지켜서 판이 들썩이지 않게
  if (persona) {
    const bubble = document.createElement('div');
    bubble.className = 'speech' + (speech ? '' : ' empty');
    const who = document.createElement('span');
    who.className = 'speaker';
    who.textContent = persona.name;
    const words = document.createElement('span');
    words.textContent = speech;
    bubble.append(who, words);
    app.appendChild(bubble);
  }

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
  undoBtn.disabled = snapshots.length === 0 && !resigned;
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
      const m: Move = { from: move.from, to: move.to, promotion: type };
      const captured = isCapture(m);
      play(m);
      reactToHuman(captured);
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
  if (gameStatus(game, history) !== 'playing' || resigned) return; // 게임이 끝났으면 클릭 무시
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
      const m: Move = { from: selected, to: index };
      const captured = isCapture(m);
      play(m);
      reactToHuman(captured);
      select(null);
    }
  } else {
    select(null);
  }

  render();
}

say('start'); // 처음 상대(대가)의 인사
render();
