// 브라우저 테스트 공용 도구
// 쓰는 법: (터미널 한 탭) npm run build && npx vite preview
//          (다른 탭)     node tests/browser/run-all.mjs
// 주소를 바꾸려면 맨 뒤에 붙임: node tests/browser/play-2d.mjs http://localhost:4173/chess_beep-ai/
import { chromium } from 'playwright-core';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const URL = process.argv[2] || 'http://localhost:4173/chess_beep-ai/';
export const TMP = os.tmpdir();
export const tmp = name => path.join(TMP, name);

// 크롬 위치: CHROME_PATH가 있으면 그걸, 없으면 맥/리눅스 기본 위치에서 찾음
function chromePath() {
  const list = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  const found = list.find(p => fs.existsSync(p));
  if (!found) throw new Error('크롬을 못 찾았어요. CHROME_PATH=크롬경로 를 앞에 붙여 실행하세요.');
  return found;
}

// webgl: 3D 테스트용. 화면 없는 크롬에서도 3D가 돌게 소프트웨어 그래픽을 켬 (대신 느림)
export async function launch({ webgl = false } = {}) {
  const args = ['--no-sandbox'];
  if (webgl) args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist');
  return chromium.launch({ executablePath: chromePath(), args });
}

let failed = 0;
export const ok = (c, m) => { if (!c) failed++; console.log((c ? '✅ ' : '❌ ') + m); };

// 페이지 오류 모으기
export function watchErrors(p) {
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  return errs;
}

// 끝: 오류가 있거나 ❌가 하나라도 있으면 실패(종료 코드 1)
export async function finish(browser, errs) {
  ok(errs.length === 0, '페이지 오류: ' + (errs.length ? errs.join(' / ') : '없음'));
  await browser.close();
  process.exit(failed ? 1 : 0);
}

// 오페라 게임 (모피 1858) — 기보 보기 테스트용
export const OPERA_PGN = `[White "Morphy"]\n[Black "Duke"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`;

export async function loadPGN(p) {
  const file = tmp('chess-opera.pgn');
  fs.writeFileSync(file, OPERA_PGN);
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('text=기보 불러오기')]);
  await chooser.setFiles(file);
  await p.waitForTimeout(500);
}
