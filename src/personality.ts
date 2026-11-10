// ---------- 성격 ----------
// 성격 하나 = 설정 묶음 하나. 새 성격은 아래 PERSONALITIES에 하나 더 적기만 하면 메뉴에 생김
// 성격은 "말"이 아니라 "수를 고르는 방식"에서 나와야 재밌음:
//   기물 값(values), 평가 가중치(weights), 생각 시간(timeLimit), 실수 확률(mistakeChance)
import type { PieceType } from './board';
import type { EvalWeights } from './ai';

export interface Personality {
  id: string;
  name: string;           // 메뉴에 보이는 이름
  description: string;    // 메뉴 아래 한 줄 설명
  kind: 'random' | 'greedy' | 'search'; // 랜덤 / 욕심쟁이(앞을 안 봄) / 생각하는 AI(탐색)
  // 아래는 search일 때만 씀. 적지 않은 항목은 기본값(대가와 같음)
  values?: Partial<Record<PieceType, number>>; // "내" 기물 값 (폰 1개 = 100)
  weights?: Partial<EvalWeights>;              // "내" 평가 가중치 (ai.ts의 EVAL_WEIGHTS 참고)
  timeLimit?: number;     // 한 수에 쓰는 시간(ms). 없으면 화면에서 고른 시간
  mistakeChance?: number; // 0~1. 이 확률로 최선의 수 대신 "그럭저럭 괜찮은 다른 수"를 둠
  mistakeMargin?: number; // 실수할 때 최선보다 이만큼(점수)까지 나쁜 수 중에서 고름
}

export const PERSONALITIES: Personality[] = [
  {
    id: 'master', name: '대가', kind: 'search',
    description: '말이 적고 강하다. 가장 센 상대',
  },
  {
    id: 'attacker', name: '돌격대장', kind: 'search', timeLimit: 700,
    description: '후퇴를 모른다. 상대 킹을 향해 전원 돌격',
    // 상대 킹 근처에 기물을 보내는 걸 아주 좋아하고, 내 킹 방패는 별로 신경 안 씀
    weights: { kingAttack: 35, kingShield1: 3, kingShield2: 1, kingOpenFile: 5 },
  },
  {
    id: 'coward', name: '겁쟁이', kind: 'search', timeLimit: 700,
    description: '킹 안전에 집착하고, 기물 교환은 무서워서 피한다',
    // 내 킹 방패를 3~4배 중요하게 보고, 판에 기물이 많이 남아 있는 걸 좋아함
    weights: { kingShield1: 35, kingShield2: 18, kingOpenFile: 50, tradeAversion: 25 },
  },
  {
    id: 'queenlover', name: '퀸 사랑꾼', kind: 'search', timeLimit: 700,
    description: '퀸만은 절대 내줄 수 없다',
    // 내 퀸만 아주 비싸게 봄 (상대 퀸은 그대로 900) → 퀸끼리 바꾸는 것도 큰 손해로 느낌
    values: { q: 2500 },
  },
  {
    id: 'chaos', name: '혼돈', kind: 'search', timeLimit: 500,
    description: '예측 불가. 가끔 이유 없이 엉뚱한 수를 둔다',
    // 35% 확률로, 최선보다 폰 2개 이하로 나쁜 수 중 아무거나
    mistakeChance: 0.35, mistakeMargin: 200,
  },
  {
    id: 'greedy', name: '욕심쟁이', kind: 'greedy',
    description: '잡을 수 있으면 무조건 잡는다. 앞은 안 본다',
  },
  {
    id: 'random', name: '랜덤', kind: 'random',
    description: '아무 수나 둔다',
  },
];

export function findPersonality(id: string): Personality {
  return PERSONALITIES.find(p => p.id === id) ?? PERSONALITIES[0];
}
