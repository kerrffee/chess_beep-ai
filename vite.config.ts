import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// public/models 안 파일마다 내용으로 만든 짧은 지문 (예: 'character/random.glb' → 'a1b2c3d4')
// 게임은 모델 주소 끝에 ?v=지문 을 붙여 불러옴 (src/three/modelUrl.ts)
// → 모델을 바꿔서 배포하면 주소가 달라져서, 브라우저가 기억해 둔 옛 모델 대신 새 모델을 받음
//   (GitHub Pages는 파일을 10분 동안 기억하게 해서, 같은 주소면 옛 모델이 계속 보였음 — 2026-11-12 랜덤2)
//   안 바뀐 모델은 주소도 그대로라 다시 받지 않음
function modelHashes(): Record<string, string> {
  const root = join(__dirname, 'public', 'models');
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(root, p).split('\\').join('/')] = createHash('md5').update(readFileSync(p)).digest('hex').slice(0, 8);
    }
  };
  try { walk(root); } catch { /* 폴더가 없으면 지문 없이 */ }
  return out;
}

// GitHub Pages에서는 게임이 https://아이디.github.io/chess_beep-ai/ 처럼 "chess_beep-ai/" 폴더 아래에 놓임
// 그래서 배포용으로 만들 때(build)와 그 결과를 미리 볼 때(preview)는 파일 주소 앞에 /chess_beep-ai/를 붙임
// 개발할 때(npm run dev)는 지금처럼 localhost:5173/ 그대로
// 저장소 이름을 바꾸면 아래 '/chess_beep-ai/'도 같은 이름으로 바꿔야 함
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/chess_beep-ai/',
  define: { __MODEL_HASHES__: JSON.stringify(modelHashes()) },
}));
