// ---------- 방 가구 모델 (파일에서 불러오는 탁자, 소파, 조명, 창문) ----------
// 모델 파일은 public/models/room/<테마>/ 에 있음 (원본을 웹용으로 줄인 .glb)
// 출처: 탁자·소파·랜턴·촛대 = Poly Haven (CC0), 아치 창문 = Fab (Megascans)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 크기 기준: 모델은 실제 크기(m), 방은 체스판 한 칸 = 1 (= 5.8cm)
export const M = 1 / 0.058;

// 같은 파일은 한 번만 불러옴 (테마를 바꿔도 재사용)
const cache = new Map<string, Promise<THREE.Object3D | null>>();
function load(path: string): Promise<THREE.Object3D | null> {
  let p = cache.get(path);
  if (!p) {
    const url = import.meta.env.BASE_URL + 'models/room/' + path;
    p = new GLTFLoader().loadAsync(url).then(g => g.scene, err => {
      console.warn('가구 모델을 못 불러옴: ' + path, err);
      return null;
    });
    cache.set(path, p);
  }
  return p;
}

export interface FurnitureOptions {
  scaleXZ?: number;       // 가로·세로만 줄이거나 늘림 (높이는 그대로)
  // 다리 늘리기: 바닥에서 from~to(m) 사이만 늘려서 전체 높이를 height(m)로 맞춤. 윗판 모양은 그대로
  stretch?: { from: number; to: number; height: number };
  cheap?: boolean;        // 화면을 넓게 덮는 것(탁자)은 광택 계산이 없는 싼 재질로 (휴대폰에서 빠름)
  shadows?: boolean;      // 그림자를 드리울지 (기본 false: 그림자 계산에서 빼야 휴대폰에서 빠름)
  height?: number;        // 전체 높이를 이 값(m)으로 맞춤 (모양 비율은 그대로). 단위가 m가 아닌 모델용
  rotateY?: number;       // 모델을 세로축으로 돌림(라디안). 앞이 +z가 아닌 모델용
}

// 모델 하나를 복사해서, 바닥 가운데(밑면 y=0, 가로 가운데 x=z=0)가 원점에 오게 놓은 묶음을 돌려줌
// 크기는 칸 단위로 바꿔 둠. 못 불러오면 null
export async function loadFurniture(path: string, opt: FurnitureOptions = {}): Promise<THREE.Group | null> {
  const src = await load(path);
  if (!src) return null;
  const copy = src.clone(true);
  if (opt.rotateY) copy.rotation.y += opt.rotateY;
  copy.updateMatrixWorld(true);
  if (opt.height) { // 높이 맞추기: 통째로 키우거나 줄임
    copy.scale.multiplyScalar(opt.height / new THREE.Box3().setFromObject(copy).getSize(new THREE.Vector3()).y);
    copy.updateMatrixWorld(true);
  }
  const g = new THREE.Group();
  const sxz = opt.scaleXZ ?? 1;
  const st = opt.stretch;
  const grow = st ? st.height - new THREE.Box3().setFromObject(copy).max.y : 0; // 다리가 늘어날 길이(m)
  const k = st ? (st.to - st.from + grow) / (st.to - st.from) : 1;
  copy.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    // 모델 안의 위치·회전을 모양에 직접 구워 넣음 (늘리기를 실제 높이 기준으로 하려고)
    const geo = (o.geometry as THREE.BufferGeometry).clone();
    geo.applyMatrix4(o.matrixWorld);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      if (st) {
        if (y > st.to) y += grow;
        else if (y > st.from) y = st.from + (y - st.from) * k;
      }
      pos.setXYZ(i, pos.getX(i) * sxz * M, y * M, pos.getZ(i) * sxz * M);
    }
    pos.needsUpdate = true;
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, fixMaterial(o.material as THREE.Material, opt.cheap ?? false));
    const shadows = opt.shadows ?? false;
    mesh.castShadow = shadows && !isFlame(mesh.material);
    mesh.receiveShadow = true;
    g.add(mesh);
  });
  // 밑면을 바닥(y=0)에, 가로는 가운데로
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  for (const m of g.children) (m as THREE.Mesh).geometry.translate(-c.x, -box.min.y, -c.z);
  return g;
}

const isFlame = (m: THREE.Material) => /flame/i.test(m.name);

// 촛불 불꽃은 빛을 받는 재질 대신 스스로 빛나는 재질로 (어두운 방에서도 밝게)
// cheap이면 광택 계산이 없는 재질로 바꿈 (색 그림과 표면 굴곡은 그대로)
function fixMaterial(m: THREE.Material, cheap: boolean): THREE.Material {
  if (cheap && !isFlame(m) && m instanceof THREE.MeshStandardMaterial) {
    return new THREE.MeshLambertMaterial({
      name: m.name, map: m.map, color: m.color, normalMap: m.normalMap, normalScale: m.normalScale,
      transparent: m.transparent, alphaTest: m.alphaTest, side: m.side,
    });
  }
  if (isFlame(m) && m instanceof THREE.MeshStandardMaterial) {
    return new THREE.MeshBasicMaterial({
      name: m.name, map: m.map, color: 0xffd9a0,
      // 불꽃 그림의 검은 바탕이 보이지 않게 더하기 방식으로 겹침 (검정 = 아무것도 안 더함)
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
  }
  return m;
}

// 모델의 크기(칸 단위)
export function sizeOf(obj: THREE.Object3D): THREE.Vector3 {
  return new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
}
