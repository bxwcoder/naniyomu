// 本の候補リスト（data/catalog/candidates.tsv）を読み込む

import { readFile } from 'node:fs/promises';

export const CANDIDATES_PATH = 'data/catalog/candidates.tsv';

/** 候補1冊を見分けるための文字（タイトルと著者の組み合わせ） */
export const candidateKey = (c) => `${c.title}|${c.author}`;

/** 「d=easy;t=life,mystery」の形の札の上書きを読み取る */
function parseHints(text) {
  const hints = {};
  for (const part of (text ?? '').split(';').map((s) => s.trim()).filter(Boolean)) {
    const [key, value] = part.split('=');
    const values = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (key === 'd') hints.difficulty = values[0];
    else if (key === 'g') hints.genres = values;
    else if (key === 't') hints.themes = values;
    else if (key === 'm') hints.moods = values;
    else throw new Error(`札の上書き「${part}」が読めません（d= / g= / t= / m= のどれかで書いてください）`);
  }
  return hints;
}

export async function loadCandidates(path = CANDIDATES_PATH) {
  const lines = (await readFile(path, 'utf8')).split('\n');
  const out = [];
  const seen = new Set();
  let header = true;
  for (const [i, line] of lines.entries()) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (header) {
      header = false; // 1行目（見出し）は飛ばす
      continue;
    }
    const [title, author, source, hints] = line.split('\t').map((s) => s?.trim());
    if (!title || !author || !source) throw new Error(`${path} の ${i + 1}行目：タイトル・著者・選定元のどれかが空です`);
    const c = { title, author, source, hints: parseHints(hints) };
    if (seen.has(candidateKey(c))) continue; // 同じ本が2回書かれていたら1回目だけ使う
    seen.add(candidateKey(c));
    out.push(c);
  }
  return out;
}
