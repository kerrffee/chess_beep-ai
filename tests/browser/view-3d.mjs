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
await p.click('text=위에서 보기');
await p.waitForTimeout(2500);

// 1) 가만히 있으면 안 그림
const r1 = await p.evaluate(() => window.__chess3dRenders());
await p.waitForTimeout(2000);
const r2 = await p.evaluate(() => window.__chess3dRenders());
ok(r2 - r1 <= 1, `가만히 있는 2초 동안 그린 횟수: ${r2 - r1}번`);

// 2) 바보 메이트: f3 e5 g4 Qh4# (위에서 본 화면에서 칸 위치 계산)
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
ok(r4 - r3 >= 3, `마지막 수 + 킹이 쓰러지는 동안 그림: ${r4 - r3}번`);
await p.click('text=비스듬히 보기');
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

await finish(b, errs);
