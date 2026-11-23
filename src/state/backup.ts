// 記録のバックアップと引っ越し
// お気に入り・読んだ本・反応・履歴・選んだ図書館を、1つのファイル（または文字のコード）にまとめます。
// 機種変更やブラウザのデータ削除で消えても、これを読み込めば元に戻せます。サーバーは使いません。

import { HISTORY_LIMIT, type HistoryEntry, type LibraryState, type ReactionType } from './library.tsx';
import { parseCalilSetting, parseLibrary, type CalilSetting } from './storage.ts';

/** コードの先頭に付ける目印（ほかの文字と区別するため） */
export const CODE_PREFIX = 'NANIYOMU1:';

export interface Backup {
  app: 'naniyomu';
  version: 1;
  /** 作った日時（ISO 形式） */
  exportedAt: string;
  library: LibraryState;
  calil: CalilSetting | null;
}

export function createBackup(library: LibraryState, calil: CalilSetting | null, now = new Date()): Backup {
  return { app: 'naniyomu', version: 1, exportedAt: now.toISOString(), library, calil };
}

/** ファイルに保存する中身（人が読んでも分かる JSON） */
export function backupToJson(backup: Backup): string {
  return JSON.stringify(backup, null, 1);
}

/** 文字のコード（LINE やメモに貼って別のスマホに送れる形） */
export function backupToCode(backup: Backup): string {
  const bytes = new TextEncoder().encode(JSON.stringify(backup));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return CODE_PREFIX + btoa(binary);
}

/** ファイルの中身かコードを読み込む。ナニヨムのバックアップでなければ null */
export function parseBackup(text: string): Backup | null {
  const trimmed = text.trim();
  let raw: unknown;
  try {
    if (trimmed.startsWith(CODE_PREFIX)) {
      const binary = atob(trimmed.slice(CODE_PREFIX.length).replace(/\s/g, ''));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } else {
      raw = JSON.parse(trimmed);
    }
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.app !== 'naniyomu' || r.version !== 1) return null;
  return {
    app: 'naniyomu',
    version: 1,
    exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '',
    // 中身は保存データと同じ確認をして、使える部分だけ読む
    library: parseLibrary(r.library),
    calil: parseCalilSetting(r.calil),
  };
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/**
 * 今の記録とバックアップを合わせる（どちらにある本も残す）。
 * 履歴は、今お気に入り・読んだ本に入っている本の分を除き、新しい順に並べ直す。
 */
export function mergeLibraries(current: LibraryState, incoming: LibraryState): LibraryState {
  const favorites = union(current.favorites, incoming.favorites);
  const read = union(current.read, incoming.read);
  const reactions: Record<string, ReactionType[]> = { ...current.reactions };
  for (const [id, rs] of Object.entries(incoming.reactions)) {
    reactions[id] = [...new Set([...(reactions[id] ?? []), ...rs])];
  }
  const byKey = new Map<string, HistoryEntry>();
  for (const h of [...current.history, ...incoming.history]) {
    const key = `${h.from}:${h.bookId}`;
    const prev = byKey.get(key);
    if (!prev || h.at > prev.at) byKey.set(key, h);
  }
  // 読書メモ：今の記録にある内容を優先し、空いているところをバックアップで埋める
  const notes = { ...incoming.notes };
  for (const [id, n] of Object.entries(current.notes)) notes[id] = { ...incoming.notes[id], ...n };
  const history = [...byKey.values()]
    .filter((h) => !(h.from === 'favorites' ? favorites : read).includes(h.bookId))
    .sort((a, b) => b.at - a.at)
    .slice(0, HISTORY_LIMIT);
  return { favorites, read, reactions, history, notes };
}

/** 確認画面に出す冊数 */
export function backupCounts(library: LibraryState) {
  return { favorites: library.favorites.length, read: library.read.length, history: library.history.length };
}
