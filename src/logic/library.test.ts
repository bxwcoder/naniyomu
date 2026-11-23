import { describe, expect, it } from 'vitest';
import { calilUrl } from './library.ts';

describe('図書館で探すリンク（カーリル）', () => {
  it('ISBN のある本は、ISBN でその本のページを開く', () => {
    expect(calilUrl({ isbn: '9784101215235', title: '博士の愛した数式', author: '小川洋子' })).toBe(
      'https://api.calil.jp/openurl?rft.isbn=9784101215235',
    );
  });

  it('ISBN のない本は、タイトルと著者で検索する', () => {
    const url = calilUrl({ isbn: null, title: 'ゆるキャン△', author: 'あfろ' });
    expect(url.startsWith('https://api.calil.jp/openurl?rft.btitle=')).toBe(true);
    expect(decodeURIComponent(url)).toContain('ゆるキャン△');
    expect(decodeURIComponent(url)).toContain('あfろ');
  });
});
