// 国立国会図書館サーチ（OpenSearch）の応答（RSS形式のXML）を読み取る
// 外部の部品を増やさないよう、必要な項目だけを正規表現で取り出します。
// 実際の応答の形を確かめながら、読み取る項目を調整しています。

const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
    .trim();

/** 指定したタグの中身をすべて取り出す（属性つきのタグにも対応） */
function all(block, tag) {
  const re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  for (const m of block.matchAll(re)) out.push({ attrs: m[1] ?? '', value: decode(m[2]) });
  return out;
}
const first = (block, tag) => all(block, tag)[0]?.value ?? null;

/** RSS の <item> を1件ずつ、必要な項目に分けて返す */
export function parseOpenSearch(xml) {
  if (!xml) return [];
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  return items.map((it) => {
    const identifiers = all(it, 'dc:identifier');
    const isbns = identifiers
      .filter((x) => /ISBN/i.test(x.attrs))
      .map((x) => x.value.replace(/[-\s]/g, ''));
    return {
      title: first(it, 'dc:title') ?? first(it, 'title'),
      titleTranscription: first(it, 'dcndl:titleTranscription'),
      volume: first(it, 'dcndl:volume'),
      seriesTitle: first(it, 'dcndl:seriesTitle'),
      creators: all(it, 'dc:creator').map((x) => x.value),
      author: first(it, 'author'),
      publisher: all(it, 'dc:publisher').map((x) => x.value),
      issued: first(it, 'dcterms:issued') ?? first(it, 'pubDate'),
      extent: first(it, 'dc:extent') ?? first(it, 'dcterms:extent'),
      subjects: all(it, 'dc:subject').map((x) => `${x.attrs.match(/dcndl:(\w+)/)?.[1] ?? ''}:${x.value}`),
      categories: all(it, 'category').map((x) => x.value),
      isbns,
      link: first(it, 'link'),
    };
  });
}
