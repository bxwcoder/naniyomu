// ネットにつながっていないときのお知らせ
// アプリの画面と登録済みの本は使えますが、外部サイトへのリンクは開けないことを伝えます。

import { useEffect, useState } from 'react';

export function OfflineNotice() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <p className="offline-notice" role="status">
      オフラインです。おすすめや本棚は使えますが、外部サイトのリンクは開けません。
    </p>
  );
}
