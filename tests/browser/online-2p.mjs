// 친구와 온라인 1대1: 창 두 개(방장·친구)로 실제로 연결해서 둬 봄
// 인터넷이 필요함 (PeerJS 공개 중계 서버). 중계 서버를 직접 띄웠으면 PEER_SERVER=127.0.0.1:9000 을 앞에 붙임
import { launch, ok, watchErrors, finish, URL } from './_util.mjs';

const extra = process.env.PEER_SERVER ? `peerserver=${process.env.PEER_SERVER}` : '';
const withParams = (...ps) => URL + '?' + [...ps, extra].filter(Boolean).join('&');

const browser = await launch();
const errs = [];
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('chess.view', '2d')); // 2D가 빨라서
  const p = await ctx.newPage();
  p.__errs = watchErrors(p);
  return p;
}
const state = p => p.evaluate(() => window.__online());
async function waitFor(p, test, what, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test(await state(p))) return true;
    await p.waitForTimeout(100);
  }
  console.log('   (기다리다 시간 초과:', what, JSON.stringify(await state(p)), ')');
  return false;
}
// 칸 누르기 (내가 흑이면 판이 뒤집혀 있음)
async function click(p, name) {
  const { myColor } = await state(p);
  const file = name.charCodeAt(0) - 97, rank = Number(name[1]) - 1;
  const row = myColor === 'b' ? rank : 7 - rank;
  const col = myColor === 'b' ? 7 - file : file;
  await p.locator('.board .square').nth(row * 8 + col).click();
}
async function move(p, uci) { await click(p, uci.slice(0, 2)); await click(p, uci.slice(2, 4)); }
const info = p => p.locator('.info').first().textContent();

// ① 방장: 방 만들기
const host = await newPage();
await host.goto(withParams());
await host.locator('select.opponent').first().selectOption({ label: '친구와 온라인 (1대1)' });
await host.click('text=방 만들기');
ok(await waitFor(host, s => s.status === 'waiting', '방 만들기'), '방장: 방이 만들어지고 코드가 나옴');
const code = (await state(host)).code;
const link = await host.locator('.online-input').inputValue();
ok(/^[A-Z2-9]{6}$/.test(code) && link.includes('?room=' + code), `코드 ${code}, 초대 링크에 코드가 들어 있음`);

// ② 친구: 링크로 들어오기
const guest = await newPage();
await guest.goto(withParams('room=' + code));
ok(await waitFor(guest, s => s.status === 'connected', '친구 연결') && await waitFor(host, s => s.status === 'connected', '방장 연결'),
  '링크를 열자 둘 다 "연결됨"');
ok((await state(host)).myColor === 'w' && (await state(guest)).myColor === 'b', '방장 백, 친구 흑');

// ③ 수 주고받기
await move(guest, 'e7e5');
ok((await state(guest)).ucis.length === 0, '친구는 방장(백) 차례에 둘 수 없음');
await move(host, 'e2e4');
ok(await waitFor(guest, s => s.ucis.join() === 'e2e4', '친구가 e2e4 받기'), '방장의 e2e4가 친구 화면에 나타남');
await move(guest, 'e7e5');
ok(await waitFor(host, s => s.ucis.join() === 'e2e4,e7e5', '방장이 e7e5 받기'), '친구의 e7e5가 방장 화면에 나타남');
ok((await info(host)).includes('내 차례') && (await info(guest)).includes('친구 차례'), '차례 표시: 방장 "내 차례", 친구 "친구 차례"');

// ④ 친구가 새로고침해도 이어짐
await guest.reload();
ok(await waitFor(guest, s => s.status === 'connected' && s.ucis.join() === 'e2e4,e7e5', '재접속'), '친구가 새로고침 → 다시 연결되고 판이 그대로');

// ⑤ 끝까지: 스콜라 메이트
await move(host, 'f1c4'); await waitFor(guest, s => s.ucis.length === 3, '3');
await move(guest, 'b8c6'); await waitFor(host, s => s.ucis.length === 4, '4');
await move(host, 'd1h5'); await waitFor(guest, s => s.ucis.length === 5, '5');
await move(guest, 'g8f6'); await waitFor(host, s => s.ucis.length === 6, '6');
await move(host, 'h5f7');
await waitFor(guest, s => s.ucis.length === 7, '7');
ok((await info(host)).includes('체크메이트') && (await info(guest)).includes('체크메이트'), '체크메이트가 양쪽에 똑같이 표시');

// ⑥ 다시 하기: 둘 다 누르면 색을 바꿔 새 판
await guest.click('button:has-text("다시 하기")');
ok(await host.locator('text=친구가 원해요').count() > 0, '방장 화면에 "친구가 원해요"');
await host.click('button:has-text("다시 하기")');
ok(await waitFor(host, s => s.gameNo === 1 && s.ucis.length === 0, '새 판') && await waitFor(guest, s => s.gameNo === 1, '새 판(친구)'), '둘 다 눌러서 새 판');
ok((await state(host)).myColor === 'b' && (await state(guest)).myColor === 'w', '새 판에서는 방장 흑, 친구 백');

// ⑦ 기권 (두 번 눌러야 함)
await move(guest, 'd2d4'); await waitFor(host, s => s.ucis.length === 1, 'd4');
await host.click('button:has-text("기권")');
ok((await state(host)).resigned === null, '기권 한 번 누르면 아직 기권 아님');
await host.click('button:has-text("기권")');
ok(await waitFor(guest, s => s.resigned === 'b', '기권 받기'), '방장 기권 → 친구 화면에도 기권');
ok((await info(guest)).includes('친구 기권'), `친구 화면: "${await info(guest)}"`);

// ⑧ 없는 방 코드
const lost = await newPage();
await lost.goto(withParams('room=ZZZZZZ'));
ok(await waitFor(lost, s => s.status === 'error', '없는 방'), '없는 방 코드면 오류 안내');
ok((await lost.locator('.online-error').textContent()).includes('찾을 수 없어요'), '"그 방을 찾을 수 없어요" 안내');

// 없는 방은 PeerJS가 콘솔 오류를 남겨서 그건 빼고 봄
const all = [host, guest].flatMap(p => p.__errs);
await finish(browser, all);
