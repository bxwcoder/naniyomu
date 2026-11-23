// 本棚のお気に入りに、選んだ図書館での貸出状況を出す部品（カーリルの図書館API）
// - 図書館は、都道府県と市区町村から探して1つ選ぶ（この端末に保存）
// - 貸出状況は、分かった本から順に表示する（遅い図書館は20秒以上かかることがある）
// - 図書館名・貸出状況には、カーリルの決まりどおりカーリルのページへのリンクを付ける

import { useEffect, useRef, useState } from 'react';
import { CALIL_APPKEY } from '../config/calil.ts';
import type { Book } from '../types.ts';
import {
  checkableIsbn,
  calilBookUrl,
  calilLibraryUrl,
  checkAvailability,
  fetchLibrarySystems,
  PREFECTURES,
  summarize,
  type CheckResults,
  type LibrarySystem,
} from '../logic/calil.ts';
import { browserStore, loadCalilSetting, saveCalilSetting, type CalilSetting } from '../state/storage.ts';

/** 貸出状況の機能が使えるか（アプリケーションキーが設定されているか） */
export const calilEnabled = () => CALIL_APPKEY.trim() !== '';

/** 同じ図書館・同じ本を、画面を行き来するたびに問い合わせないための一時的な保存（10分） */
const CACHE_MS = 10 * 60 * 1000;
let cache: { systemid: string; at: number; results: CheckResults } | null = null;

/**
 * おすすめを選ぶ前に、候補の本が選んだ図書館で今借りられるかを調べる（10分の一時保存も使う）。
 * 遅い図書館を待ちすぎないよう、timeoutMs までに分かった分だけで決める。
 * 返すのは「貸出可」の本のID。
 */
export async function findAvailableBooks(systemid: string, books: Book[], timeoutMs = 12000): Promise<Set<string>> {
  const fresh = cache && cache.systemid === systemid && Date.now() - cache.at < CACHE_MS ? cache : null;
  let results: CheckResults = { ...(fresh?.results ?? {}) };
  const missing = books
    .map(checkableIsbn)
    .filter((i): i is string => i !== null && (!results[i] || results[i].status === 'Running'));
  if (missing.length > 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const done = await checkAvailability(CALIL_APPKEY, systemid, missing, (partial) => {
        results = { ...results, ...partial };
      }, { signal: controller.signal });
      results = { ...results, ...done };
    } catch (e) {
      // 時間切れ・通信の失敗：分かった分だけで決める
      if (!(e instanceof DOMException && e.name === 'AbortError')) console.error(e);
    } finally {
      clearTimeout(timer);
    }
    cache = { systemid, at: Date.now(), results: { ...(fresh?.results ?? {}), ...results } };
  }
  const ids = new Set<string>();
  for (const b of books) {
    const isbn = checkableIsbn(b);
    if (isbn && summarize(results[isbn]).kind === 'available') ids.add(b.book_id);
  }
  return ids;
}

/** 選んだ図書館と、お気に入りの本の貸出状況 */
export function useAvailability(isbns: string[]) {
  const store = useRef(browserStore()).current;
  const [setting, setSettingState] = useState<CalilSetting | null>(() => loadCalilSetting(store));
  const [results, setResults] = useState<CheckResults>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isbnKey = [...new Set(isbns)].sort().join(',');

  const setSetting = (s: CalilSetting | null) => {
    saveCalilSetting(store, s);
    cache = null;
    setResults({});
    setSettingState(s);
  };

  useEffect(() => {
    if (!calilEnabled() || !setting || !isbnKey) return;
    const wanted = isbnKey.split(',');
    const fresh = cache && cache.systemid === setting.systemid && Date.now() - cache.at < CACHE_MS ? cache : null;
    const missing = wanted.filter((i) => !fresh?.results[i] || fresh.results[i].status === 'Running');
    if (fresh) setResults(fresh.results);
    if (missing.length === 0) return;
    const controller = new AbortController();
    const base = fresh?.results ?? {};
    setRunning(true);
    setError(null);
    checkAvailability(CALIL_APPKEY, setting.systemid, missing, (partial) => setResults({ ...base, ...partial }), {
      signal: controller.signal,
    })
      .then((done) => {
        cache = { systemid: setting.systemid, at: Date.now(), results: { ...base, ...done } };
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        console.error(e);
        setError('貸出状況を調べられませんでした。通信状態を確認して、もう一度お試しください。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRunning(false);
      });
    return () => controller.abort();
  }, [setting, isbnKey, refreshKey]);

  const refresh = () => {
    cache = null;
    setResults({});
    setRefreshKey((k) => k + 1);
  };
  return { setting, setSetting, results, running, error, refresh };
}

/** 1冊分の貸出状況（例：「貸出可：中央・駅前 ほか1館」） */
export function AvailabilityLine({ isbn, systemid, results }: { isbn: string | null; systemid: string; results: CheckResults }) {
  if (!isbn) return <p className="avail avail--none">ISBNがないため、貸出状況を調べられません</p>;
  const s = summarize(results[isbn]);
  const shown = s.libraries.slice(0, 2);
  return (
    <p className={`avail avail--${s.kind}`}>
      <a href={calilBookUrl(isbn)} target="_blank" rel="noopener noreferrer" className="avail__label">
        {s.label}
      </a>
      {shown.length > 0 && '：'}
      {shown.map((lib, i) => (
        <span key={lib}>
          {i > 0 && '・'}
          <a href={calilLibraryUrl(systemid, lib)} target="_blank" rel="noopener noreferrer">
            {lib}
          </a>
        </span>
      ))}
      {s.libraries.length > shown.length && ` ほか${s.libraries.length - shown.length}館`}
      {s.reserveurl && s.kind !== 'none' && (
        <>
          {' '}
          <a href={s.reserveurl} target="_blank" rel="noopener noreferrer" className="avail__reserve">
            予約ページ
          </a>
        </>
      )}
    </p>
  );
}

/** 図書館を選ぶ（都道府県・市区町村で探して、一覧から選ぶ） */
export function LibraryPicker({
  initial,
  onSelect,
  onCancel,
}: {
  initial: CalilSetting | null;
  onSelect: (s: CalilSetting) => void;
  onCancel?: () => void;
}) {
  const [pref, setPref] = useState(initial?.pref || '東京都');
  const [city, setCity] = useState(initial?.city ?? '');
  const [systems, setSystems] = useState<LibrarySystem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setSystems(await fetchLibrarySystems(CALIL_APPKEY, pref, city));
    } catch (err) {
      console.error(err);
      setError('図書館の一覧を取れませんでした。通信状態を確認して、もう一度お試しください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lib-picker">
      <form className="lib-picker__form" onSubmit={search}>
        <label>
          都道府県
          <select value={pref} onChange={(e) => setPref(e.target.value)}>
            {PREFECTURES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          市区町村（任意）
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="例：世田谷区" />
        </label>
        <div className="row">
          <button type="submit" className="btn btn--small btn--primary" disabled={loading}>
            {loading ? '探しています…' : '図書館を探す'}
          </button>
          {onCancel && (
            <button type="button" className="btn btn--small" onClick={onCancel}>
              やめる
            </button>
          )}
        </div>
      </form>
      {error && <p className="notice notice--error">{error}</p>}
      {systems && systems.length === 0 && <p className="muted small">図書館が見つかりませんでした。市区町村の書き方を変えてみてください。</p>}
      {systems && systems.length > 0 && (
        <ul className="lib-picker__list">
          {systems.map((s) => (
            <li key={s.systemid}>
              <button
                type="button"
                className="btn btn--small btn--block lib-picker__choice"
                onClick={() => onSelect({ systemid: s.systemid, systemname: s.systemname, pref, city })}
              >
                <span className="lib-picker__name">{s.systemname}</span>
                {s.libraries.length > 0 && (
                  <span className="lib-picker__libs">
                    {s.libraries.slice(0, 4).join('・')}
                    {s.libraries.length > 4 && ` ほか${s.libraries.length - 4}館`}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        図書館の情報：
        <a href="https://calil.jp/" target="_blank" rel="noopener noreferrer">
          カーリル
        </a>
      </p>
    </div>
  );
}
