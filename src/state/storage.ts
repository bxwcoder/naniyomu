// ブラウザへの保存（ローカルストレージ）
// お気に入り・既読・反応・前回の回答と結果を、この端末のこのブラウザの中に保存します。
// - 保存できない環境（プライベートモードなど）でも、アプリは止まらずに動きます。
// - 保存された内容が壊れていた場合は、使える部分だけを読み込みます。
// - 将来クラウド保存に移すときは、このファイルの中身を差し替えます。

import { MOODS, THEMES, NO_THEME, DIFFICULTY_CHOICES, LENGTH_CHOICES, GENRE_CHOICES } from '../data/options.ts';
import type { Answers, Book, Recommendation, RecommendResult, RecommendationRole, RelaxSuggestion } from '../types.ts';
import { emptyLibrary, type LibraryState, type ReactionType } from './library.tsx';

/** 保存に使う名前。データの形を変えたときは、末尾の数字を上げる */
export const STORAGE_KEYS = {
  library: 'naniyomu.library.v1',
  session: 'naniyomu.session.v1',
} as const;

/** localStorage と同じ使い方ができるもの（テストでは偽物を渡す） */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** 使える保存先を返す。使えない環境では null */
export function browserStore(): KeyValueStore | null {
  try {
    const s = window.localStorage;
    const probe = 'naniyomu.probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function readJson(store: KeyValueStore | null, key: string): unknown {
  if (!store) return null;
  try {
    const text = store.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function writeJson(store: KeyValueStore | null, key: string, value: unknown): boolean {
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // 容量オーバーなど。保存できなくてもアプリは続ける
    return false;
  }
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const REACTIONS: ReactionType[] = ['interested', 'not_for_me', 'already_read', 'finished'];

// ---- お気に入り・既読・反応 ----

export function parseLibrary(raw: unknown): LibraryState {
  if (typeof raw !== 'object' || raw === null) return emptyLibrary;
  const r = raw as Record<string, unknown>;
  const reactions: Record<string, ReactionType[]> = {};
  if (typeof r.reactions === 'object' && r.reactions !== null) {
    for (const [id, list] of Object.entries(r.reactions as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        const valid = list.filter((x): x is ReactionType => REACTIONS.includes(x as ReactionType));
        if (valid.length > 0) reactions[id] = [...new Set(valid)];
      }
    }
  }
  return {
    favorites: isStringArray(r.favorites) ? [...new Set(r.favorites)] : [],
    read: isStringArray(r.read) ? [...new Set(r.read)] : [],
    reactions,
  };
}

export function loadLibrary(store: KeyValueStore | null): LibraryState {
  return parseLibrary(readJson(store, STORAGE_KEYS.library));
}

export function saveLibrary(store: KeyValueStore | null, state: LibraryState): boolean {
  return writeJson(store, STORAGE_KEYS.library, state);
}

// ---- 前回の回答とおすすめ結果 ----
// 本の情報そのものは保存せず、book_id だけを保存する（本のデータが更新されても古い情報を出さないため）

interface StoredRecommendation {
  book_id: string;
  role: RecommendationRole;
  score: number;
  reasons: string[];
  highlights: string[];
}

export interface StoredSession {
  answers: Partial<Answers>;
  result: {
    status: RecommendResult['status'];
    recommendations: StoredRecommendation[];
    suggestions: RelaxSuggestion[];
  } | null;
}

function parseAnswers(raw: unknown): Partial<Answers> {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<Answers> = {};
  const ok = (v: unknown, allowed: readonly string[]) => typeof v === 'string' && allowed.includes(v);
  if (ok(r.mood, Object.keys(MOODS))) out.mood = r.mood as Answers['mood'];
  if (ok(r.theme, [...Object.keys(THEMES), NO_THEME])) out.theme = r.theme as Answers['theme'];
  if (ok(r.difficulty, Object.keys(DIFFICULTY_CHOICES))) out.difficulty = r.difficulty as Answers['difficulty'];
  if (ok(r.length, Object.keys(LENGTH_CHOICES))) out.length = r.length as Answers['length'];
  if (ok(r.genre, Object.keys(GENRE_CHOICES))) out.genre = r.genre as Answers['genre'];
  return out;
}

export function toStoredSession(answers: Partial<Answers>, result: RecommendResult | null): StoredSession {
  return {
    answers,
    result: result && {
      status: result.status,
      recommendations: result.recommendations.map((r) => ({
        book_id: r.book.book_id,
        role: r.role,
        score: r.score,
        reasons: r.reasons,
        highlights: r.highlights,
      })),
      suggestions: result.status === 'insufficient' ? result.suggestions : [],
    },
  };
}

/** 保存しておいた結果を、今の本のデータと組み合わせて元に戻す。本が見つからなければ結果は捨てる */
export function restoreSession(raw: unknown, books: Book[]): { answers: Partial<Answers>; result: RecommendResult | null } {
  if (typeof raw !== 'object' || raw === null) return { answers: {}, result: null };
  const r = raw as Record<string, unknown>;
  const answers = parseAnswers(r.answers);
  const stored = r.result as StoredSession['result'];
  if (!stored || !Array.isArray(stored.recommendations)) return { answers, result: null };

  const ROLES: RecommendationRole[] = ['best', 'nearby', 'discovery'];
  const recommendations: Recommendation[] = [];
  for (const s of stored.recommendations) {
    const book = books.find((b) => b.book_id === s?.book_id);
    if (!book || !ROLES.includes(s.role) || !isStringArray(s.reasons) || !isStringArray(s.highlights)) {
      return { answers, result: null };
    }
    recommendations.push({ book, role: s.role, score: Number(s.score) || 0, reasons: s.reasons, highlights: s.highlights });
  }
  if (stored.status === 'ok' && recommendations.length === 3) {
    return { answers, result: { status: 'ok', recommendations, favoriteMatches: [] } };
  }
  if (stored.status === 'insufficient') {
    const suggestions = Array.isArray(stored.suggestions)
      ? stored.suggestions.filter(
          (s) =>
            (s?.question === 'genre' || s?.question === 'difficulty') &&
            typeof s.message === 'string' &&
            typeof s.availableCount === 'number',
        )
      : [];
    return { answers, result: { status: 'insufficient', recommendations, favoriteMatches: [], suggestions } };
  }
  return { answers, result: null };
}

export function loadSessionRaw(store: KeyValueStore | null): unknown {
  return readJson(store, STORAGE_KEYS.session);
}

export function saveSession(store: KeyValueStore | null, session: StoredSession): boolean {
  return writeJson(store, STORAGE_KEYS.session, session);
}
