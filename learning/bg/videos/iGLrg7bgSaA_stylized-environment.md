# 学習ノート 02 — UE5 Beginner Tutorial: Stylized Environment（田園・ファンタジー風景）

- 動画: https://www.youtube.com/watch?v=iGLrg7bgSaA （19:59）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/iGLrg7bgSaA.txt](../transcripts/iGLrg7bgSaA.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

1. **基盤** [00:32–01:23] — Blank プロジェクト → Empty Level → **Environment Light Mixer**（Window メニューから）で Skylight / Atmosphere Light / Sky Atmosphere / Volumetric Cloud / Height Fog を一括生成 → レベルを `_main` の名前で保存
2. **地形の造形** [01:23–02:37] — Landscape モード、Section Size を 63×63 から **15**※ に変更して作成 → Sculpt ブラシで地形を彫る → Smooth ツールで均す → Shift 押しながら Sculpt で川の溝を作る → 再度 Smooth
3. **アセット導入** [02:37–03:27] — Place Actors パネルから Marketplace を開く → "stylized" 検索・Free フィルタで **Stylized Nature Pack** と **Stylized Fantasy** を追加 → "mountains" 検索で **背景山パック（Photoreal/landscape backgrounds）** を追加（各 600MB 程度）
4. **Landscape マテリアル適用** [03:27–05:26] — Stylized PBR Nature 内の Terrain フォルダから Landscape マテリアルを Landscape の Material スロットにセット → 最初は全面黒（マルチレイヤー材のため）→ Landscape モードの Paint タブで Layers（grass_01 / grass_02 / dirt / rock）を確認し、`grass_01` レイヤーに Layer Info を新規作成して適用 → タイリングの繰り返し感をマテリアルグラフで対策（後述）
5. **地形コンポーネント追加・アセット配置** [05:29–09:00] — Landscape の Manage タブ → Add で地形コンポーネントを追加拡張 → Meshes フォルダから家（SM_house_01 / SM_house_main）・水車小屋・風車（ファン込み、Y 軸で持ち上げ）を配置・回転
6. **川の作成** [06:56–07:38] — Place Actors → Shapes → Plane を配置しスケール・位置調整 → Materials フォルダの **Water Master material** を適用
7. **背景山配置** [07:38–09:00] — Photoreal backgrounds フォルダの Static Mesh フィルタを有効化 → background mountain (dor4) をドラッグ配置、Z 軸スケールで縦に伸ばす → materials フォルダの `top_planner`※ マテリアルに変更 → 複製して背景全体に配置
8. **道の描画** [09:00–09:24] — Landscape Paint モードで `grass_02` レイヤーに Layer Info を作成し、ブラシサイズを縮小して道状に塗る
9. **フォリッジ配置** [09:25–13:35] — Foliage Mode → Nature Pack の Foliage Types（grass / bush / fern）をドラッグして登録 → Density・Scale（0.7 前後）を調整しながらペイント → Shift 押しで消去 → Rocks フォルダから岩を数種選び Density を 2 程度に下げて散布 → Foliage Types から木を複数種選び **Align to Normal を無効化**してから密度高めでペイント（Static Mesh フィルタを有効にして地形メッシュと区別）
10. **ポストプロセス** [13:37–15:10] — Post Process Volume を追加 → **Infinite Extent (Unbound) を有効化** → Exposure セクションで Metering Mode と Exposure Compensation を有効化、Auto → **Manual** に変更、Compensation 値を **10**※ に設定 → Color Grading の Saturation を **1.1**※ に微調整（Motion Blur は今回未使用）
11. **空の演出** [14:27–14:52] — Volumetric Cloud の Layer Bottom Altitude を **20**※ まで上げる → Ctrl+L でマウスドラッグし太陽（Directional Light）の角度を調整
12. **パーティクル追加** [14:53–15:09] — Stylized Fantasy フォルダの Particles から Wind Trail パーティクルシステムを配置
13. **カメラとシーケンス** [15:10–18:04] — Level Sequencer を追加 → Camera Actor を配置し、右クリック → **Snap Object to View** で目線位置にスナップ → シーケンサーにカメラをドラッグして登録 → Camera Settings：Film Back を Digital Film → **DSLR** に変更、Focal Length を **20**※、Aperture を **3.5**※、Frame Rate を **24** に設定
14. **カメラアニメーション** [16:12–17:14] — Transform に Key Frame を追加（0 フレーム）→ カメラを前進させて別位置で Key Frame 追加 → 補間が Cubic だと不自然なので両キーを選択し右クリックで **Linear** に変更 → タイムライン長を **192**※ に延長し、カメラカット末尾のキーも 192 フレーム位置に配置
15. **風車アニメーション** [17:16–17:59] — 風車のファンを選択し Gizmo を World → **Local** に変更 → Sequencer で Transform/Rotation を展開 → 0 フレームで Pitch=0 のキー、終端フレームで Pitch=**360** のキーを追加 → 補間を Linear に変更
16. **レンダリング** [18:04–19:44] — Edit → Plugins で **Movie Render Queue** プラグインを 2 つ有効化しエンジン再起動 → メインレベルと Level Sequencer を開く → Render アイコンから Movie Render Queue タブを開く → JPEG Sequence 設定を削除し、Anti-aliasing 設定と PNG Sequence 設定を追加 → Anti-aliasing の **Temporal Sample Count を 32** に設定、Override Anti-aliasing を有効化 → Advanced タブで **Render Warm Up Count / Engine Warm Up Count をそれぞれ 120** に設定 → Output タブで出力先・解像度（4K 等）・フレームレート（24 等）を指定 → Accept → Render Local

## クオリティを上げる教訓（SCRAP BLITZ に効く順）

### 1. スタイライズ環境でもレンダー設定は軽くていい [18:53–18:57]
講師の判断：「これは stylized environment だから、フォトリアルな高品質レンダリング設定は不要」。Movie Render Queue で Temporal Sample や Warm Up を極端に積まず、PNG Sequence + AA サンプル 32 程度に留める判断基準が明言されている。写実性を追わないスタイルなら描画コストもそこに割かない、という優先順位付けの教訓。

### 2. Landscape マテリアルのタイリング対策はマテリアルグラフで解決 [04:47–05:24]
繰り返しパターンが目立つ問題に対し、UV に **Multiply(A=Texture Coordinate, B=Tiling パラメータ)** を挟んでスケーリングする定型手法。パラメータ化（名前"tiling"、既定値※）してマテリアルインスタンス的に調整可能にしている。「そのまま貼ると絶対にタイリングが見える」という前提で最初から対策ノードを仕込む姿勢。

### 3. 木の配置は Align to Normal を切る（スタイライズ的选択） [12:34]
通常 Foliage は地形法線に沿わせるが、木を塗る際は **Align to Normal を無効化**すると明言。傾斜地でも木を鉛直に立たせるための判断で、リアル志向より視認性・様式感を優先する典型的なスタイライズ処理。

### 4. 背景の山は Z 軸スケールで持ち上げて奥行きを作る [08:16–08:21]
背景山メッシュをそのまま置くのではなく、縮小してから**Z 軸方向にだけ引き伸ばす**ことで、遠景の壁のような圧を演出。「奥行きを追加するため」と目的が明言されている [07:40]。

### 5. ムード作りは Exposure を Auto ではなく Manual で固定する [13:59–14:09]
Post Process の Exposure を Auto のままにせず Manual + Compensation 値で固定する判断（前作ノートの教訓 3 と一致する方針）。スタイライズ環境でも露出をシーンごとに手動グレーディングする考え方は共通。

### 6. アニメーションキーは必ず Linear 補間に直す [16:47–16:52], [17:53–17:59]
カメラ移動・風車回転の両方で、デフォルトの Cubic Auto 補間だと不自然な緩急がつくため、**両キーフレームを選択して右クリックから Linear に変更**する操作が繰り返し強調されている。等速で回転・移動させたい演出（プロペラ、パン）では機械的に一定速度が正しい、という判断基準。

### 7. Convert前提ではなく個別配置＋複製で背景を埋める [08:43–08:56]
背景山は「1体配置 → 複製 → 並べる」という単純な反復で全景を作る。プロップの個別性より配置の速度を優先する、初心者向け講座らしい効率重視のアプローチ。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Landscape | Section Size | 63×63 → 15※ | [01:33–01:39] |
| Landscape マテリアル | Tiling パラメータ既定値 | 0.1※ | [05:08–05:12] |
| Foliage（grass） | Scale | 0.7※ | [10:13–10:14] |
| Foliage（rocks） | Density | 2※ | [11:44] |
| Post Process | Exposure Compensation（Manual） | 10※ | [14:07–14:09] |
| Post Process | Saturation | 1.1※ | [14:16–14:19] |
| Volumetric Cloud | Layer Bottom Altitude | 20※ | [14:36–14:38] |
| シネカメラ | Film Back / Focal Length / Aperture | DSLR / 20mm※ / f3.5※ | [15:56–16:06] |
| シネカメラ | Frame Rate | 24 | [16:08–16:11] |
| Sequencer | タイムライン長 | 192※ | [17:03–17:12] |
| Movie Render Queue | Temporal Sample Count | 32 | [19:13–19:15] |
| Movie Render Queue | Render/Engine Warm Up Count | 120 / 120 | [19:21–19:26] |

※ = 字幕崩れ・数値の聞き取り不確実性による推定（"let's say 15"、"default value will be .1"、"something like 10/1.1/20/20/3.5/192" 等、講師の口調自体が曖昧な指定を含む）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [03:52–04:39] Landscape Paint の Layer Info 新規作成時に出るダイアログの具体オプション（画面操作のみで音声説明なし）
- [09:57–10:20] Foliage Density/Scale スライダーの実数値変化（"like that" と口頭で済ませており、画面の数値表示が字幕に載っていない）
- [11:19–11:47] Rocks の個別選択（どの岩アセットか）や配置のばらつき具合（クリック操作のみ）
- 背景山・家・windmill 等の具体的な配置座標・回転角度（"place it over here" 等、画面操作依存で言語化されていない）
- スタイライズ表現の核心である「PBR マテリアルのどの部分をどう単純化・彩度調整したか」の具体パラメータは、字幕上は "stylized" パックを使うことのみで、質感自体の作り込み手法（シェーダー面）への言及は本動画には無い（Nature Pack 等の既製アセット任せ）
