// 本の基本情報（出版社・ページ数）の表示

import type { Book } from '../types.ts';

/**
 * 紹介文・「この本の特徴」を画面に出すかどうか。
 * 手作業の64冊だけ紹介文があり見た目がそろわないため、今は全部の本で出さない。
 * データ（books.json の description / recommendation_reasons）は残してあるので、
 * true に戻せば元どおり表示されます。
 */
export const SHOW_CURATED_TEXT = false;

/** 例：「集英社・318ページ」。何も分からなければ空文字 */
export function basicInfoText(book: Book): string {
  return [book.publisher, book.pages ? `${book.pages}ページ` : null].filter(Boolean).join('・');
}
