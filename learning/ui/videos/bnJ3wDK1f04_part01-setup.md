# 学習ノート — Unreal Engine UI Design Part 01: Setup

- 動画: https://www.youtube.com/watch?v=bnJ3wDK1f04 （19分、UMG/UIデザインシリーズ1本目、UE5.3で収録）
- 学習日: 2026-07-04 / 抽出: 自動生成字幕（英語ASR、手動字幕なし）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/bnJ3wDK1f04.txt](../transcripts/bnJ3wDK1f04.txt)

## セットアップ手順（工程順）

| 時刻 | 手順 |
|---|---|
| [01:47]-[01:58] | UE5.3で作業。Third Person Templateでプロジェクト作成（UIを実機確認しながら作るため） |
| [03:23]-[04:00] | Inkscapeでパーツ作成→グループ化→エクスポート |
| [04:22]-[04:35] | UEにインポート。**テクスチャ接頭辞は`T_`** |
| [05:10]-[05:32] | `UI`フォルダ直下に共通親Widget Blueprint `WBP_TheDevRealmUIBase` を作成（全UIウィジェットがこれを継承） |
| [05:47]-[06:31] | 子Widget `WBP_InputField` を作成、`Widgets/Inputs` フォルダで整理 |
| [07:00]-[08:35] | Vertical Box→Text（ラベル）+Text Box（入力欄）でレイアウト構築、Spacerは5 |
| [08:39]-[09:13] | テクスチャ直接ドラッグ＆ドロップは不採用（後から一括変更しづらいため） |
| [09:13]-[10:41] | 親クラスにBlueprint Structure `ST_Inputs`（Background: Texture2D）を作成→さらに`ST_MainUISettings`にネスト |
| [10:44]-[11:32] | Data Table `DT_UISettings`（Row Structure=`ST_MainUISettings`）を作成、行を追加 |
| [12:39]-[12:57] | **Draw As = Image を必ず選ぶ**（デフォルトのBoxのままだとテクスチャが歪む） |
| [13:00]-[14:32] | 親クラスに`UISettingsSelection`（Data Table Row Handle）を追加、Pre ConstructでBreak→Get Data Table Row→`UISettings`変数にPromote |
| [14:55]-[15:31] | **子クラスのPre Constructで`Parent: Pre Construct`を明示的に呼ぶ**（呼ばないと親の変数が未初期化） |
| [16:18]-[17:29] | Set Style（Editable Text Box Style）にBackgroundを接続。Normal/Hovered/Focused/ReadOnly全部同じテクスチャ |
| [17:40]-[18:24] | トラブルシュート実演：見た目が変わらない→①Construct/Pre Constructのイベント発火順序を疑う→②Data Table行の中身（テクスチャ未設定）を疑う、の順で解決 |

## 判断基準・コツ

- **共通親Widget Blueprintを作る理由**：パレット/スタイル変更を1箇所（親クラスの構造体）で行えるようにする。このシリーズの核となる設計
- **テクスチャを直接ドラッグ＆ドロップしない理由**：後から色/パレット全体を変える際、参照を1つずつ張り替える手間が生じるため
- **Data Table + 構造体で設定を持たせる理由**：複数の「UIテーマ（行）」を切り替え可能にする拡張性
- **子クラスでParent: Pre Constructを呼ぶ理由**：Widget Blueprintの継承構造では、子のイベントグラフだけでは親のPre Constructは自動実行されない典型的な罠
- **トラブルシュート手順**：見た目が反映されない時は「①イベント発火タイミング→②データ自体」の順で切り分ける

## 主要パラメータ

| 項目 | 値 |
|---|---|
| 使用エンジンバージョン | UE5.3 |
| Spacer幅 | 5 |
| Input欄Custom Size | 幅600（Screen指定）※推定 |
| テクスチャ命名接頭辞 | `T_` |
| Widget Blueprint命名接頭辞 | `WBP_` |
| 構造体命名接頭辞 | `ST_`（`SD_`表記揺れあり） |
| Data Table命名接頭辞 | `DT_` |

## 現行UE5.8での通用性所見

**総評：設計思想（親クラス継承・構造体・Data Table駆動のテーマ切替）は現行UE5.8でもそのまま通用する。** エディタ操作の細部（右クリックメニューの文言・階層）はUE5.3→5.8間で微修正されている可能性があるが、機能自体（Widget Blueprint継承、Draw As=Image、Set Style、Pre Construct継承の罠）はUMGの基本機構でありUE5.8でも変わらないと判断される。SCRAP BLITZ UEのHUD（`SBComboHUD`等）でも「テーマ設定の外だし」という考え方は応用できる。

## 確信度が低い抽出

1. [08:31]-[08:35] Spacer値「5」（UMG単位かInkscape px単位か文脈が曖昧）
2. [12:30]-[12:36] Custom Size「600」（幅か高さか不明瞭）
3. 構造体命名接頭辞の正確な綴り（`ST_`か`SD_`か、話者の言い間違いの可能性）
