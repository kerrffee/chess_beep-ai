// ---------- 기보 다시 보기 화면 ----------
// PGN 파일을 불러오거나 리그에서 끝난 판을 골라, 한 수씩 앞뒤로 넘겨 봄
import { cloneGame, type GameState } from './board';
import { makeMove, type Move } from './moves';
import { parsePGN, type LoadedGame } from './pgn';
import { drawBoard, drawMoveList, makeButton, scrollMoves } from './view';

const state = {
  game: null as LoadedGame | null,
  index: 0,          // 지금 보여 주는 장면 = 처음부터 index수를 둔 뒤
  playing: false,    // 자동 재생 중인지
  error: '',
};
let timer: number | null = null;
const AUTO_DELAY = 800; // 자동 재생 한 수 간격(ms)

export function openGame(g: LoadedGame) {
  stopAuto();
  state.game = g;
  state.index = 0;
  state.error = '';
}

export function stopAuto() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  state.playing = false;
}

// 처음부터 index수를 둔 장면
function positionAt(g: LoadedGame, index: number): GameState {
  const pos = cloneGame(g.start);
  for (let i = 0; i < index; i++) makeMove(pos, g.moves[i]);
  return pos;
}

// 기보 파일 고르기 창 열기
function pickFile(rerender: () => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pgn,text/plain';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const result = parsePGN(await file.text());
    if (typeof result === 'string') { state.error = result; }
    else openGame(result);
    rerender();
  });
  input.click();
}

// drawPosition: 판 그리기 (주지 않으면 2D 판). 대국 화면이 3D면 3D 판을 그려 주는 함수를 넘겨줌
// viewButton: 2D/3D 전환 버튼 (대국 화면과 같은 설정을 씀)
export type PositionDrawer = (pos: GameState, lastMove: Move | null) => HTMLElement;
export function renderReplay(app: HTMLElement, rerender: () => void,
                             drawPosition?: PositionDrawer, viewButton?: HTMLElement) {
  const g = state.game;

  const top = document.createElement('div');
  top.className = 'controls';
  top.appendChild(makeButton('기보 불러오기 (.pgn)', () => pickFile(rerender)));
  if (viewButton) top.appendChild(viewButton);
  app.appendChild(top);

  const info = document.createElement('div');
  info.className = 'info';
  if (state.error) info.textContent = '불러오기 실패: ' + state.error;
  else if (!g) info.textContent = '저장한 기보(.pgn)를 불러오거나, 리그에서 "다시 보기"를 누르세요';
  else info.textContent = `${g.white}(백) vs ${g.black}(흑) · ${g.result.replace('1/2-1/2', '무승부')}`;
  app.appendChild(info);
  if (!g) return;

  const total = g.moves.length;
  const pos = positionAt(g, state.index);
  const sub = document.createElement('div');
  sub.className = 'depth-info';
  sub.textContent = state.index === 0 ? `처음 장면 (전체 ${total}수)` : `${total}수 중 ${state.index}번째: ${g.sans[state.index - 1]}`;
  app.appendChild(sub);

  const middle = document.createElement('div');
  middle.className = 'middle';
  const last = state.index > 0 ? g.moves[state.index - 1] : null;
  middle.appendChild(drawPosition ? drawPosition(pos, last) : drawBoard(pos, { lastMove: last }));
  const side = document.createElement('div');
  side.className = 'side';
  side.appendChild(drawMoveList(g.sans, g.start.turn, {
    current: state.index - 1,
    onClick: i => { stopAuto(); state.index = i + 1; rerender(); },
  }));
  middle.appendChild(side);
  app.appendChild(middle);

  // ⏮ ◀ ▶ ⏭ + 자동 재생
  const go = (i: number) => { state.index = Math.max(0, Math.min(total, i)); rerender(); };
  const nav = document.createElement('div');
  nav.className = 'controls';
  nav.append(
    makeButton('⏮', () => { stopAuto(); go(0); }, state.index === 0),
    makeButton('◀', () => { stopAuto(); go(state.index - 1); }, state.index === 0),
    makeButton(state.playing ? '■ 멈춤' : '▶ 자동', () => {
      if (state.playing) { stopAuto(); rerender(); return; }
      if (state.index >= total) state.index = 0;
      state.playing = true;
      timer = setInterval(() => {
        if (state.index >= total) { stopAuto(); rerender(); return; }
        go(state.index + 1);
      }, AUTO_DELAY);
      rerender();
    }),
    makeButton('▶', () => { stopAuto(); go(state.index + 1); }, state.index >= total),
    makeButton('⏭', () => { stopAuto(); go(total); }, state.index >= total),
  );
  app.appendChild(nav);
  scrollMoves(app);
}
