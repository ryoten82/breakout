# UI見た目リファレンス — Game UI Database: Concord

- ソース: https://www.gameuidatabase.com/gameData.php?id=1958 （Concordのゲーム内UIスクリーンショット集、5v5チームベースヒーローシューター）
- 記録日: 2026-07-04
- ソース種別: 画像リファレンスDB（[gameuidatabase_ghostwire-tokyo.md](gameuidatabase_ghostwire-tokyo.md)と同じ手法）
- 実画像は `images/`（git管理外、`.gitignore`の`learning/**/reference/images/`ルールで除外済み）

## カタログ（カテゴリ抜粋）

Title Screen / Mode & Screen Select / Settings / Modal: Info & Tutorial / **Character Select** / Stage Intro / Pause / Failure & Game Over / Level Complete & Results Screen / Rewards and Experience / Leaderboards / Unlocked Unit Collection / **Equipping: Overview & Loadout** / Equipping: Selection / Change Skin or Accessory / Challenges & Achievements / Tutorials and Guides / News/Updates & Notifications / Profile Customization / Friends List & Invite / Matchmaking Lobby / **Player Vitals, Enemy Health & Damage, Notification: Game/Combat Log** / **Equipped Items & Abilities** / **Enemy Health & Damage, Clock & Timer, Minimap** / Notification: Unlocks & Achievements / Minimap

太字＝実際に画像を確認したカテゴリ（6枚）。

## 視覚的観察

`images/concord_combat_hud.jpg` `images/concord_equipped_abilities.jpg` `images/concord_enemy_health_minimap.jpg` `images/concord_character_select.jpg` `images/concord_loadout.jpg` `images/concord_results_screen.jpg`

### 戦闘中HUD（5v5チームシューター）
- **画面上部中央**：自チーム（左・青）と敵チーム（右・赤）のロースター（顔アイコン5体×2）を左右対称配置、各アイコン下に個別体力ミニバー、チーム全体では「生存数/最大数」（例：29/30）を集計したチームHPバーとして下段に表示。中央にラウンドタイマー
- **画面右上〜右**：キルフィード（プレイヤー名＋アイコン列で誰が誰を倒したか）が横並びで流れる
- **画面左下**：ability icon 2〜3個（数字キーバインド表示、クールダウンは色で塗りつぶし残量表示）＋キャラクター名＋HPバー（オレンジ→緑のグラデーション、残量に応じて色が変化するタイプ）
- **画面右下**：装備武器のシルエット＋弾薬数「25/60」形式
- **画面左上**：ミニマップ（円形、チームメイトの矢印アイコンで方向表示）
- **ワールド空間**：敵/味方の頭上に名前タグ＋HPバー（「KAP-24- 123/250」のように名前と数値を1つのラベルにまとめる）、インタラクト可能物（ヒーリングステーション）は緑十字アイコンでワールド空間に浮かせて表示

### キャラクター選択画面（マッチ開始前）
- 左に「モード名」＋「クルーボーナス」リスト（アイコン＋効果名＋担当キャラ名を1行ずつ）
- 中央に選択中キャラの3Dモデル大写し＋選択制限時間のカウントダウン（「SELECT FREEGUNNER...18s」）
- 下部にキャラクター横スクロールカルーセル（メインロースター＋バックアップ枠を分離表示）
- 最下段にプレイヤー全員の選択状況（名前＋「SELECTING」ステータスタグ）をリスト表示

### カスタマイズ/ロードアウト画面
- 左サイドバーにカテゴリアイコン（outfit/accessory/weapon skin/weapon charm/victory pose/defeat pose/drop in）を2列グリッドで配置、選択中は緑枠でハイライト
- 中央に3Dキャラクター全身プレビュー
- 右上にプレイヤーカード（名前・レベル・XPバー）、右側にキャラクター詳細パネル（名前・代名詞・レベル・戦闘特性の説明文）

### 結果画面
- 中央に大きく「ROUND WON」＋左右対称のチームスコア（大きな等幅数字フォント）
- 左下に通知スタック（ミッション達成・プレイヤー退出等）を縦積み表示
- 下部に会話ログ（キャラクターの一言セリフ）を字幕的に表示

## SCRAP BLITZ UE への応用メモ

- **ワールド空間の名前タグ+HPバー一体型ラベル**（「KAP-24- 123/250」）は、敵の被弾時ダメージ表示や名前付き雑魚敵の演出に応用できる具体的なレイアウトパターン
- **HPバーのオレンジ→緑グラデーション**（残量で色が変わる単一バー）は、既存のSP/ライフバーのvisual designの参考候補になる
- **ability icon＋キーバインド数字＋クールダウン塗りつぶし**の組み合わせは、METEOのSP技のクールダウン表示・技選択UIの参考になる汎用パターン
- **キルフィード（誰が誰を倒したか）**：SCRAP BLITZ UEはシングルプレイなので直接の適用先はないが、コンボ/撃破ログの通知スタック表示（結果画面の左下通知群）の重ね方は「Notification: Unlocks & Achievements」の演出と合わせて参考になる
- **クルーボーナス（キャラ選択画面）のようなアイコン＋効果名の1行リスト表示**：OC/SP系の効果説明UIのレイアウトとして転用できる可能性

## 未確認・要フォローアップ

- 残り約40枚（Stage Intro、Rewards、Leaderboards、Friends List等）は未閲覧
