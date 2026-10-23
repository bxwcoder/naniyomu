// 紹介文のない本（自動で集めた本）に、代わりに出す基本情報

import type { Book } from '../types.ts';

/** 例：「集英社・318ページ」。何も分からなければ空文字 */
export function basicInfoText(book: Book): string {
  return [book.publisher, book.pages ? `${book.pages}ページ` : null].filter(Boolean).join('・');
}
