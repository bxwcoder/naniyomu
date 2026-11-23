// 本の購入リンク（アフィリエイト）を作る
// 本の ISBN（本の番号）とアフィリエイト ID から、各サービスの商品ページ（検索ページ）へのリンクを作ります。
// 1冊ずつリンクを登録しなくても、ISBN がある本には全部リンクが付きます。

import type { AffiliateConfig } from '../config/affiliate.ts';
import type { Book } from '../types.ts';
import { isbn13To10, isValidIsbn13 } from './isbn.ts';

export { isbn13To10 };

export interface PurchaseLink {
  service: 'amazon' | 'rakuten';
  label: string;
  url: string;
}

/** 設定されているサービスの購入リンク。ID が空のサービスや、ISBN のない本は含めない */
export function purchaseLinks(book: Book, config: AffiliateConfig): PurchaseLink[] {
  const links: PurchaseLink[] = [];
  const isbn = book.isbn && isValidIsbn13(book.isbn) ? book.isbn : null;
  if (!isbn) return links;

  const amazonTag = config.amazonTag.trim();
  const isbn10 = isbn13To10(isbn);
  if (amazonTag && isbn10) {
    links.push({
      service: 'amazon',
      label: 'Amazonで見る',
      url: `https://www.amazon.co.jp/dp/${isbn10}?tag=${encodeURIComponent(amazonTag)}`,
    });
  }

  const rakutenId = config.rakutenId.trim();
  if (rakutenId) {
    // 楽天市場の ISBN 検索ページを、楽天アフィリエイトの決まった形のリンクで包む
    const target = `https://search.rakuten.co.jp/search/mall/${isbn}/`;
    links.push({
      service: 'rakuten',
      label: '楽天で見る',
      url: `https://hb.afl.rakuten.co.jp/hgc/${encodeURIComponent(rakutenId)}/?pc=${encodeURIComponent(target)}`,
    });
  }
  return links;
}

/** Amazon アソシエイトの決まりで、サイトに書く必要がある一文 */
export const AMAZON_DISCLOSURE = 'Amazonのアソシエイトとして、ナニヨムは適格販売により収入を得ています。';
