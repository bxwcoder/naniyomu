// 点数の配分（初期設定）
// おすすめの順番を調整したいときは、このファイルの数字だけを変えてください。

export const SCORING = {
  /** 気分が合う */
  mood: 3,
  /** 興味のあるテーマが合う */
  theme: 3,
  /** 希望ジャンルが合う（「ジャンルを問わない」のときは全員0点） */
  genre: 3,
  /** 読みやすさが合う */
  difficulty: 2,
  /** 本の長さが合う */
  length: 1,
  /**
   * 1冊ずつ調べて紹介文まで書いた本（curated）に足す点数。
   * 点数が同じなら、自動で集めた本より紹介文のある本を先に出すための小さな差。
   */
  curated: 0.5,
  /** 好きだった本との共通点1つあたりの点数 */
  favoritePerFeature: 1,
  /** 好きだった本との共通点の上限 */
  favoriteMax: 4,
  /**
   * true のとき、気分かテーマのどちらか（または好きだった本との共通点）が合う本だけを候補にする。
   * ジャンルや読みやすさが合うだけの本を、無理におすすめしないための設定。
   */
  requireMoodOrThemeMatch: true,
} as const;

// 3冊を選ぶときの「似すぎ」を避けるための設定
export const DIVERSITY = {
  /** 2冊目：1冊目と似ている度合い（0〜1）に掛ける減点 */
  nearbyOverlapPenalty: 3,
  /** 3冊目：1・2冊目と似ている度合い（0〜1）に掛ける減点 */
  discoveryOverlapPenalty: 8,
  /** 同じ著者の本が続くときの減点 */
  sameAuthorPenalty: 5,
} as const;
