// ---------- 3D 판 (게임과 연결된 것) ----------
// 2D 판과 똑같은 정보(판 상태, 마지막 수, 고른 칸, 둘 수 있는 칸)를 받아서 3D로 그림
// 칸을 누르면 onSquareClick(칸 번호)을 불러서 game.ts가 처리하게 함
// 수를 두면 기물이 미끄러지듯 움직이고(나이트는 뛰어넘음), 잡힌 기물은 작아지며 사라짐
//
// 장면 꾸미기(조명, 나뭇결, 모델, 테마)는 원래 scene3d.ts에 있던 코드를 그대로 옮겨 온 것
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { cloneGame, type GameState } from '../board';
import { makeMove, type Move } from '../moves';
import { makePiece, type PieceKind } from './pieces';
import { THEMES, withPieceSet, type Theme, type WoodLook } from './themes';
import { loadModelSet, type ModelSet } from './modelSet';
import { buildRoom } from './room';
import { createOpponent, type Opponent } from './opponent';

export interface Board3DState {
  game: GameState;
  lastMove: Move | null;
  selected: number | null;
  targets: number[];
  flipped: boolean; // true면 흑 쪽에서 봄
  inCheck: boolean; // 둘 차례인 쪽 킹이 체크당했는지
  checkmate: boolean; // 체크메이트면 진 쪽 킹이 쓰러짐
  // 판 건너편에 앉을 상대 (사람끼리·AI 구경·기보 보기면 없음). lost: 상대가 졌는지(체크메이트·기권)
  opponent?: { id: string; color: 'w' | 'b'; lost: boolean } | null;
}

export type CameraView = 'seat' | 'angle' | 'top'; // 앉아서 / 비스듬히 / 위에서

export interface Board3D {
  element: HTMLElement;                 // 화면에 붙일 상자 (안에 3D 그림이 있음)
  update(state: Board3DState): void;    // 게임 상태가 바뀔 때마다 부름
  setTheme(id: string): void;
  setPieceSet(id: string): void; // 체스 세트 고르기 (테마에 pieceSets가 있을 때만 효과)
  setView(view: CameraView): void;
  setSeat(distance: number, height: number): void; // '앉아서' 시점의 거리(앞뒤)와 눈높이
  moveLandsIn(): number; // 마지막 수의 기물이 내려앉기까지 남은 시간(ms). 효과음을 그때 맞춰 냄
  // 오른쪽이 설정 판에 가려지는 폭(px). 판을 남은 자리 가운데로 옮기고, 넘치면 조금 멀리서 봄. 0이면 원래대로
  setRightInset(px: number): void;
  dispose(): void;
  renderCount(): number; // 테스트용: 지금까지 그린 횟수 (가만히 있을 때 안 늘어나야 함)
}

// 모델 파일은 한 번만 불러옴 (테마를 바꾸거나 3D를 다시 켜도 재사용)
let modelSetPromise: Promise<ModelSet | null> | null = null;
function getModelSet() {
  if (!modelSetPromise) modelSetPromise = loadModelSet();
  return modelSetPromise;
}

// 칸 좌표 → 3D 위치. file(왼→오 0~7), rank(흰 쪽 0 → 검은 쪽 7)
// x = file - 3.5, z = 3.5 - rank (흰 쪽이 카메라 가까이)
function squarePosition(square: number): THREE.Vector3 {
  const file = square % 8, rank = Math.floor(square / 8);
  return new THREE.Vector3(file - 3.5, 0, 3.5 - rank);
}

// 판 배치를 글자 하나로 (같은 배치인지 비교용)
function boardKey(g: GameState): string {
  return g.board.map(p => (p ? p.color + p.type : '..')).join('');
}

const MOVE_TIME = 320;
const FALL_TIME = 700;    // 체크메이트 때 킹이 쓰러지는 시간    // 기물이 움직이는 시간(ms)
const JUMP_HEIGHT = 0.6;  // 나이트가 뛰어오르는 높이

export async function createBoard3D(onSquareClick: (index: number) => void, themeId = 'spotlight', pieceSetId = 'marble'): Promise<Board3D> {
  const modelSet = await getModelSet();
  const touch = matchMedia('(pointer: coarse)').matches; // 휴대폰·태블릿이면 그림자 품질을 낮춤

  // ── 그리는 장치 ──
  const element = document.createElement('div');
  element.className = 'board3d';
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 너무 선명하면 느려서 최대 2배
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // 영화 같은 색 보정
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  element.appendChild(renderer.domElement);

  // ── 장면, 카메라, 조명 (테마와 상관없는 부분) ──
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // 가상의 방 풍경 반사

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;            // 손을 떼도 부드럽게 멈춤
  controls.maxPolarAngle = Math.PI * 0.47;  // 판 아래로는 못 내려가게
  controls.minDistance = 5;
  controls.maxDistance = 75;               // '앉아서' 시야 앞뒤 최대(59)보다 멀리까지
  controls.enablePan = false;               // 판이 화면 밖으로 밀려나지 않게

  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(-4, 8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 4;
  scene.add(sun);

  // 테마에 따라 바뀌는 것들을 담는 묶음 (테마를 바꾸면 통째로 새로 만듦)
  let themeGroup = new THREE.Group();
  scene.add(themeGroup);
  let theme: Theme = THEMES[0];
  let deskTop = -0.37;
  let whiteMat = new THREE.MeshPhysicalMaterial();
  let blackMat = new THREE.MeshPhysicalMaterial();

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
      const amp = 2 + Math.random() * 5;
      const freq = 0.01 + Math.random() * 0.02;
      const phase = Math.random() * Math.PI * 2;
      ctx.globalAlpha = 0.08 + Math.random() * 0.25;
      ctx.lineWidth = 0.5 + Math.random() * 2;
      ctx.beginPath();
      for (let x = 0; x <= size; x += 4) {
        const y = y0 + Math.sin(x * freq + phase) * amp;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  // 칸마다 나뭇결이 조금씩 다르게: 같은 그림의 다른 부분을 잘라 씀
  // 광택은 테마의 boardFinish를 따름 (없으면 니스 칠한 나무)
  function woodMaterial(base: THREE.CanvasTexture, rotate: boolean): THREE.MeshPhysicalMaterial {
    const tex = base.clone();
    tex.repeat.set(0.5, 0.5);
    tex.offset.set(Math.random() * 0.5, Math.random() * 0.5);
    if (rotate) { tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2; }
    tex.needsUpdate = true;
    const finish = theme.boardFinish ?? { roughness: 0.45, clearcoat: 0.4 };
    return new THREE.MeshPhysicalMaterial({ map: tex, ...finish, clearcoatRoughness: 0.3 });
  }

  // ── 테마 적용: 배경, 조명 세기, 판, 바닥, 기물 재질 ──
  let room: THREE.Group | null = null;
  function applyTheme(id: string) {
    themeId = id;
    theme = withPieceSet(THEMES.find(t => t.id === id) ?? THEMES[0], pieceSetId);
    scene.remove(themeGroup);
    themeGroup = new THREE.Group();
    scene.add(themeGroup);
    scene.background = new THREE.Color(theme.background);
    scene.environmentIntensity = theme.envIntensity;
    ambient.intensity = theme.ambient;
    sun.color.set(theme.sunColor);
    sun.intensity = theme.sunIntensity;
    sun.castShadow = theme.sunIntensity > 0; // 해를 끈 테마(스포트라이트)는 그림자 계산도 뺌

    let boardBottom = -0.37;
    if (theme.modelMaterials && modelSet) {
      const board = modelSet.makeBoard(); // 모델의 원래 판 (대리석)
      themeGroup.add(board);
      const bb = new THREE.Box3().setFromObject(board);
      boardBottom = bb.min.y;
      // 모델 판은 밑면이 없어서 그림자를 못 막음 → 위에서 오는 빛이면 기물 그림자가 판을 뚫고 탁자에 찍힘
      // 판 바로 밑에 보이지 않는(그림자만 만드는) 얇은 판을 깔아서 막음
      const size = bb.getSize(new THREE.Vector3());
      const blocker = new THREE.Mesh(new THREE.BoxGeometry(size.x, 0.02, size.z),
        new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      blocker.position.set((bb.min.x + bb.max.x) / 2, bb.min.y + 0.02, (bb.min.z + bb.max.z) / 2);
      blocker.castShadow = true;
      themeGroup.add(blocker);
    } else {
      const lightWood = woodTexture(theme.lightSquare);
      const darkWood = woodTexture(theme.darkSquare);
      const squareGeo = new THREE.BoxGeometry(1, 0.1, 1);
      for (let s = 0; s < 64; s++) {
        const file = s % 8, rank = Math.floor(s / 8);
        const isLight = (file + rank) % 2 === 1; // a1은 어두운 칸
        const sq = new THREE.Mesh(squareGeo, woodMaterial(isLight ? lightWood : darkWood, (file + rank) % 2 === 0));
        sq.position.copy(squarePosition(s));
        sq.position.y = -0.05; // 윗면이 높이 0
        sq.receiveShadow = true;
        themeGroup.add(sq);
      }
      const frameTex = woodTexture(theme.frame);
      frameTex.repeat.set(3, 3);
      const frameFinish = theme.boardFinish ?? { roughness: 0.4, clearcoat: 0.6 };
      const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 0.36, 9),
        new THREE.MeshPhysicalMaterial({ map: frameTex, ...frameFinish, clearcoatRoughness: 0.2 }));
      frame.position.y = -0.19;
      frame.receiveShadow = frame.castShadow = true;
      themeGroup.add(frame);
    }
    // 방: 판은 책상 위에 놓임 (책상 윗면 = 판 밑면)
    deskTop = boardBottom - 0.001;
    room = buildRoom(theme.id, deskTop, requestRender);
    room.rotation.y = flipped ? Math.PI : 0; // 흑 쪽에서 보면 방도 돌려서, 늘 같은 방(창문 왼쪽, 의자는 상대 뒤)이 보이게
    themeGroup.add(room);
    if (opp) setOpponent(oppKey, true); // 책상 높이가 테마마다 조금 달라서 상대도 다시 앉힘

    whiteMat = new THREE.MeshPhysicalMaterial(theme.whitePiece);
    blackMat = new THREE.MeshPhysicalMaterial(theme.blackPiece);
    if (modelSet && theme.pieceCarving !== false) {
      whiteMat.normalMap = modelSet.normalMap(true); // 모델의 조각 자국을 테마 재질에도 빌려 씀
      blackMat.normalMap = modelSet.normalMap(false);
    }
    setBloom(theme.bloom ?? 0);
    // 기물은 재질이 바뀌어야 하니 전부 새로 만듦
    for (const [sq, obj] of pieces) { piecesGroup.remove(obj); pieces.delete(sq); }
    if (current) { syncPieces(current.game); setKingFall(current); }
    requestRender();
  }

  // ── 빛 번짐(블룸) ──
  // 장면을 한 번 그린 뒤, 밝은 부분만 뽑아 흐리게 번지게 해서 다시 겹쳐 그림 (후처리)
  // 테마의 bloom이 0이면 후처리 없이 바로 그림 (더 빠름)
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  function setBloom(strength: number) {
    if (strength <= 0) { composer?.dispose(); composer = null; bloomPass = null; return; }
    if (!composer) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // 해상도, 세기, 퍼지는 넓이, 이 밝기 넘는 부분만 번짐
      bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), strength, 0.6, 0.6);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass()); // 색 보정(톤 매핑)을 마지막에 적용
      resizeComposer();
    }
    bloomPass!.strength = strength;
  }
  function resizeComposer() {
    if (!composer) return;
    const w = element.clientWidth, h = element.clientHeight;
    if (w === 0 || h === 0) return;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    // 휴대폰에서는 번짐 계산을 절반 해상도로 (티는 거의 안 나고 훨씬 빠름)
    bloomPass?.resolution.set(touch ? w / 2 : w, touch ? h / 2 : h);
  }

  // ── 다시 그리기는 필요할 때만 ──
  // 판이 가만히 있으면 그림이 그대로라서, 매번 그리면 배터리만 닳음 (특히 휴대폰)
  // 무언가 바뀌면(수, 카메라, 테마, 크기) needsRender를 켜고, 다음 화면 갱신 때 한 번 그림
  let needsRender = true;
  const requestRender = () => { needsRender = true; };

  // ── 기물 ──
  const piecesGroup = new THREE.Group();
  scene.add(piecesGroup);
  const pieces = new Map<number, THREE.Object3D>(); // 칸 번호 → 그 칸의 기물 (userData.code = 'wp' 같은 글자)

  function createPiece(code: string): THREE.Object3D {
    const isWhite = code[0] === 'w';
    const kind = code[1] as PieceKind;
    let obj: THREE.Group;
    if (modelSet) {
      const mat = theme.modelMaterials ? undefined : isWhite ? whiteMat : blackMat;
      obj = modelSet.makePiece(kind, isWhite, mat);
    } else {
      obj = makePiece(kind, isWhite ? whiteMat : blackMat);
      obj.rotation.y = isWhite ? Math.PI / 2 : -Math.PI / 2; // 나이트 머리가 상대 쪽을 보게
    }
    obj.userData.code = code;
    return obj;
  }

  // 판 상태와 3D 기물을 맞춤 (움직임 없이 바로)
  function syncPieces(game: GameState) {
    requestRender();
    for (let s = 0; s < 64; s++) {
      const p = game.board[s];
      const code = p ? p.color + p.type : null;
      const have = pieces.get(s);
      if (have && have.userData.code === code) {
        have.position.copy(squarePosition(s));
        have.scale.setScalar(1);
        if (!have.userData.fallen) have.rotation.x = have.rotation.z = 0;
        continue;
      }
      if (have) { piecesGroup.remove(have); pieces.delete(s); }
      if (code) {
        const obj = createPiece(code);
        obj.position.copy(squarePosition(s));
        piecesGroup.add(obj);
        pieces.set(s, obj);
      }
    }
  }

  // ── 움직임 (애니메이션) ──
  interface Tween { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; start: number; jump: boolean; vanish: boolean }
  let tweens: Tween[] = [];
  let afterTweens: (() => void) | null = null;

  let landingAt = 0; // 마지막 수의 기물이 내려앉는 시각
  // delay: 기물이 출발하기까지 기다리는 시간 (상대 캐릭터가 손을 뻗는 동안)
  function animateMove(prev: GameState, move: Move, game: GameState, delay = 0) {
    const now = performance.now() + delay;
    landingAt = now + MOVE_TIME;
    const moving = pieces.get(move.from);
    if (!moving) { syncPieces(game); return; }
    // 잡히는 기물 (앙파상이면 도착 칸이 아니라 옆 칸)
    const piece = prev.board[move.from]!;
    let capturedSq: number | null = prev.board[move.to] ? move.to : null;
    if (piece.type === 'p' && move.to === prev.enPassant) capturedSq = (Math.floor(move.from / 8)) * 8 + (move.to % 8);
    if (capturedSq !== null) {
      const victim = pieces.get(capturedSq);
      if (victim) {
        pieces.delete(capturedSq);
        tweens.push({ obj: victim, from: victim.position.clone(), to: victim.position.clone(), start: now, jump: false, vanish: true });
      }
    }
    pieces.delete(move.from);
    pieces.set(move.to, moving);
    tweens.push({ obj: moving, from: squarePosition(move.from), to: squarePosition(move.to), start: now,
      jump: piece.type === 'n', vanish: false });
    // 캐슬링이면 룩도 같이
    if (piece.type === 'k' && Math.abs((move.to % 8) - (move.from % 8)) === 2) {
      const rank = Math.floor(move.from / 8);
      const [rf, rt] = move.to % 8 === 6 ? [rank * 8 + 7, rank * 8 + 5] : [rank * 8, rank * 8 + 3];
      const rook = pieces.get(rf);
      if (rook) {
        pieces.delete(rf);
        pieces.set(rt, rook);
        tweens.push({ obj: rook, from: squarePosition(rf), to: squarePosition(rt), start: now, jump: false, vanish: false });
      }
    }
    // 다 움직인 뒤 판 상태와 한 번 더 맞춤 (프로모션이면 여기서 폰이 퀸 등으로 바뀜)
    afterTweens = () => syncPieces(game);
  }

  function stepTweens(now: number) {
    if (tweens.length === 0) return;
    let allDone = true;
    for (const t of tweens) {
      const k = Math.min(1, Math.max(0, (now - t.start) / MOVE_TIME)); // 출발 전이면 0
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // 천천히 출발 → 빨리 → 천천히 도착
      if (t.vanish) {
        t.obj.scale.setScalar(Math.max(0.001, 1 - ease)); // 작아지며 사라짐
      } else {
        t.obj.position.lerpVectors(t.from, t.to, ease);
        t.obj.position.y = t.jump ? Math.sin(Math.PI * ease) * JUMP_HEIGHT : 0;
      }
      if (k < 1) allDone = false;
    }
    if (allDone) {
      for (const t of tweens) if (t.vanish) piecesGroup.remove(t.obj);
      tweens = [];
      const fn = afterTweens;
      afterTweens = null;
      fn?.();
    }
  }

  // 진행 중인 움직임을 바로 끝냄 (무르기·다시 시작처럼 판이 갑자기 바뀔 때)
  function finishTweens() {
    if (tweens.length === 0) return;
    for (const t of tweens) {
      if (t.vanish) piecesGroup.remove(t.obj);
      else t.obj.position.copy(t.to);
    }
    tweens = [];
    afterTweens = null;
  }

  // ── 체크메이트: 진 쪽 킹이 옆으로 쓰러짐 (무르기하면 다시 일어섬) ──
  let fall: { obj: THREE.Object3D; start: number; dir: number } | null = null;
  function setKingFall(state: Board3DState) {
    // 먼저 모든 킹을 세움
    for (const obj of pieces.values()) {
      if (obj.userData.fallen) { obj.userData.fallen = false; obj.rotation.x = obj.rotation.z = 0; }
    }
    fall = null;
    if (!state.checkmate) return;
    const g = state.game;
    const sq = g.board.findIndex(p => p && p.type === 'k' && p.color === g.turn); // 둘 차례인 쪽이 진 쪽
    const king = pieces.get(sq);
    if (!king) return;
    king.userData.fallen = true;
    fall = { obj: king, start: Math.max(performance.now(), tweens.length > 0 ? landingAt : 0), dir: Math.random() < 0.5 ? 1 : -1 };
    requestRender();
  }
  function stepFall(now: number): boolean {
    if (!fall) return false;
    const k = Math.min(1, Math.max(0, (now - fall.start) / FALL_TIME));
    // 처음엔 천천히 기울다가 빨라지고, 끝에서 살짝 튕김
    const ease = k < 0.85 ? Math.pow(k / 0.85, 2) : 1 + Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.04;
    fall.obj.rotation.z = fall.dir * ease * (Math.PI / 2 - 0.1);
    if (k >= 1) { fall = null; return true; }
    return true;
  }

  // ── 판 건너편 상대 캐릭터 ──
  let opp: Opponent | null = null;
  let oppKey = ''; // 'master:b' 처럼 (누가, 어느 색)
  function setOpponent(key: string, force = false) {
    if (key === oppKey && !force) return;
    oppKey = key;
    if (opp) { scene.remove(opp.group); opp.dispose(); opp = null; }
    if (!key) { requestRender(); return; }
    const [id, color] = key.split(':');
    opp = createOpponent(id, deskTop);
    if (opp) {
      if (color === 'w') opp.group.rotation.y = Math.PI; // 백이면 판 반대편(내 쪽에서 보면 건너편)으로 돌아앉음
      scene.add(opp.group);
      opp.update(performance.now());
    }
    requestRender();
  }

  // ── 칸 표시: 마지막 수, 고른 칸, 둘 수 있는 칸, 체크 ──
  const marks = new THREE.Group();
  scene.add(marks);
  const flatSquare = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.38, 0.47, 48).rotateX(-Math.PI / 2);
  const markMat = (color: number, opacity: number) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const LAST = markMat(0xc8e05a, 0.45), SELECTED = markMat(0xf2d34a, 0.6),
    TARGET = markMat(0x1a1a1a, 0.35), CHECK = markMat(0xff3b30, 0.55);

  function drawMarks(state: Board3DState) {
    requestRender();
    marks.clear();
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, sq: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(squarePosition(sq));
      m.position.y = 0.004; // 판 바로 위
      m.renderOrder = 1;
      marks.add(m);
    };
    if (state.lastMove) { add(flatSquare, LAST, state.lastMove.from); add(flatSquare, LAST, state.lastMove.to); }
    if (state.selected !== null) add(flatSquare, SELECTED, state.selected);
    for (const t of state.targets) add(state.game.board[t] ? ringGeo : dotGeo, TARGET, t);
    // 체크당한 킹 칸을 빨갛게
    const g = state.game;
    const king = g.board.findIndex(p => p && p.type === 'k' && p.color === g.turn);
    if (king >= 0 && state.inCheck) add(flatSquare, CHECK, king);
  }

  // ── 카메라 ──
  let flipped = false;
  let view: CameraView = 'seat';
  let seatDistance = 44, seatHeight = 14; // '앉아서' 시점: 판 가운데에서 내 쪽으로 떨어진 거리, 판 위 눈높이 (칸 단위)
  function placeCamera() {
    const side = flipped ? -1 : 1; // 흑 쪽에서 보면 반대편
    requestRender();
    if (view === 'top') { camera.position.set(0, 15.5, 0.01 * side); controls.target.set(0, 0, 0); }
    else if (view === 'angle') { camera.position.set(0, 12, 15.8 * side); controls.target.set(0, 0, 0); } // 판 전체가 들어오게 조금 멀리서
    else {
      // 앉아서: 거리·높이는 설정 판의 슬라이더로 조절 (setSeat)
      camera.position.set(0, seatHeight, seatDistance * side);
      controls.target.set(0, 2.2, -2.5 * side);
    }
    camera.up.set(0, 1, 0);
    controls.update();
  }
  placeCamera();

  // ── 누르기: 끌어서 돌리는 것과 구별 (손가락·마우스가 거의 안 움직였으면 누른 것) ──
  const raycaster = new THREE.Raycaster();
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let downAt: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > (touch ? 12 : 6)) return; // 돌린 것 (손가락은 조금 흔들려서 더 넉넉하게)
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(boardPlane, hit)) return;
    const file = Math.floor(hit.x + 4), rank = Math.floor(4 - hit.z);
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return;
    onSquareClick(rank * 8 + file);
  });

  // ── 크기: 상자 크기가 바뀌면 맞춤 ──
  let rightInset = 0; // 오른쪽이 가려지는 폭(px)
  const resize = () => {
    const w = element.clientWidth, h = element.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 판이 들어갈 자리의 너비 = 전체 너비 − 가려지는 폭 (너무 좁으면 가림막을 무시)
    const inset = w - rightInset >= 300 ? rightInset : 0;
    const free = w - inset;
    // 자리가 세로로 길면(휴대폰 전체 화면, 설정 판을 편 좁은 창) 판 양옆이 잘리지 않게 위아래 시야각을 넓힘
    // (가로 시야를 정사각형일 때와 같게 유지: tan(세로/2) = tan(40°/2) × 높이 ÷ 너비)
    camera.fov = free >= h ? 40 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(20)) * h / free));
    // 그림 전체를 가린 폭의 절반만큼 왼쪽으로 밀어서, 판이 남은 자리 가운데에 오게
    // (클릭 위치 계산도 같은 카메라를 써서 그대로 맞음)
    if (inset > 0) camera.setViewOffset(w, h, inset / 2, 0, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    resizeComposer();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(element);

  // ── 그리기: 화면에 붙어 있을 때만 (다른 탭이면 쉼) ──
  controls.addEventListener('change', requestRender); // 카메라를 돌리거나 확대하면
  let wasConnected = false;
  renderer.setAnimationLoop(now => {
    if (!element.isConnected) { wasConnected = false; return; }
    if (!wasConnected) { wasConnected = true; needsRender = true; } // 다른 탭에서 돌아오면 한 번 그림
    const moving = tweens.length > 0;
    stepTweens(now);
    const falling = stepFall(now);
    controls.update(); // 손을 뗀 뒤 부드럽게 멈추는 중이면 'change'가 와서 다시 그림
    // 상대 캐릭터: 손 뻗기·고개 숙이기 중이면 매번, 가만히 숨만 쉴 때는 초당 약 12장만 (배터리 아끼기)
    // 한 장 그리는 데 오래 걸리는 기기(느린 휴대폰)면 숨쉬기 장면을 더 드물게: 그리는 시간의 4배 이상 쉼
    let acting = false;
    if (opp) {
      acting = opp.update(now);
      if (!acting && now - lastIdleFrame > Math.max(1000 / 12, frameCost * 4)) { lastIdleFrame = now; needsRender = true; }
    }
    if (!moving && !falling && !acting && !needsRender) return;
    needsRender = false;
    const t0 = performance.now();
    if (composer) composer.render(); else renderer.render(scene, camera);
    frameCost = frameCost * 0.8 + (performance.now() - t0) * 0.2; // 최근 몇 장의 평균
    renders++;
  });
  let renders = 0; // 테스트용: 지금까지 그린 횟수
  let lastIdleFrame = 0;
  let frameCost = 0; // 한 장 그리는 데 걸린 시간(ms), 평균

  // ── 바깥에서 부르는 함수 ──
  let current: Board3DState | null = null;
  applyTheme(themeId);

  return {
    element,
    update(state) {
      const prev = current;
      if (state.flipped !== flipped) {
        flipped = state.flipped;
        if (room) room.rotation.y = flipped ? Math.PI : 0;
        placeCamera();
      }
      const o = state.opponent;
      setOpponent(o ? `${o.id}:${o.color}` : '');
      opp?.setLost(!!o?.lost);
      opp?.setInCheck?.(!!o && state.inCheck && state.game.turn === o.color);
      // 새 수 하나가 둬진 거면 움직임으로, 아니면(무르기·다시 시작) 바로 맞춤
      const newMove = prev !== null && state.lastMove !== null && state.lastMove !== prev.lastMove;
      let animated = false;
      // (무르기를 하면 lastMove가 예전 수로 바뀌는데, 그 수는 지금 판에서 둘 수 없으니 먼저 확인)
      const mover = newMove ? prev!.game.board[state.lastMove!.from] : null;
      if (newMove && mover && mover.color === prev!.game.turn) {
        const test = cloneGame(prev!.game);
        makeMove(test, state.lastMove!);
        const sameBoard = test.board.every((p, i) => {
          const q = state.game.board[i];
          return (p?.color === q?.color) && (p?.type === q?.type);
        });
        if (sameBoard) {
          finishTweens();
          // 상대 캐릭터의 수면 손을 뻗어서 밀고, 손이 닿은 뒤에 기물이 출발
          const delay = opp && o && mover.color === o.color
            ? opp.reach(squarePosition(state.lastMove!.from), squarePosition(state.lastMove!.to), MOVE_TIME) : 0;
          animateMove(prev!.game, state.lastMove!, state.game, delay);
          animated = true;
          // 잡는 수였으면 (앙파상 포함: 기물 수가 줄었으면) 상대가 반응 — 기물이 내려앉은 뒤에
          const count = (g: GameState) => g.board.reduce((n, p) => n + (p ? 1 : 0), 0);
          if (opp?.react && o && count(state.game) < count(prev!.game)) {
            opp.react(mover.color === o.color ? 'captured' : 'lostPiece', delay + MOVE_TIME);
          }
        }
      }
      if (!animated) {
        // 움직이는 중에 화면만 다시 그려진 거면(판은 그대로) 움직임을 끊지 않음
        const sameAsBefore = prev !== null && boardKey(prev.game) === boardKey(state.game);
        if (!(sameAsBefore && tweens.length > 0)) {
          finishTweens();
          syncPieces(state.game);
        }
      }
      const wasMate = prev?.checkmate ?? false;
      current = { ...state, game: cloneGame(state.game) };
      drawMarks(current);
      if (state.checkmate !== wasMate) setKingFall(current); // 체크메이트가 되거나(쓰러짐) 풀릴 때(일어섬)만
    },
    setTheme(id) { finishTweens(); applyTheme(id); },
    setPieceSet(id) {
      if (id === pieceSetId) return;
      pieceSetId = id;
      finishTweens();
      applyTheme(themeId);
    },
    setView(v) { view = v; placeCamera(); },
    // 슬라이더를 움직이면 카메라를 처음 자리로 되돌리지 않고, 지금 자리(확대·돌린 상태 그대로)에서 바뀐 만큼만 옮김
    setSeat(d, h) {
      const dd = d - seatDistance, dh = h - seatHeight;
      seatDistance = d; seatHeight = h;
      if (view !== 'seat' || (dd === 0 && dh === 0)) return;
      const side = flipped ? -1 : 1;
      camera.position.y += dh;
      camera.position.z += dd * side;
      controls.update();
      requestRender();
    },
    moveLandsIn: () => Math.max(0, landingAt - performance.now()),
    // 화면을 다시 그리는 동안엔 이 상자가 잠깐 떨어져 있어서(너비 0) 바로 맞추면 무시됨 → 다음 화면 갱신 때 맞춤
    setRightInset(px) { if (px !== rightInset) { rightInset = px; requestAnimationFrame(resize); } },
    renderCount: () => renders,
    dispose() {
      setOpponent('');
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      element.remove();
    },
  };
}
