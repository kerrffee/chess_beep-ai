import { defineConfig } from 'vite';

// GitHub Pages에서는 게임이 https://아이디.github.io/chess-ai/ 처럼 "chess-ai/" 폴더 아래에 놓임
// 그래서 배포용으로 만들 때(build)와 그 결과를 미리 볼 때(preview)는 파일 주소 앞에 /chess-ai/를 붙임
// 개발할 때(npm run dev)는 지금처럼 localhost:5173/ 그대로
// 저장소 이름을 chess-ai가 아닌 다른 이름으로 만들면 아래 '/chess-ai/'도 같은 이름으로 바꿔야 함
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/chess-ai/',
}));
