// おすすめ結果を人に送るボタン（LINE・X・コピー・スマホの共有メニュー）

import { useState } from 'react';
import { appUrl, lineShareUrl, shareText, xShareUrl } from '../logic/share.ts';
import type { Book } from '../types.ts';

export function ShareBox({ books }: { books: Book[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = shareText(books);
  const url = appUrl();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
    } catch {
      setCopied(false);
      window.prompt('この文章をコピーしてください', `${text}\n${url}`);
    }
  };

  const shareMenu = async () => {
    try {
      await navigator.share({ title: 'ナニヨムのおすすめ', text, url });
    } catch {
      // 共有をやめたときなど。何もしない
    }
  };

  return (
    <div className="share-box">
      <button type="button" className="btn btn--block" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">📤</span> この3冊を人に送る
      </button>
      {open && (
        <div className="share-box__panel">
          <div className="share-box__buttons">
            <a className="btn btn--small share-btn share-btn--line" href={lineShareUrl(text, url)} target="_blank" rel="noopener noreferrer">
              LINEで送る
            </a>
            <a className="btn btn--small share-btn" href={xShareUrl(text, url)} target="_blank" rel="noopener noreferrer">
              Xでポスト
            </a>
            <button type="button" className="btn btn--small share-btn" onClick={copy}>
              {copied ? 'コピーしました' : '文章をコピー'}
            </button>
            {canShare && (
              <button type="button" className="btn btn--small share-btn" onClick={shareMenu}>
                ほかのアプリ
              </button>
            )}
          </div>
          <pre className="share-box__preview" aria-label="送る文章">
            {text}
            {'\n'}
            {url}
          </pre>
        </div>
      )}
    </div>
  );
}
