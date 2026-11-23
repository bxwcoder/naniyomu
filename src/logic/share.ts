// おすすめ結果を人に送る（LINE・X・コピー）ための文章とリンク

import type { Book } from '../types.ts';

/** 長いタイトルは送る文章では短くする（X の文字数の上限に収めるため） */
const TITLE_MAX = 24;
const shorten = (t: string) => (t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t);

/** 送る文章。例：「ナニヨムで、次に読む本をおすすめしてもらいました📚 1.『舟を編む』三浦しをん …」 */
export function shareText(books: Pick<Book, 'title' | 'author'>[]): string {
  const lines = books.map((b, i) => `${i + 1}. 『${shorten(b.title)}』${b.author}`);
  return ['ナニヨムで、次に読む本をおすすめしてもらいました📚', ...lines, '5つの質問に答えるだけで、あなたに合う3冊が見つかります #ナニヨム'].join('\n');
}

/** LINE で送るリンク（LINE 公式の送り先選択の画面が開く） */
export function lineShareUrl(text: string, url: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(`${text}\n${url}`)}`;
}

/** X（旧 Twitter）でポストするリンク */
export function xShareUrl(text: string, url: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

/** アプリのトップのアドレス（公開先が変わっても、そのときのアドレスを使う） */
export function appUrl(location: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${location.origin}${location.pathname}`;
}
