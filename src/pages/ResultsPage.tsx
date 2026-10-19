// 画面4：おすすめ結果
// 3冊を縦に並べると1画面に収まらないので、上のタブで1冊ずつ切り替えます。
// カードを左右にスワイプしても切り替えられます。

import { useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import { BookCard, ROLE_LABELS } from '../components/BookCard.tsx';
import type { RecommendResult, RelaxSuggestion } from '../types.ts';

interface Props {
  result: RecommendResult;
  onApplySuggestion: (s: RelaxSuggestion) => void;
  onRefresh: () => void;
  onRestart: () => void;
}

const SUGGESTION_LABELS: Record<RelaxSuggestion['question'], string> = {
  genre: 'ジャンルを問わない',
  difficulty: '読みやすさを気にしない',
};

/** 指を横に何px動かしたら「スワイプ」とみなすか */
const SWIPE_THRESHOLD = 50;

export function ResultsPage({ result, onApplySuggestion, onRefresh, onRestart }: Props) {
  const { recommendations } = result;
  const insufficient = result.status === 'insufficient';
  const [current, setCurrent] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = recommendations.length;
  const index = Math.min(current, Math.max(count - 1, 0));

  const select = (i: number, focus = false) => {
    const next = (i + count) % count;
    setCurrent(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') select(index + 1, true);
    if (e.key === 'ArrowLeft') select(index - 1, true);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || count < 2) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 縦のスクロールと区別するため、横の動きが大きいときだけ切り替える
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      select(dx < 0 ? index + 1 : index - 1);
    }
  };

  const shown = recommendations[index];

  return (
    <>
      {/* 3冊のときはタブで分かるので、見出しは読み上げ用にだけ残す */}
      <h1 className={insufficient ? 'result-title' : 'visually-hidden'}>
        {!insufficient
          ? 'あなたへのおすすめ3冊'
          : count === 0
            ? '今の条件に合う本は、まだありません'
            : `今の条件に合う本は${count}冊でした`}
      </h1>


      {insufficient && (
        <section className="notice" aria-label="条件を変えて探す">
          {result.suggestions
            .filter((s) => s.availableCount > 0)
            .map((s) => (
              <div key={s.question} className="suggestion">
                <span>
                  {SUGGESTION_LABELS[s.question]}
                  <strong>（{s.availableCount}冊）</strong>
                </span>
                <button type="button" className="btn btn--small" onClick={() => onApplySuggestion(s)}>
                  この条件で探す
                </button>
              </div>
            ))}
        </section>
      )}

      {count > 1 && (
          <div
            className="book-tabs"
            role="tablist"
            aria-label="おすすめの本"
            style={{ '--tab-count': count } as React.CSSProperties}
          >
            {recommendations.map((rec, i) => (
              <button
                key={rec.book.book_id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`book-tab-${i}`}
                aria-selected={i === index}
                aria-controls="book-panel"
                tabIndex={i === index ? 0 : -1}
                className="book-tab"
                onClick={() => select(i)}
                onKeyDown={onTabKey}
              >
                <strong>{i + 1}冊目</strong>
                <span>{ROLE_LABELS[rec.role]}</span>
              </button>
            ))}
          </div>
      )}

      {count > 0 && (
          <div
            id="book-panel"
            role={count > 1 ? 'tabpanel' : undefined}
            aria-labelledby={count > 1 ? `book-tab-${index}` : undefined}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <BookCard key={shown.book.book_id} rec={shown} />
          </div>
      )}

      <div className="result-footer">
        {count > 0 && (
          <button type="button" className="btn btn--small" onClick={onRefresh}>
            選び直す
          </button>
        )}
        <button
          type="button"
          className="btn btn--small"
          style={count > 0 ? undefined : { gridColumn: '1 / -1' }}
          onClick={onRestart}
        >
          質問に答え直す
        </button>
      </div>
    </>
  );
}
