# 学習ノート — Unreal Engine 5 Beginner Tutorial - UE5 Starter Course 2024（Lake Environment）

- 動画: https://www.youtube.com/watch?v=9nbwjT1kEuA （16:17）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/9nbwjT1kEuA.txt](../transcripts/9nbwjT1kEuA.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

初心者向け「湖環境」一本道チュートリアル。基礎操作（プロジェクト作成・ダウンロード手順等）は圧縮し、環境クオリティに関わる工程を厚めに記載。

1. **プロジェクト・レベル準備** [00:05–00:30] — Blank テンプレート（Starter Content 無し）で新規プロジェクト作成 → File > New Level で Basic Level 作成 → デフォルトの地面を削除
2. **Landscape をハイトマップから作成** [00:33–02:19] — 外部サイト（無料の高品質ハイトマップ配布サイト）から EXR 形式のハイトマップをダウンロード → EXR→PNG 変換（Photoshop か、無ければブラウザの EXR to PNG コンバータ、講師は convertio 系ツールを使用）→ Landscape モードの **Import from File** で PNG を読み込み → Scale を調整（例: 128※推定・字幕 "128" は聞き取れるが対象軸不明）→ **Edit Layers を必ず有効化してから Import**
3. **見えなくなった地形の復旧** [02:19–02:31] — Import 直後に地形が消える現象は **Exponential Height Fog** が濃すぎるため。Height Fog アクタを選択して上（高い位置）にドラッグして解消
4. **Landscape マテリアル適用** [02:31–03:22] — 事前ダウンロード済みの Landscape マテリアル（Wild Grass）を Export → Landscape を選択し Landscape Material スロットにマテリアルインスタンスをドラッグ&ドロップで割り当て → **タイリングが荒い場合はマテリアルインスタンス側の Tiling and Offset を有効化し Tiling 値を下げる**（講師は 0.1 前後に下げて改善を確認）
5. **Water Plugin セットアップ** [03:22–04:31] — Edit > Plugins で "water" 検索 → Water プラグインを有効化 → **エンジン再起動が必須**（再起動前に必ず保存）→ 再起動後、Place Actors パネルで water 検索 → **Water Body Lake** をドラッグ&ドロップ → 展開前に **Affects Landscape のチェックを外す**（地形そのものを削らせない）→ スプラインのポイントをドラッグして湖の範囲を拡張、右クリックで Add Spline Point も可能
6. **植生（木）の配置** [04:31–06:27] — Epic Games 提供の無料 Landscape アセットパック（Static Mesh フィルタで確認）から Pine Trees を使用 → Foliage Mode でドラッグ&ドロップしてブラシに登録 → **複数の木をまとめて選択し Density を 0.1 まで下げ、Scale を 4〜5 に上げる**（密度を減らしスケールを大きくして自然な疎密感を作る）→ Brush Size を拡大してペイント
7. **地形の彫り込みで木の浮きを解消** [05:55–06:27] — 木がまとまって不自然な塊（"pay"＝おそらく "patch/clump" の誤字幕）になるのを避けるため、Landscape Mode の **Sculpt ツール**で地形を彫ってから植生を配置し直す。Density はさらに微調整（"1" 前後※推定）
8. **岩・地面装飾** [06:27–07:35] — Quixel Bridge から岩アセットと Rocky Ground を追加インポート → Content Browser の Megascans フォルダで Static Mesh フィルタ → Rock アセットをドラッグ&ドロップ配置
9. **水の色調整** [07:35–08:17] — Water Body を選択し Water Material をダブルクリックで開く → デフォルトの水色はほぼ無変化なので **Scattering Color をダークブルー系に変更**し Scattering を有効化 → 差分を確認して保存
10. **草の追加** [08:17–09:08] — 別途インポートした草アセット（"rone grass"＝銘柄名の誤字幕、詳細不明）を使用 → Foliage Mode を開くと草アセットが自動検出される場合あり（されない場合は手動でドラッグ&ドロップ登録）→ 木のチェックを外し草のみ有効化 → Scale をやや増加（講師は 3 が「ちょうど良い」と判断）→ カメラアングルに合わせてペイント
11. **ライティング調整（露出）** [09:08–10:34] — 視点移動（選択モードで Ctrl+マウスドラッグ）で露出過多を確認 → Place Actors から **Post Process Volume** を追加 → 詳細パネルで **Infinite Extent (Unbound) を有効化** → Exposure セクションで **Metering Mode** と **Exposure Compensation** を有効化 → **Auto Exposure を Manual に変更**、Exposure Compensation の Intensity を調整（数値は字幕崩れのため不明※推定）
12. **ディレクショナルライト強度調整** [10:01–10:08] — Directional Light の Intensity を増加（60 前後、講師は 58〜60 で試行）
13. **ポストプロセス: 画作りの仕上げ** [10:08–10:41] — Image Effects で **Vignette** と **Sharpen** を有効化しそれぞれ Intensity を増加 → Color Grading > Global で **Saturation** を有効化し 1.5 に変更、**Midtone Saturation** を 1.2 に変更
14. **背景の山で奥行きを追加** [10:43–11:42] — Epic Games 提供の無料背景アセット（Photoreal Backgrounds 系）を使用。**インポート時に「5.3 非対応」の警告が出た場合は対象バージョンを 5.0 (Early Access) に変更すれば追加できる**（互換性の回避策として明言）→ Content Browser で Static Mesh フィルタ、サムネイルサイズは Settings から Medium→Large に変更可能 → Green Mountains アセットをシーンにドラッグ&ドロップ
15. **背景山への植生（2D ビルボード）** [11:42–12:19] — 背景アセットに同梱の **2D Tree Billboard**（軽量な板ポリ木）を Foliage Mode で背景の山にペイント → デフォルトの密度は過多なので減らす
16. **フォグ追加と色調整** [12:19–12:59] — Exponential Height Fog を配置 → Fog の色を（薄い）ブルー系に変更、Fog Density は好みで増減
17. **草のアニメーション（風揺れ）** [12:59–12:59台] — Grass フォルダの Grass Material Instance を開き **Grass Wind を有効化**して保存 → 草が風で揺れるようになる
18. **Level Sequencer とカメラ演出** [12:59–14:56] — Place Actors から Level Sequencer を追加・保存 → Cine Camera Actor を追加 → Outliner でカメラを右クリックし **Snap Object to View**（現在のビューポート視点にカメラを合わせる）→ カメラモードに切り替え、詳細パネルで **Film Back を Digital Film → DSLR に変更**、**Focal Length を約 15 に減少**（広角化）、**Aperture を約 4 に増加** → Cine Camera Actor をシーケンサーにドラッグ&ドロップ追加 → Frame Rate 変更可、タイムラインの長さを延長、Camera Cuts トラック追加
19. **カメラアニメーション** [14:19–14:55] — タイムライン開始位置で Transform キーフレームを追加 → タイムライン終了位置でカメラの位置を変更してキーフレームを追加 → 両キーフレームを選択し右クリックで **Interpolation Mode を Linear に変更**（等速の移動にする）
20. **レンダリング（Movie Render Queue）** [14:57–16:14] — Edit > Plugins で "movie render queue" を検索し有効化 → エンジン再起動（保存必須）→ Render アイコンから Unsaved Config Settings を開く → **JPEG Sequence を削除し PNG Sequence を追加**（EXR も選択可だが講師は PNG を選択）→ **Anti-Aliasing を追加し Temporal Sample Count を約 32 に変更**、Override Anti-Aliasing を有効化 → Advanced セクションで **Warm Up Count を 120 に変更** → Output タブで出力先ディレクトリ・解像度・フレームレートを設定 → Accept → Render Local で書き出し

## クオリティを上げる教訓

### 1. Height Map インポート直後の「消失」は Height Fog が原因 [02:19–02:31]
地形が完全に見えなくなる現象に驚きがちだが、原因は Exponential Height Fog の濃度・高さ設定。Fog アクタを持ち上げるだけで解決する、という**初心者がハマりやすいポイントを名指しで解説**している。

### 2. マテリアルのタイリングは「荒く見えたら即対処」という判断基準 [02:57–03:22]
Landscape にマテリアルを貼った直後の見た目を確認し、タイリングパターンが目立つ場合はマテリアルインスタンスの Tiling and Offset を有効化し数値を下げる、という一手順を明示。既製マテリアルインスタンスでも調整前提で使う姿勢。

### 3. Water Body は「Affects Landscape を切ってから拡張する」[03:57–04:03]
水域を広げる前に Affects Landscape のチェックを外す指示が明確にある。地形を意図せず削らせないための順序であり、Water Body Lake 導入時の必須手順として語られている。

### 4. 植生は「密度を下げてスケールを上げる」が自然に見える基本則 [04:48–05:33]
木をまとめてペイントする際、Density を大きく下げ（0.1 程度）Scale を上げる（4〜5）という組み合わせを明言。単純に本数を増やすのではなく、疎な配置で個体を大きくする方が自然、という判断基準。

### 5. 木の「塊」を防ぐには地形を彫ってから配置し直す [05:55–06:27]
フラットな地形に植生を並べると不自然な塊になる、という問題提起があり、対処として Landscape Sculpt で地形に凹凸をつけてから植生を調整する、という工程順序が示されている（先に地形の起伏、後に植生の自然な理由付け）。

### 6. 画作りはまず露出（Exposure）から触る [09:08–10:01]
ライティング調整の最初のステップとして、Post Process Volume の Exposure を Auto から Manual に変更する。ビジュアル全体の見え方を左右する露出を最初に固定してから、Vignette / Sharpen / Saturation といった仕上げに進む順序。

### 7. Color Grading は Saturation を上げすぎない範囲で微調整 [10:19–10:41]
Global Saturation を 1.5、Midtone Saturation を 1.2 という具体的な数値が示されている。彩度を極端に上げるのではなく、全体と中間トーンを別々に少しずつ上げるという2段階の調整。

### 8. アセットのエンジンバージョン非互換は「対象バージョンを下げて追加」で回避できる [10:52–11:04]
Epic 提供の背景アセット追加時に「5.3 非対応」警告が出ても、5.0 Early Access 版として追加すれば動作する、という実務的な回避策が明言されている。バージョン警告＝使用不可ではない、という判断。

### 9. 背景の植生は軽量な 2D ビルボードで済ませる [11:44–11:57]
遠景の山に木を生やす際、フルメッシュではなく同梱の 2D Tree Billboard を使う。近景と遠景で植生の表現コストを切り替えるという考え方（本チュートリアルでは理由の言及は「そういうアセットがあるから使う」レベルで、パフォーマンス上の利点自体は明言されていない点に注意）。

### 10. カメラは「Snap Object to View」で構図を決めてから数値を追い込む [13:27–13:39]
Cine Camera Actor を配置後、現在のビューポート視点にスナップしてから Film Back / Focal Length / Aperture を調整する順序。まず構図、次にレンズ設定という段取り。

### 11. カメラアニメーションは Linear 補間で単調な動きに寄せる [14:47–14:55]
始点・終点の Transform キーフレームを打った後、補間モードを明示的に Linear に変更している。デフォルトの補間（Cubic 系で加減速がつく）ではなく、あえて等速の動きを選んでいる。

### 12. レンダリング設定は「基本設定で十分」という実務的な割り切り [15:23–15:25]
Movie Render Queue の設定について「うまく機能する基本的な設定を使っている」と明言。PNG Sequence・Temporal Sample 32・Warm Up Count 120 という具体値を「これで十分」として提示し、過度なチューニングをしていない。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Landscape Import | Scale | 128※推定（対象軸不明） | [01:56] |
| Landscape Material | Tiling | 0.1 | [03:16] |
| Foliage（木） | Density / Scale | 0.1 / 4〜5 | [05:23][05:33] |
| Foliage（木・彫り込み後） | Density | 1 前後※推定 | [06:27] |
| Foliage（草） | Scale | 3 | [08:52] |
| Directional Light | Intensity | 58〜60 | [10:04] |
| Post Process | Global Saturation | 1.5 | [10:26] |
| Post Process | Midtone Saturation | 1.2 | [10:41] |
| Cine Camera | Focal Length | 約15 | [13:44] |
| Cine Camera | Aperture | 約4 | [13:53] |
| Movie Render Queue | Temporal Sample Count | 約32 | [13:43]※本文[15:43]相当 |
| Movie Render Queue | Warm Up Count | 120 | [15:55] |

※ = 字幕崩れ・数値省略のため推定または不確実（原文断片: "something like 128" "something like 60 or 58" "something like15" "something like4"）

## 字幕だけでは取れなかったもの

- [00:46][01:18] ハイトマップ配布サイト名・使用した EXR→PNG 変換サイト名（"convert iio" と聞こえるが正式名称は画面表示のみで音声上は不明瞭）
- [09:47][09:52] Exposure Compensation の Intensity 具体値（字幕が "intensity to something like" で切れており数値が欠落）
- [01:28] Landscape Import 時の Scale 変更が X/Y/Z いずれの軸かは字幕から特定不可
- 各ペイント作業（木・草・岩をどの位置にどの密度で置くか）のブラシワーク自体は視覚依存で文字情報に乗らない
