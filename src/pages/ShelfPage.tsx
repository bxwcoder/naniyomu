// 画面6：お気に入り・読んだ本の一覧

import { BookCover } from '../components/BookCover.tsx';
import { paths } from '../hooks/useHashRoute.ts';
import { useLibrary } from '../state/library.tsx';
import type { Book } from '../types.ts';

interface Props {
  tab: 'favorites' | 'read';
  books: Book[];
}

export function ShelfPage({ tab, books }: Props) {
  const lib = useLibrary();
  const ids = tab === 'favorites' ? lib.state.favorites : lib.state.read;
  // 新しく登録した順に並べる
  const list = [...ids]
    .reverse()
    .map((id) => books.find((b) => b.book_id === id))
    .filter((b): b is Book => b !== undefined);

  return (
    <>
      <h1>本棚</h1>
      <nav className="tabs" aria-label="本棚の切り替え">
        <a className="tab" href={paths.saved} aria-current={tab === 'favorites' ? 'page' : undefined}>
          ☆ お気に入り（{lib.state.favorites.length}）
        </a>
        <a className="tab" href={paths.read} aria-current={tab === 'read' ? 'page' : undefined}>
          ✓ 読んだ本（{lib.state.read.length}）
        </a>
      </nav>

      {list.length === 0 ? (
        <div className="empty">
          <p>
            {tab === 'favorites'
              ? 'お気に入りの本はまだありません。おすすめ結果の「☆ お気に入り」から追加できます。'
              : '読んだ本はまだありません。「読んだことがある」を押すとここに入ります。'}
          </p>
          <a className="btn btn--primary" href={paths.top}>
            おすすめ本を探す
          </a>
        </div>
      ) : (
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {list.map((book) => (
            <li key={book.book_id} className="card shelf-item">
              <BookCover book={book} />
              <div className="shelf-item__body">
                <p className="shelf-item__title">{book.title}</p>
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  {book.author}
                </p>
                <div className="row">
                  <a className="btn btn--small" href={paths.book(book.book_id)}>
                    詳しく見る
                  </a>
                  {tab === 'favorites' ? (
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => lib.toggleFavorite(book.book_id)}
                      aria-label={`『${book.title}』をお気に入りから外す`}
                    >
                      外す
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => lib.unmarkRead(book.book_id)}
                      aria-label={`『${book.title}』の既読を解除する`}
                    >
                      既読を解除
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
