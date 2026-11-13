// ---------- TURN 연결 서버 (친구와 온라인) ----------
// 학교 와이파이·휴대폰 데이터처럼 두 브라우저가 직접 연결되지 못하는 곳에서는
// TURN 서버가 수를 대신 전달해 줌 (그 경우에만 쓰이고, 직접 연결되면 안 씀)
//
// 방법 1 (지금 쓰는 것): Metered 대시보드 → TURN Server → Credentials → Get Credential → Show ICE Servers Array
//   에서 나온 목록을 아래 TURN_SERVERS에 그대로 붙여 넣음 (앱: chess_beep, 라벨: chess)
// 방법 2: 같은 화면의 Show API Key로 받은 주소를 TURN_CREDENTIALS_URL에
//   https://앱이름.metered.live/api/v1/turn/credentials?apiKey=API키
//   (둘 다 있으면 방법 2를 먼저 시도하고, 실패하면 방법 1)
// 둘 다 비우면 TURN 없이 직접 연결만 함
// 이 값은 GitHub에서 누구나 볼 수 있음 → 다른 사람이 쓰면 무료 사용량이 줄 수 있음.
// 사용량이 이상하게 늘면 Metered에서 이 Credential을 지우고 새로 만들어 여기 바꿔 넣기
export const TURN_CREDENTIALS_URL = '';

export const TURN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: '945b544e68bbc6b7ccb836fa', credential: 'BEL5RGsQz7vPToCM' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: '945b544e68bbc6b7ccb836fa', credential: 'BEL5RGsQz7vPToCM' },
  { urls: 'turn:global.relay.metered.ca:443', username: '945b544e68bbc6b7ccb836fa', credential: 'BEL5RGsQz7vPToCM' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: '945b544e68bbc6b7ccb836fa', credential: 'BEL5RGsQz7vPToCM' },
];
