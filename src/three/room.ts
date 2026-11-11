// ---------- 방 (책상, 벽, 바닥, 창문, 스탠드, 책장) ----------
// 파일 없이 코드로 만든 단순한 방. 테마마다 색과 분위기만 다름
// 크기 기준: 체스판 한 칸 = 1 (실제로는 약 5.5cm). 그래서 책상 높이(약 75cm)는 약 13.6
import * as THREE from 'three';

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

// deskTop: 책상 윗면 높이 (= 판 밑면)
export function buildRoom(themeId: string, deskTop: number): THREE.Group {
  const look = LOOKS[themeId] ?? LOOKS.classic;
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
  const W = 46, D = 52, H = 34; // 방 너비, 깊이, 높이
  const zBack = -26, zFront = D + zBack;
  const ceilY = floorY + H;

  // ── 책상: 윗판 + 다리 4개 ──
  const deskMat = mat(look.desk, look.deskRough, { metalness: 0 });
  const top = box(DESK.width, DESK.thick, DESK.depth, deskMat, 0, deskTop - DESK.thick / 2, 0);
  top.receiveShadow = true;
  top.castShadow = true;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(0.8, DESK.height - DESK.thick, 0.8, deskMat,
      sx * (DESK.width / 2 - 0.8), floorY + (DESK.height - DESK.thick) / 2, sz * (DESK.depth / 2 - 0.8));
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
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: look.windowLight, emissiveIntensity: look.windowGlow }));
  glass.rotation.y = Math.PI / 2;
  glass.position.set(-W / 2 + 0.05, winY, winZ);
  g.add(glass);
  const frameMat = flat(look.wallLow);
  box(0.4, winH + 0.8, 0.5, frameMat, -W / 2 + 0.2, winY, winZ);               // 가운데 세로살
  box(0.4, 0.5, winW + 0.8, frameMat, -W / 2 + 0.2, winY, winZ);               // 가운데 가로살
  box(0.4, 0.6, winW + 1.2, frameMat, -W / 2 + 0.2, winY + winH / 2 + 0.3, winZ); // 위
  box(0.4, 0.6, winW + 1.2, frameMat, -W / 2 + 0.2, winY - winH / 2 - 0.3, winZ); // 아래
  // 창문에서 들어오는 빛: 그림자 없는 방향 빛 하나 (넓은 면 빛보다 훨씬 가벼움)
  const windowLight = new THREE.DirectionalLight(look.windowLight, look.windowGlow * 0.8);
  windowLight.position.set(-W / 2, winY, winZ);
  windowLight.target.position.set(0, deskTop, 0);
  g.add(windowLight, windowLight.target);

  // ── 책장 (뒤 벽, 상대 뒤 오른쪽) ──
  const shelfMat = flat(look.shelf);
  const sx = 11, sw = 11, sh = 22, sd = 3, sy = floorY + sh / 2;
  const sz = zBack + sd / 2 + 0.05;
  box(sw, sh, 0.3, shelfMat, sx, sy, zBack + 0.2);                 // 뒤판
  box(0.4, sh, sd, shelfMat, sx - sw / 2, sy, sz);                  // 왼쪽
  box(0.4, sh, sd, shelfMat, sx + sw / 2, sy, sz);                  // 오른쪽
  // 선반 5칸 + 책
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; // 테마를 바꿔도 같은 배치
  for (let i = 0; i <= 5; i++) {
    const y = floorY + 0.2 + i * (sh - 0.4) / 5;
    box(sw, 0.35, sd, shelfMat, sx, y, sz);
    if (i === 5) break;
    let x = sx - sw / 2 + 0.5;
    while (x < sx + sw / 2 - 1) {
      const bw = 0.5 + rnd() * 0.5, bh = 2.4 + rnd() * 1.4;
      if (rnd() < 0.12) { x += bw; continue; } // 군데군데 빈자리
      const book = box(bw * 0.92, bh, sd * 0.8, flat(look.books[Math.floor(rnd() * look.books.length)]),
        x + bw / 2, y + 0.18 + bh / 2, sz);
      book.rotation.z = rnd() < 0.08 ? 0.15 : 0;
      x += bw;
    }
  }

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

  return g;
}
