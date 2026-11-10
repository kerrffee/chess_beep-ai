// ---------- 표준 기보 표기 (SAN) ----------
// 체스 책·사이트에서 쓰는 짧은 표기. 예: e4, Nf3, Bxc6, O-O, e8=Q, Nbd2
//   - 폰은 글자 없이 도착 칸만 (잡을 때는 출발 세로줄 + x: exd5)
//   - 다른 기물은 대문자 하나 + 도착 칸 (K 킹, Q 퀸, R 룩, B 비숍, N 나이트)
//   - 같은 종류 기물 두 개가 같은 칸에 갈 수 있으면, 출발 세로줄(또는 가로줄)을 붙여 구별: Nbd2, R1a3
//   - 체크면 +, 체크메이트면 # (이건 둔 뒤에 붙임: checkSuffix)
import type { GameState } from './board';
import { legalMoves, makeMove, unmakeMove, inCheck, type Move } from './moves';

const FILES = 'abcdefgh';
export function squareName(s: number): string {
  return FILES[s % 8] + (Math.floor(s / 8) + 1);
}

// 수를 두기 "전" 장면에서 그 수의 표기 (+, # 빼고)
export function toSAN(before: GameState, move: Move): string {
  const piece = before.board[move.from]!;
  const fromFile = move.from % 8, fromRank = Math.floor(move.from / 8);

  if (piece.type === 'k' && Math.abs((move.to % 8) - fromFile) === 2) {
    return move.to % 8 === 6 ? 'O-O' : 'O-O-O'; // 캐슬링
  }
  const capture = before.board[move.to] !== null || (piece.type === 'p' && move.to === before.enPassant);

  if (piece.type === 'p') {
    let text = (capture ? FILES[fromFile] + 'x' : '') + squareName(move.to);
    if (move.promotion) text += '=' + move.promotion.toUpperCase();
    return text;
  }

  // 같은 종류의 다른 기물도 같은 칸으로 갈 수 있는지 (구별 글자가 필요한지)
  const rivals = legalMoves(before).filter(m =>
    m.to === move.to && m.from !== move.from && before.board[m.from]?.type === piece.type);
  let hint = '';
  if (rivals.length > 0) {
    const sameFile = rivals.some(m => m.from % 8 === fromFile);
    const sameRank = rivals.some(m => Math.floor(m.from / 8) === fromRank);
    if (!sameFile) hint = FILES[fromFile];                 // 세로줄로 구별 가능
    else if (!sameRank) hint = String(fromRank + 1);       // 가로줄로 구별 가능
    else hint = squareName(move.from);                     // 둘 다 필요 (아주 드묾)
  }
  return piece.type.toUpperCase() + hint + (capture ? 'x' : '') + squareName(move.to);
}

// 수를 둔 "뒤" 장면에서 붙일 기호: 체크메이트 '#', 체크 '+', 아니면 ''
export function checkSuffix(after: GameState): string {
  if (!inCheck(after, after.turn)) return '';
  return legalMoves(after).length === 0 ? '#' : '+';
}

// 수를 둬 보고 표기 전체(+, # 포함)를 만든 뒤 되돌림 (테스트·기보용)
export function fullSAN(game: GameState, move: Move): string {
  const text = toSAN(game, move);
  const undo = makeMove(game, move);
  const suffix = checkSuffix(game);
  unmakeMove(game, move, undo);
  return text + suffix;
}
