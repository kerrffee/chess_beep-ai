// 엔진·규칙 테스트 전부 실행 (맨 위 폴더의 *-test.ts, perft.ts)
// 쓰는 법: npm test
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['perft.ts', ...fs.readdirSync(root).filter(f => f.endsWith('-test.ts')).sort()];
// 테스트 파일들은 끝날 때 실패 코드를 안 내서, 출력에 ❌가 있는지로 판단
// (✅/❌ 없이 숫자만 보여 주는 테스트는 사람이 눈으로 확인)
const bad = [], lookOnly = [];
for (const f of files) {
  console.log(`\n── ${f} ──`);
  const r = spawnSync('npx', ['--yes', 'tsx', f], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(out);
  if (r.status !== 0 || out.includes('❌')) bad.push(f);
  else if (!out.includes('✅')) lookOnly.push(f);
}
if (lookOnly.length) console.log(`\n👀 숫자만 보여 주는 테스트 (눈으로 확인): ${lookOnly.join(', ')}`);
console.log(bad.length ? `\n❌ 실패: ${bad.join(', ')}` : `\n✅ ❌ 없음 (테스트 ${files.length}개)`);
process.exit(bad.length ? 1 : 0);
