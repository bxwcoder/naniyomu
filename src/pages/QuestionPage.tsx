// 画面2：質問ページ（1画面に1問）

import { QUESTIONS } from '../data/options.ts';
import type { Answers } from '../types.ts';

export type QuestionKey = (typeof QUESTIONS)[number]['key'];

interface Props {
  index: number;
  answers: Partial<Answers>;
  onAnswer: (key: QuestionKey, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function QuestionPage({ index, answers, onAnswer, onBack, onNext }: Props) {
  const q = QUESTIONS[index];
  const total = QUESTIONS.length;
  const selected = answers[q.key];
  const headingId = `q-${q.key}`;

  return (
    <>
      <div className="progress">
        <span>
          質問 {index + 1} / {total}
        </span>
        <div
          className="progress__bar"
          role="progressbar"
          aria-label="質問の進み具合"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
        >
          <div className="progress__fill" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <span>{index + 1 < total ? `あと${total - index - 1}問` : '最後'}</span>
      </div>

      <h1 id={headingId}>{q.text}</h1>

      <ul className="choices" role="radiogroup" aria-labelledby={headingId}>
        {q.choices.map((c) => (
          <li key={c.value}>
            <button
              type="button"
              role="radio"
              aria-checked={selected === c.value}
              className="choice"
              onClick={() => onAnswer(q.key, c.value)}
            >
              <span className="choice__mark" aria-hidden="true" />
              {c.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="nav-row">
        <button type="button" className="btn btn--small" onClick={onBack}>
          ← {index === 0 ? 'トップへ' : '前の質問'}
        </button>
        {selected && (
          <button type="button" className="btn btn--small btn--primary" onClick={onNext}>
            {index + 1 < total ? '次の質問 →' : '次へ →'}
          </button>
        )}
      </div>
    </>
  );
}
