// ---------- 방 (책상, 벽, 바닥, 창문, 스탠드, 책장) ----------
// 파일 없이 코드로 만든 단순한 방. 테마마다 색과 분위기만 다름
// 크기 기준: 체스판 한 칸 = 1 (실제로는 약 5.5cm). 그래서 책상 높이(약 75cm)는 약 13.6
import * as THREE from 'three';
import { loadFurniture, M } from './furniture';

// 테마별 방 색
interface RoomLook {
  wall: number; wallLow: number; floor: number; ceiling: number;
  desk: number; deskRough: number;
  windowLight: number; windowGlow: number; // 창문 빛 색, 창문이 스스로 빛나는 세기
  lampColor: number; lampIntensity: number;
  shelf: number; books: number[];
  rug: number;
}

const LOOKS: Record<string, RoomLook> = {
  // 클래식: 따뜻한 서재
  classic: {
    wall: 0x3d3229, wallLow: 0x2a211a, floor: 0x4a3324, ceiling: 0x221b16,
    desk: 0x5a3320, deskRough: 0.5,
    windowLight: 0xbcd4ff, windowGlow: 0.9, lampColor: 0xffc27a, lampIntensity: 40,
    shelf: 0x3a2618, books: [0x7a2e2a, 0x2e4a3a, 0x8a6a3a, 0x2c3550, 0x5a4a3a],
    rug: 0x5c2a24,
  },
  // 대리석: 밝은 갤러리
  marble: {
    wall: 0xcfc9bf, wallLow: 0xb3ada3, floor: 0x8f8a84, ceiling: 0xe0dcd5,
    desk: 0x3b2a20, deskRough: 0.35,
    windowLight: 0xfff4e0, windowGlow: 1.2, lampColor: 0xfff0d8, lampIntensity: 25,
    shelf: 0x5a4a3e, books: [0x9a8c7a, 0x5a6a7a, 0xb8a888, 0x6a5a4a, 0x8a7a6a],
    rug: 0x7a7066,
  },
  // 미니멀: 하얀 작업실
  minimal: {
    wall: 0xecebe8, wallLow: 0xdedcd8, floor: 0xd4d2cd, ceiling: 0xf2f1ee,
    desk: 0xd8c9b0, deskRough: 0.7,
    windowLight: 0xffffff, windowGlow: 1.0, lampColor: 0xffffff, lampIntensity: 15,
    shelf: 0xcfcac2, books: [0x9a9a9a, 0x2b2b2b, 0xc8c2b8, 0x6a6a6a, 0xb0b0b0],
    rug: 0xbdbab4,
  },
  // 판타지: 어두운 남보라 마법 방
  fantasy: {
    wall: 0x1a1530, wallLow: 0x110d22, floor: 0x120f22, ceiling: 0x0b0918,
    desk: 0x2a2140, deskRough: 0.4,
    windowLight: 0x6fa8ff, windowGlow: 2.2, lampColor: 0xb47aff, lampIntensity: 35,
    shelf: 0x221a38, books: [0x5a2a8a, 0x2a5a8a, 0x8a2a6a, 0x2a8a8a, 0x4a3a7a],
    rug: 0x2a1a4a,
  },
};

export const DESK = { width: 18, depth: 13, thick: 0.5, height: 13.6 };

// ── 모델 가구를 쓰는 테마 ──
// 탁자는 다리만 늘려서 높이를 책상(DESK.height)과 같게 맞춤. 상대는 소파에 앉음
// 이 테마들은 소파가 뒤 벽을 차지해서 방을 넓고 높게 하고, 책장은 오른쪽 벽으로 옮김
interface FurnitureSet {
  table: string;
  tableScaleXZ?: number;         // 탁자가 너무 크면 가로·세로만 줄임
  legs: [number, number];        // 늘릴 다리 구간 (바닥에서 m)
  sofa: string;
  lamp: string;                  // 탁자 위 왼쪽 뒤 구석에 놓는 조명
  lampLightY: number;            // 불빛 높이 (탁자 윗면에서 칸 단위)
  windowModel?: string;          // 없으면 코드로 만든 창문
  floorLamp?: string;            // 바닥에 세우는 장식 (소파 오른쪽)
}
const FURNITURE: Record<string, FurnitureSet> = {
  classic: {
    table: 'classic/table.glb', legs: [0.02, 0.34],
    sofa: 'classic/sofa.glb',
    lamp: 'classic/lantern.glb', lampLightY: 2.8,
  },
  marble: {
    table: 'marble/table.glb', tableScaleXZ: 0.6, legs: [0.06, 0.46],
    sofa: 'marble/sofa.glb',
    lamp: 'marble/candle.glb', lampLightY: 6.2,
    windowModel: 'marble/window.glb',
    floorLamp: 'marble/candelabra.glb',
  },
};

// deskTop: 책상 윗면 높이 (= 판 밑면)
// onLoaded: 가구 모델이 다 불러와지면 부름 (화면을 다시 그리게)
export function buildRoom(themeId: string, deskTop: number, onLoaded?: () => void): THREE.Group {
  if (themeId === 'spotlight') return buildSpotlightRoom(deskTop, onLoaded);
  const look = LOOKS[themeId] ?? LOOKS.classic;
  const fur = FURNITURE[themeId];
  const g = new THREE.Group();
  // 책상·스탠드처럼 가까이 보이는 것은 광택 계산이 있는 재질, 벽·바닥·책처럼 멀리 있는 것은 계산이 싼 재질
  // (방이 화면 대부분을 채워서, 싼 재질을 쓰면 휴대폰에서 훨씬 빠름)
  const mat = (color: number, roughness = 0.85, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const flat = (color: number) => new THREE.MeshLambertMaterial({ color });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };

  const floorY = deskTop - DESK.height;
  const W = fur ? 60 : 46, D = 52, H = fur ? 50 : 34; // 방 너비, 깊이, 높이
  const zBack = -26, zFront = D + zBack;
  const ceilY = floorY + H;

  // ── 책상: 윗판 + 다리 4개 (모델 가구 테마는 아래에서 탁자 모델로) ──
  if (!fur) {
    const deskMat = mat(look.desk, look.deskRough, { metalness: 0 });
    const top = box(DESK.width, DESK.thick, DESK.depth, deskMat, 0, deskTop - DESK.thick / 2, 0);
    top.receiveShadow = true;
    top.castShadow = true;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(0.8, DESK.height - DESK.thick, 0.8, deskMat,
        sx * (DESK.width / 2 - 0.8), floorY + (DESK.height - DESK.thick) / 2, sz * (DESK.depth / 2 - 0.8));
    }
  }

  // ── 바닥, 천장, 벽 ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), flat(look.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, (zBack + zFront) / 2);
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), flat(look.ceiling));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, ceilY, (zBack + zFront) / 2);
  g.add(ceil);

  const wallMat = flat(look.wall);
  const lowMat = flat(look.wallLow);
  const wall = (w: number, x: number, z: number, rotY: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), wallMat);
    m.position.set(x, floorY + H / 2, z);
    m.rotation.y = rotY;
    g.add(m);
    // 벽 아래쪽 판자 (허리 높이까지 진한 색)
    const low = new THREE.Mesh(new THREE.PlaneGeometry(w, 9), lowMat);
    low.position.set(x, floorY + 4.5, z);
    low.rotation.y = rotY;
    low.position.add(new THREE.Vector3(0, 0, 0.02).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY));
    g.add(low);
  };
  wall(W, 0, zBack, 0);                 // 뒤 (상대 쪽)
  wall(W, 0, zFront, Math.PI);          // 앞 (내 쪽, 보통 안 보임)
  wall(D, -W / 2, (zBack + zFront) / 2, Math.PI / 2);  // 왼쪽
  wall(D, W / 2, (zBack + zFront) / 2, -Math.PI / 2);  // 오른쪽

  // ── 깔개 (책상 밑) ──
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(26, 22), flat(look.rug));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, floorY + 0.02, 0);
  rug.receiveShadow = true;
  g.add(rug);

  // ── 창문 (왼쪽 벽): 스스로 빛나는 유리 + 창틀 + 들어오는 빛 ──
  const winW = 14, winH = 12, winY = deskTop + 8, winZ = -6;
  if (!fur?.windowModel) g.add(windowGlass(winW, winH, look, -W / 2 + 0.05, winY, winZ));
  if (!fur?.windowModel) {
    const frameMat = flat(look.wallLow);
    box(0.4, winH + 0.8, 0.5, frameMat, -W / 2 + 0.2, winY, winZ);               // 가운데 세로살
    box(0.4, 0.5, winW + 0.8, frameMat, -W / 2 + 0.2, winY, winZ);               // 가운데 가로살
    box(0.4, 0.6, winW + 1.2, frameMat, -W / 2 + 0.2, winY + winH / 2 + 0.3, winZ); // 위
    box(0.4, 0.6, winW + 1.2, frameMat, -W / 2 + 0.2, winY - winH / 2 - 0.3, winZ); // 아래
  }
  // 창문에서 들어오는 빛: 그림자 없는 방향 빛 하나 (넓은 면 빛보다 훨씬 가벼움)
  const windowLight = new THREE.DirectionalLight(look.windowLight, look.windowGlow * 0.8);
  windowLight.position.set(-W / 2, winY, winZ);
  windowLight.target.position.set(0, deskTop, 0);
  g.add(windowLight, windowLight.target);

  // ── 책장: 보통은 뒤 벽(상대 뒤 오른쪽), 소파가 있는 테마는 오른쪽 벽 ──
  // 책장 자기 기준: 뒤판이 z=0, 앞(방 쪽)이 +z, 가운데가 x=0, 바닥이 y=floorY
  const shelf = new THREE.Group();
  if (fur) { shelf.position.set(W / 2, 0, 4); shelf.rotation.y = -Math.PI / 2; }
  else shelf.position.set(11, 0, zBack);
  g.add(shelf);
  const shelfMat = flat(look.shelf);
  const sbox = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    shelf.add(mesh);
    return mesh;
  };
  const sw = 11, sh = 22, sd = 3, sy = floorY + sh / 2;
  const sz = sd / 2 + 0.05;
  sbox(sw, sh, 0.3, shelfMat, 0, sy, 0.2);                 // 뒤판
  sbox(0.4, sh, sd, shelfMat, -sw / 2, sy, sz);             // 왼쪽
  sbox(0.4, sh, sd, shelfMat, sw / 2, sy, sz);              // 오른쪽
  // 선반 5칸 + 책
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; // 테마를 바꿔도 같은 배치
  for (let i = 0; i <= 5; i++) {
    const y = floorY + 0.2 + i * (sh - 0.4) / 5;
    sbox(sw, 0.35, sd, shelfMat, 0, y, sz);
    if (i === 5) break;
    let x = -sw / 2 + 0.5;
    while (x < sw / 2 - 1) {
      const bw = 0.5 + rnd() * 0.5, bh = 2.4 + rnd() * 1.4;
      if (rnd() < 0.12) { x += bw; continue; } // 군데군데 빈자리
      const book = sbox(bw * 0.92, bh, sd * 0.8, flat(look.books[Math.floor(rnd() * look.books.length)]),
        x + bw / 2, y + 0.18 + bh / 2, sz);
      book.rotation.z = rnd() < 0.08 ? 0.15 : 0;
      x += bw;
    }
  }

  if (!fur) {
    // ── 스탠드 (책상 왼쪽 뒤 구석) + 따뜻한 불빛 ──
    const metal = mat(0x2a2622, 0.4, { metalness: 0.6 });
    const lx = -DESK.width / 2 + 2, lz = -DESK.depth / 2 + 2;
    box(2, 0.3, 2, metal, lx, deskTop + 0.15, lz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 12), metal);
    pole.position.set(lx, deskTop + 3.2, lz);
    g.add(pole);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.8, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: look.lampColor, emissive: look.lampColor, emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.9 }));
    shade.position.set(lx, deskTop + 6.4, lz);
    g.add(shade);
    const bulb = new THREE.PointLight(look.lampColor, look.lampIntensity, 30, 1.6);
    bulb.position.set(lx, deskTop + 5.8, lz);
    g.add(bulb);
  } else {
    addFurniture(g, fur, look, deskTop, floorY, W, zBack, winY, winZ, onLoaded);
  }

  return g;
}

// 모델 가구 놓기: 탁자 → (탁자 크기를 보고) 소파 → 조명·창문. 불러오는 동안에도 불빛은 먼저 켜 둠
function addFurniture(g: THREE.Group, fur: FurnitureSet, look: RoomLook, deskTop: number, floorY: number,
  W: number, zBack: number, winY: number, winZ: number, onLoaded?: () => void) {
  const lampX = -6, lampZ = -6; // 탁자 위 왼쪽 뒤 구석 (판 테두리 밖)
  const bulb = new THREE.PointLight(look.lampColor, look.lampIntensity, 30, 1.6);
  bulb.position.set(lampX, deskTop + fur.lampLightY, lampZ);
  g.add(bulb);

  const tableHeight = DESK.height / M; // 탁자 높이(m) = 책상 높이
  const jobs: Promise<unknown>[] = [];

  jobs.push(loadFurniture(fur.table, { cheap: true, // 화면 아래쪽을 넓게 덮어서 싼 재질로
    scaleXZ: fur.tableScaleXZ,
    stretch: { from: fur.legs[0], to: fur.legs[1], height: tableHeight },
  }).then(async table => {
    if (!table) return;
    table.position.y = floorY;
    g.add(table);
    // 소파: 앞 끝이 탁자 뒤 끝 바로 뒤에 오게 (상대가 소파 앞쪽에 걸터앉은 자리)
    const half = new THREE.Box3().setFromObject(table).max.z;
    const sofa = await loadFurniture(fur.sofa);
    if (!sofa) return;
    const depth = new THREE.Box3().setFromObject(sofa).max.z * 2;
    const front = -(half + 0.8);
    sofa.position.set(0, floorY, Math.max(front - depth / 2, zBack + depth / 2 + 0.1));
    g.add(sofa);
  }));

  jobs.push(loadFurniture(fur.lamp).then(lamp => {
    if (!lamp) return;
    lamp.position.set(lampX, deskTop, lampZ);
    g.add(lamp);
  }));

  if (fur.windowModel) {
    jobs.push(loadFurniture(fur.windowModel).then(win => {
      if (!win) return;
      // 모델 앞(+z)이 방 안(+x)을 보게 돌림. 뒤가 벽에 붙고, 창 가운데가 원래 창문 자리
      win.rotation.y = Math.PI / 2;
      const size = new THREE.Box3().setFromObject(win).getSize(new THREE.Vector3());
      const bottom = Math.max(floorY + 0.55 * M, winY - size.y / 2);
      win.position.set(-W / 2 + size.z / 2 + 0.05, bottom, winZ);
      g.add(win);
      // 창 뒤에 빛나는 하늘 (모델의 유리가 반투명이라 비쳐 보임)
      g.add(windowGlass(size.x * 0.9, size.y * 0.95, look, -W / 2 + 0.02, bottom + size.y / 2, winZ));
    }));
  }

  if (fur.floorLamp) {
    jobs.push(loadFurniture(fur.floorLamp).then(fl => {
      if (!fl) return;
      fl.position.set(W / 2 - 8, floorY, zBack + 4);
      g.add(fl);
    }));
  }

  Promise.all(jobs).then(() => onLoaded?.());
}

// 스스로 빛나는 창밖 (왼쪽 벽에 붙는 판)
function windowGlass(w: number, h: number, look: RoomLook, x: number, y: number, z: number): THREE.Mesh {
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: look.windowLight, emissiveIntensity: look.windowGlow }));
  glass.rotation.y = Math.PI / 2;
  glass.position.set(x, y, z);
  return glass;
}

// ---------- 스포트라이트 방 ----------
// 벽도 천장도 없는 깜깜한 공간. 바닥, 탁자(대리석 테마 것), 나무 의자만 있고
// 상대 뒤쪽 높은 곳에서 스포트라이트 하나가 비스듬히 내리쬠 (무대 위 독백처럼)
// 바닥에는 경계가 또렷한 빛의 원, 공중에는 연기 낀 빛기둥. 빛이 닿지 않는 곳은 완전한 검정
const SPOT = {
  from: { x: -50, y: 65, z: -11 }, // 불빛 위치 (판 가운데 기준, y는 탁자 윗면 위 높이). 왼쪽 높은 곳
                                   // → 앉은 자리에서 빛기둥을 옆으로 비껴 보게 됨 (레퍼런스처럼 대각선 기둥)
  aimZ: -1,          // 빛이 겨누는 바닥 지점 (판 바로 아래쯤)
  angle: 0.2,        // 빛 원뿔의 반각(라디안, 약 11°). 멀리서 좁게 쏴서 가는 기둥 + 바닥엔 큰 원
  penumbra: 0.15,    // 가장자리가 흐려지는 정도 (0 = 칼같이, 1 = 아주 흐리게). 작게 → 원 경계가 또렷
  intensity: 42000,  // 세기 (거리 제곱으로 약해짐. 불빛이 멀어서 큼)
  color: 0xfff1e0,   // 아주 살짝 따뜻한 흰빛 (백열 무대 조명 느낌)
  beam: 0.03,        // 빛기둥(공기 중 연기) 진하기
  smoke: 0.055,      // 연기 얼룩의 촘촘함 (클수록 잘게)
};
const CHAIR_HEIGHT = 1.0;  // 의자 전체 높이(m). 모델 파일의 단위가 제각각이라 이 높이로 맞춤
const CHAIR_Z = -11.2;     // 의자 가운데 위치 (상대가 앉는 자리 바로 뒤)
const TABLE_HALF = 7.4;    // 탁자 윗면 절반 너비 (빛기둥 속 탁자 그림자 계산용)

function buildSpotlightRoom(deskTop: number, onLoaded?: () => void): THREE.Group {
  const g = new THREE.Group();
  const floorY = deskTop - DESK.height;

  // 바닥: 짙은 회색. 스포트라이트만 받고 방 전체 환경광은 안 받게 셰이더에서 그 부분을 뺌
  // → 빛의 원 밖은 완전한 검정이라 바닥 끝이 안 보이고, 어둠 속에 빛의 원만 떠 있음
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x5a5b5e });
  floorMat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>', '');
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, 0);
  floor.receiveShadow = true;
  g.add(floor);

  // 스포트라이트: 기물·탁자·의자·상대의 그림자를 모두 이 빛이 만듦
  const apex = new THREE.Vector3(SPOT.from.x, deskTop + SPOT.from.y, SPOT.from.z);
  const aim = new THREE.Vector3(0, floorY, SPOT.aimZ);
  const axis = aim.clone().sub(apex).normalize();
  const spot = new THREE.SpotLight(SPOT.color, SPOT.intensity, 0, SPOT.angle, SPOT.penumbra, 2);
  spot.position.copy(apex);
  spot.target.position.copy(aim);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 40;
  spot.shadow.camera.far = 160;
  spot.shadow.bias = -0.0004;
  spot.shadow.radius = 3;
  g.add(spot, spot.target);

  // 빛기둥: 원뿔 모양 상자를 그리고, 그 안을 지나는 시선마다 연기 농도를 조금씩 더해 감 (레이마칭)
  // → 겉면만 칠한 원뿔과 달리 진짜 빛 속 연기처럼 보임. 탁자 아래로는 탁자 그림자 때문에 빛이 끊김
  // 연기 얼룩은 움직이지 않아서, 가만히 있을 때 화면을 계속 다시 그릴 필요 없음
  const L = 150; // 원뿔 길이 (바닥보다 넉넉히 길게, 바닥 아래는 셰이더가 잘라냄)
  const beamGeo = new THREE.CylinderGeometry(0.3, Math.tan(SPOT.angle) * L * 1.03, L, 96, 1, true);
  beamGeo.translate(0, -L / 2, 0); // 꼭짓점을 원점으로
  beamGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis));
  beamGeo.translate(apex.x, apex.y, apex.z);
  const beamUniforms = {
    color: { value: new THREE.Color(SPOT.color) },
    strength: { value: SPOT.beam },
    smoke: { value: SPOT.smoke },
    apex: { value: apex },
    axis: { value: axis },
    cosA: { value: Math.cos(SPOT.angle) },
    floorY: { value: floorY },
    deskTop: { value: deskTop },
    tableHalf: { value: TABLE_HALF },
    camPos: { value: new THREE.Vector3() },
  };
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    uniforms: beamUniforms,
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 color, apex, axis, camPos;
      uniform float strength, smoke, cosA, floorY, deskTop, tableHalf;
      varying vec3 vPos;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      bool inCone(vec3 p) { vec3 v = p - apex; return dot(v, axis) > cosA * length(v); }
      void main() {
        vec3 toFrag = vPos - camPos;
        float dFrag = length(toFrag);
        vec3 rd = toFrag / dFrag;
        vec3 ro; float len;
        if (gl_FrontFacing) { ro = vPos; len = 60.0; }          // 바깥에서 볼 때: 원뿔에 들어간 곳부터
        else { if (!inCone(camPos)) discard; ro = camPos; len = dFrag; } // 빛 속에 서 있을 때: 눈앞부터
        const int N = 36;
        float dt = len / float(N);
        float t = hash(vec3(gl_FragCoord.xy, 1.0)) * dt; // 줄무늬 안 생기게 출발점을 살짝 흩뜨림
        float sum = 0.0;
        for (int i = 0; i < N; i++) {
          vec3 p = ro + rd * t;
          t += dt;
          if (p.y < floorY) break;
          vec3 v = p - apex;
          float s = dot(v, axis);
          if (s <= 0.0) continue;
          float c = s / length(v);
          float edge = smoothstep(cosA, cosA + (1.0 - cosA) * 0.12, c); // 원뿔 가장자리: 살짝만 흐리게 (기둥 윤곽이 또렷)
          if (edge <= 0.0) continue;
          if (p.y < deskTop) { // 탁자 그림자: 불빛에서 이 점까지 가는 길이 탁자 윗면을 지나면 어두움
            vec3 q = apex + v * ((deskTop - apex.y) / v.y);
            if (abs(q.x) < tableHalf && abs(q.z) < tableHalf) continue;
          }
          vec3 sp = p * smoke;
          float fog = 0.6 * noise(sp) + 0.4 * noise(sp * 2.7 + 13.1);   // 연기 얼룩
          float fall = 1.0 / (1.0 + s * s / 6000.0);                     // 불빛에서 멀수록 옅게
          sum += edge * fall * mix(0.15, 2.0, fog * fog * fog) * dt;
        }
        gl_FragColor = vec4(color * strength * sum, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  beam.renderOrder = 2;
  beam.frustumCulled = false;
  beam.onBeforeRender = (_r, _s, cam) => { // 카메라 위치를 방 좌표로 (흑 쪽 시점이면 방이 돌아가 있음)
    beamUniforms.camPos.value.copy(cam.getWorldPosition(new THREE.Vector3()));
    beam.worldToLocal(beamUniforms.camPos.value);
  };
  g.add(beam);

  // 광원: 빛이 시작되는 작고 하얗게 빛나는 점과 그 둘레의 은은한 빛무리
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  bulb.position.copy(apex);
  g.add(bulb);
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext('2d')!;
  const grad = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.2, 'rgba(235,240,255,0.45)');
  grad.addColorStop(1, 'rgba(235,240,255,0)');
  gc.fillStyle = grad;
  gc.fillRect(0, 0, 64, 64);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(glowCanvas), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  glow.scale.set(9, 9, 1);
  glow.position.copy(apex);
  g.add(glow);
  // 탁자(대리석 테마 것) → 의자. 의자는 탁자 뒤, 상대 자리에 판 쪽(+z)을 보게 (이 모델은 앞이 -z라서 180° 돌림)
  const tableHeight = DESK.height / M;
  const jobs: Promise<unknown>[] = [];
  jobs.push(loadFurniture('marble/table.glb', {
    scaleXZ: 0.6, stretch: { from: 0.06, to: 0.46, height: tableHeight }, shadows: true,
  }).then(table => {
    if (!table) return;
    table.position.y = floorY;
    g.add(table);
  }));
  jobs.push(loadFurniture('spotlight/chair.glb', { height: CHAIR_HEIGHT, rotateY: Math.PI, shadows: true }).then(chair => {
    if (!chair) return;
    chair.position.set(0, floorY, CHAIR_Z);
    g.add(chair);
  }));
  Promise.all(jobs).then(() => onLoaded?.());
  return g;
}
