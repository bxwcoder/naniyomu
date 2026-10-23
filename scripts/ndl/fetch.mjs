// 国立国会図書館サーチから、本の書誌情報を取り込むプログラム
//
// 使い方：  node scripts/ndl/fetch.mjs [出力先フォルダ]
//   - ISBN がある本は、ISBN で1冊ずつ問い合わせます。
//   - ISBN が空欄（null）の本や、ISBN で見つからない本は、タイトルで検索し、著者名が合う候補を集めます。
//   - 国立国会図書館の負担にならないよう、問い合わせの間は少し時間を空けます。
//   - 返ってきたデータは、そのままの形（raw）と、読み取った形（records.json）の両方を保存します。
//   - 1冊取るごとに records.json を保存します。前回取れた本は取り直さないので、
//     途中で止まっても、もう一度動かせば続きから取り込めます。
//   - 環境変数 MAX_RUN_MINUTES（既定40分）を過ぎたら、区切りのよいところで終わります。
//
// 利用条件：国立国会図書館サーチの外部提供インタフェース（API）の利用条件に従います。
//   https://ndlsearch.ndl.go.jp/help/api
//   ※API の利用は非営利目的が前提です。広告や購入リンクで収益を得るようになったら、利用条件を確認し直します。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOpenSearch } from './parse.mjs';

const ENDPOINT = 'https://ndlsearch.ndl.go.jp/api/opensearch';
const USER_AGENT = 'naniyomu-book-data/0.1 (+https://github.com/bxwcoder/naniyomu)';
/** 問い合わせの間隔（ミリ秒）。国立国会図書館の負担にならないよう広めにとる */
const INTERVAL_MS = 3000;
/** 1回の問い合わせで待つ最大時間（ミリ秒）。応答が遅いことがあるので長めにする */
const TIMEOUT_MS = 90000;
/** 「問い合わせが多すぎます」（429）と言われたときに待つ時間（ミリ秒） */
const RATE_LIMIT_WAIT_MS = 60000;
/** この時間を過ぎたら、新しい本の取得を始めずに終わる */
const MAX_RUN_MS = Number(process.env.MAX_RUN_MINUTES ?? 40) * 60000;
/** 検索方法の版。検索方法を変えたら数字を上げると、古い方法で見つからなかった本を取り直す */
const METHOD_VERSION = 2;
const startedAt = Date.now();

const outDir = process.argv[2] ?? 'ndl-output';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(params) {
  const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // 応答が返ってこないときに待ち続けないよう、一定時間であきらめて次の試行に進む
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const text = await res.text();
      if (res.ok) return { url, status: res.status, text };
      console.warn(`  ${res.status} が返りました（${attempt}回目）: ${url}`);
      if (res.status < 500 && res.status !== 429) return { url, status: res.status, text };
      if (res.status === 429) {
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
    } catch (e) {
      console.warn(`  通信エラー（${attempt}回目）: ${e.message}`);
    }
    await sleep(INTERVAL_MS * attempt * 2);
  }
  return { url, status: 0, text: '' };
}

/** 検索に使うため、著者名から「（原作）」などの補足や、複数著者の2人目以降を外す */
function mainAuthor(author) {
  return author.split(/[、,]/)[0].replace(/（.*?）|\(.*?\)/g, '').trim();
}

const books = JSON.parse(await readFile('src/data/books.json', 'utf8'));
await mkdir(join(outDir, 'raw'), { recursive: true });
const recordsPath = join(outDir, 'records.json');

// 前回までに取れた結果を読み込む。次のどちらかなら取り直さない（ISBN が変わっていないことが前提）
//   - ISBN で見つかった本
//   - 今と同じ検索方法で問い合わせた本
const previous = new Map();
try {
  const prev = JSON.parse(await readFile(recordsPath, 'utf8'));
  for (const r of prev.records ?? []) {
    const foundByIsbn = r.searchedBy === 'isbn' && r.items.length > 0;
    if (r.status === 200 && (foundByIsbn || r.method === METHOD_VERSION)) previous.set(r.book_id, r);
  }
  console.log(`前回までに取れた本：${previous.size}冊`);
} catch {
  console.log('前回の結果はありません。最初から取り込みます。');
}
const saveRecords = (records) =>
  writeFile(recordsPath, JSON.stringify({ fetchedAt: new Date().toISOString(), records }, null, 2));

/** 国立国会図書館の著者名「小川, 洋子, 1962-」を「小川洋子」の形にそろえる */
function normalizeName(name) {
  return name.replace(/,?\s*\d{4}-(\d{4})?/g, '').replace(/[,\s・=＝]/g, '');
}

/** タイトルで検索し、著者名が合う候補だけを残す（国立国会図書館の著者名は「姓, 名」の形のため） */
async function searchByTitle(book) {
  const params = { title: book.title.split(/[\s―]/)[0], cnt: '30' };
  const result = await query(params);
  const author = normalizeName(mainAuthor(book.author));
  const items = parseOpenSearch(result.text).filter((it) =>
    [...it.creators, it.author ?? ''].some((c) => normalizeName(c).includes(author) || author.includes(normalizeName(c).slice(0, 4))),
  );
  return { ...result, items };
}

const records = [];
let stoppedEarly = false;
for (const [i, book] of books.entries()) {
  const prev = previous.get(book.book_id);
  if (prev && prev.isbn === book.isbn) {
    records.push(prev);
    continue;
  }
  if (Date.now() - startedAt > MAX_RUN_MS) {
    stoppedEarly = true;
    continue;
  }
  const started = Date.now();
  console.log(`[${i + 1}/${books.length}] ${book.title}（${book.isbn ? 'ISBN ' + book.isbn : 'タイトルで検索'}）`);
  let searchedBy = 'isbn';
  let result;
  if (book.isbn) {
    result = await query({ isbn: book.isbn, cnt: '5' });
    result.items = parseOpenSearch(result.text);
    // ISBN で見つからなければ、タイトルで探し直す
    if (result.status === 200 && result.items.length === 0) {
      await sleep(INTERVAL_MS);
      result = await searchByTitle(book);
      searchedBy = 'title-fallback';
    }
  } else {
    result = await searchByTitle(book);
    searchedBy = 'title';
  }
  await writeFile(join(outDir, 'raw', `${book.book_id}.xml`), result.text);
  console.log(`  → ${result.status} / ${result.items.length}件（${((Date.now() - started) / 1000).toFixed(1)}秒）`);
  records.push({
    book_id: book.book_id,
    isbn: book.isbn,
    searchedBy,
    method: METHOD_VERSION,
    url: result.url,
    status: result.status,
    items: result.items,
  });
  // 1冊ごとに保存する（途中で止まっても、ここまでの結果は残る）
  await saveRecords(records);
  await sleep(INTERVAL_MS);
}

await saveRecords(records);
const done = records.filter((r) => r.status === 200).length;
console.log(`取得済み：${done}/${books.length}冊。出力先：${outDir}`);
if (stoppedEarly || done < books.length) {
  console.log('まだ取れていない本があります。もう一度実行すると、続きから取り込みます。');
}
