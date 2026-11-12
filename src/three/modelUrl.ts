// 모델 파일 주소: public/models/ 아래 경로 → 실제 주소 + ?v=내용 지문 (vite.config.ts의 modelHashes)
// 모델을 바꿔 배포하면 지문이 바뀌어서 브라우저가 옛 모델을 다시 쓰지 않음
declare const __MODEL_HASHES__: Record<string, string>;

export function modelUrl(path: string): string {
  const v = __MODEL_HASHES__[path];
  return import.meta.env.BASE_URL + 'models/' + path + (v ? '?v=' + v : '');
}
