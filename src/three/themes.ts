import * as THREE from 'three';

// 테마 하나 = 배경, 조명, 기물 재질, 판 색을 한데 묶은 것
// 새 테마는 아래 THEMES에 하나 더 추가하면 됨
export interface WoodLook {
  base: string; // 나무 바탕색
  grain: string; // 나뭇결 색
}

export interface Theme {
  id: string; // 주소창 ?theme=... 에 쓰는 이름
  name: string;
  modelMaterials: boolean; // true면 기물과 판에 모델의 원래 재질을 그대로 씀
  background: number;
  envIntensity: number; // 주변 환경 반사 세기
  ambient: number; // 전체 밝기
  sunColor: number;
  sunIntensity: number;
  whitePiece: THREE.MeshPhysicalMaterialParameters;
  blackPiece: THREE.MeshPhysicalMaterialParameters;
  lightSquare: WoodLook;
  darkSquare: WoodLook;
  frame: WoodLook;
  // ── 아래 셋은 적지 않아도 됨 (적지 않으면 클래식과 같게) ──
  // 칸·테두리의 광택: roughness(0 매끈 ~ 1 거침), clearcoat(니스 코팅 0~1). 없으면 니스 칠한 나무
  boardFinish?: { roughness: number; clearcoat: number };
  // 기물에 모델의 조각 자국(노멀 맵)을 빌려 쓸지. 없으면 true(씀)
  pieceCarving?: boolean;
  // 빛 번짐(후광) 세기: 밝은 부분 주변으로 빛이 퍼져 보이게 함. 0이거나 없으면 끔
  bloom?: number;
  // 고를 수 있는 체스 세트 (PIECE_SETS의 이름). 있으면 설정 판에 '체스 세트' 고르기가 생김
  pieceSets?: string[];
}

export const CLASSIC: Theme = {
  id: 'classic',
  name: '클래식',
  modelMaterials: false,
  background: 0x1b1612,
  envIntensity: 0.6,
  ambient: 0.15,
  sunColor: 0xffe2b8, // 따뜻한 빛
  sunIntensity: 2.2,
  // 상아: 살짝 노란 흰색, 은은한 광택
  whitePiece: {
    color: 0xe8d6b0,
    roughness: 0.35,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
  },
  // 흑단: 아주 어두운 갈색, 반짝이는 코팅
  blackPiece: {
    color: 0x1c1410,
    roughness: 0.3,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  },
  lightSquare: { base: '#d6b383', grain: '#a8834f' }, // 단풍나무
  darkSquare: { base: '#6e4527', grain: '#3f2614' }, // 호두나무
  frame: { base: '#3a2414', grain: '#1f130a' },
};

// 대리석: Poly Haven 모델의 원래 재질(대리석 판, 흰/검은 기물)을 그대로 씀
// (아래 기물·판 색은 모델을 못 불러왔을 때만 쓰임)
export const MARBLE: Theme = {
  ...CLASSIC,
  id: 'marble',
  name: '대리석',
  modelMaterials: true,
  envIntensity: 0.8,
  sunIntensity: 2.0,
};

// 미니멀·현대: 밝은 회색 스튜디오, 무광 흰색/검정 기물, 나뭇결 거의 없는 회색 판
export const MINIMAL: Theme = {
  id: 'minimal',
  name: '미니멀',
  modelMaterials: false,
  background: 0xe4e4e1, // 밝은 회색 배경 (바닥도 같은 색)
  envIntensity: 0.8, // 스튜디오처럼 고르게 퍼지는 빛
  ambient: 0.3,
  sunColor: 0xffffff, // 색이 없는 하얀 빛
  sunIntensity: 1.6,
  // 무광 흰색: 거칠기를 높이고 코팅 없음
  whitePiece: {
    color: 0xf7f7f4, // 거의 흰색 (칸을 연회색으로 해서 기물이 칸보다 밝게 보이게)
    roughness: 0.85,
    metalness: 0,
    clearcoat: 0,
  },
  // 무광 검정
  blackPiece: {
    color: 0x1a1a1a,
    roughness: 0.8,
    metalness: 0,
    clearcoat: 0,
  },
  // 나뭇결 색을 바탕색과 거의 같게 해서 결이 거의 안 보이게
  lightSquare: { base: '#a3a6aa', grain: '#9fa2a6' }, // 회색: 흰 기물이 칸에 묻히지 않게
  darkSquare: { base: '#5a5d62', grain: '#56595e' },
  frame: { base: '#2c2d30', grain: '#28292c' },
  boardFinish: { roughness: 0.9, clearcoat: 0 }, // 완전한 무광
  pieceCarving: false, // 매끈한 기물 (나무 조각 결 없음)
};

// 판타지: 아주 어두운 밤, 푸른 달빛, 은은하게 빛나는 기물
// emissive = 기물이 스스로 내는 빛의 색, emissiveIntensity = 그 세기
export const FANTASY: Theme = {
  id: 'fantasy',
  name: '판타지',
  modelMaterials: false,
  background: 0x07060f, // 거의 검은 남보라
  envIntensity: 0.25,
  ambient: 0.05,
  sunColor: 0x8f9cff, // 푸른 달빛
  sunIntensity: 1.2,
  // 흰 쪽: 얼음빛 수정, 하늘색으로 빛남
  whitePiece: {
    color: 0xc4defa,
    roughness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    emissive: 0x3a9cff,
    emissiveIntensity: 0.3,
  },
  // 검은 쪽: 흑요석, 보라색으로 빛남
  blackPiece: {
    color: 0x0e0a18,
    roughness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    emissive: 0x9a3cff,
    emissiveIntensity: 0.12,
  },
  // 어두운 돌판: 결 색을 밝게 해서 마법 무늬처럼
  lightSquare: { base: '#2a2e4a', grain: '#4a5590' },
  darkSquare: { base: '#110e22', grain: '#33256a' },
  frame: { base: '#0b0916', grain: '#3c2c78' },
  bloom: 0.9, // 기물 주변으로 빛이 은은하게 퍼짐
};

// 스포트라이트: 깜깜한 방, 천장에서 한 줄기 빛만 탁자 위로 떨어짐
// 방에는 탁자(대리석 테마 것)와 나무 의자만 있음. 해(방향 빛)는 끄고, 방 안의 스포트라이트 하나로만 비춤
// 체스 세트는 대리석·클래식 중 고를 수 있음 (pieceSets)
export const SPOTLIGHT: Theme = {
  ...CLASSIC,
  id: 'spotlight',
  name: '스포트라이트',
  background: 0x000000, // 완전한 어둠
  envIntensity: 0.06,   // 반사는 아주 조금만 (빛 밖의 물체 윤곽이 겨우 보일 정도)
  ambient: 0.0,
  sunColor: 0xfff1dc,
  sunIntensity: 0,      // 해는 끔 → 방 안 스포트라이트만
  pieceSets: ['marble', 'classic'],
};

export const THEMES: Theme[] = [CLASSIC, MARBLE, MINIMAL, FANTASY, SPOTLIGHT];

// 체스 세트(판·기물 모양)만 다른 테마에서 빌려 옴. 배경·조명은 원래 테마 그대로
export const PIECE_SETS: Record<string, Theme> = { marble: MARBLE, classic: CLASSIC };
export function withPieceSet(theme: Theme, setId: string): Theme {
  if (!theme.pieceSets) return theme;
  const src = PIECE_SETS[theme.pieceSets.includes(setId) ? setId : theme.pieceSets[0]];
  return {
    ...theme,
    modelMaterials: src.modelMaterials,
    whitePiece: src.whitePiece, blackPiece: src.blackPiece,
    lightSquare: src.lightSquare, darkSquare: src.darkSquare, frame: src.frame,
    boardFinish: src.boardFinish, pieceCarving: src.pieceCarving,
  };
}

