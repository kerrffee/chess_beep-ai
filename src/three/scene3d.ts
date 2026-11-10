import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makePiece, type PieceKind } from './pieces';

// 장면, 카메라, 그리는 장치
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x20232a);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// 마우스로 돌려 보기 (끌기: 회전, 휠: 확대)
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(2.5, 0.3, 0.5);
controls.update();

// 조명: 전체를 은은하게 + 한쪽에서 비추는 빛
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 5, 4);
scene.add(sun);

// 칸 6 × 2 (칸 한 변 = 1)
const squareGeo = new THREE.BoxGeometry(1, 0.1, 1);
const light = new THREE.MeshStandardMaterial({ color: 0xeed7b0 });
const dark = new THREE.MeshStandardMaterial({ color: 0x9c6b43 });
for (let x = 0; x < 6; x++) {
  for (let z = 0; z < 2; z++) {
    const sq = new THREE.Mesh(squareGeo, (x + z) % 2 === 0 ? light : dark);
    sq.position.set(x, -0.05, z);
    scene.add(sq);
  }
}

// 앞줄 흰 기물, 뒷줄 검은 기물: 폰 룩 나이트 비숍 퀸 킹
const kinds: PieceKind[] = ['p', 'r', 'n', 'b', 'q', 'k'];
kinds.forEach((kind, x) => {
  const white = makePiece(kind, 'w');
  white.position.set(x, 0, 1);
  scene.add(white);

  const black = makePiece(kind, 'b');
  black.position.set(x, 0, 0);
  scene.add(black);
});

// 창 크기가 바뀌면 맞추기
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 1초에 약 60번 다시 그리기
renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});