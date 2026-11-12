// ---------- 판 건너편에 앉은 상대 캐릭터 ----------
// 성격마다 모양이 다름. 지금 있는 것:
//   대가(master): 가면 쓴 로브 인물, 손대지 않고 구슬 빛으로 기물을 움직임 → master.ts
//   겁쟁이(coward), 욕심쟁이(greedy), 허세꾼(bluffer), 핑계왕(excuser): 뼈대 있는 사람 모델 → human.ts
//   혼돈(chaos): 마녀 모자를 쓴 작은 유령 → ghost.ts
// 캐릭터가 없는 성격은 null (빈 자리)
//
// 좌표: 캐릭터는 자기 기준으로 +z(판 쪽)를 바라봄 (자리는 파일마다)
//       AI가 흑이면 판 뒤쪽(-z)에 그대로, 백이면 판을 돌아 반대편(+z)에 앉도록 통째로 180° 돌림
import * as THREE from 'three';
import { createHuman } from './human';
import { createMaster } from './master';
import { createGhost } from './ghost';

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

// 성격 id → 캐릭터 (없으면 null)
export function createOpponent(id: string, deskTop: number): Opponent | null {
  if (id === 'master') return createMaster(deskTop);
  if (id === 'coward' || id === 'greedy' || id === 'bluffer' || id === 'excuser') return createHuman(id, deskTop);
  if (id === 'chaos') return createGhost(deskTop);
  return null;
}
