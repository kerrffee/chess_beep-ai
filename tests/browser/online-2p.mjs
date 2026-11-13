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

// 캐릭터: 처음 값은 허세꾼, 바꾸면 친구 화면에 바로 전해짐 (브라우저에 기억)
ok((await state(host)).peerChar === 'bluffer' && (await state(guest)).peerChar === 'bluffer', '처음엔 서로 허세꾼으로 보임');
await host.locator('.online-box select').selectOption({ label: '내 캐릭터: 대가' });
ok(await waitFor(guest, s => s.peerChar === 'master', '캐릭터 바꾸기'), '방장이 "대가"로 바꾸면 친구 화면에서도 대가');
await guest.locator('.online-box select').selectOption({ label: '내 캐릭터: 혼돈' });
ok(await waitFor(host, s => s.peerChar === 'chaos', '친구 캐릭터'), '친구가 "혼돈"으로 바꾸면 방장 화면에서도 혼돈');
ok((await host.locator('.online-box').textContent()).includes('친구 캐릭터: 혼돈'), '방장 화면에 "친구 캐릭터: 혼돈"');

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
ok((await state(guest)).myChar === 'chaos' && await waitFor(guest, s => s.peerChar === 'master', '재접속 캐릭터')
  && (await state(host)).peerChar === 'chaos', '새로고침해도 내 캐릭터(혼돈)는 기억, 친구 캐릭터(대가)도 다시 받음');

// 채팅: 방장이 보내면 친구 화면에 말풍선 + 💬 버튼에 안 읽은 개수, 열면 목록에 보임
await host.click('.chat-btn');
ok(await host.locator('.chat-box').isVisible(), '방장: 💬 누르면 채팅 창이 열림');
await host.fill('.chat-input', '안녕! <b>굵게?</b>');
await host.press('.chat-input', 'Enter');
ok(await waitFor(guest, s => s.chat.join() === '친구: 안녕! <b>굵게?</b>', '채팅 받기'), '친구가 채팅을 받음');
ok((await host.inputValue('.chat-input')) === '' && (await host.locator('.chat-mine').textContent()).includes('안녕!'), '보낸 뒤 입력 칸이 비고 내 글이 목록에 보임');
await guest.waitForTimeout(200);
ok((await guest.locator('.emote-speech').textContent()).includes('💬 안녕!'), '친구 화면: 채팅 창이 닫혀 있으면 말풍선으로');
ok((await guest.locator('.chat-btn').textContent()).includes('1'), '친구 화면 💬 버튼에 안 읽은 개수 1');
await guest.click('.chat-btn');
ok((await guest.locator('.chat-theirs').textContent()).includes('<b>굵게?</b>') && await guest.locator('.chat-theirs b').count() === 0,
  '친구가 채팅 창을 열면 글이 보이고, HTML은 글자 그대로');
ok(!(await guest.locator('.chat-btn').textContent()).includes('1'), '열면 안 읽은 개수가 사라짐');
await guest.fill('.chat-input', '반가워');
await guest.click('.chat-send');
ok(await waitFor(host, s => s.chat.includes('친구: 반가워'), '답장'), '친구 답장이 방장 채팅 창에 옴');
await host.locator('.chat-close').click();
await guest.locator('.chat-close').click();
await guest.waitForTimeout(4200); // 채팅 말풍선이 사라질 때까지

// 방장 새로고침: 같은 코드로 방이 다시 열리고, 친구가 자동으로 다시 들어와 판·채팅이 그대로
await host.reload();
ok(await waitFor(host, s => s.code === code && (s.status === 'reopening' || s.status === 'waiting' || s.status === 'connected'), '방 다시 열기', 5000),
  '방장 새로고침 → 같은 코드로 방을 다시 엶');
ok(await waitFor(host, s => s.status === 'connected', '방장 재연결', 40000) && await waitFor(guest, s => s.status === 'connected', '친구 자동 재접속', 10000),
  '친구가 자동으로 다시 들어와 연결됨');
ok((await state(host)).ucis.join() === 'e2e4,e7e5' && (await state(guest)).ucis.join() === 'e2e4,e7e5', '판이 그대로 (e2e4, e7e5)');
ok((await state(host)).chat.length === 2 && (await state(guest)).chat.length === 2, '채팅 기록도 양쪽 다 남아 있음');
ok((await state(host)).myColor === 'w' && (await state(host)).peerChar === 'chaos', '방장 색(백)·친구 캐릭터도 그대로');

// 감정표현: 버튼을 누르면 친구 화면에 말풍선, 너무 빨리 또 누르면 무시
await host.click('.emote-btn[data-emote="nice"]');
await guest.waitForTimeout(800);
const bubbleText = await guest.locator('.emote-speech').textContent().catch(() => '');
ok(bubbleText.includes('대가') && bubbleText.includes('잘 뒀다'), `감정표현 👍 → 친구 화면 말풍선: "${bubbleText}"`);
ok((await host.locator('.emote-speech').textContent()).includes('나'), '보낸 쪽 화면에도 "나: 👍 잘 뒀다!"');
await host.click('.emote-btn[data-emote="haha"]'); // 1.5초 안에 또 누름 → 안 보냄
await guest.waitForTimeout(500);
ok((await guest.locator('.emote-speech').textContent()).includes('잘 뒀다'), '1.5초 안에 다시 누르면 무시');
await guest.waitForTimeout(3000);
ok(await guest.locator('.emote-speech').count() === 0, '말풍선은 3초 뒤 사라짐');

// 내 차례 알림: 친구가 다른 탭을 보는 중에 방장이 두면 친구 탭 제목이 깜빡임, 돌아오면 원래대로
const realTitle = await guest.title();
await guest.evaluate(() => Object.defineProperty(document, 'hidden', { get: () => true, configurable: true }));

// ⑤ 끝까지: 스콜라 메이트
await move(host, 'f1c4'); await waitFor(guest, s => s.ucis.length === 3, '3');
await guest.waitForTimeout(300);
ok((await guest.title()) === '♟ 내 차례!', `다른 탭일 때 친구 수가 오면 탭 제목: "${await guest.title()}"`);
await guest.evaluate(() => { Object.defineProperty(document, 'hidden', { get: () => false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
ok((await guest.title()) === realTitle, '탭으로 돌아오면 제목이 원래대로');
await move(guest, 'b8c6'); await waitFor(host, s => s.ucis.length === 4, '4');
await move(host, 'd1h5'); await waitFor(guest, s => s.ucis.length === 5, '5');
await move(guest, 'g8f6'); await waitFor(host, s => s.ucis.length === 6, '6');
await move(host, 'h5f7');
await waitFor(guest, s => s.ucis.length === 7, '7');
ok((await info(host)).includes('체크메이트') && (await info(guest)).includes('체크메이트'), '체크메이트가 양쪽에 똑같이 표시');

// AI 복기: 끝난 판에서 누르면 장면마다 살펴보고, 결과에 친구의 큰 실수(Nf6??: Qxf7# 허용)가 나옴
await guest.click('button:has-text("AI 복기")');
const reviewEnd = Date.now() + 30000;
while (Date.now() < reviewEnd && await guest.locator('.review-title').count() === 0) await guest.waitForTimeout(300);
const reviewText = await guest.locator('.review-box').textContent().catch(() => '');
console.log('   복기:', reviewText);
ok(reviewText.includes('정확도') && /Nf6\?\?/.test(reviewText), '복기 결과에 정확도와 "Nf6??" 큰 실수');
ok((await guest.locator('.moves').textContent()).includes('Nf6??'), '기보에도 Nf6?? 표시');
await guest.locator('.review-item', { hasText: 'Nf6' }).click();
ok(await guest.locator('.tab-on', { hasText: '기보 보기' }).count() === 1, '실수를 누르면 기보 보기 탭이 열림');
await guest.click('.tab:has-text("대국")');

// ⑥ 다시 하기: 둘 다 누르면 색을 바꿔 새 판
await guest.click('button:has-text("다시 하기")');
ok(await host.locator('text=친구가 원해요').count() > 0, '방장 화면에 "친구가 원해요"');
await host.click('button:has-text("다시 하기")');
ok(await waitFor(host, s => s.gameNo === 1 && s.ucis.length === 0, '새 판') && await waitFor(guest, s => s.gameNo === 1, '새 판(친구)'), '둘 다 눌러서 새 판');
ok((await state(host)).myColor === 'b' && (await state(guest)).myColor === 'w', '새 판에서는 방장 흑, 친구 백');
ok(await guest.locator('.review-box').count() === 0, '새 판이 되면 지난 복기는 사라짐');

// ⑦ 기권 (두 번 눌러야 함)
await move(guest, 'd2d4'); await waitFor(host, s => s.ucis.length === 1, 'd4');
await host.click('button:has-text("기권")');
ok((await state(host)).resigned === null, '기권 한 번 누르면 아직 기권 아님');
await host.click('button:has-text("기권")');
ok(await waitFor(guest, s => s.resigned === 'b', '기권 받기'), '방장 기권 → 친구 화면에도 기권');
ok((await info(guest)).includes('친구 기권'), `친구 화면: "${await info(guest)}"`);

// ⑧ 체스 시계: 새 판에서 방장이 시간을 고르고, 수마다 시간이 맞춰지고, 0이 되면 시간 패배
await guest.click('button:has-text("다시 하기")');
await host.click('button:has-text("다시 하기")');
ok(await waitFor(host, s => s.gameNo === 2 && s.myColor === 'w', '셋째 판') && await waitFor(guest, s => s.gameNo === 2, '셋째 판(친구)'), '셋째 판: 방장 백');
const clockTexts = async p => (await p.locator('.clock-bar').textContent()).replace(/\s+/g, '');
ok((await clockTexts(host)).includes('5:00') && (await clockTexts(guest)).includes('5:00'), `처음 시간 5분이 양쪽에: "${await clockTexts(guest)}"`);
ok(await guest.locator('.tc-select').count() === 0 && (await guest.locator('.online-box').textContent()).includes('방장이 정함'), '친구는 시간을 못 고르고 "방장이 정함"');
await host.locator('.tc-select').selectOption({ label: '시간: 3분 + 2초' });
ok(await waitFor(guest, s => s.tc === '3+2', '시간 바꾸기'), '방장이 3분+2초로 바꾸면 친구도 3+2');
await guest.waitForTimeout(1200);
ok((await state(host)).clock.w === 180000, '백 첫 수 전에는 시계가 안 감');
await move(host, 'e2e4'); await waitFor(guest, s => s.ucis.length === 1, 'c1');
ok(await host.locator('.tc-select').count() === 0, '첫 수를 두면 시간을 못 바꿈');
await guest.waitForTimeout(1500);
await move(guest, 'e7e5');
ok(await waitFor(host, s => s.ucis.length === 2, 'c2'), '친구 수 받음');
const hb = (await state(host)).clock.b, gb = (await state(guest)).clock.b;
console.log('   흑 남은 시간 (방장 화면, 친구 화면):', hb, gb);
ok(hb > 179000 && hb < 181000 && Math.abs(hb - gb) < 300, '흑: 1.5초 쓰고 2초 받음 → 약 3:00.5, 두 화면이 같음');
// 방장(백) 시간을 1.5초로 줄이고 기다림 → 방장 화면이 시간 초과를 알리고 친구 화면에도
await host.evaluate(() => window.__setClock(1500, 180000));
ok(await waitFor(guest, s => s.resigned === 'w' && s.why === 'timeout', '시간 초과 받기', 6000), '방장 시간이 0 → 친구 화면에도 백 시간 패배');
ok((await info(host)).includes('내 시간 초과') && (await info(guest)).includes('친구 시간 초과! 흑 승리'), `표시: "${await info(host)}" / "${await info(guest)}"`);
ok((await state(host)).clock.w === 0, '방장 시계 0:00');
const left0 = (await state(guest)).clock.b;
await guest.waitForTimeout(600);
ok((await state(guest)).clock.b === left0, '판이 끝나면 시계가 멈춤');
await move(host, 'g1f3');
ok((await state(host)).ucis.length === 2, '시간 초과 뒤에는 둘 수 없음');

// ⑨ 없는 방 코드
const lost = await newPage();
await lost.goto(withParams('room=ZZZZZZ'));
ok(await waitFor(lost, s => s.status === 'error', '없는 방'), '없는 방 코드면 오류 안내');
ok((await lost.locator('.online-error').textContent()).includes('찾을 수 없어요'), '"그 방을 찾을 수 없어요" 안내');

// 없는 방은 PeerJS가 콘솔 오류를 남겨서 그건 빼고 봄
const all = [host, guest].flatMap(p => p.__errs);
await finish(browser, all);
