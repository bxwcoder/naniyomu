import { describe, expect, it } from 'vitest';
import { backupToCode, backupToJson, createBackup, mergeLibraries, parseBackup } from './backup.ts';
import { emptyLibrary, type LibraryState } from './library.tsx';

const library: LibraryState = {
  favorites: ['a', 'b'],
  read: ['c'],
  reactions: { c: ['already_read'] },
  history: [{ bookId: 'd', from: 'favorites', at: 100 }],
};
const calil = { systemid: 'Tokyo_Setagaya', systemname: '東京都世田谷区', pref: '東京都', city: '世田谷区' };

describe('記録のバックアップ', () => {
  it('ファイル（JSON）とコードのどちらからでも、元どおりに読み込める', () => {
    const backup = createBackup(library, calil, new Date('2026-11-23T00:00:00Z'));
    expect(parseBackup(backupToJson(backup))).toEqual(backup);
    const code = backupToCode(backup);
    expect(code.startsWith('NANIYOMU1:')).toBe(true);
    expect(parseBackup(code)).toEqual(backup);
    // LINE などで改行や空白が入っても読める
    expect(parseBackup(`  ${code.slice(0, 20)}\n${code.slice(20)}  `)).toEqual(backup);
  });

  it('ナニヨムのバックアップでないもの・壊れたものは読み込まない', () => {
    expect(parseBackup('')).toBeNull();
    expect(parseBackup('こんにちは')).toBeNull();
    expect(parseBackup('{"app":"other","version":1}')).toBeNull();
    expect(parseBackup('NANIYOMU1:壊れた')).toBeNull();
  });

  it('中身の一部が壊れていても、使える部分だけ読む', () => {
    const b = parseBackup(JSON.stringify({ app: 'naniyomu', version: 1, library: { favorites: ['a', 1] }, calil: 'x' }));
    expect(b?.library).toEqual({ ...emptyLibrary, favorites: [] });
    expect(b?.calil).toBeNull();
  });
});

describe('今の記録とバックアップを合わせる', () => {
  it('どちらかにある本は全部残り、重ならない', () => {
    const current: LibraryState = {
      favorites: ['b', 'x'],
      read: [],
      reactions: { c: ['finished'] },
      history: [{ bookId: 'a', from: 'favorites', at: 50 }],
    };
    const merged = mergeLibraries(current, library);
    expect(merged.favorites).toEqual(['b', 'x', 'a']);
    expect(merged.read).toEqual(['c']);
    expect(merged.reactions.c).toEqual(['finished', 'already_read']);
    // a はお気に入りに入ったので履歴から消え、d だけ残る
    expect(merged.history).toEqual([{ bookId: 'd', from: 'favorites', at: 100 }]);
  });
});
