// 画面1：トップページ

import { paths } from '../hooks/useHashRoute.ts';

interface Props {
  onStart: () => void;
  hasPreviousResult: boolean;
}

export function TopPage({ onStart, hasPreviousResult }: Props) {
  return (
    <>
      <section className="hero">
        <h1 className="hero__logo">ナニヨム</h1>
        <p className="hero__catch">次に読む本、もう迷わない。</p>
        <div className="hero__lead">
          <p>
            5つの質問に答えるだけで、今のあなたに合った本を3冊えらびます。
            読書が久しぶりの人も、読書好きの人も、気軽にどうぞ。
          </p>
          <ol className="steps">
            <li>
              <span className="steps__num">1</span>
              <span>気分や好みについて、5つの質問に答える（1分ほど）</span>
            </li>
            <li>
              <span className="steps__num">2</span>
              <span>最近面白かった本があれば入力する（なくても大丈夫）</span>
            </li>
            <li>
              <span className="steps__num">3</span>
              <span>おすすめの3冊と、えらんだ理由を見る</span>
            </li>
          </ol>
        </div>
        <div className="stack">
          <button type="button" className="btn btn--primary btn--block" onClick={onStart}>
            おすすめ本を探す
          </button>
          {hasPreviousResult && (
            <a className="btn btn--block" href={paths.results}>
              前回のおすすめ結果を見る
            </a>
          )}
          <div className="row" style={{ justifyContent: 'center' }}>
            <a className="btn btn--ghost" href={paths.saved}>
              ☆ お気に入り
            </a>
            <a className="btn btn--ghost" href={paths.read}>
              ✓ 読んだ本
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
