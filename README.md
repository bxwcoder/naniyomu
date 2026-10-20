# ナニヨム

**次に読む本、もう迷わない。**

いくつかの質問に答えるだけで、あなたに合った本を3冊おすすめするアプリです（開発中）。

## いまの状態

- 5つの質問に答えると、登録済みの本（実在を確認した64冊）から3冊をおすすめします。
- お気に入り・読んだ本・反応・前回の結果は、この端末のブラウザに保存されます（会員登録なし）。
- スマートフォンの「ホーム画面に追加」に対応しています（PWA）。一度開けば、オフラインでも画面と本のデータを使えます。外部サイトへのリンクはオフラインでは開けません。

## ファイルの役割

| ファイル | 役割 |
|---|---|
| `src/data/books.json` | 本のデータ。1冊ごとにタイトル・著者・ジャンルなどを書く |
| `src/data/options.ts` | ジャンル・気分・テーマなどの選択肢と、質問の文章 |
| `src/types.ts` | データの形の定義 |
| `src/logic/scoringConfig.ts` | おすすめの点数の配分（ここの数字を変えると順番が変わる） |
| `src/logic/recommend.ts` | おすすめ3冊を選ぶ処理 |
| `src/logic/matchFavorite.ts` | 「好きだった本」の入力を登録済みの本と照らし合わせる処理 |
| `src/logic/validateBooks.ts` | 本のデータに書き間違いがないかを調べる処理 |
| `src/logic/recommend.test.ts` | 上の処理が正しく動くかを確かめる自動テスト |
| `src/App.tsx` と `src/pages/` | 各画面（トップ・質問・結果・詳細・本棚） |
| `src/state/library.tsx` | お気に入り・読んだ本・反応の管理 |
| `src/state/storage.ts` | ブラウザへの保存と読み込み（壊れたデータは読み飛ばす） |
| `src/components/Logo.tsx` | ロゴ（Zen Maru Gothic の字形を図形化。利用条件は `LICENSE-ZenMaruGothic.txt`） |
| `public/manifest.webmanifest` | ホーム画面に追加するための設定 |
| `public/sw.js` | オフラインでも開けるようにする仕組み（サービスワーカー） |
| `public/icons/` | アプリのアイコン |

## 本を追加するとき

1. `src/data/books.json` に1冊分を追加します（ほかの本と同じ形で書きます）。
2. ジャンルなどの値は `src/data/options.ts` に書かれているものだけを使います。
3. 実在を確認した本だけを登録し、確認したページのURLを `metadata_source` に書きます。
4. `npm test` を実行して、エラーが出ないことを確かめます。

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
