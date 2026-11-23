// 画面：設定（記録のバックアップ・貸出状況を調べる図書館・このアプリについて）

import { useRef, useState } from 'react';
import { calilEnabled, LibraryPicker } from '../components/LibraryAvailability.tsx';
import { paths } from '../hooks/useHashRoute.ts';
import { useLibrary } from '../state/library.tsx';
import { browserStore, loadCalilSetting, saveCalilSetting } from '../state/storage.ts';

export function SettingsPage() {
  const lib = useLibrary();
  const store = useRef(browserStore()).current;
  const [calil, setCalil] = useState(() => loadCalilSetting(store));
  const [picking, setPicking] = useState(false);

  return (
    <>
      <h1>設定</h1>

      <section className="card settings-box" aria-labelledby="set-data">
        <h2 id="set-data">記録</h2>
        <p className="small muted">
          {`お気に入り ${lib.state.favorites.length}冊・読んだ本 ${lib.state.read.length}冊・履歴 ${lib.state.history.length}件。`}
          {'記録はこのスマホのブラウザの中にだけ保存されています。'}
        </p>
        <a className="btn btn--block settings-link" href={paths.backup}>
          記録のバックアップ・引っ越し
          <span aria-hidden="true">›</span>
        </a>
      </section>

      {calilEnabled() && (
        <section className="card settings-box" aria-labelledby="set-lib">
          <h2 id="set-lib">貸出状況を調べる図書館</h2>
          {calil && !picking ? (
            <>
              <p className="settings-current">{calil.systemname}</p>
              <div className="row">
                <button type="button" className="btn btn--small" onClick={() => setPicking(true)}>
                  図書館を変える
                </button>
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => {
                    if (!window.confirm('選んだ図書館を解除しますか？（本棚に貸出状況が出なくなります）')) return;
                    saveCalilSetting(store, null);
                    setCalil(null);
                  }}
                >
                  解除する
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="small muted">よく使う図書館を選ぶと、本棚の本が借りられるか分かります。</p>
              <LibraryPicker
                initial={calil}
                onSelect={(s) => {
                  saveCalilSetting(store, s);
                  setCalil(s);
                  setPicking(false);
                }}
                onCancel={calil ? () => setPicking(false) : undefined}
              />
            </>
          )}
        </section>
      )}

      <section className="card settings-box" aria-labelledby="set-about">
        <h2 id="set-about">このアプリについて</h2>
        <ul className="settings-about small">
          <li>
            本の情報（出版社・ページ数など）は
            <a href="https://ndlsearch.ndl.go.jp/" target="_blank" rel="noopener noreferrer">
              国立国会図書館サーチ
            </a>
            の記録を元にしています。
          </li>
          <li>
            図書館の貸出状況は
            <a href="https://calil.jp/" target="_blank" rel="noopener noreferrer">
              カーリル
            </a>
            の図書館APIを使って調べています。
          </li>
          <li>お気に入りなどの記録や選んだ図書館は、サーバーには送らず、このスマホの中にだけ保存します。</li>
        </ul>
      </section>
    </>
  );
}
