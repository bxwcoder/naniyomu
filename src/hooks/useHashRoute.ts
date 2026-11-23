// 画面の切り替え
// URLの「#」より後ろ（例: #/q/2）で、今どの画面かを決めています。
// こうすると、ブラウザやスマートフォンの「戻る」ボタンがそのまま使えます。

import { useEffect, useState } from 'react';

export type Route =
  | { name: 'top' }
  | { name: 'question'; index: number }
  | { name: 'results' }
  | { name: 'book'; id: string }
  | { name: 'shelf'; tab: 'favorites' | 'read' | 'history' }
  | { name: 'backup' }
  | { name: 'search' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  let m = path.match(/^\/q\/(\d)$/);
  if (m) return { name: 'question', index: Number(m[1]) - 1 };
  m = path.match(/^\/book\/([\w-]+)$/);
  if (m) return { name: 'book', id: m[1] };
  if (path === '/results') return { name: 'results' };
  if (path === '/saved') return { name: 'shelf', tab: 'favorites' };
  if (path === '/read') return { name: 'shelf', tab: 'read' };
  if (path === '/history') return { name: 'shelf', tab: 'history' };
  if (path === '/backup') return { name: 'backup' };
  if (path === '/search') return { name: 'search' };
  return { name: 'top' };
}

export const paths = {
  top: '#/',
  question: (index: number) => `#/q/${index + 1}`,
  results: '#/results',
  book: (id: string) => `#/book/${id}`,
  saved: '#/saved',
  read: '#/read',
  history: '#/history',
  backup: '#/backup',
  search: '#/search',
};

// アプリの中で何画面目か（最初に開いた画面が 0）を、ブラウザの履歴の各項目に書いておく。
// リンクで移動しても、ボタンで移動しても、ブラウザの「戻る」で戻っても正しく数えられる。
// 0 の画面で「戻る」を押すと外のページに出てしまうので、そのときは決めておいた画面へ移動する。
const DEPTH_KEY = 'naniyomuDepth';
let currentDepth = 0;
let replacing = false;

function readDepth(): number | undefined {
  const state = window.history.state as Record<string, unknown> | null;
  const d = state?.[DEPTH_KEY];
  return typeof d === 'number' ? d : undefined;
}

function writeDepth(depth: number): void {
  const state = (window.history.state as Record<string, unknown> | null) ?? {};
  window.history.replaceState({ ...state, [DEPTH_KEY]: depth }, '');
  currentDepth = depth;
}

/** 画面が変わったとき：新しい履歴なら「前の画面 + 1」、戻った・進んだ履歴なら書いてある数を使う */
function onHashMoved(): void {
  const known = readDepth();
  if (known !== undefined) currentDepth = known;
  else writeDepth(replacing ? currentDepth : currentDepth + 1);
  replacing = false;
}

/** 今が何画面目か（テスト・確認用） */
export function historyDepth(): number {
  return currentDepth;
}

export function navigate(path: string, { replace = false } = {}): void {
  if (replace) {
    replacing = true;
    window.location.replace(path);
  } else {
    window.location.hash = path;
  }
}

/** 前の画面に戻る。アプリ内の履歴がなければ fallback の画面へ移動する */
export function goBack(fallback: string): void {
  if (currentDepth > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    // 最初に開いた画面（読み込み直したときは、書いておいた数をそのまま使う）
    const known = readDepth();
    if (known === undefined) writeDepth(0);
    else currentDepth = known;
    const onChange = () => {
      onHashMoved();
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
