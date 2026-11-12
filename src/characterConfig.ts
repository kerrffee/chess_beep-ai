// ---------- 캐릭터 설정 파일 (맨 위 폴더의 characters.jsonc) ----------
// 수진이 고치는 파일은 characters.jsonc 하나. 이 파일은 그걸 읽어서 기본값(personality.ts, three/human.ts) 위에 덮어씀
//   - 파일에 적은 항목만 바뀌고, 안 적은 항목·캐릭터는 기본값 그대로
//   - 파일이 없거나 문법이 틀리면 기본값으로 하고, 화면 위에 빨간 안내를 띄움 (loadUserConfig.ts → main.ts)
// 이 파일은 three.js를 안 불러옴 (AI 일꾼에서도 쓰니까). 3D 설정은 값만 들고 있다가 human.ts가 가져감
import { PERSONALITIES, type Personality, type SpeechEvent } from './personality';
import type { PieceType } from './board';
import type { EvalWeights } from './ai';

// ── 3D 사람 캐릭터 (human.ts) ──
export const HUMAN_WHO = ['coward', 'greedy', 'bluffer', 'excuser', 'attacker', 'random', 'queenlover'] as const;
export type Who = typeof HUMAN_WHO[number];
// 상황: 평소 / 손 뻗기(수 둘 때) / 잡음 / 잡힘 / 체크당함 / 짐
export type Slot = 'idle' | 'reach' | 'gloat' | 'flinch' | 'check' | 'lost';
export interface HumanTuning {
  moves?: Partial<Record<Slot, Who | 'none'>>; // 상황마다 어느 캐릭터의 동작을 쓸지 ('none' = 반응 안 함)
  reachIn?: number;    // 손이 기물까지 가는 시간(ms)
  reachOut?: number;   // 돌아오는 시간(ms)
  gloatTime?: number;  // 잡았을 때 반응 길이(초). 기본 1.8
  flinchTime?: number; // 잡혔을 때 반응 길이(초). 기본 1.2
  strength?: number;   // 반응 세기 (1 = 원래대로, 0 = 반응 안 함)
  rimColor?: number;   // 등 뒤 윤곽 빛 색
}
const humanTuning: Partial<Record<Who, HumanTuning>> = {};
export function getHumanTuning(who: Who): HumanTuning { return humanTuning[who] ?? {}; }

// ── 파일 안 한국어 이름 ↔ 코드 이름 ──
const EVENT_KO: Record<string, SpeechEvent> = {
  '시작': 'start', '잡음': 'capture', '잡힘': 'lost', '체크': 'check', '형세좋아짐': 'good', '형세나빠짐': 'bad',
  '이기는중': 'winning', '지는중': 'losing', '승리': 'win', '패배': 'lose', '무승부': 'draw', '기권': 'resign',
};
const PIECE_KO: Record<string, PieceType> = { '폰': 'p', '나이트': 'n', '비숍': 'b', '룩': 'r', '퀸': 'q' };
const WEIGHT_KO: Record<string, keyof EvalWeights> = {
  '겹친폰': 'doubledPawn', '고립폰': 'isolatedPawn', '통과폰': 'passedPawn', '비숍쌍': 'bishopPair',
  '룩열린줄': 'rookOpenFile', '룩반열린줄': 'rookHalfOpen', '킹앞폰1': 'kingShield1', '킹앞폰2': 'kingShield2',
  '킹앞빈줄': 'kingOpenFile', '킹공격': 'kingAttack', '교환싫어함': 'tradeAversion',
};
const KIND_KO: Record<string, Personality['kind']> = { '생각': 'search', '욕심': 'greedy', '랜덤': 'random' };
const SLOT_KO: Record<string, Slot> = { '평소': 'idle', '손뻗기': 'reach', '잡음': 'gloat', '잡힘': 'flinch', '체크당함': 'check', '짐': 'lost' };
// 동작을 빌려 올 캐릭터: 원래 이름(겁쟁이 …)이나 id(coward …) 둘 다 됨
const WHO_KO: Record<string, Who> = {
  '겁쟁이': 'coward', '욕심쟁이': 'greedy', '허세꾼': 'bluffer', '핑계왕': 'excuser',
  '돌격대장': 'attacker', '랜덤': 'random', '퀸사랑꾼': 'queenlover', '퀸 사랑꾼': 'queenlover',
};

// ── 주석(//, /* */)과 끝에 남은 쉼표를 지우고 JSON으로 읽기 ──
// 지운 자리는 공백으로 채워서 글자 위치(→ 줄 번호)가 그대로임
function stripJsonc(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === '"') { // 문자열은 그대로 (안의 // 도)
      let j = i + 1;
      while (j < text.length && text[j] !== '"' && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') { out += ' '; i++; }
    } else if (c === '/' && n === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      for (; i < stop; i++) out += text[i] === '\n' ? '\n' : ' ';
    } else { out += c; i++; }
  }
  // 닫는 괄호 앞 쉼표: [1, 2,] → [1, 2 ]
  return out.replace(/,(\s*[\]}])/g, ' $1');
}
const lineOf = (text: string, pos: number) => text.slice(0, pos).split('\n').length;

export function parseJsonc(text: string): { data?: unknown; error?: string } {
  const clean = stripJsonc(text.replace(/^﻿/, ''));
  try {
    return { data: JSON.parse(clean) };
  } catch (e) {
    const msg = String((e as Error).message);
    const m = msg.match(/line (\d+)/) ?? null;
    const p = msg.match(/position (\d+)/);
    const line = m ? Number(m[1]) : p ? lineOf(clean, Number(p[1])) : null;
    return { error: `문법 오류${line ? ` (${line}번째 줄 근처)` : ''}: 쉼표, 따옴표("), 괄호를 확인해 주세요` };
  }
}

// ── 값 검사 도우미 ──
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

// characters.jsonc 내용(글자)을 읽어서 적용. 안내 메시지 목록을 돌려줌 (빈 목록 = 문제 없음)
// 같은 페이지에서 두 번 부르지 않는다고 가정 (덮어쓴 값 위에 다시 덮어씀)
export function applyCharacterConfig(text: string): string[] {
  const msgs: string[] = [];
  const parsed = parseJsonc(text);
  if (parsed.error) return [`characters.jsonc ${parsed.error}. 지금은 기본 설정으로 해요.`];
  if (!isObj(parsed.data)) return ['characters.jsonc: 맨 바깥은 { } 이어야 해요. 지금은 기본 설정으로 해요.'];

  for (const [id, raw] of Object.entries(parsed.data)) {
    const p = PERSONALITIES.find(x => x.id === id);
    if (!p) { msgs.push(`모르는 캐릭터 "${id}" (쓸 수 있는 것: ${PERSONALITIES.map(x => x.id).join(', ')})`); continue; }
    if (!isObj(raw)) { msgs.push(`${p.name}: { } 로 묶어 주세요`); continue; }
    const where = (k: string) => `${p.name} › ${k}`;
    const num = (k: string, v: unknown, min: number, max: number): number | undefined => {
      if (typeof v === 'number' && v >= min && v <= max) return v;
      msgs.push(`${where(k)}: ${min}~${max} 사이 숫자여야 해요 (지금 ${JSON.stringify(v)}) → 기본값 사용`);
      return undefined;
    };
    for (const [key, v] of Object.entries(raw)) {
      if (key === '이름') { if (typeof v === 'string' && v.trim()) p.name = v; else msgs.push(`${where(key)}: 글자로 적어 주세요`); }
      else if (key === '설명') { if (typeof v === 'string') p.description = v; else msgs.push(`${where(key)}: 글자로 적어 주세요`); }
      else if (key === '대사') applyLines(p, v, where, msgs);
      else if (key === '말할확률') applyChance(p, v, where, num, msgs);
      else if (key === '수두기') applyPlay(p, v, where, num, msgs);
      else if (key === '3D') applyHuman(p, v, where, num, msgs);
      else msgs.push(`${where(key)}: 모르는 항목이에요 (이름·설명·대사·말할확률·수두기·3D 중 하나)`);
    }
  }
  return msgs;
}

type Where = (k: string) => string;
type Num = (k: string, v: unknown, min: number, max: number) => number | undefined;

function applyLines(p: Personality, v: unknown, where: Where, msgs: string[]) {
  if (!isObj(v)) { msgs.push(`${where('대사')}: { "상황": ["대사", …] } 모양이어야 해요`); return; }
  const lines = { ...(p.lines ?? {}) };
  for (const [k, list] of Object.entries(v)) {
    const ev = EVENT_KO[k];
    if (!ev) { msgs.push(`${where('대사 › ' + k)}: 모르는 상황 (${Object.keys(EVENT_KO).join('·')})`); continue; }
    if (!Array.isArray(list) || !list.every(s => typeof s === 'string')) { msgs.push(`${where('대사 › ' + k)}: ["대사1", "대사2"] 처럼 적어 주세요`); continue; }
    lines[ev] = list.filter(s => s.trim() !== '');
  }
  p.lines = lines;
}

function applyChance(p: Personality, v: unknown, where: Where, num: Num, msgs: string[]) {
  if (!isObj(v)) { msgs.push(`${where('말할확률')}: { "상황": 0.5 } 모양이어야 해요`); return; }
  const chance = { ...(p.speakChance ?? {}) };
  for (const [k, x] of Object.entries(v)) {
    const ev = EVENT_KO[k];
    if (!ev) { msgs.push(`${where('말할확률 › ' + k)}: 모르는 상황`); continue; }
    const n = num('말할확률 › ' + k, x, 0, 1);
    if (n !== undefined) chance[ev] = n;
  }
  p.speakChance = chance;
}

function applyPlay(p: Personality, v: unknown, where: Where, num: Num, msgs: string[]) {
  if (!isObj(v)) { msgs.push(`${where('수두기')}: { } 로 묶어 주세요`); return; }
  for (const [k, x] of Object.entries(v)) {
    const w = '수두기 › ' + k;
    if (k === '방식') {
      const kind = typeof x === 'string' ? KIND_KO[x] : undefined;
      if (kind) p.kind = kind; else msgs.push(`${where(w)}: "생각", "욕심", "랜덤" 중 하나`);
    } else if (k === '생각시간') {
      if (x === null) delete p.timeLimit;
      else { const n = num(w, x, 50, 30000); if (n !== undefined) p.timeLimit = n; }
    } else if (k === '실수확률') { const n = num(w, x, 0, 1); if (n !== undefined) p.mistakeChance = n; }
    else if (k === '실수폭') { const n = num(w, x, 0, 2000); if (n !== undefined) p.mistakeMargin = n; }
    else if (k === '기권점수') {
      if (x === null) delete p.resignAt;
      else { const n = num(w, x, -100000, 0); if (n !== undefined) p.resignAt = n; }
    } else if (k === '퀸잃으면기권') {
      if (typeof x === 'boolean') p.resignOnQueenLoss = x; else msgs.push(`${where(w)}: true 또는 false`);
    } else if (k === '기물값') {
      if (!isObj(x)) { msgs.push(`${where(w)}: { "퀸": 900 } 모양`); continue; }
      const values = { ...(p.values ?? {}) };
      for (const [pk, pv] of Object.entries(x)) {
        const t = PIECE_KO[pk];
        if (!t) { msgs.push(`${where(w + ' › ' + pk)}: 모르는 기물 (폰·나이트·비숍·룩·퀸)`); continue; }
        const n = num(w + ' › ' + pk, pv, 0, 100000);
        if (n !== undefined) values[t] = n;
      }
      p.values = values;
    } else if (k === '가중치') {
      if (!isObj(x)) { msgs.push(`${where(w)}: { "킹공격": 35 } 모양`); continue; }
      const weights: Partial<EvalWeights> = { ...(p.weights ?? {}) };
      for (const [wk, wv] of Object.entries(x)) {
        const key = WEIGHT_KO[wk];
        if (!key) { msgs.push(`${where(w + ' › ' + wk)}: 모르는 항목 (${Object.keys(WEIGHT_KO).join('·')})`); continue; }
        if (key === 'passedPawn') {
          if (Array.isArray(wv) && wv.length === 8 && wv.every(n => typeof n === 'number')) weights.passedPawn = wv as number[];
          else msgs.push(`${where(w + ' › ' + wk)}: 숫자 8개 목록이어야 해요`);
          continue;
        }
        const n = num(w + ' › ' + wk, wv, -1000, 1000);
        if (n !== undefined) (weights as Record<string, unknown>)[key] = n;
      }
      p.weights = weights;
    } else if (k === '오프닝') {
      const ok = Array.isArray(x) && x.every(line => Array.isArray(line) && line.every(m => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)));
      if (ok) p.openings = x as string[][];
      else msgs.push(`${where(w)}: [["e2e4", "e7e5"], …] 처럼, 수는 출발칸+도착칸 4글자로 적어 주세요`);
    } else msgs.push(`${where(w)}: 모르는 항목이에요`);
  }
}

function applyHuman(p: Personality, v: unknown, where: Where, num: Num, msgs: string[]) {
  if (!HUMAN_WHO.includes(p.id as Who)) { msgs.push(`${where('3D')}: 이 캐릭터는 3D 동작을 아직 바꿀 수 없어요 (사람 모델 캐릭터만)`); return; }
  if (!isObj(v)) { msgs.push(`${where('3D')}: { } 로 묶어 주세요`); return; }
  const t: HumanTuning = { ...(humanTuning[p.id as Who] ?? {}) };
  const moves = { ...(t.moves ?? {}) };
  for (const [k, x] of Object.entries(v)) {
    const w = '3D › ' + k;
    if (k === '동작') {
      if (!isObj(x)) { msgs.push(`${where(w)}: { "잡음": "허세꾼" } 모양`); continue; }
      for (const [sk, sv] of Object.entries(x)) {
        const slot = SLOT_KO[sk];
        if (!slot) { msgs.push(`${where(w + ' › ' + sk)}: 모르는 상황 (${Object.keys(SLOT_KO).join('·')})`); continue; }
        const name = typeof sv === 'string' ? sv.trim() : '';
        const who = WHO_KO[name] ?? (HUMAN_WHO.includes(name as Who) ? name as Who : undefined);
        if (who) moves[slot] = who;
        else if (name === '없음' && slot !== 'idle' && slot !== 'reach') moves[slot] = 'none';
        else msgs.push(`${where(w + ' › ' + sk)}: "${name}"은(는) 쓸 수 없어요 (${Object.keys(WHO_KO).filter(n => n !== '퀸 사랑꾼').join('·')}${slot === 'idle' || slot === 'reach' ? '' : '·없음'})`);
      }
    } else if (k === '손뻗는시간') { const n = num(w, x, 50, 5000); if (n !== undefined) t.reachIn = n; }
    else if (k === '손거두는시간') { const n = num(w, x, 50, 5000); if (n !== undefined) t.reachOut = n; }
    else if (k === '잡음반응길이') { const n = num(w, x, 0.2, 10); if (n !== undefined) t.gloatTime = n; }
    else if (k === '잡힘반응길이') { const n = num(w, x, 0.2, 10); if (n !== undefined) t.flinchTime = n; }
    else if (k === '반응세기') { const n = num(w, x, 0, 1.5); if (n !== undefined) t.strength = n; }
    else if (k === '윤곽빛색') {
      if (typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x)) t.rimColor = parseInt(x.slice(1), 16);
      else msgs.push(`${where(w)}: "#a8b8d8" 처럼 # 뒤에 6글자`);
    } else msgs.push(`${where(w)}: 모르는 항목이에요`);
  }
  t.moves = moves;
  humanTuning[p.id as Who] = t;
}
