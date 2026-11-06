import { sq, type GameState } from './board';

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
      result.push(diag); // 일반 대각선 잡기
    } else if (diag === game.enPassant) {
      result.push(diag); // 앙파상
    }
  }

  return result;
}

// 체크를 따지지 않은 "일단 갈 수 있는 칸" (캐슬링은 여기 넣지 않음: 함정 ②)
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

// color 색 킹이 있는 칸 번호
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
      // 함정 ①: 폰은 앞쪽 대각선 두 칸을 "항상" 공격하고 있다고 본다
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

// color 색 킹이 지금 체크 상태인지
export function inCheck(game: GameState, color: 'w' | 'b'): boolean {
  const king = findKing(game, color);
  const enemy = color === 'w' ? 'b' : 'w';
  return isAttacked(game, king, enemy);
}

// ---------- 캐슬링 ----------

function castlingMoves(game: GameState, from: number): number[] {
  const piece = game.board[from]!;
  const result: number[] = [];
  const home = piece.color === 'w' ? 0 : 7;      // 백은 1랭크, 흑은 8랭크
  const enemy = piece.color === 'w' ? 'b' : 'w';

  if (from !== sq(4, home)) return result;        // 킹이 e열 제자리에 없으면 불가
  if (isAttacked(game, from, enemy)) return result; // 조건 3: 체크 중이면 불가

  const kingSide = piece.color === 'w' ? game.castling.wK : game.castling.bK;
  const queenSide = piece.color === 'w' ? game.castling.wQ : game.castling.bQ;
  const b = game.board;

  // 킹 쪽: f, g 비어 있음 + f 공격 안 받음
  if (kingSide && !b[sq(5, home)] && !b[sq(6, home)] && !isAttacked(game, sq(5, home), enemy)) {
    result.push(sq(6, home));
  }
  // 퀸 쪽: b, c, d 비어 있음 + d 공격 안 받음
  if (queenSide && !b[sq(1, home)] && !b[sq(2, home)] && !b[sq(3, home)] &&
      !isAttacked(game, sq(3, home), enemy)) {
    result.push(sq(2, home));
  }
  return result;
}

// ---------- 수 두기 ----------

// from에서 to로 실제로 수를 둔다 (게임 상태를 직접 바꿈)
export function makeMove(game: GameState, from: number, to: number): void {
  const piece = game.board[from]!;

  // 앙파상 잡기: 폰이 앙파상 칸으로 가면, 그 뒤에 있는 상대 폰을 없앤다
  if (piece.type === 'p' && to === game.enPassant) {
    const capturedPawn = sq(fileOf(to), rankOf(from));
    game.board[capturedPawn] = null;
  }

  // 캐슬링: 킹이 옆으로 2칸 가면 룩도 같이 옮긴다
  if (piece.type === 'k' && Math.abs(fileOf(to) - fileOf(from)) === 2) {
    const r = rankOf(from);
    if (fileOf(to) === 6) {
      game.board[sq(5, r)] = game.board[sq(7, r)]; // 킹 쪽: 룩 h → f
      game.board[sq(7, r)] = null;
    } else {
      game.board[sq(3, r)] = game.board[sq(0, r)]; // 퀸 쪽: 룩 a → d
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
  // 구석(룩 자리)에서 무언가 떠나거나, 구석의 무언가가 잡히면 그쪽 권리 상실
  for (const s of [from, to]) {
    if (s === sq(0, 0)) game.castling.wQ = false; // a1
    if (s === sq(7, 0)) game.castling.wK = false; // h1
    if (s === sq(0, 7)) game.castling.bQ = false; // a8
    if (s === sq(7, 7)) game.castling.bK = false; // h8
  }

  // 앙파상 칸 기록: 폰이 두 칸 전진했으면 건너뛴 칸을, 아니면 지움
  if (piece.type === 'p' && Math.abs(rankOf(to) - rankOf(from)) === 2) {
    game.enPassant = sq(fileOf(from), (rankOf(from) + rankOf(to)) / 2);
  } else {
    game.enPassant = null;
  }

  // 프로모션: 폰이 상대 끝 줄에 도착하면 퀸으로 (고르기 기능은 나중에)
  const lastRank = piece.color === 'w' ? 7 : 0;
  if (piece.type === 'p' && rankOf(to) === lastRank) {
    game.board[to] = { color: piece.color, type: 'q' };
  }

  game.turn = game.turn === 'w' ? 'b' : 'w';
}

// from 칸 기물이 "진짜로" 둘 수 있는 칸 (내 킹을 위험하게 만드는 수 제외)
export function movesFrom(game: GameState, from: number): number[] {
  const piece = game.board[from];
  if (!piece) return [];

  const candidates = pseudoMoves(game, from);
  if (piece.type === 'k') candidates.push(...castlingMoves(game, from)); // 캐슬링은 여기서 추가

  const legal: number[] = [];
  for (const to of candidates) {
    const copy = structuredClone(game);
    makeMove(copy, from, to);
    if (!inCheck(copy, piece.color)) legal.push(to); // 조건 5도 여기서 해결
  }
  return legal;
}

// ---------- 게임 끝 판정 ----------

export type Status = 'playing' | 'checkmate' | 'stalemate';

export function gameStatus(game: GameState): Status {
  for (let i = 0; i < 64; i++) {
    const p = game.board[i];
    if (p && p.color === game.turn && movesFrom(game, i).length > 0) {
      return 'playing';
    }
  }
  return inCheck(game, game.turn) ? 'checkmate' : 'stalemate';
}