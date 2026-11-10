// AI 전용 일꾼(Web Worker). 화면과 따로 돌아서, AI가 오래 생각해도 화면이 멈추지 않음
// 화면(main.ts)이 { id, kind, game }을 보내면 → 수를 골라서 { id, move, depth }로 돌려줌
// depth = 생각하는 AI가 끝까지 본 깊이 (다른 AI는 0)
import { chooseMove, stats, type AIKind } from './ai';
import type { GameState } from './board';

self.onmessage = (e: MessageEvent<{ id: number; kind: AIKind; game: GameState }>) => {
  const { id, kind, game } = e.data;
  stats.depth = 0;
  const move = chooseMove(kind, game);
  self.postMessage({ id, move, depth: stats.depth });
};
