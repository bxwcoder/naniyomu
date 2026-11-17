import { describe, expect, it } from 'vitest';
import type { Book } from '../types.ts';
import { isbn13To10, purchaseLinks } from './affiliate.ts';

const book = { isbn: '9784101215235' } as Book; // 博士の愛した数式（新潮文庫）

describe('購入リンク（アフィリエイト）', () => {
  it('13けたの ISBN を10けたに変換できる', () => {
    expect(isbn13To10('9784101215235')).toBe('4101215235');
    expect(isbn13To10('9784062762397')).toBe('4062762390');
    expect(isbn13To10('9791234567896')).toBeNull(); // 979 で始まる番号は10けたにできない
  });

  it('ID が空なら、リンクを出さない', () => {
    expect(purchaseLinks(book, { amazonTag: '', rakutenId: '' })).toEqual([]);
    expect(purchaseLinks(book, { amazonTag: '  ', rakutenId: '' })).toEqual([]);
  });

  it('ID を入れたサービスだけリンクを出す', () => {
    const amazonOnly = purchaseLinks(book, { amazonTag: 'test-22', rakutenId: '' });
    expect(amazonOnly).toHaveLength(1);
    expect(amazonOnly[0].url).toBe('https://www.amazon.co.jp/dp/4101215235?tag=test-22');

    const both = purchaseLinks(book, { amazonTag: 'test-22', rakutenId: 'abc.def' });
    expect(both.map((l) => l.service)).toEqual(['amazon', 'rakuten']);
    expect(both[1].url).toContain('https://hb.afl.rakuten.co.jp/hgc/abc.def/?pc=');
    expect(decodeURIComponent(both[1].url)).toContain('9784101215235');
  });

  it('ISBN のない本や、正しくない ISBN の本にはリンクを出さない', () => {
    const config = { amazonTag: 'test-22', rakutenId: 'abc.def' };
    expect(purchaseLinks({ isbn: null } as Book, config)).toEqual([]);
    expect(purchaseLinks({ isbn: '9784101215236' } as Book, config)).toEqual([]);
  });
});
