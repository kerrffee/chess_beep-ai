// ---------- 친구와 온라인 1대1 ----------
// 서버 없이 두 브라우저를 직접 연결함 (WebRTC, PeerJS 라이브러리)
// · 방을 만든 쪽(방장)이 6글자 코드를 받음 → 친구는 링크(…/?room=코드)를 열거나 코드를 입력해서 들어옴
// · 처음 연결할 때만 PeerJS의 무료 공개 중계 서버(0.peerjs.com)가 "서로 주소 알려 주기"를 도와주고,
//   그 뒤 수는 두 브라우저끼리 직접 주고받음
// · 수를 보낼 때 지금까지의 수 전체(ucis)를 같이 보내서, 중간에 하나가 빠져도 받는 쪽이 판을 똑같이 맞춤
// · 친구가 새로고침·재접속해도 방장이 방을 열어 두고 있으면 다시 들어와서 이어 둠
// · 방장이 새로고침해도 방이 남음: 방 코드·지금 판·채팅을 이 탭(sessionStorage)에 기억해 뒀다가 같은 코드로 다시 엶.
//   친구 쪽은 연결이 끊기면 2초마다 자동으로 다시 들어가 봄 (1분 동안)
// · 채팅: 짧은 글을 주고받음 (최근 50개만 기억)
// PeerJS는 용량이 있어서 온라인을 처음 쓸 때만 불러옴
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Color } from './board';
import * as G from './game';
import { TURN_CREDENTIALS_URL, TURN_SERVERS } from './turnConfig';

// reopening = 방장이 새로고침한 뒤 같은 코드로 방을 다시 여는 중
// rejoining = 친구 쪽: 연결이 끊겨서 자동으로 다시 들어가 보는 중
export type OnlineStatus = 'idle' | 'creating' | 'reopening' | 'waiting' | 'joining' | 'rejoining' | 'connected' | 'lost' | 'error';

export let status: OnlineStatus = 'idle';
export let role: 'host' | 'guest' | null = null;
export let code = '';            // 방 코드 (대문자 6글자)
export let errorText = '';
export let gameNo = 0;           // 몇 번째 판인지 (다시 하기마다 +1, 옛 판의 메시지는 버림)
export let myRematch = false;    // 내가 "다시 하기"를 눌렀는지
export let peerRematch = false;  // 친구가 "다시 하기"를 눌렀는지
// 캐릭터: 내가 고른 것(친구 화면 건너편에 앉음) / 친구가 고른 것(내 화면 건너편에 앉음). 성격 id
// 내 캐릭터는 브라우저에 기억해 둠 (다음에 들어와도 그대로)
export let myChar = loadMyChar();
export let peerChar: string | null = null;
let hostColor: Color = 'w';      // 이번 판에서 방장이 두는 색 (다시 하기마다 바뀜)
let peer: Peer | null = null;
let conn: DataConnection | null = null;

// 주고받는 메시지
type Msg =
  | { t: 'hi'; char: string } // 친구 → 방장: 지금 판 보내 줘 (+ 친구 캐릭터)
  | { t: 'hello'; hostColor: Color; gameNo: number; ucis: string[]; resigned: Color | null; char: string } // 방장 → 친구: 지금 판 전부 (+ 방장 캐릭터)
  | { t: 'char'; char: string } // 캐릭터를 바꿈 (대국 중에도)
  | { t: 'move'; gameNo: number; ucis: string[] }
  | { t: 'resign'; gameNo: number; color: Color }
  | { t: 'rematch'; gameNo: number }
  | { t: 'emote'; id: string } // 감정표현 (EMOTES의 id)
  | { t: 'chat'; text: string }; // 채팅 한 줄

// ---------- 채팅 ----------
export type ChatLine = { mine: boolean; text: string; at: number };
export const CHAT_MAX_LEN = 200; // 한 번에 보낼 수 있는 글자 수
const CHAT_KEEP = 50;            // 기억해 두는 줄 수
export let chatLog: ChatLine[] = [];
export let chatReceived = 0;     // 친구 글을 지금까지 몇 개 받았는지 (화면이 새 글을 알아채려고)
function addChat(line: ChatLine) {
  chatLog.push(line);
  if (chatLog.length > CHAT_KEEP) chatLog = chatLog.slice(-CHAT_KEEP);
}
// 채팅 보내기. 보냈으면 true (연결 전이거나 빈 글이면 false)
export function sendChat(raw: string): boolean {
  const text = raw.trim().slice(0, CHAT_MAX_LEN);
  if (!text || !canPlay() || !conn?.open) return false;
  send({ t: 'chat', text });
  addChat({ mine: true, text, at: Date.now() });
  changed();
  return true;
}

// 감정표현: 버튼을 누르면 친구 화면에 말풍선이 뜨고, 친구 화면 건너편에 앉은 내 캐릭터가 반응함
// anim: 'captured' = 신난 반응(잡았을 때 동작), 'lostPiece' = 움찔 반응(잡혔을 때 동작), null = 말풍선만
export const EMOTES: { id: string; icon: string; text: string; anim: 'captured' | 'lostPiece' | null }[] = [
  { id: 'nice', icon: '👍', text: '잘 뒀다!', anim: 'captured' },
  { id: 'haha', icon: '😆', text: '하하!', anim: 'captured' },
  { id: 'oops', icon: '😱', text: '으악!', anim: 'lostPiece' },
  { id: 'hmm', icon: '🤔', text: '음…', anim: null },
];
export let peerEmote: { id: string; n: number } | null = null; // 친구가 마지막으로 보낸 감정표현 (n은 몇 번째인지)
let emoteCount = 0;
let lastEmoteSent = 0;

// PeerJS 아이디 = 앞말 + 코드. 앞말은 다른 사이트의 방과 겹치지 않게
const PREFIX = 'chess-beep-ai-';
// 헷갈리는 글자(0·O, 1·I·L)는 뺌
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
export function cleanCode(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

// 테스트용: 주소에 ?peerserver=localhost:9000 을 붙이면 공개 서버 대신 그 중계 서버를 씀
// TURN(turnConfig.ts)을 넣었으면 연결 방법 목록(iceServers)에 더함
async function peerOptions() {
  const custom = new URLSearchParams(location.search).get('peerserver');
  const iceServers = await turnServers();
  const opts: Record<string, unknown> = iceServers ? { config: { iceServers } } : {};
  if (!custom) return opts;
  const [host, port] = custom.split(':');
  return { ...opts, host, port: Number(port) || 9000, path: '/', secure: false };
}

// TURN 서버 목록을 한 번만 받아 둠 (못 받으면 TURN 없이: 직접 연결만)
let turnPromise: Promise<RTCIceServer[] | null> | null = null;
export let turnState: 'off' | 'on' | 'failed' = 'off'; // 화면에 짧게 표시
// 구글 STUN도 같이 (내 공개 주소 알아내기용, PeerJS 기본값에 있던 것)
const GOOGLE_STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };
// 붙여 넣은 목록(TURN_SERVERS)이 있으면 그것 (없으면 null)
function fixedServers(): RTCIceServer[] | null {
  if (TURN_SERVERS.length === 0) return null;
  turnState = 'on';
  return [GOOGLE_STUN, ...TURN_SERVERS];
}
function turnServers(): Promise<RTCIceServer[] | null> {
  if (!TURN_CREDENTIALS_URL) return Promise.resolve(fixedServers());
  if (!turnPromise) {
    turnPromise = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000); // 4초 넘게 걸리면 포기
        const res = await fetch(TURN_CREDENTIALS_URL, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(String(res.status));
        const list = await res.json() as RTCIceServer[];
        if (!Array.isArray(list) || list.length === 0) throw new Error('빈 목록');
        turnState = 'on';
        return [GOOGLE_STUN, ...list];
      } catch (e) {
        turnPromise = null; // 다음 연결 때 다시 시도
        const fixed = fixedServers(); // 붙여 넣은 목록이 있으면 그걸로
        if (fixed) return fixed;
        console.warn('TURN 서버 정보를 못 받아서 TURN 없이 연결해요:', e);
        turnState = 'failed';
        return null;
      }
    })();
  }
  return turnPromise;
}

function changed() { saveRoom(); G.onlineChanged(); }

// ---------- 방장 새로고침 대비: 방 기억하기 ----------
// sessionStorage = 이 탭에서만, 새로고침해도 남고 탭을 닫으면 사라짐 (다른 탭에서 방장 둘이 되지 않게)
const ROOM_KEY = 'chess.hostRoom';
export type SavedRoom = { code: string; hostColor: Color; gameNo: number; ucis: string[]; resigned: Color | null; chat: ChatLine[]; at: number };
function saveRoom() {
  if (role !== 'host' || !code || !['reopening', 'waiting', 'connected', 'lost'].includes(status)) return;
  const room: SavedRoom = { code, hostColor, gameNo, ucis: [...G.moveUcis], resigned: G.resigned, chat: chatLog, at: Date.now() };
  try { sessionStorage.setItem(ROOM_KEY, JSON.stringify(room)); } catch { /* 저장 못 하면 새로고침 때 방이 사라질 뿐 */ }
}
function forgetRoom() {
  try { sessionStorage.removeItem(ROOM_KEY); } catch { /* 없음 */ }
}
// 새로고침 전에 열어 둔 방 (없거나 6시간 넘게 지났으면 null)
export function savedRoom(): SavedRoom | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(ROOM_KEY) || 'null') as SavedRoom | null;
    if (s && typeof s.code === 'string' && s.code.length === 6 && Array.isArray(s.ucis) && Date.now() - s.at < 6 * 3600_000) return s;
  } catch { /* 깨졌으면 무시 */ }
  forgetRoom();
  return null;
}
// 페이지를 떠나기 직전(새로고침 포함): 마지막 상태를 저장하고, 중계 서버에 아이디를 바로 돌려줌
// (안 돌려주면 서버가 옛 아이디를 잠깐 붙잡고 있어서 다시 열 때 "이미 쓰는 코드"가 됨)
window.addEventListener('pagehide', () => { saveRoom(); peer?.destroy(); });
// 뒤로 가기 캐시에서 돌아오면 연결은 이미 끊겨 있음 → 새로고침해서 다시 열기·들어가기
window.addEventListener('pageshow', e => { if (e.persisted && role) location.reload(); });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
// 중계 서버에 아이디를 등록한 결과: 'ok' | 'taken'(이미 쓰는 아이디) | 오류 이름
function openResult(p: Peer): Promise<string> {
  return new Promise(resolve => {
    p.once('open', () => resolve('ok'));
    p.once('error', (e: { type?: string; message?: string }) => resolve(e.type === 'unavailable-id' ? 'taken' : (e.type || e.message || '알 수 없는 오류')));
  });
}

async function newPeer(id: string): Promise<Peer> {
  const { default: PeerClass } = await import('peerjs');
  return new PeerClass(id, await peerOptions());
}

// 친구에게 보낼 초대 링크
export function inviteLink(): string {
  return `${location.origin}${location.pathname}?room=${code}`;
}

// ---------- 방 만들기 (방장) ----------
export async function host(color: Color) {
  leave();
  role = 'host';
  status = 'creating';
  hostColor = color;
  gameNo = 0;
  G.startOnlineGame(hostColor);
  changed();
  for (let tries = 0; tries < 4; tries++) {
    const tryCode = randomCode();
    const p = await newPeer(PREFIX + tryCode.toLowerCase());
    if (role !== 'host' || status !== 'creating') { p.destroy(); return; } // 기다리는 사이에 취소함
    const result = await openResult(p);
    if (result === 'taken') { p.destroy(); continue; } // 코드가 겹치면 다른 코드로
    if (result !== 'ok') { p.destroy(); fail(result); return; }
    roomOpened(p, tryCode);
    return;
  }
  fail('방 코드를 만들지 못했어요');
}

// 중계 서버에 방 아이디를 등록한 뒤: 친구를 기다림
function roomOpened(p: Peer, roomCode: string) {
  peer = p;
  code = roomCode;
  status = 'waiting';
  p.on('connection', c => acceptGuest(c));
  p.on('disconnected', () => { if (peer === p) p.reconnect(); }); // 중계 서버와만 끊긴 것: 친구와의 연결은 그대로, 새 친구를 받으려면 다시 붙음
  p.on('error', (e: { type?: string }) => { if (e.type === 'network' || e.type === 'server-error') { /* 잠깐 끊김: reconnect가 처리 */ } });
  changed();
}

// ---------- 방장이 새로고침한 뒤: 같은 코드로 방 다시 열기 ----------
// 판·채팅은 기억해 둔 것으로 먼저 맞춰 놓고, 친구가 다시 들어오면 hello로 보냄
// 중계 서버가 옛 아이디를 아직 붙잡고 있으면 'taken'이 나서, 2초마다 다시 시도 (30초)
export async function resumeHost(saved: SavedRoom) {
  leave();
  role = 'host';
  code = saved.code;
  hostColor = saved.hostColor;
  gameNo = saved.gameNo;
  chatLog = Array.isArray(saved.chat) ? saved.chat.slice(-CHAT_KEEP) : [];
  G.startOnlineGame(hostColor);
  G.applyRemoteMoves(saved.ucis);
  if (saved.resigned) G.setOnlineResigned(saved.resigned);
  status = 'reopening';
  changed();
  for (let tries = 0; tries < 15; tries++) {
    const p = await newPeer(PREFIX + code.toLowerCase());
    if (role !== 'host' || status !== 'reopening') { p.destroy(); return; } // 기다리는 사이에 방을 닫음
    const result = await openResult(p);
    if (result === 'ok') { roomOpened(p, code); return; }
    p.destroy();
    await sleep(2000);
    if (role !== 'host' || status !== 'reopening') return;
  }
  forgetRoom();
  fail('방을 다시 열지 못했어요. 새 방을 만들어 친구에게 링크를 다시 보내 주세요.');
}

function acceptGuest(c: DataConnection) {
  // 새 연결이 오면 옛 연결은 버림: 친구가 새로고침하면 옛 연결이 끊긴 걸 방장이 늦게(수십 초 뒤) 알아채서,
  // 옛 연결을 붙잡고 있으면 다시 들어온 친구를 못 받음. (코드를 아는 사람만 들어올 수 있음)
  const old = conn;
  conn = c;
  old?.close();
  c.on('open', () => {
    if (conn !== c) return;
    status = 'connected';
    sendHello();
    changed();
  });
  wire(c);
}

// ---------- 들어가기 (친구) ----------
// quiet = 연결이 끊겨서 자동으로 다시 들어가는 것: 판·채팅·친구 캐릭터를 그대로 두고, 방이 안 보이면 조금 뒤 다시 시도
export async function join(roomCode: string, quiet = false) {
  const keep = { chat: chatLog, peerChar, tries: rejoinTries };
  leave();
  if (quiet) { chatLog = keep.chat; peerChar = keep.peerChar; rejoinTries = keep.tries; }
  role = 'guest';
  code = cleanCode(roomCode);
  status = quiet ? 'rejoining' : 'joining';
  if (!quiet) G.startOnlineGame('w'); // 방장의 hello가 오면 진짜 색으로 맞춤
  changed();
  if (code.length !== 6) { fail('방 코드는 6글자예요'); return; }
  const p = await newPeer(''); // 내 아이디는 아무거나
  if (role !== 'guest') { p.destroy(); return; }
  peer = p;
  p.on('error', (e: { type?: string; message?: string }) => {
    if (peer !== p) return;
    if (status === 'rejoining') { // 방장이 아직 방을 다시 안 열었음 → 조금 뒤 또
      p.destroy(); peer = null; conn = null;
      scheduleRejoin();
      return;
    }
    if (e.type === 'peer-unavailable') fail('그 방을 찾을 수 없어요. 코드를 다시 확인하거나, 친구에게 방을 다시 만들어 달라고 하세요.');
    else if (status !== 'connected') fail(e.type || e.message || '연결 오류');
  });
  p.on('open', () => {
    if (peer !== p) return;
    const c = p.connect(PREFIX + code.toLowerCase(), { reliable: true });
    conn = c;
    // 연결만 됐을 때는 아직 "들어가는 중": 방장이 보낸 hello(내 색·지금 판)가 와야 둘 수 있음
    // (전에는 여기서 바로 연결됨으로 해서, hello 전 잠깐 동안 친구가 백으로 둘 수 있었음)
    // 연결 직후 보낸 메시지가 가끔 사라져서, hello가 올 때까지 1초마다 "hi"를 다시 보냄
    c.on('open', () => {
      const ask = () => {
        if (conn !== c || (status !== 'joining' && status !== 'rejoining')) return;
        if (c.open) c.send({ t: 'hi', char: myChar } satisfies Msg);
        setTimeout(ask, 1000);
      };
      ask();
    });
    wire(c);
  });
}

// 친구가 다시 들어오기 (연결이 끊긴 뒤, "다시 들어가기" 버튼): 자동 시도를 처음부터
export function rejoin() { if (role === 'guest' && code) { rejoinTries = 0; join(code, true); } }

// 친구 쪽 자동 다시 들어가기: 2초마다, 30번(1분)까지. 그래도 안 되면 "끊김" + 버튼
let rejoinTries = 0;
let rejoinTimer: number | null = null;
const REJOIN_MAX = 30;
function scheduleRejoin() {
  if (rejoinTimer !== null) return;
  if (rejoinTries >= REJOIN_MAX) { status = 'lost'; changed(); return; }
  rejoinTries++;
  status = 'rejoining';
  changed();
  rejoinTimer = window.setTimeout(() => {
    rejoinTimer = null;
    if (role === 'guest' && code && status === 'rejoining') join(code, true);
  }, 2000);
}

function wire(c: DataConnection) {
  c.on('data', d => { if (conn === c) receive(d as Msg); });
  c.on('close', () => {
    if (conn !== c) return;
    conn = null;
    if (role === 'guest') { rejoinTries = 0; scheduleRejoin(); return; } // 방장이 새로고침했을 수 있음 → 자동으로 다시
    // 방장은 방을 계속 열어 둠 → 친구가 같은 링크로 다시 들어올 수 있음
    status = 'lost';
    changed();
  });
  c.on('error', () => { /* close가 뒤따라옴 */ });
}

function fail(text: string) {
  errorText = text;
  status = 'error';
  peer?.destroy();
  peer = null;
  conn = null;
  changed();
}

// 온라인을 그만둠 (다른 상대를 고르거나 "나가기")
export function leave() {
  forgetRoom();
  if (rejoinTimer !== null) { clearTimeout(rejoinTimer); rejoinTimer = null; }
  rejoinTries = 0;
  chatLog = [];
  peerChar = null;
  peerEmote = null;
  conn?.close();
  peer?.destroy();
  conn = null;
  peer = null;
  status = 'idle';
  role = null;
  code = '';
  errorText = '';
  myRematch = peerRematch = false;
}

function send(m: Msg) {
  if (conn && conn.open) conn.send(m);
}

// 내 캐릭터 바꾸기: 기억해 두고 친구에게 알림
export function setMyChar(id: string) {
  myChar = id;
  try { localStorage.setItem('chess.myCharacter', id); } catch { /* 저장 못 해도 이번엔 그대로 씀 */ }
  send({ t: 'char', char: id });
  changed();
}
function loadMyChar(): string {
  try { return localStorage.getItem('chess.myCharacter') || 'bluffer'; } catch { return 'bluffer'; }
}

// "나가기"·"취소": 연결을 끊고 처음(방 만들기) 화면으로. 상대는 온라인 그대로
export function leaveAndRefresh() {
  leave();
  G.startOnlineGame(G.playerColor);
  changed();
}

export const myColor = (): Color => (role === 'guest' ? G.otherColor(hostColor) : hostColor);
export const canPlay = () => status === 'connected';

function sendHello() {
  send({ t: 'hello', hostColor, gameNo, ucis: G.moveUcis, resigned: G.resigned, char: myChar });
}

// ---------- 받기 ----------
function receive(m: Msg) {
  if ('char' in m) peerChar = m.char; // 친구 캐릭터 (hi·hello·char 모두 실어 보냄)
  if (m.t === 'char') { changed(); return; }
  if (m.t === 'emote') {
    if (EMOTES.some(e => e.id === m.id)) { peerEmote = { id: m.id, n: ++emoteCount }; changed(); }
    return;
  }
  if (m.t === 'chat') {
    if (typeof m.text === 'string' && m.text.trim()) {
      addChat({ mine: false, text: m.text.trim().slice(0, CHAT_MAX_LEN), at: Date.now() });
      chatReceived++;
      changed();
    }
    return;
  }
  if (m.t === 'hi') { if (role === 'host') { sendHello(); changed(); } return; }
  if (m.t === 'hello') {
    status = 'connected';
    rejoinTries = 0;
    hostColor = m.hostColor;
    gameNo = m.gameNo;
    myRematch = peerRematch = false;
    G.startOnlineGame(myColor());
    G.applyRemoteMoves(m.ucis);
    if (m.resigned) G.setOnlineResigned(m.resigned);
    changed();
    return;
  }
  if (m.gameNo !== gameNo) return; // 지난 판의 메시지
  if (m.t === 'move') G.applyRemoteMoves(m.ucis);
  else if (m.t === 'resign') G.setOnlineResigned(m.color);
  else if (m.t === 'rematch') { peerRematch = true; maybeRematch(); }
  changed();
}

// ---------- 보내기 (game.ts·main.ts가 부름) ----------
export function sendMoves(ucis: string[]) { send({ t: 'move', gameNo, ucis: [...ucis] }); saveRoom(); }

export function resign() {
  if (!canPlay() || G.resigned) return;
  G.setOnlineResigned(myColor());
  send({ t: 'resign', gameNo, color: myColor() });
  changed();
}

// 감정표현 보내기. 너무 자주 누르면(1.5초 안) 무시. 보냈으면 true
export function sendEmote(id: string): boolean {
  if (!canPlay() || Date.now() - lastEmoteSent < 1500) return false;
  lastEmoteSent = Date.now();
  send({ t: 'emote', id });
  return true;
}

// 다시 하기: 둘 다 누르면 색을 바꿔서 새 판 (둘이 같은 규칙으로 계산해서 따로 정해도 똑같이 됨)
export function requestRematch() {
  if (!canPlay() || myRematch) return;
  myRematch = true;
  send({ t: 'rematch', gameNo });
  maybeRematch();
  changed();
}
function maybeRematch() {
  if (!(myRematch && peerRematch)) return;
  myRematch = peerRematch = false;
  gameNo++;
  hostColor = G.otherColor(hostColor);
  G.startOnlineGame(myColor());
}

// game.ts가 부를 수 있게 함수를 넣어 줌
G.onlineHooks.sendMoves = sendMoves;
G.onlineHooks.canPlay = canPlay;
G.onlineHooks.leave = () => { leave(); changed(); };

// 테스트용 (브라우저 테스트가 상태를 읽음)
Object.assign(window, { __online: () => ({ status, role, code, gameNo, myColor: myColor(), ucis: [...G.moveUcis], resigned: G.resigned, myChar, peerChar, chat: chatLog.map(c => (c.mine ? '나: ' : '친구: ') + c.text) }) });
