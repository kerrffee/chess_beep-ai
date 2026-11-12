// ---------- 모델 파일로 만든 사람 캐릭터: 겁쟁이, 욕심쟁이, 허세꾼, 핑계왕, 돌격대장, 랜덤, 퀸 사랑꾼 ----------
// 모델은 서 있는 A자 자세라서, 매 화면마다 뼈를 돌려 의자에 앉히고 팔을 책상 위에 둠
// (애니메이션 파일 없이 코드로 자세를 만듦 → characterModel.ts의 aim, turn, reachIK)
//
// 좌표: 캐릭터 기준 +z가 판 쪽. 판 가운데 = (0, deskTop, 0), 캐릭터는 z = PELVIS_Z 의자에 앉음
//
// 겁쟁이: 증기 갑옷 로봇(겁쟁이2 모델, 오른손이 긴 갈고리). 몸을 뒤로 빼고 움츠림, 늘 조금씩 떨고 두리번거림
//         수를 둘 때 손을 뻗다가 멈칫하고 한 번 물렸다가 둠, 두고 나면 손을 재빨리 거둠
//         자기 기물을 잡히면 움찔 놀라 뒤로 젖힘, 체크당하면 한 손으로 얼굴을 가리고 고개를 돌림
//         지면 두 손으로 얼굴을 감싸고 웅크림
// 욕심쟁이: 판 쪽으로 몸을 숙이고 손을 비비며 판을 훑어봄
//         수를 둘 때 손이 아주 빠름, 기물을 잡으면 몸을 젖히고 신나게 손을 비빔
//         자기 기물을 잡히면 주먹으로 책상을 쾅, 체크당하면 판을 노려봄
//         지면 의자에 털썩 기대 팔을 늘어뜨림
// 허세꾼: 갑옷 기사. 의자에 거만하게 기대 팔짱을 끼고 턱을 듦
//         수를 둘 때 손을 높이 들었다가 멋을 부리며 내려놓음
//         기물을 잡으면 더 젖히며 두 팔을 벌림("당연하지"), 잡히면 "괜찮은 척" 고개를 휙휙 저음
//         체크당하면 몸을 세우고 한 손으로 턱을 괴고 고민, 지면 두 손을 머리 뒤로 깍지 끼고 딴 데를 봄 ("봐준 거야")
// 핑계왕: 바위 괴물. 평범하게 똑바로 앉음. 가끔 오른손을 들어 털며 쳐다봄 ("손가락이 좀 아픈데…")
//         기물을 잡으면 왼손으로 가슴을 툭툭 ("이건 실력이지")
//         자기 기물을 잡히면 고개를 휙 들어 천장 조명을 가리킴 ("조명 때문에 잘 안 보였어")
//         체크당하면 왼손으로 뒷머리를 긁적, 지면 의자에 기대 왼팔로 딴 데를 가리키고 오른손은 어깨 으쓱 ("와이파이 때문이야")
// 돌격대장: 버섯이 핀 기사. 왼팔의 방패를 가슴 앞에 세우고 판 쪽으로 몸을 바짝 숙여 노려봄, 오른 주먹으로 책상을 톡톡 (빨리 가고 싶음)
//         수를 둘 때 손이 빠르고 기물을 앞으로 확 밀어붙임 (살짝 지나쳤다 돌아옴)
//         기물을 잡으면 몸을 세우고 오른 주먹을 번쩍 ("돌파!"), 자기 기물을 잡히면 주먹을 판 쪽으로 쭉 내지름 ("계속 전진!")
//         체크당하면 방패를 얼굴 앞까지 들어 막음, 지면 방패를 책상에 내려놓고 고개를 숙인 채 주먹으로 책상을 쿵쿵
// 랜덤: 케이블 달린 로봇 (랜덤2 모델, 2026-11-12에 두건 쓴 방랑자에서 바꿈). 2.3초마다 아무 자세나 새로 고름
//         (책상에 손 / 머리 긁기 / 턱 괴기 / 손가락으로 책상 두드리기 / 손 흔들기) + 고개도 아무 데나 갸웃
//         수를 둘 때 손이 갈지자로 비틀비틀 감. 잡든 잡히든 체크든 별 관심 없음:
//         잡으면 박수, 잡히면 어깨 으쓱, 지면 의자에 기대 천장을 보며 계속 으쓱
//
// ※ 상황별 동작은 캐릭터마다 KITS에 조각으로 나뉘어 있음 (평소 / 손 뻗기 / 잡음 / 잡힘 / 체크 / 짐)
//    characters.jsonc의 "3D › 동작"으로 다른 캐릭터의 조각을 빌려 쓸 수 있음 (예: 겁쟁이가 잡으면 허세꾼처럼 팔 벌리기)
//    속도(reachIn·reachOut)·반응 길이·세기·윤곽 빛 색도 거기서 바꿈 (characterConfig.ts)
// 퀸 사랑꾼: 후광을 쓴 망토 군주. 꼿꼿이 앉아 두 손을 가슴 앞에 모으고 고개를 갸웃 (판 위의 퀸을 황홀하게 바라봄)
//         수를 둘 때 손을 높이 둥글게 들어 천천히 우아하게 내려놓음
//         기물을 잡으면 모은 손을 뺨에 대고 몸을 좌우로 흔듦, 자기 기물을 잡히면 두 손으로 뺨을 감싸고 깜짝 놀람
//         체크당하면 왼손을 판 위로 뻗어 막고("퀸 근처엔 오지 마!") 오른손은 가슴에, 지면(= 퀸을 잃고 기권) 두 손으로 가슴을 움켜쥐고 고개를 푹 숙임
import * as THREE from 'three';
import type { Opponent } from './opponent';
import { DESK } from './room';
import { aim, bonePos, loadRig, reachIK, turn, type Rig, type RigOptions } from './characterModel';
import { getHumanTuning, type Who } from '../characterConfig';

export type { Who };

const PELVIS_Z = -11.2;   // 엉덩이 위치 (판 가운데에서)
const SEAT_H = 8.8;       // 의자 앉는 면 높이 (바닥에서, 칸) ≈ 51cm
const DESK_EDGE = -DESK.depth / 2; // 캐릭터 쪽 책상 모서리 z

interface Style {
  file: string;
  rig: RigOptions;      // 뼈대 불러오기 설정 (characterModel.ts)
  reachIn: number;      // 손이 기물까지 가는 시간(ms)
  reachOut: number;     // 돌아오는 시간
  rimColor: number;     // 등 뒤 윤곽 빛 색
  grip?: [number, number, number]; // 기물을 집을 때 손목 위치 (기물 기준, 칸). 없으면 (0, 2.1, -1.1)
  // 처음(서 있는) 자세에서 왼손 손바닥이 향하는 쪽 (캐릭터 기준, 오른손은 좌우 거울). 있으면 기물을 집을 때
  // 아래팔을 돌려 손바닥이 아래를 보게 하고 손목을 손바닥 쪽으로 굽힘. 없으면 손끝 방향만 맞춤
  palm?: [number, number, number];
  // 팔에 매달린 넝마 자락 지우기: 그 팔 무게가 절반 넘는데 팔 뼈에서 r(m)보다 먼 점이 있는 삼각형을 지움
  // (팔을 들면 자락이 통째로 들려 판처럼 보여서. 예전 랜덤 왼팔에 썼음 — 2026-11-12, 지금은 쓰는 캐릭터 없음)
  cutFlap?: { side: 'l' | 'r'; r: number };
}
const STYLES: Record<Who, Style> = {
  // 겁쟁이(2): 욕심쟁이(2)와 같은 방식. 오른손 갈고리가 6칸쯤 길어서 손목을 높이 두고 갈고리 끝으로 기물을 걸어 끎
  coward: { file: 'coward.glb', rig: { strip: null, unit: 100 }, reachIn: 950, reachOut: 260, rimColor: 0xa8b8d8, grip: [0, 4.6, -3.2] },
  // 욕심쟁이(2): 원본에 뼈대가 없어서 Blender로 뼈대를 만들어 붙임 (뼈 이름이 처음부터 자세 코드 이름, m 단위)
  greedy: { file: 'greedy.glb', rig: { strip: null, unit: 100 }, reachIn: 190, reachOut: 360, rimColor: 0xffc890 },
  // 핑계왕: 욕심쟁이(2)와 같은 방식
  excuser: { file: 'excuser.glb', rig: { strip: null, unit: 100 }, reachIn: 520, reachOut: 380, rimColor: 0xe0c8a8 },
  // 허세꾼: m 단위, 뼈 이름이 Mixamo 식 → 자세 코드가 쓰는 이름으로 바꿈 (손가락 뼈는 없어서 손바닥 방향은 그대로 둠)
  bluffer: { file: 'bluffer.glb',
    rig: { strip: null, unit: 100, rename: {
      Hips: 'pelvis', Spine02: 'spine_01', Spine01: 'spine_02', Spine: 'spine_03', neck: 'neck_01', Head: 'head',
      LeftShoulder: 'clavicle_l', LeftArm: 'upperarm_l', LeftForeArm: 'lowerarm_l', LeftHand: 'hand_l',
      RightShoulder: 'clavicle_r', RightArm: 'upperarm_r', RightForeArm: 'lowerarm_r', RightHand: 'hand_r',
      LeftUpLeg: 'thigh_l', LeftLeg: 'calf_l', LeftFoot: 'foot_l', LeftToeBase: 'ball_l',
      RightUpLeg: 'thigh_r', RightLeg: 'calf_r', RightFoot: 'foot_r', RightToeBase: 'ball_r',
    } }, reachIn: 560, reachOut: 420, rimColor: 0xc8d2ff, grip: [0, 2.6, -2.4] },
  // 돌격대장, 랜덤, 퀸 사랑꾼: 욕심쟁이(2)와 같은 방식 (tools/rig-character.py)
  attacker: { file: 'attacker.glb', rig: { strip: null, unit: 100 }, reachIn: 300, reachOut: 300, rimColor: 0xb8e0a0 },
  random: { file: 'random.glb', rig: { strip: null, unit: 100 }, reachIn: 700, reachOut: 450, rimColor: 0xd8c8f0, grip: [0, 2.6, -1.1] },
  queenlover: { file: 'queenlover.glb', rig: { strip: null, unit: 100 }, reachIn: 900, reachOut: 600, rimColor: 0xffd8f0, palm: [0, 0, 1] },
};

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
// 0~1 사이 고정된 무작위 수 (같은 n이면 늘 같은 값) — 두리번거릴 방향 고르기용
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
// 핑계왕이 아픈 손을 터는 정도 (0~1): 7초마다 1.6초 동안
const excuserShake = (t: number) => { const u = t % 7; return u < 1.6 ? Math.sin(Math.PI * u / 1.6) : 0; };
// 랜덤이 자세를 바꾸는 간격(초)과, 지금 칸(slot)의 자세로 넘어간 정도(0~1)
const RANDOM_SLOT = 2.3;
const randomSlot = (t: number) => { const slot = Math.floor(t / RANDOM_SLOT); return { slot, into: ease(clamp01((t / RANDOM_SLOT - slot) / 0.18)) }; };
// 살짝 지나쳤다가 돌아오는 움직임 (돌격대장이 기물을 밀어붙일 때)
const overshoot = (k: number) => { const c = 1.9, u = k - 1; return k <= 0 ? 0 : k >= 1 ? 1 : 1 + (c + 1) * u * u * u + c * u * u; };

// 기물을 집을 때 (palm이 있는 캐릭터): 아래팔을 제 축으로 돌려 손바닥이 아래를 보게 하고, 팔·손목을 거의 곧게 펴서 손끝으로 옮김
// (손만 비틀면 손목이 손등 쪽으로 꺾여 보임 — 2026-11-12)
const PALM_DOWN = new THREE.Vector3(0, -1, 0);
const WRIST_FLEX = -15 * Math.PI / 180; // 손목을 손바닥 쪽으로 굽히는 각도(라디안). 음수 = 손등 쪽(위)으로 젖힘, 지금 위로 15°
const FINGER_REACH = 2.6; // 손목 → 손끝(발톱 끝) 길이 = 손 뼈(hand → middle_01) 길이의 몇 배
const PIECE_TOP = 1.3;    // 손끝이 닿는 높이 (기물 바닥에서, 칸)
// 손바닥 방향(캐릭터 기준) = 손 뼈 기준 palmLocal을 지금 손 회전으로
function palmDir(r: Rig, hand: THREE.Bone, palmLocal: THREE.Vector3): THREE.Vector3 {
  const rootQ = r.root.getWorldQuaternion(new THREE.Quaternion());
  const handQ = rootQ.invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
  return palmLocal.clone().applyQuaternion(handQ).normalize();
}
// 아래팔(lower → hand) 축 둘레로 돌려서 손바닥이 want 쪽을 보게. k = 얼마나(0~1)
function rollForearm(r: Rig, lower: THREE.Bone, hand: THREE.Bone, palmLocal: THREE.Vector3, want: THREE.Vector3, k: number) {
  const axis = bonePos(r, hand).sub(bonePos(r, lower)).normalize();
  const a = palmDir(r, hand, palmLocal); a.addScaledVector(axis, -a.dot(axis));
  const b = want.clone().addScaledVector(axis, -want.dot(axis));
  if (a.lengthSq() < 1e-6 || b.lengthSq() < 1e-6) return;
  a.normalize(); b.normalize();
  turn(r, lower, axis, Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(axis), a.dot(b)) * k);
}

// 팔에 매달린 자락 지우기 (Style.cutFlap). 처음(서 있는) 자세 기준으로 재므로 같은 모델에 여러 번 해도 결과가 같음
function cutFlap(m: THREE.SkinnedMesh, side: 'l' | 'r', R: number) {
  const g = m.geometry, P = g.attributes.position, J = g.attributes.skinIndex, W = g.attributes.skinWeight, idx = g.index;
  if (!idx) return;
  const bones = m.skeleton.bones, inv = m.skeleton.boneInverses;
  const at = (n: string) => { const i = bones.findIndex(b => b.name === n); return i < 0 ? null : new THREE.Vector3().setFromMatrixPosition(inv[i].clone().invert()); };
  const arm = new Set(['upperarm', 'lowerarm', 'hand', 'middle_01'].map(n => bones.findIndex(b => b.name === `${n}_${side}`)));
  const chain = ['clavicle', 'upperarm', 'lowerarm', 'hand', 'middle_01'].map(n => at(`${n}_${side}`)).filter((v): v is THREE.Vector3 => !!v);
  const segs = chain.slice(1).map((v, i) => new THREE.Line3(chain[i], v));
  const v = new THREE.Vector3(), cp = new THREE.Vector3();
  const far = new Uint8Array(P.count);
  for (let i = 0; i < P.count; i++) {
    let aw = 0;
    for (let k = 0; k < 4; k++) if (arm.has(J.getComponent(i, k))) aw += W.getComponent(i, k);
    if (aw < 0.5) continue;
    v.fromBufferAttribute(P, i);
    let d = Infinity;
    for (const sg of segs) { sg.closestPointToPoint(v, true, cp); d = Math.min(d, cp.distanceTo(v)); }
    if (d > R) far[i] = 1;
  }
  const keep: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
    if (!far[a] && !far[b] && !far[c]) keep.push(a, b, c);
  }
  if (keep.length < idx.count) g.setIndex(keep);
}

// ---------- 상황별 동작 조각 (KITS) ----------
// 한 캐릭터의 동작 = 평소 자세(idle*) + 반응(gloat 잡음, flinch 잡힘, check 체크당함, lost 짐) + 손 뻗는 모양(reach*)
// 반응은 k(0~1, 반응 세기를 곱한 값)만큼 평소 자세 위에 섞임. 섞는 순서는 몸 주인 캐릭터의 order
// 다른 캐릭터의 조각을 빌려 오면(characters.jsonc) 그 조각이 이 캐릭터 몸에 그대로 적용됨
type V3 = THREE.Vector3;
type Side = 'l' | 'r';
type React = 'gloat' | 'flinch' | 'check' | 'lost';
interface Body { lean: number; sway: number; yaw: number; pitch: number; tilt: number } // tilt: 고개 갸웃 (+ = 캐릭터 왼쪽으로)
interface Ctx {
  t: number;              // 초
  deskTop: number;
  G: (x: number, y: number, z: number) => V3; // 판 기준 점 → 캐릭터 기준
  headPos: V3; chest: V3; // 몸을 기울인 뒤의 머리·가슴 위치 (손 자리 계산용)
  st: { gk: number; fk: number; check: number; lost: number }; // 지금 반응 정도(0~1, 세기 곱하기 전). 평소 자세가 참고함
  gs: number; fs: number; // 잡음/잡힘 반응이 시작되고 지난 시간 (원래 길이 1.8초/1.2초 기준으로 늘이거나 줄인 초)
  str: number;            // 반응 세기
}
interface Kit {
  order: React[];
  idleBody(c: Ctx): Body;
  idleHand(c: Ctx, s: Side): V3;
  idleDir(c: Ctx, s: Side): V3; // 손끝 방향
  body?: Partial<Record<React, (c: Ctx, o: Body, k: number) => void>>;
  hand?: Partial<Record<React, (c: Ctx, s: Side, w: V3, k: number) => void>>;
  dir?: Partial<Record<React, (c: Ctx, s: Side, d: V3, k: number) => void>>;
  reachShape?(k: number): number;      // 손이 기물까지 가는 진행(0~1) 모양. 없으면 부드럽게
  reachPath?(u: number, pos: V3): void; // 가는 길에 더할 움직임 (u = 0~1)
}
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sideOf = (s: Side) => (s === 'l' ? 1 : -1);
const D0 = (s: Side) => v3(-sideOf(s) * 0.25, -0.35, 1); // 기본 손끝 방향: 앞·아래
const head = (c: Ctx, x: number, y: number, z: number) => c.headPos.clone().add(v3(x, y, z));
const chest = (c: Ctx, x: number, y: number, z: number) => c.chest.clone().add(v3(x, y, z));
const sin = Math.sin, PI = Math.PI;
// 그리디(욕심쟁이) 평소 손 비비기. 잡음 반응(k > 0)이면 빨라지고 손이 들림
function greedyHands(c: Ctx, s: Side, k: number): V3 {
  const side = sideOf(s);
  const rub = sin(c.t * PI * 2 * (k > 0 ? 4 : 1.1)) * (0.22 + k * 0.35);
  return c.G(side * 0.85 + rub * side, c.deskTop + 1.5 + k * 1.4 + rub * 0.2, DESK_EDGE + 1.6 - k * 1.2);
}

const KITS: Record<Who, Kit> = {
  // 겁쟁이: 몸을 빼고 떪, 두리번 / 손 뻗다 멈칫 / 잡힘: 두 손을 가슴 앞으로 / 체크: 왼손으로 얼굴 가리고 외면 / 짐: 두 손으로 얼굴 감쌈
  coward: {
    order: ['gloat', 'flinch', 'check', 'lost'],
    idleBody(c) {
      const fear = Math.max(0.25, c.st.check, c.st.lost, c.st.fk); // 겁이 날수록 더 떪
      const shake = (f: number, ph: number) => sin(c.t * PI * 2 * f + ph);
      const slot = Math.floor(c.t / 1.7), into = (c.t / 1.7) - slot; // 1.7초마다 볼 방향을 새로 고름 (가끔 정면)
      const yawOf = (n: number) => (hash(n) < 0.35 ? 0 : (hash(n + 0.5) - 0.5) * 0.9);
      return {
        lean: -0.1 + (shake(8.1, 0.5) * 0.6 + shake(11.7, 2.1) * 0.4) * 0.01 * fear,
        sway: (shake(9.3, 0) * 0.6 + shake(13.1, 1.7) * 0.4) * 0.012 * fear,
        yaw: THREE.MathUtils.lerp(yawOf(slot - 1), yawOf(slot), ease(clamp01(into / 0.25))),
        pitch: 0.42, tilt: 0,
      };
    },
    // 왼손(손가락이 김)은 책상 모서리에 걸침, 오른손(긴 갈고리)은 책상 앞에 들고 갈고리를 늘어뜨림
    idleHand: (c, s) => (s === 'l' ? c.G(3.0, c.deskTop + 1.1, DESK_EDGE - 0.4) : c.G(-2.6, c.deskTop + 1.2, DESK_EDGE - 1.2)),
    idleDir: (_c, s) => (s === 'l' ? v3(-0.2, -1, 0.25) : v3(0, -1, -0.15)),
    body: {
      flinch: (_c, o, k) => { o.lean -= 0.38 * k; },
      check: (_c, o, k) => { o.lean -= 0.22 * k; o.yaw = o.yaw * (1 - k) + 0.55 * k; o.pitch -= 0.35 * k; },
      lost: (_c, o, k) => { o.lean += 0.55 * k; o.pitch += 0.5 * k; },
    },
    hand: {
      flinch: (c, s, w, k) => { w.lerp(c.G(sideOf(s) * 1.6, c.deskTop + 3.2, PELVIS_Z + 3.2), k); },
      check: (c, s, w, k) => { if (s === 'l') w.lerp(head(c, 0.6, -0.4, 1.7), k); },
      lost: (c, s, w, k) => { w.lerp(head(c, sideOf(s) * 0.9, -0.3, 1.5), k); },
    },
    dir: {
      flinch: (_c, s, d, k) => { d.lerp(s === 'l' ? D0(s) : v3(0.3, 0.6, 1), k); }, // 갈고리를 몸 쪽으로 세움
      check: (_c, s, d, k) => { if (s === 'l') d.lerp(v3(0, 1, 0.3), k); },        // 얼굴 가리는 손: 손바닥이 얼굴로
      lost: (_c, s, d, k) => { d.lerp(s === 'l' ? v3(0, 1, 0.3) : v3(0.3, 0.6, 1), k); },
    },
    // 뻗다가(0~45%) 멈칫 → 조금 물림(45~65%) → 다시 끝까지(65~100%)
    reachShape: k => (k < 0.45 ? ease(k / 0.45) * 0.6 : k < 0.65 ? 0.6 - ease((k - 0.45) / 0.2) * 0.25 : 0.35 + ease((k - 0.65) / 0.35) * 0.65),
  },

  // 허세꾼: 기대어 팔짱 / 손을 높이 들었다 내려놓음 / 잡음: 팔 활짝 / 잡힘: 고개 휙휙 / 체크: 턱 괴고 고민 / 짐: 머리 뒤로 깍지
  bluffer: {
    order: ['check', 'flinch', 'gloat', 'lost'],
    idleBody: c => ({ lean: -0.2, sway: 0, yaw: sin(c.t * 2 * PI / 7) * 0.1, pitch: 0.12, tilt: 0 }),
    idleHand: (c, s) => chest(c, -sideOf(s) * 2.0, -0.6 - (s === 'l' ? 0.35 : 0), 2.6 + (s === 'l' ? 0.3 : 0)),
    idleDir: (_c, s) => v3(-sideOf(s) * 0.7, 0.6, -0.35), // 팔짱: 손끝을 반대쪽 어깨 쪽으로
    body: {
      check: (_c, o, k) => { o.lean += 0.3 * k; o.yaw *= 1 - k; o.pitch += 0.35 * k; },
      flinch: (c, o, k) => { o.yaw += sin(clamp01(c.fs / 1.2) * PI * 6) * 0.45 * k; }, // "아니야" 고개 저음
      gloat: (_c, o, k) => { o.lean -= 0.2 * k; o.pitch -= 0.3 * k; },
      lost: (_c, o, k) => { o.lean -= 0.15 * k; o.yaw = o.yaw * (1 - k) + 0.7 * k; o.pitch -= 0.1 * k; },
    },
    hand: {
      check: (c, s, w, k) => { if (s === 'r') w.lerp(head(c, -0.2, -1.5, 1.6), k); },
      gloat: (c, s, w, k) => { w.lerp(head(c, sideOf(s) * 5.5, -1.2, 2.2), k); },
      lost: (c, s, w, k) => { w.lerp(head(c, sideOf(s) * 0.9, 0.4, -1.4), k); },
    },
    dir: {
      check: (_c, s, d, k) => { if (s === 'r') d.lerp(v3(0, 1, 0.15), k); },
      gloat: (_c, s, d, k) => { d.lerp(v3(sideOf(s), 0.7, 0.4), k); },
      lost: (_c, s, d, k) => { d.lerp(v3(-sideOf(s), 0.3, -0.4), k); },
    },
    reachPath: (u, pos) => { pos.y += sin(PI * u) * 4.5; }, // 가운데쯤 가장 높이
  },

  // 핑계왕: 똑바로 앉아 가끔 아픈 손을 털며 봄 / 잡음: 가슴 툭툭 / 잡힘: 천장 조명을 가리킴 / 체크: 뒷머리 긁적 / 짐: 딴 데 가리키며 으쓱
  excuser: {
    order: ['gloat', 'flinch', 'check', 'lost'],
    idleBody(c) {
      const shakeK = excuserShake(c.t) * (1 - c.st.check) * (1 - c.st.lost);
      const yaw = sin(c.t * 2 * PI / 9) * 0.08 * (1 - c.st.lost);
      return { lean: 0.08, sway: 0, yaw: yaw * (1 - shakeK) - shakeK * 0.35, pitch: 0.42 + shakeK * 0.15, tilt: 0 }; // 터는 오른손을 봄
    },
    idleHand(c, s) {
      const w = c.G(sideOf(s) * 2.3, c.deskTop + 0.6, DESK_EDGE + 1.3); // 두 손을 책상 모서리에 편하게
      const shakeK = excuserShake(c.t) * (1 - c.st.check) * (1 - c.st.lost);
      if (s === 'r' && shakeK > 0) w.lerp(c.G(-1.4 + sin(c.t * PI * 2 * 5) * 0.45, c.deskTop + 3.0, DESK_EDGE - 0.6), shakeK);
      return w;
    },
    idleDir: (_c, s) => D0(s),
    body: {
      gloat: (_c, o, k) => { o.lean -= 0.12 * k; o.pitch -= 0.25 * k; },
      flinch: (_c, o, k) => { o.yaw = o.yaw * (1 - k) + 0.45 * k; o.pitch -= 0.95 * k; }, // 왼쪽 위 조명을 봄
      check: (c, o, k) => { o.lean += 0.05 * k; o.pitch += 0.2 * k; o.yaw += k * sin(c.t * PI * 2 * 0.6) * 0.1; },
      lost: (c, o, k) => { o.lean -= 0.32 * k; o.yaw = o.yaw * (1 - k) + k * (0.6 + sin(c.t * PI * 2 * 0.9) * 0.12); o.pitch = o.pitch * (1 - k) + k * 0.1; },
    },
    hand: {
      gloat: (c, s, w, k) => { if (s === 'l') w.lerp(chest(c, 0.7, 0, 2.0 + Math.max(0, sin(c.gs * PI * 2 * 3)) * 0.5), k); },
      flinch: (c, s, w, k) => { if (s === 'l') w.lerp(head(c, 4.2, 3.2, 3.0), k); },
      check: (c, s, w, k) => { if (s === 'l') w.lerp(head(c, 0.9, 0.5 + sin(c.t * PI * 2 * 3.5) * 0.25, -0.6), k); },
      lost: (c, s, w, k) => {
        w.lerp(s === 'l' ? head(c, 5.5, -1.0, 2.5) : head(c, -2.6, -2.6 + Math.max(0, sin(c.t * PI * 2 * 0.45)) * 0.8, 1.6), k);
      },
    },
    dir: {
      flinch: (_c, s, d, k) => { if (s === 'l') d.lerp(v3(0.75, 0.55, 0.45), k); },
      lost: (_c, s, d, k) => { d.lerp(s === 'l' ? v3(1, -0.1, 0.45) : v3(-0.7, 0.3, 0.6), k); },
    },
  },

  // 돌격대장: 방패를 세우고 바짝 숙임, 주먹으로 톡톡 / 기물을 확 밀어붙임 / 잡음: 주먹 번쩍 / 잡힘: 주먹을 쭉 / 체크: 방패로 얼굴 막음 / 짐: 책상 쿵쿵
  attacker: {
    order: ['gloat', 'check', 'flinch', 'lost'],
    idleBody: c => ({ lean: 0.34 + sin(c.t * PI * 2 * 0.55) * 0.025, sway: 0, yaw: sin(c.t * 2 * PI / 6) * 0.07 * (1 - c.st.lost), pitch: 0.38, tilt: 0 }),
    idleHand: (c, s) => (s === 'l' ? chest(c, 1.6, -1.4, 3.4)
      : c.G(-2.6, c.deskTop + 0.75 + Math.max(0, sin(c.t * PI * 2 * 1.7)) * 0.55, DESK_EDGE + 1.5)),
    idleDir: (_c, s) => (s === 'l' ? v3(-0.2, 0.2, 1) : D0(s)), // 왼손: 방패 손잡이를 쥔 채 앞으로
    body: {
      gloat: (_c, o, k) => { o.lean -= 0.4 * k; o.pitch -= 0.55 * k; },
      flinch: (_c, o, k) => { o.lean += 0.15 * k; },
      check: (_c, o, k) => { o.lean += 0.08 * k; o.pitch += 0.05 * k; },
      lost: (_c, o, k) => { o.lean -= 0.1 * k; o.pitch += 0.55 * k; },
    },
    hand: {
      gloat: (c, s, w, k) => { if (s === 'r') w.lerp(head(c, -2.4, 3.6, 0.8), k); },
      check: (c, s, w, k) => { if (s === 'l') w.lerp(head(c, 1.2, -1.6, 3.0), k); },
      flinch: (c, s, w, k) => { w.lerp(s === 'l' ? chest(c, 1.4, -0.6, 3.8) : c.G(-1.6, c.deskTop + 3.2, DESK_EDGE + 5.5), k); },
      lost(c, s, w, k) {
        if (s === 'l') { w.lerp(c.G(3.2, c.deskTop + 1.0, DESK_EDGE + 1.4), k); return; }
        const u = c.t % 1.4, up = u < 0.5 ? sin(PI * u / 0.5) : 0; // 1.4초마다 쿵
        w.lerp(c.G(-2.0, c.deskTop + 0.7 + up * 2.2, DESK_EDGE + 1.6), k);
      },
    },
    dir: {
      gloat: (_c, s, d, k) => { if (s === 'r') d.lerp(v3(0, 1, 0.2), k); },
      flinch: (_c, s, d, k) => { if (s === 'r') d.lerp(v3(0, 0, 1), k); },
    },
    reachShape: overshoot, // 살짝 지나쳤다 돌아옴
  },

  // 랜덤: 2.3초마다 아무 자세 / 갈지자로 손 뻗기 / 잡음: 박수 / 잡힘: 갸웃하며 으쓱 / 짐: 기대어 천장 보며 으쓱
  random: {
    order: ['gloat', 'flinch', 'check', 'lost'],
    idleBody(c) {
      const { slot, into } = randomSlot(c.t);
      const pick = (n: number, seed: number) => hash(n * 3.7 + seed);
      const mix = (seed: number) => THREE.MathUtils.lerp(pick(slot - 1, seed), pick(slot, seed), into) - 0.5;
      return { lean: 0.05 + mix(0.1) * 0.35, sway: 0, yaw: mix(0.4) * 1.3, pitch: 0.3 + mix(0.7) * 0.8, tilt: mix(0.9) * 0.7 };
    },
    idleHand(c, s) {
      // 자세 5가지 중 칸마다 하나: 책상에 손 / 머리 긁기 / 턱 괴기 / 책상 두드리기 / 손 흔들기
      const side = sideOf(s);
      const { slot, into } = randomSlot(c.t);
      const poseOf = (n: number) => {
        const kind = Math.floor(hash(n * 5.3 + 0.2) * 5);
        if (kind === 1 && s === 'r') return head(c, -1.0, 1.0 + sin(c.t * PI * 2 * 3) * 0.3, -0.3);
        if (kind === 2 && s === 'l') return head(c, 0.3, -1.6, 1.5);
        if (kind === 3) return c.G(side * 1.8, c.deskTop + 0.8 + Math.max(0, sin(c.t * PI * 2 * 4 + (s === 'l' ? 0 : 1.6))) * 0.5, DESK_EDGE + 2.0);
        if (kind === 4 && s === 'l') return head(c, 3.2 + sin(c.t * PI * 2 * 1.8) * 0.9, 0.6, 2.0);
        return c.G(side * 2.4, c.deskTop + 0.7, DESK_EDGE + 1.3);
      };
      return poseOf(slot - 1).lerp(poseOf(slot), into);
    },
    idleDir: (_c, s) => D0(s),
    body: {
      gloat: (_c, o, k) => { o.pitch -= 0.6 * k; },
      flinch: (_c, o, k) => { o.tilt += 0.35 * k; },
      lost: (c, o, k) => { o.lean = o.lean * (1 - k) - 0.3 * k; o.pitch = o.pitch * (1 - k) - 0.5 * k; o.tilt = o.tilt * (1 - k) + k * sin(c.t * PI * 2 * 0.4) * 0.3; },
    },
    hand: {
      gloat: (c, s, w, k) => { w.lerp(head(c, sideOf(s) * ((0.5 + 0.5 * Math.cos(c.gs * PI * 2 * 3)) * 0.9 + 0.15), -3.0, 2.6), k); },
      flinch: (c, s, w, k) => { w.lerp(head(c, sideOf(s) * 3.0, -2.8, 1.8), k); },
      lost: (c, s, w, k) => { w.lerp(head(c, sideOf(s) * 3.0, -2.8 + Math.max(0, sin(c.t * PI * 2 * 0.45)) * 0.8 * k, 1.8), k); },
    },
    dir: {
      gloat: (_c, s, d, k) => { d.lerp(v3(-sideOf(s) * 0.3, 0.9, 0.5), k); }, // 박수: 손바닥끼리
      flinch: (_c, s, d, k) => { d.lerp(v3(sideOf(s) * 0.6, 0.8, 0.2), k); }, // 으쓱: 손끝이 바깥 위로
      lost: (_c, s, d, k) => { d.lerp(v3(sideOf(s) * 0.6, 0.8, 0.2), k); },
    },
    reachPath(u, pos) { // 갈지자로 비틀비틀
      pos.x += sin(u * PI * 3) * 1.6 * sin(PI * u);
      pos.y += sin(u * PI * 2) * 1.0 * sin(PI * u);
    },
  },

  // 퀸 사랑꾼: 두 손을 모으고 갸웃 / 높이 둥글게 우아하게 / 잡음: 손을 뺨에 대고 좌우로 / 잡힘: 두 손으로 뺨 감쌈 / 체크: 왼손으로 막음 / 짐: 가슴 움켜쥠
  queenlover: {
    order: ['gloat', 'flinch', 'check', 'lost'],
    idleBody(c) {
      const dreamy = 1 - Math.max(c.st.check, c.st.lost, c.st.fk);
      return { lean: 0.02, sway: 0, yaw: sin(c.t * 2 * PI / 8) * 0.12 * dreamy, pitch: 0.45, tilt: (0.2 + sin(c.t * 2 * PI / 5) * 0.06) * dreamy };
    },
    idleHand: (c, s) => chest(c, sideOf(s) * 0.45, -0.6 + sin(c.t * PI * 2 / 4) * 0.15, 2.6),
    idleDir: (_c, s) => v3(-sideOf(s) * 0.5, 0.9, 0.35), // 모은 손: 손끝이 위·가운데로
    body: {
      gloat: (c, o, k) => {
        o.lean -= 0.05 * k; o.pitch -= 0.25 * k;
        o.tilt += sin(c.gs * PI * 2 * 1.2) * 0.22 * k;
        o.sway += sin(c.gs * PI * 2 * 1.2) * 0.05 * k; // 기뻐서 몸을 좌우로
      },
      flinch: (_c, o, k) => { o.lean -= 0.3 * k; o.pitch -= 0.2 * k; },
      check: (_c, o, k) => { o.lean += 0.12 * k; },
      lost: (_c, o, k) => { o.lean += 0.45 * k; o.pitch += 0.55 * k; },
    },
    hand: {
      gloat: (c, s, w, k) => { w.lerp(head(c, -0.9 + sideOf(s) * 0.4, -1.2, 1.4), k); },
      flinch: (c, s, w, k) => { w.lerp(head(c, sideOf(s) * 1.1, -0.6, 1.2), k); },
      check: (c, s, w, k) => { w.lerp(s === 'l' ? c.G(1.6, c.deskTop + 3.4, DESK_EDGE + 4.8) : chest(c, -0.5, 0.2, 1.7), k); },
      lost: (c, s, w, k) => { w.lerp(chest(c, sideOf(s) * 0.6, 0.4, 1.6), k); },
    },
    dir: {
      check: (_c, s, d, k) => { if (s === 'l') d.lerp(v3(0, 1, 0.4), k); }, // 뻗은 왼손: 손바닥을 세워 막음
      lost: (_c, s, d, k) => { d.lerp(v3(-sideOf(s) * 0.8, 0.2, 0.2), k); },
    },
    reachPath: (u, pos) => { pos.y += sin(PI * u) * 3.2; },
  },

  // 욕심쟁이: 숙여서 손을 비비며 판을 훑음 / 손이 아주 빠름 / 잡음: 젖히고 신나게 비빔 / 잡힘: 주먹으로 책상 쾅 / 체크: 노려봄 / 짐: 털썩, 팔 늘어뜨림
  greedy: {
    order: ['gloat', 'flinch', 'check', 'lost'],
    idleBody: c => ({ lean: 0.26, sway: 0, yaw: sin(c.t * 2 * PI / 5.5) * 0.22 * (1 - c.st.lost), pitch: 0.5, tilt: 0 }),
    idleHand: (c, s) => greedyHands(c, s, 0),
    idleDir: (_c, s) => D0(s),
    body: {
      gloat: (_c, o, k) => { o.lean -= 0.32 * k; o.pitch -= 0.55 * k; },
      flinch: (_c, o, k) => { o.lean += 0.12 * k; },
      check: (_c, o, k) => { o.lean += 0.1 * k; o.pitch += 0.15 * k; },
      lost: (_c, o, k) => { o.lean -= 0.5 * k; o.pitch += 0.45 * k; },
    },
    hand: {
      // 평소 비비기와의 차이만큼 더함 (빨라지고 손이 들림)
      gloat: (c, s, w, k) => { if (k > 0) w.add(greedyHands(c, s, k).sub(greedyHands(c, s, 0))); },
      flinch(c, s, w) { // 오른손을 들었다가 책상을 쾅 (반응 시간표대로, 세기만큼)
        const f = c.fs;
        if (s !== 'r' || f < 0 || f >= 1.2) return;
        const up = f < 0.32 ? ease(f / 0.32) : f < 0.42 ? 1 - (f - 0.32) / 0.1 : 0;
        const hold = f < 0.32 ? 0 : f < 0.9 ? 1 : 1 - (f - 0.9) / 0.3;
        w.lerp(c.G(-2.6, c.deskTop + 0.55 + up * 4.2, DESK_EDGE + 1.4), Math.max(up, hold) * c.str);
      },
      lost: (c, s, w, k) => { w.lerp(c.G(sideOf(s) * 4.2, c.deskTop - 4.5, PELVIS_Z + 1.2), k); },
    },
  },
};

export function createHuman(who: Who, deskTop: number): Opponent {
  const base = STYLES[who];
  // characters.jsonc의 3D 설정 (없으면 STYLES 기본값)
  const tune = getHumanTuning(who);
  const reachIn = tune.reachIn ?? base.reachIn, reachOut = tune.reachOut ?? base.reachOut;
  const gloatTime = tune.gloatTime ?? 1.8, flinchTime = tune.flinchTime ?? 1.2;
  const strength = tune.strength ?? 1;
  const kitOf = (slot: 'idle' | 'reach' | React): Kit | null => {
    const m = tune.moves?.[slot] ?? who;
    return m === 'none' ? null : KITS[m];
  };
  const idleKit = KITS[tune.moves?.idle && tune.moves.idle !== 'none' ? tune.moves.idle : who];
  const reachKit = kitOf('reach') ?? KITS[who];
  const reactKit: Record<React, Kit | null> = { gloat: kitOf('gloat'), flinch: kitOf('flinch'), check: kitOf('check'), lost: kitOf('lost') };
  const order = KITS[who].order;

  const group = new THREE.Group();
  const floorY = deskTop - DESK.height;
  let rig: Rig | null = null;
  const tips: { l?: THREE.Bone; r?: THREE.Bone } = {};
  const palmLocal: { l?: THREE.Vector3; r?: THREE.Vector3 } = {}; // 손바닥 방향 (손 뼈 기준)
  let disposed = false;

  // 등 뒤에서 비추는 빛 (어두운 방에서도 윤곽이 보이게) + 얼굴 쪽 약한 빛
  const rim = new THREE.SpotLight(tune.rimColor ?? base.rimColor, 70, 34, Math.PI / 5, 0.6, 1.5);
  rim.position.set(0, deskTop + 14, PELVIS_Z - 9);
  rim.target.position.set(0, deskTop + 4, PELVIS_Z);
  const fill = new THREE.PointLight(0xfff0e0, 9, 16, 1.6);
  fill.position.set(0, deskTop + 6, -3);
  group.add(rim, rim.target, fill);

  // 손 위치 (캐릭터 기준). 부드럽게 따라가도록 지금 값을 들고 있음
  const handNow = { l: new THREE.Vector3(), r: new THREE.Vector3() };
  let handInit = false;
  // 부드럽게 바뀌는 값들 (0~1)
  const sm = { lost: 0, check: 0, lean: 0, reachLean: 0 };
  let lost = false, inCheck = false;
  let reachAnim: { start: number; from: THREE.Vector3; to: THREE.Vector3; moveTime: number } | null = null;
  let flinchAt = -1e9, gloatAt = -1e9; // 반응이 시작된 시각
  let lastNow = performance.now();

  loadRig(base.file, base.rig).then(r => {
    if (!r || disposed) return;
    rig = r;
    group.add(r.root);
    if (base.cutFlap) for (const m of r.meshes) cutFlap(m, base.cutFlap.side, base.cutFlap.r);
    // 손가락 뼈가 없는 모델(허세꾼): 손 끝 방향을 잴 '손끝' 가상 뼈를 손에 붙임 (처음 자세에서 아래팔 → 손 방향으로 2칸)
    r.root.updateMatrixWorld(true);
    for (const s of ['l', 'r'] as const) {
      const hand = r.bone('hand_' + s), lower = r.bone('lowerarm_' + s);
      if (r.bone('middle_01_' + s) || !hand || !lower) continue;
      const hw = hand.getWorldPosition(new THREE.Vector3()), lw = lower.getWorldPosition(new THREE.Vector3());
      const tipWorld = hw.clone().add(hw.clone().sub(lw).normalize().multiplyScalar(0.3));
      const tip = new THREE.Bone();
      hand.add(tip);
      tip.position.copy(hand.worldToLocal(tipWorld));
      tips[s] = tip;
    }
    // 손바닥 방향을 손 뼈 기준으로 저장 (처음 자세에서)
    if (base.palm) {
      const rootQ = r.root.getWorldQuaternion(new THREE.Quaternion());
      for (const s of ['l', 'r'] as const) {
        const hand = r.bone('hand_' + s);
        if (!hand) continue;
        const [x, y, z] = base.palm;
        const world = new THREE.Vector3(s === 'l' ? x : -x, y, z).applyQuaternion(rootQ);
        palmLocal[s] = world.applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize();
      }
    }
    // 엉덩이가 의자 높이에 오게 통째로 내림
    const pelvisY = r.restWorld('pelvis').y;
    r.root.position.set(0, floorY + SEAT_H - pelvisY, PELVIS_Z);
  });

  // 판 위의 점(group 기준) → 캐릭터 기준
  const toRig = (p: THREE.Vector3) => p.clone().sub(rig!.root.position);
  const G = (x: number, y: number, z: number) => toRig(new THREE.Vector3(x, y, z));

  function pose(now: number, dt: number): boolean {
    const r = rig!;
    const b = (n: string) => r.bone(n);
    const t = now / 1000;
    let busy = false;

    // ── 상태 값 부드럽게 ──
    const follow = (key: keyof typeof sm, want: number, speed: number) => {
      const k = 1 - Math.exp(-dt * speed);
      const next = sm[key] + (want - sm[key]) * k;
      if (Math.abs(next - want) > 0.002) busy = true;
      sm[key] = Math.abs(next - want) < 0.0005 ? want : next;
    };
    follow('lost', lost ? 1 : 0, 3);
    follow('check', inCheck && !lost ? 1 : 0, 5);
    const flinch = (now - flinchAt) / 1000; // 움찔/쾅 반응이 시작되고 지난 초
    const gloat = (now - gloatAt) / 1000;   // 잡고 신난 반응
    const flinchK = flinch >= 0 && flinch < flinchTime ? Math.sin(Math.PI * clamp01(flinch / flinchTime)) : 0;
    const gloatK = gloat >= 0 && gloat < gloatTime ? Math.sin(Math.PI * clamp01(gloat / gloatTime)) : 0;
    if ((flinch >= 0 && flinch < flinchTime) || (gloat >= 0 && gloat < gloatTime)) busy = true;
    const c: Ctx = {
      t, deskTop, G, headPos: new THREE.Vector3(), chest: new THREE.Vector3(),
      st: { gk: gloatK, fk: flinchK, check: sm.check, lost: sm.lost },
      gs: gloat / gloatTime * 1.8, fs: flinch / flinchTime * 1.2, str: strength,
    };
    const kOf: Record<React, number> = { gloat: gloatK * strength, flinch: flinchK * strength, check: sm.check * strength, lost: sm.lost * strength };

    // ── 손 뻗기 진행 ──
    let reachK = 0; // 0 = 손이 제자리, 1 = 기물에 닿음
    let reachPos: THREE.Vector3 | null = null;
    if (reachAnim) {
      busy = true;
      const e = now - reachAnim.start;
      const from = toRig(r.root.parent!.worldToLocal(reachAnim.from.clone()));
      const to = toRig(r.root.parent!.worldToLocal(reachAnim.to.clone()));
      // 손목은 기물 위, 살짝 몸 쪽 (허세꾼은 갑옷 손톱이 길어서 더 높고 뒤에서 손톱 끝으로 집음)
      const grip = new THREE.Vector3(...(base.grip ?? [0, 2.1, -1.1]));
      let above = (p: THREE.Vector3) => p.clone().add(grip);
      if (base.palm) {
        // 팔·손목을 거의 곧게 펴고 손끝으로 옮김: 손목은 '어깨 → 기물 윗부분' 선 위에서 손 길이만큼 앞
        const sh = b('upperarm_r'), hd = b('hand_r'), md = b('middle_01_r');
        if (sh && hd && md) {
          const shoulder = bonePos(r, sh);
          const len = bonePos(r, md).distanceTo(bonePos(r, hd)) * FINGER_REACH;
          above = (p: THREE.Vector3) => {
            const tipAt = p.clone().add(new THREE.Vector3(0, PIECE_TOP, 0));
            // 손가락은 '어깨 → 손끝' 선에서 손목을 젖힌 만큼(WRIST_FLEX) 위로 기울어 있으니, 그 방향으로 손 길이만큼 뒤가 손목
            const d = tipAt.clone().sub(shoulder).normalize();
            const up = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
            const finger = d.multiplyScalar(Math.cos(WRIST_FLEX)).addScaledVector(up, -Math.sin(WRIST_FLEX));
            return tipAt.addScaledVector(finger, -len);
          };
        }
      }
      if (e < reachIn) {
        const u = e / reachIn;
        reachK = (reachKit.reachShape ?? ease)(u);
        reachPos = above(from);
        reachKit.reachPath?.(clamp01(u), reachPos);
      } else if (e < reachIn + reachAnim.moveTime) {
        reachK = 1;
        reachPos = above(from).lerp(above(to), ease((e - reachIn) / reachAnim.moveTime));
      } else if (e < reachIn + reachAnim.moveTime + reachOut) {
        reachK = 1 - ease((e - reachIn - reachAnim.moveTime) / reachOut);
        reachPos = above(to);
      } else {
        reachAnim = null;
      }
    }

    r.reset();

    // ── 다리: 허벅지는 앞으로, 정강이는 아래로 ──
    for (const s of ['l', 'r'] as const) {
      const side = s === 'l' ? 1 : -1;
      const thigh = b('thigh_' + s), calf = b('calf_' + s), foot = b('foot_' + s), ball = b('ball_' + s);
      if (thigh && calf) aim(r, thigh, calf, new THREE.Vector3(side * 0.16, -0.06, 1));
      if (calf && foot) aim(r, calf, foot, new THREE.Vector3(0, -1, 0.12));
      if (foot && ball) aim(r, foot, ball, new THREE.Vector3(0, -0.15, 1));
    }

    // ── 몸통 기울기 (+ 앞으로 숙임, − 뒤로 젖힘)와 고개: 평소 자세 위에 반응을 차례로 ──
    const o = idleKit.idleBody(c);
    for (const ev of order) { const kit = reactKit[ev]; if (kit?.body?.[ev] && kOf[ev] > 0) kit.body[ev]!(c, o, kOf[ev]); }
    // 먼 칸까지 손을 뻗을 때는 몸을 앞으로 더 숙임
    let wantReachLean = 0;
    if (reachPos) {
      const sh = r.restWorld('upperarm_r');
      const dist = Math.hypot(reachPos.z - sh.z, reachPos.y - sh.y);
      wantReachLean = Math.min(0.75, Math.max(0, (dist - 7.5) / 9)) * reachK;
    }
    sm.reachLean = wantReachLean; // 손 뻗기 진행에 이미 부드럽게 맞춰져 있음
    const totalLean = o.lean + sm.reachLean;
    for (const n of ['spine_01', 'spine_02', 'spine_03']) {
      const bone = b(n);
      if (bone) { turn(r, bone, X, totalLean / 3); turn(r, bone, Z, o.sway); }
    }
    // 고개: 몸이 숙인 만큼 빼고, 보고 싶은 쪽으로
    const nod = o.pitch - totalLean - (reachK > 0 ? -0.1 * reachK : 0);
    const neck = b('neck_01'), head = b('head');
    if (neck) { turn(r, neck, X, nod * 0.4); turn(r, neck, Y, o.yaw * 0.4); turn(r, neck, Z, -o.tilt * 0.4); }
    if (head) { turn(r, head, X, nod * 0.6); turn(r, head, Y, o.yaw * 0.6); turn(r, head, Z, -o.tilt * 0.6); }

    // ── 손이 있어야 할 곳 (캐릭터 기준) ──
    c.headPos = head ? bonePos(r, head) : G(0, deskTop + 8, PELVIS_Z);
    const sp3 = b('spine_03');
    c.chest = sp3 ? bonePos(r, sp3) : G(0, deskTop + 4, PELVIS_Z);
    const want = { l: new THREE.Vector3(), r: new THREE.Vector3() };
    for (const s of ['l', 'r'] as const) {
      want[s] = idleKit.idleHand(c, s);
      for (const ev of order) { const kit = reactKit[ev]; if (kit?.hand?.[ev] && (kOf[ev] > 0 || ev === 'flinch')) kit.hand[ev]!(c, s, want[s], kOf[ev]); }
    }
    const kHand = 1 - Math.exp(-dt * 12);
    for (const s of ['l', 'r'] as const) {
      if (!handInit) handNow[s].copy(want[s]);
      else handNow[s].lerp(want[s], kHand);
      if (handNow[s].distanceTo(want[s]) > 0.3) busy = true; // 크게 옮기는 중일 때만 (손 비비기 같은 잔동작은 초당 12장으로 충분)
    }
    handInit = true;
    // 오른손은 수를 둘 때 기물로
    const rHand = reachPos ? handNow.r.clone().lerp(reachPos, reachK) : handNow.r;

    // ── 팔 ──
    for (const s of ['l', 'r'] as const) {
      const side = s === 'l' ? 1 : -1;
      const upper = b('upperarm_' + s), lower = b('lowerarm_' + s), hand = b('hand_' + s), mid = b('middle_01_' + s) ?? tips[s] ?? null;
      if (!upper || !lower || !hand) continue;
      const target = s === 'r' ? rHand : handNow.l;
      reachIK(r, upper, lower, hand, target, new THREE.Vector3(side * 0.8, -0.6, -0.4).normalize());
      const pl = s === 'r' && reachK > 0 ? palmLocal[s] : undefined;
      if (pl) rollForearm(r, lower, hand, pl, PALM_DOWN, reachK);
      if (mid) {
        // 손끝 방향: 평소 자세 + 반응. 기물을 집을 때는 아래로
        const dir = idleKit.idleDir(c, s);
        for (const ev of order) { const kit = reactKit[ev]; if (kit?.dir?.[ev] && kOf[ev] > 0) kit.dir[ev]!(c, s, dir, kOf[ev]); }
        if (pl) {
          // 손끝 = 아래팔 방향을 손바닥 쪽으로 WRIST_FLEX만큼 굽힌 방향 (손목이 늘 자연스러운 쪽으로만 꺾임)
          const fa = bonePos(r, hand).sub(bonePos(r, lower)).normalize();
          const pd = palmDir(r, hand, pl); pd.addScaledVector(fa, -pd.dot(fa)).normalize();
          dir.lerp(fa.multiplyScalar(Math.cos(WRIST_FLEX)).addScaledVector(pd, Math.sin(WRIST_FLEX)), reachK);
        } else if (s === 'r' && reachK > 0) dir.lerp(who === 'bluffer' ? new THREE.Vector3(0, -0.45, 1) : who === 'coward' ? new THREE.Vector3(0, -0.6, 1) : new THREE.Vector3(0, -1, 0.45), reachK);
        aim(r, hand, mid, dir);
      }
    }
    return busy;
  }

  return {
    group,
    update(now) {
      const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      if (!rig) return false;
      return pose(now, dt);
    },
    reach(from, to, moveTime) {
      group.updateMatrixWorld(true);
      reachAnim = { start: performance.now(), from: from.clone(), to: to.clone(), moveTime };
      return reachIn;
    },
    setLost(v) { lost = v; },
    setInCheck(v) { inCheck = v; },
    react(ev, delay) {
      const at = performance.now() + delay;
      if (ev === 'lostPiece') flinchAt = at;
      else gloatAt = at;
    },
    dispose() {
      disposed = true;
      // 모양·재질은 다음에 다시 앉힐 때 재사용하므로 지우지 않음 (characterModel.ts의 cache)
    },
  };
}
