// ---------- 리그 화면 ----------
// 고른 성격들끼리 모두 한 번씩(또는 백·흑 바꿔 두 번씩) 붙여서 순위표를 만듦
// 여러 판을 동시에 돌리려고 일꾼(Web Worker)을 여러 개 씀 (컴퓨터 코어 수에 맞춰 최대 4개)
// 승점: 이기면 1, 비기면 0.5, 지면 0
import { PERSONALITIES, findPersonality } from './personality';
import { makeButton, makeSelect } from './view';

export interface LeagueGame {
  white: string; black: string;   // 성격 id
  result?: string;                // '1-0' | '0-1' | '1/2-1/2' (끝나기 전엔 없음)
  reason?: string;
  ucis?: string[];                // 둔 수 목록 (다시 보기용)
}

const TIMES = [
  { value: 50, label: '한 수 0.05초 (빠름)' },
  { value: 100, label: '한 수 0.1초' },
  { value: 300, label: '한 수 0.3초 (느림, 더 정확)' },
];
const ROUNDS = [
  { value: 1, label: '한 번씩 붙기' },
  { value: 2, label: '백·흑 바꿔 두 번씩' },
];

const state = {
  chosen: new Set(PERSONALITIES.filter(p => p.id !== 'random').map(p => p.id)), // 처음엔 랜덤만 빼고 전부
  timeLimit: 50,
  rounds: 1,
  games: [] as LeagueGame[],
  running: false,
};
let workers: Worker[] = [];
let nextGame = 0;     // 아직 일꾼에게 안 맡긴 첫 판 번호
let runId = 0;        // 멈춘 뒤 도착한 옛 결과를 버리려고

// 리그 시작: 대진표를 만들고, 일꾼마다 한 판씩 맡김
function start(rerender: () => void) {
  stop();
  const ids = PERSONALITIES.map(p => p.id).filter(id => state.chosen.has(id));
  const games: LeagueGame[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      // 한 번씩이면 백을 번갈아 맡게 (i+j가 짝수면 앞쪽이 백)
      if (state.rounds === 1) games.push((i + j) % 2 === 0 ? { white: ids[i], black: ids[j] } : { white: ids[j], black: ids[i] });
      else games.push({ white: ids[i], black: ids[j] }, { white: ids[j], black: ids[i] });
    }
  }
  state.games = games;
  state.running = true;
  nextGame = 0;
  const id = ++runId;
  const count = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  workers = Array.from({ length: count }, () => {
    const w = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent) => {
      if (id !== runId || e.data.type !== 'gameResult') return;
      Object.assign(state.games[e.data.id], { result: e.data.result, reason: e.data.reason, ucis: e.data.ucis });
      giveWork(w);
      if (state.games.every(g => g.result)) stop();
      rerender();
    };
    giveWork(w);
    return w;
  });
  rerender();
}

// 일꾼에게 다음 판 맡기기 (남은 판이 없으면 그냥 쉼)
function giveWork(w: Worker) {
  if (nextGame >= state.games.length) return;
  const g = state.games[nextGame];
  w.postMessage({ type: 'game', id: nextGame, white: g.white, black: g.black, timeLimit: state.timeLimit });
  nextGame++;
}

function stop() {
  workers.forEach(w => w.terminate());
  workers = [];
  state.running = false;
  runId++;
}

// 순위표: 승점 → 이긴 수 순서
function standings() {
  const rows = new Map<string, { id: string; points: number; w: number; d: number; l: number }>();
  for (const g of state.games) {
    for (const id of [g.white, g.black]) if (!rows.has(id)) rows.set(id, { id, points: 0, w: 0, d: 0, l: 0 });
    if (!g.result) continue;
    const white = rows.get(g.white)!, black = rows.get(g.black)!;
    if (g.result === '1-0') { white.points += 1; white.w++; black.l++; }
    else if (g.result === '0-1') { black.points += 1; black.w++; white.l++; }
    else { white.points += 0.5; black.points += 0.5; white.d++; black.d++; }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.w - a.w);
}

export function renderLeague(app: HTMLElement, rerender: () => void, openReplay: (g: LeagueGame) => void) {
  const box = document.createElement('div');
  box.className = 'league';

  // 참가자 고르기
  const picks = document.createElement('div');
  picks.className = 'league-picks';
  for (const p of PERSONALITIES) {
    const label = document.createElement('label');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = state.chosen.has(p.id);
    check.disabled = state.running;
    check.addEventListener('change', () => {
      if (check.checked) state.chosen.add(p.id); else state.chosen.delete(p.id);
      rerender();
    });
    label.append(check, ' ' + p.name);
    picks.appendChild(label);
  }
  box.appendChild(picks);

  // 설정 + 시작/멈춤
  const controls = document.createElement('div');
  controls.className = 'controls';
  const n = state.chosen.size;
  const totalGames = (n * (n - 1) / 2) * state.rounds;
  const timeBox = makeSelect('opponent', TIMES, state.timeLimit, v => { state.timeLimit = v; rerender(); });
  const roundBox = makeSelect('opponent', ROUNDS, state.rounds, v => { state.rounds = v; rerender(); });
  timeBox.disabled = roundBox.disabled = state.running;
  controls.append(timeBox, roundBox);
  if (state.running) controls.appendChild(makeButton('멈춤', () => { stop(); rerender(); }));
  else controls.appendChild(makeButton(`시작 (${totalGames}판)`, () => start(rerender), n < 2));
  box.appendChild(controls);

  // 진행 상황
  const done = state.games.filter(g => g.result).length;
  const info = document.createElement('div');
  info.className = 'info';
  info.textContent = state.games.length === 0 ? '참가할 성격을 고르고 시작을 누르세요'
    : state.running ? `진행 중… ${done} / ${state.games.length}판`
    : done === state.games.length ? `리그 끝! (${done}판)` : `멈춤 (${done} / ${state.games.length}판)`;
  box.appendChild(info);

  if (state.games.length > 0) {
    // 순위표
    const table = document.createElement('table');
    table.className = 'league-table';
    table.innerHTML = '<tr><th>순위</th><th>성격</th><th>승점</th><th>승</th><th>무</th><th>패</th></tr>';
    standings().forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${findPersonality(r.id).name}</td><td>${r.points}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td>`;
      table.appendChild(tr);
    });
    box.appendChild(table);

    // 끝난 판 목록 (누르면 다시 보기)
    const list = document.createElement('div');
    list.className = 'league-games';
    state.games.forEach(g => {
      if (!g.result) return;
      const row = document.createElement('div');
      row.className = 'league-game';
      const plies = g.ucis!.length;
      row.textContent = `${findPersonality(g.white).name} ${g.result.replace('1/2-1/2', '½-½')} ${findPersonality(g.black).name} · ${g.reason}, ${Math.ceil(plies / 2)}수`;
      row.appendChild(makeButton('다시 보기', () => openReplay(g), false, 'small-btn'));
      list.appendChild(row);
    });
    box.appendChild(list);
  }
  app.appendChild(box);
}
