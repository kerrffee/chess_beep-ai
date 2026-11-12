import './style.css';
import { initialGame, type Color, type GameState, type PieceType } from './board';
import { makeMove, legalMoves, inCheck, gameStatus, type Move } from './moves';
import type { Board3D, CameraView } from './three/board3d';
import { playMoveSound, unlockAudio } from './sound';
import { reloadForNewVersion, isMissingChunk } from './reload';
import { findPersonality } from './personality';
import { squareName } from './notation';
import * as G from './game'; // 게임 진행 담당 (판 상태, 수 두기, AI, 대사 …)

import { SYMBOLS, drawBoard, drawMoveList, makeButton, makeSelect, scrollMoves } from './view';
import { downloadText, parsePGN, pgnFilename, sansOf } from './pgn';
import { renderLeague, type LeagueGame } from './league';
import { renderReplay, openGame, stopAuto } from './replay';

// ---------- 화면 고르기 (맨 위 탭) ----------
type Screen = 'play' | 'league' | 'replay';
let screen: Screen = 'play';
const SCREENS: { value: Screen; label: string }[] = [
  { value: 'play', label: '대국' },
  { value: 'league', label: '리그' },
  { value: 'replay', label: '기보 보기' },
];
function switchScreen(next: Screen) {
  if (next === screen) return;
  if (screen === 'play') G.stopAI();       // 대국 화면을 떠나면 AI 생각은 멈춤 (돌아오면 다시 생각함)
  if (screen === 'replay') stopAuto();   // 다시 보기 자동 재생도 멈춤
  screen = next;
  render();
}

// ---------- 2D / 3D 보기 ----------
// 3D 라이브러리(Three.js)와 모델은 용량이 커서, 처음 3D를 켤 때만 불러옴
// 고른 보기·테마는 브라우저에 기억해 둠 (다음에 들어와도 그대로)
const remember = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const keep = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* 저장 못 하면 그냥 넘어감 */ } };
let use3D = remember('chess.view', '3d') === '3d'; // 처음 오면 3D
let theme3D = remember('chess.theme', 'spotlight');
const VIEW_LIST: { value: CameraView; label: string }[] = [
  { value: 'seat', label: '시점: 앉아서' },
  { value: 'angle', label: '시점: 비스듬히' },
  { value: 'top', label: '시점: 위에서' },
];
let view3D = remember('chess.camera', 'seat') as CameraView;
if (!VIEW_LIST.some(v => v.value === view3D)) view3D = 'seat';
let board3D: Board3D | null = null;
let loading3D = false;
let error3D = '';
// 3D 대국 화면의 오른쪽 설정 판: 넓은 화면은 처음에 펼쳐 두고, 휴대폰은 접어 둠
let panelOpen = window.innerWidth > 760;
const THEME_LIST = [ // themes.ts의 THEMES와 같은 순서 (3D를 켜기 전에는 그 파일을 불러오지 않아서 따로 적음)
  { value: 'spotlight', label: '테마: 스포트라이트' },
  { value: 'minimal', label: '테마: 미니멀' },
  { value: 'fantasy', label: '테마: 판타지' },
];
// 예전에 고른 테마가 지금은 없으면(클래식·대리석은 지움) 기본 테마로
if (!THEME_LIST.some(t => t.value === theme3D)) theme3D = THEME_LIST[0].value;
// 체스 세트를 고를 수 있는 테마 (themes.ts의 pieceSets와 맞춤)
const SET_THEMES = ['spotlight'];
const PIECE_SET_LIST = [
  { value: 'marble', label: '체스 세트: 대리석' },
  { value: 'classic', label: '체스 세트: 클래식' },
];
let pieceSet3D = remember('chess.pieceSet', 'marble');
// '앉아서' 시점의 거리(앞뒤)와 눈높이. 설정 판의 슬라이더로 조절하고 브라우저에 저장
// 기본값 44·14 = 슬라이더 가운데. 저장 키는 기본값을 바꾸면서 새 이름으로 (예전에 저장한 30·8.4 근처 값이 새 기본값을 덮지 않게)
const SEAT_DEFAULT = { distance: 44, height: 14 };
const SEAT_RANGE = { distance: [29, 59], height: [4, 24] } as const;
let seatDistance = Number(remember('chess.seatDistance2', String(SEAT_DEFAULT.distance))) || SEAT_DEFAULT.distance;
let seatHeight = Number(remember('chess.seatHeight2', String(SEAT_DEFAULT.height))) || SEAT_DEFAULT.height;

// 이름 + 슬라이더 + 지금 값. 끄는 동안 바로바로 반영 (화면 전체를 다시 그리지 않아서 끌기가 끊기지 않음)
function makeSlider(label: string, min: number, max: number, step: number, value: number, onInput: (v: number) => void): HTMLElement {
  const box = document.createElement('label');
  box.className = 'slider';
  const name = document.createElement('span');
  name.textContent = label;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
  const shown = document.createElement('span');
  shown.className = 'slider-value';
  shown.textContent = value.toFixed(1);
  input.addEventListener('input', () => {
    const v = Number(input.value);
    shown.textContent = v.toFixed(1);
    onInput(v);
  });
  box.append(name, input, shown);
  return box;
}

// ---------- 효과음 ----------
let soundOn = remember('chess.sound', 'on') === 'on';
let heardMoves = 0; // 소리를 낸 수의 개수 (새 수가 생기면 그 수의 소리를 냄)
function toggleSound() {
  soundOn = !soundOn;
  keep('chess.sound', soundOn ? 'on' : 'off');
  render();
}
document.addEventListener('pointerdown', unlockAudio, { once: true });

// 수가 새로 둬졌으면 소리 (3D면 기물이 내려앉는 순간에 맞춰 조금 늦게)
function soundForNewMoves() {
  const count = G.moveTexts.length;
  if (count > heardMoves && soundOn) {
    const san = G.moveTexts[count - 1];
    if (use3D && board3D) setTimeout(() => playMoveSound(san), board3D.moveLandsIn()); // 기물이 내려앉는 순간
    else playMoveSound(san);
  }
  heardMoves = count; // 무르기로 줄어들면 그대로 따라감
}

function toggle3D() {
  use3D = !use3D;
  keep('chess.view', use3D ? '3d' : '2d');
  render();
}

// 3D 판 만들기 (처음 한 번만). 다 만들어지면 화면을 다시 그림
async function ensure3D() {
  if (board3D || loading3D) return;
  loading3D = true;
  try {
    const { createBoard3D } = await import('./three/board3d');
    // 판을 누르면 대국 화면일 때만 수를 둠 (기보 보기에서 누른 건 무시)
    board3D = await createBoard3D(i => { if (screen === 'play') G.onSquareClick(i); }, theme3D, pieceSet3D);
    board3D.setView(view3D);
    board3D.setSeat(seatDistance, seatHeight);
  } catch (err) {
    console.error(err);
    // 열어 둔 사이에 새 버전이 배포돼서 3D 파일을 못 찾은 거면, 새로고침해서 새 버전을 받음
    if (isMissingChunk(err) && reloadForNewVersion()) return;
    // 원인을 같이 보여 줌: 3D 그래픽(WebGL) 자체가 꺼져 있는지, 다른 문제인지
    let webgl = false;
    try { webgl = !!document.createElement('canvas').getContext('webgl2'); } catch { /* 확인 실패 = 없음 */ }
    const reason = err instanceof Error ? err.message : String(err);
    error3D = webgl
      ? `3D를 켜다가 문제가 생겼어요. (자세한 이유: ${reason})`
      : '3D를 켤 수 없어요. 이 브라우저에서 3D 그래픽(WebGL)이 꺼져 있어요. '
        + '크롬이면 설정 → 시스템 → "가능한 경우 그래픽 가속 사용"을 켜고 크롬을 다시 시작해 보세요.';
    use3D = false;
  }
  loading3D = false;
  render();
}

// 리그에서 끝난 판을 "기보 보기"로 열기
function openLeagueGame(g: LeagueGame) {
  const start = initialGame();
  const pos = initialGame();
  const moves: Move[] = [];
  for (const uci of g.ucis!) {
    const m = legalMoves(pos).find(x => squareName(x.from) + squareName(x.to) + (x.promotion ?? '') === uci)!;
    moves.push(m);
    makeMove(pos, m);
  }
  openGame({
    start, moves, sans: sansOf(start, moves), result: g.result!,
    white: findPersonality(g.white).name, black: findPersonality(g.black).name,
  });
  switchScreen('replay');
}
function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = '';
  // 3D 대국 화면이면 여백 없이 판이 화면 전체를 채움 (style.css의 body.full3d)
  document.body.classList.toggle('full3d', screen === 'play' && use3D);

  // 맨 위 탭: 대국 / 리그 / 기보 보기
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  for (const t of SCREENS) {
    tabs.appendChild(makeButton(t.label, () => switchScreen(t.value), false, 'tab' + (t.value === screen ? ' tab-on' : '')));
  }
  app.appendChild(tabs);

  if (screen === 'league') { renderLeague(app, render, openLeagueGame); return; }
  if (screen === 'replay') {
    // 기보 보기도 대국 화면과 같은 2D/3D 설정을 따름
    const drawer = use3D ? (pos: GameState, last: Move | null) => {
      if (!board3D) {
        ensure3D();
        const wait = document.createElement('div');
        wait.className = 'board3d board3d-loading';
        wait.textContent = '3D 판을 불러오는 중…';
        return wait;
      }
      board3D.setRightInset(0); // 기보 보기의 3D 판은 상자 안이라 가림막 없음
      board3D.update({
        game: pos, lastMove: last, selected: null, targets: [], flipped: false,
        inCheck: inCheck(pos, pos.turn), checkmate: gameStatus(pos, []) === 'checkmate',
      });
      return board3D.element;
    } : undefined;
    renderReplay(app, render, drawer, makeButton(use3D ? '2D로 보기' : '3D로 보기', toggle3D));
    return;
  }
  renderPlay(app);
}

// 대국 화면 (사람 vs AI, 사람끼리, AI 대결 구경)
function renderPlay(app: HTMLElement) {
  const watching = G.opponent === 'watch';

  // ① 고르기 상자들: 상대 / (내 색 또는 백·흑 AI) / 생각 시간
  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.appendChild(makeSelect('opponent', G.OPPONENTS, G.opponent, G.setOpponent));
  if (watching) {
    controls.appendChild(makeSelect('opponent', G.AI_LIST.map(o => ({ ...o, label: '백: ' + o.label })),
      G.watchAI.w, v => G.setWatchAI('w', v)));
    controls.appendChild(makeSelect('opponent', G.AI_LIST.map(o => ({ ...o, label: '흑: ' + o.label })),
      G.watchAI.b, v => G.setWatchAI('b', v)));
  } else {
    controls.appendChild(makeSelect('opponent', [
      { value: 'w' as Color, label: '나: 백' },
      { value: 'b' as Color, label: '나: 흑' },
    ], G.playerColor, G.setPlayerColor));
  }
  // 생각 시간이 정해져 있지 않은 AI(대가)가 있으면 시간 고르기
  const ais = (['w', 'b'] as Color[]).map(G.aiFor).filter((x): x is string => x !== null).map(findPersonality);
  if (ais.some(p => p.kind === 'search' && p.timeLimit === undefined)) {
    // 생각 시간은 바꿔도 게임이 이어짐 (다음 수부터 적용)
    controls.appendChild(makeSelect('opponent', G.THINK_TIMES, G.thinkTime, G.setThinkTime));
  }

  // 고른 상대의 성격 한 줄 설명
  const personaInfo = document.createElement('div');
  personaInfo.className = 'persona-info';
  personaInfo.textContent = G.opponent === 'human' ? '한 화면에서 둘이 번갈아 둠'
    : watching ? `${findPersonality(G.watchAI.w).name}(백) vs ${findPersonality(G.watchAI.b).name}(흑)`
    : findPersonality(G.opponent).description;

  const info = document.createElement('div');
  info.className = 'info';
  info.textContent = G.statusText();

  // 생각하는 AI가 지난 수에서 몇 수 앞까지 봤는지 (구경할 때는 해설)
  const depthInfo = document.createElement('div');
  depthInfo.className = 'depth-info';
  depthInfo.textContent = watching ? G.commentary
    : G.aiBook ? 'AI가 좋아하는 오프닝으로 둠'
    : G.aiDepth > 0 ? `AI가 지난 수에서 ${G.aiDepth}수 앞까지 봄` : '';

  // AI의 말풍선 (사람끼리 둘 때는 없음). 비어 있어도 자리를 지켜서 판이 들썩이지 않게
  let bubble: HTMLElement | null = null;
  if (G.opponent !== 'human') {
    bubble = document.createElement('div');
    bubble.className = 'speech' + (G.speech ? '' : ' empty');
    const who = document.createElement('span');
    who.className = 'speaker';
    who.textContent = G.speech ? G.speech.by : (watching ? '' : findPersonality(G.opponent).name);
    const words = document.createElement('span');
    words.textContent = G.speech ? G.speech.text : '';
    bubble.append(who, words);
  }

  // ② 판. 내가 흑이면 판을 뒤집어서 내 기물이 아래에 오게 (구경할 때는 항상 백이 아래)
  const flipped = !watching && G.playerColor === 'b';
  let boardEl: HTMLElement;
  if (use3D && board3D) {
    // 3D 판: 같은 상자를 계속 다시 붙여 씀 (새로 만들면 느려서)
    // 판 건너편 상대: 사람 vs AI일 때만 (AI 쪽 색 = 내 반대 색)
    const aiColor: Color = G.playerColor === 'w' ? 'b' : 'w';
    const mate = gameStatus(G.game, G.history) === 'checkmate';
    const opponent = watching || G.opponent === 'human' ? null : {
      id: G.opponent, color: aiColor,
      lost: (mate && G.game.turn === aiColor) || G.resigned === aiColor,
    };
    board3D.update({
      game: G.game, lastMove: G.lastMove, selected: G.selected, targets: G.targets, flipped,
      inCheck: inCheck(G.game, G.game.turn), checkmate: mate, opponent,
    });
    boardEl = board3D.element;
    // 넓은 화면에서 오른쪽 설정 판을 펴 두면, 판을 그 왼쪽 남은 자리 가운데로 (휴대폰은 아래에서 올라오는 시트라 그대로)
    board3D.setRightInset(panelOpen && window.innerWidth > 760 ? 280 : 0);
  } else if (use3D) {
    // 3D를 불러오는 중
    boardEl = document.createElement('div');
    boardEl.className = 'board3d board3d-loading';
    boardEl.textContent = '3D 판을 불러오는 중…';
    ensure3D();
  } else {
    boardEl = drawBoard(G.game, {
      flipped, lastMove: G.lastMove, selected: G.selected, targets: G.targets, onClick: G.onSquareClick,
    });
  }

  // 기보 + 형세 그래프
  const side = document.createElement('div');
  side.className = 'side';
  side.appendChild(drawMoveList(G.moveTexts, G.firstTurn));
  side.appendChild(scoreGraph());

  // ③ 버튼들
  const buttons = document.createElement('div');
  buttons.className = 'controls';
  if (watching) {
    buttons.appendChild(makeButton(G.paused ? '계속' : '일시 정지', G.togglePause));
  }
  buttons.appendChild(makeButton('무르기', G.undo, G.snapshots.length === 0 && !G.resigned));
  buttons.appendChild(makeButton('다시 시작', G.restart));
  buttons.appendChild(makeButton('기보 저장', downloadPGN, G.moveTexts.length === 0));
  buttons.appendChild(makeButton('기보 보기로 열기', openCurrentInReplay, G.moveTexts.length === 0));

  // ④ 보기: 2D/3D 전환, 소리, (3D일 때) 테마·시점
  const viewRow = document.createElement('div');
  viewRow.className = 'controls';
  viewRow.appendChild(makeButton(use3D ? '2D로 보기' : '3D로 보기', toggle3D));
  viewRow.appendChild(makeButton(soundOn ? '소리 끄기' : '소리 켜기', toggleSound));
  if (use3D) {
    viewRow.appendChild(makeSelect('opponent', THEME_LIST, theme3D, v => {
      theme3D = v;
      keep('chess.theme', v);
      board3D?.setTheme(v);
      render();
    }));
    if (SET_THEMES.includes(theme3D)) {
      viewRow.appendChild(makeSelect('opponent set-select', PIECE_SET_LIST, pieceSet3D, v => {
        pieceSet3D = v;
        keep('chess.pieceSet', v);
        board3D?.setPieceSet(v);
        render();
      }));
    }
    viewRow.appendChild(makeSelect('opponent view-select', VIEW_LIST, view3D, v => {
      view3D = v;
      keep('chess.camera', v);
      board3D?.setView(v);
      render();
    }));
    if (view3D === 'seat') {
      viewRow.appendChild(makeSlider('시야 앞뒤', SEAT_RANGE.distance[0], SEAT_RANGE.distance[1], 0.5, seatDistance, v => {
        seatDistance = v;
        keep('chess.seatDistance2', String(v));
        board3D?.setSeat(seatDistance, seatHeight);
      }));
      viewRow.appendChild(makeSlider('시야 높이', SEAT_RANGE.height[0], SEAT_RANGE.height[1], 0.2, seatHeight, v => {
        seatHeight = v;
        keep('chess.seatHeight2', String(v));
        board3D?.setSeat(seatDistance, seatHeight);
      }));
    }
  }
  let err: HTMLElement | null = null;
  if (error3D) {
    err = document.createElement('div');
    err.className = 'persona-info';
    err.textContent = error3D;
  }

  if (use3D) {
    // ── 3D: 판이 화면 전체. 상태·말풍선은 왼쪽 위에 작게, 나머지는 오른쪽 접이식 판(⚙)에 ──
    app.appendChild(boardEl);
    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.append(info, depthInfo);
    if (bubble) hud.appendChild(bubble);
    app.appendChild(hud);

    const toggle = makeButton(panelOpen ? '✕' : '⚙ 설정', () => { panelOpen = !panelOpen; render(); }, false, 'panel-toggle');
    app.appendChild(toggle);
    if (panelOpen) {
      const panel = document.createElement('div');
      panel.className = 'panel';
      panel.append(controls, personaInfo, buttons, viewRow);
      if (err) panel.appendChild(err);
      panel.appendChild(side);
      app.appendChild(panel);
    }
  } else {
    // ── 2D: 예전처럼 위에서 아래로 ──
    app.append(controls, personaInfo, info, depthInfo);
    if (bubble) app.appendChild(bubble);
    const middle = document.createElement('div');
    middle.className = 'middle';
    middle.append(boardEl, side);
    app.append(middle, buttons, viewRow);
    if (err) app.appendChild(err);
  }

  if (G.pendingPromotion) app.appendChild(promotionPicker());

  scrollMoves(app); // 기보는 항상 마지막 수가 보이게
  soundForNewMoves();

  G.maybeAIMove();
}

// 형세 그래프: 가운데 선 위 = 백 유리, 아래 = 흑 유리. ±8폰(800점)에서 잘림
const GRAPH_CLAMP = 800;
function scoreGraph(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'graph';
  const W = 200, H = 70; // 그림 좌표 (실제 크기는 CSS로 늘어남)
  const n = Math.max(G.scores.length, 20); // 수가 적어도 그래프가 한쪽에 몰리지 않게
  const points: string[] = [];
  G.scores.forEach((s, i) => {
    if (s === null) return;
    const v = Math.max(-GRAPH_CLAMP, Math.min(GRAPH_CLAMP, s));
    const x = ((i + 1) / n) * W;
    const y = H / 2 - (v / GRAPH_CLAMP) * (H / 2 - 4);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  wrap.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <rect x="0" y="0" width="${W}" height="${H / 2}" class="graph-white"></rect>
      <rect x="0" y="${H / 2}" width="${W}" height="${H / 2}" class="graph-black"></rect>
      <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" class="graph-mid"></line>
      ${points.length > 1 ? `<polyline points="${points.join(' ')}" class="graph-line"></polyline>` : ''}
      ${points.map(pt => { const [x, y] = pt.split(','); return `<circle cx="${x}" cy="${y}" r="1.6" class="graph-dot"></circle>`; }).join('')}
    </svg>
    <div class="graph-label">형세 (위: 백 유리 · 아래: 흑 유리)</div>`;
  return wrap;
}

// 기보 저장: PGN(체스 기보 표준 형식) 파일로 내려받기. 다른 체스 사이트·앱이나 "기보 보기"에서 열 수 있음
function downloadPGN() {
  downloadText(G.pgnText(), pgnFilename());
}

// 지금 대국을 파일 저장 없이 "기보 보기" 탭에서 바로 열기 (마지막 장면부터)
// 대국은 그대로 남아서, 대국 탭으로 돌아오면 이어서 둘 수 있음
function openCurrentInReplay() {
  const loaded = parsePGN(G.pgnText());
  if (typeof loaded === 'string') return; // 우리가 만든 PGN이라 실패할 일은 없음
  openGame(loaded, true);
  switchScreen('replay');
}

// 프로모션 고르기 창: 퀸·룩·비숍·나이트 + 취소
function promotionPicker(): HTMLElement {
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
    btn.textContent = SYMBOLS[G.game.turn + type];
    btn.addEventListener('click', () => G.choosePromotion(type));
    row.appendChild(btn);
  }
  box.appendChild(row);

  const cancel = document.createElement('button');
  cancel.className = 'restart';
  cancel.textContent = '취소';
  cancel.addEventListener('click', G.cancelPromotion);
  box.appendChild(cancel);

  backdrop.appendChild(box);
  return backdrop;
}

G.onChange(render); // 게임 상태가 바뀌면 화면을 다시 그림
// 창 너비가 휴대폰/넓은 화면 경계(760px)를 넘나들면 설정 판 배치가 바뀌니까 다시 그림
let wasWide = window.innerWidth > 760;
window.addEventListener('resize', () => { const wide = window.innerWidth > 760; if (wide !== wasWide) { wasWide = wide; render(); } });
// 테스트용: 3D 판을 몇 번 그렸는지 (가만히 있을 때 안 늘어나는지 확인)
Object.assign(window, { __chess3dRenders: () => board3D?.renderCount() ?? 0 });
render();
