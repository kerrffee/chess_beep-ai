// ---------- TURN 연결 서버 (친구와 온라인) ----------
// 학교 와이파이·휴대폰 데이터처럼 두 브라우저가 직접 연결되지 못하는 곳에서는
// TURN 서버가 수를 대신 전달해 줌 (그 경우에만 쓰이고, 직접 연결되면 안 씀)
//
// 쓰는 법 (무료, Metered):
//   1. https://dashboard.metered.ca/signup 에서 가입 → 앱 이름을 정함 (예: chessbeep)
//   2. 왼쪽 메뉴 "TURN Server" → "Add Credential"(또는 이미 있는 줄) → "Show API Key"
//   3. 아래 따옴표 안에 이렇게 붙여 넣기 (앱 이름과 API 키를 바꿔서):
//      https://앱이름.metered.live/api/v1/turn/credentials?apiKey=API키
// 비워 두면 TURN 없이 지금처럼 연결함
// (이 키는 브라우저에서 써도 되는 키라서 GitHub에 올라가도 괜찮지만, 다른 사람이 쓰면 무료 사용량이 줄 수 있음)
export const TURN_CREDENTIALS_URL = '';
