// データの形
// 本のデータや、質問の回答がどんな形をしているかをここで決めています。

import type {
  DifficultyChoice,
  Difficulty,
  Genre,
  GenreChoice,
  LengthCategory,
  LengthChoice,
  Mood,
  Theme,
  ThemeChoice,
} from './data/options.ts';

/** 1冊の本のデータ（books.json の1件分） */
export interface Book {
  book_id: string;
  title: string;
  author: string;
  /** 翻訳者（翻訳書の場合だけ） */
  translator?: string;
  genres: Genre[];
  themes: Theme[];
  moods: Mood[];
  difficulty: Difficulty;
  length_category: LengthCategory;
  description: string;
  /** 推薦理由を作るための、この本の特徴 */
  recommendation_reasons: string[];
  cover_image_url: string | null;
  purchase_url: string | null;
  /** 書誌情報を確認したページ */
  metadata_source: string;
  metadata_verified: boolean;
}

/** 5つの質問への回答 */
export interface Answers {
  mood: Mood;
  theme: ThemeChoice;
  difficulty: DifficultyChoice;
  length: LengthChoice;
  genre: GenreChoice;
  /** 「最近、面白かった本」の自由入力（任意） */
  favoriteText?: string;
}

/** おすすめ3冊それぞれの役割 */
export type RecommendationRole = 'best' | 'nearby' | 'discovery';

export interface Recommendation {
  book: Book;
  role: RecommendationRole;
  score: number;
  /** 画面に表示するおすすめ理由（文章） */
  reasons: string[];
  /** カードに表示する、回答と合っている点の短いラベル（例：「気分：気楽に読める」） */
  highlights: string[];
}

/** 条件をゆるめたら何冊見つかるか、の案内 */
export interface RelaxSuggestion {
  /** どの質問を変えるか */
  question: 'genre' | 'difficulty';
  /** 画面に出す文章 */
  message: string;
  /** 変更した場合に条件に合う本の数 */
  availableCount: number;
}

export type RecommendResult =
  | {
      status: 'ok';
      recommendations: Recommendation[];
      favoriteMatches: Book[];
    }
  | {
      /** 条件に合う本が3冊に満たない */
      status: 'insufficient';
      recommendations: Recommendation[];
      favoriteMatches: Book[];
      suggestions: RelaxSuggestion[];
    };
