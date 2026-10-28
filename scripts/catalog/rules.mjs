// 札（ジャンル・テーマ・気分・難しさ・長さ）を自動で決める規則
//
// 決める順番（先に決まったものが優先）：
//   1. 候補リストの「札の上書き」（d= / g= / t= / m=）
//   2. 選定元ごとの決まり（下の SOURCE_RULES）
//   3. 国立国会図書館の分類番号（NDC）とジャンルからの決まり
// 値は src/data/options.ts と同じ英語の名前を使います（間違いはアプリのテストで見つかります）。

/** 選定元ごとの決まり */
export const SOURCE_RULES = {
  本屋大賞: { moods: ['absorbing', 'moving'], difficulty: 'normal' },
  直木賞: { moods: ['absorbing', 'moving'], difficulty: 'normal' },
  芥川賞: { themes: ['life'], moods: ['moving'], difficulty: 'normal' },
  マンガ大賞: { genres: ['manga'], difficulty: 'easy' },
  新書大賞: { difficulty: 'normal' },
  ミステリー定番: { genres: ['mystery_sf'], themes: ['mystery'], moods: ['absorbing'], difficulty: 'normal' },
  'SF・ファンタジー定番': { genres: ['mystery_sf'], themes: ['imagination'], moods: ['absorbing', 'wonder'], difficulty: 'normal' },
  日本の名作: { genres: ['novel'], themes: ['life'], moods: ['moving'], difficulty: 'normal' },
  人気の小説: { genres: ['novel'], themes: ['life'], moods: ['absorbing', 'moving'], difficulty: 'easy' },
  海外の名作: { genres: ['novel'], themes: ['life'], moods: ['moving'], difficulty: 'normal' },
  教養の定番: { difficulty: 'normal' },
  ノンフィクション定番: { genres: ['nonfiction'], themes: ['world'], moods: ['wonder', 'learning'], difficulty: 'normal' },
  漫画の定番: { genres: ['manga'], difficulty: 'easy' },
  エッセイ定番: { genres: ['nonfiction'], themes: ['life'], moods: ['relaxing'], difficulty: 'easy' },
};

/** 分類番号からジャンルを決める（例：913.6 → 日本の小説） */
export function genresFromNdc(ndc) {
  if (!ndc) return null;
  if (/^726(\.1)?$/.test(ndc)) return ['manga'];
  if (/^9\d3/.test(ndc)) return ['novel']; // 各国の小説・物語
  if (/^916/.test(ndc) || /^9\d[4-9]/.test(ndc)) return ['nonfiction']; // 記録・ルポ・随筆など
  if (/^2[89]/.test(ndc)) return ['nonfiction', 'liberal_arts']; // 伝記・地理・紀行
  if (/^(159|33|336|59|498|67)/.test(ndc)) return ['practical']; // 生き方・経済・家庭・健康・商業
  if (/^[0-8]/.test(ndc)) return ['liberal_arts'];
  return null;
}

/** ジャンルごとの、テーマ・気分の決まり */
const GENRE_DEFAULTS = {
  novel: { themes: ['life'], moods: ['absorbing', 'moving'] },
  mystery_sf: { themes: ['mystery'], moods: ['absorbing'] },
  nonfiction: { themes: ['world'], moods: ['wonder', 'learning'] },
  liberal_arts: { themes: ['world'], moods: ['learning', 'wonder'] },
  practical: { themes: ['practical'], moods: ['learning'] },
  manga: { themes: ['life'], moods: ['absorbing', 'relaxing'] },
};

/** 長さの札を決める基準（ページ数） */
export const LENGTH_RULE = { shortMax: 249, mediumMax: 449 };
export function lengthFromPages(pages) {
  if (pages <= LENGTH_RULE.shortMax) return 'short';
  if (pages <= LENGTH_RULE.mediumMax) return 'medium';
  return 'long';
}

const unique = (list) => [...new Set(list)];

/**
 * 1冊分の札を決める。決められないときは null（その本は入れない）。
 * @param candidate 候補リストの1行
 * @param edition   使う版の情報 { ndc, pages, multiVolume, series }
 */
export function decideTags(candidate, edition) {
  const source = SOURCE_RULES[candidate.source] ?? {};
  const hints = candidate.hints;
  const genres = hints.genres ?? source.genres ?? genresFromNdc(edition.ndc);
  if (!genres) return null;
  const themes = hints.themes ?? source.themes ?? unique(genres.flatMap((g) => GENRE_DEFAULTS[g]?.themes ?? []));
  const moods = hints.moods ?? source.moods ?? unique(genres.flatMap((g) => GENRE_DEFAULTS[g]?.moods ?? []));
  const difficulty = hints.difficulty ?? source.difficulty ?? (genres.includes('manga') ? 'easy' : 'normal');
  // 漫画や上下巻・シリーズは、1冊のページ数ではなく「長編・巻数が多い」にする
  const length_category =
    genres.includes('manga') || edition.multiVolume
      ? 'long'
      : edition.pages
        ? lengthFromPages(edition.pages)
        : 'medium';
  return { genres, themes, moods, difficulty, length_category };
}
