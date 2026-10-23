// 国立国会図書館から取り込んだ書誌情報と、ナニヨムの本のデータを照らし合わせる
//
// 使い方：  node scripts/ndl/compare.mjs <records.json の場所> [出力先フォルダ]
// 出力：
//   - report.md        … 人が読むための照合結果
//   - suggestions.json … 本ごとの照合結果と、データの修正案（自動では書き換えない）

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [recordsPath, outDir = '.'] = process.argv.slice(2);
if (!recordsPath) {
  console.error('使い方: node scripts/ndl/compare.mjs <records.json> [出力先フォルダ]');
  process.exit(1);
}

// ---- 長さの札を決める基準（ページ数） ----
export const LENGTH_RULE = { shortMax: 249, mediumMax: 449 };
export function lengthFromPages(pages) {
  if (pages <= LENGTH_RULE.shortMax) return 'short';
  if (pages <= LENGTH_RULE.mediumMax) return 'medium';
  return 'long';
}

// ---- 文字の比べ方をそろえる ----
const norm = (s) =>
  (s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・、。,.:：;；!?！？「」『』()（）〈〉\-―ー=＝"'“”]/g, '');
/** 「タイトル : 副題」の副題を外した部分 */
const mainTitle = (s) => (s ?? '').split(/\s[:：]\s|\s=\s/)[0];
const normalizeName = (name) =>
  name.normalize('NFKC').replace(/,?\s*\d{4}-(\d{4})?/g, '').replace(/[,\s・=＝]/g, '');
/** 国立国会図書館で、外国の著者が「Frankl, Viktor Emil」のようにアルファベットだけで登録されているか */
const isLatinName = (name) => /^[\p{Script=Latin}\s,.'\-\d]+$/u.test(name);
const mainAuthor = (author) => author.split(/[、,]/)[0].replace(/（.*?）|\(.*?\)/g, '').trim();

function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}
/** 10けた・13けたの ISBN を、13けたにそろえる */
function toIsbn13(raw) {
  const s = raw.replace(/[-\s]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(s)) return s;
  if (/^\d{9}[\dX]$/.test(s)) {
    const first12 = '978' + s.slice(0, 9);
    return first12 + isbn13CheckDigit(first12);
  }
  return null;
}
function pagesFromExtent(extent) {
  const m = (extent ?? '').match(/(\d+)\s*p/);
  return m ? Number(m[1]) : null;
}
function titleMatches(book, item) {
  const a = norm(mainTitle(book.title));
  const b = norm(mainTitle(item.title));
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a) || norm(book.title).includes(b);
}
function authorMatches(book, item) {
  const a = normalizeName(mainAuthor(book.author));
  return [...item.creators, item.author ?? ''].some((c) => {
    const n = normalizeName(c);
    return n.length > 0 && (n.includes(a) || a.includes(n) || (n.length >= 3 && a.includes(n.slice(0, 3))));
  });
}
/** 上下巻・シリーズ・漫画など、1冊のページ数で長さを決められない本 */
function isMultiVolume(book) {
  return book.genres.includes('manga') || /上下巻|全\d+巻|全\d+集|全\d+冊|全\s?\d+巻|第1巻/.test(book.description);
}

const books = JSON.parse(await readFile('src/data/books.json', 'utf8'));
const { fetchedAt, records } = JSON.parse(await readFile(recordsPath, 'utf8'));
const byId = new Map(records.map((r) => [r.book_id, r]));

const results = [];
for (const book of books) {
  const rec = byId.get(book.book_id);
  const r = { book_id: book.book_id, title: book.title, isbn: book.isbn, searchedBy: rec?.searchedBy, issues: [], suggestions: {} };
  const items = (rec?.items ?? []).map((it) => ({ ...it, isbn13s: [...new Set(it.isbns.map(toIsbn13).filter(Boolean))] }));
  if (!rec || rec.status !== 200) {
    r.issues.push('国立国会図書館に問い合わせできなかった');
  } else if (items.length === 0) {
    r.issues.push(book.isbn ? 'ISBN でもタイトルでも見つからなかった' : 'タイトルで検索したが、著者名が合う本が見つからなかった');
  } else if (rec.searchedBy === 'isbn') {
    // ISBN で見つかった：その中で、ページ数などの情報がいちばん多い記録を使う
    const hits = items.filter((it) => it.isbn13s.includes(book.isbn));
    const best = (hits.length ? hits : items).sort((x, y) => (pagesFromExtent(y.extent) ?? 0) - (pagesFromExtent(x.extent) ?? 0))[0];
    r.ndl = { title: best.title, creators: best.creators, publisher: best.publisher, issued: best.issued, extent: best.extent, link: best.link, subjects: best.subjects };
    // 同じ本に、英語のタイトルと日本語のタイトルの両方の記録があることがあるので、どれか1つが合えばよい
    r.titleMatch = items.some((it) => titleMatches(book, it));
    r.authorMatch = items.some((it) => authorMatches(book, it));
    // 外国の著者はアルファベットで登録されているため、カタカナと比べられない。ISBN とタイトルが一致していれば同じ本とみなす
    const latinOnly = items.every((it) => it.creators.length > 0 && isLatinName(it.creators[0]));
    if (!r.authorMatch && latinOnly && r.titleMatch) {
      r.authorMatch = true;
      r.authorNote = `著者は国立国会図書館ではアルファベット表記：${best.creators.join('／')}`;
    }
    if (!r.titleMatch) r.issues.push(`タイトルが違う可能性：国立国会図書館では「${best.title}」`);
    if (!r.authorMatch) r.issues.push(`著者が違う可能性：国立国会図書館では「${best.creators.join('／')}」`);
    const pages = Math.max(0, ...items.map((it) => pagesFromExtent(it.extent) ?? 0)) || null;
    r.pages = pages;
    if (pages && !isMultiVolume(book)) {
      const len = lengthFromPages(pages);
      if (len !== book.length_category) r.suggestions.length_category = { from: book.length_category, to: len, reason: `${pages}ページ` };
    }
    if (r.titleMatch && r.authorMatch && best.link) r.suggestions.metadata_source = best.link;
  } else {
    // タイトルで探した：ISBN の候補を並べる（自動では決めない）
    r.candidates = items
      .filter((it) => titleMatches(book, it))
      .map((it) => ({ title: it.title, volume: it.volume, series: it.seriesTitle, publisher: it.publisher, issued: it.issued, extent: it.extent, isbn13s: it.isbn13s, link: it.link }));
    if (r.candidates.length === 0) r.issues.push('タイトルと著者が両方合う候補がなかった');
  }
  results.push(r);
}

// ---- 結果をまとめる ----
const ok = results.filter((r) => r.searchedBy === 'isbn' && r.issues.length === 0);
const lengthChanges = results.filter((r) => r.suggestions.length_category);
const withCandidates = results.filter((r) => r.candidates?.length);
const problems = results.filter((r) => r.issues.length);
const L = { short: '短め', medium: 'ふつう', long: '長編' };

const lines = [
  '# 国立国会図書館との照合結果',
  '',
  `- 取得日時：${fetchedAt}`,
  `- 照合した本：${results.length}冊`,
  `- タイトル・著者が一致：${ok.length}冊`,
  `- 長さの札の修正案：${lengthChanges.length}冊`,
  `- ISBN の候補が見つかった本：${withCandidates.length}冊`,
  `- 確認が必要：${problems.length}冊`,
  '',
  '## 長さの札の修正案（ページ数から）',
  '',
  `基準：${LENGTH_RULE.shortMax}ページ以下＝短め、${LENGTH_RULE.mediumMax}ページ以下＝ふつう、それより多い＝長編（上下巻・漫画は対象外）`,
  '',
  ...lengthChanges.map((r) => `- ${r.title}：${L[r.suggestions.length_category.from]} → ${L[r.suggestions.length_category.to]}（${r.suggestions.length_category.reason}）`),
  '',
  '## ISBN の候補',
  '',
  ...withCandidates.flatMap((r) => [
    `### ${r.title}`,
    ...r.candidates.map(
      (c) => `- ${c.title}${c.volume ? ` ${c.volume}` : ''}／${(c.series ?? '') || '叢書なし'}／${c.publisher.join('、')}／${c.issued ?? '発行年不明'}／${c.extent ?? 'ページ数不明'}／ISBN ${c.isbn13s.join(', ') || 'なし'}`,
    ),
    '',
  ]),
  '## 確認が必要な本',
  '',
  ...problems.map((r) => `- ${r.title}：${r.issues.join('／')}`),
  '',
];
await writeFile(join(outDir, 'report.md'), lines.join('\n'));
await writeFile(join(outDir, 'suggestions.json'), JSON.stringify(results, null, 2));
console.log(lines.slice(0, 10).join('\n'));
