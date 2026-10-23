// おすすめ3冊を選ぶ処理
// 画面とは切り離してあり、「本の一覧」と「回答」を渡すと結果を返すだけの関数です。
//
// 手順:
//   1. 必ず守る条件（ジャンル・読みやすさ）に合わない本、既読の本などを除く
//   2. 残った本に点数を付ける
//   3. 点数の高い本から、似すぎないように3冊を選ぶ
//   4. 3冊それぞれにおすすめ理由を付ける
//   5. 3冊そろわないときは条件をゆるめず、質問を変える案を返す

import {
  DIFFICULTIES,
  DIFFICULTY_CHOICES,
  GENRE_CHOICES,
  GENRES,
  LENGTH_CHOICES,
  LENGTHS,
  MOODS,
  NO_THEME,
  THEMES,
  type Genre,
} from '../data/options.ts';
import type {
  Answers,
  Book,
  Recommendation,
  RecommendationRole,
  RecommendResult,
  RelaxSuggestion,
} from '../types.ts';
import { matchFavoriteBooks } from './matchFavorite.ts';
import { DIVERSITY, SCORING } from './scoringConfig.ts';

export interface RecommendOptions {
  /** おすすめから外す本（既読の本、「好みと違う」を押した本など） */
  excludeBookIds?: Iterable<string>;
  /**
   * 点数が同じ本の並び順を決める「くじ」の番号。
   * 同じ番号なら毎回同じ結果になる（テスト用）。画面では毎回変えて、同点の本がまんべんなく出るようにする。
   */
  seed?: number;
}

/** 番号から、毎回同じ並びの乱数を作る（mulberry32 という簡単な方法） */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 点数の内訳。おすすめ理由を作るときにも使う */
export interface ScoreDetail {
  score: number;
  mood: boolean;
  theme: boolean;
  genre: boolean;
  difficulty: boolean;
  length: boolean;
  /** 好きだった本との共通点（例: "mood:moving"） */
  favoriteShared: string[];
}

// ---- 1. 必ず守る条件 ----

function chosenGenres(answers: Answers): readonly Genre[] {
  return GENRE_CHOICES[answers.genre].genres;
}

export function matchesGenre(book: Book, answers: Answers): boolean {
  const genres = chosenGenres(answers);
  return genres.length === 0 || book.genres.some((g) => genres.includes(g));
}

export function matchesDifficulty(book: Book, answers: Answers): boolean {
  return (DIFFICULTY_CHOICES[answers.difficulty].allowed as readonly string[]).includes(book.difficulty);
}

export function passesRequired(book: Book, answers: Answers): boolean {
  return matchesGenre(book, answers) && matchesDifficulty(book, answers);
}

// ---- 2. 点数 ----

/** 本の特徴を「種類:値」の形の一覧にする（例: "genre:novel", "mood:moving"） */
function featureTags(book: Book): string[] {
  return [
    ...book.genres.map((g) => `genre:${g}`),
    ...book.themes.map((t) => `theme:${t}`),
    ...book.moods.map((m) => `mood:${m}`),
  ];
}

export function scoreBook(book: Book, answers: Answers, favoriteBooks: Book[] = []): ScoreDetail {
  const genres = chosenGenres(answers);
  const detail: ScoreDetail = {
    score: 0,
    mood: book.moods.includes(answers.mood),
    theme: answers.theme !== NO_THEME && book.themes.includes(answers.theme),
    genre: genres.length > 0 && book.genres.some((g) => genres.includes(g)),
    difficulty: (DIFFICULTY_CHOICES[answers.difficulty].preferred as readonly string[]).includes(book.difficulty),
    length: (LENGTH_CHOICES[answers.length].preferred as readonly string[]).includes(book.length_category),
    favoriteShared: [],
  };

  // 好きだった本との共通点。
  // 回答ですでに点数を付けた特徴（同じ気分・テーマ・ジャンル）は、二重に数えないよう除く。
  if (favoriteBooks.length > 0) {
    const alreadyCounted = new Set<string>([
      `mood:${answers.mood}`,
      `theme:${answers.theme}`,
      ...genres.map((g) => `genre:${g}`),
    ]);
    const favoriteTags = new Set(favoriteBooks.flatMap(featureTags));
    detail.favoriteShared = featureTags(book).filter((t) => favoriteTags.has(t) && !alreadyCounted.has(t));
  }

  detail.score =
    (detail.mood ? SCORING.mood : 0) +
    (detail.theme ? SCORING.theme : 0) +
    (detail.genre ? SCORING.genre : 0) +
    (detail.difficulty ? SCORING.difficulty : 0) +
    (detail.length ? SCORING.length : 0) +
    (book.tier === 'basic' ? 0 : SCORING.curated) +
    Math.min(detail.favoriteShared.length * SCORING.favoritePerFeature, SCORING.favoriteMax);
  return detail;
}

/** 好みに合っていると言える本か（気分・テーマ・好きだった本のどれかが合う） */
export function isRelevant(detail: ScoreDetail): boolean {
  if (!SCORING.requireMoodOrThemeMatch) return true;
  return detail.mood || detail.theme || detail.favoriteShared.length > 0;
}

// ---- 3. 似すぎないように選ぶ ----

/** 2冊がどれくらい似ているか（0〜1）。特徴の重なりの割合 */
export function similarity(a: Book, b: Book): number {
  const ta = new Set(featureTags(a));
  const tb = new Set(featureTags(b));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  const all = new Set([...ta, ...tb]).size;
  return all === 0 ? 0 : shared / all;
}

interface Candidate {
  book: Book;
  detail: ScoreDetail;
}

function pickBest(
  candidates: Candidate[],
  adjust: (c: Candidate) => number,
): Candidate | undefined {
  let best: Candidate | undefined;
  let bestValue = -Infinity;
  // 同点のときは一覧の先にある本を選ぶ（毎回同じ結果になるように）
  for (const c of candidates) {
    const v = adjust(c);
    if (v > bestValue) {
      best = c;
      bestValue = v;
    }
  }
  return best;
}

function sameAuthorPenalty(book: Book, chosen: Candidate[]): number {
  return chosen.some((c) => c.book.author === book.author) ? DIVERSITY.sameAuthorPenalty : 0;
}

function selectThree(pool: Candidate[]): [Candidate, RecommendationRole][] {
  const best = pool[0];
  const rest1 = pool.slice(1);
  const nearby = pickBest(
    rest1,
    (c) =>
      c.detail.score -
      DIVERSITY.nearbyOverlapPenalty * similarity(c.book, best.book) -
      sameAuthorPenalty(c.book, [best]),
  )!;
  const rest2 = rest1.filter((c) => c !== nearby);
  const discovery = pickBest(
    rest2,
    (c) =>
      c.detail.score -
      DIVERSITY.discoveryOverlapPenalty *
        Math.max(similarity(c.book, best.book), similarity(c.book, nearby.book)) -
      sameAuthorPenalty(c.book, [best, nearby]),
  )!;
  return [
    [best, 'best'],
    [nearby, 'nearby'],
    [discovery, 'discovery'],
  ];
}

// ---- 4. おすすめ理由 ----

function tagLabel(tag: string): string {
  const [kind, value] = tag.split(':');
  const table: Record<string, Record<string, string>> = { genre: GENRES, theme: THEMES, mood: MOODS };
  return table[kind]?.[value] ?? value;
}

/** カード用の短いラベル。読みやすさはカードに別に表示するので含めない */
export function buildHighlights(book: Book, detail: ScoreDetail, answers: Answers, favoriteBooks: Book[]): string[] {
  const list: string[] = [];
  if (detail.theme && answers.theme !== NO_THEME) list.push(`興味：${THEMES[answers.theme]}`);
  if (detail.mood) list.push(`気分：${MOODS[answers.mood]}`);
  if (detail.length) list.push(`長さ：${LENGTHS[book.length_category]}`);
  if (detail.favoriteShared.length > 0 && favoriteBooks.length > 0) {
    list.push(`『${favoriteBooks[0].title}』と共通点あり`);
  }
  return list;
}

export function buildReasons(
  book: Book,
  detail: ScoreDetail,
  answers: Answers,
  role: RecommendationRole,
  favoriteBooks: Book[],
  firstBook?: Book,
): string[] {
  // 役割（1冊目・2冊目・3冊目）は画面のラベルで示すので、ここでは回答との一致点だけを書く
  const reasons: string[] = [];

  if (detail.theme && answers.theme !== NO_THEME) {
    reasons.push(`あなたは「${THEMES[answers.theme]}」に興味があるため、このテーマの本を選びました。`);
  }
  if (detail.mood) {
    reasons.push(`「${MOODS[answers.mood]}」本を読みたい、という今の気分に合っています。`);
  }
  if (detail.difficulty) {
    reasons.push(`読みやすさは「${DIFFICULTIES[book.difficulty]}」で、希望に合っています。`);
  }
  if (detail.length) {
    reasons.push(`長さは「${LENGTHS[book.length_category]}」で、希望に合っています。`);
  }
  if (detail.favoriteShared.length > 0) {
    const titles = favoriteBooks.map((b) => `『${b.title}』`).join('、');
    const shared = detail.favoriteShared.slice(0, 3).map(tagLabel).join('」「');
    reasons.push(`あなたが挙げた${titles}と「${shared}」という共通点があります。`);
  }
  if (role === 'discovery' && firstBook && !book.genres.some((g) => firstBook.genres.includes(g))) {
    reasons.push(`1冊目とは違う「${GENRES[book.genres[0]]}」の本で、別の角度から楽しめます。`);
  }
  if (book.recommendation_reasons.length > 0) {
    reasons.push(`この本の特徴：${book.recommendation_reasons.join('／')}`);
  }
  return reasons;
}

// ---- 5. 3冊そろわないときの案内 ----

function countAvailable(books: Book[], answers: Answers, excluded: Set<string>): number {
  return books.filter(
    (b) =>
      !excluded.has(b.book_id) &&
      passesRequired(b, answers) &&
      isRelevant(scoreBook(b, answers)),
  ).length;
}

function buildSuggestions(books: Book[], answers: Answers, excluded: Set<string>): RelaxSuggestion[] {
  const suggestions: RelaxSuggestion[] = [];
  if (answers.genre !== 'any') {
    const n = countAvailable(books, { ...answers, genre: 'any' }, excluded);
    suggestions.push({
      question: 'genre',
      message: `本の種類を「${GENRE_CHOICES.any.label}」に変えると、${n}冊が候補になります。`,
      availableCount: n,
    });
  }
  if (answers.difficulty !== 'any') {
    const n = countAvailable(books, { ...answers, difficulty: 'any' }, excluded);
    suggestions.push({
      question: 'difficulty',
      message: `読みやすさを「${DIFFICULTY_CHOICES.any.label}」に変えると、${n}冊が候補になります。`,
      availableCount: n,
    });
  }
  return suggestions;
}

// ---- まとめ ----

export function recommend(books: Book[], answers: Answers, options: RecommendOptions = {}): RecommendResult {
  const favoriteMatches = matchFavoriteBooks(answers.favoriteText, books);
  // 好きだった本として挙げられた本は、もう読んでいるのでおすすめから外す
  const excluded = new Set<string>([
    ...(options.excludeBookIds ?? []),
    ...favoriteMatches.map((b) => b.book_id),
  ]);

  const pool: Candidate[] = books
    .filter((book) => !excluded.has(book.book_id) && passesRequired(book, answers))
    .map((book) => ({ book, detail: scoreBook(book, answers, favoriteMatches) }))
    .filter((c) => isRelevant(c.detail));
  // 点数の高い順に並べる（sort は同点のとき元の順番を保つ）
  // 同点の本は「くじ」で並べ、登録順が早い本ばかりが選ばれないようにする
  const random = seededRandom(options.seed ?? 1);
  const tieBreak = new Map(pool.map((c) => [c.book.book_id, random()]));
  pool.sort(
    (a, b) => b.detail.score - a.detail.score || tieBreak.get(a.book.book_id)! - tieBreak.get(b.book.book_id)!,
  );

  const toRecommendation = ([c, role]: [Candidate, RecommendationRole], firstBook?: Book): Recommendation => ({
    book: c.book,
    role,
    score: c.detail.score,
    reasons: buildReasons(c.book, c.detail, answers, role, favoriteMatches, firstBook),
    highlights: buildHighlights(c.book, c.detail, answers, favoriteMatches),
  });

  if (pool.length < 3) {
    const roles: RecommendationRole[] = ['best', 'nearby'];
    return {
      status: 'insufficient',
      recommendations: pool.map((c, i) => toRecommendation([c, roles[i]])),
      favoriteMatches,
      suggestions: buildSuggestions(books, answers, excluded),
    };
  }

  const picked = selectThree(pool);
  const firstBook = picked[0][0].book;
  return {
    status: 'ok',
    recommendations: picked.map((p) => toRecommendation(p, firstBook)),
    favoriteMatches,
  };
}
