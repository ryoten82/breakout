# 学習ノート — NEW Mesh Painting in UE5.5 & 5.6 & 5.7! Stack Multiple Textures Like a Pro

- 動画: https://www.youtube.com/watch?v=ufE0QHwVP8w （27:54） / チャンネル: Arganian's Puzzle Box
- 学習日: 2026-07-04 / 抽出: 英語自動字幕(en-orig) → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/ufE0QHwVP8w.txt](../transcripts/ufE0QHwVP8w.txt)（`[MM:SS]` で原文照合可能）
- 表記ゆれ注記: transcript 内 "lurp" は文脈上すべて **Lerp** ノードの ASR 崩れ。"ORD"/"OAD"/"OD" は同一の **ORD (Occlusion/Roughness/Displacement) テクスチャ**を指す ASR 揺れ（本ノートでは ORD に統一表記し、原文引用箇所のみ併記）

## この機能は何か（既存ドクトリンとの違い）

UE5.5/5.6/5.7 で追加された **Mesh Paint（新方式）** は、**任意の Static Mesh 表面に対して複数テクスチャレイヤーを直接ペイントで描き込む**機能 [00:07–00:14]。仕組みは Virtual Texture への書き込みで、地形専用の Landscape Layer Blend とは別の仕組み・別の対象範囲。

- 既存ドクトリン記載の **Layer Blend Height** は Landscape（地形）専用のマテリアルブレンド
- 本機能は **Static Mesh 全般**（壁・ドア・建築面・任意のプロップ）に同種の「複数レイヤーを height/mask ベースで混ぜてペイント」を適用できる点が新規性 [00:24–00:27]
- UV に依存する（"UV sensitive"）ため、対象メッシュのクリーンな UV 展開が前提条件 [00:17–00:19]

### 従来手法との比較（なぜこれを使うか）

transcript から読み取れる優位性の根拠:

1. **Vertex Color Painting との比較** [03:17–03:28] — 頂点カラーペイントは頂点密度に依存する。動画内のシンプルな Plane（頂点 4 つ、面 2 つ）では「頂点が少なすぎてペイント不可能」と明言。高頂点密度メッシュでないと機能しない Vertex Paint に対し、Mesh Paint は Virtual Texture ベースなので**低ポリメッシュでも高解像度のペイントが可能**（後述の解像度設定で 256 等に上書きできる）[06:19–06:23]
2. **事前ベイクしたテクスチャとの比較**（暗黙）— 本編では明言されていないが、ワークフロー全体が「配置後にエディタ上で直接汚れ・劣化をブラシで描き込める」設計であり、Substance 等で事前合成した固定テクスチャと違い**配置後・その場でリアルタイムに調整・やり直しができる**（[06:56] shift+左クリックでレイヤー削除、[25:23] remove で全消去、を随時使い分けている点がこれを裏付ける）
3. 適用範囲は "terrain, walls, doors, and architectural surfaces in general" と明言 [00:23–00:27]

## セットアップ手順（Part 1: 基礎）

### 前提: プラグイン + プロジェクト設定 [01:33–02:03]
1. Plugins フォルダで **Mesh Paint プラグインを有効化**
2. プラグイン有効化の**前に** Project Settings で `virtual texture` を検索し、**Virtual Texture Support を有効化**（この順序が重要と明言 [01:41–01:52]）
3. どちらも変更後は**エンジン再起動**が必要
4. 再起動後、モードメニューに **Mesh Paint** の新項目が追加される [02:04–02:08]

### メッシュ準備 [02:11–02:53]
- Basic Shapes の Plane はデフォルトの Engine 内蔵メッシュなので、そのまま編集せず**右クリック→コピー→Content Browser で Ctrl+V** して独自アセット化してから使う [02:26–02:32]
- 置き換えは元アクターのスロットに新メッシュをドラッグ、または矢印ボタンで差し替え

### マテリアルの基本ノード構成（2色/2チャンネルの最小構成）[02:56–05:21]

新規マテリアルを作成し、右クリックで `mesh paint` と検索すると専用ノードが 2 つ利用可能:
- **Mesh Paint Texture Object**
- **Mesh Paint Texture Replace**（transcript 上 "mesh pane texture replace" と表記ゆれ [04:03–04:09]）

構成手順:
1. Lerp ノードを追加、A/B にそれぞれ任意の2色（動画では indigo と red）を接続 [04:14–04:32]
2. Texture Sample を新規追加 → これが「Virtual Texture がペイント情報を書き込む先」になる [04:45–04:52]
3. Texture Sample → Mesh Paint Texture Object へ接続。Mesh Paint Texture Object の default 値には **0** を明示的に指定する必要がある [04:57–05:01]
4. そこから Component Mask ノードを追加し、**赤チャンネルのみ**を使う設定にして Lerp の Alpha に接続 [05:11–05:19]
5. Lerp の結果を Base Color に接続、Apply

### ペイント操作 [05:24–06:57]
1. Plane にマテリアルを割り当てた状態で、モードを **Mesh Painting** に切り替え
2. 対象メッシュ選択 → **Texture Color** を選び **Add** ボタンを押す（レイヤー追加）
3. **Paint** ボタンを押すと Red/Green/Blue/Alpha のチャンネル別ペイントが可能になる
4. 赤チャンネルをアクティブにして描画すると、Lerp の Alpha 経由でマテリアルの色が実際に変化する [05:51–05:56]
5. **左クリック = ペイント／Shift+左クリック = 直前に作成したレイヤーの削除** [06:54–06:57]

### 解像度の問題と対処 [06:15–06:52]
- デフォルトのままだとペイントの解像度が非常に低い（"very low"）[06:15–06:17]
- 対象メッシュ選択時、詳細パネルに **Mesh Painting** カテゴリがあり、生成される Texture が Virtual Texture であることが分かる
- **Override Mesh Paint Texture Resolution** に `256` 等の値を設定すると改善 [06:33–06:36]
- ただし解像度を上げても**既存のペイント結果には反映されない**ため、Mesh Paint モードの **Fix** ボタンを押して解像度を適用し直す必要がある [06:43–06:48]

### 確認用ツール [06:57–07:04]
- **Color View Mode** を **RGB Channels** に切り替えると、各チャンネルに何がペイントされているか個別に確認可能（赤チャンネル単体・緑チャンネル単体なども見られる）

Part 1（基礎）はここまでで完結。実運用では上記の2色を実テクスチャに差し替えるだけで、同じ仕組みが任意のスロット数で使える、と明言 [07:15–07:29]。

## 高度な構成（Part 2: リアルなブレンド + Displacement）

### 使用テクスチャの前提知識 [08:01–09:33]
- Quixel Bridge 経由で取得した高品質テクスチャ（動画では Curated Stone Facade と Cracked Mud、High quality/4K）を使用 [08:22–08:43]
- **Quixel Bridge 由来のテクスチャは Diffuse / Normal / ORD の3枚構成**になっている点が重要 [08:54–09:00]
  - ORD = Occlusion（R チャンネル）/ Roughness（G チャンネル）/ **Displacement（B チャンネル）** [09:00–09:31]
  - **Fab から取得した場合はこの構成にならない** ため、別途 Texture Graph チュートリアルで自作 ORD テクスチャを組む必要があると明言 [09:04–09:17]（※本ノートは transcript に無い他動画の内容なので詳細不明。参照先として記録のみ）

### タイリング制御 [09:43–10:47]
- 各テクスチャに Texture Coordinate → Multiply → Scalar Parameter（`UV Tile`, デフォルト値 1）を接続し、UV 全体のタイリングを一括制御する定型パターン [09:46–10:47]
- これはドクトリンにある「TexCoord→Multiply→Scalar "tiling"」の定型と**完全一致**（Landscape 材だけでなく Static Mesh 材でも同一パターンが使われている点が確認できる）

### Named Reroute によるノード整理 [10:53–11:14]
- RGB から Base Color 用の Named Reroute を作り `concrete base` のように命名 → 以降どこからでも同名で検索して呼び出せる（動画中で "displacement" と打つだけで該当 reroute を呼び出す使い方を実演 [14:10–14:14]）
- Normal・ORD についても同様の reroute を作成（この手順は「省略するので各自やってほしい」と明言 [11:14–11:32]）

### Displacement 制御ノード構成 [11:32–13:26]
ORD の Blue チャンネル（Displacement）から以下を構築:
1. Blue チャンネル → **Add ノード** → **One Minus**（反転）
2. Lerp ノードの B スロットへ、One Minus 前の Add 結果を接続
3. Lerp 結果 → 別の Add ノード → **Saturate** → **S-Curve ノード**（Displacement の見た目をさらに調整可能にする）→ 最終的に `concrete displacement` という reroute 名で出力
4. パラメータ化した4つのスカラー（すべてこの経路に対応）:
   - **Displacement Center**（デフォルト 0）— displacement の中心点
   - **Displacement Intensity**（デフォルト 1）— displacement の強度
   - **Displacement Offset**（デフォルト 0.5）— Add ノードの一つに接続
   - **Displacement S-Curve**（デフォルト 1）— S-Curve の Power 入力に接続、カーブの効き方を調整

同じ一式を Mud テクスチャにも複製して作成（動画では「このステップは各自やってほしいので省略する」と明言 [13:39–13:46]）。

### Height Lerp によるテクスチャブレンド [13:48–16:53]
Base Color・Normal・Roughness それぞれに対して同一構成を3回繰り返す:
1. **Height Lerp（2 Height Maps 版）** ノードを検索して追加 [13:57–14:01]
2. Height 1 = concrete displacement reroute、Height 2 = mud displacement reroute を接続 [14:18–14:24]
3. スカラーパラメータ2つ:
   - **Transition**（デフォルト 0.5）
   - **Contrast**（デフォルト 3）
4. Diffuse スロットには Base Color の場合 concrete base color / mud base color を接続。Roughness・Normal では同じノード構成のまま Diffuse に該当テクスチャを挿すだけで流用できる（Height Map 側の入力は使い回し、Displacement 出力の再生成は不要と明言 [15:58–16:05]）
5. Height Lerp の出力は2系統取り出せる: ①ブレンド後の Base Color（reroute 名 "mud blend"）②ブレンド後の Height Map（reroute 名 "displacement mud blend"）[15:19–15:53]

Height Lerp が Landscape Layer Blend の height ベース手法と同種の発想であることがここで明確。**Static Mesh でも同じ height ベースブレンドが使える**というのが本動画のもう一つの新規性。

### Mesh Paint 用の3チャンネルブレンド構成 [16:57–19:07]
ここが Part 1 の最小構成から本番用への拡張:
1. Component Mask ノードを**2つ複製**し、既存の赤チャンネル用に加えて**緑チャンネル用・青チャンネル用**を作成。3つとも同じ Mesh Paint 用 Texture Sample から分岐 [17:04–17:26]
2. **Lerp を3段連結**する構成:
   - Lerp①: A = concrete base color、B = mud base color、Alpha = 緑チャンネル
   - Lerp②: A = concrete base color、B = Lerp①の mud blend 出力（＝height ベースのブレンド結果）、Alpha = 緑チャンネル ※動画内で講師が一度配線を誤り [18:44–18:53] で訂正済み
   - Lerp③（最終段）: A = Lerp②の出力、B = concrete base color、Alpha = **青チャンネル**
3. 最終 Lerp の出力を Base Color に接続、Apply

チャンネルごとの役割が3値化される（詳細は下記「チャンネルの意味」参照）。

### Displacement を実際に表示させるための追加設定 [21:20–22:32]
Height Lerp や Displacement ノードを組んだだけでは画面に反映されない。以下2つが**両方**必要:
1. マテリアル側で **Tessellation を有効化**しないと Displacement スロット自体が使えない [21:54–22:01]
2. 対象 Static Mesh 側で **Enable Nanite Support** を有効化＋ Apply Changes しないと、Tessellation を有効にしても Displacement が反映されない [22:13–22:28]

この2点は「新方式 Mesh Paint」固有の話ではなく UE の Nanite Displacement 全般の要件だが、この動画のワークフローの中でも必須手順として明言されている。

### スケールと見た目の調整 [22:52–24:53]
- Plane 自体のスケールを (10, 10, 1) 程度に拡大し、ジオメトリに「息をする余地」を与える（displacement のディテールが出る面積を確保する目的）[22:57–23:10]
- Displacement Intensity を 5 程度まで上げてもまだ狙った見た目にならない場合があり、**Displacement Curve を 1** にすると突出感が出る、**Displacement Offset は 0.5 が基本**、という試行錯誤が実演されている [23:15–23:38]
- ノードをコピーして使い回すと**パラメータ名がずれて重複パラメータが増える罠**があるため、命名規則を統一して整理し直す作業が必要になる、という実務上の注意点 [23:41–24:12]

### 完成後の Material Instance でのチャンネルの意味 [24:53–27:19]

3チャンネル構成が最終的にどう機能するかの実演:

| チャンネル | 効果 |
|---|---|
| **赤** | Full mud（他のチャンネルに上書きされていない場所限定）。最小優先度（Lerp の一番最初の段のため、他のどのチャンネルにも上書きされる）[25:02–25:06][27:05–27:08] |
| **緑** | Mud と Concrete の**ブレンド**を追加。ブレンドの度合いは `Transition` パラメータで制御（0 = mud 無し、上げていくと mud が「crevice（隙間）から染み出す」ように増え、最終的に concrete を完全に覆う）[25:41–26:04] |
| **青** | 常に最優先で上書きする（Lerp 連鎖の最終段のため）。青をペイントすると赤・緑の効果を完全に消去できる [26:30–26:36][27:00–27:02] |

- 実用上の目安値: **Transition = 0.6** 程度が「ちょうど良い」と明言 [26:07–26:09]
- **Contrast** パラメータでブレンドの境界を「厚く/薄く」調整できる（値は本編内で具体的数値の言及なし）[26:09–26:13]
- Shift+左クリックで直前のチャンネルのレイヤーのみ削除、**Remove ボタンで全消去**して初期状態（concrete base のみ）に戻せる [25:24–25:31]
- 最終確認は Color View Mode を RGB に切り替えて、ペイント結果とチャンネル別内訳を随時見比べる [26:41–26:47]

### Lerp 連鎖の優先順位ロジック（動画全体を貫く判断基準）[27:00–27:19]
> 「青チャンネルは常に他を上書きする（Lerp 連鎖の最後だから）。赤チャンネルは最も影響が小さい（Lerp 連鎖の最初だから）」

これは実装した Lerp の**接続順そのものが優先順位を決める**という一般則で、チャンネル数を増やす場合にも当てはまる設計原理。

## SCRAP BLITZ に活かせる部分

L_Stage01（廃工場・廃滑走路ヤード）は配置済みプロップの汚し・劣化表現が課題になっている。この Mesh Paint 機能は以下の点で直接的に効く可能性が高い:

1. **配置後の直接汚し** — 現状の decal 3種（漏水シミ・埃堆積・路面ライン）はメッシュに対して後付けの平面デカールだが、Mesh Paint は**メッシュ表面そのものに複数テクスチャを height/mask ベースで焼き込める**。配置済みの資材・工具・機体パーツ（ドクトリンの「anchor 連鎖」小物群）に対し、個体ごとに錆・泥・油汚れの**分布をブラシで直接描き分けられる**（同型メッシュを複製した際の「同じ場所に同じ汚れ」問題を回避できる）
2. **低頂点メッシュでも高解像度ペイントが可能** [03:17–03:28][06:19–06:23] — Vertex Color Paint では頂点密度が要るため、シンプルな板状・箱状プロップ（コンテナ、パネル等）には不向きだったが、Virtual Texture ベースの Mesh Paint なら低ポリのままでも解像度指定（256等）でディテールを出せる。プロップ側のポリゴン予算を増やさずに劣化表現の解像度だけ上げられる
3. **height ベースブレンドは既存ドクトリンの「Layer Blend Height」思想の Static Mesh 版** — ドクトリンにある「weight blend のべったり感を height 情報で解消（ひび割れ・劣化表現に直結）」という原則が、Landscape だけでなく**個々のプロップにも同じ発想で適用できる**ことが分かった。廃滑走路のひび割れ・剥離アスファルト表現などにも応用余地がある
4. **UV クリーン前提という制約** [00:17–00:19] — model-room で作るプロップの UV 展開品質がそのままこの技法の適用可否に直結する。今後 model-room でプロップを作る際、Mesh Paint 適用候補（汚し表現をしたい大型プロップ）は UV 展開を丁寧にする優先度を上げる価値がある
5. **注意点（コスト面）** — Virtual Texture 書き込み型のため、対象プロップ数が増えるとメモリ・VT ページのコストが乗る可能性がある（動画内で言及なし、コスト面は要別途検証）。全プロップに使うのではなく、**プレイヤーの目に留まりやすい主要プロップに絞る**運用が妥当と考えられる（※推定）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [09:04–09:17] Fab 由来テクスチャから自作 ORD を組む具体的な Texture Graph の中身（別動画への参照のみで本編に手順なし）
- [23:41–24:12] ノード複製時のパラメータ名重複を実際にどう統合したか（画面操作のみで音声説明が曖昧）
- Contrast パラメータの具体的な効果値（数値言及なし、視覚的に「厚み/薄さ」としか説明されていない）
