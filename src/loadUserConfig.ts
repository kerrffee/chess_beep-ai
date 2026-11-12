// ---------- characters.jsonc 불러오기 (화면과 AI 일꾼에서 맨 먼저 import) ----------
// 파일이 없어도 오류 없이 기본값으로 돌아가게 import.meta.glob으로 찾음 (없으면 빈 목록)
// npm run dev 중에 characters.jsonc를 저장하면 페이지가 저절로 새로고침돼서 바로 반영됨
import { applyCharacterConfig } from './characterConfig';

const files = import.meta.glob('../characters.jsonc', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const text = Object.values(files)[0];

// 화면 위에 보여 줄 안내 (문법 오류, 모르는 항목 등). 빈 목록이면 문제 없음
export const configMessages: string[] = text === undefined ? [] : applyCharacterConfig(text);
