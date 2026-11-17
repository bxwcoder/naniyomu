// アフィリエイト（本の購入リンク）の設定
//
// 各サービスに登録して、もらった ID を下に書くと、本の詳しい画面に「〇〇で見る」ボタンが出ます。
// 空欄（''）のサービスのボタンは出ません。全部空欄なら、購入ボタンも「広告」の表示も出ません。
// ID は秘密の情報ではない（リンクの中に入って誰にでも見える）ので、ここに書いて大丈夫です。

export const AFFILIATE = {
  /**
   * Amazon アソシエイトのトラッキングID（例：'naniyomu-22'）。
   * 使うときは、Amazon の決まりで「Amazonのアソシエイトとして…」の一文が画面に出ます。
   */
  amazonTag: '',
  /**
   * 楽天アフィリエイトID（例：'1a2b3c4d.5e6f7a8b.1a2b3c4d.5e6f7a8b'）。
   * 楽天のアフィリエイトの管理画面で確認できます。
   */
  rakutenId: '',
} as const;

export type AffiliateConfig = { amazonTag: string; rakutenId: string };
