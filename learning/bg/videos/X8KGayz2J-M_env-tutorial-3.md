# 学習ノート 03 — Unreal Engine 5 Environment Tutorial for Beginners（コテージ湖畔環境）

- 動画: https://www.youtube.com/watch?v=X8KGayz2J-M （49:44）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/X8KGayz2J-M.txt](../transcripts/X8KGayz2J-M.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

1. **基盤** [00:36–01:24] — Blank プロジェクト → Empty Level → **Environment Light Mixer**（Window から開く）で Skylight / Sky Atmosphere / Volumetric Cloud / Height Fog をワンクリック生成、専用フォルダへ整理
2. **プロジェクト設定** [01:26–01:54] — マップを保存（"Main"）してから Project Settings > Maps & Modes でデフォルトマップを Open World → Main に変更
3. **Landscape 作成** [01:54–02:19] — Landscape モードで Section 数を 63×63 → 31 に変更して Create
4. **家アセットの導入** [02:22–07:05] — CGTrader からコテージ（obj/fbx/3ds/MTL 形式）を無料ダウンロード → Unreal にインポート（"Generate Missing Collisions" は無効化、"Create New Materials" は有効化）→ テクスチャ（Albedo/Normal/Roughness）フォルダごとインポートし、マテリアルエディタで手動ノード接続（既存の Parameter ノードは削除してから繋ぐ）
5. **メッシュ統合** [07:12–07:46] — 個別パーツ化した家を全選択して **Ctrl+G（Group）** でグループ化し専用フォルダへ
6. **地形彫刻** [07:46–10:03] — Landscape に Add で Component 追加 → Sculpt Tool（Shift 押下で凹ませる）→ Smooth Tool で均す、家を仮配置しながら反復
7. **水面** [10:03–12:44] — Water Plugin を有効化（要再起動）→ Water Body Lake を配置 → Spline Point で湖の形を編集（右クリックで Add Spline Point）→ 配置直後は "Set Landscape" を無効化 → Water Material の Global Vector Parameter で Scattering / Absorption カラーを調整
8. **Landscape マテリアル** [12:44–14:20] — Quixel Bridge から Rocky Ground マテリアルインスタンスを Add → Landscape に直接ドラッグ&ドロップして適用 → Tiling が単調なら MI の Tiling/Offset で倍率変更（1→2.1）
9. **岩・地物アセット配置** [14:22–16:40] — Quixel Bridge（Nature > Rock フィルタ）から複数の岩・地面アセットをインポートして手動配置
10. **色合わせ** [16:40–18:24] — 岩や Landscape のマテリアルで **Albedo Tint** を有効化し、グレー系に色を寄せて統一感を出す
11. **Foliage 導入** [18:28–23:09] — Quixel Bridge から 3D Plant を複数種インポート → Foliage Mode でペイント（Scale/Density 調整）→ マテリアルインスタンスで Wind（Grass Wind / Wind Intensity / Speed）を有効化 → Albedo テクスチャの Saturation・Vibrance を上げて色を鮮やかに
12. **背景の山** [23:09–25:14] — Epic Marketplace の無料 "Landscape Background" パックを導入し、Photoreal Backgrounds フォルダの Static Mesh を配置・スケール調整
13. **木の植生** [25:16–28:15] — Epic Marketplace の無料 "Landscape Pro 2.0" から松の木（SM Pine Trees）を Foliage でペイント（**Align to Normal を無効化してからペイント**）、billboard 用の遠景木も別途ペイント
14. **ポストプロセス** [28:15–31:32] — Post Process Volume を配置し Infinite Extent を有効化 → Exposure を Manual にして値 9 に設定 → Directional Light の intensity 調整・回転（Ctrl+L でドラッグ）→ シャドウのちらつきは `r.Shadow.Distance.Scale 0` で解消 → Vignette/Sharpen 有効化、Color Grading の Global Saturation を 1.3 に
15. **フォグマテリアル自作** [31:32–37:56] — 新規マテリアル（Translucent）で Radial Gradient Exponential × Depth Fade × Multiply → Opacity、Parameter 化（opacity / fade distance）してプレーンに適用 → Engine 内蔵 Tiling Noise 05 を使ったバリエーション版も作成 → Exponential Height Fog の density/fog height falloff/start distance を調整 → Panner ノードで UV を流してフォグをアニメーション
16. **光源追加** [37:56–38:48] — 家に Point Light（Rect Light）を追加、intensity 2000・radius 調整・色をオレンジに、Alt+ドラッグで複製
17. **火・樽アセット** [38:48–40:00] — Epic Marketplace の無料 "M5 VFX Volume 2" から Barrel メッシュと Fire パーティクルを配置、Quixel の Rusty Painted Metal マテリアルに差し替え
18. **柵アセット** [40:00–40:00] — Quixel Bridge から Modular Wooden Fence を導入し Foliage でも配置
19. **ボートの外部導入** [40:00–43:00] — Sketchfab から無料 Wooden Boat（obj 形式）をダウンロード → Blender で obj → fbx に変換 → Unreal にインポートしテクスチャ手動接続
20. **鳥アセット** [42:56–43:47] — Epic Marketplace の無料 "Rer Australia"（野生動物）パックから鳥の Niagara システムを配置・複製
21. **レベルシーケンスとカメラ** [43:54–47:52] — Level Sequencer 追加 → Cine Camera Actor を配置し "Snap Object to View" で仮アングル決め → Camera の Digital Film を DSLR に変更、Focal Length 26mm・Aperture 4 に設定 → Motion Blur（amount 3程度、Target FPS 24）→ カメラ・ボートにトランスフォームキーフレームを追加しアニメーション、キーの補間モードを Cubic Auto → Linear に変更 → フレームレートを 30→24 に変更
22. **レンダリング** [48:00–49:32] — Movie Render Queue プラグインを有効化（要再起動）→ PNG Sequence + Anti-aliasing + High Resolution 設定を追加 → Temporal Sample Count 32、Override Anti-aliasing 有効、Advance の Warm-up Count 120 → 出力ディレクトリ・解像度・フレーム範囲設定 → Render Local

## クオリティを上げる教訓

### 1. Landscape マテリアルは既製 MI をそのまま貼るだけでは単調 [12:56–14:20]
Rocky Ground マテリアルインスタンスを Landscape にドラッグ&ドロップしただけでは、講師自身が「タイリングが repetitive すぎる」と指摘 [13:52]。対策として MI の Tiling/Offset パラメータを有効化し倍率を 1 → 2.1 に変更。それでも「perfect ではない」と認めた上で、**その残り味は地物メッシュを置いて覆い隠す**という判断（見た目の粗を後工程でカバーする発想）[14:17–14:20]。

### 2. 寄せ集めアセットの色合わせは Albedo Tint で事後調整 [16:40–18:24]
Quixel の岩アセットは「色は気にせず選んでよい、後で Unreal 側で調整する」と明言 [14:39–14:43]。実際の手順はマテリアルの **Albedo Tint を有効化してグレー系にシフト**。Landscape マテリアルにも同じ Tint 調整を適用し、地面と岩の色相を揃えている [18:01–18:21]。前ノート（ee-IOlWUZTo）の「Unlit Mode で全体を見て色相統一」と同じ狙いだが、この動画では Unlit 切り替えには言及がなく、素の見た目のまま Tint を都度確認する運用。

### 3. フォグ平面は「縁の硬さ」を Depth Fade で必ず消す [33:11–33:37]
プレーンに自作フォグマテリアルを適用した直後、「エッジが Sharp すぎる」と自己指摘 [33:11–33:13]。Depth Fade の Opacity/Fade Distance パラメータを有効化して Fade Distance を増やすことで解消。**フォグ平面は貼った直後の状態では未完成で、Depth Fade 調整が前提工程**という理解が明確に語られている。

### 4. フォグは最低 2 バリエーション作る [35:41–36:59]
単色グラデーションのフォグ材の後、Engine 内蔵 **Tiling Noise 05** を Multiply で追加した別マテリアルインスタンスを複製生成 [36:37–36:48]。同じ形の霧を並べる単調さを避けるため、ノイズありなしの2種を使い分けて山全体に配置 [34:57–35:32]。

### 5. Foliage ペイント前に Align to Normal を切る（斜面での木の傾き対策） [26:33, 28:02]
松の木・遠景木の両方で、ペイント開始前に「make sure to disable this align to normal」と明示的に言及。地形が斜面でも木が地形法線に沿って傾かないようにする判断（垂直に立たせる意図）。

### 6. 露出・シャドウ・彩度はポストプロセスで先に整える [29:02–30:29]
Exposure を Auto から Manual に切り替え値 9 を設定 → Directional Light の intensity/角度調整 → シャドウのちらつき（`r.Shadow.Distance.Scale` を 0 に）→ Vignette/Sharpen → Saturation 1.3。前ノート同様「ムードを先に決める」工程順だが、この動画ではコンソールコマンドでのシャドウ対策 [29:40–30:02] が新出。

### 7. 水の色はプロジェクトごとに違って見えるので Water Material で明示調整 [11:27–12:39]
講師は「あなたの水の色は自分のと違って見えるはず」と先回りして説明し、Water Material の Global Vector Parameter Values にある Scattering / Absorption を実演。Scattering パラメータはデフォルトで無効化されている場合があるため、まず有効化してから色を選ぶ、という手順を明言 [12:11–12:16]。

### 8. 素材の入手先を用途で使い分け [23:09, 38:53, 40:02, 42:59]
この動画では CGTrader（コテージ本体）、Quixel Bridge（地形材・岩・植生・柵・金属マテリアル）、Epic Marketplace 無料アセット（背景山・木・VFX樽・野生動物）、Sketchfab（ボート）の4系統を目的別に使い分けている。ボートは obj 形式のみだったため Blender 経由で fbx に変換する手順が具体的に語られた [40:35–40:47]。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Landscape | Section 数 | 63×63 → 31 | [01:54–02:06] |
| Landscape マテリアル | Tiling/Offset 倍率 | 1 → 2.1 | [14:03–14:09] |
| Foliage（植物） | Scale / Density | 10〜12 / 密度 50 程度 | [19:17–19:47] |
| Foliage（葉物） | Scale / Density | 4〜6 / 2 | [20:43–20:52] |
| Foliage（松） | Scale / Density | 3〜5 / 1〜5 | [26:13–26:19] |
| Foliage（遠景木 billboard） | Density / Scale | 20 / 1.5〜2 | [27:46–27:58] |
| 植物マテリアル | Saturation / Vibrance | 1.5 / 1 | [22:24–22:33] |
| Post Process | Exposure（Manual） | 9 | [29:09–29:13] |
| コンソールコマンド | r.Shadow.Distance.Scale | 0 | [29:47–29:55] |
| Color Grading | Global Saturation | 1.3 | [29:29] |
| フォグ平面 | Plane スケール | 約100 | [32:41–32:43] |
| フォグマテリアル | Opacity / Fade Distance デフォルト値 | 1※ | [32:19–32:23] |
| フォグ Panner | Speed | 0.1※ | [36:29–36:33] |
| Rect Light（家） | Intensity | 2000※ | [37:27] |
| シネカメラ | Focal Length / Aperture | 26mm / f4 | [45:08–45:22] |
| Motion Blur | Amount / Target FPS | 3程度 / 24 | [45:32–45:37] |
| レベルシーケンス | フレーム長 | 240 | [46:16–46:19] |
| キーフレーム補間 | モード | Cubic Auto → Linear | [46:31–46:37] |
| フレームレート | 変更後 | 30 → 24 | [47:49–47:51] |
| Movie Render Queue | Temporal Sample Count | 32 | [49:02–49:03] |
| Movie Render Queue | Warm-up Count | 120 | [49:11–49:14] |

※ = 字幕崩れ・数値の聞き取りが不明瞭なため推定値（"maybe 2,000" 等の言い回しを含む）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [00:59–01:16] Environment Light Mixer で「Create」ボタンを押した際に具体的にどのアクター（Skylight/Sky Atmosphere/Volumetric Cloud/Height Fog の内訳）が生成されたか、画面操作のみで音声説明が薄い
- [05:00–06:56] マテリアルエディタでのノード配置の具体的な座標・ノード同士の視覚的な結線（「plug it over here」等、指示語のみで対象ノード名が字幕から復元しづらい箇所複数）
- [31:32–33:37] 自作フォグマテリアルのノードグラフ全体構成（Radial Gradient Exponential・Depth Fade・Multiply の接続順が字幕の口頭説明だけでは一部曖昧、特にどの出力がどのピンに繋がるか）
- [48:00–49:32] Movie Render Queue の設定パネルの詳細項目（PNG Sequence 以外の具体的な設定値、出力解像度・フレーム範囲の実数値は「if you want」と流されており数値が字幕に残っていない）

---

サマリ:
1. コテージ環境チュートリアルで、前ノート（ee-IOlWUZTo）と同じ制作パイプライン（基盤→地形→アセット→植生→ポスプロ→フォグ→カメラ→レンダ）を踏襲しつつ、Water Body Lake・Sketchfab外部モデルのBlender経由fbx変換・レベルシーケンスでのキーフレームアニメーション・Movie Render Queueでの本番レンダリングまで新出の工程を含む。
2. 新出の教訓として「Landscape マテリアルの粗は地物で隠す」「フォグの縁の硬さは Depth Fade で消すのが前提工程」「Foliage ペイント前に Align to Normal を切る」の3点が具体的な判断根拠付きで語られていた。
3. 数値パラメータの多くは口頭で「maybe」「something like」と曖昧に語られており、表中の推定値は原文の言い回しから機械的に拾ったもの。

監査用・確信度が低い順3件:
1. [37:27] Rect Light の intensity「2000」— 講師は "maybe 2,000" と発言、数値の確度が低い
2. [36:29–36:33] フォグ Panner の Speed パラメータのデフォルト値「0.1」— 字幕は "01" で小数点位置が不明瞭、"0.1" と解釈したが "1" の可能性もある
3. [32:19–32:23] フォグマテリアルの Opacity/Fade Distance パラメータのデフォルト値「1」— 字幕 "give them a default value to something like one" は2つのパラメータ共通なのか個別なのか文脈上判別しづらい
