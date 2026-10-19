// 画面1：トップページ

import { Logo } from '../components/Logo.tsx';
import { paths } from '../hooks/useHashRoute.ts';

interface Props {
  onStart: () => void;
  hasPreviousResult: boolean;
}

export function TopPage({ onStart, hasPreviousResult }: Props) {
  return (
    <section className="hero">
      <h1 style={{ margin: 0 }}>
        <Logo height={112} />
      </h1>
      <p className="hero__catch">次に読む本、もう迷わない。</p>
      <p className="hero__lead">
        5つの質問に答えるだけで、今のあなたに合った本を3冊えらびます。所要時間は1分ほどです。
      </p>
      <div className="hero__actions stack">
        <button type="button" className="btn btn--primary btn--block" onClick={onStart}>
          おすすめ本を探す
        </button>
        {hasPreviousResult && (
          <a className="btn btn--block" href={paths.results}>
            前回のおすすめ結果を見る
          </a>
        )}
        <div className="grid-2">
          <a className="btn" href={paths.saved}>
            ☆ お気に入り
          </a>
          <a className="btn" href={paths.read}>
            ✓ 読んだ本
          </a>
        </div>
      </div>
    </section>
  );
}
