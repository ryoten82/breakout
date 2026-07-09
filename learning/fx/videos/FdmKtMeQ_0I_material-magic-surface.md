# 学習ノート — UE5 Material Magic Surface

- ソース: https://www.youtube.com/watch?v=FdmKtMeQ_0I （7:24）
- 視聴日: 2026-07-09 / 字幕種別: **英語手動字幕**（"Kind: captions" のみでauto-generated表記なし。ロールングキャプション形式のためパーサーは自動字幕と同じ重複除去処理を使用）
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\FdmKtMeQ_0I_clean.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: なし（球体マテリアルのみで完結する「ネビュラ表面」演出は本チャンネル内でも本ノートが初出）

## 概要

球体（Sphere）に貼るだけで「星雲（nebula）」風の魔法球表面を作る、マテリアル単体完結のチュートリアル。Niagara側は最小限（この球をパーティクルメッシュとして使う想定でDynamic Material Parameterだけ接続）。World Position Offset（WPO）による球の回転・移動と、Emissive Colorによる星・煙・グリッド模様の3層合成で構成される。

## 技術詳細

### 1. World Position Offset 側 — Rotate About Axisによる球体の擬似回転・浮遊

- ベース関数は **Rotate About Axis**（マテリアル組み込みノード）。引数はObject Position・World Positionの他に「回転軸（Normalized Rotation Axis）」「回転角（Rotation Angle）」
- 回転軸をTime駆動のランダム値で作る手順:
  1. Time（およびNiagara接続用にDynamic Material Parameterでspeed/offsetを外部化）を **Sine + Constant Bias Scale Clamp** に通し、出力を0〜1でループさせる
  2. Sineの周期（Period）を意図的に遅くして、動きをゆっくりに調整
  3. 2つの「ランダム軸（自由に設定した定数ベクトル）」をこのSine値で**Lerp**してブレンド
  4. さらに別のSine（周期を変えたもの）でもう一段Lerpし、2軸ブレンドより動きに変化を出す
- 回転角（Rotation Angle）はさらに単純: Sine出力に**Float定数を乗算**するだけ。例では×0.1で36°相当の周期になる、と説明
- **Position Offset**は上記のランダム軸ベクトルにそのままFloat定数を乗算するだけで、X/Y/Z方向へのオフセット（浮遊移動）を追加。Rotate About Axis（回転）とPosition Offset（並進）は独立した加算要素で、片方だけ繋ぐとその効果だけをプレビューで切り分けて確認できる、と実演される

### 2. Emissive Color側 — 3層合成（星点+煙+表面テクスチャ）

**(a) 星点レイヤー**
- 単純な点状テクスチャに **Texture Bombing**（マテリアル関数）を適用し、タイル反復を崩してランダム配置に見せる
- UV供給は **Screen Position** を使用（TexCoordではなく）。動画内で明言される違い: TexCoordはメッシュのUVに沿って模様が移動するのに対し、Screen Positionは画面座標に対して直線的に移動する。用途に応じてどちらでも良いとしつつ、球のUVに沿わせたくない場合はScreen Positionを選ぶ、という使い分けが語られる
- Time由来のランダムUVオフセット＋Panner（tiling値は0.2を例示、0.1でまばら/0.3で密に調整可）で星の瞬き・流れを表現

**(b) 煙レイヤー**
- Base Color × Particle Color × ノイズマスクの3項乗算が基本形
- ノイズマスクはUE標準同梱のスモークテクスチャを使用し、パン手法として **Four-Way Chaos**（マテリアル関数、複数方向へのパンを合成しランダム性を高める）を紹介。単純なPannerでも代替可、と補足
- さらに **Fresnel**（Exponent=1、Base Reflect Fraction=0）を乗算し、球のエッジ側だけに煙効果を集中させ中心部は目立たせない
- 星レイヤー＋煙レイヤーを加算（Add）して「表面のネビュラ」の基本形が完成

**(c) 差し替え可能な表面テクスチャレイヤー**
- ノイズマスク × 任意テクスチャ（例ではグリッド柄）で模様を弱め、必要なら×0.5等で強度調整しClamp(0,1)
- ここにも別途Fresnelを乗算しエッジのみに効果を限定
- 全レイヤーを加算 → Particle Colorを乗算してLDR値をHDR相当のレンジに引き上げ（LDR value → HDR tint という言い回し）
- 最後にFresnelとLerpで「中心ほど明るく、エッジほど暗い（色が濃い）」というグラデーションを作り、全体のEmissiveを完成させる
- 応用として、表面テクスチャに任意の色（赤・ピンク等）を乗算するだけで配色バリエーションを量産できる、Distortion効果の追加も可能、と締められる

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` には「UV制御は1関数に集約」「グロー勾配」等の記述はあるが、以下は未収録で新規:

- **Texture Bombingによるタイル崩し**: doctrineのUV制御節はPanner/CustomRotatorの集約パターンのみで、タイル反復を崩す専用マテリアル関数（Texture Bombing）への言及なし。星点・地形テクスチャ等「均一に並ぶと不自然な模様」全般に使える手法として新規
- **Screen Position vs TexCoordの使い分け明言**: UVをメッシュに沿わせたくない場合の代替UVソースとしてScreen Positionが明示的に説明されている。既存ノートはPanner/CustomRotatorがTexCoordベースである前提が多く、この選択軸自体が新規
- **Four-Way Chaos関数**: 複数方向パンを1関数で合成する組み込みマテリアル関数。doctrineの「Additive2系統並列（Offset違いのUV制御関数をMultiply合成）で多層パン」は手動構成の話で、Four-Way Chaosは同種の効果をUE標準関数1つで得る代替
- **Rotate About Axisを使ったメッシュ全体の擬似回転WPO**: doctrineのWPO関連はキャラのSkeletalMeshLocation追従や破片変位（Vertex Normal WS×Noise）が中心で、剛体的な「メッシュ全体を軸回転させる」パターンは未収録。2つのランダム軸をSineでLerpし、さらに別周期のSineで多段Lerpするという「ランダムさを段階的に足す」構成は、doctrineの「カーブは全キーAuto、出現はオーバーシュート」とは異なる乱数演出パターン

## SCRAP BLITZ UEへの応用メモ

- **魔法陣・床マーカー系への転用**: 本テクの中心-エッジFresnelグラデーション + 星点/ノイズ模様の重ね合わせは、召喚円・危険エリア予告・チャージエリアといった「円形/球形の魔法的発光面」全般に流用しやすい。特に「エッジは明るく中心は暗い（またはその逆）」というFresnel×Lerp構成は、既存doctrineのAOEテレグラフ文法（固定赤枠/円+橙塗り、scale 0.05→1.0/opacity 0.20→0.95）に**内部模様の質感を足す**追加レイヤーとして組み込める
- **Rotate About Axisの回転WPOは平面（床マーカー）には直接使えない**点に注意: 本動画は球体前提の全体回転で、床マーカーのような平面Decal/Planeでは同じ手法は不要（回転はマテリアルのUV回転かPanner角度で足りる）。転用対象はOCジェムや浮遊オーブ等の球体・メッシュ系エフェクトの方が構造的に近い
- Texture BombingとFour-Way Chaosは、OCジェムのaura表現や既存ノイズマスク実装（`fx_technique_doctrine.md`のErosion定型・グロー勾配）に組み込める可能性がある「タイル反復回避」の低コスト手段として次回検討候補

## ソースの限界

- 手動字幕（"Kind: captions"、auto-generated表記なし）と判断したが、ロールングキャプション形式（1文が複数行に分割されて重複表示）であり、通常の手動字幕ファイルよりも自動生成に近い構造をしていた。数値（0.2/0.5/0.1等）や関数名は概ね明瞭に聞き取れる字幕だったが、万一の誤認識に備え実装時はUE実機で再検証すること
- 実際のノードグラフ画面は視聴しておらず、transcriptベースの要約のみ。特にRotate About Axisへの各入力（Object Position/World Position）がどのピンに繋がるかの正確な配線順序は字幕だけでは確定できていない
- 動画自体が7:24と短く、Niagara側のセットアップ（この球をどうパーティクル化するか）はほぼ説明がない。Dynamic Material Parameter経由でspeed/offsetを外部化する、という言及のみで具体的なNiagaraスタック構成は不明
