// 国立国会図書館サーチから、本の書誌情報を取り込むプログラム
//
// 使い方：  node scripts/ndl/fetch.mjs [出力先フォルダ]
//   - ISBN がある本は、ISBN で1冊ずつ問い合わせます。
//   - ISBN が空欄（null）の本や、ISBN で見つからない本は、タイトルで検索し、著者名が合う候補を集めます。
//   - 国立国会図書館の負担にならないよう、問い合わせの間は少し時間を空けます。
//   - 返ってきたデータは、そのままの形（raw）と、読み取った形（records.json）の両方を保存します。
//
// 利用条件：国立国会図書館サーチの外部提供インタフェース（API）の利用条件に従います。
//   https://ndlsearch.ndl.go.jp/help/api
//   ※API の利用は非営利目的が前提です。広告や購入リンクで収益を得るようになったら、利用条件を確認し直します。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseOpenSearch } from './parse.mjs';

const ENDPOINT = 'https://ndlsearch.ndl.go.jp/api/opensearch';
const USER_AGENT = 'naniyomu-book-data/0.1 (+https://github.com/bxwcoder/naniyomu)';
/** 問い合わせの間隔（ミリ秒） */
const INTERVAL_MS = 1500;

const outDir = process.argv[2] ?? 'ndl-output';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(params) {
  const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      const text = await res.text();
      if (res.ok) return { url, status: res.status, text };
      console.warn(`  ${res.status} が返りました（${attempt}回目）: ${url}`);
      if (res.status < 500 && res.status !== 429) return { url, status: res.status, text };
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
for (const [i, book] of books.entries()) {
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
  console.log(`  → ${result.status} / ${result.items.length}件`);
  records.push({ book_id: book.book_id, isbn: book.isbn, searchedBy, url: result.url, status: result.status, items: result.items });
  await sleep(INTERVAL_MS);
}

await writeFile(join(outDir, 'records.json'), JSON.stringify({ fetchedAt: new Date().toISOString(), records }, null, 2));
const failed = records.filter((r) => r.status !== 200).length;
console.log(`完了：${records.length}冊（通信に失敗 ${failed}冊）。出力先：${outDir}`);
