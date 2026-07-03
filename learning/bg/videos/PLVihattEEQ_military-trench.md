# 学習ノート 03 — Megascans Tutorial: Build a Realistic Military Trench Environment from Scratch

- 動画: video ID `PLVihattEEQ`（34:36）
- 学習日: 2026-07-04 / 抽出: 英語自動字幕(en-orig) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/PLVihattEEQ.txt](../transcripts/PLVihattEEQ.txt)（`[MM:SS]` で原文照合可能）
- 注記: タイトルは「軍事塹壕」だが、字幕内容は**塹壕・土嚢・軍事施設固有の地形彫刻/小物配置には一切触れていない**。既存シーン（Fabマーケットプレイスの完成シネマティック）を題材に、①RVTによるLandscape⇔Megascansメッシュのブレンド、②PCGによる手続き型散布・set dressingツール自作、③Unreal Insightsによるプロファイリングと最適化、の3本柱を深掘りする技術チュートリアル。set dressingのセンス面（教訓）はほぼ無く、ワークフロー面（技術工程）に内容が偏っている

## 全体ワークフロー（工程順）

1. **Landscapeマテリアルの基本構成** [00:39–02:48] — Layers / Adjustments / Landscape Layer Blend を Material Attributes 出力へ接続 [00:49–01:04]。RVTブレンドに使うテクスチャは**Virtual Textureではなく通常テクスチャに変換する必要がある**（フィードバックパスが無いため、エンジンがどのタイルをストリームすべきか分からない）[01:11–01:36]。変換は右クリック→Convert to regular texture、またはテクスチャを開いて同ボタンを検索 [01:37–01:52]
2. **Height mapのチャンネル選定とDXT1圧縮の注意** [01:53–02:48] — Height mapはGreenチャンネルを使用（displacementとheight blend両方の駆動元）。理由：DXT1圧縮はR5/G6/B5に圧縮されるため、Greenチャンネルの方がroughness/heightのようなマップで若干高品質になる [01:57–02:22]。DXT1は低解像度で特にアーティファクトが出やすいため、気になる場合はBC7等の圧縮方式を検討（ファイルサイズは増えるが、その分解像度を下げられて結果的に高品質になる場合もある＝要実験）[02:23–02:48]
3. **レイヤーペイントの下ごしらえ** [02:51–03:59] — マテリアルインスタンス作成→Landscapeへ割当→Landscape Mode → Create layers from assigned material → Weight blended layer info objects作成（ペイントしたレイヤーのデータ格納先）[02:57–03:39]
4. **NaniteディスプレイスメントとMagnitude調整** [03:40–04:38] — Landscapeマテリアルの詳細パネルでNanite検索→Tessellation有効化→Displacement dropdownでCenterを0に設定（Landscapeが正しい位置に留まるように）[03:40–03:58]。**Magnitudeの強さはLandscapeのZScale（この例では100）に直接影響される**ため、ZScaleを補うためMagnitudeは低めに保つ [03:59–04:08]。Nanite有効化＋Build dataを実行して初めてディスプレイスメントが反映される [04:13–04:22]
5. **RVT3種の作成とLandscapeへの割当** [04:38–05:19] — 用途別に3種類のRVTを作成: ①Base Color/Normal/Roughness、②Displacement、③World Height [04:46–04:55]。LandscapeにRVTを割り当てた後、Create volumesでLandscapeサイズに自動スケールするVolumeを生成 [05:09–05:19]
6. **LandscapeマテリアルからRVTへの出力設定** [05:19–06:56] — Base Color/Roughness/Normalを取得→Set Material Attributesノードで組み直し→Runtime Virtual Texture Outputノードへ接続 [05:29–06:11]。Displacement用にRVT Sampleノードを複製しDisplacement RVTに差し替え、Set Material Attributesにdisplacement pinを追加 [06:19–06:48]
7. **Megascansメッシュ側でのRVTサンプリングとブレンドマスク作成** [06:57–09:49] — 専用マテリアルを複製し、World PositionのZとRVT Sampleでサンプルした World Height を減算→均等な黒白マスク生成 [07:08–07:23]。Add でHeightのシフト、Divideでトランジションのぼかし調整、One Minusで反転、Saturateで0-1にクランプ（Lerpノードでは範囲外の値が変な効果を生むため必須）[07:25–07:50]。マスクをNamed reroute「alpha」として整理し、Lerpノードでstatic meshのbase colorとRVTのbase colorをブレンド。Base Color/Roughness/Normalそれぞれに同様のLerpを設定 [07:59–08:44]
8. **法線のワールド/タンジェント空間変換でシーム解消** [08:45–09:49] — Unlit modeでブレンド自体は機能していることを確認できるが、World Normal view modeで見るとメッシュとLandscapeの交点に硬いノーマル境界が見える [08:45–09:09]。**Landscapeマテリアル側・Megascansメッシュ側の両方**でRVT Sample後にTransformノードを追加しWorld Space→Tangent Spaceに変換 → スムーズな遷移になる [09:10–09:43]。ただしメッシュ面がLandscape表面に対して垂直（perpendicular）な箇所ではシームがなお目立つ、と明言 [09:49–09:56]
9. **Noiseによるエッジブレイクアップ** [09:58–10:58] — NoiseノードでIntensity/Contrastを制御しエッジに不規則性を追加（Noiseノードはtexture samplerより負荷が高い点に留意）[09:58–10:19]。Height Lerpノードを使い、既存alphaをTransition入力、NoiseマスクをHeight Texture入力に接続 [10:20–10:32]。Noiseノードのデフォルトminは-1のため、0に設定して出力バランスを補正 [10:33–10:41]
10. **Virtual Texture Poolの調整（Resizing pools対策）** [10:58–14:13] — Project SettingsのVirtual Texture Pool設定で、Default sizeを512や1024に上げると「resizing pools」警告を簡易に解消できる。より細かい制御をしたい場合はTransient poolsと同じcompression typeを持つ新規Fixed poolを作成（詳細は教訓セクション）[11:06–11:47]
11. **プロファイリング用コンソールコマンド群** [12:14–14:31] — `RVT residency show 1`（メモリ使用量のライブグラフ）、`RVT residency notify 1`（オーバーサブスクライブ通知）、`stat virtual texturing`（診断統計）、`VT borders`（生成タイルの可視化）（詳細は教訓セクション）
12. **カメラ相対World Position** [14:38–15:09] — RVT Mega Scansマテリアル内のWorld Positionノードは、camera relative world positionを使うのがベストプラクティスと明言（詳細は教訓セクション）
13. **PCGセットアップ準備** [15:10–15:29] — Procedural Content Generation frameworkとGeometry Script Interopプラグインを有効化 → 空のPCG Graphを作成
14. **PCGツール1: レベルインスタンス配置（Landscape投影）** [15:35–18:04] — Get Actor Dataノード（自分自身と通信、Single Pointモード）→Projectionノード（Landscape dataをProjection targetに接続。他のstatic mesh上に投影したい場合はWorld Ray Hit Queryを使い、対象meshのcollisionを生成しておく必要がある）[15:35–16:06]→Debugノードで可視化（Scale methodをAbsoluteに）[16:07–16:14]→Static Mesh Spawnerでメッシュ配置 [16:15–16:22]。Volumeを非一様スケールした際にDebugのboxまでスケールされる問題は、Transform Pointsノード＋Absolute scale有効化で解消 [16:33–16:56]。Level InstanceをPCG Assetとして書き出す（右クリック→Asset Actions→Create PCG assets from level）ことで、PCG Graph内でLevel Instanceの複製・配置が可能になる [17:03–18:04]
15. **PCGツール2: 岩の散布システム** [18:05–22:44] — Mesh Samplerで地形メッシュ上に点群生成→Attribute NoiseでDensityをランダム化→Transform Pointsでローカル Z軸回転をランダム化 [18:39–19:04, 18:58–19:11]。Attribute Remap（ノイズのコントラスト調整）とSpatial Noise（Perlin風ノイズ）を掛け合わせ不均一な散布を作る [19:12–19:34]。Density Filterでマスクに基づき点を間引き [20:04–20:14]。Execute Blueprintノード（Scale by Density）で外周の岩を中心より小さくする [20:15–20:32]。Normal to Densityノードでメッシュの上向き面のみに岩を配置 [20:33–20:47]。密集した岩の重なりはBounds Modifier + Self-Pruningではなく、Graph Parameter（Static Mesh Object Referenceの配列）でメッシュを渡し、Get Bounds from Mesh Bounds Modifier + Self-Pruningノードで**実際のメッシュ寸法を使った**重なり回避を実施 [21:34–22:07]
16. **PCGツール2をSubgraph化** [22:45–23:53] — 岩散布グラフの核部分だけを残しSubgraphへcollapse。Input/Outputピンを再定義（points型・static meshes型=attribute set）し、メインGraphの見通しを改善
17. **PCGツール3: スプライン沿いのBlueprintアクター散布ツール自作** [23:57–29:11] — Blueprint Actorにspline（closed loop有効）とPCG Componentを追加 [24:00–24:17]。Get Spline Data → Spline Sampler（Dimension=On Interior・Unbounded=true・Interior Sample Spacing=25でDensity調整）[24:34–25:15]。Interior Density Fall-off Curveで中心から外周へのグラデーション（同心円状の効果も可能）[25:21–25:44]。BlueprintにPublic変数（Density=int、Static Meshes=array）を追加し、PCG Graph側のGet Actor Propertyノードで取得 [25:46–26:33]。変数名にスペースを含めるとStatic Mesh Spawnerとの名前不一致エラーが発生するため、アンダースコアに置換して解消（命名の注意点として明言）[29:29–29:53]。Scale by DensityでSpline中心のメッシュを大きく・外周を小さくする仕上げ [27:59–28:16]
18. **レベルインスタンス版PCGツールへのVolume投影追加** [28:28–29:05] — World Ray Hit Query（Ignore self hit=disabled必須）でSurface Samplerを駆動し、加えてGet Volume Data on SelfでBlueprintに追加したVolume内に点を生成する応用
19. **パフォーマンス測定：Viewport StatsとUnreal Insights** [29:12–31:51] — Stat FPS / Stat Unitで概況確認→Unreal Insightsでトレース取得（詳細は教訓セクション）
20. **最適化の実施：Lumen設定とPost Process見直し** [31:51–33:14] — Project SettingsはSurface Cache（Ray lighting mode）とGlobal Tracing（Software ray tracing mode）のまま維持。Post Process VolumeでBloomをConvolution→Standardに変更、Global Illumination/Lumen Reflection設定が最大値になっていたためデフォルトへ戻す→ビジュアルをほぼ変えずに大幅な性能改善を確認 [32:03–32:42]
21. **Insightsでの効果測定とRegion機能** [32:43–33:37] — 最適化後に再トレース。Begin region/End regionでトラックに「章」を作り比較しやすくする機能を紹介
22. **ビューポートスケーラビリティと解像度設定** [33:37–34:08] — Screen percentage（TSR使用中）を70%に設定し20FPS向上を確認。エディタ性能に困る場合はViewport Scalabilityをカテゴリ別または全体で下げる選択肢も提示

## クオリティを上げる教訓（判断基準・なぜそうするか）

### 1. RVTでLandscape⇔メッシュをブレンドする際の判断基準
- **通常テクスチャ必須の理由**: RVTにはフィードバックパスが無く、エンジンがどのタイルをストリームすべきか判断できないため、Landscapeマテリアルは（VTでなく）通常テクスチャを参照する必要がある [01:11–01:36]。既存ドクトリンの「RVT 2 Volume構成」を使う前提条件として重要
- **Saturateの必須性**: Lerpノードに入れる値は必ず0-1にクランプする。範囲外の値は「odd effects（奇妙な効果）」を生むため [07:43–07:50]。マスク制作の一般原則としてどのブレンドマスクにも適用できる
- **法線変換は両側で行う**: シームの正体は法線空間の不一致（World空間のまま混ざっている）。LandscapeとMegascansメッシュ**両方**でTangent Space変換を入れて初めて解消する。ただし**メッシュ面が地表に対し垂直な箇所はなお目立つ**という限界も明言されている＝完全解決ではなく「多くの場合で改善する」程度と捉えるべき [09:10–09:56]
- **Noiseノードのコスト意識**: エッジのブレイクアップにNoiseノードを使うと、texture samplerより負荷が高い。既存ドクトリンの「ms で考える」計測文化と合致する注意点 [10:12–10:19]

### 2. Virtual Texture Poolチューニングの考え方 [10:58–13:47]
- 応急処置は**Default size**を512/1024に上げるだけで「resizing pools」警告は大抵消える。ただし細かい制御が要る場合は**Transient poolsと同じcompression typeを持つFixed poolを新規作成**する方法を取る
- **重要な落とし穴**: Fixed poolのmin/max tile sizeをTransient poolsと同じ値にしてはいけない。tile sizeが変化するたびに新しいtransient pool生成がトリガーされるため。代わりに両方を0にして全tile sizeを含めるか、必要な範囲を明示的に定義する [11:37–11:53]
- 効果検証は「Transient poolsを削除してシーン内を飛び回り、再生成されないか確認する」という具体的な手順が示されている [12:00–12:06]
- **診断コマンド群の役割分担**: `RVT residency show 1`＝メモリ使用量のライブグラフ（赤=pool occupancy 0-100%＝resizing警告の元凶、緑=mipmap bias適用状況、黄=fixed pool occupancy）[12:21–13:06]。`RVT residency notify 1`＝オーバーサブスクライブの通知（どのcompression typeが原因かまで分かる）[13:36–13:47]。`stat virtual texturing`＝診断統計 [14:14–14:22]。`VT borders`＝生成タイルの可視化 [14:25–14:31]
- **Tile sizeを上げた結果の教訓**: Tile sizeを上げるとエディタ再起動が必要になり、再度resizing pools警告とグリッチが発生した実例あり。原因はDXT1圧縮でのオーバーサブスクライブと判明し、「シーン内のVirtual Textureアセット数を減らす」ことで解決するとしている [14:38–14:47](transcriptのタイムスタンプはこの前後、動画内表記は13:04–14:13相当)
- **camera relative world positionの理由**: カメラに近いほど精度が一貫して高くなり、特に大規模シーンやオープンワールドで最適化に効く。Megascansマテリアルの World Position ノードで常に検討すべきベストプラクティスと明言 [14:38–15:01]

### 3. PCGでのset dressingツール自作という考え方 [17:03–18:04, 23:57–29:11]
- **Level InstanceをPCG化する意義**: 「Create PCG assets from level」でLevel InstanceをPCG Graph内に取り込めると、**手動set dressingと全く同じ感覚でPCG散布と組み合わせられる**。かつ「set dressingと並行して、または後からでも手続き的要素を積み増せる」という順序の柔軟性がメリットとして明言されている [17:47–18:04]
- **Subgraph化でメイングラフを整理する判断**: 散布ロジックのコア部分だけをSubgraphに切り出し、メイングラフは「データフローが見える状態」に保つ。再利用ツールとして育てる前提の設計判断 [22:56–23:09]
- **Blueprint変数経由でPCGパラメータを外部公開する設計**: PCG Graph自体を直接編集せず、Blueprint ActorのPublic変数（Density・Static Meshes配列等）をGet Actor Propertyで取得する構成にすることで、レベル内に配置した個々のインスタンスごとに密度やメッシュ構成を変えられる。これは「PCGツールをコンテンツチームが触れる形にパッケージする」考え方 [25:46–26:52]
- **命名の落とし穴**: 変数名にスペースを含めるとGet Actor PropertyとStatic Mesh Spawnerの間で名前不一致エラーが起きる。アンダースコア推奨、かつ「グラフパラメータ名をコピペしてattribute nameに貼る」ことでミスマッチを予防する運用を明言 [21:46(subgraph側の教訓と同根), 29:29–29:53]
- **重なり回避はBoundsでなくメッシュ実寸で**: 岩の重なり対策として、Bounds Modifier + Self-pruning（キューブ近似）よりも、Graph ParameterでStatic Mesh配列を渡しGet Bounds from Mesh Bounds Modifierを使う方法を「好み」として明示的に選択。**キューブ近似ではなく実際のメッシュ寸法で判定する**ことが重なり削減の質を上げると述べている [21:27–22:07]

### 4. プロファイリングは「GPU/CPUどちらが問題か当たりをつけてからチャンネルを絞る」 [30:04–30:11]
- Unreal Insightsは機能が多く初見では圧倒されやすいと認めた上で、**CPU boundでないと分かっているならCPUチャンネルをオフにしてGPUに絞る**、という効率化の判断を明示 [30:07–30:15]
- フレームタイムグラフでスパイクのあるフレームを選び、Namesのカラーコード（緑=1ms未満・オレンジ=1ms前後・赤=1ms超）で問題箇所に当たりをつける、という読み方の手順が明言されている [30:44–30:56, 31:19–31:28]（動画内の秒数表記のまま：赤=「over a second」等の字幕表現だが文脈上ミリ秒基準の話）
- **最適化の鉄則として明言**: 「profiling → before/afterの比較 → 繰り返す」というループそのものが最適化の鍵 [33:07–33:14]。既存ドクトリンの「ms で考える」と完全に一致する現場の言葉
- Project Settingsで全体変更する前に、**Post Process Volumeでのオーバーライドから着手**する判断（duplicate→古い方を無効化→新しい方で値をいじる、という非破壊的な調整の型）[31:56–32:03]。Bloom Convolution→Standard、GI/Lumen Reflectionの「最大値のままになっていた設定をデフォルトへ戻す」だけで見た目をほぼ変えずに大幅な性能改善が出たと明言 [32:14–32:37]

## 主要パラメータ・設定値の表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Height map | 使用チャンネル | Green（DXT1のR5G6B5で高品質側） | [01:57–02:12] |
| Landscape | ZScale | 100 | [03:59–04:05] |
| Landscape Nanite | Displacement Center | 0 | [03:52–03:56] |
| Landscape Nanite | Displacement Magnitude | 低め（ZScale=100を補う相対値。具体数値は字幕になし） | [04:05–04:08] |
| RVT構成 | 種類数 | 3種（BaseColor+Normal+Roughness／Displacement／World Height） | [04:46–04:55] |
| Virtual Texture Pool | Default size（応急処置） | 512 or 1024 | [11:20–11:23] |
| Spline Sampler | Interior Sample Spacing | 25 | [25:09–25:15] |
| Blueprint変数 | Density（初期値） | 25（Spline Samplerと合わせる） | [26:10–26:13] |
| Post Process | Bloom Method | Convolution → Standard に変更 | [32:14–32:18] |
| Post Process | GI / Lumen Reflection | 最大値 → デフォルトへ戻す | [32:22–32:31] |
| Viewport | Screen Percentage（TSR使用時） | 70%（+20FPS効果） | [33:39–33:49] |

## SCRAP BLITZ に活かせる部分

- **タイトルに反して「塹壕・土嚢・軍事施設固有の地形彫刻/小物配置」の教訓は本動画にゼロ**。廃工場・廃滑走路ヤードの set dressing センス面で直接参照できる内容は無く、`wNMHF3jGXtw_construction-site.md`（アンカー連鎖・小回転での整列崩し・decal汚しの3点）の方がその面では引き続き主要参照先
- **RVTブレンドの実装知識として直接使える**: 既存ドクトリンの「RVT 2 Volume構成」は既に蒸留済みだが、本動画は**実装手順そのもの**（通常テクスチャ変換の必須理由・Saturateクランプ必須・両側でのTangent Space変換・Noiseによるエッジブレイクアップ）を補完する。廃工場ヤードで瓦礫メッシュ・地面デブリをLandscapeへ馴染ませる作業に直接転用できる工程
- **PCG散布ツールの自作パターンは瓦礫・資材散布の効率化に転用可能**: 岩散布システム（Attribute Noise + Spatial Noise + Density Filter + Normal to Density + メッシュ実寸ベースのSelf-Pruning）は、廃工場ヤードの瓦礫・スクラップ・工具散乱を**手動set dressingの代わりに手続き的に量産**する際のテンプレートになる。特に「メッシュ実寸を使った重なり回避」は密集したデブリ配置で見た目の破綻（メッシュ同士のめり込み）を防ぐ具体的な解決策として使える
- **Blueprintパラメータ公開の設計は「レベルデザインツール構想」に直結**: `project_scrapblitz_level_editor_tool.md`で構想しているレベルデザインツールに対し、「PCG Graphの内部ロジックはSubgraphに隠し、BlueprintのPublic変数（Density・対象メッシュ配列）だけを外部公開する」という具体的な設計パターンがそのまま適用できる。ステージ担当が数値をいじるだけで散布密度・使用アセットを変えられるツール化の型
- **プロファイリングの型は既存ドクトリンの実演版として有用**: 「Post Process Volumeでのオーバーライドから着手」「CPU/GPUどちらの問題か当たりをつけてからチャンネルを絞る」「Region機能でbefore/after比較」は、既存の「ms で考える」原則を実務でどう回すかの具体例。stage-room等でのシーン最適化時にそのまま手順として使える

## 字幕だけでは取れなかったもの

- [00:39–01:04] Landscapeマテリアルグラフの具体的なノード構成・接続の視覚的レイアウト（「layers / adjustments / landscape layer blend」という要素名は分かるが、実際のノード配置・分岐は画面操作依存）
- [05:19–06:56] Set Material Attributes ノードの具体的なピン接続順序・グラフ全体のノードレイアウト（音声は「何を作ったか」の説明のみで、グラフの正確な配線は視覚情報）
- [11:37–11:53] Fixed poolのmin/max tile size設定における「必要な範囲」の具体的な数値例（「0にする」以外の推奨レンジは提示されず、字幕上は概念のみ）
- [18:39–19:34] Attribute Noise / Attribute Remap / Spatial Noiseの各パラメータの具体的な数値（「バランスを探る」「好みの設定にする」という試行錯誤の描写のみで実数値は不明）
- [19:12–20:47] Density Filter・Normal to Densityノードの閾値設定（画面のスライダー操作に依存し、字幕上は「play around with the settings」で終わっている）
