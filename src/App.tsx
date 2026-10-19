// アプリ全体のまとめ役
// 今どの画面を表示するか、質問の回答、おすすめ結果をここで管理します。
// おすすめの計算そのものは logic/recommend.ts に任せ、ここでは画面の切り替えだけを行います。

import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header.tsx';
import { QUESTIONS } from './data/options.ts';
import { loadBooks } from './data/loadBooks.ts';
import { navigate, paths, useHashRoute, type Route } from './hooks/useHashRoute.ts';
import { recommend } from './logic/recommend.ts';
import { BookDetailPage } from './pages/BookDetailPage.tsx';
import { FavoritePage } from './pages/FavoritePage.tsx';
import { QuestionPage, type QuestionKey } from './pages/QuestionPage.tsx';
import { ResultsPage } from './pages/ResultsPage.tsx';
import { ShelfPage } from './pages/ShelfPage.tsx';
import { TopPage } from './pages/TopPage.tsx';
import { excludedBookIds, LibraryProvider, useLibrary } from './state/library.tsx';
import type { Answers, Book, RecommendResult, RelaxSuggestion } from './types.ts';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; books: Book[] };

/** 5問すべてに答えていれば Answers として返す */
function completeAnswers(draft: Partial<Answers>): Answers | null {
  return QUESTIONS.every((q) => draft[q.key] !== undefined) ? (draft as Answers) : null;
}

/** まだ答えていない最初の質問の番号（全部答えていれば -1） */
function firstUnanswered(draft: Partial<Answers>): number {
  return QUESTIONS.findIndex((q) => draft[q.key] === undefined);
}

function backTarget(route: Route): string | undefined {
  switch (route.name) {
    case 'top':
      return undefined;
    case 'question':
      return route.index === 0 ? paths.top : paths.question(route.index - 1);
    case 'favorite':
      return paths.question(QUESTIONS.length - 1);
    case 'results':
      return paths.favorite;
    case 'book':
      return paths.results;
    case 'shelf':
      return paths.top;
  }
}

function AppInner() {
  const route = useHashRoute();
  const lib = useLibrary();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [draft, setDraft] = useState<Partial<Answers>>({});
  const [favoriteText, setFavoriteText] = useState('');
  const [result, setResult] = useState<RecommendResult | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  // ---- 書籍データの読み込み ----
  const startLoading = useCallback(() => {
    setLoad({ status: 'loading' });
    loadBooks()
      .then(({ books }) => setLoad({ status: 'ready', books }))
      .catch((e: unknown) => {
        console.error(e);
        setLoad({ status: 'error', message: '本のデータを読み込めませんでした。' });
      });
  }, []);
  useEffect(startLoading, [startLoading]);

  // ---- 画面が変わったら、いちばん上に戻して読み上げ位置も移す ----
  const routeKey = JSON.stringify(route);
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [routeKey]);

  // ---- 順番どおりでない画面に直接来たときは、正しい画面へ移す ----
  useEffect(() => {
    if (route.name === 'question') {
      const missing = firstUnanswered(draft);
      if (missing !== -1 && missing < route.index) navigate(paths.question(missing), { replace: true });
    }
    if (route.name === 'favorite' && !completeAnswers(draft)) {
      navigate(paths.question(Math.max(firstUnanswered(draft), 0)), { replace: true });
    }
    if (route.name === 'results' && !result) {
      navigate(paths.top, { replace: true });
    }
  }, [route, draft, result]);

  const runRecommend = (books: Book[], answers: Answers) => {
    setResult(recommend(books, answers, { excludeBookIds: excludedBookIds(lib.state) }));
  };

  let content: React.ReactNode;
  if (load.status === 'loading') {
    content = (
      <div role="status">
        <div className="spinner" aria-hidden="true" />
        <p className="empty">本のデータを読み込んでいます…</p>
      </div>
    );
  } else if (load.status === 'error') {
    content = (
      <div className="notice notice--error" role="alert">
        <p>{load.message}</p>
        <p>通信状態を確認して、もう一度お試しください。</p>
        <button type="button" className="btn" onClick={startLoading}>
          もう一度読み込む
        </button>
      </div>
    );
  } else {
    const { books } = load;
    switch (route.name) {
      case 'top':
        content = (
          <TopPage
            hasPreviousResult={result !== null}
            onStart={() => {
              setDraft({});
              setFavoriteText('');
              navigate(paths.question(0));
            }}
          />
        );
        break;

      case 'question': {
        const index = Math.min(Math.max(route.index, 0), QUESTIONS.length - 1);
        const goNext = () =>
          navigate(index + 1 < QUESTIONS.length ? paths.question(index + 1) : paths.favorite);
        content = (
          <QuestionPage
            key={index}
            index={index}
            answers={draft}
            onAnswer={(key: QuestionKey, value: string) => {
              setDraft((d) => ({ ...d, [key]: value }));
              goNext();
            }}
            onBack={() => navigate(index === 0 ? paths.top : paths.question(index - 1))}
            onNext={goNext}
          />
        );
        break;
      }

      case 'favorite':
        content = (
          <FavoritePage
            text={favoriteText}
            onChange={setFavoriteText}
            onBack={() => navigate(paths.question(QUESTIONS.length - 1))}
            onSubmit={(text) => {
              const answers = completeAnswers(draft);
              if (!answers) return;
              setFavoriteText(text);
              runRecommend(books, { ...answers, favoriteText: text });
              navigate(paths.results);
            }}
          />
        );
        break;

      case 'results': {
        const answers = completeAnswers(draft);
        content =
          result && answers ? (
            <ResultsPage
              key={result.recommendations.map((r) => r.book.book_id).join(',')}
              result={result}
              favoriteText={favoriteText}
              onRefresh={() => runRecommend(books, { ...answers, favoriteText })}
              onRestart={() => {
                setDraft({});
                setFavoriteText('');
                navigate(paths.question(0));
              }}
              onApplySuggestion={(s: RelaxSuggestion) => {
                const changed: Answers = { ...answers, [s.question]: 'any' };
                setDraft(changed);
                runRecommend(books, { ...changed, favoriteText });
                window.scrollTo(0, 0);
              }}
            />
          ) : null;
        break;
      }

      case 'book': {
        const book = books.find((b) => b.book_id === route.id);
        const highlights = result?.recommendations.find((r) => r.book.book_id === route.id)?.highlights;
        content = <BookDetailPage book={book} highlights={highlights} />;
        break;
      }

      case 'shelf':
        content = <ShelfPage tab={route.tab} books={books} />;
        break;
    }
  }

  return (
    <>
      <Header backTo={backTarget(route)} showLogo={route.name !== 'top'} />
      <main ref={mainRef} tabIndex={-1}>
        {content}
      </main>
    </>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <AppInner />
    </LibraryProvider>
  );
}
