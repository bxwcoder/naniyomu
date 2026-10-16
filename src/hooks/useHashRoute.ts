// 画面の切り替え
// URLの「#」より後ろ（例: #/q/2）で、今どの画面かを決めています。
// こうすると、ブラウザやスマートフォンの「戻る」ボタンがそのまま使えます。

import { useEffect, useState } from 'react';

export type Route =
  | { name: 'top' }
  | { name: 'question'; index: number }
  | { name: 'favorite' }
  | { name: 'results' }
  | { name: 'book'; id: string }
  | { name: 'shelf'; tab: 'favorites' | 'read' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  let m = path.match(/^\/q\/(\d)$/);
  if (m) return { name: 'question', index: Number(m[1]) - 1 };
  m = path.match(/^\/book\/([\w-]+)$/);
  if (m) return { name: 'book', id: m[1] };
  if (path === '/favorite-book') return { name: 'favorite' };
  if (path === '/results') return { name: 'results' };
  if (path === '/saved') return { name: 'shelf', tab: 'favorites' };
  if (path === '/read') return { name: 'shelf', tab: 'read' };
  return { name: 'top' };
}

export const paths = {
  top: '#/',
  question: (index: number) => `#/q/${index + 1}`,
  favorite: '#/favorite-book',
  results: '#/results',
  book: (id: string) => `#/book/${id}`,
  saved: '#/saved',
  read: '#/read',
};

// アプリの中で何回画面を移動したか。0回なら「戻る」で外のページに出てしまうので使わない
let internalMoves = 0;

export function navigate(path: string, { replace = false } = {}): void {
  if (replace) {
    window.location.replace(path);
  } else {
    internalMoves += 1;
    window.location.hash = path;
  }
}

/** 前の画面に戻る。アプリ内の履歴がなければ fallback の画面へ移動する */
export function goBack(fallback: string): void {
  if (internalMoves > 0) {
    internalMoves -= 1;
    window.history.back();
  } else {
    navigate(fallback, { replace: true });
  }
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
