// おすすめ結果に表示する、本1冊分のカード
// 1画面に収まるよう、紹介文は2行まで、おすすめ理由は短いラベルで表示します。
// 全文は「詳しく見る」で確認できます。

import { DIFFICULTIES, GENRES } from '../data/options.ts';
import { paths } from '../hooks/useHashRoute.ts';
import { useLibrary } from '../state/library.tsx';
import type { Book, Recommendation, RecommendationRole } from '../types.ts';
import { basicInfoText } from './bookInfo.ts';
import { BookCover } from './BookCover.tsx';
import { HighlightList } from './HighlightList.tsx';

/** カードの札に出す、短い読みやすさの表示（「読みやすさ：」を付けなくても意味が分かる言い方） */
const DIFFICULTY_TAGS: Record<Book['difficulty'], string> = {
  easy: 'スラスラ読める',
  normal: 'ふつうの読みやすさ',
  challenging: 'じっくり読む本',
};

/** タブに出す、3冊それぞれの役割 */
export const ROLE_LABELS: Record<RecommendationRole, string> = {
  best: 'いちばん合う',
  nearby: '少し違う魅力',
  discovery: '新しい発見',
};

interface Props {
  rec: Recommendation;
}

export function BookCard({ rec }: Props) {
  const { book } = rec;
  const lib = useLibrary();
  const fav = lib.isFavorite(book.book_id);
  const alreadyRead = lib.hasReaction(book.book_id, 'already_read');
  const disliked = lib.hasReaction(book.book_id, 'not_for_me');

  return (
    <article className="card book-card">
      <div className="book-card__head">
        <BookCover book={book} />
        <div>
          <h2 className="book-card__title">{book.title}</h2>
          <p className="book-card__author">{book.author}</p>
          <ul className="tags" aria-label="ジャンルと読みやすさ">
            {book.genres.map((g) => (
              <li className="tag" key={g}>
                {GENRES[g]}
              </li>
            ))}
            <li className="tag" aria-label={`読みやすさ：${DIFFICULTIES[book.difficulty]}`}>
              {DIFFICULTY_TAGS[book.difficulty]}
            </li>
          </ul>
        </div>
      </div>

      {book.description ? (
        <p className="book-card__desc">{book.description}</p>
      ) : (
        <p className="book-card__desc book-card__desc--basic">{basicInfoText(book)}</p>
      )}

      {/* 1画面に収めるため、カードでは大事な2つ（興味・気分）まで。残りは詳細画面で表示 */}
      <HighlightList items={rec.highlights.slice(0, 2)} />

      <div className="book-card__actions">
        <button
          type="button"
          className="btn btn--small btn--fav"
          aria-pressed={fav}
          onClick={() => lib.toggleFavorite(book.book_id)}
        >
          {fav ? '★ お気に入り済み' : '☆ お気に入り'}
        </button>
        <a className="btn btn--small" href={paths.book(book.book_id)}>
          詳しく見る
        </a>
        <button
          type="button"
          className="btn btn--small btn--read"
          aria-pressed={alreadyRead}
          onClick={() => lib.toggleReaction(book.book_id, 'already_read')}
        >
          {alreadyRead ? '✓ 読んだことがある' : '読んだことがある'}
        </button>
        <button
          type="button"
          className="btn btn--small btn--dislike"
          aria-pressed={disliked}
          onClick={() => lib.toggleReaction(book.book_id, 'not_for_me')}
        >
          {disliked ? '✓ 好みと違う' : '好みと違う'}
        </button>
      </div>
      {(alreadyRead || disliked) && (
        <p className="status-note" role="status">
          {alreadyRead ? '読んだ本に記録しました。次回からおすすめに出ません。' : 'この本だけ、次回からおすすめに出しません。'}
        </p>
      )}
    </article>
  );
}
