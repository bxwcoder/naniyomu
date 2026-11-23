import { describe, expect, it } from 'vitest';
import type { Book } from '../types.ts';
import { buildSearchIndex, normalizeForSearch, searchBooks } from './search.ts';

const book = (title: string, author: string) => ({ book_id: title, title, author }) as Book;
const books = [
  book('ハリー・ポッターと賢者の石', 'J・K・ローリング'),
  book('博士の愛した数式', '小川洋子'),
  book('夜のピクニック', '恩田陸'),
  book('ハリネズミの願い', 'トーン・テレヘン'),
  book('蜜蜂と遠雷', '恩田陸'),
];
const index = buildSearchIndex(books);
const titles = (q: string) => searchBooks(index, q).map((b) => b.title);

describe('本を名前で探す', () => {
  it('ひらがな・カタカナ・半角・空白や記号の違いを気にしない', () => {
    expect(normalizeForSearch('ハリー・ポッター')).toBe(normalizeForSearch('はりー ぽったー'));
    expect(normalizeForSearch('ﾊﾘｰ')).toBe(normalizeForSearch('ハリー'));
    expect(titles('はりーぽった')).toEqual(['ハリー・ポッターと賢者の石']);
  });

  it('著者名でも探せて、空白で区切るとすべての言葉に合う本だけ出す', () => {
    expect(titles('恩田陸')).toEqual(['蜜蜂と遠雷', '夜のピクニック']);
    expect(titles('恩田 ピクニック')).toEqual(['夜のピクニック']);
  });

  it('タイトルが言葉で始まる本を先に出す', () => {
    expect(titles('ハリ')).toEqual(['ハリネズミの願い', 'ハリー・ポッターと賢者の石']);
    expect(titles('数式')).toEqual(['博士の愛した数式']);
  });

  it('何も入れていなければ何も出さない', () => {
    expect(titles('')).toEqual([]);
    expect(titles('  ・ ')).toEqual([]);
  });
});
