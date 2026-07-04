# 学習ノート — UE5で作成するUIと最適化手法（Unreal Engine Meetup Connect - Vol.5）

- 資料: https://www.docswell.com/s/EpicGamesJapan/5JQJ3N-2026-01-08-230955 （エピック ゲームズ ジャパン公式、全81ページ）
- 学習日: 2026-07-04 / 抽出: WebFetch → 独立再取得による4項目のペア照合（後述、全一致）
- ソース種別: 公式スライド資料（SPAではなくWebFetch可、docswell.com。ページ番号付きで内容照合可能）

## 概要

UE4版の先行講演（5年前）に対する続編。UE5の新機能紹介 → UI構築ワークフロー → パフォーマンス最適化の3部構成。

## 1. UE5新機能（対応バージョン範囲つき）

| 機能 | 対応バージョン | 内容 |
|---|---|---|
| UMG Preview | UE5.5–5.7 Experimental | PIE実行なしでボタンアニメーション・レイアウトを即座確認。`UMG.EnablePreviewMode 1` で有効化（p.6） |
| Slate PostBuffer | UE5.4–5.7 Experimental | UI用ポストプロセスバッファ。シーン画像をUIマテリアルから参照しブラー効果等を適用可能。GPU負荷ありのため適用範囲を制限する必要 |
| UI Component | UE5.5–5.7 Experimental | Widget階層を変更せずに機能を追加する仕組み（SizeBoxComponent、NavigationUIComponent等を既存Widgetに付与） |
| SlateIM（Immediate Mode） | UE5.6–5.7 Experimental | 即時モードでUIを毎フレーム描画更新するデバッグ・開発ツール向けフレームワーク。**imguiの代替的位置づけ**と明記（p.14） |
| CommonUI | UE4.27–UE5.2 Experimental → UE5.3–5.7 Beta | 入力方法（ゲームパッド/マウス/タッチ）を問わず一貫したUI動作を実現する共通UIフレームワーク。効率的なレイヤー管理・ナビゲーション制御・プラットフォーム別アイコン自動切替（p.18） |
| UMG ViewModel | UE5.1–5.7 Beta | ウィジェットとデータを分離して構築するMVVMアーキテクチャ。作業競合回避・パフォーマンス改善・UI変更耐性向上（p.21） |

## 2. UI構築ワークフロー

- **スタイル設定**：CommonUIによるプリセット活用、グローバルテーマ適用
- **テクスチャ設定**：MipGenSettingsは基本NoMipmaps、TextureGroup「UI」、2048×2048以下が目標
- **マテリアル設定**：Material Domain「User Interface」、Blend Mode「Translucent」
- **フォント設定**：Font AssetとFont Faceの分離、距離フィールドフォント（MSDF）対応
- **Widget作成クラス選定**：
  - `UserWidget`：シンプルな表示用
  - `CommonActivatableWidget`：フルスクリーン・モーダル用

## 3. パフォーマンス最適化（判断基準・コツ）

### チェック項目一覧
- Tick処理削減、重い処理回避
- 非表示時の処理停止
- **ScrollBoxよりListView利用**（大量アイテム表示時）
- **Canvas Panel乱用禁止**（コスト高いレイアウトパネル）
- Widget階層を浅く
- **InvalidationBox、RetainerBox活用**
- **非表示はHiddenでなくCollapsed使用**（レイアウト計算からも除外されるため）

### CPU負荷の仕組み（なぜそうするか）
Slate描画には **Fast Path（高速パス）：キャッシュ再利用** と **Slow Path（低速パス）：キャッシュ再生成** の2種類があり、**Invalidationが発生すると親階層のDraw Elementまで再生成される**。つまり深い階層で頻繁に再描画が起きるWidgetは、親を巻き込んで高コストになる。これがWidget階層を浅くする・InvalidationBox/RetainerBoxで再描画伝播を遮断する、という各対策の根拠になっている。

### 測定ツール
- **Unreal Insights（Slate Insights）**：CPU負荷の詳細計測
- **Widget Reflector**：Widget Tree検査、Visibility確認
- **ProfileGPU / CSVプロファイラ**：GPU負荷計測
- **memreport コマンド**：メモリ使用状況確認

## 4. メモリ管理

- CPUメモリ：Widgetオブジェクトデータが主要消費対象
- GPUメモリ：UIテクスチャとレンダーターゲットが主要消費対象
- **テクスチャはレベル切替まで残り続ける**ため、ソフト参照利用による読み捨てが推奨

## 監査（ペア照合）

以下4項目を独立してWebFetch再取得し、原文ページ番号付きで一致確認済み：
1. `UMG.EnablePreviewMode 1`（p.6）— 一致
2. SlateIM = imguiの代替的位置づけ（p.14）— 一致
3. CommonUI対応範囲 UE4.27–5.2 Experimental / 5.3–5.7 Beta（p.18）— 一致
4. UMG ViewModel対応範囲 UE5.1–5.7 Beta（p.21）— 一致

## SCRAP BLITZ UE への応用メモ

- 現行UIがCanvas Panel多用・ScrollBox使用など最適化前提に反する構成になっていないか、既存HUD/UMG実装の棚卸しが今後の課題として浮上
- **Collapsed vs Hidden**の使い分けは即座に既存コードのvisibility切り替え箇所を点検する価値がある小さな見直し candidate
- CommonUIはUE4.27から存在する枯れた機能（Beta）なので、本プロジェクトが今後UMGベースのメニュー/HUDを本格拡張する際の第一候補になりうる
- UMG ViewModel（MVVM）は「データとWidgetの分離」という設計思想がSCRAP BLITZ UEのHUD実装（`SBComboHUD::DrawHUD()`のCanvas直書き）とは異なるアーキテクチャ。将来UMG化する際の比較検討材料
