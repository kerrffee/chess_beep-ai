import { fromFEN, initialGame } from './src/board';
import { chooseMove, mistakeStats } from './src/ai';
import { findPersonality } from './src/personality';

const name = (s: number) => 'abcdefgh'[s % 8] + (Math.floor(s / 8) + 1);
const fast = (id: string) => ({ ...findPersonality(id), timeLimit: 300 });

// 1) 퀸 사랑꾼: 흑 퀸이 d줄로 내 퀸을 노리는 장면. 퀸끼리 바꾸기(d1→d8)를 하는지
//    (흑 킹이 바로 다시 잡을 수 있어서, 대가 입장에선 그냥 맞교환)
const qTrade = fromFEN('3qk3/ppp5/8/8/8/8/PPP5/3QK3 w - - 0 1');
for (const id of ['master', 'queenlover']) {
  let trades = 0;
  for (let i = 0; i < 6; i++) {
    const m = chooseMove(fast(id), structuredClone(qTrade));
    if (m.from === 3 && m.to === 59) trades++;
  }
  console.log(`퀸 맞교환 장면 — ${findPersonality(id).name}: 6번 중 ${trades}번 퀸을 바꿈`);
}

// 2) 혼돈: 시작 배치 첫 수가 얼마나 다양한지 (대가와 비교)
for (const id of ['master', 'chaos']) {
  const counts: Record<string, number> = {};
  mistakeStats.made = 0;
  for (let i = 0; i < 12; i++) {
    const g = initialGame();
    const m = chooseMove(fast(id), g);
    const key = `${g.board[m.from]!.type} ${name(m.from)}-${name(m.to)}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  console.log(`첫 수 12번 — ${findPersonality(id).name}: ${Object.keys(counts).length}종류 ${JSON.stringify(counts)}${id === 'chaos' ? `, 일부러 실수 ${mistakeStats.made}번` : ''}`);
}
