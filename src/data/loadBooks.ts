// 書籍データの読み込み
// books.json（1冊ずつ書いた本）と books.auto.json（候補リストから自動で作った本）を読み込み、
// 形式チェックをしてから返します。
// 将来データベースに移すときは、この関数の中身だけを書き換えれば、画面側はそのまま使えます。

import type { Book } from '../types.ts';
import { validateBooks } from '../logic/validateBooks.ts';

export interface LoadedBooks {
  books: Book[];
  /** 形式チェックで見つかった問題（開発者向け） */
  problems: string[];
}

export async function loadBooks(): Promise<LoadedBooks> {
  const [curated, auto] = await Promise.all([import('./books.json'), import('./books.auto.json')]);
  const { validBooks, errors } = validateBooks([...curated.default, ...auto.default]);
  if (errors.length > 0) {
    // 問題のある本だけを除いて表示を続ける。内容は開発者向けにコンソールへ出す
    console.warn('書籍データに問題があります:', errors);
  }
  if (validBooks.length === 0) {
    throw new Error('表示できる書籍データがありません');
  }
  return { books: validBooks, problems: errors };
}
