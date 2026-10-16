// 本のデータの形式チェック
// books.json に書き間違い（決められていないジャンル名、空のタイトルなど）がないかを調べます。
// 問題があった本はおすすめに使わず、問題の内容を一覧で返します。

import { DIFFICULTIES, GENRES, LENGTHS, MOODS, THEMES } from '../data/options.ts';
import type { Book } from '../types.ts';

export interface ValidationResult {
  /** 問題のなかった本 */
  validBooks: Book[];
  /** 見つかった問題（人が読める文章） */
  errors: string[];
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function checkTagList(
  value: unknown,
  allowed: Record<string, string>,
  field: string,
  label: string,
  errors: string[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    errors.push(`${label}: ${field} は1つ以上の値が入った配列にしてください`);
    return;
  }
  for (const v of value) {
    if (typeof v !== 'string' || !(v in allowed)) {
      errors.push(`${label}: ${field} に使えない値「${String(v)}」があります（使える値: ${Object.keys(allowed).join(', ')}）`);
    }
  }
}

function checkUrlOrNull(value: unknown, field: string, label: string, errors: string[]): void {
  if (value === null) return;
  if (!isNonEmptyString(value) || !/^https:\/\//.test(value)) {
    errors.push(`${label}: ${field} は https:// で始まるURLか null にしてください`);
  }
}

/** 1冊分をチェックし、問題を errors に追加する。問題がなければ true */
function validateOne(raw: unknown, index: number, seenIds: Set<string>, errors: string[]): raw is Book {
  const before = errors.length;
  if (typeof raw !== 'object' || raw === null) {
    errors.push(`${index + 1}件目: 本のデータの形になっていません`);
    return false;
  }
  const b = raw as Record<string, unknown>;
  const label = isNonEmptyString(b.title) ? `${index + 1}件目「${b.title}」` : `${index + 1}件目`;

  if (!isNonEmptyString(b.book_id)) {
    errors.push(`${label}: book_id がありません`);
  } else if (seenIds.has(b.book_id)) {
    errors.push(`${label}: book_id「${b.book_id}」が他の本と重複しています`);
  } else {
    seenIds.add(b.book_id);
  }
  if (!isNonEmptyString(b.title)) errors.push(`${label}: title がありません`);
  if (!isNonEmptyString(b.author)) errors.push(`${label}: author がありません`);
  if (b.translator !== undefined && !isNonEmptyString(b.translator)) {
    errors.push(`${label}: translator は文字で書くか、項目ごと省いてください`);
  }
  checkTagList(b.genres, GENRES, 'genres', label, errors);
  checkTagList(b.themes, THEMES, 'themes', label, errors);
  checkTagList(b.moods, MOODS, 'moods', label, errors);
  if (typeof b.difficulty !== 'string' || !(b.difficulty in DIFFICULTIES)) {
    errors.push(`${label}: difficulty に使えない値「${String(b.difficulty)}」があります`);
  }
  if (typeof b.length_category !== 'string' || !(b.length_category in LENGTHS)) {
    errors.push(`${label}: length_category に使えない値「${String(b.length_category)}」があります`);
  }
  if (!isNonEmptyString(b.description)) errors.push(`${label}: description がありません`);
  if (!Array.isArray(b.recommendation_reasons) || !b.recommendation_reasons.every(isNonEmptyString)) {
    errors.push(`${label}: recommendation_reasons は文字の配列にしてください`);
  }
  checkUrlOrNull(b.cover_image_url, 'cover_image_url', label, errors);
  checkUrlOrNull(b.purchase_url, 'purchase_url', label, errors);
  if (!isNonEmptyString(b.metadata_source)) errors.push(`${label}: metadata_source（確認元）がありません`);
  if (typeof b.metadata_verified !== 'boolean') {
    errors.push(`${label}: metadata_verified は true か false にしてください`);
  }

  return errors.length === before;
}

/**
 * 本のデータ全体をチェックする。
 * 情報が未確認（metadata_verified: false）の本は、実在しない情報を出さないよう、おすすめから外す。
 */
export function validateBooks(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(data)) {
    return { validBooks: [], errors: ['本のデータが配列（[ ] で囲んだ一覧）になっていません'] };
  }
  const seenIds = new Set<string>();
  const validBooks: Book[] = [];
  data.forEach((raw, i) => {
    if (validateOne(raw, i, seenIds, errors) && raw.metadata_verified) {
      validBooks.push(raw);
    }
  });
  return { validBooks, errors };
}
