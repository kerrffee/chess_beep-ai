// 브라우저 테스트 전부 실행
// 먼저 다른 탭에서: npm run build && npx vite preview
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] || 'http://localhost:4173/chess_beep-ai/';
const files = ['play-2d.mjs', 'view-3d.mjs', 'replay-3d.mjs', 'online-2p.mjs']; // online-2p는 인터넷 필요
const bad = [];
for (const f of files) {
  console.log(`\n── ${f} ──`);
  const r = spawnSync(process.execPath, [path.join(dir, f), url], { stdio: 'inherit' });
  if (r.status !== 0) bad.push(f);
}
console.log(bad.length ? `\n❌ 실패: ${bad.join(', ')}` : '\n✅ 브라우저 테스트 전부 통과');
process.exit(bad.length ? 1 : 0);
