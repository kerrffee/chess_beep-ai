// ---------- 혼돈: 마녀 모자를 쓴 작은 검은 유령 ----------
// 모델: public/models/character/chaos.glb
//   원본 혼돈.fbx는 글자로 된(ASCII) FBX라 Blender가 못 읽어서, three.js FBXLoader로 읽고 GLTFExporter로 glb로 바꿈
//   몸은 아래(꼬리)→위(머리)로 이어진 뼈 5개(joint1~5), 모자는 뼈에 안 붙은 따로 된 메시 → 불러올 때 맨 위 뼈에 붙임
//   원본은 얼굴이 없는 회색이라, 재질을 보랏빛 검정으로 바꾸고 빛나는 눈을 코드로 붙임
//
//   평소: 의자 위에 둥둥 떠서 꿈틀거림. 몇 초마다 이유 없이 빙글 돌거나 휙 기울어짐 (예측 불가)
//   자기 수: 판 쪽으로 쓱 날아와 기물 쪽으로 몸을 기울임 → 기물이 혼자 움직임 → 제자리로
//   기물을 잡음: 신나서 빙글빙글 돌며 튀어오름 / 잡힘: 부르르 떨고 눈이 빨갛게 번쩍
//   체크당함: 눈이 커지고 덜덜 떪 / 짐: 축 처져 아래로 가라앉고 눈빛이 흐려짐
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { Opponent } from './opponent';

const HEIGHT = 10.5;      // 모자 끝까지 키 (칸) ≈ 60cm
const HOME_Z = -10.5;     // 떠 있는 자리 (판 가운데에서)
const HOME_Y = -1.2;      // 꼬리 끝 높이 (책상 윗면 기준)
const SWOOP_IN = 520;     // 판 쪽으로 날아오는 시간 → 이 뒤에 기물 출발
const SWOOP_OUT = 650;
const EYE_COLOR = new THREE.Color(0xc58bff);
const ANGRY_COLOR = new THREE.Color(0xff4a4a);

let cache: Promise<THREE.Group | null> | null = null;
function loadModel(): Promise<THREE.Group | null> {
  if (!cache) {
    const url = import.meta.env.BASE_URL + 'models/character/chaos.glb';
    cache = new GLTFLoader().loadAsync(url).then(g => g.scene, err => {
      console.warn('혼돈 모델을 못 불러옴', err);
      return null;
    });
  }
  return cache;
}

// 재질은 한 번만 만들어 모든 복사본이 같이 씀
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1d1628, roughness: 0.55, metalness: 0.05, emissive: 0x150a26, emissiveIntensity: 1 });
const hatMat = new THREE.MeshStandardMaterial({ color: 0x2b2140, roughness: 0.7, metalness: 0.1 });

const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
// 0~1 사이 고정된 무작위 수 (같은 n이면 늘 같은 값)
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function createGhost(deskTop: number): Opponent {
  const group = new THREE.Group();
  const body = new THREE.Group(); // 떠다니는 위치·회전 (꼬리 끝 가운데가 원점)
  body.position.set(0, deskTop + HOME_Y, HOME_Z);
  group.add(body);
  let disposed = false;
  const joints: THREE.Bone[] = [];
  const rest: THREE.Quaternion[] = [];

  // 눈: 빛나는 납작한 타원 두 개 (불러온 뒤 머리 뼈에 붙임)
  const eyeMat = new THREE.MeshBasicMaterial({ color: EYE_COLOR.clone() });
  const eyeGeo = new THREE.SphereGeometry(1, 16, 12);
  const eyes = [-1, 1].map(() => new THREE.Mesh(eyeGeo, eyeMat));
  const eyeLight = new THREE.PointLight(0xb070ff, 5, 8, 1.8);
  // 등 뒤 윤곽 빛 (검은 몸이 어두운 방에서도 보이게)
  const rim = new THREE.SpotLight(0xb59cff, 55, 30, Math.PI / 5, 0.6, 1.5);
  rim.position.set(0, deskTop + 13, HOME_Z - 8);
  rim.target.position.set(0, deskTop + 4, HOME_Z);
  group.add(rim, rim.target);

  loadModel().then(src => {
    if (!src || disposed) return;
    const model = SkeletonUtils.clone(src) as THREE.Group; // 뼈대가 있으니 SkeletonUtils로 복사
    model.updateMatrixWorld(true);
    let hat: THREE.Mesh | null = null, skin: THREE.SkinnedMesh | null = null;
    model.traverse(o => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) skin = o as THREE.SkinnedMesh;
      else if ((o as THREE.Mesh).isMesh) hat = o as THREE.Mesh;
      if ((o as THREE.Bone).isBone && /^joint\d$/.test(o.name)) joints[+o.name.slice(5) - 1] = o as THREE.Bone;
    });
    if (!skin || joints.length < 5) return;
    const sk = skin as THREE.SkinnedMesh;
    sk.material = bodyMat;
    sk.castShadow = true;
    sk.frustumCulled = false;
    if (hat) {
      const h = hat as THREE.Mesh;
      h.material = hatMat;
      h.castShadow = true;
      joints[4].attach(h); // 모자를 맨 위 뼈에 (보이는 자리는 그대로)
    }
    for (const j of joints) rest.push(j.quaternion.clone());

    // 크기·위치: 꼬리 끝이 원점, 키 HEIGHT
    const box = new THREE.Box3().setFromObject(model);
    const s = HEIGHT / (box.max.y - box.min.y);
    model.scale.setScalar(s);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    body.add(model);
    model.updateMatrixWorld(true);

    // 눈: 머리 높이(키의 약 70%)에서 몸 앞면을 찾아 붙임
    const eyeY = box.min.y + (box.max.y - box.min.y) * 0.66;
    const ray = new THREE.Raycaster();
    const hits: number[] = [];
    for (const side of [-1, 1]) {
      const from = model.localToWorld(new THREE.Vector3(c.x + side * 0.13, eyeY, box.max.z + 1));
      ray.set(from, new THREE.Vector3(0, 0, 1).transformDirection(model.matrixWorld).negate());
      const hit = ray.intersectObject(sk, false)[0];
      hits.push(hit ? model.worldToLocal(hit.point.clone()).z : box.max.z * 0.8);
    }
    eyes.forEach((eye, i) => {
      const side = i === 0 ? -1 : 1;
      const p = model.localToWorld(new THREE.Vector3(c.x + side * 0.13, eyeY, hits[i] - 0.01));
      joints[3].attach(eye);
      eye.position.copy(joints[3].worldToLocal(p));
      eye.scale.setScalar(1);
      const ws = new THREE.Vector3(); joints[3].getWorldScale(ws);
      eye.scale.set(0.38 / ws.x, 0.55 / ws.y, 0.12 / ws.z); // 세로로 긴 타원 (칸 단위로 맞춤)
    });
    joints[3].attach(eyeLight);
    eyeLight.position.copy(joints[3].worldToLocal(model.localToWorld(new THREE.Vector3(c.x, eyeY, box.max.z + 0.4))));
  });

  // ── 상태 ──
  let swoop: { start: number; moveTime: number; target: THREE.Vector3 } | null = null;
  let lost = false, inCheck = false;
  let droop = 0, check = 0;
  let spinAt = -1e9, shiverAt = -1e9;
  let lastNow = performance.now();
  const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
  const _q = new THREE.Quaternion();

  function update(now: number): boolean {
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    if (joints.length < 5 || rest.length < 5) return false;
    const t = now / 1000;
    let busy = false;
    const follow = (cur: number, want: number, speed: number) => {
      const next = cur + (want - cur) * (1 - Math.exp(-dt * speed));
      if (Math.abs(next - want) > 0.002) busy = true;
      return Math.abs(next - want) < 0.0005 ? want : next;
    };
    droop = follow(droop, lost ? 1 : 0, 1.5);
    check = follow(check, inCheck && !lost ? 1 : 0, 5);

    // 날아오기: 0 → 1(기물 앞) → 0
    let k = 0;
    if (swoop) {
      busy = true;
      const e = now - swoop.start;
      if (e < SWOOP_IN) k = ease(e / SWOOP_IN);
      else if (e < SWOOP_IN + swoop.moveTime) k = 1;
      else if (e < SWOOP_IN + swoop.moveTime + SWOOP_OUT) k = 1 - ease((e - SWOOP_IN - swoop.moveTime) / SWOOP_OUT);
      else swoop = null;
    }
    const spin = (now - spinAt) / 1000, shiver = (now - shiverAt) / 1000;
    const spinK = spin >= 0 && spin < 1.1 ? spin / 1.1 : -1;   // 잡고 신남: 두 바퀴
    const shiverK = shiver >= 0 && shiver < 0.9 ? 1 - shiver / 0.9 : 0;
    if (spinK >= 0 || shiverK > 0) busy = true;

    // 이유 없는 행동: 3.5초 칸마다 하나 고름 (빙글 / 휙 기울기 / 위로 튐 / 가만히)
    const slot = Math.floor(t / 3.5), into = t / 3.5 - slot;
    const pick = hash(slot);
    const act = into < 0.3 ? Math.sin(Math.PI * into / 0.3) : 0; // 칸 앞 30% 동안
    const quirk = lost ? 0 : act;

    // 몸 위치: 둥둥 + 날아오기 + 짐(가라앉음)
    const homeX = Math.sin(t * 0.7) * 0.6 + Math.sin(t * 1.9) * 0.25;
    let x = homeX, y = deskTop + HOME_Y + Math.sin(t * 2.1) * 0.35 - droop * 2.2, z = HOME_Z;
    if (pick > 0.75) y += quirk * 1.6;                        // 위로 튐
    if (spinK >= 0) y += Math.sin(Math.PI * spinK) * 1.8;     // 신나서 튀어오름
    if (swoop) {
      const tgt = swoop.target;
      x = THREE.MathUtils.lerp(x, tgt.x * 0.6, k);
      z = THREE.MathUtils.lerp(z, Math.min(tgt.z - 3.5, -6.5), k);
      y = THREE.MathUtils.lerp(y, deskTop + 0.6, k);
    }
    // 떨림 (잡힘, 체크)
    const jitter = shiverK * 0.35 + check * 0.12;
    x += (Math.sin(t * 61) + Math.sin(t * 43)) * 0.5 * jitter;
    body.position.set(x, y, z);

    // 몸 회전: 빙글
    let yaw = Math.sin(t * 0.5) * 0.25;
    if (pick < 0.3 && !lost && into < 0.3) yaw += ease(into / 0.3) * Math.PI * 2; // 한 바퀴
    if (spinK >= 0) yaw += ease(spinK) * Math.PI * 4;
    if (swoop) yaw *= 1 - k;
    body.rotation.y = yaw;
    body.rotation.z = (pick >= 0.3 && pick < 0.55 ? quirk * (hash(slot + 0.3) - 0.5) * 1.2 : 0) + Math.sin(t * 1.3) * 0.05;

    // 몸 굽히기: 뼈 2~5를 조금씩 (꿈틀), 날아올 땐 앞으로, 지면 앞으로 축 처짐
    for (let i = 0; i < 5; i++) joints[i].quaternion.copy(rest[i]);
    for (let i = 1; i < 5; i++) {
      const wobX = Math.sin(t * (1.7 + i * 0.6) + i) * 0.07 + Math.sin(t * 3.1 + i * 2) * 0.03;
      const wobZ = Math.sin(t * (1.3 + i * 0.5) + i * 1.7) * 0.08;
      const bendX = wobX + k * 0.22 + droop * 0.3 - check * 0.08;
      _q.setFromAxisAngle(X, bendX);
      joints[i].quaternion.multiply(_q);
      _q.setFromAxisAngle(Z, wobZ + jitter * Math.sin(t * 50 + i) * 0.3);
      joints[i].quaternion.multiply(_q);
    }

    // 눈: 체크면 커짐, 잡히면 빨갛게, 지면 흐려짐, 가끔 깜빡임
    const blink = (t % 4.3) < 0.12 && !lost ? 0.15 : 1;
    const wide = 1 + check * 0.45;
    for (const eye of eyes) {
      if (!eye.userData.base) eye.userData.base = eye.scale.clone();
      const b = eye.userData.base as THREE.Vector3;
      eye.scale.set(b.x * wide, b.y * wide * blink, b.z);
    }
    const red = Math.max(shiverK, 0);
    eyeMat.color.copy(EYE_COLOR).lerp(ANGRY_COLOR, red).multiplyScalar(1 - droop * 0.75);
    eyeLight.color.copy(eyeMat.color);
    eyeLight.intensity = 5 * (1 - droop * 0.8) + k * 4;
    return busy;
  }

  return {
    group,
    update,
    reach(from, _to, moveTime) {
      group.updateMatrixWorld(true);
      swoop = { start: performance.now(), moveTime, target: group.worldToLocal(from.clone()) };
      return SWOOP_IN;
    },
    setLost(v) { lost = v; },
    setInCheck(v) { inCheck = v; },
    react(ev, delay) {
      const at = performance.now() + delay;
      if (ev === 'captured') spinAt = at; else shiverAt = at;
    },
    dispose() {
      disposed = true;
      eyeMat.dispose(); // 눈 재질은 캐릭터마다 새로 만듦 (모양·몸 재질은 재사용)
    },
  };
}
