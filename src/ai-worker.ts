// AI 전용 일꾼(Web Worker). 화면과 따로 돌아서, AI가 오래 생각해도 화면이 멈추지 않음
// 화면(main.ts)이 { id, kind, game }을 보내면 → 수를 골라서 { id, move }로 돌려줌
import { chooseMove, type AIKind } from './ai';
import type { GameState } from './board';

self.onmessage = (e: MessageEvent<{ id: number; kind: AIKind; game: GameState }>) => {
  const { id, kind, game } = e.data;
  const move = chooseMove(kind, game);
  self.postMessage({ id, move });
};
