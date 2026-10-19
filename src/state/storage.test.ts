import { describe, expect, it } from 'vitest';
import booksData from '../data/books.json';
import { recommend } from '../logic/recommend.ts';
import { validateBooks } from '../logic/validateBooks.ts';
import type { Answers } from '../types.ts';
import { emptyLibrary, excludedBookIds, libraryReducer } from './library.tsx';
import {
  loadLibrary,
  loadSessionRaw,
  parseLibrary,
  restoreSession,
  saveLibrary,
  saveSession,
  STORAGE_KEYS,
  toStoredSession,
  type KeyValueStore,
} from './storage.ts';

const { validBooks: books } = validateBooks(booksData);

/** テスト用の保存先（ブラウザの localStorage の代わり） */
function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const answers: Answers = { mood: 'absorbing', theme: 'world', difficulty: 'any', length: 'any', genre: 'any' };

describe('お気に入り・既読・反応の保存', () => {
  it('保存して読み込むと、同じ内容に戻る（再読み込みしても残る）', () => {
    const store = memoryStore();
    let state = emptyLibrary;
    state = libraryReducer(state, { type: 'toggleFavorite', bookId: 'kasha' });
    state = libraryReducer(state, { type: 'toggleReaction', bookId: 'sapiens', reaction: 'already_read' });
    state = libraryReducer(state, { type: 'toggleReaction', bookId: 'factfulness', reaction: 'not_for_me' });
    expect(saveLibrary(store, state)).toBe(true);
    expect(loadLibrary(store)).toEqual(state);
  });

  it('何も保存されていなければ、空の状態から始まる', () => {
    expect(loadLibrary(memoryStore())).toEqual(emptyLibrary);
  });

  it('保存先が使えない環境（null）でも止まらない', () => {
    expect(loadLibrary(null)).toEqual(emptyLibrary);
    expect(saveLibrary(null, emptyLibrary)).toBe(false);
  });

  it('壊れたデータが保存されていても、止まらずに使える部分だけ読む', () => {
    expect(loadLibrary(memoryStore({ [STORAGE_KEYS.library]: '{壊れた文字' }))).toEqual(emptyLibrary);
    expect(
      parseLibrary({ favorites: ['a', 1, 'a'], read: 'x', reactions: { b: ['interested', 'unknown'], c: 'bad' } }),
    ).toEqual({ favorites: [], read: [], reactions: { b: ['interested'] } });
    expect(parseLibrary({ favorites: ['a', 'a'] }).favorites).toEqual(['a']);
  });

  it('容量オーバーなどで保存に失敗しても、止まらない', () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveLibrary(full, emptyLibrary)).toBe(false);
  });
});

describe('既読と反応のつながり', () => {
  it('「読んだことがある」で既読になり、取り消すと既読から外れる', () => {
    let s = libraryReducer(emptyLibrary, { type: 'toggleReaction', bookId: 'x', reaction: 'already_read' });
    expect(s.read).toEqual(['x']);
    s = libraryReducer(s, { type: 'toggleReaction', bookId: 'x', reaction: 'already_read' });
    expect(s.read).toEqual([]);
  });

  it('既読を解除すると、既読系の反応も外れるが「面白そう」は残る', () => {
    let s = libraryReducer(emptyLibrary, { type: 'toggleReaction', bookId: 'x', reaction: 'interested' });
    s = libraryReducer(s, { type: 'toggleReaction', bookId: 'x', reaction: 'finished' });
    s = libraryReducer(s, { type: 'unmarkRead', bookId: 'x' });
    expect(s.read).toEqual([]);
    expect(s.reactions.x).toEqual(['interested']);
  });

  it('お気に入りはおすすめから外さず、既読と「好みと違う」だけを外す', () => {
    let s = libraryReducer(emptyLibrary, { type: 'toggleFavorite', bookId: 'fav' });
    s = libraryReducer(s, { type: 'toggleReaction', bookId: 'read', reaction: 'finished' });
    s = libraryReducer(s, { type: 'toggleReaction', bookId: 'no', reaction: 'not_for_me' });
    expect(excludedBookIds(s).sort()).toEqual(['no', 'read']);
  });
});

describe('前回の回答と結果の保存', () => {
  it('保存した結果を、同じ3冊・同じ理由で元に戻せる', () => {
    const store = memoryStore();
    const result = recommend(books, answers);
    saveSession(store, toStoredSession(answers, result));
    const restored = restoreSession(loadSessionRaw(store), books);
    expect(restored.answers).toEqual(answers);
    expect(restored.result?.status).toBe('ok');
    expect(restored.result?.recommendations.map((r) => r.book.book_id)).toEqual(
      result.recommendations.map((r) => r.book.book_id),
    );
    expect(restored.result?.recommendations[0].highlights).toEqual(result.recommendations[0].highlights);
  });

  it('保存していた本が登録から消えていたら、古い結果は使わない（回答は残す）', () => {
    const result = recommend(books, answers);
    const saved = toStoredSession(answers, result);
    const removedId = result.recommendations[0].book.book_id;
    const restored = restoreSession(saved, books.filter((b) => b.book_id !== removedId));
    expect(restored.result).toBeNull();
    expect(restored.answers).toEqual(answers);
  });

  it('途中まで答えた回答も保存でき、おかしな値は捨てる', () => {
    const restored = restoreSession({ answers: { mood: 'moving', theme: 'ほげ', genre: 'manga' }, result: null }, books);
    expect(restored.answers).toEqual({ mood: 'moving', genre: 'manga' });
    expect(restored.result).toBeNull();
  });

  it('条件が少なかったときの結果と案内も元に戻せる', () => {
    const few: Answers = { mood: 'relaxing', theme: 'imagination', difficulty: 'smooth', length: 'any', genre: 'manga' };
    const result = recommend(books, few);
    expect(result.status).toBe('insufficient');
    const restored = restoreSession(toStoredSession(few, result), books);
    expect(restored.result?.status).toBe('insufficient');
    if (restored.result?.status === 'insufficient' && result.status === 'insufficient') {
      expect(restored.result.suggestions).toEqual(result.suggestions);
    }
  });

  it('何も保存されていない・壊れている場合は、空から始める', () => {
    expect(restoreSession(null, books)).toEqual({ answers: {}, result: null });
    expect(restoreSession('壊れた', books)).toEqual({ answers: {}, result: null });
  });
});
