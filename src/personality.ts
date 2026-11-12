// ---------- 성격 ----------
// 성격 하나 = 설정 묶음 하나. 새 성격은 아래 PERSONALITIES에 하나 더 적기만 하면 메뉴에 생김
// 성격은 "말"만이 아니라 "수를 고르는 방식"에서도 나와야 재밌음:
//   기물 값(values), 평가 가중치(weights), 생각 시간(timeLimit), 실수 확률(mistakeChance),
//   좋아하는 오프닝(openings), 기권 기준(resignAt, resignOnQueenLoss), 상황별 대사(lines)
import type { PieceType } from './board';
import type { EvalWeights } from './ai';

// 대사가 나오는 상황
export type SpeechEvent =
  | 'start'    // 게임 시작
  | 'capture'  // AI가 상대 기물을 잡음
  | 'lost'     // AI가 기물을 잃음
  | 'check'    // AI가 체크를 걺
  | 'good'     // 형세 점수가 확 좋아짐 (상대가 실수함)
  | 'bad'      // 형세 점수가 확 나빠짐 (상대가 좋은 수를 둠)
  | 'winning'  // 꽤 이기고 있음 (가끔)
  | 'losing'   // 꽤 지고 있음 (가끔)
  | 'win' | 'lose' | 'draw' // 게임 끝
  | 'resign';  // 기권

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
  // 좋아하는 오프닝: 처음부터 백·흑 수를 번갈아 적은 줄들 (출발칸+도착칸, 예: e2e4)
  // 지금까지 둔 수가 어떤 줄의 앞부분과 같으면, 그 줄의 다음 수를 그대로 둠
  openings?: string[][];
  resignAt?: number;      // AI 입장 점수가 이보다 낮은 게 2수 연속이면 기권 (없으면 절대 기권 안 함)
  resignOnQueenLoss?: boolean; // true면 "내 퀸이 먹힐 수밖에 없다"고 보는 순간 바로 기권 (퀸 사랑꾼용)
  lines?: Partial<Record<SpeechEvent, string[]>>; // 상황별 대사 (없거나 빈 목록이면 조용히)
}

export const PERSONALITIES: Personality[] = [
  {
    id: 'master', name: '대가', kind: 'search',
    description: '말이 적고 강하다. 가장 센 상대',
    openings: [
      ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'],          // 백: 루이 로페즈
      ['d2d4', 'd7d5', 'c2c4', 'e7e6'],                  // 백: 퀸스 갬빗 (흑 응수까지)
      ['e2e4', 'c7c5', 'g1f3', 'd7d6', 'd2d4'],          // 흑 시실리안을 만나면
      ['e2e4', 'e7e5', 'g1f3', 'b8c6'],                  // 흑: e4에는 e5
      ['d2d4', 'g8f6', 'c2c4', 'e7e6'],                  // 흑: d4에는 나이트부터
    ],
    lines: {
      start: ['…'],
      win: ['좋은 대국이었다.'],
      lose: ['…훌륭하다.'],
      draw: ['…비김인가.'],
    },
  },
  {
    id: 'attacker', name: '돌격대장', kind: 'search', timeLimit: 700,
    description: '후퇴를 모른다. 상대 킹을 향해 전원 돌격. 절대 기권 안 함',
    weights: { kingAttack: 35, kingShield1: 3, kingShield2: 1, kingOpenFile: 5 },
    openings: [
      ['e2e4', 'e7e5', 'f2f4'],                          // 백: 킹스 갬빗 (폰을 버리고 공격)
      ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'f3g5'], // 백: 이탈리안에서 바로 공격
      ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'],  // 흑: 같이 맞불
      ['d2d4', 'd7d5', 'c2c4', 'e7e5'],                  // 흑: 앨빈 카운터갬빗 (폰을 버리고 반격)
    ],
    lines: {
      start: ['전원 돌격 준비!', '오늘도 앞으로만 간다!'],
      capture: ['돌파!', '길을 열어라!', '하나 쓰러뜨렸다!'],
      lost: ['희생은 각오했다!', '괜찮아, 계속 전진!', '물러서지 마라!'],
      check: ['킹, 거기 있었구나!', '포위했다!', '돌격!!'],
      good: ['틈이 보인다! 밀어붙여!'],
      bad: ['후퇴? 그런 단어는 모른다.'],
      losing: ['아직 끝나지 않았다! 돌격!'],
      win: ['돌격이 답이었다!'],
      lose: ['다음엔 더 빨리 돌격하겠다…'],
      draw: ['…돌격이 부족했나.'],
    },
  },
  {
    id: 'coward', name: '겁쟁이', kind: 'search', timeLimit: 700,
    description: '킹 안전에 집착하고, 교환은 피한다. 불리하면 금방 기권',
    weights: { kingShield1: 35, kingShield2: 18, kingOpenFile: 50, tradeAversion: 25 },
    resignAt: -300, // 폰 3개쯤 지고 있으면 포기
    openings: [
      ['d2d4', 'd7d5', 'c1f4', 'g8f6', 'e2e3'],          // 백: 런던 시스템 (단단하게)
      ['e2e4', 'c7c6', 'd2d4', 'd7d5'],                  // 흑: 카로칸 (단단하게)
      ['d2d4', 'd7d5', 'c2c4', 'c7c6'],                  // 흑: 슬라브 (단단하게)
    ],
    lines: {
      start: ['사, 살살 해 주세요…', '킹부터 숨겨야지…'],
      capture: ['어, 어쩌다 잡았네…', '미안해…'],
      lost: ['으악!', '그거 아끼던 건데…', '교환은… 다음에 하자…'],
      check: ['체, 체크… 화내지 마세요…'],
      good: ['어? 내가 이기고 있어…?'],
      bad: ['이럴 줄 알았어…', '무서워…'],
      losing: ['집에 가고 싶다…'],
      win: ['이, 이겼다…? 진짜로…?'],
      lose: ['역시 무리였어…'],
      draw: ['비겼다… 다행이다…'],
      resign: ['더는 못 하겠어요… 기권할게요…'],
    },
  },
  {
    id: 'queenlover', name: '퀸 사랑꾼', kind: 'search', timeLimit: 700,
    description: '퀸만은 절대 내줄 수 없다. 퀸을 못 지키게 되면 그 자리에서 기권',
    values: { q: 2500 },
    resignOnQueenLoss: true,
    openings: [
      ['e2e4', 'e7e5', 'd1h5'],                          // 백: 퀸부터 출동
      ['e2e4', 'd7d5', 'e4d5', 'd8d5'],                  // 흑: 스칸디나비안 (퀸이 바로 나옴)
      ['d2d4', 'd7d5', 'c2c4', 'd5c4', 'e2e3', 'd8d5'],  // 흑: 퀸이 폰을 지키러
    ],
    lines: {
      start: ['내 퀸, 오늘도 아름답구나.'],
      capture: ['퀸, 잘했어!', '역시 우리 퀸!'],
      lost: ['괜찮아, 퀸만 무사하면 돼.', '퀸은 안 다쳤지?'],
      check: ['퀸의 이름으로!'],
      good: ['퀸이 기뻐하고 있어!'],
      bad: ['퀸 근처엔 오지 마!', '퀸만은 안 돼!'],
      losing: ['퀸, 내가 지켜 줄게…'],
      win: ['퀸 덕분이야. 사랑해, 퀸.'],
      lose: ['퀸, 미안해…'],
      draw: ['퀸이 무사했으니 됐어.'],
      resign: ['퀸이 다치게 둘 수 없어.'],
    },
  },
  {
    id: 'bluffer', name: '허세꾼', kind: 'search', timeLimit: 300,
    description: '실력은 중간, 말은 세계 최강',
    mistakeChance: 0.15, mistakeMargin: 120,
    openings: [
      ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4'],          // 백: 4수 메이트 노리기 (통하면 좋고)
      ['e2e4', 'e7e5', 'f1c4'],
      ['e2e4', 'e7e5', 'g1f3', 'b8c6'],                  // 흑: 무난하게
      ['d2d4', 'd7d5'],
    ],
    lines: {
      start: ['세계 랭킹 1위가 상대해 주지.', '3수 안에 끝내 주마.'],
      capture: ['당연하지.', '예상 범위 안이야.', '이게 바로 실력이다.'],
      lost: ['일부러 준 거야.', '미끼라고, 미끼.', '계산대로야.'],
      check: ['벌써 끝났네.', '항복해도 괜찮아.'],
      good: ['역시 나야.', '너무 쉬운데?'],
      bad: ['계산대로야.', '이것도 다 작전이지.'],
      winning: ['슬슬 지루해지는데.'],
      losing: ['지금 봐주는 중이야.', '이제부터 진심이다.', '계산대로야.'],
      win: ['처음부터 이렇게 될 줄 알았지.'],
      lose: ['…오늘은 봐준 거야.', '컨디션이 10%였어.'],
      draw: ['봐준 거야.'],
    },
  },
  {
    id: 'excuser', name: '핑계왕', kind: 'search', timeLimit: 500,
    description: '평범하게 두지만, 지면 언제나 남 탓',
    openings: [
      ['d2d4', 'g8f6', 'c2c4', 'e7e6'],
      ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'],
      ['e2e4', 'e7e5'],
      ['d2d4', 'd7d5'],
    ],
    lines: {
      start: ['오늘 손가락이 좀 아픈데… 그래도 해 볼게.'],
      capture: ['이건 실력이지.'],
      lost: ['방금 마우스가 미끄러졌어.', '판이 좀 기울어진 것 같은데?', '조명 때문에 잘 안 보였어.'],
      bad: ['오늘 기물들 컨디션이 별로네.', '아까 그 수는 고양이가 둔 거야.'],
      losing: ['배고파서 집중이 안 돼…'],
      win: ['봤지? 원래 이 정도야.'],
      lose: ['오늘 기물들 컨디션이 별로였어.', '판이 기울어져 있었어. 확실해.', '와이파이 때문이야.'],
      draw: ['원래 이겼어야 했는데, 의자가 불편해서.'],
    },
  },
  {
    id: 'chaos', name: '혼돈', kind: 'search', timeLimit: 500,
    description: '예측 불가. 가끔 이유 없이 엉뚱한 수를 둔다',
    mistakeChance: 0.35, mistakeMargin: 200,
    openings: [
      ['g2g4'],                                          // 백: 그롭 (아무도 안 두는 첫 수)
      ['b2b4'],                                          // 백: 폴리시
      ['e2e4', 'g7g5'],                                  // 흑: 보르그
      ['d2d4', 'b7b5'],                                  // 흑: 폴리시 디펜스
    ],
    lines: {
      start: ['이유? 그런 건 없어.', '🎲'],
      capture: ['냠.', '왜 잡았냐고? 몰라.'],
      lost: ['상관없어.', '그것도 운명.'],
      check: ['체크? 체크!'],
      good: ['혼돈이 너를 삼킨다.'],
      bad: ['재밌어지는데?'],
      win: ['이유? 그런 건 없어.'],
      lose: ['이기는 것도 지는 것도 다 같은 혼돈.'],
      draw: ['…?'],
    },
  },
  {
    id: 'greedy', name: '욕심쟁이', kind: 'greedy',
    description: '잡을 수 있으면 무조건 잡는다. 앞은 안 본다',
    lines: {
      start: ['맛있는 거 어디 있지?'],
      capture: ['공짜다!', '냠냠!', '이것도 내 거!'],
      lost: ['어? 내 거 어디 갔어?', '그건 미끼가 아니었는데…'],
      win: ['다 먹었다!'],
      lose: ['배는 부른데…'],
      draw: ['더 먹고 싶었는데.'],
    },
  },
  {
    id: 'random', name: '랜덤', kind: 'random',
    description: '아무 수나 둔다',
  },
];

export function findPersonality(id: string): Personality {
  return PERSONALITIES.find(p => p.id === id) ?? PERSONALITIES[0];
}
