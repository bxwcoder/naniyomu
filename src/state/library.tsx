// お気に入り・読んだ本・おすすめへの反応の記録
// アプリのどの画面からでも使えるように、ここでまとめて管理します。
// ※フェーズ3では記録はアプリを開いている間だけ残ります（保存はフェーズ4で追加）。

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';

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

export interface LibraryState {
  /** お気に入りに登録した本のID（登録した順） */
  favorites: string[];
  /** 読んだ本のID（登録した順） */
  read: string[];
  /** 本ごとの反応 */
  reactions: Record<string, ReactionType[]>;
}

export const emptyLibrary: LibraryState = { favorites: [], read: [], reactions: {} };

type Action =
  | { type: 'toggleFavorite'; bookId: string }
  | { type: 'toggleReaction'; bookId: string; reaction: ReactionType }
  | { type: 'unmarkRead'; bookId: string };

const without = (list: string[], id: string) => list.filter((x) => x !== id);

export function libraryReducer(state: LibraryState, action: Action): LibraryState {
  switch (action.type) {
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
}

const LibraryContext = createContext<LibraryApi | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(libraryReducer, emptyLibrary);
  const api = useMemo<LibraryApi>(
    () => ({
      state,
      isFavorite: (id) => state.favorites.includes(id),
      isRead: (id) => state.read.includes(id),
      hasReaction: (id, r) => (state.reactions[id] ?? []).includes(r),
      toggleFavorite: (bookId) => dispatch({ type: 'toggleFavorite', bookId }),
      toggleReaction: (bookId, reaction) => dispatch({ type: 'toggleReaction', bookId, reaction }),
      unmarkRead: (bookId) => dispatch({ type: 'unmarkRead', bookId }),
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
