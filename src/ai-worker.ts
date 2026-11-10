// AI 전용 일꾼(Web Worker). 화면과 따로 돌아서, AI가 오래 생각해도 화면이 멈추지 않음
// 화면(main.ts)이 { id, personalityId, game, history, timeLimit }을 보내면 → 수를 골라서 { id, move, depth }로 돌려줌
// personalityId = 어떤 성격의 AI인지 (personality.ts)
// history = 지금까지 나온 장면들 (AI가 같은 장면 반복으로 무승부를 내지 않게)
// timeLimit = 성격에 생각 시간이 정해져 있지 않을 때 쓸 시간(ms)
// depth = 생각하는 AI가 끝까지 본 깊이 (랜덤·욕심쟁이는 0)
import { chooseMove, stats } from './ai';
import { findPersonality } from './personality';
import type { GameState } from './board';

self.onmessage = (e: MessageEvent<{ id: number; personalityId: string; game: GameState; history: string[]; timeLimit: number }>) => {
  const { id, personalityId, game, history, timeLimit } = e.data;
  stats.depth = 0;
  const move = chooseMove(findPersonality(personalityId), game, history, timeLimit);
  self.postMessage({ id, move, depth: stats.depth });
};
