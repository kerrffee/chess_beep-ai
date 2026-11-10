// ---------- PGN (체스 기보 표준 형식) 만들기·읽기 ----------
// PGN 모양:
//   [White "대가"]        ← 머리말: [이름 "값"]
//   [Result "1-0"]
//
//   1. e4 e5 2. Nf3 Nc6 1-0   ← 수 목록 (표준 표기) + 결과
import { initialGame, fromFEN, cloneGame, type Color, type GameState } from './board';
import { legalMoves, makeMove, type Move } from './moves';
import { toSAN, checkSuffix } from './notation';

// 불러온(또는 리그에서 끝난) 한 판
export interface LoadedGame {
  start: GameState;   // 처음 장면
  moves: Move[];      // 둔 수들
  sans: string[];     // 표준 표기 (+, # 포함)
  white: string;
  black: string;
  result: string;     // '1-0', '0-1', '1/2-1/2', '*'
  fen?: string;       // 처음 배치에서 시작하지 않았으면 그 배치
}

// 둔 수들의 표준 표기 목록 만들기
export function sansOf(start: GameState, moves: Move[]): string[] {
  const g = cloneGame(start);
  return moves.map(m => {
    const text = toSAN(g, m);
    makeMove(g, m);
    return text + checkSuffix(g);
  });
}

// PGN 글자 만들기
export function buildPGN(game: { white: string; black: string; result: string; sans: string[]; firstTurn: Color; fen?: string }): string {
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  const headers = [
    ['Event', 'chess_beep-ai'],
    ['Date', `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`],
    ['White', game.white],
    ['Black', game.black],
    ['Result', game.result],
    ...(game.fen ? [['SetUp', '1'], ['FEN', game.fen]] : []),
  ].map(([k, v]) => `[${k} "${v}"]`).join('\n');

  // "1. e4 e5 2. Nf3 …" (흑부터 시작했으면 "1... e5")
  const parts: string[] = [];
  game.sans.forEach((text, i) => {
    const ply = game.firstTurn === 'b' ? i + 1 : i;
    if (ply % 2 === 0) parts.push(`${ply / 2 + 1}. ${text}`);
    else if (i === 0) parts.push(`1... ${text}`);
    else parts.push(text);
  });
  return `${headers}\n\n${parts.join(' ')} ${game.result}\n`;
}

// 파일로 내려받기
export function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/x-chess-pgn' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function pgnFilename(): string {
  const now = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `chess_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.pgn`;
}

// 표기 비교용으로 다듬기: +, #, !, ?, = 빼고, 0-0을 O-O로
function normalize(san: string): string {
  return san.replace(/[+#!?=]/g, '').replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
}

// PGN 글자 읽기. 성공하면 LoadedGame, 실패하면 무엇이 문제인지 글자로
// (파일에 여러 판이 있으면 첫 판만)
export function parsePGN(text: string): LoadedGame | string {
  const header = (name: string) => text.match(new RegExp(`\\[${name}\\s+"([^"]*)"\\]`))?.[1];
  const fen = header('FEN');
  let start: GameState;
  try {
    start = fen ? fromFEN(fen) : initialGame();
  } catch {
    return '처음 배치(FEN)를 읽을 수 없어요.';
  }

  // 머리말·주석·변화수 지우고 수 목록만 남기기
  let body = text.replace(/\[[^\]]*\]/g, ' ')  // [머리말]
    .replace(/\{[^}]*\}/g, ' ')                 // {주석}
    .replace(/;[^\n]*/g, ' ')                   // ; 한 줄 주석
    .replace(/\$\d+/g, ' ');                    // $1 같은 기호
  // (변화수)는 겹쳐 있을 수 있어서, 안쪽부터 여러 번 지움
  while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, ' ');
  // 두 번째 판이 시작되면 거기서 자르기 (결과 표시 뒤)
  const tokens = body.split(/\s+/).filter(Boolean);

  const g = cloneGame(start);
  const moves: Move[] = [];
  let result = header('Result') ?? '*';
  for (let raw of tokens) {
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(raw)) { result = raw; break; }
    raw = raw.replace(/^\d+\.+/, ''); // "12." 또는 "12...", "1.e4"처럼 붙은 것도
    if (raw === '') continue;
    const want = normalize(raw);
    const move = legalMoves(g).find(m => normalize(toSAN(g, m)) === want);
    if (!move) return `${moves.length + 1}번째 수 "${raw}"를 둘 수 없어요. (그 앞까지 ${moves.length}수는 읽었어요)`;
    moves.push(move);
    makeMove(g, move);
  }
  if (moves.length === 0) return '읽을 수 있는 수가 없어요. PGN 파일이 맞는지 확인해 주세요.';
  return {
    start, moves, sans: sansOf(start, moves),
    white: header('White') ?? '백', black: header('Black') ?? '흑', result, fen,
  };
}
