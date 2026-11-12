// ---------- 모델 파일로 만든 사람 캐릭터: 겁쟁이, 욕심쟁이 ----------
// 모델은 서 있는 A자 자세라서, 매 화면마다 뼈를 돌려 의자에 앉히고 팔을 책상 위에 둠
// (애니메이션 파일 없이 코드로 자세를 만듦 → characterModel.ts의 aim, turn, reachIK)
//
// 좌표: 캐릭터 기준 +z가 판 쪽. 판 가운데 = (0, deskTop, 0), 캐릭터는 z = PELVIS_Z 의자에 앉음
//
// 겁쟁이: 몸을 뒤로 빼고 움츠림, 늘 조금씩 떨고 두리번거림
//         수를 둘 때 손을 뻗다가 멈칫하고 한 번 물렸다가 둠, 두고 나면 손을 재빨리 거둠
//         자기 기물을 잡히면 움찔 놀라 뒤로 젖힘, 체크당하면 한 손으로 얼굴을 가리고 고개를 돌림
//         지면 두 손으로 얼굴을 감싸고 웅크림
// 욕심쟁이: 판 쪽으로 몸을 숙이고 손을 비비며 판을 훑어봄
//         수를 둘 때 손이 아주 빠름, 기물을 잡으면 몸을 젖히고 신나게 손을 비빔
//         자기 기물을 잡히면 주먹으로 책상을 쾅, 체크당하면 판을 노려봄
//         지면 의자에 털썩 기대 팔을 늘어뜨림
import * as THREE from 'three';
import type { Opponent } from './opponent';
import { DESK } from './room';
import { aim, bonePos, loadRig, reachIK, turn, type Rig, type RigOptions } from './characterModel';

type Who = 'coward' | 'greedy';

const PELVIS_Z = -11.2;   // 엉덩이 위치 (판 가운데에서)
const SEAT_H = 8.8;       // 의자 앉는 면 높이 (바닥에서, 칸) ≈ 51cm
const DESK_EDGE = -DESK.depth / 2; // 캐릭터 쪽 책상 모서리 z

interface Style {
  file: string;
  rig: RigOptions;      // 뼈대 불러오기 설정 (characterModel.ts)
  reachIn: number;      // 손이 기물까지 가는 시간(ms)
  reachOut: number;     // 돌아오는 시간
  rimColor: number;     // 등 뒤 윤곽 빛 색
}
const STYLES: Record<Who, Style> = {
  coward: { file: 'coward.glb', rig: { strip: /_\d$/ }, reachIn: 950, reachOut: 260, rimColor: 0xa8b8d8 },
  greedy: { file: 'greedy.glb',
    // 허리에 찬 칼은 허리에 고정, 오른손에 쥔 단검은 숨김 (체스 둘 때 책상을 뚫고 나와서)
    rig: { strip: /_\d+$/, reparent: { weapon_l: 'pelvis' }, hideBones: ['weapon_r'] }, reachIn: 190, reachOut: 360, rimColor: 0xffc890 },
};

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const clamp01 = (k: number) => Math.min(1, Math.max(0, k));
// 0~1 사이 고정된 무작위 수 (같은 n이면 늘 같은 값) — 두리번거릴 방향 고르기용
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

export function createHuman(who: Who, deskTop: number): Opponent {
  const style = STYLES[who];
  const group = new THREE.Group();
  const floorY = deskTop - DESK.height;
  let rig: Rig | null = null;
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
      const above = (p: THREE.Vector3) => p.clone().add(new THREE.Vector3(0, 2.1, -1.1)); // 손목은 기물 위, 살짝 몸 쪽
      if (e < style.reachIn) {
        let k = e / style.reachIn;
        if (who === 'coward') {
          // 뻗다가(0~45%) 멈칫 → 조금 물림(45~65%) → 다시 끝까지(65~100%)
          k = k < 0.45 ? ease(k / 0.45) * 0.6 : k < 0.65 ? 0.6 - ease((k - 0.45) / 0.2) * 0.25 : 0.35 + ease((k - 0.65) / 0.35) * 0.65;
        } else k = ease(k);
        reachK = k;
        reachPos = above(from);
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
    let lean: number, sway = 0, lookPitch: number, lookYaw = 0;
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
    if (neck) { turn(r, neck, X, nod * 0.4); turn(r, neck, Y, lookYaw * 0.4); }
    if (head) { turn(r, head, X, nod * 0.6); turn(r, head, Y, lookYaw * 0.6); }

    // ── 손이 있어야 할 곳 (캐릭터 기준) ──
    const headPos = head ? bonePos(r, head) : G(0, deskTop + 8, PELVIS_Z);
    const want = { l: new THREE.Vector3(), r: new THREE.Vector3() };
    for (const s of ['l', 'r'] as const) {
      const side = s === 'l' ? 1 : -1;
      if (who === 'coward') {
        // 평소: 책상 모서리에 손끝만 살짝 (몸 가까이)
        want[s] = G(side * 2.4, deskTop + 0.7, DESK_EDGE + 0.9);
        // 움찔: 두 손을 가슴 앞으로 확 당김
        if (flinchK > 0) want[s].lerp(G(side * 1.6, deskTop + 3.2, PELVIS_Z + 3.2), flinchK);
        // 체크: 왼손(화면에서 오른쪽)으로 얼굴을 가림
        if (s === 'l' && sm.check > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(0.6, -0.4, 1.7)), sm.check);
        // 짐: 두 손으로 얼굴을 감쌈
        if (sm.lost > 0) want[s].lerp(headPos.clone().add(new THREE.Vector3(side * 0.9, -0.3, 1.5)), sm.lost);
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
      const upper = b('upperarm_' + s), lower = b('lowerarm_' + s), hand = b('hand_' + s), mid = b('middle_01_' + s);
      if (!upper || !lower || !hand) continue;
      const target = s === 'r' ? rHand : handNow.l;
      reachIK(r, upper, lower, hand, target, new THREE.Vector3(side * 0.8, -0.6, -0.4).normalize());
      if (mid) {
        // 손바닥 방향: 기물을 집을 때는 아래, 얼굴을 가릴 때는 위, 평소엔 앞·아래
        const faceK = who === 'coward' ? Math.max(sm.lost, s === 'l' ? sm.check : 0) : 0;
        const dir = new THREE.Vector3(-side * 0.25, -0.35, 1).lerp(new THREE.Vector3(0, 1, 0.3), faceK);
        if (s === 'r' && reachK > 0) dir.lerp(new THREE.Vector3(0, -1, 0.45), reachK);
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
