// おすすめ結果に表示する、本1冊分のカード

import { DIFFICULTIES, GENRES } from '../data/options.ts';
import { paths } from '../hooks/useHashRoute.ts';
import { useLibrary } from '../state/library.tsx';
import type { Recommendation, RecommendationRole } from '../types.ts';
import { BookCover } from './BookCover.tsx';

export const ROLE_LABELS: Record<RecommendationRole, string> = {
  best: '1冊目：いちばん希望に合う本',
  nearby: '2冊目：好みに近く、少し違う魅力',
  discovery: '3冊目：新しい発見',
};

export function BookCard({ rec }: { rec: Recommendation }) {
  const { book } = rec;
  const lib = useLibrary();
  const fav = lib.isFavorite(book.book_id);
  const alreadyRead = lib.hasReaction(book.book_id, 'already_read');
  const disliked = lib.hasReaction(book.book_id, 'not_for_me');
  const titleId = `title-${book.book_id}`;

  return (
    <article className="card" aria-labelledby={titleId}>
      <span className="book-card__role">{ROLE_LABELS[rec.role]}</span>
      <div className="book-card__head">
        <BookCover book={book} />
        <div>
          <h3 className="book-card__title" id={titleId}>
            {book.title}
          </h3>
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

      <p>{book.description}</p>

      <section className="reasons" aria-label="おすすめする理由">
        <h4>おすすめする理由</h4>
        <ul>
          {rec.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <dl className="meta-list">
        <dt>読みやすさ</dt>
        <dd>{DIFFICULTIES[book.difficulty]}</dd>
      </dl>

      <div className="book-card__actions">
        <button
          type="button"
          className="btn btn--small btn--fav"
          aria-pressed={fav}
          onClick={() => lib.toggleFavorite(book.book_id)}
        >
          {fav ? '★ お気に入り済み' : '☆ お気に入り'}
        </button>
        <button
          type="button"
          className="btn btn--small btn--read"
          aria-pressed={alreadyRead}
          onClick={() => lib.toggleReaction(book.book_id, 'already_read')}
        >
          {alreadyRead ? '✓ 読んだことがある' : '読んだことがある'}
        </button>
        <a className="btn btn--small" href={paths.book(book.book_id)}>
          詳しく見る
        </a>
        <button
          type="button"
          className="btn btn--small btn--dislike"
          aria-pressed={disliked}
          onClick={() => lib.toggleReaction(book.book_id, 'not_for_me')}
        >
          {disliked ? '✓ 好みと違う' : '好みと違う'}
        </button>
      </div>
      <p className="status-note" role="status">
        {alreadyRead && '読んだ本に記録しました。次回からはおすすめに出ません。'}
        {!alreadyRead && disliked && 'この本は次回からおすすめに出ません（同じジャンルのほかの本は引き続き出ます）。'}
      </p>
    </article>
  );
}
