// ---------- 효과음 ----------
// 소리 파일 없이 브라우저에서 바로 만들어 냄 (Web Audio)
//   둘 때: 나무 위에 기물을 "톡" 내려놓는 소리 (짧은 잡음 + 낮은 울림)
//   잡을 때: 조금 더 크고 두 번 부딪히는 소리
//   체크: 높은 "띵"   /   체크메이트: 낮게 울리는 "둥"
// 브라우저는 사람이 화면을 한 번 누르기 전에는 소리를 못 내게 막아 둬서, 첫 클릭 뒤부터 남
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // 소리를 지원하지 않는 브라우저면 조용히
  }
}

// "톡": 아주 짧은 잡음을 대역 필터로 걸러 나무 소리처럼 + 낮은 사인파
function knock(at: number, volume: number, pitch: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  // 잡음 부분
  const len = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const band = a.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800 * pitch;
  band.Q.value = 1.2;
  const g1 = a.createGain();
  g1.gain.value = volume;
  noise.connect(band).connect(g1).connect(a.destination);
  noise.start(t);
  // 낮은 울림 부분
  const osc = a.createOscillator();
  osc.frequency.setValueAtTime(220 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(110 * pitch, t + 0.08);
  const g2 = a.createGain();
  g2.gain.setValueAtTime(volume * 0.5, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g2).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

function tone(freq: number, length: number, volume: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

// 둔 수의 표기(e4, Nxe5, Qh7+, Qf7# …)를 보고 알맞은 소리
export function playMoveSound(san: string) {
  if (san.endsWith('#')) { knock(0, 0.6, 0.8); tone(110, 1.2, 0.25); return; }
  if (san.includes('x')) { knock(0, 0.7, 1); knock(0.06, 0.4, 1.3); }
  else knock(0, 0.5, 1);
  if (san.endsWith('+')) tone(880, 0.35, 0.12);
}

// 첫 클릭 때 소리 장치를 깨워 둠 (그래야 AI가 둘 때도 소리가 남)
export function unlockAudio() { audio(); }
