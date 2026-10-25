# ナニヨム

**次に読む本、もう迷わない。**

いくつかの質問に答えるだけで、あなたに合った本を3冊おすすめするアプリです（開発中）。

## いまの状態

- 5つの質問に答えると、登録済みの本から3冊をおすすめします。本は2種類あります。
  - 1冊ずつ調べて紹介文まで書いた本（`src/data/books.json`）
  - 候補リストから国立国会図書館の情報で自動で作った本（`src/data/books.auto.json`。紹介文なし）
- お気に入り・読んだ本・反応・前回の結果は、この端末のブラウザに保存されます（会員登録なし）。
- スマートフォンの「ホーム画面に追加」に対応しています（PWA）。一度開けば、オフラインでも画面と本のデータを使えます。外部サイトへのリンクはオフラインでは開けません。

## ファイルの役割

| ファイル | 役割 |
|---|---|
| `src/data/books.json` | 1冊ずつ書いた本のデータ。タイトル・著者・ジャンル・紹介文など |
| `src/data/books.auto.json` | 自動で作った本のデータ（手で書き換えない。下の「本を増やすとき」を参照） |
| `data/catalog/candidates.tsv` | 自動で入れる本の候補リスト（1冊1行） |
| `data/catalog/report.md` | 自動で作った結果の報告（入れなかった本と理由、選んだ版） |
| `scripts/catalog/` | 候補を国立国会図書館で探す・札を決める・本のデータを作るプログラム |
| `src/data/options.ts` | ジャンル・気分・テーマなどの選択肢と、質問の文章 |
| `src/types.ts` | データの形の定義 |
| `src/logic/scoringConfig.ts` | おすすめの点数の配分（ここの数字を変えると順番が変わる） |
| `src/logic/recommend.ts` | おすすめ3冊を選ぶ処理 |
| `src/logic/matchFavorite.ts` | 「好きだった本」の入力を登録済みの本と照らし合わせる処理 |
| `src/logic/validateBooks.ts` | 本のデータに書き間違いがないかを調べる処理 |
| `src/logic/isbn.ts` | ISBN（本の番号）の打ち間違いの確認と、10けた→13けたの変換 |
| `src/logic/recommend.test.ts` | 上の処理が正しく動くかを確かめる自動テスト |
| `src/App.tsx` と `src/pages/` | 各画面（トップ・質問・結果・詳細・本棚） |
| `src/state/library.tsx` | お気に入り・読んだ本・反応の管理 |
| `src/state/storage.ts` | ブラウザへの保存と読み込み（壊れたデータは読み飛ばす） |
| `src/components/Logo.tsx` | ロゴ（Zen Maru Gothic の字形を図形化。利用条件は `LICENSE-ZenMaruGothic.txt`） |
| `public/manifest.webmanifest` | ホーム画面に追加するための設定 |
| `public/sw.js` | オフラインでも開けるようにする仕組み（サービスワーカー） |
| `public/icons/` | アプリのアイコン |

## 本を増やすとき（たくさん入れる場合）

1. `data/catalog/candidates.tsv` に「タイトル・著者・選定元・札の上書き」を1行ずつ足します。
2. GitHub の自動実行（1時間ごと）が、国立国会図書館で本を探し、`src/data/books.auto.json` を作り直します。
   - タイトルと著者が一致し、ISBN のある本だけが入ります。
   - テストに通ったときだけ保存されます。結果は `data/catalog/report.md` で確認できます。
3. 札（ジャンル・気分など）の決め方は `scripts/catalog/rules.mjs` にあります。

## 本を追加するとき（紹介文まで書く場合）

1. `src/data/books.json` に1冊分を追加します（ほかの本と同じ形で書きます）。
2. ジャンルなどの値は `src/data/options.ts` に書かれているものだけを使います。
3. 実在を確認した本だけを登録し、確認したページのURLを `metadata_source` に書きます。
4. `isbn` には、代表的な1冊（文庫があれば文庫、上下巻や漫画は第1巻）のISBN-13をハイフンなしで書きます。確認できない場合は `null` にします（推測で埋めない）。番号の打ち間違いは `npm test` で自動的に見つかります。
5. `npm test` を実行して、エラーが出ないことを確かめます。

## 開発用のコマンド

```
npm install   # 必要な部品を入れる（最初の1回）
npm test      # 自動テストを実行する
npm run dev   # 開発用にアプリを起動する
npm run build # 公開用のファイルを dist フォルダに作る
```

## 公開（Cloudflare）

- GitHub の `main` に保存すると、Cloudflare が自動で `npm run build` を実行し、`dist` フォルダの中身を公開します。
- 公開の設定は `wrangler.jsonc`、保存期間の設定は `public/_headers` にあります。
- 手元で公開と同じ状態を試すとき：`npm run build` のあと `npx wrangler dev`
