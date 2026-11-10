// 기보 보기에서 3D 판
import { URL, launch, ok, watchErrors, finish, tmp, loadPGN } from './_util.mjs';

const b = await launch({ webgl: true });
const p = await (await b.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
const errs = watchErrors(p);
await p.goto(URL);
await p.evaluate(() => { localStorage.setItem('chess.view', '3d'); localStorage.setItem('chess.theme', 'classic'); });
await p.reload();
await p.waitForSelector('.board3d canvas', { timeout: 30000 });
await p.locator('.tab', { hasText: '기보 보기' }).click();
await loadPGN(p);
await p.waitForTimeout(800);
ok(await p.locator('.board3d canvas').count() === 1, '기보 보기에 3D 판');

const r1 = await p.evaluate(() => window.__chess3dRenders());
await p.locator('button', { hasText: '▶' }).nth(1).click();
await p.waitForTimeout(1000);
const r2 = await p.evaluate(() => window.__chess3dRenders());
ok(r2 - r1 >= 2, `▶ 누르면 다시 그림 (${r2 - r1}번)`);

// 3D 판을 눌러도 대국 화면의 게임은 안 바뀜
const box = await p.locator('.board3d canvas').boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
await p.click('text=⏭');
await p.waitForTimeout(2000);
await p.locator('.board3d').screenshot({ path: tmp('chess-replay3d-mate.png') });
console.log('   사진 (킹이 쓰러져 있어야 함):', tmp('chess-replay3d-mate.png'));
ok((await p.textContent('.depth-info')).includes('Rd8#'), '마지막 장면: ' + await p.textContent('.depth-info'));

// 2D로 바꾸면 기보 보기 그대로 2D 판
await p.click('text=2D로 보기');
ok(await p.locator('.board .square').count() === 64 && (await p.textContent('.depth-info')).includes('Rd8#'), '2D로 바꿔도 같은 장면');
await p.click('text=3D로 보기');

await p.locator('.tab', { hasText: '대국' }).click();
await p.waitForTimeout(500);
ok((await p.$$('.move-row')).length === 0, '기보 보기에서 판을 눌러도 대국 화면 게임은 그대로');

await finish(b, errs);
