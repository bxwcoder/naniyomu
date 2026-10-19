// 画面5：書籍詳細（画面7の「おすすめへの反応」もここで記録できます）

import { BookCover } from '../components/BookCover.tsx';
import { HighlightList } from '../components/HighlightList.tsx';
import { DIFFICULTIES, GENRES, LENGTHS } from '../data/options.ts';
import { REACTION_LABELS, useLibrary, type ReactionType } from '../state/library.tsx';
import type { Book } from '../types.ts';

const NOT_REGISTERED = '情報未登録';

interface Props {
  book: Book | undefined;
  /** おすすめ結果から開いた場合の、回答と合っている点 */
  highlights?: string[];
}

const REACTION_ORDER: ReactionType[] = ['interested', 'not_for_me', 'already_read', 'finished'];

export function BookDetailPage({ book, highlights }: Props) {
  const lib = useLibrary();
  if (!book) {
    return (
      <div className="empty">
        <h1>本が見つかりませんでした</h1>
        <p>リンクが古いか、登録が変更された可能性があります。</p>
      </div>
    );
  }
  const fav = lib.isFavorite(book.book_id);
  const read = lib.isRead(book.book_id);

  return (
    <article>
      <div className="book-card__head">
        <BookCover book={book} />
        <div>
          <h1 className="book-card__title">{book.title}</h1>
          <p className="book-card__author">
            {book.author}
            {book.translator && ` 著／${book.translator} 訳`}
          </p>
          <ul className="tags" aria-label="ジャンル・読みやすさ・長さ">
            {book.genres.map((g) => (
              <li className="tag" key={g}>
                {GENRES[g]}
              </li>
            ))}
            <li className="tag">読みやすさ：{DIFFICULTIES[book.difficulty]}</li>
            <li className="tag">長さ：{LENGTHS[book.length_category]}</li>
          </ul>
        </div>
      </div>

      <p className="detail-desc">{book.description || NOT_REGISTERED}</p>

      {highlights && <HighlightList items={highlights} />}

      {book.recommendation_reasons.length > 0 && (
        <p className="detail-features">
          <strong>この本の特徴：</strong>
          {book.recommendation_reasons.join('／')}
        </p>
      )}

      <section className="reaction-box" aria-label="この本への反応を記録">
        <div className="reaction-grid">
          <button
            type="button"
            className="btn btn--small btn--fav"
            aria-pressed={fav}
            onClick={() => lib.toggleFavorite(book.book_id)}
          >
            {fav ? '★ お気に入り済み' : '☆ お気に入り'}
          </button>
          {REACTION_ORDER.map((r) => {
            const on = lib.hasReaction(book.book_id, r);
            return (
              <button
                key={r}
                type="button"
                className={`btn btn--small ${r === 'not_for_me' ? 'btn--dislike' : 'btn--read'}`}
                aria-pressed={on}
                onClick={() => lib.toggleReaction(book.book_id, r)}
              >
                {on ? `✓ ${REACTION_LABELS[r]}` : REACTION_LABELS[r]}
              </button>
            );
          })}
        </div>
        {(read || lib.hasReaction(book.book_id, 'not_for_me')) && (
          <p className="status-note" role="status">
            {read ? '読んだ本に記録済みです。おすすめには出ません。' : 'この本だけ、次回からおすすめに出しません。'}
          </p>
        )}
      </section>

      <p className="detail-foot">
        購入先：
        {book.purchase_url ? (
          <a href={book.purchase_url} target="_blank" rel="noopener noreferrer">
            購入ページ（外部サイト）
          </a>
        ) : (
          NOT_REGISTERED
        )}
        ／書影：{book.cover_image_url ? '登録あり' : NOT_REGISTERED}／確認元：
        <a href={book.metadata_source} target="_blank" rel="noopener noreferrer">
          外部サイト
        </a>
      </p>
    </article>
  );
}
