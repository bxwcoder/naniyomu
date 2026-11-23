// 画面5：書籍詳細（画面7の「おすすめへの反応」もここで記録できます）

import { basicInfoText, SHOW_CURATED_TEXT } from '../components/bookInfo.ts';
import { BookCover } from '../components/BookCover.tsx';
import { HighlightList } from '../components/HighlightList.tsx';
import { ReadingNoteEditor } from '../components/ReadingNote.tsx';
import { AFFILIATE } from '../config/affiliate.ts';
import { DIFFICULTIES, GENRES, LENGTHS } from '../data/options.ts';
import { REACTION_LABELS, useLibrary, type ReactionType } from '../state/library.tsx';
import { AMAZON_DISCLOSURE, purchaseLinks } from '../logic/affiliate.ts';
import { calilUrl } from '../logic/library.ts';
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
  const links = purchaseLinks(book, AFFILIATE);

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

      {SHOW_CURATED_TEXT && book.description ? (
        <p className="detail-desc">{book.description}</p>
      ) : (
        <p className="detail-desc detail-desc--basic">
          {basicInfoText(book) || NOT_REGISTERED}
          <br />
          本の情報は国立国会図書館の記録を元にしています。
        </p>
      )}

      {highlights && <HighlightList items={highlights} />}

      {SHOW_CURATED_TEXT && book.recommendation_reasons.length > 0 && (
        <p className="detail-features">
          <strong>この本の特徴：</strong>
          {book.recommendation_reasons.join('／')}
        </p>
      )}

      <section className="library-box" aria-labelledby="library-title">
        <h2 id="library-title" className="library-box__title">
          図書館で借りる
        </h2>
        <a className="btn btn--small btn--block" href={calilUrl(book)} target="_blank" rel="noopener noreferrer">
          図書館で探す（カーリル）
        </a>
        <p className="library-box__note">
          {'全国の図書館の蔵書をまとめて検索できる「カーリル」で、この本がある図書館と貸出状況を調べられます。' +
            'よく使う図書館をカーリルで登録しておくと便利です。'}
        </p>
      </section>

      {links.length > 0 && (
        <section className="buy-box" aria-labelledby="buy-title">
          <h2 id="buy-title" className="buy-box__title">
            この本を買う <span className="ad-label">広告</span>
          </h2>
          <div className="buy-box__links">
            {links.map((l) => (
              <a
                key={l.service}
                className="btn btn--small"
                href={l.url}
                target="_blank"
                rel="sponsored noopener noreferrer"
              >
                {l.label}
              </a>
            ))}
          </div>
          <p className="buy-box__note">
            ボタンは広告（アフィリエイト）のリンクです。リンク先で本が買われると、ナニヨムに紹介料が入ります。
            {links.some((l) => l.service === 'amazon') && (
              <>
                <br />
                {AMAZON_DISCLOSURE}
              </>
            )}
          </p>
        </section>
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

      {(read || lib.state.notes[book.book_id]) && <ReadingNoteEditor bookId={book.book_id} />}

      <p className="detail-foot">
        {/* 購入ボタンがあるときは、ここには購入先を書かない */}
        {links.length === 0 && (
          <>
            購入先：
            {book.purchase_url ? (
              <a href={book.purchase_url} target="_blank" rel="noopener noreferrer">
                購入ページ（外部サイト）
              </a>
            ) : (
              NOT_REGISTERED
            )}
            ／
          </>
        )}
        書影：{book.cover_image_url ? '登録あり' : NOT_REGISTERED}／確認元：
        <a href={book.metadata_source} target="_blank" rel="noopener noreferrer">
          外部サイト
        </a>
      </p>
    </article>
  );
}
