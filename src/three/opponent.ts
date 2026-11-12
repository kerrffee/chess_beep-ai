// ---------- 판 건너편에 앉은 상대 캐릭터 ----------
// 성격마다 모양이 다름. 지금 있는 것:
//   대가(master): 얼굴 없는 검은 실루엣. 조용히 숨 쉬고, 자기 수를 둘 때 손을 뻗고, 지면 고개를 숙임
//   겁쟁이(coward), 욕심쟁이(greedy): 모델 파일 캐릭터 → human.ts
// 캐릭터가 없는 성격은 null (빈 자리)
//
// 좌표: 캐릭터는 자기 기준으로 +z(판 쪽)를 바라보고 z = SEAT_Z에 앉음
//       AI가 흑이면 판 뒤쪽(-z)에 그대로, 백이면 판을 돌아 반대편(+z)에 앉도록 통째로 180° 돌림
import * as THREE from 'three';
import { createHuman } from './human';

export interface Opponent {
  group: THREE.Group;
  // 매 화면마다 부름. 바쁘게 움직이는 중(손 뻗기, 고개 숙이기)이면 true (부드럽게 그려야 함)
  update(now: number): boolean;
  // 자기 수를 둠: 손을 from 칸으로 뻗어 기물을 to 칸까지 밀고 돌아옴. 기물이 출발해야 하는 시각(ms 뒤)을 돌려줌
  reach(from: THREE.Vector3, to: THREE.Vector3, moveTime: number): number;
  setLost(lost: boolean): void; // 졌으면 고개를 숙이고, 무르기 등으로 풀리면 다시 듦
  setInCheck?(v: boolean): void; // 자기 킹이 체크당했는지 (반응하는 캐릭터만)
  // 기물을 잡았을 때('captured') / 자기 기물을 잡혔을 때('lostPiece'). delay(ms) 뒤에(기물이 내려앉은 뒤) 반응
  react?(ev: 'captured' | 'lostPiece', delay: number): void;
  dispose(): void;
}

const SEAT_Z = -9.5;      // 앉은 자리 (판 가운데에서)
const REACH_IN = 260;     // 손이 기물까지 가는 시간
const REACH_OUT = 420;    // 손이 돌아오는 시간

// 원통 하나를 두 점 사이에 걸치게 (팔 마디)
function placeSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.scale.set(1, len, 1);
}

// 팔꿈치 위치 계산 (두 마디 팔: 어깨 → 팔꿈치 → 손). 손이 닿는 거리보다 멀면 팔이 살짝 늘어남
// pole: 팔꿈치가 굽는 쪽 (아래·바깥)
function elbowFor(shoulder: THREE.Vector3, hand: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3): THREE.Vector3 {
  const toHand = new THREE.Vector3().subVectors(hand, shoulder);
  const d = Math.max(0.001, toHand.length());
  const dir = toHand.clone().divideScalar(d);
  if (d >= l1 + l2) return shoulder.clone().addScaledVector(dir, d * l1 / (l1 + l2)); // 쭉 뻗음
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);  // 어깨에서 팔꿈치 발까지 거리 (삼각형)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a)); // 굽은 높이
  const bend = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize(); // 팔 방향과 수직인 굽는 방향
  return shoulder.clone().addScaledVector(dir, a).addScaledVector(bend, h);
}

// ── 대가: 얼굴 없는 실루엣 ──
function createMaster(deskTop: number): Opponent {
  const group = new THREE.Group();
  const body = new THREE.Group();   // 숨 쉬고 숙이는 윗몸 (허리를 축으로)
  group.add(body);
  const waistY = deskTop - 3.0;
  body.position.set(0, waistY, SEAT_Z - 0.6);

  // 거의 검은색 + 거친 표면 → 빛을 거의 반사하지 않는 그림자 같은 몸
  const dark = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.95, metalness: 0 });

  // 윗몸 (아래가 좁고 어깨가 넓은 둥근 몸통): 옆모습 윤곽을 돌려 만듦
  const torsoShape = [
    [0.01, 0], [2.4, 0], [2.6, 1.5], [2.9, 3.6], [3.2, 5.4], [3.05, 6.3], [2.2, 6.9], [0.9, 7.2], [0.01, 7.25],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoShape, 24), dark);
  torso.scale.set(1, 1, 0.6); // 앞뒤로 납작하게
  body.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.4, 16), dark);
  neck.position.y = 7.6;
  body.add(neck);
  const head = new THREE.Group(); // 고개 숙이기 축 = 목
  head.position.y = 8.1;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.55, 24, 18), dark);
  skull.scale.set(0.92, 1.12, 1);
  skull.position.y = 1.5;
  head.add(skull);

  // 팔: 어깨(몸통에 붙음) → 팔꿈치 → 손. 원통 두 개 + 손(납작한 공)
  const L1 = 4.4, L2 = 4.6;
  const upperGeo = new THREE.CylinderGeometry(0.62, 0.55, 1, 12);
  const lowerGeo = new THREE.CylinderGeometry(0.55, 0.45, 1, 12);
  const handGeo = new THREE.SphereGeometry(0.62, 16, 12);
  interface Arm { side: number; upper: THREE.Mesh; lower: THREE.Mesh; hand: THREE.Mesh; rest: THREE.Vector3; target: THREE.Vector3 }
  const arms: Arm[] = [-1, 1].map(side => {
    const upper = new THREE.Mesh(upperGeo, dark);
    const lower = new THREE.Mesh(lowerGeo, dark);
    const hand = new THREE.Mesh(handGeo, dark);
    hand.scale.set(1.15, 0.55, 1.35);
    group.add(upper, lower, hand);
    // 쉬는 손: 책상 위, 판 앞에 가볍게 놓음
    const rest = new THREE.Vector3(side * 2.9, deskTop + 0.35, SEAT_Z + 4.1);
    return { side, upper, lower, hand, rest, target: rest.clone() };
  });
  for (const m of group.children) m.castShadow = true;
  torso.castShadow = skull.castShadow = neck.castShadow = true;

  // 등 뒤에서 비추는 차가운 빛 → 윤곽선만 빛나서 실루엣이 배경에서 떨어져 보임
  const rim = new THREE.SpotLight(0x9fb4ff, 60, 30, Math.PI / 5, 0.6, 1.5);
  rim.position.set(0, deskTop + 13, SEAT_Z - 9);
  rim.target.position.set(0, deskTop + 5, SEAT_Z);
  group.add(rim, rim.target);

  // ── 움직임 상태 ──
  // 손 뻗기: 오른손이 rest → from(기물 위) → to(기물 따라) → rest
  let reachAnim: { start: number; from: THREE.Vector3; to: THREE.Vector3; moveTime: number } | null = null;
  let lost = false;
  let slump = 0; // 0 = 바로 앉음, 1 = 고개 푹 숙임

  const shoulderWorld = (side: number) => body.localToWorld(new THREE.Vector3(side * 2.95, 6.1, 0));
  const pole = (side: number) => new THREE.Vector3(side * 0.6, -1, -0.2).normalize();
  const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const lift = (p: THREE.Vector3, y: number) => new THREE.Vector3(p.x, p.y + y, p.z);

  function poseArms() {
    group.updateMatrixWorld(true);
    for (const arm of arms) {
      // 계산은 group 안 좌표로 (캐릭터가 돌아앉아도 똑같이)
      const s = group.worldToLocal(shoulderWorld(arm.side));
      const h = arm.target;
      const e = elbowFor(s, h, L1, L2, pole(arm.side));
      placeSegment(arm.upper, s, e);
      placeSegment(arm.lower, e, h);
      arm.hand.position.copy(h);
      arm.hand.lookAt(group.localToWorld(new THREE.Vector3(h.x, h.y, h.z + 5)));
    }
  }

  function update(now: number): boolean {
    let busy = false;
    // 숨쉬기: 4초에 한 번, 아주 조금
    const breath = Math.sin(now / 4000 * Math.PI * 2);
    torso.scale.set(1 + breath * 0.012, 1 + breath * 0.008, 0.6 * (1 + breath * 0.02));

    // 지면 고개를 숙이고 몸이 살짝 앞으로
    const want = lost ? 1 : 0;
    if (Math.abs(slump - want) > 0.001) {
      slump += Math.sign(want - slump) * Math.min(Math.abs(want - slump), 0.025);
      busy = true;
    }
    head.rotation.x = slump * 0.75;
    body.rotation.x = slump * 0.18;

    // 손 뻗기
    const right = arms[1];
    if (reachAnim) {
      busy = true;
      const t = now - reachAnim.start;
      const total = REACH_IN + reachAnim.moveTime + REACH_OUT;
      if (t < REACH_IN) {
        right.target.lerpVectors(right.rest, lift(reachAnim.from, 1.0), ease(Math.max(0, t / REACH_IN)));
      } else if (t < REACH_IN + reachAnim.moveTime) {
        const k = ease((t - REACH_IN) / reachAnim.moveTime);
        right.target.lerpVectors(lift(reachAnim.from, 1.0), lift(reachAnim.to, 1.0), k);
      } else if (t < total) {
        right.target.lerpVectors(lift(reachAnim.to, 1.0), right.rest, ease((t - REACH_IN - reachAnim.moveTime) / REACH_OUT));
      } else {
        right.target.copy(right.rest);
        reachAnim = null;
      }
    }
    // 진 뒤에는 손을 책상 가장자리로 끌어당김
    for (const arm of arms) {
      if (arm === right && reachAnim) continue;
      arm.target.copy(arm.rest);
      arm.target.z -= slump * 1.6;
    }
    poseArms();
    return busy;
  }

  return {
    group,
    update,
    reach(from, to, moveTime) {
      // 판 좌표 → 캐릭터 좌표 (돌아앉아 있어도 맞게)
      group.updateMatrixWorld(true);
      reachAnim = { start: performance.now(), from: group.worldToLocal(from.clone()), to: group.worldToLocal(to.clone()), moveTime };
      return REACH_IN;
    },
    setLost(v) { lost = v; },
    dispose() {
      group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
      dark.dispose();
    },
  };
}

// 성격 id → 캐릭터 (없으면 null)
export function createOpponent(id: string, deskTop: number): Opponent | null {
  if (id === 'master') return createMaster(deskTop);
  if (id === 'coward' || id === 'greedy') return createHuman(id, deskTop);
  return null;
}
