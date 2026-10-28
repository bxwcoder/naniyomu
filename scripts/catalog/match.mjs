// 候補リストの本と、国立国会図書館の記録を照らし合わせるための部品（fetch.mjs と build.mjs で共通）

/** 比べるために文字をそろえる（全角・半角、記号、空白、読みがなの違いをなくす） */
export const norm = (s) =>
  (s ?? '')
    .normalize('NFKC')
    // 「心淋(うらさび)し川」のような読みがなを外す
    .replace(/[(（][ぁ-ゖー]+[)）]/g, '')
    .toLowerCase()
    .replace(/[\s・、。,.:：;；!?！？「」『』()（）〈〉\-―ー=＝"'“”~〜]/g, '');

/** 「タイトル : 副題」の副題を外した部分 */
export const mainTitle = (s) => (s ?? '').split(/\s[:：]\s|\s=\s/)[0];

/** タイトルが同じか（副題は無視する） */
export const titleMatches = (candidateTitle, item) => {
  const c = norm(candidateTitle);
  return c !== '' && (norm(mainTitle(item.title)) === c || norm(item.title) === c);
};

/**
 * 漫画の第1巻が、シリーズ名の中にだけタイトルがある場合（例：「蝉時雨のやむ頃」叢書「海街diary ; 1」）
 */
export const isFirstInSeries = (candidateTitle, item) =>
  (item.seriesTitle ?? '').split(/\.\s/).some((part) => norm(part) === `${norm(candidateTitle)}1`);

function isbn13CheckDigit(first12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** 10けた・13けたの ISBN を、13けたにそろえる（チェック数字が合わないものは捨てる） */
export function toIsbn13(raw) {
  const s = raw.replace(/[-\s]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(s)) return isbn13CheckDigit(s.slice(0, 12)) === Number(s[12]) ? s : null;
  if (/^\d{9}[\dX]$/.test(s)) {
    const first12 = '978' + s.slice(0, 9);
    return first12 + isbn13CheckDigit(first12);
  }
  return null;
}

/** この記録が、候補の本として使えるか（タイトルが同じで、ISBN がある） */
export const isUsableItem = (candidateTitle, item) =>
  (titleMatches(candidateTitle, item) || isFirstInSeries(candidateTitle, item)) && item.isbns.some((i) => toIsbn13(i));

/**
 * 巻の表示が「1」「上」「第1巻」「第1部 (イチニツイテ)」などの最初の巻か（巻の表示がなければ1冊もの）。
 * 後ろに付いた「(真昼の月)」のような巻の副題は外して比べる。
 */
export const isFirstVolume = (volume) =>
  !volume ||
  /^(第?0*1[巻部]?|巻ノ0*1|上巻?|前編|part\s?1|vol\.?\s?1)$/i.test(
    volume.normalize('NFKC').replace(/\s*\(.*\)\s*$/, '').trim(),
  );

/** 大きな文字の本・対訳版など、ふつうの読者向けの版ではないもの */
/** 子ども向けに書き直した版（児童書の文庫）も、元の本とは別の本として除く */
// 外国語で書かれた版（英語版の Ruby books など）も除く
// 漫画では、何巻分かをまとめ直した本（コンビニ向けの総集編など）や、子ども向けに抜き出した本も除く
// アニメの画面から作った本（アニメ版・フィルムコミック）も、元の漫画とは別の本として除く
export const MANGA_COMPILATION =
  /remix|リミックス|セレクション|総集編|my first big|best|アニメ版|アニメコミック|アニメブック|フィルムコミック/i;
/**
 * 外国語で書かれた本（海外の原書など）か。タイトルも出版社名もすべてアルファベットなら、そうとみなす。
 * （「KADOKAWA」のように出版社名だけがアルファベットの日本の本は含めない）
 */
const isAscii = (text) => /^[\x20-\x7E]+$/.test(text.normalize('NFKC'));
export const isForeignPublisher = (item) =>
  isAscii(item.title ?? '') && item.publisher.length > 0 && item.publisher.every(isAscii);
export const SPECIAL_EDITION =
  /誰でも文庫|大活字|デカ文字|点字|バイリンガル|bilingual|ジュニア文庫|つばさ文庫|青い鳥文庫|みらい文庫|ポプラポケット文庫|ポプラ社文庫|フォア文庫|コバルト文庫|Ruby books|Kodansha International/i;

/** 使える記録の中に、ふつうの版の第1巻（または1冊もの）があるか */
export const hasFirstVolume = (candidateTitle, items) =>
  items.some(
    (it) =>
      isUsableItem(candidateTitle, it) &&
      (isFirstVolume(it.volume) || isFirstInSeries(candidateTitle, it)) &&
      !SPECIAL_EDITION.test(`${it.seriesTitle ?? ''} ${it.publisher.join(' ')} ${it.title}`) &&
      !MANGA_COMPILATION.test(`${it.seriesTitle ?? ''} ${it.title}`),
  );
