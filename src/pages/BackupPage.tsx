// 画面：記録のバックアップ・引っ越し
// お気に入り・読んだ本・履歴・選んだ図書館を、ファイルかコードにして保存し、別のスマホなどで読み込めます。

import { useRef, useState } from 'react';
import { paths } from '../hooks/useHashRoute.ts';
import {
  backupCounts,
  backupToCode,
  backupToJson,
  createBackup,
  mergeLibraries,
  parseBackup,
  type Backup,
} from '../state/backup.ts';
import { useLibrary } from '../state/library.tsx';
import { browserStore, loadCalilSetting, saveCalilSetting, saveLibrary } from '../state/storage.ts';

function todayStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

export function BackupPage() {
  const lib = useLibrary();
  const store = useRef(browserStore()).current;
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counts = backupCounts(lib.state);

  const current = () => createBackup(lib.state, loadCalilSetting(store));

  const download = () => {
    const blob = new Blob([backupToJson(current())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `naniyomu-backup-${todayStamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const showCode = async () => {
    const c = backupToCode(current());
    setCode(c);
    setCopied(false);
    try {
      await navigator.clipboard.writeText(c);
      setCopied(true);
    } catch {
      // コピーできない環境では、表示したコードを長押しでコピーしてもらう
    }
  };

  const check = (text: string) => {
    const b = parseBackup(text);
    setPending(b);
    setError(b ? null : 'ナニヨムのバックアップとして読み込めませんでした。コードを最後までコピーしたか確かめてください。');
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) check(await file.text());
    e.target.value = '';
  };

  const restore = (mode: 'merge' | 'replace') => {
    if (!pending) return;
    if (mode === 'replace' && !window.confirm('今の記録を消して、バックアップの内容に置き換えます。よろしいですか？')) return;
    const library = mode === 'merge' ? mergeLibraries(lib.state, pending.library) : pending.library;
    saveLibrary(store, library);
    if (pending.calil && (mode === 'replace' || !loadCalilSetting(store))) saveCalilSetting(store, pending.calil);
    // 読み込んだ内容でアプリを開き直す
    window.location.replace(paths.saved);
    window.location.reload();
  };

  const p = pending ? backupCounts(pending.library) : null;

  return (
    <>
      <h1>記録のバックアップ</h1>
      <p className="muted small">
        {'お気に入り・読んだ本・履歴・選んだ図書館は、このスマホのブラウザの中にだけ保存されています。' +
          '機種変更やブラウザのデータ削除で消えないよう、ときどき保存しておくと安心です。'}
      </p>

      <section className="card backup-box" aria-labelledby="backup-save">
        <h2 id="backup-save">保存する</h2>
        <p className="small">
          いまの記録：お気に入り {counts.favorites}冊・読んだ本 {counts.read}冊・履歴 {counts.history}件
        </p>
        <div className="stack">
          <button type="button" className="btn btn--primary btn--block" onClick={download}>
            ファイルに保存する
          </button>
          <button type="button" className="btn btn--block" onClick={showCode}>
            コードを作る（別のスマホに送る用）
          </button>
        </div>
        {code && (
          <div className="backup-code">
            <p className="small" role="status">
              {copied
                ? 'コードをコピーしました。LINEやメモに貼って、別のスマホに送ってください。'
                : '下のコードを長押しして全部コピーし、LINEやメモに貼って送ってください。'}
            </p>
            <textarea readOnly value={code} rows={4} onFocus={(e) => e.currentTarget.select()} aria-label="バックアップのコード" />
          </div>
        )}
      </section>

      <section className="card backup-box" aria-labelledby="backup-load">
        <h2 id="backup-load">読み込む</h2>
        <label className="btn btn--block backup-file">
          保存したファイルを選ぶ
          <input type="file" accept=".json,application/json" onChange={onFile} />
        </label>
        <p className="small muted" style={{ margin: '10px 0 4px' }}>
          または、コードを貼り付け：
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          placeholder="NANIYOMU1: で始まるコード"
          aria-label="バックアップのコードを貼り付け"
        />
        <button type="button" className="btn btn--block" onClick={() => check(input)} disabled={!input.trim()}>
          コードを読み込む
        </button>
        {error && <p className="notice notice--error">{error}</p>}
        {pending && p && (
          <div className="notice backup-confirm">
            <p>
              <strong>読み込む内容</strong>
              <br />
              お気に入り {p.favorites}冊・読んだ本 {p.read}冊・履歴 {p.history}件
              {pending.calil && (
                <>
                  <br />
                  図書館：{pending.calil.systemname}
                </>
              )}
              {pending.exportedAt && (
                <>
                  <br />
                  保存した日：{new Date(pending.exportedAt).toLocaleDateString('ja-JP')}
                </>
              )}
            </p>
            <div className="stack">
              <button type="button" className="btn btn--primary btn--block" onClick={() => restore('merge')}>
                今の記録と合わせる（おすすめ）
              </button>
              <button type="button" className="btn btn--block" onClick={() => restore('replace')}>
                今の記録を消して置き換える
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="muted small">
        「おすすめに何回出したか」の記録は含みません。読み込んだあとは、同じ答えでも1周目から出直します。
      </p>
    </>
  );
}
