// 札（ジャンル・テーマ・気分・難しさ・長さ）を自動で決める規則
//
// 決める順番（先に決まったものが優先）：
//   1. 候補リストの「札の上書き」（d= / g= / t= / m=）
//   2. 1冊ごとの手がかり（分類番号・叢書名・タイトル・ページ数）からの決まり（下の NDC_PROFILES など。
//      テーマと気分は選定元の札に足し、読みやすさは選定元の決まりより優先）
//   3. 選定元ごとの決まり（下の SOURCE_RULES）
//   4. 国立国会図書館の分類番号（NDC）とジャンルからの決まり
// 1冊ごとの手がかりで決められない本は、これまでどおり選定元の決まりを使います。
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
  if (/^9\d?0/.test(ndc)) return ['liberal_arts']; // 文学の理論・文学史・作家論（901, 910.2 など）
  if (/^916/.test(ndc) || /^9\d[4-9]/.test(ndc)) return ['nonfiction']; // 記録・ルポ・随筆など
  if (/^2[89]/.test(ndc)) return ['nonfiction', 'liberal_arts']; // 伝記・地理・紀行
  // 生き方・会社の経営・投資・家庭・健康・商業。お金の理論や歴史（337、338.2 など）は教養に入れる
  if (/^(159|33[56]|338\.1[5-8]|59|498|67)/.test(ndc)) return ['practical'];
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

// ---- 1冊ごとの手がかり ----

/**
 * 実話・教養・実用の本のテーマと気分を、分類番号（NDC）から決める表。上から順に見て、最初に合ったものを使う。
 * 小説・漫画には使わない（日本の小説はほとんどが 913 で、分類番号から中身が分からないため）。
 */
export const NDC_PROFILES = [
  // 文学の中の実話：随筆・日記と紀行・記録とルポ（914 / 915 / 916、海外の 9x4〜9x6 も）
  { ndc: /^9\d?4/, themes: ['life'], moods: ['relaxing', 'moving'], narrative: true }, // 随筆・エッセイ
  { ndc: /^9\d?5/, themes: ['world', 'life'], moods: ['wonder', 'relaxing'], narrative: true }, // 日記・書簡・紀行
  { ndc: /^9\d?6/, themes: ['world', 'life'], moods: ['absorbing', 'wonder'], narrative: true }, // 記録・手記・ルポルタージュ
  { ndc: /^9\d?0/, themes: ['world'], moods: ['learning'] }, // 文学の評論・文学史
  // 歴史・伝記・地理
  { ndc: /^28/, themes: ['life'], moods: ['moving', 'learning'], narrative: true }, // 伝記
  { ndc: /^29/, themes: ['world'], moods: ['wonder', 'absorbing'], narrative: true }, // 地理・紀行・探検
  { ndc: /^2/, themes: ['world'], moods: ['learning', 'wonder'] }, // 歴史
  // 哲学・心理・生き方・宗教
  { ndc: /^159/, themes: ['life', 'practical'], moods: ['learning'] }, // 人生訓・生き方
  { ndc: /^1[0-5]/, themes: ['life'], moods: ['learning'] }, // 哲学・心理学・倫理
  { ndc: /^1/, themes: ['life', 'world'], moods: ['learning', 'wonder'] }, // 宗教
  // 社会
  { ndc: /^33[5-6]/, themes: ['practical'], moods: ['learning'] }, // 企業・経営
  { ndc: /^33/, themes: ['practical', 'world'], moods: ['learning'] }, // 経済・お金・財政
  { ndc: /^367/, themes: ['life'], moods: ['learning'] }, // 家族・男女・老い・子ども
  { ndc: /^36/, themes: ['world', 'life'], moods: ['learning'] }, // 社会・生活・社会問題
  { ndc: /^37/, themes: ['life', 'practical'], moods: ['learning'] }, // 教育
  { ndc: /^38/, themes: ['world'], moods: ['wonder', 'learning'] }, // 民俗・風習
  { ndc: /^3/, themes: ['world'], moods: ['learning'] }, // 政治・法律・国際など
  // 自然科学・医学
  { ndc: /^49[3-9]/, themes: ['practical'], moods: ['learning'] }, // 病気・健康・薬
  { ndc: /^4/, themes: ['world'], moods: ['learning', 'wonder'] }, // 数学・物理・宇宙・生き物・人体
  // 技術・暮らし・産業
  { ndc: /^59/, themes: ['practical'], moods: ['learning', 'relaxing'] }, // 家事・料理・衣服・住まい
  { ndc: /^5/, themes: ['world'], moods: ['learning', 'wonder'] }, // 工学・技術
  { ndc: /^6[7-9]/, themes: ['practical', 'world'], moods: ['learning'] }, // 商業・交通・通信
  { ndc: /^6/, themes: ['world'], moods: ['learning'] }, // 農業・産業
  // 芸術・スポーツ・ことば・その他
  { ndc: /^779/, themes: ['life'], moods: ['relaxing'] }, // 演芸（お笑い・落語など）
  { ndc: /^78/, themes: ['world'], moods: ['absorbing', 'learning'], narrative: true }, // スポーツ
  { ndc: /^7/, themes: ['world'], moods: ['wonder', 'learning'] }, // 美術・音楽・映画など
  { ndc: /^8/, themes: ['world'], moods: ['learning'] }, // ことば
  { ndc: /^0/, themes: ['world'], moods: ['learning'] }, // 情報・読書・図書館など
];

/** 学術書・古典の叢書。教養の本（随筆・ルポ・伝記などの読み物は除く）でこれらの版なら「じっくり考えながら読む」 */
const SCHOLARLY_SERIES = /学術文庫|学芸文庫|岩波文庫|平凡社ライブラリー|クラシックス|選書メチエ/;
/** 子ども向けの叢書・ライトノベルの叢書。これらの版なら「スラスラ読める」 */
const EASY_SERIES = /少年文庫|福音館文庫|偕成社文庫|青い鳥文庫|つばさ文庫|みらい文庫|ポプラポケット|ジュニア|電撃文庫|MF文庫J|ガガガ文庫|ファンタジア文庫|スニーカー文庫|ファミ通文庫|GA文庫|講談社ラノベ/;
/** 実話の読み物（随筆・ルポ・伝記・紀行など）で、このページ数までなら「スラスラ読める」 */
export const NARRATIVE_EASY_MAX_PAGES = 320;

/** 小説で、叢書名からはっきり分かる中身 */
const STORY_SERIES_THEMES = [
  // ミステリーの叢書名は使わない（創元推理文庫は昔SF・ファンタジーも同じ名前で出し、
  // ハヤカワ・ミステリ文庫などにも謎解きでない文学が入っているため）
  { series: /クリスティー|江戸川乱歩賞|横溝正史/, themes: ['mystery'] },
  // ハヤカワ文庫 JA は日本の作家の叢書でミステリーなども入るので使わない。ライトノベルの叢書も中身はいろいろなので使わない
  { series: /SF文庫|文庫[ .:：]*(SF|FT)\b/, themes: ['imagination'] },
];
/**
 * 小説で、タイトルの言葉からはっきり分かる中身（例：「〇〇殺人事件」は謎解き）。
 * 「事件」は歴史小説（生麦事件など）に、「殺人」は謎解きでない小説（オーダーメイド殺人クラブなど）にも、
 * 「魔法」「幽霊」などはたとえにも使われるので入れない。
 */
const STORY_TITLE_THEMES = [{ title: /探偵|密室|推理|刑事|警部|捜査/, themes: ['mystery'] }];

const isStory = (genres) => genres.some((g) => g === 'novel' || g === 'mystery_sf');
const isNonStory = (genres) => !isStory(genres) && !genres.includes('manga');

/** 実話・教養・実用の本の、分類番号から決めた札（決められなければ null） */
export function ndcProfile(genres, ndc) {
  if (!ndc || !isNonStory(genres)) return null;
  return NDC_PROFILES.find((p) => p.ndc.test(ndc)) ?? null;
}

/** 小説で、叢書名とタイトルから足すテーマ */
export function storyExtraThemes(genres, edition) {
  if (!isStory(genres)) return [];
  return [
    ...STORY_SERIES_THEMES.filter((r) => r.series.test(edition.series ?? '')).flatMap((r) => r.themes),
    ...STORY_TITLE_THEMES.filter((r) => r.title.test(edition.title ?? '')).flatMap((r) => r.themes),
  ];
}

/** 叢書とページ数から決める読みやすさ（決められなければ null） */
export function refineDifficulty(candidate, genres, edition, profile) {
  const series = edition.series ?? '';
  if (EASY_SERIES.test(series)) return 'easy';
  if (!isNonStory(genres)) return null;
  // 古典の名作（日本の名作・海外の名作）は、選定元の決まりのまま
  if (candidate.source === '日本の名作' || candidate.source === '海外の名作') return null;
  if (profile?.narrative) {
    // 読み物でも、学術・古典の叢書の版（古い時代の随筆・自伝など）はページ数で「スラスラ」にしない
    if (SCHOLARLY_SERIES.test(series)) return 'normal';
    if (edition.pages) return edition.pages <= NARRATIVE_EASY_MAX_PAGES ? 'easy' : 'normal';
    return null;
  }
  if (SCHOLARLY_SERIES.test(series)) return 'challenging';
  return null;
}

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
 * @param edition   使う版の情報 { ndc, pages, multiVolume, series, title }
 */
export function decideTags(candidate, edition) {
  const source = SOURCE_RULES[candidate.source] ?? {};
  const hints = candidate.hints;
  const genres =
    hints.genres ??
    source.genres ??
    genresFromNdc(edition.ndc) ??
    // 教養の定番で詩歌・戯曲の分類（911 など）の本は、歌論・詩の評論なので教養に入れる
    (candidate.source === '教養の定番' && /^9/.test(edition.ndc ?? '') ? ['liberal_arts'] : null);
  if (!genres) return null;
  const profile = ndcProfile(genres, edition.ndc);
  // 分類番号の札は、選定元の札（「エッセイ定番」なら人生・気楽など）を消さずに足す
  const baseThemes = profile
    ? unique([...profile.themes, ...(source.themes ?? [])])
    : (source.themes ?? unique(genres.flatMap((g) => GENRE_DEFAULTS[g]?.themes ?? [])));
  const themes = hints.themes ?? unique([...baseThemes, ...storyExtraThemes(genres, edition)]);
  const moods =
    hints.moods ??
    (profile
      ? unique([...profile.moods, ...(source.moods ?? [])])
      : (source.moods ?? unique(genres.flatMap((g) => GENRE_DEFAULTS[g]?.moods ?? []))));
  const difficulty =
    hints.difficulty ??
    refineDifficulty(candidate, genres, edition, profile) ??
    source.difficulty ??
    (genres.includes('manga') ? 'easy' : 'normal');
  // 漫画や上下巻・シリーズは、1冊のページ数ではなく「長編・巻数が多い」にする
  const length_category =
    genres.includes('manga') || edition.multiVolume
      ? 'long'
      : edition.pages
        ? lengthFromPages(edition.pages)
        : 'medium';
  return { genres, themes, moods, difficulty, length_category };
}
