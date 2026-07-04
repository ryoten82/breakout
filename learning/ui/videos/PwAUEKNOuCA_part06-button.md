# 学習ノート — Unreal Engine UI Design Part 06: Button

- 動画: https://www.youtube.com/watch?v=PwAUEKNOuCA （18分35秒、UMG/UIデザインシリーズ6本目）
- 学習日: 2026-07-04 / 抽出: 自動生成字幕（英語ASR、手動字幕なし）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/PwAUEKNOuCA.txt](../transcripts/PwAUEKNOuCA.txt)

## 作成手順（工程順）

| 時刻 | 内容 |
|---|---|
| [00:56]–[01:46] | `WBP_Button`作成。Horizontal Box内にアイコン用Image＋Title用Text |
| [03:19]–[03:42] | Textを「Is Variable」化/Expose。デフォルト文字列"My Button" |
| [03:47]–[04:18] | フォントサイズ42、左パディングはデザイン値約40だが実際は20で採用（「倍だが結果的に良く見える」） |
| [04:22]–[05:32] | スタイル定義用の別Blueprintクラスを作成、Texture2D変数`Background01`/`Background02`（2色スタイル背景） |
| [07:18]–[10:13] | **Set Style**ノードでステート別ブラシ設定：Get UI Settings→Break→Make SlateBrush、Normal/Hovered/Pressed/Disabledごとに画像・色を設定 |
| [08:42]–[09:14] | 画像インポート後にウィジェット側だけSaveすると参照が切れる不具合発生。**「ウィジェット作業前に必ずSave All」**の運用ルール |
| [11:32]–[13:26] | **Scale Boxでラップ**してボタンサイズに応じてスケール追従させる。基準サイズ600×100 |
| [13:54]–[14:35] | 色反転ロジック：Bool `Inverted Color`＋Selectノードで`Background01`/`02`を入れ替え |
| [15:53]–[17:12] | **Event Dispatcher「On Button Clicked」**を作成、`OnClicked`からバインドして発火。呼び出し元でBind Event |
| [17:15]–[18:01] | ホバー音・クリック音はSlateBrushのStyle設定内（Hovered Sound/Pressed Sound）に割り当て可能（実演なし） |

## 判断基準・コツ

- **Scale Boxで内包する理由**：ボタンサイズが将来変わってもアイコン・テキストが追従してスケールする。「普段はあまりやらないがこのケースでは必要」と明言
- **Paddingは試行錯誤前提**：デザインカンプの値をそのまま使わず、Playテストで見た目を確認しながら調整（左パディング40→実際20で採用）
- **保存順序の罠（重要・バージョン非依存で通用しそう）**：画像インポート直後にウィジェットだけSaveすると参照が壊れる。作業前に必ずSave All
- **色反転はSelectノード+Bool一つで実装**：派生スタイル（positive/negative）を別ウィジェットに分けずコンポーネント数を増やさない設計
- **Event Dispatcherは疎結合設計の定型パターン**：UIコンポーネント側で入力処理を完結させ、呼び出し元はDispatcherをBindするだけ

## 主要パラメータ

| 項目 | 値 |
|---|---|
| フォントサイズ（Title） | 42※推定 |
| 左パディング（デザイン値→実採用値） | 約40→20 |
| ボタン基準サイズ（Scale Box用） | 600×100 |
| Bool変数 | `Is Inverted`（Instance Editable） |
| Event Dispatcher | `On Button Clicked` |

## 現行UE5.8との整合性所見

- UMGの基本操作（Horizontal Box/Scale Box/Padding/Is Variable化）とSet Style+Make SlateBrushによるステート別ブラシ設定は、UE4後期〜UE5系で大きく変わっておらず現行5.8でも通用する可能性が高い
- 「保存時に画像参照が切れる」挙動は古いバージョン特有の可能性があるが、「作業前にSave All」という予防運用自体は今も無難な習慣
- **注意点**：別Blueprintクラスに`Texture2D`変数を持たせてスタイル管理する設計は、この動画時点の手法。UE5系では**Widget Style Asset**や**Data Assetベースのテーマ管理**の方がモダンな手法として推奨されることが多く、SCRAP BLITZ UEで採用するならこちらを比較検討する余地がある

## 確信度が低い抽出

1. [14:14]〜[14:31] Selectノードの配線対応（Hovered/通常時とTop/Bottomの対応関係が不明瞭）
2. [03:47]〜[03:56] フォントサイズ「42」（40/45等の近似値の可能性）
3. [04:22]〜[04:52] スタイル定義用の「Button」Blueprintクラスの正体（Widget BlueprintかObject/Struct系か未確定）
