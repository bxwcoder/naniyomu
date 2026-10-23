// 国立国会図書館サーチ（OpenSearch）への問い合わせ
//
// 利用条件：国立国会図書館サーチの外部提供インタフェース（API）の利用条件に従います。
//   https://ndlsearch.ndl.go.jp/help/api
//   ※API の利用は非営利目的が前提です。広告や購入リンクで収益を得るようになったら、利用条件を確認し直します。

const ENDPOINT = 'https://ndlsearch.ndl.go.jp/api/opensearch';
const USER_AGENT = 'naniyomu-book-data/0.1 (+https://github.com/bxwcoder/naniyomu)';
/** 問い合わせの間隔（ミリ秒）。国立国会図書館の負担にならないよう広めにとる */
export const INTERVAL_MS = 3000;
/** 1回の問い合わせで待つ最大時間（ミリ秒）。応答が遅いことがあるので長めにする */
const TIMEOUT_MS = 90000;
/** 「問い合わせが多すぎます」（429）と言われたときに待つ時間（ミリ秒） */
const RATE_LIMIT_WAIT_MS = 60000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 問い合わせて、応答の文字列を返す。失敗したら3回まで試し、だめなら status 0 を返す */
export async function query(params) {
  const url = `${ENDPOINT}?${new URLSearchParams(params)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // 応答が返ってこないときに待ち続けないよう、一定時間であきらめて次の試行に進む
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const text = await res.text();
      if (res.ok) return { url, status: res.status, text };
      console.warn(`  ${res.status} が返りました（${attempt}回目）: ${url}`);
      if (res.status < 500 && res.status !== 429) return { url, status: res.status, text };
      if (res.status === 429) {
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
    } catch (e) {
      console.warn(`  通信エラー（${attempt}回目）: ${e.message}`);
    }
    await sleep(INTERVAL_MS * attempt * 2);
  }
  return { url, status: 0, text: '' };
}

/** 国立国会図書館の著者名「小川, 洋子, 1962-」を「小川洋子」の形にそろえる */
export function normalizeName(name) {
  return name.normalize('NFKC').replace(/,?\s*\d{4}-(\d{4})?/g, '').replace(/[,\s・=＝.]/g, '');
}

/** 著者名から「（原作）」などの補足や、複数著者の2人目以降を外す */
export function mainAuthor(author) {
  return author.split(/[、,]/)[0].replace(/（.*?）|\(.*?\)/g, '').trim();
}

/**
 * 国立国会図書館の著者名の一覧に、この著者が含まれるか。
 * 外国の著者は「ハインライン, ロバート・A.」のように姓が先なので、「・」で区切った最後（姓）でも比べる。
 */
export function creatorMatches(creators, author) {
  const full = normalizeName(mainAuthor(author));
  const parts = mainAuthor(author).normalize('NFKC').split(/[・\s]/).filter(Boolean);
  const surname = parts.length > 1 ? parts[parts.length - 1] : null;
  return creators.some((c) => {
    const n = normalizeName(c);
    if (!n) return false;
    if (n.includes(full) || full.includes(n)) return true;
    return surname !== null && surname.length >= 2 && n.startsWith(surname);
  });
}
