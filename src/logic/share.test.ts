import { describe, expect, it } from 'vitest';
import { appUrl, lineShareUrl, shareText, xShareUrl } from './share.ts';

const books = [
  { title: '舟を編む', author: '三浦しをん' },
  { title: 'とても長いタイトルの本でここまで長いと送る文章では短くしたいもの', author: '誰か' },
  { title: '夜のピクニック', author: '恩田陸' },
];

describe('おすすめを人に送る', () => {
  it('3冊のタイトルと著者を番号つきで入れ、長いタイトルは短くする', () => {
    const t = shareText(books);
    expect(t).toContain('1. 『舟を編む』三浦しをん');
    expect(t).toContain('3. 『夜のピクニック』恩田陸');
    expect(t).toContain('…』誰か');
    expect(t).toContain('#ナニヨム');
  });

  it('LINE と X のリンクに文章とアプリのアドレスが入る', () => {
    const url = 'https://naniyomu.app-kobo.workers.dev/';
    const line = lineShareUrl('こんにちは', url);
    expect(line.startsWith('https://line.me/R/share?text=')).toBe(true);
    expect(decodeURIComponent(line)).toContain('こんにちは\nhttps://naniyomu.app-kobo.workers.dev/');
    const x = xShareUrl('こんにちは', url);
    expect(x.startsWith('https://x.com/intent/post?text=')).toBe(true);
    expect(decodeURIComponent(x)).toContain('url=https://naniyomu.app-kobo.workers.dev/');
  });

  it('アプリのアドレスは、開いている場所（# より前）', () => {
    expect(appUrl({ origin: 'https://a.example', pathname: '/' })).toBe('https://a.example/');
  });
});
