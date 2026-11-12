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
// 랜덤: 두건 쓴 방랑자 (들고 있던 깃대는 뺌). 2.3초마다 아무 자세나 새로 고름
//         (책상에 손 / 머리 긁기 / 턱 괴기 / 손가락으로 책상 두드리기 / 손 흔들기) + 고개도 아무 데나 갸웃
//         수를 둘 때 손이 갈지자로 비틀비틀 감. 잡든 잡히든 체크든 별 관심 없음:
//         잡으면 박수, 잡히면 어깨 으쓱, 지면 의자에 기대 천장을 보며 계속 으쓱
// 퀸 사랑꾼: 후광을 쓴 망토 군주. 꼿꼿이 앉아 두 손을 가슴 앞에 모으고 고개를 갸웃 (판 위의 퀸을 황홀하게 바라봄)
//         수를 둘 때 손을 높이 둥글게 들어 천천히 우아하게 내려놓음
//         기물을 잡으면 모은 손을 뺨에 대고 몸을 좌우로 흔듦, 자기 기물을 잡히면 두 손으로 뺨을 감싸고 깜짝 놀람
//         체크당하면 왼손을 판 위로 뻗어 막고("퀸 근처엔 오지 마!") 오른손은 가슴에, 지면(= 퀸을 잃고 기권) 두 손으로 가슴을 움켜쥐고 고개를 푹 숙임
import * as THREE from 'three';
import type { Opponent } from './opponent';
import { DESK } from './room';
import { aim, bonePos, loadRig, reachIK, turn, type Rig, type RigOptions } from './characterModel';

export type Who = 'coward' | 'greedy' | 'bluffer' | 'excuser' | 'attacker' | 'random' | 'queenlover';

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
  // 손바닥이 기물 쪽(아래·몸 쪽)을 보도록 손목을 손끝 축으로 비틂. 없으면 손끝 방향만 맞춤
  palm?: [number, number, number];
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

// 기물을 집을 때 손바닥이 향할 쪽 (캐릭터 기준): 아래, 조금 몸 쪽
const PALM_GRIP = new THREE.Vector3(0, -0.45, -1).normalize();
// 손을 손끝 축(손 → mid) 둘레로 돌려서 손바닥(palmLocal, 손 뼈 기준)이 want(캐릭터 기준) 쪽을 보게. k = 얼마나(0~1)
function twistPalm(r: Rig, hand: THREE.Bone, mid: THREE.Bone, palmLocal: THREE.Vector3, want: THREE.Vector3, k: number) {
  const axis = bonePos(r, mid).sub(bonePos(r, hand)).normalize();
  const rootQ = r.root.getWorldQuaternion(new THREE.Quaternion());
  const handQ = rootQ.clone().invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion())); // 캐릭터 기준 손 회전
  const cur = palmLocal.clone().applyQuaternion(handQ);
  const a = cur.addScaledVector(axis, -cur.dot(axis));
  const b = want.clone().addScaledVector(axis, -want.dot(axis));
  if (a.lengthSq() < 1e-6 || b.lengthSq() < 1e-6) return;
  a.normalize(); b.normalize();
  const angle = Math.atan2(new THREE.Vector3().crossVectors(a, b).dot(axis), a.dot(b));
  turn(r, hand, axis, angle * k);
}

export function createHuman(who: Who, deskTop: number): Opponent {
  const style = STYLES[who];
  const group = new THREE.Group();
  const floorY = deskTop - DESK.height;
  let rig: Rig | null = null;
  const tips: { l?: THREE.Bone; r?: THREE.Bone } = {};
  const palmLocal: { l?: THREE.Vector3; r?: THREE.Vector3 } = {}; // 손바닥 방향 (손 뼈 기준)
  let disposed = false;

  // 등 뒤에서 비추는 빛 (어두운 방에서도 윤곽이 보이게) + 얼굴 쪽 약한 빛
  const rim = new THREE.SpotLight(style.rimColor, 70, 34, Math.PI / 5, 0.6, 1.5);
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

  loadRig(style.file, style.rig).then(r => {
    if (!r || disposed) return;
    rig = r;
    group.add(r.root);
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
    if (style.palm) {
      const rootQ = r.root.getWorldQuaternion(new THREE.Quaternion());
      for (const s of ['l', 'r'] as const) {
        const hand = r.bone('hand_' + s);
        if (!hand) continue;
        const [x, y, z] = style.palm;
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
    const flinchK = flinch >= 0 && flinch < 1.2 ? Math.sin(Math.PI * clamp01(flinch / 1.2)) : 0;
    const gloatK = gloat >= 0 && gloat < 1.8 ? Math.sin(Math.PI * clamp01(gloat / 1.8)) : 0;
    if (flinchK > 0 || gloatK > 0 || (flinch >= 0 && flinch < 1.2) || (gloat >= 0 && gloat < 1.8)) busy = true;

    // ── 손 뻗기 진행 ──
    let reachK = 0; // 0 = 손이 제자리, 1 = 기물에 닿음
    let reachPos: THREE.Vector3 | null = null;
    if (reachAnim) {
      busy = true;
      const e = now - reachAnim.start;
      const from = toRig(r.root.parent!.worldToLocal(reachAnim.from.clone()));
      const to = toRig(r.root.parent!.worldToLocal(reachAnim.to.clone()));
      // 손목은 기물 위, 살짝 몸 쪽 (허세꾼은 갑옷 손톱이 길어서 더 높고 뒤에서 손톱 끝으로 집음)
      const grip = new THREE.Vector3(...(style.grip ?? [0, 2.1, -1.1]));
      const above = (p: THREE.Vector3) => p.clone().add(grip);
      if (e < style.reachIn) {
        let k = e / style.reachIn;
        if (who === 'coward') {
          // 뻗다가(0~45%) 멈칫 → 조금 물림(45~65%) → 다시 끝까지(65~100%)
          k = k < 0.45 ? ease(k / 0.45) * 0.6 : k < 0.65 ? 0.6 - ease((k - 0.45) / 0.2) * 0.25 : 0.35 + ease((k - 0.65) / 0.35) * 0.65;
        } else if (who === 'attacker') k = overshoot(k);
        else k = ease(k);
        reachK = k;
        reachPos = above(from);
        // 허세꾼: 손을 높이 들었다가 내려놓음 (가는 길 가운데쯤 가장 높이)
        if (who === 'bluffer') reachPos.y += Math.sin(Math.PI * clamp01(e / style.reachIn)) * 4.5;
        // 퀸 사랑꾼: 높이 둥글게 들었다가 사뿐히
        if (who === 'queenlover') reachPos.y += Math.sin(Math.PI * clamp01(e / style.reachIn)) * 3.2;
        // 랜덤: 갈지자로 비틀비틀
        if (who === 'random') {
          const u = clamp01(e / style.reachIn);
          reachPos.x += Math.sin(u * Math.PI * 3) * 1.6 * Math.sin(Math.PI * u);
          reachPos.y += Math.sin(u * Math.PI * 2) * 1.0 * Math.sin(Math.PI * u);
        }
      } else if (e < style.reachIn + reachAnim.moveTime) {
        reachK = 1;
        reachPos = above(from).lerp(above(to), ease((e - style.reachIn) / reachAnim.moveTime));
      } else if (e < style.reachIn + reachAnim.moveTime + style.reachOut) {
        reachK = 1 - ease((e - style.reachIn - reachAnim.moveTime) / style.reachOut);
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

    // ── 몸통 기울기 (+ 앞으로 숙임, − 뒤로 젖힘) ──
    let lean: number, sway = 0, lookPitch: number, lookYaw = 0, tilt = 0; // tilt: 고개 갸웃 (+ = 캐릭터 왼쪽으로)
    if (who === 'coward') {
      // 겁이 날수록(체크, 짐, 움찔) 더 떪
      const fear = Math.max(0.25, sm.check, sm.lost, flinchK);
      const shake = (f: number, ph: number) => Math.sin(t * Math.PI * 2 * f + ph);
      lean = -0.1 - sm.check * 0.22 - flinchK * 0.38 + sm.lost * 0.55;
      sway = (shake(9.3, 0) * 0.6 + shake(13.1, 1.7) * 0.4) * 0.012 * fear;
      lean += (shake(8.1, 0.5) * 0.6 + shake(11.7, 2.1) * 0.4) * 0.01 * fear;
      // 두리번: 1.7초마다 볼 방향을 새로 고름 (가끔은 정면)
      const slot = Math.floor(t / 1.7), into = (t / 1.7) - slot;
      const yawOf = (n: number) => (hash(n) < 0.35 ? 0 : (hash(n + 0.5) - 0.5) * 0.9);
      lookYaw = THREE.MathUtils.lerp(yawOf(slot - 1), yawOf(slot), ease(clamp01(into / 0.25)));
      lookYaw = lookYaw * (1 - sm.check) + sm.check * 0.55; // 체크면 고개를 돌려 외면
      lookPitch = 0.42 + sm.lost * 0.5 - sm.check * 0.35;
    } else if (who === 'bluffer') {
      // 뒤로 기대 턱을 듦. 체크면 몸을 세워 판을 봄, 지면 더 기대고 고개를 옆으로 돌림
      lean = -0.2 - gloatK * 0.2 + sm.check * 0.3 - sm.lost * 0.15;
      lookYaw = Math.sin(t * 2 * Math.PI / 7) * 0.1 * (1 - sm.check);
      lookYaw += Math.sin(clamp01(flinch / 1.2) * Math.PI * 6) * 0.45 * flinchK; // 잡히면 "아니야" 고개 저음
      lookYaw = lookYaw * (1 - sm.lost) + sm.lost * 0.7;
      lookPitch = 0.12 - gloatK * 0.3 + sm.check * 0.35 - sm.lost * 0.1;
    } else if (who === 'excuser') {
      // 똑바로 앉음. 손을 털 때는 그 손을 봄, 잡히면 고개를 들어 조명 쪽, 지면 기대서 가리키는 쪽을 봄
      lean = 0.08 - gloatK * 0.12 + sm.check * 0.05 - sm.lost * 0.32;
      lookYaw = Math.sin(t * 2 * Math.PI / 9) * 0.08 * (1 - sm.lost);
      lookPitch = 0.42 - gloatK * 0.25;
      const shakeK = excuserShake(t) * (1 - sm.check) * (1 - sm.lost);
      lookYaw = lookYaw * (1 - shakeK) - shakeK * 0.35;   // 오른손(화면 왼쪽)을 봄
      lookPitch += shakeK * 0.15;
      lookYaw = lookYaw * (1 - flinchK) + flinchK * 0.45;  // 잡히면 왼쪽 위 조명을 봄
      lookPitch -= flinchK * 0.95;
      lookPitch += sm.check * 0.2;                         // 체크: 고개를 숙이고 긁적
      lookYaw += sm.check * Math.sin(t * Math.PI * 2 * 0.6) * 0.1;
      // 지면: 가리키는 쪽(왼쪽)을 보며 가끔 고개를 저음
      lookYaw = lookYaw * (1 - sm.lost) + sm.lost * (0.6 + Math.sin(t * Math.PI * 2 * 0.9) * 0.12);
      lookPitch = lookPitch * (1 - sm.lost) + sm.lost * 0.1;
    } else if (who === 'attacker') {
      // 판 쪽으로 바짝 숙임 (숨 쉬듯 들썩). 잡으면 몸을 세움, 잡혀도 오히려 더 숙임, 지면 고개를 푹
      lean = 0.34 + Math.sin(t * Math.PI * 2 * 0.55) * 0.025 - gloatK * 0.4 + flinchK * 0.15 + sm.check * 0.08 - sm.lost * 0.1;
      lookYaw = Math.sin(t * 2 * Math.PI / 6) * 0.07 * (1 - sm.lost);
      lookPitch = 0.38 - gloatK * 0.55 + sm.check * 0.05 + sm.lost * 0.55;
    } else if (who === 'random') {
      // 칸마다 몸 기울기·고개 방향·갸웃을 아무렇게나 새로 고름 (앞 칸에서 부드럽게 넘어감)
      const { slot, into } = randomSlot(t);
      const pick = (n: number, seed: number) => hash(n * 3.7 + seed);
      const mix = (seed: number) => THREE.MathUtils.lerp(pick(slot - 1, seed), pick(slot, seed), into) - 0.5;
      lean = 0.05 + mix(0.1) * 0.35;
      lookYaw = mix(0.4) * 1.3;
      lookPitch = 0.3 + mix(0.7) * 0.8;
      tilt = mix(0.9) * 0.7;
      // 잡음: 박수 치며 위를 봄 / 잡힘: 고개를 갸웃 / 짐: 의자에 기대 천장을 봄
      lookPitch -= gloatK * 0.6;
      tilt += flinchK * 0.35;
      lean = lean * (1 - sm.lost) - sm.lost * 0.3;
      lookPitch = lookPitch * (1 - sm.lost) - sm.lost * 0.5;
      tilt = tilt * (1 - sm.lost) + sm.lost * Math.sin(t * Math.PI * 2 * 0.4) * 0.3;
    } else if (who === 'queenlover') {
      // 꼿꼿이 앉아 판(퀸)을 바라보며 고개를 갸웃, 천천히 좌우로
      const dreamy = 1 - Math.max(sm.check, sm.lost, flinchK);
      lean = 0.02 - gloatK * 0.05 - flinchK * 0.3 + sm.check * 0.12 + sm.lost * 0.45;
      lookYaw = Math.sin(t * 2 * Math.PI / 8) * 0.12 * dreamy;
      lookPitch = 0.45 - gloatK * 0.25 - flinchK * 0.2 + sm.lost * 0.55;
      tilt = (0.2 + Math.sin(t * 2 * Math.PI / 5) * 0.06) * dreamy + Math.sin(gloat * Math.PI * 2 * 1.2) * 0.22 * gloatK;
      sway = Math.sin(gloat * Math.PI * 2 * 1.2) * 0.05 * gloatK; // 기뻐서 몸을 좌우로
    } else {
      lean = 0.26 - gloatK * 0.32 + flinchK * 0.12 + sm.check * 0.1 - sm.lost * 0.5;
      lookYaw = Math.sin(t * 2 * Math.PI / 5.5) * 0.22 * (1 - sm.lost); // 판을 천천히 훑어봄
      lookPitch = 0.5 - gloatK * 0.55 + sm.check * 0.15 + sm.lost * 0.45;
    }
    // 먼 칸까지 손을 뻗을 때는 몸을 앞으로 더 숙임
    let wantReachLean = 0;
    if (reachPos) {
      const sh = r.restWorld('upperarm_r');
      const dist = Math.hypot(reachPos.z - sh.z, reachPos.y - sh.y);
      wantReachLean = Math.min(0.75, Math.max(0, (dist - 7.5) / 9)) * reachK;
    }
    sm.reachLean = wantReachLean; // 손 뻗기 진행에 이미 부드럽게 맞춰져 있음
    const totalLean = lean + sm.reachLean;
    for (const n of ['spine_01', 'spine_02', 'spine_03']) {
      const bone = b(n);
      if (bone) { turn(r, bone, X, totalLean / 3); turn(r, bone, Z, sway); }
    }
    // 고개: 몸이 숙인 만큼 빼고, 보고 싶은 쪽으로
    const nod = lookPitch - totalLean - (reachK > 0 ? -0.1 * reachK : 0);
    const neck = b('neck_01'), head = b('head');
    if (neck) { turn(r, neck, X, nod * 0.4); turn(r, neck, Y, lookYaw * 0.4); turn(r, neck, Z, -tilt * 0.4); }
    if (head) { turn(r, head, X, nod * 0.6); turn(r, head, Y, lookYaw * 0.6); turn(r, head, Z, -tilt * 0.6); }

    // ── 손이 있어야 할 곳 (캐릭터 기준) ──
    const headPos = head ? bonePos(r, head) : G(0, deskTop + 8, PELVIS_Z);
    const want = { l: new THREE.Vector3(), r: new THREE.Vector3() };
    for (const s of ['l', 'r'] as const) {
      const side = s === 'l' ? 1 : -1;
      if (who === 'coward') {
        // 평소: 왼손(손가락이 김)은 책상 모서리에 걸쳐 손끝을 아래로, 오른손(긴 갈고리)은 책상 앞에 들고 갈고리를 아래로 늘어뜨림
        want[s] = s === 'l' ? G(3.0, deskTop + 1.1, DESK_EDGE - 0.4) : G(-2.6, deskTop + 1.2, DESK_EDGE - 1.2);
        // 움찔: 두 손을 가슴 앞으로 확 당김
        if (flinchK > 0) want[s].lerp(G(side * 1.6, deskTop + 3.2, PELVIS_Z + 3.2), flinchK);
        // 체크: 왼손(화면에서 오른쪽)으로 얼굴을 가림
        if (s === 'l' && sm.check > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(0.6, -0.4, 1.7)), sm.check);
        // 짐: 두 손으로 얼굴을 감쌈
        if (sm.lost > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(side * 0.9, -0.3, 1.5)), sm.lost);
      } else if (who === 'bluffer') {
        // 평소: 팔짱 (손을 반대쪽 팔꿈치 근처, 가슴 앞에)
        const chest = b('spine_03') ? bonePos(r, b('spine_03')!) : G(0, deskTop + 4, PELVIS_Z);
        want[s] = chest.clone().add(new THREE.Vector3(-side * 2.0, -0.6 - (s === 'l' ? 0.35 : 0), 2.6 + (s === 'l' ? 0.3 : 0)));
        // 체크: 오른손으로 턱을 굄
        if (s === 'r' && sm.check > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(-0.2, -1.5, 1.6)), sm.check);
        // 잡음: 두 팔을 활짝 ("당연하지")
        if (gloatK > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(side * 5.5, -1.2, 2.2)), gloatK);
        // 짐: 두 손을 머리 뒤로 깍지
        if (sm.lost > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(side * 0.9, 0.4, -1.4)), sm.lost);
      } else if (who === 'excuser') {
        // 평소: 두 손을 책상 모서리에 편하게
        want[s] = G(side * 2.3, deskTop + 0.6, DESK_EDGE + 1.3);
        // 아픈 손 털기: 오른손을 가슴 앞으로 들어 좌우로 탈탈
        const shakeK = excuserShake(t) * (1 - sm.check) * (1 - sm.lost);
        if (s === 'r' && shakeK > 0) {
          const wob = Math.sin(t * Math.PI * 2 * 5) * 0.45;
          want[s].lerp(G(-1.4 + wob, deskTop + 3.0, DESK_EDGE - 0.6), shakeK);
        }
        // 잡음: 왼손으로 가슴을 툭툭
        if (s === 'l' && gloatK > 0) {
          const chest = b('spine_03') ? bonePos(r, b('spine_03')!) : G(0, deskTop + 4, PELVIS_Z);
          const tap = Math.max(0, Math.sin(gloat * Math.PI * 2 * 3)) * 0.5;
          want[s].lerp(chest.clone().add(new THREE.Vector3(0.7, 0, 2.0 + tap)), gloatK);
        }
        // 잡힘: 왼팔을 쭉 뻗어 왼쪽 위 천장(조명)을 가리킴
        if (s === 'l' && flinchK > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(4.2, 3.2, 3.0)), flinchK);
        // 체크: 왼손으로 뒷머리를 긁적
        if (s === 'l' && sm.check > 0) {
          const scratch = Math.sin(t * Math.PI * 2 * 3.5) * 0.25;
          want[s].lerp(headPos.clone().add(new THREE.Vector3(0.9, 0.5 + scratch, -0.6)), sm.check);
        }
        // 짐: 왼팔은 옆으로 뻗어 딴 데를 가리키고, 오른손은 어깨 높이로 들어 으쓱
        if (sm.lost > 0) {
          const target = s === 'l' ? headPos.clone().add(new THREE.Vector3(5.5, -1.0, 2.5))
            : headPos.clone().add(new THREE.Vector3(-2.6, -2.6 + Math.max(0, Math.sin(t * Math.PI * 2 * 0.45)) * 0.8, 1.6));
          want[s].lerp(target, sm.lost);
        }
      } else if (who === 'attacker') {
        const chest = b('spine_03') ? bonePos(r, b('spine_03')!) : G(0, deskTop + 4, PELVIS_Z);
        if (s === 'l') {
          // 방패: 가슴 왼쪽 앞에 세워 듦. 체크면 얼굴 앞까지, 지면 책상에 내려놓음
          want.l = chest.clone().add(new THREE.Vector3(1.6, -1.4, 3.4));
          if (sm.check > 0) want.l.lerp(headPos.clone().add(new THREE.Vector3(1.2, -1.6, 3.0)), sm.check);
          if (flinchK > 0) want.l.lerp(chest.clone().add(new THREE.Vector3(1.4, -0.6, 3.8)), flinchK);
          if (sm.lost > 0) want.l.lerp(G(3.2, deskTop + 1.0, DESK_EDGE + 1.4), sm.lost);
        } else {
          // 오른 주먹: 책상 모서리에서 톡톡 (빨리 가고 싶어서)
          const tap = Math.max(0, Math.sin(t * Math.PI * 2 * 1.7)) * 0.55;
          want.r = G(-2.6, deskTop + 0.75 + tap, DESK_EDGE + 1.5);
          // 잡음: 주먹을 머리 위로 번쩍
          if (gloatK > 0) want.r.lerp(headPos.clone().add(new THREE.Vector3(-2.4, 3.6, 0.8)), gloatK);
          // 잡힘: 주먹을 판 쪽으로 쭉 내지름 ("계속 전진!")
          if (flinchK > 0) want.r.lerp(G(-1.6, deskTop + 3.2, DESK_EDGE + 5.5), flinchK);
          // 짐: 고개 숙인 채 주먹으로 책상을 쿵쿵 (1.4초마다)
          if (sm.lost > 0) {
            const u = t % 1.4, up = u < 0.5 ? Math.sin(Math.PI * u / 0.5) : 0;
            want.r.lerp(G(-2.0, deskTop + 0.7 + up * 2.2, DESK_EDGE + 1.6), sm.lost);
          }
        }
      } else if (who === 'random') {
        // 자세 5가지 중 칸마다 하나 (앞 칸 자세에서 부드럽게 넘어감)
        const { slot, into } = randomSlot(t);
        const poseOf = (n: number) => {
          const kind = Math.floor(hash(n * 5.3 + 0.2) * 5);
          const deskHand = G(side * 2.4, deskTop + 0.7, DESK_EDGE + 1.3);
          if (kind === 1 && s === 'r') { // 오른손으로 머리 긁기
            const sc = Math.sin(t * Math.PI * 2 * 3) * 0.3;
            return headPos.clone().add(new THREE.Vector3(-1.0, 1.0 + sc, -0.3));
          }
          if (kind === 2 && s === 'l') return headPos.clone().add(new THREE.Vector3(0.3, -1.6, 1.5)); // 왼손으로 턱 괴기
          if (kind === 3) { // 두 손 손가락으로 책상 두드리기 (따닥따닥)
            const drum = Math.max(0, Math.sin(t * Math.PI * 2 * 4 + (s === 'l' ? 0 : 1.6))) * 0.5;
            return G(side * 1.8, deskTop + 0.8 + drum, DESK_EDGE + 2.0);
          }
          if (kind === 4 && s === 'l') { // 왼손 흔들기
            const wave = Math.sin(t * Math.PI * 2 * 1.8) * 0.9;
            return headPos.clone().add(new THREE.Vector3(3.2 + wave, 0.6, 2.0));
          }
          return deskHand;
        };
        want[s] = poseOf(slot - 1).lerp(poseOf(slot), into);
        // 잡음: 가슴 앞에서 짝짝 박수
        if (gloatK > 0) {
          const clap = (0.5 + 0.5 * Math.cos(gloat * Math.PI * 2 * 3)) * 0.9 + 0.15;
          want[s].lerp(headPos.clone().add(new THREE.Vector3(side * clap, -3.0, 2.6)), gloatK);
        }
        // 잡힘 / 짐: 어깨 으쓱 (두 손을 어깨 옆으로, 손바닥 위로)
        const shrug = Math.max(flinchK, sm.lost);
        if (shrug > 0) {
          const bob = sm.lost > 0 ? Math.max(0, Math.sin(t * Math.PI * 2 * 0.45)) * 0.8 * sm.lost : 0;
          want[s].lerp(headPos.clone().add(new THREE.Vector3(side * 3.0, -2.8 + bob, 1.8)), shrug);
        }
      } else if (who === 'queenlover') {
        const chest = b('spine_03') ? bonePos(r, b('spine_03')!) : G(0, deskTop + 4, PELVIS_Z);
        // 평소: 두 손을 가슴 앞에 모음 (살짝 흔들흔들)
        const bob = Math.sin(t * Math.PI * 2 / 4) * 0.15;
        want[s] = chest.clone().add(new THREE.Vector3(side * 0.45, -0.6 + bob, 2.6));
        // 잡음: 모은 손을 뺨 옆에 대고 좋아함
        if (gloatK > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(-0.9 + side * 0.4, -1.2, 1.4)), gloatK);
        // 잡힘: 두 손으로 뺨을 감쌈 (깜짝)
        if (flinchK > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(side * 1.1, -0.6, 1.2)), flinchK);
        // 체크: 왼손을 판 위로 뻗어 막고, 오른손은 가슴에
        if (sm.check > 0) {
          const target = s === 'l' ? G(1.6, deskTop + 3.4, DESK_EDGE + 4.8) : chest.clone().add(new THREE.Vector3(-0.5, 0.2, 1.7));
          want[s].lerp(target, sm.check);
        }
        // 짐: 두 손으로 가슴을 움켜쥠
        if (sm.lost > 0) want[s].lerp(chest.clone().add(new THREE.Vector3(side * 0.6, 0.4, 1.6)), sm.lost);
      } else {
        // 평소: 팔꿈치를 책상에 대고 앞쪽에서 손을 비빔
        const rub = Math.sin(t * Math.PI * 2 * (gloatK > 0 ? 4 : 1.1)) * (0.22 + gloatK * 0.35);
        want[s] = G(side * 0.85 + rub * side, deskTop + 1.5 + gloatK * 1.4 + rub * 0.2, DESK_EDGE + 1.6 - gloatK * 1.2);
        // 잡혀서 쾅: 오른손을 들었다가 책상을 내리침
        if (s === 'r' && flinch >= 0 && flinch < 1.2) {
          const up = flinch < 0.32 ? ease(flinch / 0.32) : flinch < 0.42 ? 1 - (flinch - 0.32) / 0.1 : 0;
          const hold = flinch < 0.32 ? 0 : flinch < 0.9 ? 1 : 1 - (flinch - 0.9) / 0.3;
          const slam = G(-2.6, deskTop + 0.55 + up * 4.2, DESK_EDGE + 1.4);
          want[s].lerp(slam, Math.max(up, hold));
        }
        // 짐: 팔을 늘어뜨림
        if (sm.lost > 0) want[s].lerp(G(side * 4.2, deskTop - 4.5, PELVIS_Z + 1.2), sm.lost);
      }
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
      if (mid) {
        // 손바닥 방향: 기물을 집을 때는 아래, 얼굴을 가릴 때는 위, 평소엔 앞·아래
        const faceK = who === 'coward' ? Math.max(sm.lost, s === 'l' ? sm.check : 0) : 0;
        const dir = new THREE.Vector3(-side * 0.25, -0.35, 1).lerp(new THREE.Vector3(0, 1, 0.3), faceK);
        if (who === 'bluffer') {
          // 손끝 방향: 팔짱(반대쪽 어깨 쪽으로 올려 넣음) → 턱 괴기(위) / 활짝(바깥 위) / 머리 뒤(가운데로)
          dir.set(-side * 0.7, 0.6, -0.35);
          if (s === 'r') dir.lerp(new THREE.Vector3(0, 1, 0.15), sm.check);
          dir.lerp(new THREE.Vector3(side, 0.7, 0.4), gloatK);
          dir.lerp(new THREE.Vector3(-side, 0.3, -0.4), sm.lost);
        }
        if (who === 'excuser') {
          // 가리킬 때는 손끝이 팔 방향으로 (잡힘: 왼쪽 위, 짐: 왼쪽 옆), 으쓱할 때는 바깥·앞으로
          if (s === 'l') { dir.lerp(new THREE.Vector3(0.75, 0.55, 0.45), flinchK); dir.lerp(new THREE.Vector3(1, -0.1, 0.45), sm.lost); }
          else dir.lerp(new THREE.Vector3(-0.7, 0.3, 0.6), sm.lost);
        }
        if (who === 'coward' && s === 'l') dir.lerp(new THREE.Vector3(-0.2, -1, 0.25), (1 - faceK) * (1 - flinchK)); // 손끝을 책상 모서리 아래로
        if (who === 'coward' && s === 'r') {
          // 갈고리: 평소엔 아래로 늘어뜨림, 움찔하면 몸 쪽으로 세움
          dir.set(0, -1, -0.15).lerp(new THREE.Vector3(0.3, 0.6, 1), Math.max(flinchK, sm.lost));
        }
        if (who === 'attacker') {
          if (s === 'l') dir.set(-0.2, 0.2, 1); // 방패 손잡이를 쥔 채 앞으로
          else dir.lerp(new THREE.Vector3(0, 1, 0.2), gloatK).lerp(new THREE.Vector3(0, 0, 1), flinchK);
        }
        if (who === 'random') {
          dir.lerp(new THREE.Vector3(-side * 0.3, 0.9, 0.5), gloatK);                     // 박수: 손끝이 위로, 손바닥끼리
          dir.lerp(new THREE.Vector3(side * 0.6, 0.8, 0.2), Math.max(flinchK, sm.lost)); // 으쓱: 손끝이 바깥 위로
        }
        if (who === 'queenlover') {
          // 모은 손: 손끝이 위·가운데로 / 체크로 뻗은 왼손: 손바닥을 세워 막음
          dir.set(-side * 0.5, 0.9, 0.35);
          if (s === 'l') dir.lerp(new THREE.Vector3(0, 1, 0.4), sm.check);
          dir.lerp(new THREE.Vector3(-side * 0.8, 0.2, 0.2), sm.lost);
        }
        if (s === 'r' && reachK > 0) dir.lerp(who === 'bluffer' ? new THREE.Vector3(0, -0.45, 1) : who === 'coward' ? new THREE.Vector3(0, -0.6, 1) : new THREE.Vector3(0, -1, 0.45), reachK);
        aim(r, hand, mid, dir);
        // 기물을 집는 동안: 손바닥이 아래·몸 쪽을 보게 손끝 축으로 비틂 (안 하면 손등으로 집는 경우가 있음)
        const pl = palmLocal[s];
        if (pl && s === 'r' && reachK > 0) twistPalm(r, hand, mid, pl, PALM_GRIP, reachK);
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
      return style.reachIn;
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
