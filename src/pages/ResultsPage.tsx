// 画面4：おすすめ結果

import { BookCard } from '../components/BookCard.tsx';
import type { RecommendResult, RelaxSuggestion } from '../types.ts';

interface Props {
  result: RecommendResult;
  favoriteText: string;
  onApplySuggestion: (s: RelaxSuggestion) => void;
  onRefresh: () => void;
  onRestart: () => void;
}

export function ResultsPage({ result, favoriteText, onApplySuggestion, onRefresh, onRestart }: Props) {
  const { recommendations, favoriteMatches } = result;
  const insufficient = result.status === 'insufficient';

  return (
    <>
      <h1>{insufficient ? '条件に合う本が少なめでした' : 'あなたへのおすすめ3冊'}</h1>

      {favoriteMatches.length > 0 && (
        <p className="notice notice--accent">
          あなたが挙げた{favoriteMatches.map((b) => `『${b.title}』`).join('、')}
          の特徴も参考にしました。この本はすでに読んでいるので、おすすめからは外しています。
        </p>
      )}
      {favoriteMatches.length === 0 && favoriteText.trim() !== '' && (
        <p className="notice">
          入力していただいた本は、ナニヨムにまだ登録されていませんでした。今回は質問の回答だけでおすすめを選んでいます。
        </p>
      )}

      {insufficient && (
        <section className="notice" aria-label="条件の変更について">
          <p>
            {recommendations.length === 0
              ? '今の条件にぴったり合う本は、まだ登録されていませんでした。'
              : `今の条件に合う本は${recommendations.length}冊でした。`}
            条件を勝手にゆるめることはしていません。次のどれかを試してみてください。
          </p>
          <div className="stack">
            {result.suggestions
              .filter((s) => s.availableCount > 0)
              .map((s) => (
                <div key={s.question} className="card">
                  <p className="small" style={{ marginBottom: 8 }}>
                    {s.message}
                  </p>
                  <button type="button" className="btn btn--small btn--block" onClick={() => onApplySuggestion(s)}>
                    この条件で探す
                  </button>
                </div>
              ))}
            <button type="button" className="btn btn--block" onClick={onRestart}>
              質問に最初から答え直す
            </button>
          </div>
        </section>
      )}

      <div className="stack">
        {recommendations.map((rec) => (
          <BookCard key={rec.book.book_id} rec={rec} />
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="stack" style={{ marginTop: 24 }}>
          <p className="muted small">
            「読んだことがある」「好みと違う」を押した本は、次回のおすすめから外れます。
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={onRefresh}>
            同じ答えで、もう一度おすすめを出す
          </button>
          {!insufficient && (
            <button type="button" className="btn btn--block" onClick={onRestart}>
              質問に最初から答え直す
            </button>
          )}
        </div>
      )}
    </>
  );
}
