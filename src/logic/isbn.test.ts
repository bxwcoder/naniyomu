import { describe, expect, it } from 'vitest';
import booksData from '../data/books.json';
import { isbn10To13, isValidIsbn10, isValidIsbn13, normalizeIsbn } from './isbn.ts';
import { validateBooks } from './validateBooks.ts';

describe('ISBN の確認', () => {
  it('正しい ISBN-13 を正しいと判定する（博士の愛した数式 新潮文庫）', () => {
    expect(isValidIsbn13('9784101215235')).toBe(true);
    expect(isValidIsbn13(normalizeIsbn('978-4-10-121523-5'))).toBe(true);
  });

  it('1けたの打ち間違いや、けた数の間違いを見つける', () => {
    expect(isValidIsbn13('9784101215236')).toBe(false); // 最後のけたが違う
    expect(isValidIsbn13('9784101125235')).toBe(false); // 数字の入れ替え
    expect(isValidIsbn13('978410121523')).toBe(false); // 12けた
    expect(isValidIsbn13('1234101215235')).toBe(false); // 978/979 で始まらない
  });

  it('古い10けたの番号を13けたに変換できる', () => {
    expect(isValidIsbn10('4062820641')).toBe(true);
    expect(isbn10To13('4062820641')).toBe('9784062820646');
    expect(isbn10To13('4-334-03291-5')).toBe('9784334032913');
    expect(isbn10To13('4062820642')).toBeNull();
  });

  it('本のデータの ISBN は、すべて正しい形式で重複がない（空欄は確認できていない本）', () => {
    const { errors } = validateBooks(booksData);
    expect(errors.filter((e) => e.includes('isbn'))).toEqual([]);
    const isbns = (booksData as { isbn: string | null }[]).map((b) => b.isbn).filter((x) => x !== null);
    expect(new Set(isbns).size).toBe(isbns.length);
  });

  it('間違った ISBN や重複した ISBN をデータの確認で見つける', () => {
    const [a, b] = validateBooks(booksData).validBooks;
    const result = validateBooks([
      { ...a, isbn: '9784101215236' },
      { ...b, isbn: a.isbn },
      { ...b, book_id: 'x', isbn: a.isbn },
    ]);
    expect(result.errors.some((e) => e.includes('正しくありません'))).toBe(true);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
  });
});
