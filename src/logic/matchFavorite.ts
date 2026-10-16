// 「最近、面白かった本」の入力と、登録済みの本の照らし合わせ
// 外部のAIは使わず、登録済みの本のタイトルが入力の中に含まれているかだけを調べます。
// 一致しない場合は「参考情報」として保存するだけにし、特定の本だと決めつけません。
// 将来AIで分析するときは、この関数を差し替えれば推薦処理はそのまま使えます。

import type { Book } from '../types.ts';

/** 比べやすい形にそろえる（全角・半角、大文字・小文字、記号や空白の違いをなくす） */
export function normalizeTitle(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s「」『』【】()（）〈〉《》・、。,.!?！？:：;；〜~\-―ー]/g, '');
}

/**
 * タイトルの「主な部分」。副題が付いている本（例：『サピエンス全史 文明の構造と人類の幸福』）は、
 * 副題なしで書かれても見つけられるよう、最初の区切りより前の部分も使う。
 */
function titleKeys(book: Book): string[] {
  // 「改訂版」「新版」などの版の表記は、入力では省かれることが多いので取り除く
  const title = book.title.replace(/(改訂版|新装版|新版|完訳)/g, ' ').trim();
  const keys = [normalizeTitle(title)];
  const main = title.split(/[\s―]/)[0];
  const normalizedMain = normalizeTitle(main);
  // 短すぎる文字列（「チ」など）は誤って一致しやすいので、主な部分としては使わない
  if (normalizedMain.length >= 3 && normalizedMain !== keys[0]) keys.push(normalizedMain);
  return keys;
}

/** 入力文の中に、登録済みの本のタイトルが含まれていればその本を返す */
export function matchFavoriteBooks(text: string | undefined, books: Book[]): Book[] {
  if (!text) return [];
  const input = normalizeTitle(text);
  if (input === '') return [];
  return books.filter((book) => titleKeys(book).some((key) => key.length > 0 && input.includes(key)));
}
