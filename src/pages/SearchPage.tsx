// 画面：本を名前で探す（タイトル・著者）
// おすすめに出てこなくても、1万冊の中から直接探してお気に入りに入れられます。

import { useMemo, useState } from 'react';
import { BookCover } from '../components/BookCover.tsx';
import { GENRES } from '../data/options.ts';
import { paths } from '../hooks/useHashRoute.ts';
import { buildSearchIndex, searchBooks } from '../logic/search.ts';
import { useLibrary } from '../state/library.tsx';
import type { Book } from '../types.ts';

/** 一度に表示する冊数 */
const PAGE = 30;
/** 本の詳しい画面から戻ってきたときに、入れた言葉を残しておく */
let lastQuery = '';

export function SearchPage({ books }: { books: Book[] }) {
  const lib = useLibrary();
  const [query, setQuery] = useState(lastQuery);
  const [limit, setLimit] = useState(PAGE);
  const index = useMemo(() => buildSearchIndex(books), [books]);
  const results = useMemo(() => searchBooks(index, query), [index, query]);
  const shown = results.slice(0, limit);

  return (
    <>
      <h1>本を名前で探す</h1>
      <form className="search-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <input
          type="search"
          className="search-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            lastQuery = e.target.value;
            setLimit(PAGE);
          }}
          placeholder="タイトルや著者名（例：ハリー、恩田陸）"
          aria-label="タイトルや著者名"
          autoFocus
          enterKeyHint="search"
        />
      </form>
      <p className="muted small" role="status">
        {query.trim() === ''
          ? `ナニヨムにある${books.length.toLocaleString()}冊から探せます。漢字のタイトルは、ひらがなでは見つからないことがあります。`
          : results.length === 0
            ? '見つかりませんでした。言葉を短くするか、別の書き方で試してください。'
            : `${results.length.toLocaleString()}冊見つかりました。`}
      </p>

      {shown.length > 0 && (
        <ul className="stack shelf-list">
          {shown.map((book) => {
            const fav = lib.isFavorite(book.book_id);
            return (
              <li key={book.book_id} className="card shelf-item">
                <BookCover book={book} />
                <div className="shelf-item__body">
                  <p className="shelf-item__title">{book.title}</p>
                  <p className="muted small" style={{ margin: '0 0 4px' }}>
                    {book.author}
                  </p>
                  <p className="search-meta">
                    {book.genres.map((g) => GENRES[g]).join('・')}
                    {lib.isRead(book.book_id) && '・読んだ本'}
                  </p>
                  <div className="row">
                    <a className="btn btn--small" href={paths.book(book.book_id)}>
                      詳しく見る
                    </a>
                    <button
                      type="button"
                      className="btn btn--small btn--fav"
                      aria-pressed={fav}
                      onClick={() => lib.toggleFavorite(book.book_id)}
                      aria-label={fav ? `『${book.title}』をお気に入りから外す` : `『${book.title}』をお気に入りに入れる`}
                    >
                      {fav ? '★ お気に入り済み' : '☆ お気に入り'}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {results.length > shown.length && (
        <button type="button" className="btn btn--block search-more" onClick={() => setLimit((n) => n + PAGE)}>
          さらに表示する（残り{(results.length - shown.length).toLocaleString()}冊）
        </button>
      )}
    </>
  );
}
