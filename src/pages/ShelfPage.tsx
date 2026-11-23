// 画面6：お気に入り・読んだ本・履歴（一覧から外した本）の一覧

import { useState } from 'react';
import { BookCover } from '../components/BookCover.tsx';
import { AvailabilityLine, calilEnabled, LibraryPicker, useAvailability } from '../components/LibraryAvailability.tsx';
import { paths } from '../hooks/useHashRoute.ts';
import { checkableIsbn, summarize } from '../logic/calil.ts';
import { calilUrl } from '../logic/library.ts';
import { useLibrary, type HistoryEntry } from '../state/library.tsx';
import type { Book } from '../types.ts';

interface Props {
  tab: 'favorites' | 'read' | 'history';
  books: Book[];
}

export function ShelfPage({ tab, books }: Props) {
  const lib = useLibrary();
  const ids = tab === 'favorites' ? lib.state.favorites : tab === 'read' ? lib.state.read : [];
  // 新しく登録した順に並べる
  const list = [...ids]
    .reverse()
    .map((id) => books.find((b) => b.book_id === id))
    .filter((b): b is Book => b !== undefined);

  // 履歴の本（外した本）。同じ本がお気に入り・読んだ本の両方から外されていても1冊として数える
  const historyBooks = [...new Set(lib.state.history.map((h) => h.bookId))]
    .map((id) => books.find((b) => b.book_id === id))
    .filter((b): b is Book => b !== undefined);
  const shownBooks = tab === 'history' ? historyBooks : list;

  // 選んだ図書館での貸出状況（カーリル）。どのタブでも、表示中の本を調べる
  const showAvailability = calilEnabled();
  const avail = useAvailability(
    showAvailability ? shownBooks.map(checkableIsbn).filter((i): i is string => i !== null) : [],
  );
  const [picking, setPicking] = useState(false);

  // 「借りられる本だけ」の絞り込み（この端末で覚えておく）
  const [availableOnly, setAvailableOnlyState] = useState(() => readFlag(AVAILABLE_ONLY_KEY));
  const setAvailableOnly = (v: boolean) => {
    writeFlag(AVAILABLE_ONLY_KEY, v);
    setAvailableOnlyState(v);
  };
  const filtering = showAvailability && !!avail.setting && !picking && availableOnly;
  const isAvailable = (book: Book) => {
    const isbn = checkableIsbn(book);
    return isbn !== null && summarize(avail.results[isbn]).kind === 'available';
  };
  const visibleList = filtering ? list.filter(isAvailable) : list;
  const availableCount = shownBooks.filter(isAvailable).length;

  return (
    <>
      <h1>本棚</h1>
      <nav className="tabs tabs--3" aria-label="本棚の切り替え">
        <a className="tab" href={paths.saved} aria-current={tab === 'favorites' ? 'page' : undefined}>
          ☆ お気に入り<span className="tab__count">{lib.state.favorites.length}</span>
        </a>
        <a className="tab" href={paths.read} aria-current={tab === 'read' ? 'page' : undefined}>
          ✓ 読んだ本<span className="tab__count">{lib.state.read.length}</span>
        </a>
        <a className="tab" href={paths.history} aria-current={tab === 'history' ? 'page' : undefined}>
          🕘 履歴<span className="tab__count">{lib.state.history.length}</span>
        </a>
      </nav>


      {showAvailability && shownBooks.length > 0 && (
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
              <label className="avail-filter">
                <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
                今借りられる本（貸出可）だけ表示
                <span className="muted small">（{availableCount}冊）</span>
              </label>
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

      {tab === 'history' && (
        <HistoryList
          books={books}
          filter={filtering ? isAvailable : undefined}
          availability={(book) =>
            showAvailability && avail.setting && !picking ? (
              <AvailabilityLine isbn={checkableIsbn(book)} systemid={avail.setting.systemid} results={avail.results} />
            ) : null
          }
        />
      )}

      {tab !== 'history' && list.length === 0 ? (
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
      ) : tab === 'history' ? null : visibleList.length === 0 ? (
        <FilteredEmpty running={avail.running} onShowAll={() => setAvailableOnly(false)} />
      ) : (
        <ul className="stack shelf-list">
          {visibleList.map((book) => (
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
      <p className="shelf-backup">
        <a href={paths.backup}>記録のバックアップ・引っ越し</a>
      </p>
    </>
  );
}

/** 例：「11月23日」。今年でなければ年も付ける */
function formatDate(ms: number): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${sameYear ? '' : `${d.getFullYear()}年`}${d.getMonth() + 1}月${d.getDate()}日`;
}

const FROM_LABEL: Record<HistoryEntry['from'], string> = {
  favorites: 'お気に入り',
  read: '読んだ本',
};

/** お気に入り・読んだ本から外した本の一覧（新しい順） */
function HistoryList({
  books,
  availability,
  filter,
}: {
  books: Book[];
  /** 「借りられる本だけ」のときの絞り込み */
  filter?: (book: Book) => boolean;
  /** 本ごとの図書館の貸出状況（図書館を選んでいなければ null） */
  availability: (book: Book) => React.ReactNode;
}) {
  const lib = useLibrary();
  const entries = lib.state.history
    .map((h) => ({ h, book: books.find((b) => b.book_id === h.bookId) }))
    .filter((e): e is { h: HistoryEntry; book: Book } => e.book !== undefined);

  if (entries.length === 0) {
    return (
      <div className="empty">
        <p>お気に入りや読んだ本から外した本が、ここに残ります。「前に入れたの何だっけ？」というときに見返せます。</p>
      </div>
    );
  }
  const visible = filter ? entries.filter((e) => filter(e.book)) : entries;
  if (visible.length === 0) return <FilteredEmpty running={false} />;

  return (
    <>
      <p className="muted small">お気に入りや読んだ本から外した本です（新しい順・{entries.length}冊）。</p>
      <ul className="stack shelf-list">
        {visible.map(({ h, book }) => {
          // もう一度一覧に入れ直したかどうか（片方だけ戻した場合などに表示を変える）
          const back = h.from === 'favorites' ? lib.isFavorite(book.book_id) : lib.isRead(book.book_id);
          return (
            <li key={`${h.from}-${book.book_id}`} className="card shelf-item">
              <BookCover book={book} />
              <div className="shelf-item__body">
                <p className="shelf-item__title">{book.title}</p>
                <p className="muted small" style={{ margin: '0 0 4px' }}>
                  {book.author}
                </p>
                <p className="history-note">
                  {formatDate(h.at)}に{FROM_LABEL[h.from]}から外しました
                </p>
                {availability(book)}
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
                  {!back && (
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() =>
                        h.from === 'favorites' ? lib.toggleFavorite(book.book_id) : lib.markRead(book.book_id)
                      }
                      aria-label={`『${book.title}』を${FROM_LABEL[h.from]}に戻す`}
                    >
                      {FROM_LABEL[h.from]}に戻す
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--small"
                    onClick={() => lib.removeHistory(book.book_id, h.from)}
                    aria-label={`『${book.title}』を履歴から消す`}
                  >
                    履歴から消す
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="history-clear">
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => {
            if (window.confirm('履歴をすべて消しますか？（お気に入り・読んだ本は消えません）')) lib.clearHistory();
          }}
        >
          履歴をすべて消す
        </button>
      </div>
    </>
  );
}

/** 「借りられる本だけ」で1冊もないとき */
function FilteredEmpty({ running, onShowAll }: { running: boolean; onShowAll?: () => void }) {
  return (
    <div className="empty">
      <p>
        {running
          ? '貸出状況を確認しています。借りられる本が見つかりしだい、ここに出ます。'
          : '今借りられる本（貸出可）はありません。上のチェックを外すと、全部の本を表示します。'}
      </p>
      {onShowAll && !running && (
        <button type="button" className="btn" onClick={onShowAll}>
          全部の本を表示する
        </button>
      )}
    </div>
  );
}

const AVAILABLE_ONLY_KEY = 'naniyomu.availableOnly.v1';

/** 画面の表示の好み（保存できない環境では、毎回はじめの状態にもどる） */
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // 保存できなくても続ける
  }
}
