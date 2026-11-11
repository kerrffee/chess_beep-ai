// 3D 판: 쉬는 동안 안 그리기, 판 클릭으로 두기, 체크메이트 때 킹 쓰러짐, 효과음
// (화면 없는 크롬은 3D를 아주 느리게 그려서, 움직임이 몇 장면만에 끝나는 건 정상)
import { URL, launch, ok, watchErrors, finish, tmp } from './_util.mjs';

const b = await launch({ webgl: true });
const p = await (await b.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
const errs = watchErrors(p);
// 효과음이 몇 번 나는지 세기
await p.addInitScript(() => {
  window.__sounds = 0;
  const C = window.AudioContext;
  window.AudioContext = class extends C { createBufferSource() { window.__sounds++; return super.createBufferSource(); } };
});
await p.goto(URL);
await p.evaluate(() => { localStorage.setItem('chess.view', '3d'); localStorage.setItem('chess.theme', 'classic'); localStorage.removeItem('chess.sound'); });
await p.reload();
await p.locator('select.opponent').nth(0).selectOption({ label: '사람 (둘이서)' });
await p.waitForSelector('.board3d canvas', { timeout: 30000 });
await p.locator('select.view-select').selectOption({ label: '시점: 위에서' });
await p.waitForTimeout(2500);

// 1) 가만히 있으면 안 그림
const r1 = await p.evaluate(() => window.__chess3dRenders());
await p.waitForTimeout(2000);
const r2 = await p.evaluate(() => window.__chess3dRenders());
ok(r2 - r1 <= 1, `가만히 있는 2초 동안 그린 횟수: ${r2 - r1}번`);

// 2) 바보 메이트: f3 e5 g4 Qh4# (위에서 본 화면에서 칸 위치 계산)
// 오른쪽 설정 판이 판 일부를 가리니까 접어 두고 판을 누름
await p.click('.panel-toggle');
ok(await p.locator('.panel').count() === 0, '⚙ 버튼으로 설정 판 접기');
ok(await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight), '3D 화면에 스크롤 없음');
const box = await p.locator('.board3d canvas').boundingBox();
const k = 14 * Math.tan(20 * Math.PI / 180);
const clickSq = async (file, rank) => {
  const x = file - 3.5, z = 3.5 - rank;
  await p.mouse.click(box.x + (x / k + 1) / 2 * box.width, box.y + (1 + z / k) / 2 * box.height);
  await p.waitForTimeout(400);
};
for (const [f1, a, f2, c] of [[5, 1, 5, 2], [4, 6, 4, 4], [6, 1, 6, 3]]) {
  await clickSq(f1, a); await clickSq(f2, c); await p.waitForTimeout(900);
}
await clickSq(3, 7);
const r3 = await p.evaluate(() => window.__chess3dRenders());
await clickSq(7, 3); // Qh4#
await p.waitForTimeout(2500);
const r4 = await p.evaluate(() => window.__chess3dRenders());
const info = await p.textContent('.info');
ok(info.includes('체크메이트'), '바보 메이트: ' + info);
// 움직임은 시간 기준이라, 화면 없는 크롬처럼 한 장면이 느리면 장면 수가 적음 → "두 번 이상 다시 그렸는지"만 봄
ok(r4 - r3 >= 2, `마지막 수 + 킹이 쓰러지는 동안 그림: ${r4 - r3}번`);
await p.click('.panel-toggle'); // 설정 판 다시 펴기
await p.locator('select.view-select').selectOption({ label: '시점: 비스듬히' });
await p.waitForTimeout(1500);
await p.locator('.board3d').screenshot({ path: tmp('chess-3d-mate.png') });
console.log('   사진:', tmp('chess-3d-mate.png'));
await p.click('text=무르기');
await p.waitForTimeout(800);

// 3) 효과음
const sounds = await p.evaluate(() => window.__sounds);
ok(sounds >= 4, `효과음: ${sounds}번`);
await p.click('text=소리 끄기');
const before = await p.evaluate(() => window.__sounds);
await p.click('text=2D로 보기');
const sqs = p.locator('.board .square');
await sqs.nth(53).click(); await sqs.nth(45).click();
await p.waitForTimeout(300);
ok((await p.evaluate(() => window.__sounds)) === before, '소리 끄면 안 남');
await p.click('text=소리 켜기');

// 4) 넓은 화면에서 설정 판을 편 채로: 판이 왼쪽으로 옮겨져도 누른 칸이 맞는지 (e2 → e4)
const W = 1280, H = 800;
const p2 = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
const errs2 = watchErrors(p2);
await p2.goto(URL);
await p2.evaluate(() => localStorage.setItem('chess.view', '3d'));
await p2.reload();
await p2.locator('select.opponent').nth(0).selectOption({ label: '사람 (둘이서)' });
await p2.waitForSelector('.board3d canvas', { timeout: 30000 });
ok(await p2.locator('.panel').count() === 1, '넓은 화면: 설정 판이 처음부터 펴져 있음');
await p2.locator('select.view-select').selectOption({ label: '시점: 위에서' });
await p2.waitForTimeout(2500);
// 위에서 본 화면: 판 가운데가 설정 판 폭(280px)의 절반만큼 왼쪽으로 옮겨져 있음
const kk = 14 * Math.tan(20 * Math.PI / 180), shift = 280 / 2;
const click2 = async (file, rank) => {
  await p2.mouse.click(W / 2 + (file - 3.5) / (kk * W / H) * (W / 2) - shift, H / 2 + (3.5 - rank) / kk * (H / 2));
  await p2.waitForTimeout(500);
};
await click2(4, 1); await click2(4, 3);
await p2.waitForTimeout(800);
const rows = await p2.$$eval('.move-row', r => r.map(x => x.textContent));
ok(rows.length === 1 && rows[0].includes('e4'), '설정 판을 편 채로 판 누르기: ' + JSON.stringify(rows));
errs.push(...errs2);

// 5) 대가와 두면 판 건너편에 실루엣이 앉아 있음: 숨 쉬느라 가만히 있어도 조금씩 그림(초당 약 12장),
//    대가가 수를 두면 손을 뻗음 (사진으로 확인)
const p3 = await (await b.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
const errs3 = watchErrors(p3);
await p3.goto(URL);
await p3.evaluate(() => { localStorage.setItem('chess.view', '3d'); localStorage.setItem('chess.camera', 'top'); });
await p3.reload();
await p3.locator('select.opponent').nth(2).selectOption({ label: '0.5초' });
await p3.waitForSelector('.board3d canvas', { timeout: 30000 });
await p3.click('.panel-toggle'); // 설정 판 접기 → 위에서 본 판이 화면 가운데
await p3.waitForTimeout(2000);
const box3 = await p3.locator('.board3d canvas').boundingBox();
const click3 = async (file, rank) => {
  await p3.mouse.click(box3.x + ((file - 3.5) / kk + 1) / 2 * box3.width, box3.y + (1 + (3.5 - rank) / kk) / 2 * box3.height);
  await p3.waitForTimeout(400);
};
await click3(4, 1); await click3(4, 3); // e4
await p3.waitForFunction(() => document.querySelectorAll('.hud .info')[0]?.textContent.startsWith('백 차례'), null, { timeout: 20000 });
await p3.click('.panel-toggle');
await p3.locator('select.view-select').selectOption({ label: '시점: 앉아서' });
await p3.waitForTimeout(1500);
const q1 = await p3.evaluate(() => window.__chess3dRenders());
await p3.waitForTimeout(2000);
const q2 = await p3.evaluate(() => window.__chess3dRenders());
// 느린 기기에서는 숨쉬기 장면을 드물게 그리니까(화면 없는 크롬이 그럼) "멈추지 않고 계속 그리는지"만 봄
ok(q2 - q1 >= 1, `대가 실루엣이 숨 쉬는 동안 계속 그림: 2초에 ${q2 - q1}번`);
await p3.click('.panel-toggle');
await p3.waitForTimeout(1500);
await p3.screenshot({ path: tmp('chess-room-master.png') });
console.log('   사진 (방 + 대가 실루엣):', tmp('chess-room-master.png'));
errs.push(...errs3);

await finish(b, errs);
