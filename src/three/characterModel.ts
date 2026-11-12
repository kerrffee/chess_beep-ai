// ---------- 사람 모양 캐릭터 모델 (뼈대가 있는 .glb) ----------
// 모델 파일: public/models/character/<이름>.glb (원본은 맥의 ~/Documents/Chees_beep/_model/character)
//   coward.glb = 겁쟁이 (원본 겁쟁이.fbx를 glb로 바꿈, 그림 없이 색만)
//   greedy.glb = 욕심쟁이 (원본 욕심쟁이.glb의 그림을 1024px로 줄이고 빠진 뼈 위치를 채움)
//   bluffer.glb = 허세꾼 (원본 허세꾼.zip의 Character_output.fbx를 Blender로 glb로 바꿈, 갑옷 그림 1024px)
//                 단위가 m이고 뼈 이름이 'LeftArm' 식이라 unit·rename 설정으로 맞춤 (human.ts)
//   master.glb(대가), chaos.glb(혼돈)는 뼈대 방식이 달라서 master.ts, ghost.ts가 따로 불러옴
//
// 두 원본 모두 뼈대 정보가 조금씩 꼬여 있음 (뼈 위치가 0이거나, 메시마다 뼈가 따로 복사돼 있음)
// 그래서 불러올 때 "뼈 이름 하나당 뼈 하나"인 깨끗한 뼈대를 새로 만들어 모든 메시에 다시 연결함
//   뼈의 원래 자리 = 각 메시에 저장된 '처음 자세 행렬'(inverse bind matrix)의 역행렬
//   → 아무 뼈도 안 돌리면 모델은 원래 A자 자세 그대로
// 그다음 크기를 칸 단위(1칸 = 5.8cm)로 바꾸고, 발바닥이 y=0, 얼굴이 +z를 보게 둠
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const CM = 1 / 5.8; // 모델 단위(cm) → 칸

export interface Rig {
  root: THREE.Group;                       // 캐릭터 전체 (발 가운데가 원점)
  bone(name: string): THREE.Bone | null;   // 'hand_l' 처럼 (접미 번호 없이)
  reset(): void;                           // 모든 뼈를 처음 자세로
  restWorld(name: string): THREE.Vector3;  // 처음 자세에서 그 뼈의 위치 (root 기준)
  meshes: THREE.SkinnedMesh[];
}

// 같은 파일은 한 번만 내려받고, 쓸 때마다 복사본을 새로 만듦 (테마를 바꾸면 상대를 다시 앉히니까)
const cache = new Map<string, Promise<THREE.Group | null>>();
function loadScene(file: string): Promise<THREE.Group | null> {
  let p = cache.get(file);
  if (!p) {
    const url = import.meta.env.BASE_URL + 'models/character/' + file;
    p = new GLTFLoader().loadAsync(url).then(g => g.scene, err => {
      console.warn('캐릭터 모델을 못 불러옴: ' + file, err);
      return null;
    });
    cache.set(file, p);
  }
  return p;
}

// 뼈 이름에서 파일마다 붙은 번호 꼬리 떼기 (strip = 뗄 꼬리 모양)
//   욕심쟁이: /_\d+$/  'hand_l_021' → 'hand_l', 'spine_01_03' → 'spine_01'
//   겁쟁이:   /_\d$/   중복 이름에 붙은 한 자리 번호만 'pelvis_4' → 'pelvis' ('spine_01'은 그대로)
function cleanNameRaw(name: string, strip: RegExp | null): string {
  return strip ? name.replace(strip, '') : name;
}

// 메시에 직접 안 쓰이는 주 뼈(위팔·아래팔·허벅지·종아리)는 원래 위치를 알 수 없어서,
// 그 관절을 둘러싼 보조 뼈 두 개(앞·뒤)의 가운데로 정함 (겁쟁이 모델의 실제 뼈 위치와 거의 같음)
function guessJoint(name: string, worldOf: Map<string, THREE.Matrix4>): THREE.Matrix4 | null {
  const m = name.match(/^(upperarm|lowerarm|thigh|calf)_([lr])$/);
  if (!m) return null;
  const [, base, s] = m;
  const pair = base === 'calf' ? [`calf_knee_${s}`, `calf_kneeBack_${s}`] : [`${base}_fwd_${s}`, `${base}_bck_${s}`];
  const a = worldOf.get(pair[0]), b = worldOf.get(pair[1]);
  if (!a || !b) return null;
  const p = new THREE.Vector3().setFromMatrixPosition(a).add(new THREE.Vector3().setFromMatrixPosition(b)).multiplyScalar(0.5);
  return new THREE.Matrix4().makeTranslation(p.x, p.y, p.z);
}

export interface RigOptions {
  strip: RegExp | null;               // 뼈 이름에서 뗄 번호 꼬리
  rename?: Record<string, string>;    // 뼈 이름 바꾸기 (꼬리를 뗀 뒤). 예: 'LeftArm' → 'upperarm_l' (자세 코드는 이 이름을 씀)
  unit?: number;                      // 모델 1단위가 몇 cm인지 (기본 1 = cm. m 단위 모델은 100)
  reparent?: Record<string, string>;  // 이 뼈를 다른 부모에 붙임 (예: 허리에 찬 칼이 손을 따라다니지 않게)
  hideBones?: string[];               // 이 뼈들에만 붙은 메시는 숨김 (예: 손에 쥔 단검)
}

export async function loadRig(file: string, opt: RigOptions): Promise<Rig | null> {
  const stripNumber = opt.strip;
  const cleanName = (name: string, strip: RegExp | null) => { const n = cleanNameRaw(name, strip); return opt.rename?.[n] ?? n; };
  const scale = CM * (opt.unit ?? 1);
  const src = await loadScene(file);
  if (!src) return null;
  // 뼈대가 있는 모델은 그냥 clone하면 뼈 연결이 원본을 가리키므로, 메시만 새로 만들어 붙임 (모양 데이터는 공유)
  src.updateMatrixWorld(true);
  const skinned: THREE.SkinnedMesh[] = [];
  src.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(o as THREE.SkinnedMesh); });

  // 1) 뼈 이름별 원래 자리(세계 기준)와 부모 이름 모으기
  const worldOf = new Map<string, THREE.Matrix4>();
  const parentOf = new Map<string, string | null>();
  for (const m of skinned) {
    m.skeleton.bones.forEach((b, k) => {
      const name = cleanName(b.name, stripNumber);
      if (!worldOf.has(name)) worldOf.set(name, m.skeleton.boneInverses[k].clone().invert());
    });
  }
  // 빠진 주 뼈 채우기 (메시에 쓰이는 뼈의 조상 중에서)
  // 주의: 불러온 모델에서 메시에 안 쓰이는 뼈는 Bone이 아닌 보통 물체라서, 종류와 상관없이 맨 위까지 거슬러 올라감
  for (const m of skinned) {
    for (const b of m.skeleton.bones) {
      for (let p = b.parent; p; p = p.parent) {
        const name = cleanName(p.name, stripNumber);
        if (worldOf.has(name)) continue;
        const guess = guessJoint(name, worldOf);
        if (guess) worldOf.set(name, guess);
      }
    }
  }
  // 부모: 원래 뼈의 조상 중 가장 가까운 뼈 (모든 메시의 뼈를 다 봐서, 하나라도 부모가 있으면 그걸 씀)
  for (const m of skinned) {
    for (const b of m.skeleton.bones) {
      const name = cleanName(b.name, stripNumber);
      parentOf.set(name, nearestParent(b) ?? parentOf.get(name) ?? null);
    }
  }
  // 채운 주 뼈들의 부모도
  for (const m of skinned) {
    for (const b of m.skeleton.bones) {
      for (let p = b.parent; p; p = p.parent) {
        const name = cleanName(p.name, stripNumber);
        if (worldOf.has(name) && !parentOf.has(name)) parentOf.set(name, nearestParent(p));
      }
    }
  }
  // 원래 뼈의 조상 중 새 뼈대에 있는 가장 가까운 뼈 이름 (자기와 같은 이름의 중복 뼈는 건너뜀)
  function nearestParent(b: THREE.Object3D): string | null {
    const self = cleanName(b.name, stripNumber);
    for (let p = b.parent; p; p = p.parent) {
      const n = cleanName(p.name, stripNumber);
      if (n !== self && worldOf.has(n)) return n;
    }
    return null;
  }

  for (const [child, parent] of Object.entries(opt.reparent ?? {})) {
    if (worldOf.has(child) && worldOf.has(parent)) parentOf.set(child, parent);
  }

  // 2) 새 뼈대 만들기
  const root = new THREE.Group();
  const holder = new THREE.Group(); // 크기·위치 맞춤용 (뼈와 메시가 같이 들어 있음)
  root.add(holder);
  const bones = new Map<string, THREE.Bone>();
  for (const name of worldOf.keys()) { const b = new THREE.Bone(); b.name = name; bones.set(name, b); }
  for (const [name, b] of bones) {
    const pname = parentOf.get(name) ?? null;
    const parent = pname ? bones.get(pname)! : null;
    const local = parent ? worldOf.get(pname!)!.clone().invert().multiply(worldOf.get(name)!) : worldOf.get(name)!.clone();
    local.decompose(b.position, b.quaternion, b.scale);
    (parent ?? holder).add(b);
  }

  // 3) 메시 복사본에 새 뼈대 연결 (뼈를 안 돌리면 원래 모양 그대로 나오도록 처음 자세 행렬도 새로)
  const meshes: THREE.SkinnedMesh[] = [];
  const identity = new THREE.Matrix4();
  for (const m of skinned) {
    const list = m.skeleton.bones.map(b => bones.get(cleanName(b.name, stripNumber))!);
    const inverses = list.map(b => worldOf.get(b.name)!.clone().invert());
    const copy = new THREE.SkinnedMesh(m.geometry, m.material);
    copy.name = m.name;
    copy.bind(new THREE.Skeleton(list, inverses), identity);
    copy.frustumCulled = false; // 뼈로 움직이면 원래 테두리 상자가 안 맞음
    copy.castShadow = true;
    if (opt.hideBones && list.every(b => opt.hideBones!.includes(b.name))) copy.visible = false;
    holder.add(copy);
    meshes.push(copy);
  }

  // 4) 크기: cm → 칸, 발바닥 y=0, 가로 가운데 x=z=0 (처음 자세 기준)
  const box = new THREE.Box3();
  for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox!); }
  holder.scale.setScalar(scale);
  const pelvis = worldOf.get('pelvis');
  const center = pelvis ? new THREE.Vector3().setFromMatrixPosition(pelvis) : box.getCenter(new THREE.Vector3());
  holder.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);

  const rest = new Map<string, THREE.Quaternion>();
  const restPos = new Map<string, THREE.Vector3>();
  for (const [name, b] of bones) {
    rest.set(name, b.quaternion.clone());
    restPos.set(name, root.worldToLocal(b.getWorldPosition(new THREE.Vector3())));
  }

  return {
    root,
    meshes,
    bone: name => bones.get(name) ?? null,
    reset() { for (const [name, b] of bones) b.quaternion.copy(rest.get(name)!); },
    restWorld: name => restPos.get(name)!.clone(),
  };
}

// ── 자세 도우미 (모두 '캐릭터 기준 좌표' = rig.root 안 좌표로) ──
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

export function bonePos(rig: Rig, bone: THREE.Bone, out = new THREE.Vector3()): THREE.Vector3 {
  bone.getWorldPosition(out);
  return rig.root.worldToLocal(out);
}

// 캐릭터 기준 방향 → 세계 방향
function toWorldDir(rig: Rig, dir: THREE.Vector3): THREE.Vector3 {
  return dir.clone().applyQuaternion(rig.root.getWorldQuaternion(_q2)).normalize();
}

// 뼈를 돌려서 '뼈 → child 뼈' 방향이 dir(캐릭터 기준)을 향하게 (가장 적게 돌리는 쪽으로)
export function aim(rig: Rig, bone: THREE.Bone, child: THREE.Bone, dir: THREE.Vector3) {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  const cur = _b.sub(_a).normalize();
  const want = toWorldDir(rig, dir);
  _q.setFromUnitVectors(cur, want);
  rotateWorld(bone, _q);
}

// 세계 기준 회전 q를 뼈에 더함
function rotateWorld(bone: THREE.Bone, q: THREE.Quaternion) {
  const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const worldQ = parentQ.clone().multiply(bone.quaternion);
  worldQ.premultiply(q);
  bone.quaternion.copy(parentQ.invert().multiply(worldQ));
  bone.updateMatrixWorld(true);
}

// 뼈를 캐릭터 기준 축 axis 둘레로 angle만큼 돌림 (예: 허리 숙이기 = x축)
export function turn(rig: Rig, bone: THREE.Bone, axis: THREE.Vector3, angle: number) {
  if (angle === 0) return;
  _q.setFromAxisAngle(toWorldDir(rig, axis), angle);
  rotateWorld(bone, _q);
}

// 두 마디 팔·다리: 어깨(upper) → 팔꿈치(lower) → 손(end)을 target에 닿게. pole = 팔꿈치가 굽는 쪽
export function reachIK(rig: Rig, upper: THREE.Bone, lower: THREE.Bone, end: THREE.Bone, target: THREE.Vector3, pole: THREE.Vector3) {
  const s = bonePos(rig, upper), e = bonePos(rig, lower), h = bonePos(rig, end);
  const l1 = s.distanceTo(e), l2 = e.distanceTo(h);
  const toT = target.clone().sub(s);
  const d = Math.min(Math.max(toT.length(), 0.001), (l1 + l2) * 0.999);
  const dir = toT.normalize();
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const hgt = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const bend = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  const elbow = s.clone().addScaledVector(dir, a).addScaledVector(bend, hgt);
  aim(rig, upper, lower, elbow.clone().sub(s));
  const e2 = bonePos(rig, lower);
  const handAt = s.clone().addScaledVector(dir, d);
  aim(rig, lower, end, handAt.sub(e2));
}
