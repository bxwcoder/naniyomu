// 候補リストと国立国会図書館の検索結果から、アプリで使う本のデータ（src/data/books.auto.json）を作る
//
// 使い方：  node scripts/catalog/build.mjs <records.json の場所> [報告の出力先フォルダ]
//   - タイトルと著者が国立国会図書館の記録と一致し、ISBN がある本だけを入れます（実在の確認）。
//   - 版がいくつもあるときは、文庫（新書大賞は新書）・第1巻・置いている図書館が多い版を選びます。
//   - 札は scripts/catalog/rules.mjs の規則で決めます。紹介文は入れません（空欄）。
//   - 手で書いた本（src/data/books.json）と同じ本は入れません。
//   - 入れられなかった本は report.md に理由つきで書き出します。

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { candidateKey, loadCandidates } from './candidates.mjs';
import { SOURCE_RULES, decideTags, genresFromNdc } from './rules.mjs';

const [recordsPath, reportDir = '.'] = process.argv.slice(2);
if (!recordsPath) {
  console.error('使い方: node scripts/catalog/build.mjs <records.json> [報告の出力先フォルダ]');
  process.exit(1);
}
const OUTPUT_PATH = 'src/data/books.auto.json';

// ---- 文字の比べ方をそろえる ----
const norm = (s) =>
  (s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・、。,.:：;；!?！？「」『』()（）〈〉\-―ー=＝"'“”~〜]/g, '');
/** 「タイトル : 副題」の副題を外した部分 */
const mainTitle = (s) => (s ?? '').split(/\s[:：]\s|\s=\s/)[0];
const titleMatches = (candidateTitle, item) => {
  const c = norm(candidateTitle);
  return c !== '' && (norm(mainTitle(item.title)) === c || norm(item.title) === c);
};

function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}
/** 10けた・13けたの ISBN を、13けたにそろえる（チェック数字が合わないものは捨てる） */
function toIsbn13(raw) {
  const s = raw.replace(/[-\s]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(s)) return isbn13CheckDigit(s.slice(0, 12)) === Number(s[12]) ? s : null;
  if (/^\d{9}[\dX]$/.test(s)) {
    const first12 = '978' + s.slice(0, 9);
    return first12 + isbn13CheckDigit(first12);
  }
  return null;
}
const pagesFromExtent = (extent) => {
  const m = (extent ?? '').normalize('NFKC').match(/(\d+)\s*p/);
  return m ? Number(m[1]) : null;
};
/** 巻の表示が「1」「上」「第1巻」などの最初の巻か（巻の表示がなければ1冊もの） */
const isFirstVolume = (volume) => !volume || /^(第?0*1巻?|上巻?|前編|part\s?1|vol\.?\s?1)$/i.test(volume.normalize('NFKC').trim());

/** 版の選び方：好ましい叢書（文庫など）→ 置いている図書館が多い → 発行が早い */
function preferredSeries(candidate, genres) {
  if (genres.includes('manga')) return /コミック|comics/i;
  if (candidate.source === '新書大賞') return /新書/;
  return /文庫/;
}
function chooseEdition(candidate, items) {
  const firsts = items.filter((it) => isFirstVolume(it.volume));
  if (firsts.length === 0) return null;
  const genresGuess = candidate.hints.genres ?? SOURCE_RULES[candidate.source]?.genres ?? genresFromNdc(firsts[0].ndc) ?? [];
  const pref = preferredSeries(candidate, genresGuess);
  const score = (it) => (pref.test(it.seriesTitle ?? '') ? 1 : 0);
  return [...firsts].sort(
    (a, b) => score(b) - score(a) || b.holdings - a.holdings || String(a.issued).localeCompare(String(b.issued)),
  )[0];
}

const candidates = await loadCandidates();
const { fetchedAt, records } = JSON.parse(await readFile(recordsPath, 'utf8'));
const byKey = new Map(records.map((r) => [r.key, r]));
const curated = JSON.parse(await readFile('src/data/books.json', 'utf8'));
const curatedIsbns = new Set(curated.map((b) => b.isbn).filter(Boolean));
const curatedTitles = new Set(curated.map((b) => norm(mainTitle(b.title.split(/\s/)[0]))));

const books = [];
const skipped = [];
const chosenLog = [];
const usedIsbns = new Set();
for (const c of candidates) {
  const skip = (reason) => skipped.push(`${c.title}／${c.author}（${c.source}）：${reason}`);
  const rec = byKey.get(candidateKey(c));
  if (!rec || rec.status !== 200) {
    skip('まだ国立国会図書館で検索できていない');
    continue;
  }
  const items = rec.items
    .filter((it) => titleMatches(c.title, it))
    .map((it) => ({ ...it, isbn13: it.isbns.map(toIsbn13).find(Boolean) ?? null }))
    .filter((it) => it.isbn13);
  if (items.length === 0) {
    skip(rec.items.length ? 'タイトルが同じで ISBN のある記録がない' : '著者が合う記録がない');
    continue;
  }
  const edition = chooseEdition(c, items);
  if (!edition) {
    skip('第1巻の記録が見つからない');
    continue;
  }
  if (curatedIsbns.has(edition.isbn13) || curatedTitles.has(norm(c.title))) {
    skip('手で書いた本のデータにすでにある');
    continue;
  }
  if (usedIsbns.has(edition.isbn13)) {
    skip('候補リストの別の行と同じ本');
    continue;
  }
  // 巻の表示がある記録があれば、上下巻やシリーズもの
  const multiVolume = items.some((it) => it.volume);
  const pages = pagesFromExtent(edition.extent);
  const tags = decideTags(c, { ndc: edition.ndc, pages, multiVolume });
  if (!tags) {
    skip(`ジャンルを決められない（分類番号：${edition.ndc ?? 'なし'}）`);
    continue;
  }
  usedIsbns.add(edition.isbn13);
  books.push({
    book_id: `isbn-${edition.isbn13}`,
    title: c.title,
    author: c.author,
    ...tags,
    description: '',
    recommendation_reasons: [],
    cover_image_url: null,
    purchase_url: null,
    isbn: edition.isbn13,
    metadata_source: edition.link,
    metadata_verified: true,
    tier: 'basic',
    publisher: edition.publisher[0] ?? null,
    pages,
  });
  chosenLog.push(
    `- ${c.title}：${edition.seriesTitle ?? '叢書なし'}／${edition.publisher.join('、')}／${edition.issued}／${edition.extent ?? 'ページ数不明'}／NDC ${edition.ndc ?? 'なし'}／${tags.genres.join(',')}・${tags.difficulty}・${tags.length_category}`,
  );
}

await writeFile(OUTPUT_PATH, JSON.stringify(books, null, 2) + '\n');
const lines = [
  '# 候補リストから作った本のデータ',
  '',
  `- 検索日時：${fetchedAt}`,
  `- 候補：${candidates.length}冊`,
  `- 入れた本：${books.length}冊`,
  `- 入れなかった本：${skipped.length}冊`,
  '',
  '## 入れなかった本',
  '',
  ...skipped.map((s) => `- ${s}`),
  '',
  '## 入れた本と選んだ版',
  '',
  ...chosenLog,
  '',
];
await writeFile(join(reportDir, 'report.md'), lines.join('\n'));
console.log(lines.slice(0, 7).join('\n'));
console.log(`出力：${OUTPUT_PATH}`);
