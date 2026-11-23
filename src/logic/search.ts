// 本をタイトル・著者で探す
// ひらがな・カタカナ、全角・半角、大文字・小文字、空白や記号の違いは気にせず探せるようにします。
// 例：「はかせ」で『博士の愛した数式』は見つかりません（漢字の読みのデータがないため）が、
//     「ハリー」「はりー」「ﾊﾘｰ」はどれも『ハリー・ポッター』に合います。

import type { Book } from '../types.ts';

/** 比べやすい形にそろえる（全角→半角、カタカナ→ひらがな、小文字、空白・記号を取る） */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s・･,，、。.．:：;；!！?？'"“”‘’「」『』()（）[\]【】〈〉《》\-‐－―ー〜~／/]/g, '');
}

export interface SearchIndexEntry {
  book: Book;
  title: string;
  author: string;
}

/** 毎回そろえ直さなくていいように、先に全部の本をそろえておく */
export function buildSearchIndex(books: Book[]): SearchIndexEntry[] {
  return books.map((book) => ({ book, title: normalizeForSearch(book.title), author: normalizeForSearch(book.author) }));
}

/**
 * 探す。空白で区切った言葉が、すべてタイトルか著者に入っている本を返す。
 * 並び順：タイトルが言葉で始まる本 → タイトルに入っている本 → 著者だけ合う本。同じならタイトルが短い順
 */
export function searchBooks(index: SearchIndexEntry[], query: string): Book[] {
  const words = query
    .split(/[\s　]+/)
    .map(normalizeForSearch)
    .filter(Boolean);
  if (words.length === 0) return [];
  const rank = (e: SearchIndexEntry) => {
    const first = words[0];
    if (e.title.startsWith(first)) return 0;
    if (e.title.includes(first)) return 1;
    return 2;
  };
  return index
    .filter((e) => words.every((w) => e.title.includes(w) || e.author.includes(w)))
    .sort((a, b) => rank(a) - rank(b) || a.title.length - b.title.length)
    .map((e) => e.book);
}
