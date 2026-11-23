// お気に入り・読んだ本・おすすめへの反応の記録
// アプリのどの画面からでも使えるように、ここでまとめて管理します。
// 記録は storage.ts を使って、この端末のブラウザに保存します。

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { browserStore, loadLibrary, parseLibrary, saveLibrary, STORAGE_KEYS } from './storage.ts';

/** おすすめへの反応の種類 */
export type ReactionType = 'interested' | 'not_for_me' | 'already_read' | 'finished';

export const REACTION_LABELS: Record<ReactionType, string> = {
  interested: '面白そう',
  not_for_me: '好みと違う',
  already_read: '読んだことがある',
  finished: '実際に読んだ',
};

/** 「読んだ本」として扱う反応 */
const READ_REACTIONS: ReactionType[] = ['already_read', 'finished'];

/** 一覧から外した本の記録（「前にお気に入りに入れたの何だっけ？」とならないように残す） */
export interface HistoryEntry {
  bookId: string;
  /** どの一覧から外したか */
  from: 'favorites' | 'read';
  /** 外した日時（ミリ秒） */
  at: number;
}

export interface LibraryState {
  /** お気に入りに登録した本のID（登録した順） */
  favorites: string[];
  /** 読んだ本のID（登録した順） */
  read: string[];
  /** 本ごとの反応 */
  reactions: Record<string, ReactionType[]>;
  /** お気に入り・読んだ本から外した本（新しい順） */
  history: HistoryEntry[];
}

export const emptyLibrary: LibraryState = { favorites: [], read: [], reactions: {}, history: [] };

/** 履歴に残す件数の上限（古いものから消える） */
export const HISTORY_LIMIT = 300;

type Action =
  | { type: 'replace'; state: LibraryState }
  | { type: 'toggleFavorite'; bookId: string }
  | { type: 'toggleReaction'; bookId: string; reaction: ReactionType }
  | { type: 'unmarkRead'; bookId: string }
  | { type: 'markRead'; bookId: string }
  | { type: 'removeHistory'; bookId: string; from: HistoryEntry['from'] }
  | { type: 'clearHistory' };

const without = (list: string[], id: string) => list.filter((x) => x !== id);

/**
 * 一覧の変化から履歴を更新する。外した本は履歴に入れ、また入れた本は履歴から消す。
 * （どの操作で外れても同じように記録されるよう、操作の前後を比べて決める）
 */
export function updateHistory(before: LibraryState, after: LibraryState, now: number): HistoryEntry[] {
  let history = after.history;
  for (const from of ['favorites', 'read'] as const) {
    const removed = before[from].filter((id) => !after[from].includes(id));
    const added = after[from].filter((id) => !before[from].includes(id));
    if (added.length > 0) history = history.filter((h) => !(h.from === from && added.includes(h.bookId)));
    if (removed.length > 0) {
      history = [
        ...removed.map((bookId) => ({ bookId, from, at: now })),
        ...history.filter((h) => !(h.from === from && removed.includes(h.bookId))),
      ];
    }
  }
  return history === after.history ? history : history.slice(0, HISTORY_LIMIT);
}

export function libraryReducer(state: LibraryState, action: Action): LibraryState {
  const next = applyAction(state, action);
  // 別のタブからの読み込み（replace）は、そのまま使う
  if (action.type === 'replace' || next === state) return next;
  const history = updateHistory(state, next, Date.now());
  return history === next.history ? next : { ...next, history };
}

function applyAction(state: LibraryState, action: Action): LibraryState {
  switch (action.type) {
    case 'replace':
      return action.state;
    case 'toggleFavorite': {
      const has = state.favorites.includes(action.bookId);
      return {
        ...state,
        favorites: has ? without(state.favorites, action.bookId) : [...state.favorites, action.bookId],
      };
    }
    case 'toggleReaction': {
      const current = state.reactions[action.bookId] ?? [];
      const turningOn = !current.includes(action.reaction);
      const nextReactions = turningOn
        ? [...current, action.reaction]
        : current.filter((r) => r !== action.reaction);

      // 「読んだことがある」「実際に読んだ」は、読んだ本の一覧とつながっている
      let read = state.read;
      const isReadNow = nextReactions.some((r) => READ_REACTIONS.includes(r));
      if (isReadNow && !read.includes(action.bookId)) read = [...read, action.bookId];
      if (!isReadNow && READ_REACTIONS.includes(action.reaction)) read = without(read, action.bookId);

      return { ...state, read, reactions: { ...state.reactions, [action.bookId]: nextReactions } };
    }
    case 'markRead': {
      if (state.read.includes(action.bookId)) return state;
      const current = state.reactions[action.bookId] ?? [];
      return {
        ...state,
        read: [...state.read, action.bookId],
        reactions: { ...state.reactions, [action.bookId]: [...new Set([...current, 'already_read' as const])] },
      };
    }
    case 'removeHistory':
      return {
        ...state,
        history: state.history.filter((h) => !(h.bookId === action.bookId && h.from === action.from)),
      };
    case 'clearHistory':
      return { ...state, history: [] };
    case 'unmarkRead': {
      const current = state.reactions[action.bookId] ?? [];
      return {
        ...state,
        read: without(state.read, action.bookId),
        reactions: {
          ...state.reactions,
          [action.bookId]: current.filter((r) => !READ_REACTIONS.includes(r)),
        },
      };
    }
  }
}

/**
 * おすすめから外す本：読んだ本と「好みと違う」を押した本。
 * 「好みと違う」はその1冊だけを外し、同じジャンル全体を苦手とは判断しない。
 * お気に入りの本は外さない。
 */
export function excludedBookIds(state: LibraryState): string[] {
  const disliked = Object.entries(state.reactions)
    .filter(([, rs]) => rs.includes('not_for_me'))
    .map(([id]) => id);
  return [...new Set([...state.read, ...disliked])];
}

interface LibraryApi {
  state: LibraryState;
  isFavorite: (bookId: string) => boolean;
  isRead: (bookId: string) => boolean;
  hasReaction: (bookId: string, reaction: ReactionType) => boolean;
  toggleFavorite: (bookId: string) => void;
  toggleReaction: (bookId: string, reaction: ReactionType) => void;
  unmarkRead: (bookId: string) => void;
  markRead: (bookId: string) => void;
  removeHistory: (bookId: string, from: HistoryEntry['from']) => void;
  clearHistory: () => void;
}

const LibraryContext = createContext<LibraryApi | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const store = useRef(browserStore()).current;
  // 起動時に、保存しておいた記録を読み込む
  const [state, dispatch] = useReducer(libraryReducer, undefined, () => loadLibrary(store));

  // 記録が変わるたびに保存する
  useEffect(() => {
    saveLibrary(store, state);
  }, [store, state]);

  // 同じ端末の別のタブで記録が変わったときも、こちらに反映する
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEYS.library || e.newValue === null) return;
      try {
        dispatch({ type: 'replace', state: parseLibrary(JSON.parse(e.newValue)) });
      } catch {
        // 壊れた内容は無視する
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const api = useMemo<LibraryApi>(
    () => ({
      state,
      isFavorite: (id) => state.favorites.includes(id),
      isRead: (id) => state.read.includes(id),
      hasReaction: (id, r) => (state.reactions[id] ?? []).includes(r),
      toggleFavorite: (bookId) => dispatch({ type: 'toggleFavorite', bookId }),
      toggleReaction: (bookId, reaction) => dispatch({ type: 'toggleReaction', bookId, reaction }),
      unmarkRead: (bookId) => dispatch({ type: 'unmarkRead', bookId }),
      markRead: (bookId) => dispatch({ type: 'markRead', bookId }),
      removeHistory: (bookId, from) => dispatch({ type: 'removeHistory', bookId, from }),
      clearHistory: () => dispatch({ type: 'clearHistory' }),
    }),
    [state],
  );
  return <LibraryContext.Provider value={api}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryApi {
  const api = useContext(LibraryContext);
  if (!api) throw new Error('useLibrary は LibraryProvider の中で使ってください');
  return api;
}
