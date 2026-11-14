// 候補リストと国立国会図書館の検索結果から、アプリで使う本のデータ（src/data/books.auto.json）を作る
//
// 使い方：  node scripts/catalog/build.mjs <records.json の場所> [報告の出力先フォルダ]
//   ※ふだんは GitHub の自動実行（.github/workflows/catalog-fetch.yml）が、検索のあとに動かします。
//   - タイトルと著者が国立国会図書館の記録と一致し、ISBN がある本だけを入れます（実在の確認）。
//   - 版がいくつもあるときは、文庫（新書大賞は新書）・第1巻・置いている図書館が多い版を選びます。
//   - 札は scripts/catalog/rules.mjs の規則で決めます。紹介文は入れません（空欄）。
//   - 手で書いた本（src/data/books.json）と同じ本は入れません。
//   - 入れられなかった本は report.md に理由つきで書き出します。

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { candidateKey, loadCandidates } from './candidates.mjs';
import {
  MANGA_COMPILATION,
  SPECIAL_EDITION,
  isForeignPublisher,
  isFirstInSeries,
  isFirstVolume,
  mainTitle,
  norm,
  titleMatches,
  toIsbn13,
} from './match.mjs';
import { SOURCE_RULES, decideTags, genresFromNdc } from './rules.mjs';

const [recordsPath, reportDir = '.'] = process.argv.slice(2);
if (!recordsPath) {
  console.error('使い方: node scripts/catalog/build.mjs <records.json> [報告の出力先フォルダ]');
  process.exit(1);
}
const OUTPUT_PATH = 'src/data/books.auto.json';

/** ページ数を読む。「372, 39p」（本文と付録）のように並んでいるときは、いちばん大きい数を使う */
const pagesFromExtent = (extent) => {
  const m = (extent ?? '').normalize('NFKC').match(/([\d,\s]+)p/);
  if (!m) return null;
  const numbers = m[1].split(/[,\s]+/).filter(Boolean).map(Number);
  return numbers.length ? Math.max(...numbers) : null;
};
/**
 * 総集編・完全版・特別編集版・子ども向けの文庫など、ふつうの版がほかにあれば後回しにする版。
 * （除きはしない。ほかに版がなければ使う）
 */
const SECONDARY_EDITION = /remix|リミックス|(?<!ベスト)セレクション|総集編|愛蔵版|完全版|デラックス|ワイド版|スペシャル|新装|乙女の本棚|財務諸表編|実践編|ワークブック|問題集|アニメKC|アニメコミック|フィルムコミック|劇場版/i; // 「財務諸表編」などは本編に付く別の本
/** 子ども向けの叢書。ふつうの文庫があればそちらを選ぶ（ほかになければ使う） */
const JUVENILE_SERIES = /偕成社文庫|怪盗ルパン|SFロマン文庫|歳から読む|パール文庫|痛快世界の冒険文学|スラよみ|世界文学の玉手箱|ポケット日本文学館|こどもまんが|まんが絵本|アニメ名作集|小学生コミックス|少年文庫|くれよん文庫/;
/** 小説などで、これより少ないページ数の版は挿絵中心の本のことが多いので後回しにする */
const PICTURE_BOOK_PAGES = 100;

/** 版の選び方：後回しにする版でない → 好ましい叢書（文庫など）→ 置いている図書館が多い → 発行が早い */
function preferredSeries(candidate, genres) {
  if (genres.includes('manga')) return /コミック|comics|KC(?!DX)/i; // 講談社の「アフタヌーンKC」なども漫画の叢書（KCDX は特別編集の版が多いので除く）
  if (candidate.source === '新書大賞') return /新書/;
  return /文庫/;
}
/** 漫画の分類番号（726.1）。726.6 は絵本、726.101 は漫画について書いた本なので含めない */
const isMangaNdc = (ndc) => /^726(\.1)?$/.test(ndc ?? '');

function chooseEdition(candidate, items) {
  const wantGenres = candidate.hints.genres ?? SOURCE_RULES[candidate.source]?.genres ?? [];
  const wantManga = wantGenres.includes('manga');
  // 小説の候補なら、文学（分類番号 9xx）の版だけ。絵コンテ集（778）や絵本（726.6）などを除く
  const wantStory = !wantManga && wantGenres.length > 0 && wantGenres.every((g) => g === 'novel' || g === 'mystery_sf');
  const firsts = items.filter(
    (it) =>
      isFirstVolume(it.volume) &&
      !SPECIAL_EDITION.test(`${it.seriesTitle ?? ''} ${it.publisher.join(' ')} ${it.title}`) &&
      // 漫画の候補なら漫画の版だけ、そうでなければ漫画版（コミカライズ）を除く
      (it.ndc === null || isMangaNdc(it.ndc) === wantManga) &&
      !(wantManga && MANGA_COMPILATION.test(`${it.seriesTitle ?? ''} ${it.title}`)) &&
      !isForeignPublisher(it) &&
      !(wantStory && it.ndc && !/^9/.test(it.ndc)) &&
      // 物語の候補なのに、文学の研究書・文学史（930.28 など）の分類の本は除く
      !(wantStory && it.ndc && /^9\d0\.2/.test(it.ndc)),
  );
  if (firsts.length === 0) return null;
  // 分類番号のない記録は、外国語の教科書などのことが多いので使わない
  // 分類番号がひとつもなければ、使わない
  let usable = firsts.filter((it) => it.ndc);
  // 海外の小説なのに「日本の小説」（913）に分類された版は、アニメなどを元に書き直した本なので除く
  if (candidate.source === '海外の名作') usable = usable.filter((it) => !/^913/.test(it.ndc));
  if (usable.length === 0) return null;
  firsts.splice(0, firsts.length, ...usable);
  const genresGuess = candidate.hints.genres ?? SOURCE_RULES[candidate.source]?.genres ?? genresFromNdc(firsts[0].ndc) ?? [];
  const pref = preferredSeries(candidate, genresGuess);
  const fewPages = (it) => !wantManga && (pagesFromExtent(it.extent) ?? Infinity) < PICTURE_BOOK_PAGES;
  const score = (it) =>
    (pref.test(it.seriesTitle ?? '') ? 1 : 0) -
    (SECONDARY_EDITION.test(`${it.seriesTitle ?? ''} ${it.title}`) ? 2 : 0) -
    (JUVENILE_SERIES.test(it.seriesTitle ?? '') ? 1 : 0) -
    (fewPages(it) ? 2 : 0) -
    (wantStory && candidate.source !== '日本の名作' && /^912/.test(it.ndc ?? '') ? 2 : 0) - // いまの小説の候補で、ドラマの脚本（912）の版は後回し（近松などの戯曲は除く）
    (/ページ付なし/.test(it.extent ?? '') ? 1 : 0); // 写真集・絵本のような作りが多い
  return [...firsts].sort(
    (a, b) => score(b) - score(a) || b.holdings - a.holdings || String(a.issued).localeCompare(String(b.issued)),
  )[0];
}

const candidates = await loadCandidates();
const { fetchedAt, records } = JSON.parse(await readFile(recordsPath, 'utf8'));
const byKey = new Map(records.map((r) => [r.key, r]));
const curated = JSON.parse(await readFile('src/data/books.json', 'utf8'));
const curatedIsbns = new Set(curated.map((b) => b.isbn).filter(Boolean));
// 手で書いた本のタイトル → その著者たち（同じタイトルでも著者が違えば別の本として扱う）
const curatedTitles = new Map();
for (const b of curated) {
  const t = norm(mainTitle(b.title.split(/\s/)[0]));
  curatedTitles.set(t, [...(curatedTitles.get(t) ?? []), b.author]);
}
/** 著者名が同じ人を指しているか（「夏目漱石」と「漱石」、「カミュ」と「アルベール・カミュ」など） */
const sameAuthor = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return x.includes(y) || y.includes(x) || x.slice(-2) === y.slice(-2);
};

const books = [];
const skipped = [];
const chosenLog = [];
const usedIsbns = new Set();
for (const c of candidates) {
  const skip = (reason) => skipped.push(`${c.title}／${c.author}（${c.source}）：${reason}`);
  if ((curatedTitles.get(norm(c.title)) ?? []).some((a) => sameAuthor(a, c.author))) {
    skip('手で書いた本のデータにすでにある');
    continue;
  }
  const rec = byKey.get(candidateKey(c));
  if (!rec || rec.status !== 200) {
    skip('まだ国立国会図書館で検索できていない');
    continue;
  }
  const items = rec.items
    .map((it) => (!titleMatches(c.title, it) && isFirstInSeries(c.title, it) ? { ...it, volume: '1', title: c.title } : it))
    .filter((it) => titleMatches(c.title, it))
    .map((it) => ({ ...it, isbn13: it.isbns.map(toIsbn13).find(Boolean) ?? null }))
    .filter((it) => it.isbn13);
  if (items.length === 0) {
    skip(rec.items.length ? 'タイトルが同じで ISBN のある記録がない' : '著者が合う記録がない');
    continue;
  }
  const edition = chooseEdition(c, items);
  if (!edition) {
    skip('ふつうの版の第1巻が見つからない（漫画版・大きな文字の版などを除いた結果）');
    continue;
  }
  if (curatedIsbns.has(edition.isbn13)) {
    skip('手で書いた本のデータにすでにある');
    continue;
  }
  if (usedIsbns.has(edition.isbn13)) {
    skip('候補リストの別の行と同じ本');
    continue;
  }
  // 選んだ版に巻の表示（「1」「上」など）があれば、上下巻やシリーズもの
  const multiVolume = Boolean(edition.volume);
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
