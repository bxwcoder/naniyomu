import { describe, expect, it } from 'vitest';
import {
  calilBookUrl,
  calilLibraryUrl,
  checkAvailability,
  groupLibraries,
  summarize,
  type CheckResults,
} from './calil.ts';

/** カーリルの応答の代わりに、決めた応答を順番に返す偽物の fetch */
function fakeFetch(responses: unknown[]) {
  const urls: string[] = [];
  const fetcher = (async (url: string) => {
    urls.push(url);
    const body = responses.shift();
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { fetcher, urls };
}

describe('カーリルの貸出状況のまとめ方', () => {
  it('1館でも貸出可があれば「貸出可」。その図書館の名前と、ほかの館の数を出す', () => {
    const s = summarize({ status: 'OK', reserveurl: 'https://lib.example/1', libkey: { 中央: '貸出中', 駅前: '貸出可', 北: '館内のみ' } });
    expect(s).toMatchObject({ kind: 'available', label: '貸出可', libraries: ['駅前'], others: 2, reserveurl: 'https://lib.example/1' });
  });

  it('貸出中しかなければ「貸出中」', () => {
    expect(summarize({ status: 'Cache', libkey: { 中央: '貸出中' } })).toMatchObject({ kind: 'busy', label: '貸出中' });
  });

  it('図書館がひとつもなければ「蔵書なし」', () => {
    expect(summarize({ status: 'OK', libkey: {} }).label).toBe('蔵書なし');
    expect(summarize({ status: 'OK' }).kind).toBe('none');
  });

  it('調べ中・エラー・図書館独自の値も扱える', () => {
    expect(summarize(undefined).kind).toBe('checking');
    expect(summarize({ status: 'Running' }).kind).toBe('checking');
    expect(summarize({ status: 'Error' }).kind).toBe('error');
    expect(summarize({ status: 'OK', libkey: { 中央: '行方不明' } })).toMatchObject({ kind: 'busy', label: '行方不明' });
  });
});

describe('カーリルへのリンク（仕様で必須）', () => {
  it('本のページは10けたの ISBN、図書館のページはシステムIDと図書館キー', () => {
    expect(calilBookUrl('9784101215235')).toBe('https://calil.jp/book/4101215235');
    expect(calilLibraryUrl('Tokyo_Setagaya', '玉川台')).toBe(
      'https://calil.jp/library/search?s=Tokyo_Setagaya&k=%E7%8E%89%E5%B7%9D%E5%8F%B0',
    );
  });
});

describe('図書館の一覧', () => {
  it('図書館システムごとにまとめ、移動図書館は名前に入れない', () => {
    const list = groupLibraries([
      { systemid: 'A', systemname: 'A市', short: '中央', formal: 'A市立中央図書館', category: 'LARGE' },
      { systemid: 'A', systemname: 'A市', short: '移動', formal: 'A市移動図書館', category: 'BM' },
      { systemid: 'B', systemname: 'B大学', short: '本館', formal: 'B大学図書館', category: 'UNIV' },
    ]);
    expect(list).toEqual([
      { systemid: 'A', systemname: 'A市', libraries: ['中央'] },
      { systemid: 'B', systemname: 'B大学', libraries: ['本館'] },
    ]);
  });
});

describe('貸出状況の問い合わせ', () => {
  it('continue が 1 のあいだはセッションで問い合わせ直し、途中経過も知らせる', async () => {
    const { fetcher, urls } = fakeFetch([
      { session: 's1', continue: 1, books: { '9784101215235': { X: { status: 'Running' } } } },
      { session: 's1', continue: 0, books: { '9784101215235': { X: { status: 'OK', libkey: { 中央: '貸出可' } } } } },
    ]);
    const updates: CheckResults[] = [];
    const result = await checkAvailability('key', 'X', ['9784101215235'], (r) => updates.push(r), { fetcher, interval: 0 });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('isbn=9784101215235');
    expect(urls[0]).toContain('systemid=X');
    expect(urls[0]).toContain('callback=no');
    expect(urls[1]).toContain('session=s1');
    expect(updates[0]['9784101215235'].status).toBe('Running');
    expect(result['9784101215235'].libkey).toEqual({ 中央: '貸出可' });
  });

  it('100冊をこえると、100冊ずつに分けて問い合わせる', async () => {
    const isbns = Array.from({ length: 150 }, (_, i) => `isbn${i}`);
    const { fetcher, urls } = fakeFetch([{ continue: 0, books: {} }, { continue: 0, books: {} }]);
    await checkAvailability('key', 'X', isbns, () => {}, { fetcher, interval: 0 });
    expect(urls).toHaveLength(2);
    expect(decodeURIComponent(urls[0]).split('isbn=')[1].split('&')[0].split(',')).toHaveLength(100);
  });
});
