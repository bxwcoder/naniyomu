// 画面3：好きだった本の入力（任意）

import { useId } from 'react';

interface Props {
  text: string;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  onBack: () => void;
}

export function FavoritePage({ text, onChange, onSubmit, onBack }: Props) {
  const inputId = useId();
  const hintId = useId();
  return (
    <>
      <p className="muted small" style={{ marginBottom: 4 }}>
        追加の質問（入力しなくても大丈夫です）
      </p>
      <h1>最近、面白かった本はありますか？</h1>

      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(text);
        }}
      >
        <div className="field">
          <label htmlFor={inputId}>本のタイトルや、気に入ったところ</label>
          <textarea
            id={inputId}
            aria-describedby={hintId}
            value={text}
            maxLength={300}
            placeholder="例：バッタを倒しにアフリカへ。実体験を面白く読める本が好き。"
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <p id={hintId} className="muted small" style={{ margin: 0 }}>
          ナニヨムに登録済みの本なら、その本の特徴を参考にします。
        </p>
        <button type="submit" className="btn btn--primary btn--block" disabled={text.trim() === ''}>
          この内容でおすすめを見る
        </button>
        <button type="button" className="btn btn--block" onClick={() => onSubmit('')}>
          入力せずにおすすめを見る
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
          ← 前の質問に戻る
        </button>
      </form>
    </>
  );
}
