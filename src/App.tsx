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
import { QuestionPage, type QuestionKey } from './pages/QuestionPage.tsx';
import { ResultsPage } from './pages/ResultsPage.tsx';
import { ShelfPage } from './pages/ShelfPage.tsx';
import { TopPage } from './pages/TopPage.tsx';
import { excludedBookIds, LibraryProvider, useLibrary } from './state/library.tsx';
import { browserStore, loadSessionRaw, restoreSession, saveSession, toStoredSession } from './state/storage.ts';
import { OfflineNotice } from './components/OfflineNotice.tsx';
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
    case 'results':
      return paths.question(QUESTIONS.length - 1);
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
  const [result, setResult] = useState<RecommendResult | null>(null);
  // 前回の回答と結果を読み込み終えたか
  const [restored, setRestored] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const store = useRef(browserStore()).current;

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

  // ---- 前回の回答とおすすめ結果を読み込む（本のデータが読み込めてから） ----
  useEffect(() => {
    if (load.status !== 'ready' || restored) return;
    const saved = restoreSession(loadSessionRaw(store), load.books);
    setDraft(saved.answers);
    setResult(saved.result);
    setRestored(true);
  }, [load, restored, store]);

  // ---- 回答や結果が変わったら保存する ----
  useEffect(() => {
    if (restored) saveSession(store, toStoredSession(draft, result));
  }, [restored, store, draft, result]);

  // ---- 画面が変わったら、いちばん上に戻して読み上げ位置も移す ----
  const routeKey = JSON.stringify(route);
  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [routeKey]);

  // ---- 順番どおりでない画面に直接来たときは、正しい画面へ移す ----
  useEffect(() => {
    if (!restored) return;
    if (route.name === 'question') {
      const missing = firstUnanswered(draft);
      if (missing !== -1 && missing < route.index) navigate(paths.question(missing), { replace: true });
    }
    if (route.name === 'results' && !result) {
      navigate(paths.top, { replace: true });
    }
  }, [route, draft, result, restored]);

  const runRecommend = (books: Book[], answers: Answers) => {
    setResult(
      recommend(books, answers, {
        excludeBookIds: excludedBookIds(lib.state),
        // 毎回ちがう「くじ」にして、同じ点数の本がまんべんなく出るようにする
        seed: Math.floor(Math.random() * 2 ** 31),
      }),
    );
  };

  let content: React.ReactNode;
  if (load.status === 'loading' || (load.status === 'ready' && !restored)) {
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
        {/* 一度失敗した読み込みはブラウザが覚えてしまうので、ページごと読み込み直す */}
        <button type="button" className="btn" onClick={() => window.location.reload()}>
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
              navigate(paths.question(0));
            }}
          />
        );
        break;

      case 'question': {
        const index = Math.min(Math.max(route.index, 0), QUESTIONS.length - 1);
        const isLast = index + 1 === QUESTIONS.length;
        // 次の質問へ。最後の質問なら、すぐにおすすめを計算して結果を表示する
        const goNext = (answered: Partial<Answers>) => {
          if (!isLast) {
            navigate(paths.question(index + 1));
            return;
          }
          const answers = completeAnswers(answered);
          if (!answers) {
            navigate(paths.question(Math.max(firstUnanswered(answered), 0)));
            return;
          }
          runRecommend(books, answers);
          navigate(paths.results);
        };
        content = (
          <QuestionPage
            key={index}
            index={index}
            answers={draft}
            onAnswer={(key: QuestionKey, value: string) => {
              const next = { ...draft, [key]: value };
              setDraft(next);
              goNext(next);
            }}
            onBack={() => navigate(index === 0 ? paths.top : paths.question(index - 1))}
            onNext={() => goNext(draft)}
          />
        );
        break;
      }

      case 'results': {
        const answers = completeAnswers(draft);
        content =
          result && answers ? (
            <ResultsPage
              key={result.recommendations.map((r) => r.book.book_id).join(',')}
              result={result}
              onRefresh={() => runRecommend(books, answers)}
              onRestart={() => {
                setDraft({});
                navigate(paths.question(0));
              }}
              onApplySuggestion={(s: RelaxSuggestion) => {
                const changed: Answers = { ...answers, [s.question]: 'any' };
                setDraft(changed);
                runRecommend(books, changed);
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
      <OfflineNotice />
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
