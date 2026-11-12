import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { PieceKind } from './pieces';
import { modelUrl } from './modelUrl';

// Poly Haven "Chess Set" (CC0) 모델에서 기물과 판을 꺼내 쓰는 파일
// 모델은 실제 크기(칸 한 변 = 0.058m)라서, 칸 한 변 = 1이 되게 키움
const MODEL_SQUARE = 0.058;
export const MODEL_SCALE = 1 / MODEL_SQUARE;

// 모델 안의 물체 이름 (기물마다 하나씩만 견본으로 씀)
const NODE_NAMES: Record<PieceKind, string> = {
  p: 'pawn_{c}_01',
  r: 'rook_{c}_01',
  n: 'knight_{c}_01',
  b: 'bishop_{c}_01',
  q: 'queen_{c}',
  k: 'king_{c}',
};

export interface ModelSet {
  // 기물 하나 만들기. mat을 주면 그 재질을 입히고, 안 주면 모델 원래 재질을 씀
  makePiece(kind: PieceKind, isWhite: boolean, mat?: THREE.MeshPhysicalMaterial): THREE.Group;
  // 모델에 들어 있는 원래 판
  makeBoard(): THREE.Object3D;
  // 원래 재질의 표면 굴곡 그림(노멀 맵). 테마 재질에 빌려 씀
  normalMap(isWhite: boolean): THREE.Texture | null;
}

function withShadows(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

// 모델 파일 불러오기. 실패하면 null (그때는 코드로 만든 기물을 씀)
export async function loadModelSet(): Promise<ModelSet | null> {
  const url = modelUrl('chess_set/chess_set_1k.gltf');
  let root: THREE.Object3D;
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    root = gltf.scene;
  } catch (err) {
    console.warn('체스 모델을 불러오지 못해서 코드로 만든 기물을 씀', err);
    return null;
  }

  const find = (name: string): THREE.Object3D => {
    const obj = root.getObjectByName(name);
    if (!obj) throw new Error(`모델에 ${name}이 없음`);
    return obj;
  };

  const templates = new Map<string, THREE.Object3D>();
  for (const kind of Object.keys(NODE_NAMES) as PieceKind[]) {
    for (const c of ['white', 'black']) {
      templates.set(kind + c, find('piece_' + NODE_NAMES[kind].replace('{c}', c)));
    }
  }
  const board = find('board');

  const firstMaterial = (obj: THREE.Object3D): THREE.MeshStandardMaterial | null => {
    let found: THREE.MeshStandardMaterial | null = null;
    obj.traverse((o) => {
      if (!found && o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
        found = o.material;
      }
    });
    return found;
  };

  return {
    makePiece(kind, isWhite, mat) {
      const src = templates.get(kind + (isWhite ? 'white' : 'black'))!;
      const copy = src.clone(true);
      copy.position.set(0, 0, 0); // 모델 판 위의 원래 자리는 버림
      if (mat) {
        copy.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = mat;
        });
      }
      const g = new THREE.Group();
      copy.scale.setScalar(MODEL_SCALE);
      // 모델은 흰 쪽이 우리 화면과 반대편이라 180도 돌림 (나이트가 상대 쪽을 봄)
      copy.rotation.y = Math.PI;
      g.add(copy);
      withShadows(g);
      return g;
    },
    makeBoard() {
      const copy = board.clone(true);
      copy.position.set(0, 0, 0);
      const g = new THREE.Group();
      copy.scale.setScalar(MODEL_SCALE);
      copy.rotation.y = Math.PI;
      g.add(copy);
      // 모델 판의 윗면(칸 높이)이 높이 0에 오게 내림
      const top = new THREE.Box3().setFromObject(g).max.y;
      g.position.y = -top;
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) o.receiveShadow = true;
      });
      return g;
    },
    normalMap(isWhite) {
      const m = firstMaterial(templates.get('p' + (isWhite ? 'white' : 'black'))!);
      return m?.normalMap ?? null;
    },
  };
}
