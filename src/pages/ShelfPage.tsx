// 画面6：お気に入り・読んだ本の一覧

import { useState } from 'react';
import { BookCover } from '../components/BookCover.tsx';
import { AvailabilityLine, calilEnabled, LibraryPicker, useAvailability } from '../components/LibraryAvailability.tsx';
import { paths } from '../hooks/useHashRoute.ts';
import { checkableIsbn } from '../logic/calil.ts';
import { calilUrl } from '../logic/library.ts';
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

  // 選んだ図書館での貸出状況（カーリル）。お気に入り・読んだ本のどちらでも、表示中の本を調べる
  const showAvailability = calilEnabled();
  const avail = useAvailability(
    showAvailability ? list.map(checkableIsbn).filter((i): i is string => i !== null) : [],
  );
  const [picking, setPicking] = useState(false);

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

      {showAvailability && list.length > 0 && (
        <section className="avail-panel" aria-labelledby="avail-title">
          <h2 id="avail-title" className="avail-panel__title">
            図書館の貸出状況
          </h2>
          {avail.setting && !picking ? (
            <>
              <p className="avail-panel__current">
                {avail.setting.systemname}
                {avail.running && <span className="muted small">（確認中…）</span>}
              </p>
              <div className="row">
                <button type="button" className="btn btn--small" onClick={avail.refresh} disabled={avail.running}>
                  最新にする
                </button>
                <button type="button" className="btn btn--small" onClick={() => setPicking(true)}>
                  図書館を変える
                </button>
              </div>
              {avail.error && <p className="notice notice--error">{avail.error}</p>}
              <p className="muted small avail-panel__credit">
                貸出状況：
                <a href="https://calil.jp/" target="_blank" rel="noopener noreferrer">
                  カーリル
                </a>
                （図書館の情報は少し古いことがあります）
              </p>
            </>
          ) : (
            <>
              <p className="muted small">よく使う図書館を選ぶと、本棚の本が借りられるか分かります。</p>
              <LibraryPicker
                initial={avail.setting}
                onSelect={(s) => {
                  avail.setSetting(s);
                  setPicking(false);
                }}
                onCancel={avail.setting ? () => setPicking(false) : undefined}
              />
            </>
          )}
        </section>
      )}

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
        <ul className="stack shelf-list">
          {list.map((book) => (
            <li key={book.book_id} className="card shelf-item">
              <BookCover book={book} />
              <div className="shelf-item__body">
                <p className="shelf-item__title">{book.title}</p>
                <p className="muted small" style={{ margin: '0 0 8px' }}>
                  {book.author}
                </p>
                {showAvailability && avail.setting && !picking && (
                  <AvailabilityLine isbn={checkableIsbn(book)} systemid={avail.setting.systemid} results={avail.results} />
                )}
                <div className="row">
                  <a className="btn btn--small" href={paths.book(book.book_id)}>
                    詳しく見る
                  </a>
                  <a
                    className="btn btn--small"
                    href={calilUrl(book)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`『${book.title}』を図書館で探す（カーリル・外部サイト）`}
                  >
                    図書館で探す
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
