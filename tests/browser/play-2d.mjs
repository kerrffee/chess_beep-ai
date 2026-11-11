// 2D 판: 대국, 프로모션, 리그, 기보 보기, PGN 불러오기
import { URL, launch, ok, watchErrors, finish, loadPGN } from './_util.mjs';

const b = await launch();
const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
const errs = watchErrors(p);
await p.goto(URL);
await p.evaluate(() => localStorage.setItem('chess.view', '2d'));
await p.reload();
const tab = name => p.locator('.tab', { hasText: name }).click();
const sq = i => p.locator('.square').nth(i);
const depth = () => p.textContent('.depth-info');

// 1) 대국: e4 두면 AI가 응수
await p.locator('select.opponent').nth(2).selectOption({ label: '0.5초' });
await sq(52).click(); await sq(36).click();
await p.waitForFunction(() => document.querySelector('.info').textContent.startsWith('백 차례'), null, { timeout: 15000 });
ok((await p.$$('.move-row')).length === 1, '대국: e4에 AI가 응수 ' + JSON.stringify(await p.$$eval('.move-row', r => r.map(x => x.textContent))));

// 1-2) 대국을 파일 저장 없이 "기보 보기로 열기" → 마지막 장면부터, 대국은 그대로
await p.click('text=기보 보기로 열기');
ok((await p.textContent('.info')).includes('진행 중'), '기보 보기로 열기: ' + await p.textContent('.info'));
ok(/^2수 중 2번째/.test(await depth()), '마지막 장면부터: ' + await depth());
await tab('대국');
ok((await p.$$('.move-row')).length === 1, '대국 탭으로 돌아오면 그대로');

// 2) 리그: 대가·욕심쟁이·혼돈만
await tab('리그');
const names = await p.$$eval('.league-picks label', ls => ls.map(l => l.textContent.trim()));
for (let i = 0; i < names.length; i++) {
  const box = p.locator('.league-picks input').nth(i);
  const want = ['대가', '욕심쟁이', '혼돈'].includes(names[i]);
  if ((await box.isChecked()) !== want) await box.click();
}
await p.locator('button', { hasText: '시작' }).click();
await p.waitForFunction(() => document.querySelector('.info')?.textContent.startsWith('리그 끝'), null, { timeout: 180000 });
ok((await p.$$('.league-game')).length === 3, '리그 3판 끝');

// 3) 리그 판을 기보 보기로 열기
await p.locator('.league-game button').first().click();
ok((await p.textContent('.info')).includes('vs'), '기보 보기 열림: ' + await p.textContent('.info'));
await p.locator('button', { hasText: '▶' }).nth(1).click();
await p.locator('button', { hasText: '▶' }).nth(1).click();
ok(/중 2번째/.test(await depth()), '▶ 두 번: ' + await depth());
await p.click('text=⏭');
ok(/^(\d+)수 중 \1번째/.test(await depth()), '⏭ 마지막 수: ' + await depth());
await p.locator('.move-click').nth(4).click();
ok(/중 5번째/.test(await depth()), '기보에서 5번째 수 누르기: ' + await depth());
await p.click('text=⏮');
await p.click('text=▶ 자동');
await p.waitForTimeout(2000);
ok(Number(((await depth()).match(/중 (\d+)번째/) || [])[1]) >= 2, '자동 재생 2초: ' + await depth());
await p.click('text=■ 멈춤');

// 4) PGN 파일 불러오기
await loadPGN(p);
ok((await p.textContent('.info')).includes('Morphy'), 'PGN 불러오기: ' + await p.textContent('.info'));
await p.click('text=⏭');
ok((await depth()).includes('Rd8#'), '마지막 장면: ' + await depth());

// 5) 대국 탭으로 돌아가면 그대로
await tab('대국');
ok((await p.$$('.move-row')).length >= 1, '대국 탭으로 돌아오면 두던 판 그대로');

// 6) 프로모션 (사람끼리, 폰이 e7에 있는 판)
await p.goto(URL + '?fen=' + encodeURIComponent('k7/4P3/8/8/8/8/8/4K3 w - - 0 1'));
await p.locator('select.opponent').nth(0).selectOption({ label: '사람 (둘이서)' });
await sq(12).click(); await sq(4).click();
ok(await p.locator('.promo-box').count() === 1, '프로모션 창 뜸');
await p.click('text=취소');
ok(await p.locator('.promo-box').count() === 0 && (await sq(12).textContent()).startsWith('♙'), '취소하면 폰 그대로');
await sq(4).click();
await p.locator('.promo-piece').nth(1).click(); // 룩
ok((await sq(4).textContent()).startsWith('♖'), 'e8에 룩');
ok((await p.$$eval('.move-row', r => r.map(x => x.textContent)))[0].includes('e8=R+'), '기보에 e8=R+');

await finish(b, errs);
