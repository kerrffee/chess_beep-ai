import { sq, cloneGame, type GameState, type PieceType } from './board';

// 수 하나: 출발 칸, 도착 칸, (폰이 끝 줄에 갈 때) 변신할 기물
export interface Move {
  from: number;
  to: number;
  promotion?: PieceType;
}

function fileOf(index: number): number {
  return index % 8;
}
function rankOf(index: number): number {
  return Math.floor(index / 8);
}
function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

// (가로 이동, 세로 이동)
const KNIGHT_JUMPS: [number, number][] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_STEPS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN_DIRS: [number, number][] = [...ROOK_DIRS, ...BISHOP_DIRS];

// 정해진 방향으로 "한 번만" 이동하는 기물(나이트, 킹)
function stepMoves(game: GameState, from: number, offsets: [number, number][]): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  for (const [df, dr] of offsets) {
    const nf = f + df;
    const nr = r + dr;
    if (!onBoard(nf, nr)) continue;

    const to = sq(nf, nr);
    const target = game.board[to];
    if (target && target.color === piece.color) continue;

    result.push(to);
  }
  return result;
}

// 막힐 때까지 "미끄러지는" 기물(룩, 비숍, 퀸)
function slideMoves(game: GameState, from: number, dirs: [number, number][]): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  for (const [df, dr] of dirs) {
    let nf = f + df;
    let nr = r + dr;

    while (onBoard(nf, nr)) {
      const to = sq(nf, nr);
      const target = game.board[to];

      if (!target) {
        result.push(to);
      } else {
        if (target.color !== piece.color) result.push(to);
        break;
      }

      nf += df;
      nr += dr;
    }
  }
  return result;
}

// 폰: 앞으로 1칸, 처음 2칸, 대각선 잡기, 앙파상
function pawnMoves(game: GameState, from: number): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  const dir = piece.color === 'w' ? 1 : -1;
  const startRank = piece.color === 'w' ? 1 : 6;

  const oneRank = r + dir;
  if (onBoard(f, oneRank) && !game.board[sq(f, oneRank)]) {
    result.push(sq(f, oneRank));

    const twoRank = r + 2 * dir;
    if (r === startRank && !game.board[sq(f, twoRank)]) {
      result.push(sq(f, twoRank));
    }
  }

  for (const df of [-1, 1]) {
    const nf = f + df;
    if (!onBoard(nf, oneRank)) continue;

    const diag = sq(nf, oneRank);
    const target = game.board[diag];

    if (target && target.color !== piece.color) {
      result.push(diag);
    } else if (diag === game.enPassant) {
      result.push(diag);
    }
  }

  return result;
}

// 체크를 따지지 않은 "일단 갈 수 있는 칸" (캐슬링 제외)
function pseudoMoves(game: GameState, from: number): number[] {
  const piece = game.board[from];
  if (!piece) return [];

  switch (piece.type) {
    case 'n':
      return stepMoves(game, from, KNIGHT_JUMPS);
    case 'k':
      return stepMoves(game, from, KING_STEPS);
    case 'r':
      return slideMoves(game, from, ROOK_DIRS);
    case 'b':
      return slideMoves(game, from, BISHOP_DIRS);
    case 'q':
      return slideMoves(game, from, QUEEN_DIRS);
    case 'p':
      return pawnMoves(game, from);
  }
  return [];
}

// ---------- 체크 관련 ----------

function findKing(game: GameState, color: 'w' | 'b'): number {
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return -1;
}

// target 칸을 attacker 색 기물 중 하나라도 공격하고 있는지 (빈 칸도 가능)
function isAttacked(game: GameState, target: number, attacker: 'w' | 'b'): boolean {
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    if (!p || p.color !== attacker) continue;

    if (p.type === 'p') {
      const dir = p.color === 'w' ? 1 : -1;
      const r = rankOf(i) + dir;
      for (const df of [-1, 1]) {
        const f = fileOf(i) + df;
        if (onBoard(f, r) && sq(f, r) === target) return true;
      }
    } else if (pseudoMoves(game, i).includes(target)) {
      return true;
    }
  }
  return false;
}

export function inCheck(game: GameState, color: 'w' | 'b'): boolean {
  const king = findKing(game, color);
  const enemy = color === 'w' ? 'b' : 'w';
  return isAttacked(game, king, enemy);
}

// ---------- 캐슬링 ----------

function castlingMoves(game: GameState, from: number): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const home = piece.color === 'w' ? 0 : 7;
  const enemy = piece.color === 'w' ? 'b' : 'w';

  if (from !== sq(4, home)) return result;
  if (isAttacked(game, from, enemy)) return result;

  const kingSide = piece.color === 'w' ? game.castling.wK : game.castling.bK;
  const queenSide = piece.color === 'w' ? game.castling.wQ : game.castling.bQ;
  const b = game.board;

  if (kingSide && !b[sq(5, home)] && !b[sq(6, home)] && !isAttacked(game, sq(5, home), enemy)) {
    result.push(sq(6, home));
  }
  if (queenSide && !b[sq(1, home)] && !b[sq(2, home)] && !b[sq(3, home)] &&
      !isAttacked(game, sq(3, home), enemy)) {
    result.push(sq(2, home));
  }
  return result;
}

// ---------- 수 두기 ----------

export function makeMove(game: GameState, move: Move): void {
  const { from, to } = move;
  const piece = game.board[from]!;

    // 50수 규칙 시계: 폰을 움직이거나 잡으면 0, 아니면 +1
  const isCapture = game.board[to] !== null || (piece.type === 'p' && to === game.enPassant);
  game.halfmoveClock = piece.type === 'p' || isCapture ? 0 : game.halfmoveClock + 1;
  
  // 앙파상 잡기
  if (piece.type === 'p' && to === game.enPassant) {
    game.board[sq(fileOf(to), rankOf(from))] = null;
  }

  // 캐슬링: 룩도 같이 옮기기
  if (piece.type === 'k' && Math.abs(fileOf(to) - fileOf(from)) === 2) {
    const r = rankOf(from);
    if (fileOf(to) === 6) {
      game.board[sq(5, r)] = game.board[sq(7, r)];
      game.board[sq(7, r)] = null;
    } else {
      game.board[sq(3, r)] = game.board[sq(0, r)];
      game.board[sq(0, r)] = null;
    }
  }

  game.board[to] = piece;
  game.board[from] = null;

  // 캐슬링 권리 갱신
  if (piece.type === 'k') {
    if (piece.color === 'w') { game.castling.wK = false; game.castling.wQ = false; }
    else                     { game.castling.bK = false; game.castling.bQ = false; }
  }
  for (const s of [from, to]) {
    if (s === sq(0, 0)) game.castling.wQ = false;
    if (s === sq(7, 0)) game.castling.wK = false;
    if (s === sq(0, 7)) game.castling.bQ = false;
    if (s === sq(7, 7)) game.castling.bK = false;
  }

  // 앙파상 칸 기록
  if (piece.type === 'p' && Math.abs(rankOf(to) - rankOf(from)) === 2) {
    game.enPassant = sq(fileOf(from), (rankOf(from) + rankOf(to)) / 2);
  } else {
    game.enPassant = null;
  }

  // 프로모션: 지정한 기물로, 지정 안 했으면 퀸으로
  const lastRank = piece.color === 'w' ? 7 : 0;
  if (piece.type === 'p' && rankOf(to) === lastRank) {
    game.board[to] = { color: piece.color, type: move.promotion ?? 'q' };
  }

  game.turn = game.turn === 'w' ? 'b' : 'w';
}

// ---------- 둘 수 있는 모든 수 ----------

// 지금 차례인 쪽이 둘 수 있는 "진짜" 수 전부
export function legalMoves(game: GameState): Move[] {
  const result: Move[] = [];

  for (let from = 0; from < 64; from++) {
    const piece = game.board[from];
    if (!piece || piece.color !== game.turn) continue;

    const candidates = pseudoMoves(game, from);
    if (piece.type === 'k') candidates.push(...castlingMoves(game, from));

    for (const to of candidates) {
      // 둬봐서 내 킹이 안전한지 확인
      const copy = cloneGame(game);
      makeMove(copy, { from, to });
      if (inCheck(copy, piece.color)) continue;

      // 폰이 끝 줄에 가면 4가지 수로 나눔
      const lastRank = piece.color === 'w' ? 7 : 0;
      if (piece.type === 'p' && rankOf(to) === lastRank) {
        for (const promotion of ['q', 'r', 'b', 'n'] as PieceType[]) {
          result.push({ from, to, promotion });
        }
      } else {
        result.push({ from, to });
      }
    }
  }
  return result;
}

// 화면용: from 칸에서 갈 수 있는 칸 번호들 (중복 제거)
export function movesFrom(game: GameState, from: number): number[] {
  const tos = legalMoves(game).filter(m => m.from === from).map(m => m.to);
  return [...new Set(tos)];
}

// ---------- 게임 끝 판정 ----------

// 같은 장면인지 비교하기 위한 "장면 이름표"
// 기물 배치 + 차례 + 캐슬링 권리 + (실제로 잡을 수 있을 때만) 앙파상 칸
export function positionKey(game: GameState): string {
  let key = '';
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    key += p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.';
  }
  key += ' ' + game.turn + ' ';
  const c = game.castling;
  key += (c.wK ? 'K' : '') + (c.wQ ? 'Q' : '') + (c.bK ? 'k' : '') + (c.bQ ? 'q' : '');

  // 앙파상 칸은 옆에 잡을 수 있는 폰이 있을 때만 장면 차이로 침
  if (game.enPassant !== null) {
    const ep = game.enPassant;
    const pawnRank = game.turn === 'w' ? rankOf(ep) - 1 : rankOf(ep) + 1;
    for (const df of [-1, 1]) {
      const f = fileOf(ep) + df;
      if (!onBoard(f, pawnRank)) continue;
      const p = game.board[sq(f, pawnRank)];
      if (p && p.type === 'p' && p.color === game.turn) {
        key += ' ' + ep;
        break;
      }
    }
  }
  return key;
}

// 양쪽 다 체크메이트를 만들 수 없는 기물만 남았는지
function insufficientMaterial(game: GameState): boolean {
  const others: { type: string; square: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    if (p && p.type !== 'k') others.push({ type: p.type, square: i });
  }

  if (others.length === 0) return true;                          // 킹 vs 킹
  if (others.length === 1 && (others[0].type === 'b' || others[0].type === 'n')) {
    return true;                                                 // 킹+비숍 또는 킹+나이트 vs 킹
  }
  // 비숍만 남았고 전부 같은 색 칸 위에 있으면 메이트 불가
  if (others.every(o => o.type === 'b')) {
    const colorOf = (s: number) => (fileOf(s) + rankOf(s)) % 2;
    return others.every(o => colorOf(o.square) === colorOf(others[0].square));
  }
  return false;
}

export type Status = 'playing' | 'checkmate' | 'stalemate' | 'fifty' | 'repetition' | 'material';

// history: 지금까지 나온 장면 이름표들 (지금 장면 포함)
export function gameStatus(game: GameState, history: string[] = []): Status {
  if (legalMoves(game).length === 0) {
    return inCheck(game, game.turn) ? 'checkmate' : 'stalemate';
  }
  if (game.halfmoveClock >= 100) return 'fifty';                 // 양쪽 합쳐 100번 = 50수

  const key = positionKey(game);
  if (history.filter(k => k === key).length >= 3) return 'repetition';

  if (insufficientMaterial(game)) return 'material';
  return 'playing';
}