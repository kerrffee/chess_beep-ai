// 3d.html: 3D 판 미리 보기 (테마·모델을 확인하는 용도, 둘 수는 없음)
// 실제 게임의 3D 판은 board3d.ts에 있고, 대국 화면에서 "3D로 보기"를 누르면 나옴
// 테마 고르기: 주소창으로 (예: 3d.html?theme=marble)
import { initialGame } from '../board';
import { inCheck } from '../moves';
import { createBoard3D } from './board3d';

const themeId = new URLSearchParams(location.search).get('theme') ?? 'classic';
const board = await createBoard3D(() => {}, themeId);
board.element.style.width = '100vw';
board.element.style.height = '100vh';
board.element.style.borderRadius = '0';
document.body.appendChild(board.element);
const game = initialGame();
board.update({ game, lastMove: null, selected: null, targets: [], flipped: false, inCheck: inCheck(game, game.turn), checkmate: false });
