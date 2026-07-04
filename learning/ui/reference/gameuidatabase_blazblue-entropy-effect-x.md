# UI見た目リファレンス — Game UI Database: BlazBlue Entropy Effect X

- ソース: https://www.gameuidatabase.com/gameData.php?id=2350 （BlazBlue Entropy Effect X、2.5D横スクロールアクション×ローグライク）
- 記録日: 2026-07-04
- ソース種別: 画像リファレンスDB（[gameuidatabase_ghostwire-tokyo.md](gameuidatabase_ghostwire-tokyo.md)と同じ手法）
- 実画像は `images/`（git管理外）

## カタログ（カテゴリ抜粋）

Title Screen / Mode & Screen Select / Loading Screen / Settings / Credits / Dialogue & Speech / **Character Select** / Stage Intro / Player Menus / **Action Menu** / **Ability List** / **Choose Boon/Upgrade** / Missions and Quests / Challenges & Achievements / **Player Vitals, Collection Counters, Enemy Health & Damage** / **Player Vitals, Clock & Timer, Item & Ability Buttons** / Enemy Health & Damage, Loot & Exp Log / Notification: Tutorials & Hints

太字＝実際に確認したカテゴリ（6枚）。

## 視覚的観察

`images/blazblue_combat_hud.jpg` `images/blazblue_hud_timer.jpg` `images/blazblue_ability_list.jpg` `images/blazblue_boon_upgrade.jpg` `images/blazblue_action_menu.jpg` `images/blazblue_character_select.jpg`

### 戦闘中HUD（2.5D横スクロールアクション、SCRAP BLITZ UEと同ジャンル）
- **画面左上**：ステージ名+経過秒＋残り時間タイマーを1行にまとめて表示
- **画面上部中央**：ボス戦時のみ、ボス名＋HPバー（現在値/最大値の分数表記）が出現。通常時は非表示
- **画面左下**：プレイヤーHPバー（数値+%表記併記）、ジェム/カウンター数（×2等）、MPを六角形アイコンで表示（円形ではなく六角形ゲージ）
- **画面左下段**：アビリティアイコン2〜3枠を横並び、対応キー（Xボタン）を明示
- **画面右下**：複数の消費アイテム/リソースカウンター（弾薬・素材風アイコン＋数値）を横一列に並べ、通貨アイコンも同列に配置
- **画面右下段**：ステータス効果/装備アイコンを6枠程度、横一列に配置

### アビリティ/スキル強化画面（Ability List・ローグライク要素）
- 左側に縦方向のスキルアイコンカルーセル（上下矢印で切替、選択中のみハイライト枠）
- 右側に選択中スキルの詳細パネル（スキル名＋レアリティ記号、効果説明文＋発動コスト、追加のリソース獲得条件を補足行で表示）
- 下部にボタンプロンプト列（決定/詳細表示/試行/リロール/全効果表示/破棄）を横一列に集約

### ローグライク分岐選択（Choose Boon/Upgrade・Action Menu）
- 画面中央に**横方向に伸びるバー選択肢**（3択の場合は色分け：選択中=青の帯、非選択=グレーの帯）、各バーの右側にタイトル＋アイコンを配置
- 画面上部に一時的なチュートリアルテキスト（今回選んでいる要素の意味を1〜2行で説明、音声波形風の装飾線が左右に伸びる）
- 下部に決定/詳細表示のボタンプロンプトのみのシンプルな構成
- 選択肢のバーがそれぞれ異なる幅・高さで伸びており、単純なリスト表示より視覚的にメリハリがある

### キャラクター選択画面
- グレースケールの背景シルエットで未選択キャラを並べ、選択中のみカラー表示で中央に配置（ロック済みキャラは鍵アイコンを重ねる）
- 上部にチュートリアルテキスト（操作方法の説明、同じ音声波形装飾）
- 下部にボタンプロンプト列（解禁/詳細/動画再生/戻る）

## SCRAP BLITZ UE への応用メモ

- **六角形MPゲージ**は既存のSP/OC系ゲージ表示のバリエーションとして参考になる（円形以外の選択肢）
- **戦闘中は左上にステージ名+タイマーを1行集約し、ボス戦時のみボスHPバーを上部中央に出現させる**という表示の出し分けは、SCRAP BLITZ UEのHUD情報密度管理（常時表示要素と一時要素の切り分け）の参考になる
- **横方向に伸びるバー選択肢UI**（Boon/Upgrade選択、Rest/Event選択）は、SP技選択や強化選択画面のレイアウト候補として使える。選択肢ごとに幅・高さを変えることで単調なリストより視覚的に良い
- アビリティ詳細パネルの「スキル名＋レアリティ記号＋効果文＋補足コスト条件」という情報階層は、OC/SP技の説明UIレイアウトの参考になる
- チュートリアルテキストの音声波形風装飾（左右対称の線）は、ボイス付きヒント表示の視覚的アクセントとして参考になる

## 未確認・要フォローアップ

- 残り約35枚（Dialogue、Missions、Challenges等）は未閲覧
