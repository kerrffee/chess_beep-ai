// AI 전용 일꾼(Web Worker). 화면과 따로 돌아서, AI가 오래 생각해도 화면이 멈추지 않음
// 화면(main.ts)이 보내는 것: { id, personalityId, game, history, timeLimit, moveHistory }
//   personalityId = 어떤 성격의 AI인지 (personality.ts)
//   history = 지금까지 나온 장면들 (AI가 같은 장면 반복으로 무승부를 내지 않게)
//   timeLimit = 성격에 생각 시간이 정해져 있지 않을 때 쓸 시간(ms)
//   moveHistory = 처음부터 둔 수 목록 (오프닝 확인용. 처음 배치에서 시작한 게임이 아니면 없음)
// 돌려주는 것: { id, move, depth, score, book }
//   depth = 끝까지 본 깊이, score = AI 입장 형세 점수(+면 AI 유리), book = 오프닝 목록에서 둔 수인지
import { chooseMove, stats } from './ai';
import { findPersonality } from './personality';
import type { GameState } from './board';

self.onmessage = (e: MessageEvent<{
  id: number; personalityId: string; game: GameState; history: string[]; timeLimit: number; moveHistory?: string[];
}>) => {
  const { id, personalityId, game, history, timeLimit, moveHistory } = e.data;
  stats.depth = 0;
  const move = chooseMove(findPersonality(personalityId), game, history, timeLimit, moveHistory);
  self.postMessage({ id, move, depth: stats.depth, score: stats.score, book: stats.book });
};
