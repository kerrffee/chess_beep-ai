// ---------- 대가: 가면을 쓰고 빛나는 미로 구슬을 든 로브 차림 인물 ----------
// 모델: public/models/character/master.glb (원본 대가.glb의 그림을 1024px로 줄이고 가면의 면 수를 35%로 줄임)
// 이 모델은 뼈대가 없는 '조각상' 모델이라 팔다리를 움직일 수 없음
// 그래서 손을 뻗는 대신, 구슬이 밝아지면 기물이 혼자 움직이는 연출 (손대지 않고 두는 대가)
//
//   평소: 책상 뒤에 서서 아주 천천히 숨 쉬고 흔들림, 구슬이 은은하게 맥박치듯 빛남
//   자기 수: 몸이 판 쪽으로 살짝 기울고 구슬이 확 밝아짐 → 기물이 움직임 → 다시 어두워짐
//   기물을 잡음: 구슬이 한 번 번쩍 / 잡힘: 구슬이 잠깐 흔들리듯 깜빡
//   체크당함: 구슬이 불안하게 깜빡거림 / 짐: 고개 숙이듯 앞으로 기울고 구슬이 거의 꺼짐
//
// 좌표: 캐릭터 기준 +z가 판 쪽 (opponent.ts와 같음). 서 있으니 의자보다 조금 뒤(STAND_Z)에
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Opponent } from './opponent';
import { DESK } from './room';

const HEIGHT = 26;        // 키 (칸) ≈ 150cm. 더 크면 '앉아서' 시점에서 머리가 화면 위로 잘림
const STAND_Z = -13;      // 서 있는 자리 (판 가운데에서)
const GATHER = 480;       // 구슬이 밝아지는 시간 → 이 뒤에 기물이 출발
const RELEASE = 600;      // 다 두고 구슬이 다시 어두워지는 시간
const ORB_COLOR = 0xa8d8ff;

let cache: Promise<THREE.Group | null> | null = null;
function loadModel(): Promise<THREE.Group | null> {
  if (!cache) {
    const url = import.meta.env.BASE_URL + 'models/character/master.glb';
    cache = new GLTFLoader().loadAsync(url).then(g => g.scene, err => {
      console.warn('대가 모델을 못 불러옴', err);
      return null;
    });
  }
  return cache;
}

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));

export function createMaster(deskTop: number): Opponent {
  const group = new THREE.Group();
  const floorY = deskTop - DESK.height;
  // pivot = 발 가운데. 이걸 기울이면 몸 전체가 앞으로 숙여짐
  const pivot = new THREE.Group();
  pivot.position.set(0, floorY, STAND_Z);
  group.add(pivot);
  let disposed = false;
  let orbMats: THREE.MeshStandardMaterial[] = [];
  const orbBase = new Map<THREE.MeshStandardMaterial, number>();

  // 구슬 빛 (구슬 위치는 모델을 불러온 뒤에 맞춤)
  const orbLight = new THREE.PointLight(ORB_COLOR, 0, 14, 1.8);
  pivot.add(orbLight);
  // 등 뒤 차가운 윤곽 빛 + 가면을 위에서 살짝 비추는 빛
  const rim = new THREE.SpotLight(0x9fb4ff, 40, 34, Math.PI / 5, 0.6, 1.5);
  rim.position.set(0, deskTop + 15, STAND_Z - 8);
  rim.target.position.set(0, deskTop + 6, STAND_Z);
  const top = new THREE.SpotLight(0xfff2e0, 6, 22, Math.PI / 10, 0.7, 1.5);
  top.position.set(0, deskTop + 17, STAND_Z + 4);
  top.target.position.set(0, deskTop + 9, STAND_Z);
  group.add(rim, rim.target, top, top.target);

  loadModel().then(src => {
    if (!src || disposed) return;
    const model = src.clone(true); // 뼈대가 없으니 그냥 복사해도 됨 (모양·재질은 공유)
    const box = new THREE.Box3().setFromObject(model);
    const s = HEIGHT / (box.max.y - box.min.y);
    model.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === 'Maze') {
        orbMats.push(mat);
        if (!orbBase.has(mat)) orbBase.set(mat, mat.emissiveIntensity);
        // 구슬 가운데에 빛을 둠
        model.updateMatrixWorld(true);
        m.geometry.computeBoundingBox();
        const p = m.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld);
        orbLight.position.copy(p);
      }
    });
    pivot.add(model);
  });

  // ── 상태 ──
  let reachAnim: { start: number; moveTime: number } | null = null;
  let lost = false, inCheck = false;
  let slump = 0, check = 0;
  let flashAt = -1e9, flickerAt = -1e9;
  let lastNow = performance.now();

  function update(now: number): boolean {
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    const t = now / 1000;
    let busy = false;
    const follow = (cur: number, want: number, speed: number) => {
      const next = cur + (want - cur) * (1 - Math.exp(-dt * speed));
      if (Math.abs(next - want) > 0.002) busy = true;
      return Math.abs(next - want) < 0.0005 ? want : next;
    };
    slump = follow(slump, lost ? 1 : 0, 1.6);
    check = follow(check, inCheck && !lost ? 1 : 0, 4);

    // 자기 수: 0 → 1(구슬 최대) → 0
    let power = 0;
    if (reachAnim) {
      busy = true;
      const e = now - reachAnim.start;
      if (e < GATHER) power = ease(e / GATHER);
      else if (e < GATHER + reachAnim.moveTime) power = 1;
      else if (e < GATHER + reachAnim.moveTime + RELEASE) power = 1 - ease((e - GATHER - reachAnim.moveTime) / RELEASE);
      else reachAnim = null;
    }
    const flash = (now - flashAt) / 1000, flicker = (now - flickerAt) / 1000;
    const flashK = flash >= 0 && flash < 0.9 ? Math.sin(Math.PI * clamp01(flash / 0.9)) : 0;
    const flickerK = flicker >= 0 && flicker < 1 ? (1 - flicker) * (0.5 + 0.5 * Math.sin(flicker * 60)) : 0;
    if (flashK > 0 || flickerK > 0) busy = true;

    // 몸: 숨쉬기 + 아주 느린 흔들림, 수를 둘 때 판 쪽으로, 지면 앞으로 푹
    const breath = Math.sin(t * Math.PI * 2 / 4.5);
    pivot.scale.set(1, 1 + breath * 0.006, 1);
    pivot.rotation.x = power * 0.05 + slump * 0.16 + Math.sin(t * 0.37) * 0.008;
    pivot.rotation.z = Math.sin(t * 0.29 + 1) * 0.01 + check * Math.sin(t * 7) * 0.006;
    pivot.rotation.y = Math.sin(t * 0.21) * 0.03 * (1 - slump);

    // 구슬 밝기 (1 = 원래 밝기)
    const pulse = 0.35 + 0.12 * Math.sin(t * Math.PI * 2 / 3); // 평소엔 원래 밝기의 절반쯤 (원래는 너무 하얗게 날아감)
    const unrest = check * (0.5 + 0.5 * Math.sin(t * 23) * Math.sin(t * 9.7)); // 체크: 불규칙하게 깜빡
    let glow = pulse * (1 - unrest * 0.7) + power * 1.2 + flashK * 1.0 - flickerK * 0.3;
    glow *= 1 - slump * 0.85;
    glow = Math.max(0.05, glow);
    for (const m of orbMats) m.emissiveIntensity = orbBase.get(m)! * glow;
    orbLight.intensity = 5 * glow;
    return busy;
  }

  return {
    group,
    update,
    reach(_from, _to, moveTime) {
      reachAnim = { start: performance.now(), moveTime };
      return GATHER;
    },
    setLost(v) { lost = v; },
    setInCheck(v) { inCheck = v; },
    react(ev, delay) {
      const at = performance.now() + delay;
      if (ev === 'captured') flashAt = at; else flickerAt = at;
    },
    dispose() {
      disposed = true;
      // 모양·재질은 다음에 다시 세울 때 재사용 (cache). 구슬 밝기는 다음에 다시 계산되니 원래대로 돌려 둠
      for (const m of orbMats) m.emissiveIntensity = orbBase.get(m)!;
      orbMats = [];
    },
  };
}
