// 図書館で本を探すリンク（カーリル）
// カーリル（calil.jp）は、全国の図書館の蔵書をまとめて検索できる無料のサイトです。
// 本の ISBN を渡すと、その本のページ（どの図書館にあるか・貸出中か）が開きます。
// よく使う図書館はカーリル側で登録しておくと、その図書館の状況がすぐ分かります。
// 使っている入口：カーリルの OpenURL（https://calil.jp/doc/api_openurl.html）

import type { Book } from '../types.ts';
import { isValidIsbn13 } from './isbn.ts';

/** カーリルでこの本を探すリンク。ISBN のない本は、タイトルと著者で検索するリンク */
export function calilUrl(book: Pick<Book, 'isbn' | 'title' | 'author'>): string {
  if (book.isbn && isValidIsbn13(book.isbn)) {
    return `https://api.calil.jp/openurl?rft.isbn=${book.isbn}`;
  }
  // ISBN がなければ、カーリルの検索結果へ（OpenURL はタイトルでも検索できる）
  const title = book.title.split(/\s/)[0];
  return `https://api.calil.jp/openurl?rft.btitle=${encodeURIComponent(title)}&rft.au=${encodeURIComponent(book.author)}`;
}
