# 学習ノート — Lights & Shadows: Medieval Game Environment extended tutorial

- 動画: https://www.youtube.com/watch?v=bkztcwD9UJE （12:21 / Epic Games 公式）
- 学習日: 2026-07-03 / 抽出: 英語手動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/bkztcwD9UJE.txt](../transcripts/bkztcwD9UJE.txt)（`[MM:SS]` で原文照合可能）
- 講師: Matt Oztalay（Epic Games Developer Relations Technical Artist）。Quixel Medieval Game Environment のパフォーマンス最適化シリーズの一本、**Lights と Shadows 編**

## 全体の流れ

前回動画（Unreal Insights でベンチマーク・ボトルネック特定）を受け、今回はキャプチャで目立った **Lights** と **ShadowDepths** の 2 項目を深掘りする回 [00:32–00:59]。

1. **診断ツールで犯人を特定** [01:14–02:39] — GPU Profiler で「どのライトが重いか」を可視化
2. **ライトが重くなる 5 パターンと対処** [02:41–05:03] — 実例ベースで 5 つの原因と修正
3. **Directional Light の影が重い問題** [05:29–06:08] — 「Dynamic Shadow Distance を伸ばしたら FPS 15 に落ちた」という失敗シナリオの提示
4. **Cascaded Shadow Maps の仕組みと限界** [06:10–07:30] — なぜ伸ばすと近景がボケるのか
5. **Distance Field Shadows** [07:35–09:14] — 遠景を安く済ませる代替手法とトレードオフ
6. **Far Cascade** [09:14–10:14] — さらに遠い山だけを opt-in で影落とし
7. **まとめとフォリッジの後日談** [10:15–11:35, 11:41–11:35] — 3手法の使い分け指針 + Foliage の Distance Field Shadow 誤爆

## ライティング固有の診断手法

### GPU Profiler でライトのボトルネックを特定する [01:14–02:39]

- `stat gpu` コンソールコマンド（チルダキーでコンソールを開く）でまず概況を見る。カテゴリ別（Lights 等）の描画コストの overview を取れるのが利点 [01:20–01:44]
- より詳細に見たい時は **GPU Profiler**（`Ctrl+Shift+,` または console command `profile GPU`）[01:52–01:57]。色分けされたグラフで「フレーム描画に何をしたか」の内訳を可視化する軽量ツール
- 使い分けの判断基準: RenderDoc のような重量級ツールに入る前に、まず GPU Profiler で当たりを付ける [02:03–02:08]。「ここだけで必要な情報が全部わかることもある」
- 手順: Scene 値を展開 → Lights を展開 → shadow casting / non-shadow casting の dynamic light 別に表示 → **ShadowedLights セクションをさらに展開すると、ライト単位で「このライトが影の描画に何秒かかったか」が出る** [02:17–02:34]。ライトをダブルクリックするとシーン内で選択できる [02:36–02:39]
  - ※推定: 「秒」という単位は transcript に明記されていないが、文脈上 timing（ms/us オーダー）の相対比較と解釈するのが自然

**判断基準として重要な点**: 「shadow-casting なライトの方が non-shadow-casting より高コスト」という前提を先に共有した上で [02:25–02:28]、ShadowedLights の内訳で個別ライトを特定する、という**絞り込みの手順そのもの**が今回の核。闇雲にライトのパラメータをいじるのではなく、まずプロファイラで犯人を特定してから直す、という流れ。

## ライトが重くなる 5 つの原因と対処 [02:41–05:03]

実際のシーンで見つかった実例ベース。**「発見 → なぜ重いか特定 → 最小限の修正」という一貫したパターン**で、闇雲な最適化ではなく個別ケースごとに適切な対処を選んでいるのが学びどころ。

1. **鍛冶場（forge）の point light** [02:45–02:57]
   - 影を落としているが、forge の構造で occlude されて近くでしか効果が見えない
   - 対処: **Max Draw Distance** を設定（一定距離を超えたら計算自体をしない）+ **Max Distance Fade Range** を設定（急に on/off するのではなく近づくにつれ徐々に強くなるようにする）
   - 判断基準: 「見えないところに払うコストは削る」が、切り替わりが唐突だと違和感になるので Fade Range で滑らかにする

2. **エンドシーケンス演出用ライト、Intensity が 0 なのに常時レンダリングされていた** [03:08–03:26]
   - 見た目には出ていないのに描画コストだけ払っていた、という典型的な見落とし
   - 対処: Sequencer で当該ライトに **Visibility Track** を追加し、光量を上げ始める直前に visible にする。かつライトのデフォルト状態自体を **Visibility=Off, Hidden In-Game=On** に設定
   - 判断基準: 「今は使っていないが後で光る」演出ライトは、常時計算させず必要な瞬間だけ visible にする

3. **廃墟の建物を演出する spotlight、Attenuation Radius が過大** [03:29–03:54]
   - 半径が広すぎて、村の中心から木々の向こう側まで影の解決対象になっていた
   - 対処: Attenuation Radius を縮小し、Fade values も設定
   - 判断基準: 「その光で本当に照らしたい範囲」まで半径を絞る。演出意図（このスポットライトで廃墟を強調したい）自体は変えず、範囲だけ最適化する

4. **家の裏の控えめな fill light、半径は既に小さいのに shadow casting が有効だった** [03:54–04:10]
   - 半径内に影を落とすべきものがほとんど無いのに shadow を計算していた
   - 対処: shadow casting を単純にオフ
   - 判断基準: 半径やFadeは既に適正でも、「そもそも影が要るか」は別軸でチェックする

5. **ランタン Blueprint の Light Function が Intensity のちらつきだけに使われていた** [04:12–04:47]
   - Light Function は自動的にそのライトを shadow-casting かつ dynamic 扱いにするため、特に高コスト [04:23–04:28]
   - このランタンは風で揺れる演出のため既に Tick している Blueprint だったので、代わりに **Timeline でライトの Intensity をランダムに変調**してキャンドルのちらつきを表現するよう変更 [04:37–04:47]
   - Fade Distances も設定 [04:47–04:52]
   - 判断基準: Light Function は「本当に空間的なパターンが要る場合」だけに使う。単なる強度のちらつきなら Timeline 駆動で十分安く実現できる

### 全体的な締めの作業 [04:52–05:15]
上記 5 パターンを踏まえ、シーン内の**全ライトを見直し**: Fade Distance と適切な Attenuation Radius を設定 / Light Function を効果的に使っているか確認（例: 井戸のライトは caustic effect 用途で Attenuation Radius も低いので許容）[05:05–05:10] / 本当に必要なライトだけ shadow casting にする。

「これらは絶対のルールではなく、プロジェクトごとの事情を考慮すべき」と明言 [05:15–05:26]。

## Directional Light の影 — Cascaded Shadow Maps の仕組みと限界 [05:29–07:30]

### 失敗シナリオの提示 [05:29–06:08]
広大なオープンワールドシーンを作っていて、山の頂上に登ってみると遠景の影が唐突に途切れる（"hard stop, wears off in the distance"）。素朴な対処として **Directional Light の Dynamic Shadow Distance を上げる**と、遠くの影は出るようになるが:
- FPS が 15 まで落ちる
- それでもまだ谷の向こうの山まで届いていない
- **近くの影がボケる（blurry）**

という「一つ直すと別が壊れる」トレードオフが起きる。

### 仕組み: Cascading Shadow Maps [06:10–06:38]
- Directional Light による dynamic shadow は Cascading Shadow Maps を使う
- カメラ前方のシーンを、Directional Light のサイズで制御される複数の **Cascade** に分割し、各 Cascade について Directional Light 視点からの depth map を描画して shadow/non-shadow を判定する
- サンプルシーンの設定値: **4 Cascades、Dynamic Shadow Distance = 10,000、Distribution Exponent = 1** → 各 Cascade はおよそ **2,500 units** をカバーする計算 [06:32–06:38]

### なぜ Dynamic Shadow Distance を伸ばすと近景がボケるのか [06:38–07:00]
- Cascade 数を変えずに Dynamic Shadow Distance だけ伸ばすと、同じ数の Cascade でより広い範囲をカバーすることになる → **Texel Density（影のテクセル密度）が下がる** → 近くの木の影がボケる
- 「Texel Density が下がる」という表現がそのまま「なぜボケるか」の答え。Shadow Map は有限の解像度を Cascade に配分する仕組みなので、同じ Cascade 数で範囲を広げれば密度は必ず落ちる、というトレードオフの構造そのものが核心

### 対処案とそれぞれの限界 [07:00–07:33]
1. **Cascade 数を増やす** → 同じ距離をより多くの Cascade でカバーし直せば Texel Density は戻る。ただし**メモリ増加とレンダリング時間増加**という代償 [07:00–07:14]
2. **Distribution Exponent を調整**してカメラに近い影の解像度を優先配分する → それでも遠くまで dynamic shadow を描画し続けている点は変わらない。動画内の例では、木が風で揺れる影の細かい動きや、葉一枚一枚の影のちらつきまでは結局見えないのに、それでも描画コストを払っている、という無駄が残る [07:14–07:33]

判断基準: 「見えないディテールのために dynamic shadow のコストを払い続けているなら、別の手法に切り替えるべきサイン」[07:30–07:33]

## Distance Field Shadows — 遠景を安くする代替手法 [07:35–09:14]

### 何をしているか [07:35–07:48]
静的ジオメトリの「事前計算された数学的表現（pre-computed mathematical representation）」を使って影を落とす手法。ポリゴンやマテリアルではなく Distance Field 表現から影を計算するため、遠距離の影を安く済ませられる。

### トレードオフ 2 点 [07:48–08:16]
1. **World Position Offset エフェクトが反映されない** — Mesh の Distance Field はランタイムで計算しないため。ただし Distance Field Shadows を使うような距離では、この影響は無視できるレベル [07:51–08:03]
2. **Static Mesh ごとに追加のメモリオーバーヘッドが乗る** — Distance Field 表現を持たせるため。**低解像度の Distance Field なら無視できる程度だが、精細さを上げるほど指数関数的にコストが増える** [08:03–08:16]
   - ※このオーバーヘッドの具体的な数値（MB 等）は transcript に無い。「低解像度なら軽い／精細さに応じて指数関数的に重くなる」という定性的トレードオフのみ言及

### 有効化手順 [08:16–08:43]
1. Project Settings で **Generate Mesh Distance Field = True** に設定 [08:16–08:20]
2. Directional Light 側で **Distance Field Shadows を有効化** [08:40–08:43]

### 実プロジェクトでの適用手順（距離の決め方が肝） [08:27–09:01]
1. まず **Dynamic Shadow Distance をカメラのすぐ近くまで縮める**（Cascaded Shadow Map で描画する Actor 数を絞ってコストを取り戻すため）[08:27–08:40]
2. Distance Field Shadows は「Dynamic Shadow Distance と Distance Field Shadow Distance の間のギャップを埋める」ため、その **Distance Field Shadow Distance の値は「後列の木がここにある」という距離まで**に設定 [08:43–08:53]
3. 決め方は感覚的な調整: 「影が欲しい場所に見え始めるところまで、それより一歩も先までではなく、距離を少しずつ上げていっただけ」[08:53–09:01]
   - 判断基準として明言されているのは「必要な範囲ぎりぎりまで」という**攻めた調整の姿勢**。過剰なマージンを持たせない

この設定は**遠くの山には届かない**（山は他のオブジェクトから離れすぎているため Distance Field Shadows で繋ぐ対象にしない設計判断）。しかも山と手前の間の影自体は木々のラインに隠れて見えないので問題にならない [09:01–09:14]。

## Far Cascade — さらに遠い大型構造物専用の opt-in 影 [09:14–10:14]

### 何のためにあるか [09:14–09:29]
Distance Field Shadows と Far Cascade Distance の間をカバーする「追加の Cascading Shadow Map」。デフォルトでは Far Cascade Distance の値は非常に大きく設定されている。

### 決定的な違い: opt-out vs opt-in [09:29–09:40]
- 通常の dynamic shadow は **opt-out**（Actor 側で明示的に shadow をオフにしない限り勝手に影を落とす）
- Far Cascade は **opt-in**（「どの Actor が Far Shadow を落とすか」を明示的に選択する必要がある）

この非対称性がパフォーマンス確保の要。遠距離の Cascade は「デフォルトで全部描画」ではなく「選んだものだけ描画」にすることで、山のような一部の巨大構造物だけに絞り込める。

### 設定手順 [09:43–10:01]
1. Directional Light で **Number of Far Cascades = 1** に設定 [09:43–09:47]
2. 「遠くの山同士がお互いに影を落とし合ってほしい」という意図のもと、対象の Actor を選択して **Far Shadow checkbox** をチェック [09:47–09:56]
3. **Far Shadow Distance** を、山々がちゃんと影を落とすところまでチューニング。デフォルトより少し遠くまで押し出す結果になったが、他の代替手段よりは大幅に安い [09:56–10:08]
4. 調整方法は Distance Field Shadows と同じ「じわじわ距離を上げて欲しい影が出るところで止める」[10:08–10:14]

## 3 手法の使い分けまとめ [10:15–10:40]

transcript内で明言されているサマリーがそのまま判断基準として使える:

- **Cascading Shadow Maps（通常）**: カメラに近い、ディテールが細かい／動きのある影に使うのが最適
- **Distance Field Shadows**: メモリオーバーヘッドを許容できるなら、dynamic shadow が描画される距離を伸ばせる。ただしディテールレベルは低下する
- **Far Cascade**: 大型構造物に絞って、妥当な距離で確実に dynamic shadow を落とさせたい時に使う

「これらもライティング同様、プロジェクトの事情に応じた選択肢の一つに過ぎない」と再度明言 [10:40–10:48]。

## 後日談: Foliage が Distance Field Shadows を誤って落としていた話 [10:53–11:28]

- シャドウパフォーマンスを損ねていた最後の要因として、**小さい Foliage（地面カバー的な小物）が Distance Field Shadows を落としていた**ことが判明。シーンに何も寄与しないのに影計算のコストだけ払っていた [10:53–11:10]
- 対処手順: Content Browser で Foliage でフィルタ → 全選択 → 右クリック → Asset Actions → **Bulk Edit via Property Matrix** → **Affect Distance Field Lighting** プロパティをピン留めして一括アンチェック [11:10–11:24]
- 「次の動画で Foliage の他の最適化も扱う」と予告 [11:28–11:35]

判断基準: Distance Field Shadows を有効化すると、Directional Light 側の設定だけでなく **個々の Static Mesh / Foliage の Affect Distance Field Lighting フラグも影響範囲になる**ため、大量生成される Foliage 系は一括チェックが必要になる、という見落としやすいポイント。

## SCRAP BLITZ に活かせる部分

L_Stage01（廃工場・廃滑走路ヤード）はまさに「広い屋外＋遠景の建造物・瓦礫」という、この動画が扱う「遠くまで影を伸ばしたい」問題そのものの構図。

1. **診断してから触る** [01:14–02:39] — L_Stage01 のライティングを弄る前に、まず GPU Profiler（`Ctrl+Shift+,` or `profile GPU`）で「実際にどのライトが重いか」を確認する。感覚で疑わしいライトを直すのではなく、ShadowedLights の内訳で個別に特定してから直す、という順序をそのまま踏襲できる
2. **5 パターンのチェックリストとしてそのまま流用可能** [02:41–05:03] — Max Draw Distance/Fade Range 未設定・Intensity 0 なのに常時レンダー・Attenuation Radius 過大・不要な shadow casting・Light Function の誤用。L_Stage01 に置いた工場内 point light や外の spotlight を、このチェックリストで一通り確認する価値がある
3. **遠景の滑走路・格納庫・山際の建物には Far Cascade が刺さる** [09:14–10:14] — 廃滑走路ヤードのような開けた地形で「遠くの建造物にも影を落としたいが Dynamic Shadow Distance は伸ばしたくない」場合、Far Cascade の opt-in 方式（対象 Actor だけ Far Shadow checkbox）が、通常の Cascade を伸ばすより安価。ちょうど今回のセッションで進めている本筋（滑走路 decal・遠景構造物）と地続きの最適化候補
4. **Distance Field Shadows は「近くを攻めて、ギャップだけ埋める」設計** [08:27–09:01] — Dynamic Shadow Distance を思い切って近くまで絞ってから Distance Field Shadow Distance で隙間を埋める、という手順自体が「まず削ってから足りない分だけ補う」という最適化の型として応用できる
5. **Foliage の Affect Distance Field Lighting 一括オフ** [11:10–11:24] — L_Stage01 で瓦礫・雑草・小物 Foliage を大量配置する予定があるなら、最初から Bulk Edit via Property Matrix で Affect Distance Field Lighting をオフにしておくと、後からの手戻りを防げる
6. **Light Function は「本当に空間パターンが要る時だけ」** [04:23–04:47] — 井戸の caustic のような明確な空間パターン以外（単なるちらつき等）は Timeline 駆動に倒す、という判断基準はランタン・非常灯等の演出照明にそのまま使える
