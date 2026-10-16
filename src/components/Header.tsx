// 画面上部のバー（戻るボタン・アプリ名・お気に入りへのリンク）

import { goBack, paths } from '../hooks/useHashRoute.ts';

interface Props {
  /** 戻るボタンを押したとき、履歴がない場合に移動する画面。省略すると戻るボタンを出さない */
  backTo?: string;
}

export function Header({ backTo }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        {backTo && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => goBack(backTo)}>
            <span aria-hidden="true">←</span> 戻る
          </button>
        )}
        <a className="app-header__title" href={paths.top}>
          ナニヨム
        </a>
        <span className="app-header__spacer" />
        <nav aria-label="保存した本">
          <a className="btn btn--ghost btn--small" href={paths.saved}>
            本棚
          </a>
        </nav>
      </div>
    </header>
  );
}
