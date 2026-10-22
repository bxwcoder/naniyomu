// ISBN（本の番号）を扱う処理
// ISBN-13 は「978」か「979」で始まる13けたの番号で、最後の1けたは前の12けたから計算で決まる
// チェック用の数字です。打ち間違いがあると計算が合わなくなるので、自動で見つけられます。

/** ハイフンや空白を取り除く（例：978-4-10-121523-5 → 9784101215235） */
export function normalizeIsbn(text: string): string {
  return text.replace(/[-\s]/g, '').toUpperCase();
}

/** 12けたから、ISBN-13 の最後のけた（チェック用の数字）を計算する */
export function isbn13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

/** 正しい ISBN-13 か（13けた・978/979で始まる・チェック用の数字が合う） */
export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false;
  return isbn13CheckDigit(isbn.slice(0, 12)) === Number(isbn[12]);
}

/** 正しい ISBN-10 か（古い本の10けたの番号。最後は X のこともある） */
export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (isbn[i] === 'X' ? 10 : Number(isbn[i])) * (10 - i);
  return sum % 11 === 0;
}

/** 古い10けたの ISBN を、今の13けたに変換する。正しくない番号なら null */
export function isbn10To13(isbn10: string): string | null {
  const s = normalizeIsbn(isbn10);
  if (!isValidIsbn10(s)) return null;
  const first12 = '978' + s.slice(0, 9);
  return first12 + isbn13CheckDigit(first12);
}
