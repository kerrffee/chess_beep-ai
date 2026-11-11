/// <reference types="node" />

// 레이팅 재기: 우리 AI를 수준을 낮춘 Stockfish(세계 최강급 공개 체스 엔진)와 여러 판 두게 하고,
// 이긴 비율로 우리 AI의 대략적인 레이팅(Elo 점수)을 계산
//
// 처음 한 번 (Stockfish 설치, 약 200MB. git이 무시하는 .tools 폴더에 들어감):
//   npm install --prefix .tools stockfish@19.0.1
//
// 쓰는 법:  npx tsx rating.ts <성격> <Stockfish 레이팅> [판 수] [생각 시간 ms]
//   예: npx tsx rating.ts master 1500 10
//       npx tsx rating.ts master 1500 10 300   ← 양쪽 모두 한 수 0.3초 (빨리 볼 때)
//   Stockfish 레이팅은 1320~3190 (Stockfish가 허락하는 범위)
//   생각 시간을 적지 않으면 우리 AI는 성격마다 정해진 시간(대가는 1초), Stockfish도 같은 시간
//   백·흑은 한 판씩 번갈아 맡음
//
// 계산: 점수 비율 s = (승 + 무승부/2) / 판 수
//       레이팅 차이 = 400 × log10(s / (1 − s))   (Elo 공식을 거꾸로 푼 것)
//       s = 0.5면 차이 0, s = 0.76이면 약 +200, s = 0.24면 약 −200

import { spawn } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import { initialGame, type Color } from './src/board';
import { gameStatus, legalMoves, makeMove, positionKey } from './src/moves';
import { chooseMove, moveToUci, TIME_LIMIT } from './src/ai';
import { PERSONALITIES } from './src/personality';

const [id = 'master', eloArg = '1500', gamesArg = '10', msArg] = process.argv.slice(2);
const p = PERSONALITIES.find(x => x.id === id);
if (!p) {
  console.log(`모르는 성격: ${id}. 가능한 값: ${PERSONALITIES.map(x => x.id).join(', ')}`);
  process.exit(1);
}
const SF_ELO = Number(eloArg);
if (!(SF_ELO >= 1320 && SF_ELO <= 3190)) {
  console.log('Stockfish 레이팅은 1320~3190 사이로 적어 주세요.');
  process.exit(1);
}
const GAMES = Number(gamesArg);
const ourMs = msArg ? Number(msArg) : (p.timeLimit ?? TIME_LIMIT);
const ai = msArg ? { ...p, timeLimit: ourMs } : p;
const sfMs = ourMs; // Stockfish도 같은 시간

// ---------- Stockfish 켜기 ----------
// .tools 폴더에 설치한 stockfish 패키지에서 엔진 파일 위치를 찾고, Node로 따로 실행해서 글자로 대화(UCI)
let enginePath: string;
try {
  const req = createRequire(path.resolve('.tools/package.json'));
  enginePath = req('stockfish').findEngine('lite-single');
} catch {
  console.log('Stockfish가 아직 없어요. 먼저 이 명령을 실행하세요:\n  npm install --prefix .tools stockfish@19.0.1');
  process.exit(1);
}
const engine = spawn(process.execPath, [enginePath], { stdio: ['pipe', 'pipe', 'inherit'] });

// 엔진이 보내는 줄을 하나씩 받아서, 기다리는 사람이 있으면 넘겨줌
let buffer = '';
let waiting: { pattern: RegExp; resolve: (line: string) => void } | null = null;
engine.stdout.on('data', (chunk: Buffer) => {
  buffer += chunk.toString();
  let nl: number;
  while ((nl = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (waiting && waiting.pattern.test(line)) { const w = waiting; waiting = null; w.resolve(line); }
  }
});
const send = (cmd: string) => engine.stdin.write(cmd + '\n');
const waitFor = (pattern: RegExp) => new Promise<string>(resolve => { waiting = { pattern, resolve }; });

async function startEngine() {
  send('uci');
  await waitFor(/^uciok/);
  send('setoption name UCI_LimitStrength value true'); // 일부러 약하게
  send(`setoption name UCI_Elo value ${SF_ELO}`);       // 이 레이팅 정도로
  send('isready');
  await waitFor(/^readyok/);
}

// 지금까지 둔 수를 알려 주고 Stockfish의 수를 받기
async function stockfishMove(ucis: string[]): Promise<string> {
  send('position startpos' + (ucis.length ? ' moves ' + ucis.join(' ') : ''));
  send(`go movetime ${sfMs}`);
  const line = await waitFor(/^bestmove/);
  return line.split(' ')[1];
}

// ---------- 한 판 ----------
// 결과: 'w' 승, 'b' 승, 'draw'
async function playGame(aiColor: Color): Promise<{ result: Color | 'draw'; reason: string; moves: number }> {
  send('ucinewgame');
  const game = initialGame();
  const history = [positionKey(game)];
  const ucis: string[] = [];
  while (true) {
    const status = gameStatus(game, history);
    if (status === 'checkmate') return { result: game.turn === 'w' ? 'b' : 'w', reason: '체크메이트', moves: ucis.length };
    if (status !== 'playing') return { result: 'draw', reason: status, moves: ucis.length };

    let move;
    if (game.turn === aiColor) {
      move = chooseMove(ai, game, history, ourMs, ucis);
    } else {
      const uci = await stockfishMove(ucis);
      move = legalMoves(game).find(m => moveToUci(m) === uci);
      if (!move) throw new Error(`Stockfish가 이상한 수를 보냄: ${uci}`);
    }
    makeMove(game, move);
    ucis.push(moveToUci(move));
    history.push(positionKey(game));
  }
}

const REASON: Record<string, string> = {
  stalemate: '스테일메이트', fifty: '50수', repetition: '3회 반복', material: '기물 부족',
};

// 점수 비율 → 레이팅 차이. 0이나 1이면 무한대가 되니까 반 판만큼 당겨서 계산
function eloDiff(score: number, games: number): number {
  const s = Math.min(Math.max(score, 0.5 / games), 1 - 0.5 / games);
  return 400 * Math.log10(s / (1 - s));
}

async function main() {
  await startEngine();
  console.log(`${p!.name} vs Stockfish(${SF_ELO}), ${GAMES}판, 생각 시간: 우리 ${ourMs}ms / Stockfish ${sfMs}ms\n`);
  let win = 0, loss = 0, draw = 0;
  for (let i = 0; i < GAMES; i++) {
    const aiColor: Color = i % 2 === 0 ? 'w' : 'b';
    const { result, reason, moves } = await playGame(aiColor);
    let text: string;
    if (result === 'draw') { draw++; text = `무승부 (${REASON[reason] ?? reason})`; }
    else if (result === aiColor) { win++; text = `${p!.name} 승`; }
    else { loss++; text = 'Stockfish 승'; }
    console.log(`${i + 1}판 (${p!.name} = ${aiColor === 'w' ? '백' : '흑'}): ${text}, ${Math.ceil(moves / 2)}수`);
  }

  const score = (win + draw / 2) / GAMES;
  const diff = eloDiff(score, GAMES);
  // 판 수가 적으면 운이 크게 작용함: 점수 비율의 표준오차로 대략적인 범위(약 95%)를 같이 보여 줌
  const se = Math.sqrt(Math.max(score * (1 - score), 0.1) / GAMES);
  const low = SF_ELO + eloDiff(score - 2 * se, GAMES);
  const high = SF_ELO + eloDiff(score + 2 * se, GAMES);
  console.log(`\n${p!.name} ${win}승 / ${loss}패 / 무승부 ${draw}  →  점수 비율 ${(score * 100).toFixed(0)}%`);
  console.log(`대략적인 레이팅: ${Math.round(SF_ELO + diff)}  (범위 약 ${Math.round(low)}~${Math.round(high)})`);
  if (win === 0 && draw === 0) console.log('전부 졌어요. 이 값보다 더 아래일 수 있어요 → Stockfish 레이팅을 낮춰서 다시 재 보세요.');
  if (loss === 0 && draw === 0) console.log('전부 이겼어요. 이 값보다 더 위일 수 있어요 → Stockfish 레이팅을 높여서 다시 재 보세요.');
  if (Math.abs(diff) > 300) console.log('차이가 커서 정확하지 않아요. 비슷하게 싸우는(점수 30~70%) Stockfish 레이팅으로 다시 재면 더 정확해요.');
  engine.kill();
}

main().catch(e => { console.error(e); engine.kill(); process.exit(1); });
