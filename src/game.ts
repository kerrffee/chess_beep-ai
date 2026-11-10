// ---------- 게임 진행 ----------
// 2D 화면(main.ts)과 3D 화면이 같이 쓰는 "게임 진행 담당"
// 판 상태, 수 두기, 무르기, AI에게 부탁하기, 대사, 기권, 구경, 해설, 형세 점수를 모두 여기서 관리함
// 화면은 여기 있는 값을 읽어서 그리기만 하고, 사람이 무언가 하면 여기 함수를 부름
// 상태가 바뀌면 onChange로 등록한 함수(= 화면 다시 그리기)를 부름
import { initialGame, fromFEN, cloneGame, type Color, type GameState, type PieceType } from './board';
import { movesFrom, inCheck, gameStatus, makeMove, legalMoves, positionKey, type Move } from './moves';
import { PERSONALITIES, findPersonality, type SpeechEvent } from './personality';
import { toSAN, checkSuffix, squareName } from './notation';
import { buildPGN } from './pgn';
import { reloadForNewVersion } from './reload';

// 상태가 바뀌었을 때 부를 함수 (화면이 등록함)
let listener: () => void = () => {};
export function onChange(fn: () => void) { listener = fn; }
function notify() { listener(); }

export const PIECE_NAMES: Record<PieceType, string> = { p: '폰', n: '나이트', b: '비숍', r: '룩', q: '퀸', k: '킹' };

// 상대 고르기: 성격 있는 AI (personality.ts의 id), 사람(둘이서), AI끼리 구경
type Opponent = string | 'human' | 'watch';
export const OPPONENTS: { value: Opponent; label: string }[] = [
  ...PERSONALITIES.map(p => ({ value: p.id, label: p.name })),
  { value: 'human', label: '사람 (둘이서)' },
  { value: 'watch', label: 'AI 대결 구경' },
];
export const AI_LIST = PERSONALITIES.map(p => ({ value: p.id, label: p.name }));
// 생각 시간이 정해져 있지 않은 성격(대가)이 한 수에 쓰는 시간
export const THINK_TIMES: { value: number; label: string }[] = [
  { value: 500, label: '0.5초' },
  { value: 1000, label: '1초' },
  { value: 3000, label: '3초' },
];
// AI가 두기 전에 기다리는 최소 시간(ms). 너무 빠르면 뭘 뒀는지 안 보임. 구경할 때는 조금 더 천천히
export const AI_DELAY = 500;
export const WATCH_DELAY = 900;

// 테스트용: 주소 뒤에 ?fen=... 을 붙이면 그 배치로 시작
export const startFEN = new URLSearchParams(location.search).get('fen');
export function newGame(): GameState {
  return startFEN ? fromFEN(startFEN) : initialGame();
}

export const game: GameState = newGame();
export let selected: number | null = null;
export let targets: number[] = [];
// 프로모션 고르는 중이면 그 수의 출발·도착 칸
export let pendingPromotion: { from: number; to: number } | null = null;
// 지금까지 나온 장면들 (3회 반복 판정용)
export let history: string[] = [positionKey(game)];
// 마지막으로 둔 수 (화면에 표시용)
export let lastMove: Move | null = null;
export let opponent: Opponent = PERSONALITIES[0].id; // 처음엔 대가
export let playerColor: Color = 'w';   // 내가 두는 색. AI는 반대 색 (사람끼리면 판 방향만 정함)
export let watchAI: Record<Color, string> = { w: 'master', b: 'attacker' }; // 구경할 때 백·흑 AI
export let paused = false;             // 구경 일시 정지
export let thinkTime = 1000;
export let aiTimer: number | null = null;

// 무르기용: 수를 두기 "전" 상태를 차곡차곡 쌓아 둠
export let snapshots: { state: GameState; lastMove: Move | null }[] = [];
export let moveTexts: string[] = [];     // 기보: 표준 표기 (e4, Nf3, O-O …)
export let firstTurn: Color = game.turn; // 처음 장면의 차례 (FEN으로 흑부터 시작할 수도 있어서)
export let moveUcis: string[] = [];      // 둔 수를 "출발칸도착칸" 글자로 (AI의 오프닝 확인용)
// 형세 그래프: 수마다 AI가 본 형세 점수 (백 입장, +면 백 유리). 사람이 둔 수처럼 점수가 없으면 null
export let scores: (number | null)[] = [];
export let commentary = '';              // 구경할 때 해설 한 줄

// 그 색을 AI가 두면 성격 id, 사람이 두면 null
export function aiFor(color: Color): string | null {
  if (opponent === 'human') return null;
  if (opponent === 'watch') return watchAI[color];
  return color === playerColor ? null : opponent;
}
export const otherColor = (c: Color): Color => (c === 'w' ? 'b' : 'w');
export const colorName = (c: Color) => (c === 'w' ? '백' : '흑');

// ---------- 대사와 기권 ----------
export let speech: { text: string; by: string } | null = null; // 말풍선: 누가 무슨 말을
export let lastScore: Record<Color, number | null> = { w: null, b: null }; // 각 AI가 지난번에 본 점수 (자기 입장)
export let lowCount: Record<Color, number> = { w: 0, b: 0 };   // 기권 기준보다 나쁜 점수가 몇 번 연속인지
export let resigned: Color | null = null; // 기권한 쪽 색 (없으면 null)

// 상황별로 말할 확률 (매 수마다 말하면 시끄러워서)
export const SPEAK_CHANCE: Record<SpeechEvent, number> = {
  start: 1, win: 1, lose: 1, draw: 1, resign: 1,
  good: 0.8, bad: 0.8, lost: 0.6, capture: 0.5, check: 0.5, winning: 0.15, losing: 0.2,
};

// 성격 id인 AI가 그 상황의 대사 중 하나를 말함. 대사가 없거나 확률에 걸리지 않으면 false
export function say(event: SpeechEvent, id: string | null): boolean {
  if (!id) return false;
  const persona = findPersonality(id);
  const lines = persona.lines?.[event];
  if (!lines || lines.length === 0 || Math.random() >= SPEAK_CHANCE[event]) return false;
  speech = { text: lines[Math.floor(Math.random() * lines.length)], by: persona.name };
  return true;
}

// 게임 시작 인사: AI와 두면 그 AI, 구경이면 백 AI
export function greet() {
  if (opponent === 'watch') say('start', watchAI.w);
  else say('start', aiFor(otherColor(playerColor)));
}

// 수를 두기 "전"에 그 수가 잡는 기물 (없으면 null)
export function capturedPiece(move: Move): PieceType | null {
  const piece = game.board[move.from];
  const target = game.board[move.to];
  if (target) return target.type;
  if (piece?.type === 'p' && move.to === game.enPassant) return 'p';
  return null;
}

// 게임이 끝났으면 color 입장에서 'win' / 'lose' / 'draw', 아니면 null
export function endEventFor(color: Color): SpeechEvent | null {
  const status = gameStatus(game, history);
  if (status === 'playing') return null;
  if (status === 'checkmate') return game.turn === color ? 'lose' : 'win'; // 둘 차례인 쪽이 짐
  return 'draw';
}

// 사람이 수를 둔 뒤 상대 AI의 반응
export function reactToHuman(captured: boolean) {
  const aiColor = otherColor(playerColor);
  const id = aiFor(aiColor);
  if (!id) return;
  const end = endEventFor(aiColor);
  if (end) { say(end, id); return; }
  if (!(captured && say('lost', id))) speech = null;
}

// color 쪽 AI가 수를 둔 뒤의 대사. score = 이번에 본 형세 점수 (그 AI 입장)
export function reactToAI(color: Color, captured: boolean, score: number | null) {
  const id = aiFor(color)!;
  const rival = aiFor(otherColor(color)); // 상대도 AI면(구경) 상대가 대신 말할 수도 있음
  const end = endEventFor(color);
  if (end) {
    if (!say(end, id) && rival) say(endEventFor(otherColor(color))!, rival);
    return;
  }
  if (captured && (say('capture', id) || (rival && say('lost', rival)))) return;
  if (inCheck(game, game.turn) && say('check', id)) return;
  const last = lastScore[color];
  if (score !== null && last !== null) {
    const change = score - last;
    if (change >= 150 && say('good', id)) return;
    if (change <= -150 && say('bad', id)) return;
  }
  if (score !== null && score > 300 && say('winning', id)) return;
  if (score !== null && score < -300 && say('losing', id)) return;
  speech = null; // 할 말이 없으면 말풍선을 비움
}

// 구경할 때 해설 한 줄: 누가 무엇을 했는지 + 형세 변화
export function makeCommentary(color: Color, san: string, captured: PieceType | null, whiteScore: number | null) {
  const who = `${colorName(color)} ${findPersonality(aiFor(color)!).name}`;
  let text = `${who}: ${san}`;
  if (san.endsWith('#')) text += ' — 체크메이트!';
  else if (captured) text += ` — ${PIECE_NAMES[captured]}을(를) 잡음`;
  else if (san.endsWith('+')) text += ' — 체크!';
  // 형세가 크게 움직였으면 한마디
  const prev = [...scores].reverse().find(s => s !== null) ?? null;
  if (whiteScore !== null && prev !== null) {
    const change = whiteScore - prev;
    if (Math.abs(change) >= 200) text += ` (형세가 ${change > 0 ? '백' : '흑'} 쪽으로 크게 기울었어요)`;
  }
  commentary = text;
}

// ---------- AI 일꾼(Web Worker) ----------
// AI 계산은 일꾼에게 맡기고, 화면은 계속 움직임
export let worker = makeWorker();
export let aiRequest = 0;    // 몇 번째 부탁인지 (다시 시작·무르기 뒤 도착한 옛 대답을 버리려고)
export let aiBusy = false;   // 일꾼이 지금 생각 중인지
export let aiStart = 0;      // 부탁한 시각
export let aiDepth = 0;      // 생각하는 AI가 지난 수에서 끝까지 본 깊이 (0이면 표시 안 함)
export let aiBook = false;   // AI가 지난 수를 오프닝 목록에서 뒀는지

export function makeWorker(): Worker {
  const w = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<{ id: number; move: Move; depth: number; score: number; book: boolean }>) =>
    onAIReply(e.data.id, e.data.move, e.data.depth, e.data.score, e.data.book);
  // 일꾼 파일을 못 불러오면(열어 둔 사이에 새 버전이 배포됨) 새로고침해서 새 버전을 받음
  // (계산 중 오류는 메시지가 있고, 파일을 못 찾은 경우엔 메시지가 없음 → 그때만)
  w.onerror = e => { if (!e.message) reloadForNewVersion(); };
  return w;
}

// AI를 멈춤: 기다리던 타이머를 끄고, 생각 중이면 일꾼을 새로 만듦(하던 계산은 버림)
export function stopAI() {
  if (aiTimer !== null) clearTimeout(aiTimer);
  aiTimer = null;
  if (aiBusy) {
    worker.terminate();
    worker = makeWorker();
  }
  aiBusy = false;
  aiRequest++; // 혹시 오는 옛 대답은 번호가 안 맞아서 무시됨
}

// 수를 두고 장면 기록·무르기 기록·기보·형세 점수까지 남기는 함수. 화면에서는 이것만 씀
// whiteScore: 이 수를 둔 AI가 본 형세 (백 입장). 사람이 둔 수면 null
export function play(move: Move, whiteScore: number | null = null): string {
  snapshots.push({ state: cloneGame(game), lastMove });
  moveUcis.push(squareName(move.from) + squareName(move.to) + (move.promotion ?? ''));
  const text = toSAN(game, move);
  makeMove(game, move);
  history.push(positionKey(game));
  lastMove = move;
  const full = text + checkSuffix(game);
  moveTexts.push(full);
  scores.push(whiteScore);
  return full;
}

export function restart() {
  stopAI();
  Object.assign(game, newGame()); // 게임 상태를 처음으로 덮어쓰기
  firstTurn = game.turn;
  history = [positionKey(game)];
  snapshots = [];
  moveTexts = [];
  moveUcis = [];
  scores = [];
  commentary = '';
  lastMove = null;
  aiDepth = 0;
  aiBook = false;
  paused = false;
  resetSpeech();
  greet();
  pendingPromotion = null;
  select(null);
  notify();
}

export function resetSpeech() {
  speech = null;
  lastScore = { w: null, b: null };
  lowCount = { w: 0, b: 0 };
  resigned = null;
}

// 무르기 (기권한 뒤에도 가능)
// AI와 둘 때: AI 수 + 내 수를 함께 되돌려서 다시 내 차례로 (AI가 생각 중이면 내 수 하나만)
// 사람끼리: 한 수만. 구경할 때: 일시 정지하고 한 수만
export function undo() {
  if (snapshots.length === 0 && !resigned) return;
  stopAI();
  let plies = 1;
  if (opponent === 'watch') paused = true;
  else if (opponent !== 'human' && game.turn === playerColor) plies = 2;
  if (resigned && aiFor(game.turn) === null) plies = 0; // 기권만 취소하면 되는 경우
  if (opponent === 'watch' && resigned) plies = 0;
  plies = Math.min(plies, snapshots.length);
  if (plies === 0) { resetSpeech(); notify(); return; }

  const snap = snapshots[snapshots.length - plies];
  snapshots.length -= plies;
  history.length -= plies;
  moveTexts.length -= plies;
  moveUcis.length -= plies;
  scores.length -= plies;
  Object.assign(game, cloneGame(snap.state));
  lastMove = snap.lastMove;
  aiDepth = 0;
  aiBook = false;
  commentary = '';
  resetSpeech();
  pendingPromotion = null;
  select(null);
  notify();
}

// 지금 AI가 둘 차례인지
export function isAITurn(): boolean {
  if (resigned || gameStatus(game, history) !== 'playing') return false;
  if (opponent === 'watch' && paused) return false;
  return aiFor(game.turn) !== null;
}

// AI 차례면 일꾼에게 지금 장면을 보내고 생각해 달라고 부탁함
export function maybeAIMove() {
  if (!isAITurn() || aiBusy || aiTimer !== null) return;
  aiBusy = true;
  aiStart = Date.now();
  worker.postMessage({
    id: ++aiRequest, personalityId: aiFor(game.turn), game, history, timeLimit: thinkTime,
    moveHistory: startFEN ? undefined : moveUcis, // FEN으로 시작한 게임은 오프닝을 안 씀
  });
}

// 일꾼의 대답이 오면 둠. 다만 부탁한 지 최소 대기 시간이 안 됐으면 그때까지 기다림
export function onAIReply(id: number, move: Move, depth: number, score: number, book: boolean) {
  if (id !== aiRequest) return; // 다시 시작·무르기 전에 한 부탁의 대답 → 버림
  aiBusy = false;
  const color = game.turn;
  const persona = findPersonality(aiFor(color)!);
  // 생각해서 둔 수만 점수가 의미 있음 (랜덤·욕심쟁이·오프닝 목록 수는 점수 없음)
  const thought = persona.kind === 'search' && !book;
  const delay = opponent === 'watch' ? WATCH_DELAY : AI_DELAY;
  const wait = Math.max(0, delay - (Date.now() - aiStart));
  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (!isAITurn()) return;
    // 기권: 점수가 기준보다 나쁜 게 2수 연속이면, 두지 않고 포기
    if (thought && persona.resignAt !== undefined) {
      lowCount[color] = score < persona.resignAt ? lowCount[color] + 1 : 0;
      if (lowCount[color] >= 2) {
        resigned = color;
        say('resign', aiFor(color));
        if (opponent === 'watch') commentary = `${colorName(color)} ${persona.name} 기권!`;
        notify();
        return;
      }
    }
    const captured = capturedPiece(move);
    const whiteScore = thought ? (color === 'w' ? score : -score) : null;
    if (opponent === 'watch') {
      // 해설은 기보에 남기기 "전" 형세와 비교해야 해서, 둔 수의 표기를 미리 만듦
      const san = toSAN(game, move);
      const after = cloneGame(game);
      makeMove(after, move);
      makeCommentary(color, san + checkSuffix(after), captured, whiteScore);
    }
    play(move, whiteScore);
    aiDepth = depth;
    aiBook = book;
    reactToAI(color, captured !== null, thought ? score : null);
    if (thought) lastScore[color] = score;
    notify();
  }, wait);
}

export function statusText(): string {
  if (resigned) {
    const id = aiFor(resigned);
    const who = id ? findPersonality(id).name : '나';
    return `${who} 기권! ${colorName(otherColor(resigned))} 승리`;
  }
  const status = gameStatus(game, history);
  const side = colorName(game.turn);
  const other = colorName(otherColor(game.turn));

  if (status === 'checkmate') return `체크메이트! ${other} 승리`;
  if (status === 'stalemate') return '스테일메이트 — 무승부';
  if (status === 'fifty') return '50수 동안 잡기·폰 이동 없음 — 무승부';
  if (status === 'repetition') return '같은 장면 3회 반복 — 무승부';
  if (status === 'material') return '메이트할 기물 부족 — 무승부';
  const check = inCheck(game, game.turn) ? ' — 체크!' : '';
  if (opponent === 'watch' && paused) return `${side} 차례${check} (일시 정지)`;
  const thinking = isAITurn() ? ' (AI 생각 중…)' : '';
  return `${side} 차례${check}${thinking}`;
}


export function select(index: number | null) {
  selected = index;
  targets = index === null ? [] : movesFrom(game, index);
}

// from → to 가 프로모션 수인지 (legalMoves가 promotion 붙은 수로 만들어 뒀는지)
export function isPromotion(from: number, to: number): boolean {
  return legalMoves(game).some(m => m.from === from && m.to === to && m.promotion);
}

export function onSquareClick(index: number) {
  if (gameStatus(game, history) !== 'playing' || resigned) return; // 게임이 끝났으면 클릭 무시
  if (pendingPromotion) return;                        // 고르는 중이면 판 클릭 무시
  if (aiFor(game.turn) !== null) return;               // AI 차례면 클릭 무시 (구경할 때는 항상)

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
      const captured = capturedPiece(m) !== null;
      play(m);
      reactToHuman(captured);
      select(null);
    }
  } else {
    select(null);
  }

  notify();
}


// ---------- 화면에서 부르는 설정 바꾸기 ----------
// 상대·색·구경 AI를 바꾸면 새 게임, 생각 시간·일시 정지는 게임이 이어짐
export function setOpponent(v: Opponent) { opponent = v; restart(); }
export function setPlayerColor(v: Color) { playerColor = v; restart(); }
export function setWatchAI(color: Color, id: string) { watchAI = { ...watchAI, [color]: id }; restart(); }
export function setThinkTime(ms: number) { thinkTime = ms; notify(); }
export function togglePause() { paused = !paused; notify(); }

// 프로모션 창에서 기물을 골랐을 때 / 취소했을 때
export function choosePromotion(type: PieceType) {
  if (!pendingPromotion) return;
  const m: Move = { from: pendingPromotion.from, to: pendingPromotion.to, promotion: type };
  const captured = capturedPiece(m) !== null;
  play(m);
  reactToHuman(captured);
  pendingPromotion = null;
  select(null);
  notify();
}
export function cancelPromotion() {
  pendingPromotion = null; // 수를 두지 않고 선택 상태로 돌아감
  notify();
}

// 지금 게임의 PGN(기보 표준 형식) 글자
export function pgnText(): string {
  const status = gameStatus(game, history);
  let result = '*'; // 아직 진행 중
  if (resigned) result = resigned === 'w' ? '0-1' : '1-0';
  else if (status === 'checkmate') result = game.turn === 'w' ? '0-1' : '1-0';
  else if (status !== 'playing') result = '1/2-1/2';
  const nameOf = (c: Color) => { const id = aiFor(c); return id ? findPersonality(id).name : '사람'; };
  return buildPGN({ white: nameOf('w'), black: nameOf('b'), result, sans: moveTexts, firstTurn, fen: startFEN ?? undefined });
}

greet(); // 처음 상대(대가)의 인사
