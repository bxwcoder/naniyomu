// 書影（本の表紙画像）
// 画像が登録されていない、または読み込めない場合は、タイトルの頭文字を入れた表紙風の四角を表示します。

import { useState } from 'react';
import type { Book } from '../types.ts';

// 本ごとに色を変えて、並んだときに見分けやすくする
const COVER_COLORS = ['#2f5d50', '#9c4a2f', '#3f5a7a', '#7a5a2f', '#5b4a72', '#4a6b3a'];

function colorFor(id: string): string {
  let sum = 0;
  for (const ch of id) sum += ch.charCodeAt(0);
  return COVER_COLORS[sum % COVER_COLORS.length];
}

export function BookCover({ book, large = false }: { book: Book; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const showImage = book.cover_image_url && !failed;
  return (
    <div className={`cover${large ? ' cover--large' : ''}`} aria-hidden="true">
      {showImage ? (
        <img src={book.cover_image_url!} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="cover__placeholder" style={{ background: colorFor(book.book_id) }}>
          {book.title.charAt(0)}
        </div>
      )}
    </div>
  );
}
