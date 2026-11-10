import * as THREE from 'three';

// 크기 기준: 칸 한 변 = 1
export type PieceKind = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

// 옆모습 윤곽선: [가운데에서 떨어진 거리(반지름), 높이]
// 이 점들을 세로축 둘레로 한 바퀴 돌려서 모양을 만듦
function lathe(points: [number, number][], mat: THREE.Material): THREE.Mesh {
  const profile = points.map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(profile, 48);
  return new THREE.Mesh(geometry, mat);
}

function sphere(radius: number, y: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), mat);
  mesh.position.y = y;
  return mesh;
}

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

// 모든 기물이 같이 쓰는 받침 (높이 0 ~ 0.11)
const BASE: [number, number][] = [
  [0, 0],
  [0.34, 0],
  [0.34, 0.05],
  [0.29, 0.08],
  [0.24, 0.11],
];

// 폰: 높이 약 0.64
function makePawn(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(
    lathe(
      [...BASE, [0.15, 0.2], [0.11, 0.34], [0.17, 0.37], [0.17, 0.4], [0.08, 0.43], [0, 0.43]],
      mat,
    ),
  );
  g.add(sphere(0.12, 0.52, mat));
  return g;
}

// 룩: 높이 약 0.68, 위에 성벽 모양 돌기 6개
function makeRook(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(
    lathe(
      [...BASE, [0.19, 0.16], [0.17, 0.45], [0.23, 0.5], [0.23, 0.6], [0, 0.6]],
      mat,
    ),
  );
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const m = box(0.09, 0.08, 0.07, mat);
    m.position.set(Math.cos(angle) * 0.19, 0.64, Math.sin(angle) * 0.19);
    m.rotation.y = -angle;
    g.add(m);
  }
  return g;
}

// 나이트: 임시 모양 (받침 + 기울어진 머리 상자). 나중에 다시 만들 예정
function makeKnight(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(lathe([...BASE, [0.2, 0.16], [0.17, 0.3], [0.2, 0.33], [0, 0.33]], mat));
  const neck = box(0.2, 0.32, 0.16, mat);
  neck.position.set(0, 0.47, 0);
  neck.rotation.z = -0.25;
  g.add(neck);
  const head = box(0.32, 0.14, 0.16, mat);
  head.position.set(0.1, 0.6, 0);
  head.rotation.z = -0.4;
  g.add(head);
  return g;
}

// 비숍: 높이 약 0.84, 주교 모자 모양 + 작은 공
function makeBishop(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(
    lathe(
      [
        ...BASE,
        [0.15, 0.22],
        [0.1, 0.45],
        [0.17, 0.48],
        [0.17, 0.51],
        [0.12, 0.53],
        [0.15, 0.6],
        [0.14, 0.68],
        [0.08, 0.75],
        [0, 0.78],
      ],
      mat,
    ),
  );
  g.add(sphere(0.045, 0.8, mat));
  return g;
}

// 퀸: 높이 약 0.97, 벌어진 왕관 + 둘레 작은 공 8개 + 꼭대기 공
function makeQueen(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(
    lathe(
      [
        ...BASE,
        [0.17, 0.24],
        [0.11, 0.55],
        [0.19, 0.58],
        [0.19, 0.61],
        [0.12, 0.64],
        [0.2, 0.82],
        [0.14, 0.84],
        [0.08, 0.86],
        [0, 0.87],
      ],
      mat,
    ),
  );
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const s = sphere(0.03, 0.84, mat);
    s.position.x = Math.cos(angle) * 0.19;
    s.position.z = Math.sin(angle) * 0.19;
    g.add(s);
  }
  g.add(sphere(0.06, 0.92, mat));
  return g;
}

// 킹: 높이 약 1.1, 왕관 + 십자가
function makeKing(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.add(
    lathe(
      [
        ...BASE,
        [0.18, 0.25],
        [0.12, 0.58],
        [0.2, 0.61],
        [0.2, 0.64],
        [0.13, 0.67],
        [0.18, 0.84],
        [0.12, 0.87],
        [0, 0.88],
      ],
      mat,
    ),
  );
  const vertical = box(0.05, 0.2, 0.05, mat);
  vertical.position.y = 0.98;
  g.add(vertical);
  const horizontal = box(0.14, 0.05, 0.05, mat);
  horizontal.position.y = 1.0;
  g.add(horizontal);
  return g;
}

function build(kind: PieceKind, mat: THREE.Material): THREE.Group {
  switch (kind) {
    case 'p':
      return makePawn(mat);
    case 'r':
      return makeRook(mat);
    case 'n':
      return makeKnight(mat);
    case 'b':
      return makeBishop(mat);
    case 'q':
      return makeQueen(mat);
    case 'k':
      return makeKing(mat);
  }
}

// 기물 종류와 재질을 주면 3D 모양을 돌려줌 (그림자도 켜 둠)
export function makePiece(kind: PieceKind, mat: THREE.Material): THREE.Group {
  const g = build(kind, mat);
  g.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return g;
}