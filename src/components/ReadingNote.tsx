// 読んだ本の記録（読んだ日・★評価・ひとことメモ）の入力と表示

import { useEffect, useState } from 'react';
import { MEMO_MAX, useLibrary, type ReadingNote } from '../state/library.tsx';

/** 例：「2026年11月23日」 */
export function formatReadDate(readAt: string): string {
  const [y, m, d] = readAt.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function Stars({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <span className="stars" aria-label={`評価：★${rating}`}>
      {'★'.repeat(rating)}
      <span className="stars__off">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

/** 本棚の読んだ本の一覧に出す、記録の短い表示 */
export function NoteSummary({ note }: { note?: ReadingNote }) {
  if (!note) return null;
  return (
    <div className="note-summary">
      {(note.readAt || note.rating) && (
        <p className="note-summary__line">
          {note.readAt && <span>{formatReadDate(note.readAt)}に読んだ</span>}
          {note.readAt && note.rating && '　'}
          <Stars rating={note.rating} />
        </p>
      )}
      {note.memo && <p className="note-summary__memo">{note.memo}</p>}
    </div>
  );
}

/** 本の詳しい画面の「読書メモ」 */
export function ReadingNoteEditor({ bookId }: { bookId: string }) {
  const lib = useLibrary();
  const note = lib.state.notes[bookId] ?? {};
  const [memo, setMemo] = useState(note.memo ?? '');
  const [saved, setSaved] = useState(false);
  // ほかの画面・タブで変わったときに合わせる
  useEffect(() => setMemo(lib.state.notes[bookId]?.memo ?? ''), [bookId, lib.state.notes]);

  const save = (patch: ReadingNote) => {
    lib.setNote(bookId, { ...note, memo, ...patch });
    setSaved(true);
  };

  return (
    <section className="note-box" aria-labelledby="note-title">
      <h2 id="note-title" className="note-box__title">
        読書メモ
      </h2>
      <label className="note-field">
        <span>読んだ日</span>
        <input
          type="date"
          value={note.readAt ?? ''}
          max="2100-12-31"
          onChange={(e) => save({ readAt: e.target.value || undefined })}
        />
      </label>
      <div className="note-field">
        <span id="note-rating">評価</span>
        <div className="star-input" role="group" aria-labelledby="note-rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`star-input__btn${note.rating && n <= note.rating ? ' is-on' : ''}`}
              aria-label={`★${n}`}
              aria-pressed={note.rating === n}
              // 同じ★をもう一度押すと評価を消す
              onClick={() => save({ rating: note.rating === n ? undefined : n })}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <label className="note-field note-field--memo">
        <span>ひとことメモ</span>
        <textarea
          value={memo}
          maxLength={MEMO_MAX}
          rows={3}
          placeholder="感想や、心に残ったことなど"
          onChange={(e) => {
            setMemo(e.target.value);
            setSaved(false);
          }}
          onBlur={() => {
            if (memo !== (note.memo ?? '')) save({ memo });
          }}
        />
      </label>
      <div className="note-actions">
        <button type="button" className="btn btn--small btn--primary" onClick={() => save({ memo })}>
          メモを保存
        </button>
        <span className="muted small" role="status">
          {saved ? '保存しました' : `${memo.length}/${MEMO_MAX}文字`}
        </span>
      </div>
    </section>
  );
}
