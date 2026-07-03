# 学習ノート — Unreal Engine 5 Beginner Tutorial (UE5 Starter Course)

- 動画: https://www.youtube.com/watch?v=tG4Sst48eKk （40:40）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/tG4Sst48eKk.txt](../transcripts/tG4Sst48eKk.txt)（`[MM:SS]` で原文照合可能）

Starter Course のため前半は基礎操作説明（インストール・ナビゲーション・UI）が中心。既知の基礎は圧縮し、環境/背景クオリティに効く工程（マテリアル・フォグ・folage・ライティング・レンダリング）を厚く記述。

## 全体ワークフロー（工程順）

1. **導入・基礎操作**（既知の基礎のため圧縮）[00:51–08:00] — Epic Games Launcher から UE5.3.2 をインストール（5.4 はバグがあるため回避 [01:21]）→ Target platform を絞ってインストールサイズ削減 → Blank テンプレート（Blueprint・品質最大・Starter Content 無効・Raytracing 無効）→ 視点操作（右ドラッグ+WASD、E/Q で上下、スクロールで速度調整）→ UI 各パネル（Outliner / Details / Content Browser 等）の紹介
2. **ライティング基盤** [08:00–08:43] — 新規 Empty Level で **Environment Light Mixer**（Window メニュー）を使い、Skylight・Atmosphere Light（Directional）・Sky Atmosphere・Volumetric Clouds・Height Fog を一括生成する新方式を紹介（従来は Place Actors パネルから個別配置）
3. **Landscape 作成とスカルプト** [08:46–10:54] — Landscape モードで Section size を 63→127 quads に変更して作成 → Sculpt/Erase/Smooth/Flatten の 4 ツールで地形を彫る（Cabin 設置用の平坦地を Flatten で作る）
4. **地形マテリアル** [10:56–16:56] — Quixel Bridge から地形素材（岩肌テクスチャ）DL → ライブラリ保存先を C ドライブ以外に変更 → マテリアルを自作（Albedo/Normal/Roughness/AO 接続 + TexCoord→Multiply→Tiling パラメータでタイリング調整）→ Material Instance 化 → Landscape に適用、タイリング値を調整して繰り返し感を解消
5. **山・地形装飾** [14:55–16:56] — Sketchfab の3Dマウンテンアセットを FBX インポート → マテリアル自作（Albedo/Normal 接続）→ 複製・回転・スケールでバリエーションを作り配置
6. **水面** [16:57–18:09] — Water Plugin 有効化（要再起動）→ Water Body Custom を配置・スケール → Water Material の Absorption/Scattering Color で水の色調整
7. **前景・地面装飾** [18:10–20:32] — Quixel Bridge から岩アセットを追加 → Static Mesh フィルタで抽出し配置 → 岩ごとに色味が違う問題を Material Instance の Albedo Tint で統一
8. **建物（Cabin）** [20:33–21:46] — CGTrader の無料ウッドキャビンモデルを FBX インポート → マテリアル自作（Albedo/Normal/Roughness 接続）→ シーンに配置
9. **Foliage（植生）** [21:47–23:55] — Quixel Bridge から草アセット DL → Foliage Mode でペイント（Min/Max Scale・Brush Size・Density 調整）→ 草マテリアルで Wind 有効化 + Albedo Tint で色を暗く調整して環境に馴染ませる
10. **HDRI 空** [23:57–25:09] — Poly Haven から HDRI DL → HDRI Backdrop Plugin 有効化（要再起動）→ HDRI Backdrop アクター配置・サイズ拡大（150→10,000）→ Cubemap にHDRIを割当・回転で光と空を調整
11. **フォグ／ミスト自作マテリアル** [25:10–29:24] — 新規マテリアル（Translucent）に Radial Gradient Exponential → Base Color/Opacity、Depth Fade で交差線をぼかす、Opacity/Fade Distance パラメータ化 → Material Instance でプレーンに適用 → Tiling Noise 05（エンジン内蔵）を Multiply して雲状バリエーションを追加 → Panner ノードで UV アニメーション（Speed パラメータ化）→ 山周辺に配置
12. **最終要素の追加** [29:28–31:47] — UE Marketplace から鳥アセット（Niagara Particle System）・無料火炎パック（Static Mesh の薪 + Particle System の炎）を追加、Quixel Bridge から木を追加
13. **ポストプロセス・演出** [31:48–32:52] — 太陽の角度を再調整 → Exponential Height Fog の density/height falloff 調整 → Post Process Volume（Infinite Extent Unbound）追加、Bloom/Sharpen/Motion Blur（Target FPS 24）
14. **Level Sequencer とカメラ演出** [32:52–37:24] — Level Sequencer 作成（Close-up shot / Wide shot 2本）→ Camera Actor 配置・Snap to View → Lens を 85mm Prime・Aperture f1.8 に変更 → Focus Method を Tracking にし対象物を追跡 → Transform キーフレーム2点（開始・終了）→ フレームレート 30→24 → キーフレーム補間を Cubic Auto→Linear に変更 → Camera Shake Blueprint（Perlin Noise パターン、Duration=0、Rotation Amplitude ×2、Frequency ×0.5）を作成しシーケンサーに追加
15. **レンダリング前のシャドウ/Foliage 問題対策** [37:53–38:52] — シャドウが距離で消える問題は `r.Shadow.DistanceScale 0` で解消。Foliage の LOD 低下問題は `foliage.ForceLOD 0` だがリアルタイム負荷が高いため、Movie Render Queue 使用時のみ適用する方針
16. **レンダリング** [38:55–40:26] — Movie Render Queue Plugin 有効化（要再起動）→ Anti-Aliasing（Spatial Sample Count=2, Temporal Sample Count=16）+ PNG Sequence + Console Variables 設定（`r.Shadow.DistanceScale 0` / `foliage.ForceLOD 0` / `r.ScreenPercentage 200`（1920×1080を2倍=実質4K相当でレンダ後1080pにダウンサンプル） / `r.MotionBlurQuality 5` / `r.DepthOfFieldQuality 4`）→ Render Local

## クオリティを上げる教訓（講師の判断基準）

### 1. エンジンバージョンは安定性を優先して選ぶ [01:21]
UE5.4 に既知バグがあるため、あえて UE5.3.2 を使用すると明言。最新版が常にベストとは限らない。

### 2. Environment Light Mixer で基本ライティングを一括生成 [08:11–08:43]
Directional Light・Skylight・Sky Atmosphere・Volumetric Clouds・Height Fog を個別に置くより、Window > Environment Light Mixer からワンクリックで揃える方が効率的（従来法との比較を明示）。

### 3. マテリアルは既製 MI に頼らず自作してタイリングパラメータを仕込む [11:24–14:16]
TexCoordinate → Multiply → Scalar Parameter（Tiling、デフォルト値1）という定型で UV タイリングを制御可能にし、Material Instance 化することで**マテリアルエディタを開き直さずに**タイリング値を調整できるようにする。これはこの動画で繰り返し使われる基本パターン（山・キャビン・フォグでも同系統の接続を使用）。

### 4. リピートパターンの目立ちは Tiling 値の微調整で対処 [14:44–14:53]
Landscape マテリアル適用後に「repetitive tiling」が目立つ場合、Tiling X/Y を 0.1 程度まで下げて対処（講師は具体値を明言、字幕に忠実）。

### 5. アセットごとの色ムラは Albedo Tint で統一 [20:00–20:32]
複数の岩アセットを並べると色が揃わない問題は、各 Material Instance の Tint（Albedo Tint）オプションを有効化し色を合わせることで解消。個別アセットごとに繰り返し適用する地道な作業として明示。

### 6. Foliage の質感はデフォルトのままにせず Wind・Tint を必ず調整 [23:15–23:40]
草を配置した後、Wind（Grass Wind 系パラメータ）を有効化し、Albedo Tint を「やや暗めの色」に変えて環境になじませる。これを怠るとレイアウトだけで質感が浮くと示唆。

### 7. フォグの縁の硬さと不透明度は Depth Fade で必ず制御する [26:00–26:19]
自作フォグ平面マテリアルは Radial Gradient Exponential だけでは「エッジが鋭すぎる／不透明度が高すぎる」問題が出るため、Depth Fade ノードを追加して Fade Distance と Opacity をパラメータ化し Material Instance ごとに調整する。

### 8. フォグはバリエーションを複数作る（単色平面で終わらせない）[27:01–27:59]
1種類のフォグマテリアルを複製し、エンジン内蔵の Tiling Noise 05 を Multiply で重ねた別バリエーションを作成。さらに Panner ノードで UV をアニメーションさせ Speed パラメータで動きを制御することで「雲のような質感」を実現。

### 9. カメラのフォーカスは Tracking Focus Method で対象を自動追従 [33:51–34:16]
Manual フォーカスではなく Tracking に変更し、フォーカス対象（この動画では木）を明示的に指定することで演出上の合焦精度を担保。

### 10. キーフレーム補間は Cubic Auto ではなく Linear に変更 [34:59–35:02]
カメラの Transform キーフレームの補間モードを Cubic Auto から Linear に切り替える工程を Close-up・Wide 両ショットで共通して実施（イージングの効きすぎを避ける意図と推測されるが、理由自体は字幕に明言なし）。

### 11. カメラシェイクは Duration=0 で常時ループさせる [35:41–35:45]
Camera Shake Blueprint の Timing セクションで Duration を 0 に設定 = 単発ではなく継続的な微振動として使う設計。Rotation Amplitude Multiplier を2倍、Frequency Multiplier を0.5倍にして「controlled subtle」な揺れに調整。

### 12. リアルタイム負荷が高い設定は本番レンダ時のみ適用する [38:34–38:50]
Foliage の `ForceLOD 0`（LOD低下を防ぎ常に最高詳細度で描画）はリアルタイムでは重くエンジンがクラッシュしうるため、作業中は使わず Movie Render Queue の Console Variables 欄でレンダリング時のみ適用する。**開発時と最終出力時で品質設定を切り替える**という判断基準。

### 13. 解像度は ScreenPercentage で疑似的に超解像レンダしてダウンサンプルする [39:53–40:00]
`r.ScreenPercentage 200` を設定すると 1920×1080 の2倍相当（実質4K）でレンダリングしてから1080pに縮小し、アンチエイリアシング品質を底上げする。出力解像度自体を上げるのではなくスーパーサンプリングとして使う手法。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| エンジン | 使用バージョン | 5.3.2（5.4はバグ回避のため不使用） | [01:21] |
| Landscape | Section size | 63→127 quads | [09:03] |
| マテリアル | Tiling パラメータ default | 1 | [13:42] |
| Landscape マテリアル | Tiling X/Y（リピート目立ち対策） | 約0.1 | [14:51] |
| Water Body Custom | スケール | 1000（両軸） | [17:31]※ |
| Foliage ペイント | Scale Min/Max | 1.5 / 2 | [22:21] |
| HDRI Backdrop | Size | 150 → 10,000 | [24:41] |
| Niagara 鳥 | Mesh Uniform Scale | 1.5〜2 | [30:22] |
| カメラ（Close-up） | Lens / Aperture | 85mm Prime / f1.8 | [33:51–33:56] |
| カメラ（Wide） | Film back / Lens | DSLR / 12mm Prime | [36:33–36:43] |
| カメラ（Wide） | タイムライン長 | 約384フレーム | [37:04–37:11] |
| フレームレート | シーケンサー全般 | 30→24 | [34:56][36:47] |
| Camera Shake | Duration / Rotation Amplitude / Frequency | 0 / ×2 / ×0.5 | [35:41–35:54] |
| コンソール変数 | r.Shadow.DistanceScale | 0 | [38:04–38:11][38:35] |
| コンソール変数 | foliage.ForceLOD | 0 | [38:40–38:46][38:44] |
| コンソール変数 | r.ScreenPercentage | 200 | [39:50–39:55] |
| コンソール変数 | r.MotionBlurQuality | 5 | [40:07–40:10] |
| コンソール変数 | r.DepthOfFieldQuality | 4 | [40:13–40:16] |
| Movie Render Queue | Spatial / Temporal Sample Count | 2 / 16 | [39:14–39:19] |

※ = 字幕崩れのため推定値（原文 "th000 in both AES"）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [02:34–02:48] プロジェクト作成時の Project Default Settings 画面の各チェックボックス配置・具体的な UI 操作手順（音声説明はあるが画面操作の細部は字幕から追えない）
- [16:19–16:55] 山アセットをシーンに複製・配置する際の具体的な配置座標・個数・回転角（"placing them randomly" とのみ言及され数値は無し）
- [30:53–31:01] 火炎パーティクルのスケール調整の具体的な数値（"you can scale it up if needed" とのみ言及）
- [24:52–25:07] HDRI backdrop の回転角度（"you can also rotate the hdri backdrop to adjust the lighting" とのみ言及、具体的な角度は無し）
- [40:26 直前] Movie Render Queue の Output Settings（解像度・出力ディレクトリ・フレームレート）は「デフォルト設定を使う」とのみ言及され数値の記載なし
