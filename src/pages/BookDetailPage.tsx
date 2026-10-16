// 画面5：書籍詳細（画面7の「おすすめへの反応」もここで記録できます）

import { BookCover } from '../components/BookCover.tsx';
import { DIFFICULTIES, GENRES, LENGTHS } from '../data/options.ts';
import { REACTION_LABELS, useLibrary, type ReactionType } from '../state/library.tsx';
import type { Book } from '../types.ts';

const NOT_REGISTERED = '情報未登録';

interface Props {
  book: Book | undefined;
  /** おすすめ結果から開いた場合の、おすすめ理由 */
  reasons?: string[];
}

const REACTION_ORDER: ReactionType[] = ['interested', 'not_for_me', 'already_read', 'finished'];

export function BookDetailPage({ book, reasons }: Props) {
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
        <BookCover book={book} large />
        <div>
          <h1 className="book-card__title">{book.title}</h1>
          <p className="book-card__author">
            {book.author}
            {book.translator && ` 著／${book.translator} 訳`}
          </p>
          <ul className="tags" aria-label="ジャンル">
            {book.genres.map((g) => (
              <li className="tag" key={g}>
                {GENRES[g]}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2>紹介</h2>
      <p>{book.description || NOT_REGISTERED}</p>

      <dl className="meta-list">
        <dt>読みやすさ</dt>
        <dd>{DIFFICULTIES[book.difficulty]}</dd>
        <dt>長さの目安</dt>
        <dd>{LENGTHS[book.length_category]}</dd>
        <dt>購入先</dt>
        <dd>
          {book.purchase_url ? (
            <a href={book.purchase_url} target="_blank" rel="noopener noreferrer">
              購入ページを開く（外部サイト）
            </a>
          ) : (
            NOT_REGISTERED
          )}
        </dd>
      </dl>

      {reasons && reasons.length > 0 && (
        <section className="reasons" aria-label="おすすめする理由">
          <h4>おすすめする理由</h4>
          <ul>
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="stack" style={{ marginTop: 16 }}>
        <div className="row">
          <button
            type="button"
            className="btn btn--fav"
            aria-pressed={fav}
            onClick={() => lib.toggleFavorite(book.book_id)}
          >
            {fav ? '★ お気に入り済み' : '☆ お気に入りに追加'}
          </button>
        </div>

        <section className="card" aria-labelledby="reaction-heading">
          <h2 id="reaction-heading" style={{ fontSize: '1.05rem' }}>
            この本の感想を記録
          </h2>
          <div className="row">
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
          <p className="status-note" role="status">
            {read
              ? '読んだ本に記録されています。おすすめには出ません。'
              : lib.hasReaction(book.book_id, 'not_for_me')
                ? 'この本は次回からおすすめに出ません（同じジャンルのほかの本は引き続き出ます）。'
                : 'もう一度押すと記録を取り消せます。'}
          </p>
        </section>

        <p className="muted small">
          書誌情報の確認元：
          <a href={book.metadata_source} target="_blank" rel="noopener noreferrer">
            外部サイトを開く
          </a>
          （書影：{book.cover_image_url ? '登録あり' : NOT_REGISTERED}）
        </p>
      </div>
    </article>
  );
}
