// 候補リストの本を、国立国会図書館サーチで探して記録するプログラム
//
// 使い方：  node scripts/catalog/fetch.mjs [出力先フォルダ]
//   - 候補リスト（data/catalog/candidates.tsv）の本を1冊ずつタイトルで検索し、
//     著者名が合う記録だけを records.json に残します（版ちがい・巻ちがいも含めて全部）。
//   - どの版を使うか、どの札を付けるかは scripts/catalog/build.mjs が決めます。
//   - 1冊取るごとに保存し、前回取れた本は取り直しません。止まっても、もう一度動かせば続きから取り込めます。
//   - 環境変数 MAX_RUN_MINUTES（既定40分）を過ぎたら、区切りのよいところで終わります。
//
// 利用条件は scripts/ndl/client.mjs を見てください。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INTERVAL_MS, creatorMatches, mainAuthor, query, sleep } from '../ndl/client.mjs';
import { parseOpenSearch } from '../ndl/parse.mjs';
import { candidateKey, loadCandidates } from './candidates.mjs';

const MAX_RUN_MS = Number(process.env.MAX_RUN_MINUTES ?? 40) * 60000;
/** 検索方法の版。検索方法を変えたら数字を上げると、見つからなかった本を取り直す */
const METHOD_VERSION = 2;
const startedAt = Date.now();

const outDir = process.argv[2] ?? 'catalog-output';
await mkdir(outDir, { recursive: true });
const recordsPath = join(outDir, 'records.json');

const previous = new Map();
try {
  const prev = JSON.parse(await readFile(recordsPath, 'utf8'));
  for (const r of prev.records ?? []) {
    if (r.status === 200 && (r.items.length > 0 || r.method === METHOD_VERSION)) previous.set(r.key, r);
  }
  console.log(`前回までに取れた本：${previous.size}冊`);
} catch {
  console.log('前回の結果はありません。最初から取り込みます。');
}
const saveRecords = (records) =>
  writeFile(recordsPath, JSON.stringify({ fetchedAt: new Date().toISOString(), records }, null, 1));

/** タイトルで検索し、著者名が合う「図書」の記録だけを残す */
async function search(c, params) {
  const result = await query({ title: c.title, cnt: '200', ...params });
  const items = parseOpenSearch(result.text).filter(
    (it) => it.categories.includes('図書') && creatorMatches([...it.creators, it.author ?? ''], c.author),
  );
  return { url: result.url, status: result.status, items };
}

/**
 * 探し方の順番。
 *   1. タイトルで、国立国会図書館の蔵書だけを探す（雑誌記事や他の図書館の重複が混ざらない）
 *   2. 「告白」のような短いタイトルは同じ名前の本が多すぎるので、著者名の一部も加えて探す
 *      （国立国会図書館の著者名は「湊, かなえ」の形なので、名前全体では見つからない。
 *        日本の名前は先頭の1〜2文字、外国の名前は「・」で区切った最後を使う）
 *   3. 蔵書に限らず全体で探す
 */
function searchPlans(c) {
  const name = mainAuthor(c.author).normalize('NFKC');
  const parts = name.split(/[・\s]/).filter(Boolean);
  const creatorKeys = parts.length > 1 ? [parts[parts.length - 1]] : [name.slice(0, 2), name.slice(0, 1)];
  return [
    { dpid: 'iss-ndl-opac' },
    ...[...new Set(creatorKeys)].map((creator) => ({ dpid: 'iss-ndl-opac', creator })),
    {},
  ];
}

const candidates = await loadCandidates();
const records = [];
let stoppedEarly = false;
let fetchedCount = 0;
for (const [i, c] of candidates.entries()) {
  const key = candidateKey(c);
  const prev = previous.get(key);
  if (prev) {
    records.push(prev);
    continue;
  }
  if (Date.now() - startedAt > MAX_RUN_MS) {
    stoppedEarly = true;
    continue;
  }
  const started = Date.now();
  console.log(`[${i + 1}/${candidates.length}] ${c.title}／${c.author}`);
  // 見つかるまで、探し方を順に変える
  let result;
  for (const params of searchPlans(c)) {
    if (result) await sleep(INTERVAL_MS);
    result = await search(c, params);
    if (result.status !== 200 || result.items.length > 0) break;
  }
  console.log(`  → ${result.status} / 著者が合う記録 ${result.items.length}件（${((Date.now() - started) / 1000).toFixed(1)}秒）`);
  records.push({ key, method: METHOD_VERSION, ...result });
  fetchedCount++;
  await saveRecords(records);
  await sleep(INTERVAL_MS);
}

// 新しく問い合わせた本がなければ、ファイルを書き換えない（自動実行のたびに保存が増えないように）
if (fetchedCount > 0) await saveRecords(records);
const done = records.filter((r) => r.status === 200).length;
console.log(`取得済み：${done}/${candidates.length}冊。出力先：${outDir}`);
if (stoppedEarly || done < candidates.length) {
  console.log('まだ取れていない本があります。もう一度実行すると、続きから取り込みます。');
}
