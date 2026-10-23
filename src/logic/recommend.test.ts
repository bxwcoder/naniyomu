import { describe, expect, it } from 'vitest';
import booksData from '../data/books.json';
import autoBooksData from '../data/books.auto.json';
import {
  DIFFICULTY_CHOICES,
  GENRE_CHOICES,
  LENGTH_CHOICES,
  MOODS,
  NO_THEME,
  THEMES,
  type DifficultyChoice,
  type GenreChoice,
  type LengthChoice,
  type Mood,
  type ThemeChoice,
} from '../data/options.ts';
import type { Answers, Book } from '../types.ts';
import { matchFavoriteBooks } from './matchFavorite.ts';
import { passesRequired, recommend, scoreBook } from './recommend.ts';
import { validateBooks } from './validateBooks.ts';

const { validBooks: books, errors } = validateBooks(booksData);
const byId = (id: string) => books.find((b) => b.book_id === id)!;

const baseAnswers: Answers = {
  mood: 'absorbing',
  theme: 'world',
  difficulty: 'any',
  length: 'any',
  genre: 'any',
};

/** 質問の答え方をすべて組み合わせた一覧（5×6×4×4×5 = 2400通り） */
function allAnswerCombinations(): Answers[] {
  const result: Answers[] = [];
  for (const mood of Object.keys(MOODS) as Mood[])
    for (const theme of [...Object.keys(THEMES), NO_THEME] as ThemeChoice[])
      for (const difficulty of Object.keys(DIFFICULTY_CHOICES) as DifficultyChoice[])
        for (const length of Object.keys(LENGTH_CHOICES) as LengthChoice[])
          for (const genre of Object.keys(GENRE_CHOICES) as GenreChoice[])
            result.push({ mood, theme, difficulty, length, genre });
  return result;
}

describe('書籍データ', () => {
  it('books.json に形式の間違いがない', () => {
    expect(errors).toEqual([]);
    expect(books.length).toBe((booksData as unknown[]).length);
  });

  it('20冊以上あり、すべて確認済み・確認元つき', () => {
    expect(books.length).toBeGreaterThanOrEqual(20);
    for (const b of books) {
      expect(b.metadata_verified).toBe(true);
      expect(b.metadata_source).toMatch(/^https:\/\//);
    }
  });
});

describe('自動で集めた本のデータ（books.auto.json）', () => {
  const all = validateBooks([...booksData, ...autoBooksData]);

  it('手で書いた本と合わせても、形式の間違いや重複がない', () => {
    expect(all.errors).toEqual([]);
    expect(all.validBooks.length).toBe(booksData.length + autoBooksData.length);
  });

  it('すべて basic で、ISBN と国立国会図書館の確認元がある', () => {
    for (const b of autoBooksData as Book[]) {
      expect(b.tier).toBe('basic');
      expect(b.isbn).toMatch(/^97[89]\d{10}$/);
      expect(b.metadata_source).toMatch(/^https:\/\/ndlsearch\.ndl\.go\.jp\//);
    }
  });

  it('紹介文は basic の本だけ空でよい', () => {
    const base = books[0];
    expect(validateBooks([{ ...base, description: '', tier: 'basic' }]).errors).toEqual([]);
    expect(validateBooks([{ ...base, description: '' }]).errors).not.toEqual([]);
  });

  it('点数が同じなら、紹介文のある本（curated）が少し上になる', () => {
    const base = books[0];
    const basic: Book = { ...base, book_id: 'basic-copy', tier: 'basic' };
    expect(scoreBook(base, baseAnswers).score).toBeGreaterThan(scoreBook(basic, baseAnswers).score);
  });
});

describe('おすすめの基本動作', () => {
  it('すべての質問に答えると3冊おすすめされる（好きな本の入力なし）', () => {
    const result = recommend(books, baseAnswers);
    expect(result.status).toBe('ok');
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.map((r) => r.role)).toEqual(['best', 'nearby', 'discovery']);
    expect(new Set(result.recommendations.map((r) => r.book.book_id)).size).toBe(3);
    for (const r of result.recommendations) {
      expect(r.reasons.length).toBeGreaterThan(0);
      // カード用の短いラベルも、回答と合っている点が1つ以上ある
      expect(r.highlights.length).toBeGreaterThan(0);
    }
  });

  it('1冊目は候補の中でいちばん点数が高い', () => {
    const result = recommend(books, baseAnswers);
    const top = Math.max(...books.map((b) => scoreBook(b, baseAnswers).score));
    expect(result.recommendations[0].score).toBe(top);
  });

  it('おすすめされるのは登録済みの本だけ', () => {
    const ids = new Set(books.map((b) => b.book_id));
    for (const answers of allAnswerCombinations()) {
      for (const r of recommend(books, answers).recommendations) {
        expect(ids.has(r.book.book_id)).toBe(true);
      }
    }
  });
});

describe('必ず守る条件', () => {
  it('どの答え方でも、ジャンルと読みやすさの条件に合わない本は出ない', () => {
    for (const answers of allAnswerCombinations()) {
      const result = recommend(books, answers);
      for (const r of result.recommendations) {
        expect(passesRequired(r.book, answers)).toBe(true);
      }
      // 3冊そろわないときは、条件をゆるめずに「insufficient」を返す
      if (result.recommendations.length < 3) expect(result.status).toBe('insufficient');
    }
  });

  it('ジャンルや読みやすさが合うだけで、気分にも興味にも合わない本は出ない', () => {
    for (const answers of allAnswerCombinations()) {
      for (const r of recommend(books, answers).recommendations) {
        const d = scoreBook(r.book, answers);
        expect(d.mood || d.theme).toBe(true);
      }
    }
  });

  it('「漫画・コミック」を選ぶと漫画だけが出る', () => {
    const result = recommend(books, { ...baseAnswers, genre: 'manga' });
    for (const r of result.recommendations) expect(r.book.genres).toContain('manga');
  });

  it('「スラスラ読める本」を選ぶと、難しめ・ふつうの本は出ない', () => {
    const result = recommend(books, { ...baseAnswers, mood: 'learning', difficulty: 'smooth' });
    for (const r of result.recommendations) expect(r.book.difficulty).toBe('easy');
  });
});

describe('既読・好みと違う本', () => {
  it('既読の本はおすすめから外れる', () => {
    const first = recommend(books, baseAnswers).recommendations[0].book;
    const result = recommend(books, baseAnswers, { excludeBookIds: [first.book_id] });
    expect(result.recommendations.map((r) => r.book.book_id)).not.toContain(first.book_id);
  });

  it('1冊を外しても、同じジャンルの他の本は引き続き出せる', () => {
    const answers: Answers = { ...baseAnswers, genre: 'manga' };
    const first = recommend(books, answers).recommendations[0].book;
    const result = recommend(books, answers, { excludeBookIds: [first.book_id] });
    expect(result.recommendations.length).toBeGreaterThan(0);
    for (const r of result.recommendations) expect(r.book.genres).toContain('manga');
  });
});

describe('好きだった本の入力', () => {
  it('登録済みのタイトルが含まれていれば見つける（表記ゆれも可）', () => {
    expect(matchFavoriteBooks('バッタを倒しにアフリカへ。実体験を面白く読める本が好き。', books).map((b) => b.book_id))
      .toEqual(['batta-wo-taoshini']);
    expect(matchFavoriteBooks('『金持ち父さん貧乏父さん』', books).map((b) => b.book_id)).toEqual(['kanemochi-tosan']);
    expect(matchFavoriteBooks('サピエンス全史がよかった', books).map((b) => b.book_id)).toEqual(['sapiens']);
    expect(matchFavoriteBooks('factfulness', books).map((b) => b.book_id)).toEqual(['factfulness']);
  });

  it('登録されていない本は、勝手に別の本だと決めつけない', () => {
    expect(matchFavoriteBooks('ハリー・ポッターが好きでした', books)).toEqual([]);
    expect(matchFavoriteBooks('', books)).toEqual([]);
    expect(matchFavoriteBooks(undefined, books)).toEqual([]);
  });

  it('一致した場合は推薦に反映され、その本自体はおすすめに出ない', () => {
    const answers: Answers = { ...baseAnswers, favoriteText: 'バッタを倒しにアフリカへ' };
    const result = recommend(books, answers);
    expect(result.favoriteMatches.map((b) => b.book_id)).toEqual(['batta-wo-taoshini']);
    expect(result.recommendations.map((r) => r.book.book_id)).not.toContain('batta-wo-taoshini');
    expect(result.recommendations.some((r) => r.reasons.some((s) => s.includes('『バッタを倒しにアフリカへ』')))).toBe(true);
  });

  it('一致しない場合も、入力なしと同じように推薦できる', () => {
    const withText = recommend(books, { ...baseAnswers, favoriteText: '知らない本のタイトル' });
    const without = recommend(books, baseAnswers);
    expect(withText.recommendations.map((r) => r.book.book_id)).toEqual(
      without.recommendations.map((r) => r.book.book_id),
    );
  });

  it('同じ特徴に二重に点数を付けない（回答で点数を付けた気分は、共通点として数えない）', () => {
    const fav = byId('batta-wo-taoshini'); // 気分に absorbing を含む
    const detail = scoreBook(byId('golden-kamuy'), baseAnswers, [fav]); // 回答の気分も absorbing
    expect(detail.favoriteShared).not.toContain('mood:absorbing');
    expect(detail.favoriteShared).not.toContain('theme:world');
  });

  it('好きだった本の共通点は最大4点まで', () => {
    for (const b of books) {
      const withFav = scoreBook(b, baseAnswers, books).score;
      const without = scoreBook(b, baseAnswers).score;
      expect(withFav - without).toBeLessThanOrEqual(4);
    }
  });
});

describe('条件に合う本が少ないとき', () => {
  // 確認用の小さなデータ（実在の本の情報は使わず、テストのためだけの架空データ）
  const make = (id: string, over: Partial<Book>): Book => ({
    book_id: id,
    title: `テスト用データ${id}`,
    author: `テスト著者${id}`,
    genres: ['novel'],
    themes: ['life'],
    moods: ['moving'],
    difficulty: 'easy',
    length_category: 'medium',
    description: 'テスト用',
    recommendation_reasons: [],
    cover_image_url: null,
    purchase_url: null,
    isbn: null,
    metadata_source: 'https://example.com',
    metadata_verified: true,
    ...over,
  });
  const fixture = [
    make('a', { genres: ['manga'], moods: ['absorbing'] }),
    make('b', { genres: ['novel'], moods: ['absorbing'] }),
    make('c', { genres: ['novel'], moods: ['absorbing'] }),
    make('d', { genres: ['novel'], moods: ['absorbing'], difficulty: 'challenging' }),
  ];

  it('条件をゆるめず、見つかった本と「質問を変える案」を返す', () => {
    const result = recommend(fixture, { ...baseAnswers, genre: 'manga' });
    expect(result.status).toBe('insufficient');
    expect(result.recommendations.map((r) => r.book.book_id)).toEqual(['a']);
    if (result.status === 'insufficient') {
      const genreTip = result.suggestions.find((s) => s.question === 'genre');
      expect(genreTip?.availableCount).toBe(4);
    }
  });

  it('1冊も見つからない場合も、エラーにならず案内を返す', () => {
    const result = recommend(fixture, { ...baseAnswers, genre: 'nonfiction' });
    expect(result.status).toBe('insufficient');
    expect(result.recommendations).toEqual([]);
  });
});

describe('データの形式チェック', () => {
  it('使えない値・重複ID・未確認の本を見つける', () => {
    const good = books[0];
    const result = validateBooks([
      good,
      { ...good }, // 重複ID
      { ...good, book_id: 'x1', genres: ['horror'] }, // 定義にないジャンル
      { ...good, book_id: 'x2', metadata_verified: false }, // 未確認
      { ...good, book_id: 'x3', cover_image_url: 'http://insecure' },
    ]);
    expect(result.validBooks.map((b) => b.book_id)).toEqual([good.book_id]);
    expect(result.errors.some((e) => e.includes('重複'))).toBe(true);
    expect(result.errors.some((e) => e.includes('horror'))).toBe(true);
    expect(result.errors.some((e) => e.includes('cover_image_url'))).toBe(true);
  });

  it('配列でないデータはエラーとして扱う', () => {
    expect(validateBooks({}).errors).toHaveLength(1);
  });
});

describe('同じ点数の本の選ばれ方', () => {
  it('同じ「くじ」番号なら、毎回同じ結果になる', () => {
    const a = recommend(books, baseAnswers, { seed: 42 }).recommendations.map((r) => r.book.book_id);
    const b = recommend(books, baseAnswers, { seed: 42 }).recommendations.map((r) => r.book.book_id);
    expect(a).toEqual(b);
  });

  it('「くじ」を変えると、同じ点数の本の中から別の本も選ばれる（登録順だけで決まらない）', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      for (const r of recommend(books, baseAnswers, { seed }).recommendations) seen.add(r.book.book_id);
    }
    expect(seen.size).toBeGreaterThan(3);
  });

  it('どの「くじ」でも、1冊目は候補の中でいちばん点数が高い', () => {
    const top = Math.max(...books.map((b) => scoreBook(b, baseAnswers).score));
    for (let seed = 1; seed <= 20; seed++) {
      expect(recommend(books, baseAnswers, { seed }).recommendations[0].score).toBe(top);
    }
  });
});
