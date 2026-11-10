import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makePiece, type PieceKind } from './pieces';
import { CLASSIC, THEMES, type Theme, type WoodLook } from './themes';
import { loadModelSet } from './modelSet';

// 테마 고르기: 지금은 주소창으로 (예: 3d.html?theme=marble). 나중에 설정 메뉴로 바꿀 부분
const themeId = new URLSearchParams(location.search).get('theme');
const theme: Theme = THEMES.find((t) => t.id === themeId) ?? CLASSIC;

// 다운받은 모델 불러오기 (실패하면 null → 코드로 만든 기물과 나무 판을 씀)
const modelSet = await loadModelSet();
const useModelBoard = theme.modelMaterials && modelSet !== null;

// ── 그리는 장치 ──
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // 영화 같은 색 보정
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true; // 그림자 켜기
renderer.shadowMap.type = THREE.PCFShadowMap; // 부드러운 그림자 (radius로 퍼짐 조절)
document.body.appendChild(renderer.domElement);

// ── 장면과 카메라 ──
const scene = new THREE.Scene();
scene.background = new THREE.Color(theme.background);

// 주변 환경 반사: 가상의 방 풍경을 표면에 비춤
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = theme.envIntensity;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 9, 10); // 흰 쪽 뒤, 비스듬히 위

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true; // 손을 떼도 부드럽게 멈춤
controls.maxPolarAngle = Math.PI * 0.47; // 판 아래로는 못 내려가게
controls.minDistance = 4;
controls.maxDistance = 25;
controls.update();

// ── 조명 ──
scene.add(new THREE.AmbientLight(0xffffff, theme.ambient));
const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
sun.position.set(-4, 8, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); // 그림자 선명도
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
sun.shadow.bias = -0.0005; // 기물 표면에 줄무늬가 생기는 것 방지
sun.shadow.radius = 4;
scene.add(sun);

// ── 나뭇결 그림 (코드로 그림, 파일 필요 없음) ──
function woodTexture(look: WoodLook): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = look.base;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = look.grain;
  for (let i = 0; i < 70; i++) {
    const y0 = Math.random() * size;
    const amp = 2 + Math.random() * 5; // 결이 휘는 정도
    const freq = 0.01 + Math.random() * 0.02;
    const phase = Math.random() * Math.PI * 2;
    ctx.globalAlpha = 0.08 + Math.random() * 0.25;
    ctx.lineWidth = 0.5 + Math.random() * 2;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 4) {
      const y = y0 + Math.sin(x * freq + phase) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); // 비스듬히 봐도 선명하게
  return tex;
}

// 칸마다 나뭇결이 조금씩 다르게: 같은 그림의 다른 부분을 잘라 씀
function woodMaterial(base: THREE.CanvasTexture, rotate: boolean): THREE.MeshPhysicalMaterial {
  const tex = base.clone();
  tex.repeat.set(0.5, 0.5);
  tex.offset.set(Math.random() * 0.5, Math.random() * 0.5);
  if (rotate) {
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
  }
  tex.needsUpdate = true;
  return new THREE.MeshPhysicalMaterial({
    map: tex,
    roughness: 0.45,
    clearcoat: 0.4, // 니스 칠한 느낌
    clearcoatRoughness: 0.3,
  });
}

// ── 판 ──
// 칸 좌표: file(왼→오 0~7), rank(흰 쪽 0 → 검은 쪽 7)
// 3D 위치: x = file - 3.5, z = 3.5 - rank (흰 쪽이 카메라 가까이)
function squarePosition(file: number, rank: number): THREE.Vector3 {
  return new THREE.Vector3(file - 3.5, 0, 3.5 - rank);
}

let boardBottom = -0.37; // 판 맨 아래 높이 (바닥을 여기에 둠)
if (useModelBoard) {
  // 모델의 원래 판
  const board = modelSet!.makeBoard();
  scene.add(board);
  boardBottom = new THREE.Box3().setFromObject(board).min.y;
} else {
  const lightWood = woodTexture(theme.lightSquare);
  const darkWood = woodTexture(theme.darkSquare);
  const squareGeo = new THREE.BoxGeometry(1, 0.1, 1);
  for (let file = 0; file < 8; file++) {
    for (let rank = 0; rank < 8; rank++) {
      const isLight = (file + rank) % 2 === 1; // a1(0,0)은 어두운 칸
      const mat = woodMaterial(isLight ? lightWood : darkWood, (file + rank) % 2 === 0);
      const sq = new THREE.Mesh(squareGeo, mat);
      sq.position.copy(squarePosition(file, rank));
      sq.position.y = -0.05; // 윗면이 높이 0
      sq.receiveShadow = true;
      scene.add(sq);
    }
  }

  // 테두리
  const frameTex = woodTexture(theme.frame);
  frameTex.repeat.set(3, 3);
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.36, 9),
    new THREE.MeshPhysicalMaterial({ map: frameTex, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  );
  frame.position.y = -0.19; // 윗면이 칸보다 살짝 아래
  frame.receiveShadow = true;
  frame.castShadow = true;
  scene.add(frame);
}

// 판 아래 바닥 (그림자를 받는 넓은 면)
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: theme.background, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = boardBottom - 0.001;
floor.receiveShadow = true;
scene.add(floor);

// ── 기물: 시작 배치 ──
const whiteMat = new THREE.MeshPhysicalMaterial(theme.whitePiece);
const blackMat = new THREE.MeshPhysicalMaterial(theme.blackPiece);
if (modelSet) {
  // 모델의 표면 굴곡(나뭇결 조각 자국)을 테마 재질에도 빌려 씀
  whiteMat.normalMap = modelSet.normalMap(true);
  blackMat.normalMap = modelSet.normalMap(false);
}
const backRank: PieceKind[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

function place(kind: PieceKind, isWhite: boolean, file: number, rank: number) {
  let piece: THREE.Group;
  if (modelSet) {
    // 다운받은 모델: 원본 테마면 원래 재질, 아니면 테마 재질
    const mat = theme.modelMaterials ? undefined : isWhite ? whiteMat : blackMat;
    piece = modelSet.makePiece(kind, isWhite, mat);
  } else {
    // 모델을 못 불러왔을 때: 코드로 만든 기물
    piece = makePiece(kind, isWhite ? whiteMat : blackMat);
    // 나이트 머리가 상대 쪽을 보게 돌림
    piece.rotation.y = isWhite ? Math.PI / 2 : -Math.PI / 2;
  }
  piece.position.copy(squarePosition(file, rank));
  scene.add(piece);
}

for (let file = 0; file < 8; file++) {
  place(backRank[file], true, file, 0);
  place('p', true, file, 1);
  place('p', false, file, 6);
  place(backRank[file], false, file, 7);
}

// ── 창 크기가 바뀌면 맞추기 ──
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── 1초에 약 60번 다시 그리기 ──
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
