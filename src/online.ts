// ---------- 친구와 온라인 1대1 ----------
// 서버 없이 두 브라우저를 직접 연결함 (WebRTC, PeerJS 라이브러리)
// · 방을 만든 쪽(방장)이 6글자 코드를 받음 → 친구는 링크(…/?room=코드)를 열거나 코드를 입력해서 들어옴
// · 처음 연결할 때만 PeerJS의 무료 공개 중계 서버(0.peerjs.com)가 "서로 주소 알려 주기"를 도와주고,
//   그 뒤 수는 두 브라우저끼리 직접 주고받음
// · 수를 보낼 때 지금까지의 수 전체(ucis)를 같이 보내서, 중간에 하나가 빠져도 받는 쪽이 판을 똑같이 맞춤
// · 친구가 새로고침·재접속해도 방장이 방을 열어 두고 있으면 다시 들어와서 이어 둠 (방장이 새로고침하면 방이 사라짐)
// PeerJS는 용량이 있어서 온라인을 처음 쓸 때만 불러옴
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Color } from './board';
import * as G from './game';

export type OnlineStatus = 'idle' | 'creating' | 'waiting' | 'joining' | 'connected' | 'lost' | 'error';

export let status: OnlineStatus = 'idle';
export let role: 'host' | 'guest' | null = null;
export let code = '';            // 방 코드 (대문자 6글자)
export let errorText = '';
export let gameNo = 0;           // 몇 번째 판인지 (다시 하기마다 +1, 옛 판의 메시지는 버림)
export let myRematch = false;    // 내가 "다시 하기"를 눌렀는지
export let peerRematch = false;  // 친구가 "다시 하기"를 눌렀는지
let hostColor: Color = 'w';      // 이번 판에서 방장이 두는 색 (다시 하기마다 바뀜)
let peer: Peer | null = null;
let conn: DataConnection | null = null;

// 주고받는 메시지
type Msg =
  | { t: 'hi' } // 친구 → 방장: 지금 판 보내 줘
  | { t: 'hello'; hostColor: Color; gameNo: number; ucis: string[]; resigned: Color | null } // 방장 → 친구: 지금 판 전부
  | { t: 'move'; gameNo: number; ucis: string[] }
  | { t: 'resign'; gameNo: number; color: Color }
  | { t: 'rematch'; gameNo: number };

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
function peerOptions() {
  const custom = new URLSearchParams(location.search).get('peerserver');
  if (!custom) return {};
  const [host, port] = custom.split(':');
  return { host, port: Number(port) || 9000, path: '/', secure: false };
}

function changed() { G.onlineChanged(); }

async function newPeer(id: string): Promise<Peer> {
  const { default: PeerClass } = await import('peerjs');
  return new PeerClass(id, peerOptions());
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
    const result = await new Promise<'ok' | 'taken' | string>(resolve => {
      p.once('open', () => resolve('ok'));
      p.once('error', (e: { type?: string; message?: string }) => resolve(e.type === 'unavailable-id' ? 'taken' : (e.type || e.message || '알 수 없는 오류')));
    });
    if (result === 'taken') { p.destroy(); continue; } // 코드가 겹치면 다른 코드로
    if (result !== 'ok') { p.destroy(); fail(result); return; }
    peer = p;
    code = tryCode;
    status = 'waiting';
    p.on('connection', c => acceptGuest(c));
    p.on('disconnected', () => { if (peer === p) p.reconnect(); }); // 중계 서버와만 끊긴 것: 친구와의 연결은 그대로, 새 친구를 받으려면 다시 붙음
    p.on('error', (e: { type?: string }) => { if (e.type === 'network' || e.type === 'server-error') { /* 잠깐 끊김: reconnect가 처리 */ } });
    changed();
    return;
  }
  fail('방 코드를 만들지 못했어요');
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
export async function join(roomCode: string) {
  leave();
  role = 'guest';
  code = cleanCode(roomCode);
  status = 'joining';
  G.startOnlineGame('w'); // 방장의 hello가 오면 진짜 색으로 맞춤
  changed();
  if (code.length !== 6) { fail('방 코드는 6글자예요'); return; }
  const p = await newPeer(''); // 내 아이디는 아무거나
  if (role !== 'guest') { p.destroy(); return; }
  peer = p;
  p.on('error', (e: { type?: string; message?: string }) => {
    if (peer !== p) return;
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
        if (conn !== c || status !== 'joining') return;
        if (c.open) c.send({ t: 'hi' } satisfies Msg);
        setTimeout(ask, 1000);
      };
      ask();
    });
    wire(c);
  });
}

// 친구가 다시 들어오기 (연결이 끊긴 뒤)
export function rejoin() { if (role === 'guest' && code) join(code); }

function wire(c: DataConnection) {
  c.on('data', d => { if (conn === c) receive(d as Msg); });
  c.on('close', () => {
    if (conn !== c) return;
    conn = null;
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

// "나가기"·"취소": 연결을 끊고 처음(방 만들기) 화면으로. 상대는 온라인 그대로
export function leaveAndRefresh() {
  leave();
  G.startOnlineGame(G.playerColor);
  changed();
}

export const myColor = (): Color => (role === 'guest' ? G.otherColor(hostColor) : hostColor);
export const canPlay = () => status === 'connected';

function sendHello() {
  send({ t: 'hello', hostColor, gameNo, ucis: G.moveUcis, resigned: G.resigned });
}

// ---------- 받기 ----------
function receive(m: Msg) {
  if (m.t === 'hi') { if (role === 'host') sendHello(); return; }
  if (m.t === 'hello') {
    status = 'connected';
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
export function sendMoves(ucis: string[]) { send({ t: 'move', gameNo, ucis: [...ucis] }); }

export function resign() {
  if (!canPlay() || G.resigned) return;
  G.setOnlineResigned(myColor());
  send({ t: 'resign', gameNo, color: myColor() });
  changed();
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
Object.assign(window, { __online: () => ({ status, role, code, gameNo, myColor: myColor(), ucis: [...G.moveUcis], resigned: G.resigned }) });
