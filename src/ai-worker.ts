// AI 전용 일꾼(Web Worker). 화면과 따로 돌아서, AI가 오래 생각해도 화면이 멈추지 않음
// 부탁은 두 종류
//
// 1) 한 수 골라 줘 (대국·구경): { id, personalityId, game, history, timeLimit, moveHistory }
//    personalityId = 어떤 성격의 AI인지 (personality.ts)
//    history = 지금까지 나온 장면들 (AI가 같은 장면 반복으로 무승부를 내지 않게)
//    timeLimit = 성격에 생각 시간이 정해져 있지 않을 때 쓸 시간(ms)
//    moveHistory = 처음부터 둔 수 목록 (오프닝 확인용. 처음 배치에서 시작한 게임이 아니면 없음)
//    → { id, move, depth, score, book, queenDoomed }
//      depth = 끝까지 본 깊이, score = AI 입장 형세 점수(+면 AI 유리), book = 오프닝 목록에서 둔 수인지
//      랜덤·욕심쟁이는 수를 고른 뒤 그 수를 둔 판을 잠깐 살펴서 score를 채움 (depth는 0)
//      queenDoomed = 퀸 사랑꾼이 "퀸이 먹힐 수밖에 없다"고 봤는지 (기권 판단용)
//
// 2) 한 판 끝까지 둬 줘 (리그): { type: 'game', id, white, black, timeLimit }
//    white, black = 성격 id. timeLimit = 생각하는 AI 모두의 한 수 시간(ms)
//    → { type: 'gameResult', id, result, reason, ucis }
//      result = '1-0' | '0-1' | '1/2-1/2', reason = 끝난 이유, ucis = 둔 수 목록
import { chooseMove, stats, moveToUci, scoreAfterMove } from './ai';
import { findPersonality } from './personality';
import { initialGame, type GameState } from './board';
import { gameStatus, makeMove, positionKey } from './moves';

const MAX_PLIES = 400; // 리그에서 한 판이 끝없이 길어지지 않게 (200수에서 무승부 처리)

const REASON: Record<string, string> = {
  checkmate: '체크메이트', stalemate: '스테일메이트', fifty: '50수', repetition: '3회 반복', material: '기물 부족',
};

function playWholeGame(whiteId: string, blackId: string, timeLimit: number) {
  // 생각하는 AI는 모두 같은 시간으로 (리그는 빨리 끝나야 해서)
  const persona = (id: string) => ({ ...findPersonality(id), timeLimit });
  const players = { w: persona(whiteId), b: persona(blackId) };
  const game = initialGame();
  const history = [positionKey(game)];
  const ucis: string[] = [];
  while (ucis.length < MAX_PLIES) {
    const status = gameStatus(game, history);
    if (status === 'checkmate') return { result: game.turn === 'w' ? '0-1' : '1-0', reason: REASON[status], ucis };
    if (status !== 'playing') return { result: '1/2-1/2', reason: REASON[status], ucis };
    const move = chooseMove(players[game.turn], game, history, timeLimit, ucis);
    makeMove(game, move);
    ucis.push(moveToUci(move));
    history.push(positionKey(game));
  }
  return { result: '1/2-1/2', reason: '수 제한(200수)', ucis };
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (data.type === 'game') {
    const { result, reason, ucis } = playWholeGame(data.white, data.black, data.timeLimit);
    self.postMessage({ type: 'gameResult', id: data.id, result, reason, ucis });
    return;
  }
  const { id, personalityId, game, history, timeLimit, moveHistory } = data as {
    id: number; personalityId: string; game: GameState; history: string[]; timeLimit: number; moveHistory?: string[];
  };
  stats.depth = 0;
  const persona = findPersonality(personalityId);
  const move = chooseMove(persona, game, history, timeLimit, moveHistory);
  if (persona.kind !== 'search') {
    const score = scoreAfterMove(game, move, history);
    self.postMessage({ id, move, depth: 0, score, book: false, queenDoomed: false });
    return;
  }
  self.postMessage({ id, move, depth: stats.depth, score: stats.score, book: stats.book, queenDoomed: stats.queenDoomed });
};
