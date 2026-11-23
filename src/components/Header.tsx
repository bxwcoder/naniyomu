// 画面上部のバー（戻るボタン・ロゴ・本棚へのリンク）

import { goBack, paths } from '../hooks/useHashRoute.ts';
import { Logo } from './Logo.tsx';

interface Props {
  /** 戻るボタンを押したとき、履歴がない場合に移動する画面。省略すると戻るボタンを出さない */
  backTo?: string;
  /** トップページでは大きなロゴがあるので、バーのロゴは出さない */
  showLogo?: boolean;
}

export function Header({ backTo, showLogo = true }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        {backTo && (
          <button type="button" className="btn btn--ghost btn--small" onClick={() => goBack(backTo)}>
            <span aria-hidden="true">←</span> 戻る
          </button>
        )}
        {showLogo && (
          <a className="app-header__title" href={paths.top} aria-label="ナニヨム（トップへ）">
            <Logo height={30} />
          </a>
        )}
        <span className="app-header__spacer" />
        <nav aria-label="本を探す・本棚・設定" className="app-header__nav">
          <a className="btn btn--ghost btn--small" href={paths.search} aria-label="本を名前で探す">
            さがす
          </a>
          <a className="btn btn--ghost btn--small" href={paths.saved}>
            本棚
          </a>
          <a className="btn btn--ghost btn--small app-header__icon" href={paths.settings} aria-label="設定">
            <span aria-hidden="true">⚙</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
