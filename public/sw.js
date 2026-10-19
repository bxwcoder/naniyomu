// ナニヨムのサービスワーカー（オフラインでも開けるようにするための仕組み）
//
// できること：
// - 一度開いたことがあれば、ネットがなくてもアプリの画面と登録済みの本のデータを表示できる
// できないこと：
// - 外部サイト（書誌情報の確認元・購入先など）はオフラインでは開けない
//
// 下の2行は、アプリを組み立てるとき（npm run build）に vite.config.ts が自動で書き換えます。
// 中身が変わるたびに CACHE_VERSION も変わるので、古い保存データは自動で消えます。
const CACHE_VERSION = 'naniyomu-dev';
const BUILD_ASSETS = [];

// 最初に保存しておくファイル（名前が変わらないもの）
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  ...BUILD_ASSETS,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // 外部サイトや、読み込み以外の通信には関わらない
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // ページ本体：まずネットから最新を取り、つながらなければ保存しておいたものを使う
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // 画面の部品・本のデータ・アイコン：保存してあればそれを使い、なければ取ってきて保存する
  // （部品のファイル名は中身が変わると名前も変わるので、古いものが出続けることはない）
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
