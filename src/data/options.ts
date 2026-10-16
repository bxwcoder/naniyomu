// 選択肢の定義
// 本のデータ（books.json）で使える値と、質問の文章・選択肢をここでまとめて決めています。
// 値を増やしたいときは、まずこのファイルに追加してください。

// ---- 本のデータで使う値 ----

/** ジャンル（1冊に複数付けられます） */
export const GENRES = {
  novel: '小説・物語',
  mystery_sf: 'ミステリー・SF',
  nonfiction: '実話・ノンフィクション',
  liberal_arts: '教養・科学・歴史',
  practical: '仕事・お金・暮らし',
  manga: '漫画・コミック',
} as const;
export type Genre = keyof typeof GENRES;

/** 読みたい気分（質問1と対応） */
export const MOODS = {
  absorbing: '面白くて夢中になれる',
  learning: '新しい知識が身につく',
  moving: '感動したり、心が動いたりする',
  relaxing: '気楽に読める',
  wonder: '予想外の世界を知れる',
} as const;
export type Mood = keyof typeof MOODS;

/** テーマ（質問2と対応） */
export const THEMES = {
  world: '知らない世界・冒険・実体験',
  life: '人間関係・人生・生き方',
  mystery: '謎解き・どんでん返し',
  practical: '仕事・お金・暮らしに役立つ知識',
  imagination: '想像力を刺激する物語',
} as const;
export type Theme = keyof typeof THEMES;

/** 読みやすさ */
export const DIFFICULTIES = {
  easy: 'スラスラ読める',
  normal: 'ふつう',
  challenging: 'じっくり考えながら読む',
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;

/** 本の長さ */
export const LENGTHS = {
  short: '短め',
  medium: 'ふつう',
  long: '長編・巻数が多い',
} as const;
export type LengthCategory = keyof typeof LENGTHS;

// ---- 質問の選択肢と、本のデータとの対応 ----

/** 質問3：読みやすさの希望 */
export const DIFFICULTY_CHOICES = {
  smooth: {
    label: 'スラスラ読める本',
    // 必ず守る条件：この読みやすさの本だけを候補にする
    allowed: ['easy'],
    // 点数を足す読みやすさ
    preferred: ['easy'],
  },
  somewhat: {
    label: '多少難しくても大丈夫',
    allowed: ['easy', 'normal'],
    preferred: ['normal'],
  },
  challenge: {
    label: 'じっくり考える本にも挑戦したい',
    allowed: ['easy', 'normal', 'challenging'],
    preferred: ['normal', 'challenging'],
  },
  any: {
    label: '内容次第で気にしない',
    allowed: ['easy', 'normal', 'challenging'],
    preferred: [],
  },
} as const satisfies Record<string, { label: string; allowed: readonly Difficulty[]; preferred: readonly Difficulty[] }>;
export type DifficultyChoice = keyof typeof DIFFICULTY_CHOICES;

/** 質問4：長さの希望（必ず守る条件ではなく、点数を足すだけ） */
export const LENGTH_CHOICES = {
  short: { label: '短めで読み切りやすい本', preferred: ['short'] },
  medium: { label: '普通の長さの本', preferred: ['medium'] },
  long: { label: '長編でも読み応えのある本', preferred: ['long'] },
  any: { label: '長さは気にしない', preferred: [] },
} as const satisfies Record<string, { label: string; preferred: readonly LengthCategory[] }>;
export type LengthChoice = keyof typeof LENGTH_CHOICES;

/** 質問5：読みたい本の種類（必ず守る条件） */
export const GENRE_CHOICES = {
  story: { label: '小説・物語', genres: ['novel', 'mystery_sf'] },
  nonfiction: { label: '実話・ノンフィクション', genres: ['nonfiction'] },
  practical: { label: '実用書・教養書', genres: ['liberal_arts', 'practical'] },
  manga: { label: '漫画・コミック', genres: ['manga'] },
  any: { label: 'ジャンルを問わずおすすめしてほしい', genres: [] },
} as const satisfies Record<string, { label: string; genres: readonly Genre[] }>;
export type GenreChoice = keyof typeof GENRE_CHOICES;

/** 質問2の「特に決まっていない」を表す値 */
export const NO_THEME = 'none';
export type ThemeChoice = Theme | typeof NO_THEME;

// ---- 質問の文章（画面で使います） ----

export const QUESTIONS = [
  {
    key: 'mood',
    text: '今、どんな気分で本を読みたいですか？',
    choices: [
      { value: 'absorbing', label: '面白くて夢中になれる本' },
      { value: 'learning', label: '新しい知識が身につく本' },
      { value: 'moving', label: '感動したり、心が動いたりする本' },
      { value: 'relaxing', label: '気楽に読める本' },
      { value: 'wonder', label: '予想外の世界を知れる本' },
    ],
  },
  {
    key: 'theme',
    text: '特に興味があるのは何ですか？',
    choices: [
      { value: 'world', label: '知らない世界・冒険・実体験' },
      { value: 'life', label: '人間関係・人生・生き方' },
      { value: 'mystery', label: '謎解き・どんでん返し' },
      { value: 'practical', label: '仕事・お金・暮らしに役立つ知識' },
      { value: 'imagination', label: '想像力を刺激する物語' },
      { value: NO_THEME, label: '特に決まっていない' },
    ],
  },
  {
    key: 'difficulty',
    text: '読みやすさの希望は？',
    choices: Object.entries(DIFFICULTY_CHOICES).map(([value, c]) => ({ value, label: c.label })),
  },
  {
    key: 'length',
    text: 'どれくらいの長さがいいですか？',
    choices: Object.entries(LENGTH_CHOICES).map(([value, c]) => ({ value, label: c.label })),
  },
  {
    key: 'genre',
    text: '読みたい本の種類は？',
    choices: Object.entries(GENRE_CHOICES).map(([value, c]) => ({ value, label: c.label })),
  },
] as const;
