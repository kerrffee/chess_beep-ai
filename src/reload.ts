// ---------- 새 버전이 배포됐을 때 ----------
// 사이트를 열어 둔 사이에 새 버전이 배포되면, 나중에 불러오는 파일(3D 코드, AI 일꾼)의 이름이 바뀌고
// 옛 파일은 지워져서 "파일을 못 찾음" 오류가 남. 그럴 때 한 번 새로고침해서 새 버전을 받게 함
// (같은 문제로 계속 새로고침이 반복되지 않게, 30초 안에 또 실패하면 새로고침하지 않음)
const KEY = 'chess.reloadedAt';

export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false; // 방금 새로고침했는데 또 실패 → 다른 문제
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // 기록을 못 남기면 반복될 수 있어서 새로고침 안 함
  }
  location.reload();
  return true;
}

// 오류가 "나중에 불러오는 파일을 못 찾음"인지 (브라우저마다 문장이 조금씩 다름)
export function isMissingChunk(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i.test(msg);
}

// Vite가 파일을 미리 불러오다 실패했을 때 알려 주는 신호
window.addEventListener('vite:preloadError', event => {
  if (reloadForNewVersion()) event.preventDefault();
});
