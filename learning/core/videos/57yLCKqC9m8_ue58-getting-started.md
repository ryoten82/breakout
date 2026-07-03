# Unreal Engine 5.8 Beginner Tutorial | Getting Started (2026)

- 動画URL: https://www.youtube.com/watch?v=57yLCKqC9m8
- 長さ: 1:37:09
- 抽出: 英語手動字幕 → Sonnet 単独要約（監査待ち）
- 学習日: 2026-07-03
- ドメイン: core（汎用エディタ・UEバージョン差分）

## スキップ判定: 差分ノート

本動画は UE5 完全初心者向け導入チュートリアル（Launcher インストール〜プロジェクト作成〜ビューポート操作〜Content Browser〜Fab〜Blueprint入門〜Lumen/Nanite概要）。
本プロジェクトの既習範囲（プロジェクト作成/ビューポート操作/アセット配置・複製/Fabインポート/Landscape基礎/マテリアル基礎/Foliage/Water/Lumen・ライティング基礎/PostProcess/シネカメラ/Level Sequencer/Movie Render Queue/Niagara入門）とほぼ全面的に重複するため、**大部分を省略**。UE5.8 固有の新規手順・仕様変更のみ抽出する。

---

## 既習範囲・省略した区間

- Epic Games Launcher インストール手順 [01:46–09:37]
- プロジェクト作成ウィザード（テンプレ選択・variant） [09:37–13:51]
- ビューポート基本操作（WASD、gizmo 3種、スナップ設定、視点モード、show flags、viewport scalability） [13:56–28:03]
- 編集アクション（duplicate/delete/undo/N key snap/F focus/alt-drag複製） [28:03–30:06]
- トップメニュー概説（File/Edit/Window/Tools/Platforms/Select/Actor/Help） [30:06–46:04]
- World Outliner・Details パネル基礎 [42:10–46:04]
- Content Browser 基礎・アセットタイプ色分け（static mesh/material/skeletal mesh 等） [51:54–56:41]
- 素材のドラッグ＆ドロップ適用・マテリアルスロット概念 [60:00–62:03]
- Fab マーケットプレイス基本操作（検索・フィルタ・ライブラリ追加） [62:03–65:37]
- Quixel Mega Scans 概要・品質プリセット選択 [70:16–75:05]
- Static Mesh Editor / Material Editor サブエディタ基礎 [75:10–80:05]
- 新規レベル作成（File > New Level） [80:05–83:00]
- Blueprint 入門（Event Graph、print string、Actor テンプレ） [81:39–90:33]
- Lumen 概要（bounce lighting の説明） [90:33–92:24]
- Nanite 概要（自動LOD切替の説明） [92:24–94:01]

---

## 差分: UE5.8固有の新規手順・仕様変更

### バージョン番号体系の解説（一般知識として初出）[05:35–07:41]
- major.minor.patch 形式。major=大機能追加世代（UE4→UE5→UE6）、minor=実験的機能追加世代、patch=バグ修正のみ
- 各 minor バージョンの目玉機能例（講師の説明）:
  - UE5.1: Enhanced Input System [06:45]
  - UE5.2: PCG（Procedural Content Generation）[06:52]
  - UE5.5: Megalights [06:52]
- 5.8.0 は patch 更新 0 件、5.7 は patch 4件（この動画撮影時点の数値、※推定：今後変動する）[07:06–07:20]
- **SCRAP BLITZ への意味**: 現行プロジェクトは UE5.8 系。今後のパッチ更新（5.8.1等）は基本的にバグ修正のみで機能面の互換性リスクは低いと判断してよい根拠になる

### Starter Content が Engine 標準から削除された（5.7/5.8 変更点）[56:59–59:00]
- 旧バージョンでは Engine 同梱だった Starter Content（Props/Materials/Audio等の基本アセット集）が UE5.7 以降 Engine から削除された
- 手動追加手順: 動画説明欄の Google Drive から zip DL → 展開 → Content Browser で「Show in Explorer」してプロジェクトの `Content` フォルダを開く → 展開した `StarterContent` フォルダを **`Content` 直下**にコピー（`Content/StarterContent/Architecture,Audio,Blueprints...` の階層。誤って一段深い場所に置くと参照切れでマテリアル/テクスチャが適用されない）[57:56–58:25]
- **SCRAP BLITZ への意味**: 古い（1年以上前の）UE チュートリアルで Starter Content 前提の手順を見た場合、5.8環境では素材が同梱されていない前提で読み替える必要がある

### Fab アセットの UE5.8 非対応時の回避策 [65:37–67:27]
- Fab ストアページの Compatibility 欄でサポート対象エンジンバージョンが明示される。5.8 が対象外のアセットは多い（動画時点の実例: あるアセットパックは UE4/UE5.0-5.7までサポートで5.8非対応）
- 回避策: Epic Games Launcher → Unreal Engine タブ → Library → Fab Library セクションで Refresh → 対象アセットの「Add to Project」→ プロジェクト一覧に出ない場合は「Show all projects」→ 対象プロジェクト選択時に「asset is not compatible with 5.8」警告が出るので、バージョンドロップダウンで**最も近い対応バージョン（例: 5.7）を手動選択**すると追加可能になる
- **SCRAP BLITZ への意味**: Fab アセット導入時に 5.8 非対応表示が出ても即断念せず、直近対応バージョンを指定すれば大半は動くとみてよい（※推定：完全な互換性保証ではなく「試す価値がある」程度の情報）

### Fab plugin が 5.8 プロジェクトにデフォルト無効な場合がある [68:38–69:40]
- 講師の環境では Fab plugin が新規プロジェクトに入っていなかった（Edit > Plugins で検索してもヒットしない）
- 対処: Epic Games Launcher → Library → Fab UEFN plugin を Install to Engine（対象エンジンバージョンを選択）→ プロジェクト側で Edit > Plugins から有効化 → エディタ再起動 → Quick Add (Q+) メニューに FAB ボタンが出現
- 講師自身「なぜ自分の環境だけ起きたか不明、視聴者は基本遭遇しないはず」とコメント欄で確認を呼びかけている程度の情報のため確信度は中程度 [69:24–69:45]

### Asset Editor のドッキング先を固定する設定（作業効率化 Tips）[79:11–79:26]
- Edit > Editor Preferences > Asset Editor Open Location を「Main Window」に変更すると、以降サブエディタ（Material Editor等）を開くたびに毎回手動でトップにドッキングし直す必要がなくなり自動固定される
- **SCRAP BLITZ への意味**: エディタ作業効率化の小技。既存ワークフローに支障なければ適用検討可

### Nanite Visualization ビューモードでクラスタ表示を確認 [94:01–94:20]
- View Mode 内に「Nanite visualization」→ Clusters 選択で、Nanite が距離に応じて自動生成するメッシュクラスタの分割状況を可視化できる。ズームイン時は細かいクラスタ、ズームアウト時は大きいクラスタに自動置換される様子を直接確認可能
- 既習範囲の Nanite 基礎知識に対する「確認手段」の追加情報

### Static Mesh の LOD を手動生成する具体手順 [95:16–95:47]
- 対象 Static Mesh を開き、Details パネル > LOD > Number of LODs を増やす（動画では 5 に設定）→ Apply Changes ボタンで自動生成
- 生成後は距離に応じて LOD0→LOD1→LOD2...と自動切替、三角形数が段階的に減少する例（LOD1: 約700、LOD2: 約400、LOD3: 約200、※動画内の実例数値でアセット依存のため一般化不可）[95:47–96:01]
- ゲーム用途では LOD、映像/シネマティック用途では Nanite が使い分けの基本方針（講師の判断基準）[96:01–96:57]

---

## 監査用: 確信度が低い抽出 3件

1. [69:24–69:45] Fab plugin が新規プロジェクトにデフォルト無効という事象は講師個人の環境固有の可能性が高く、一般化できるか不明（講師自身も原因不明とコメント）
2. [06:45–06:52] 各 UE バージョンの目玉機能対応（5.1=Enhanced Input、5.2=PCG、5.5=Megalights）は講師の口頭説明のみで、公式リリースノートとの突き合わせはしていない
3. [65:42–65:49] 動画内で確認した Fab アセットパックの対応バージョン表記（UE4-4.27、UE5.0-5.7）はその時点のスナップショットであり、今後アセット側が5.8対応に更新される可能性がある一時的情報
