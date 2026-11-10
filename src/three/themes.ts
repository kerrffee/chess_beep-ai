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

export const THEMES: Theme[] = [CLASSIC, MARBLE];

