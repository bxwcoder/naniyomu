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
