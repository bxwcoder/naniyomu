// カーリルの図書館API で、選んだ図書館の貸出状況を調べる
// 仕様：https://calil.jp/doc/api_ref.html
// - 図書館データベース（/library）：都道府県・市区町村から図書館の一覧を取る
// - 蔵書検索（/check）：ISBN と図書館のシステムIDから、貸出状況を取る。
//   時間がかかる図書館があるので、continue が 1 のあいだは2秒以上あけて問い合わせ直す（ポーリング）
// 決まり：図書館名や貸出状況を表示するときは、必ずカーリルのページへのリンクを付ける

import type { Book } from '../types.ts';
import { isbn13To10, isValidIsbn13 } from './isbn.ts';

const API = 'https://api.calil.jp';
/** ポーリングの間隔（仕様で2秒以上） */
export const POLL_INTERVAL_MS = 2500;
/** 1回の問い合わせで調べられる本の数の上限（仕様：1セッション100書籍リクエストまで。図書館は1つだけ選ぶ） */
export const MAX_BOOKS_PER_SESSION = 100;
/** 結果が出ない図書館をいつまで待つか */
export const MAX_POLLS = 15;

export const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県',
  '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
] as const;

/** 選んだ図書館（図書館システム。市内の図書館がまとめて1つのことが多い） */
export interface LibrarySystem {
  systemid: string;
  systemname: string;
  /** その図書館システムに入っている図書館の名前（略称） */
  libraries: string[];
}

interface CalilLibrary {
  systemid: string;
  systemname: string;
  short: string;
  formal: string;
  category: string;
}

/** 図書館データベースの結果を、図書館システムごとにまとめる（移動図書館・図書室は名前の一覧から外す） */
export function groupLibraries(list: CalilLibrary[]): LibrarySystem[] {
  const map = new Map<string, LibrarySystem>();
  for (const lib of list) {
    const sys = map.get(lib.systemid) ?? { systemid: lib.systemid, systemname: lib.systemname, libraries: [] };
    if (lib.category !== 'BM') sys.libraries.push(lib.short || lib.formal);
    map.set(lib.systemid, sys);
  }
  return [...map.values()];
}

/** 都道府県（と市区町村）の図書館システムの一覧を取る */
export async function fetchLibrarySystems(
  appkey: string,
  pref: string,
  city: string,
  fetcher: typeof fetch = fetch,
): Promise<LibrarySystem[]> {
  const params = new URLSearchParams({ appkey, pref, format: 'json', callback: '' });
  if (city.trim()) params.set('city', city.trim());
  const res = await fetcher(`${API}/library?${params}`);
  if (!res.ok) throw new Error(`図書館の一覧を取れませんでした（${res.status}）`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('図書館の一覧の形が想定と違います');
  return groupLibraries(data as CalilLibrary[]);
}

/** 1冊分の結果（カーリルの形のまま） */
export interface CalilSystemResult {
  status: 'OK' | 'Cache' | 'Running' | 'Error' | string;
  reserveurl?: string;
  libkey?: Record<string, string>;
}
/** ISBN → 結果 */
export type CheckResults = Record<string, CalilSystemResult>;

interface CheckResponse {
  session?: string;
  continue?: number;
  books?: Record<string, Record<string, CalilSystemResult>>;
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('中止しました', 'AbortError'));
    });
  });

/**
 * 本（ISBN）の貸出状況を、1つの図書館システムで調べる。
 * 途中経過が出るたびに onUpdate を呼ぶ（遅い図書館を待たずに、分かった分から表示するため）。
 */
export async function checkAvailability(
  appkey: string,
  systemid: string,
  isbns: string[],
  onUpdate: (results: CheckResults) => void,
  options: { fetcher?: typeof fetch; signal?: AbortSignal; interval?: number } = {},
): Promise<CheckResults> {
  const fetcher = options.fetcher ?? fetch;
  const interval = Math.max(options.interval ?? POLL_INTERVAL_MS, 0);
  const all: CheckResults = {};
  const unique = [...new Set(isbns)];
  for (let i = 0; i < unique.length; i += MAX_BOOKS_PER_SESSION) {
    const chunk = unique.slice(i, i + MAX_BOOKS_PER_SESSION);
    let params = new URLSearchParams({ appkey, isbn: chunk.join(','), systemid, format: 'json', callback: 'no' });
    for (let poll = 0; poll <= MAX_POLLS; poll++) {
      const res = await fetcher(`${API}/check?${params}`, { signal: options.signal });
      if (!res.ok) throw new Error(`貸出状況を取れませんでした（${res.status}）`);
      const data = (await res.json()) as CheckResponse;
      for (const [isbn, systems] of Object.entries(data.books ?? {})) {
        if (systems[systemid]) all[isbn] = systems[systemid];
      }
      onUpdate({ ...all });
      if (!data.continue || !data.session) break;
      await wait(interval, options.signal);
      params = new URLSearchParams({ appkey, session: data.session, format: 'json', callback: 'no' });
    }
  }
  return all;
}

// ---- 表示用のまとめ ----

/** 貸出状況の並び順（よい順）。カーリルの仕様の8分類 */
const STATUS_ORDER = ['貸出可', '蔵書あり', '館内のみ', '貸出中', '予約中', '準備中', '休館中'] as const;

export type AvailabilityKind = 'available' | 'owned' | 'busy' | 'none' | 'checking' | 'error';

export interface AvailabilitySummary {
  kind: AvailabilityKind;
  /** 例：「貸出可」「貸出中」「蔵書なし」「確認中…」 */
  label: string;
  /** その状況の図書館の名前（libkey） */
  libraries: string[];
  /** ほかの状況の図書館の数 */
  others: number;
  reserveurl: string | null;
}

/** 1冊分の結果を、いちばんよい状況でまとめる（例：貸出可が1館でもあれば「貸出可」） */
export function summarize(result: CalilSystemResult | undefined): AvailabilitySummary {
  const base = { libraries: [], others: 0, reserveurl: null };
  if (!result || result.status === 'Running') return { ...base, kind: 'checking', label: '確認中…' };
  if (result.status === 'Error') return { ...base, kind: 'error', label: '図書館の検索でエラー' };
  const entries = Object.entries(result.libkey ?? {}).filter(([, v]) => v !== '蔵書なし');
  const reserveurl = result.reserveurl || null;
  if (entries.length === 0) return { ...base, kind: 'none', label: '蔵書なし', reserveurl };
  const rank = (v: string) => {
    const i = (STATUS_ORDER as readonly string[]).indexOf(v);
    return i === -1 ? STATUS_ORDER.length : i; // 図書館独自の値（行方不明など）はいちばん後ろ
  };
  const best = entries.reduce((a, b) => (rank(b[1]) < rank(a[1]) ? b : a))[1];
  const libraries = entries.filter(([, v]) => v === best).map(([k]) => k);
  const kind: AvailabilityKind = best === '貸出可' ? 'available' : best === '蔵書あり' || best === '館内のみ' ? 'owned' : 'busy';
  return { kind, label: best, libraries, others: entries.length - libraries.length, reserveurl };
}

// ---- カーリルへのリンク（仕様で必須） ----

/** カーリルの本のページ（https://calil.jp/book/{ISBN10}）。10けたにできない ISBN は OpenURL で開く */
export function calilBookUrl(isbn13: string): string {
  const isbn10 = isbn13To10(isbn13);
  return isbn10 ? `https://calil.jp/book/${isbn10}` : `https://api.calil.jp/openurl?rft.isbn=${isbn13}`;
}

/** カーリルの図書館のページ */
export function calilLibraryUrl(systemid: string, libkey: string): string {
  return `https://calil.jp/library/search?s=${encodeURIComponent(systemid)}&k=${encodeURIComponent(libkey)}`;
}

/** 貸出状況を調べられる本の ISBN（ISBN のない本は調べられない） */
export function checkableIsbn(book: Pick<Book, 'isbn'>): string | null {
  return book.isbn && isValidIsbn13(book.isbn) ? book.isbn : null;
}
