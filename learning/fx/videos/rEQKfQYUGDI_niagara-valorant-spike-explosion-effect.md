# 学習ノート — UE5 Niagara Valorant Spike Explosion Effect

- ソース: https://www.youtube.com/watch?v=rEQKfQYUGDI （12:58）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし・`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\rEQKfQYUGDI.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [iDrsEp3AGWA_magic-orbs.md](iDrsEp3AGWA_magic-orbs.md)（Sort Order Hint多層構成の類似例）、[_1tmjPro1JM_scifi-dome-material.md](_1tmjPro1JM_scifi-dome-material.md)（Depth Fadeでの接触部分発光という同一トリックの先例）、[h5pTEnXjZuo_spark-burst-vfx.md](h5pTEnXjZuo_spark-burst-vfx.md)（スパーク演出の別パターン）

## 概要

FPS ゲーム「Valorant」の設置物（スパイク）爆発を模した Niagara エフェクト。黒い球体メッシュ＋接触検知型エッジ発光マテリアルを中核に、屈折シェル・カラーコアシェル・地面デカール・中心グロー・カールノイズ駆動のスパークという計6エミッタを Sort Order Hint で積層して構成する。

## 技術詳細

### 1. 接触検知型エッジ発光マテリアル（コアの黒球）

- Blend Mode = Translucent、Two Sided は不要（この用途では外周だけ光ればよいため片面で足りる、との判断）
- **Depth Fade ノードを使い、球が他のジオメトリと接触した部分だけ白く発光**させる。Depth Fade を One Minus（1-x）して Emissive Color に接続
- レベルに置いたテスト用 Cube に球を近づけると接触面のエッジが白く光り、離すと黒に戻る、という挙動をその場でデモしている
- アニメーション追加: Noise Texture → Panner（Tiling=10、球が大きいため大きめの値／Speed=0.1）
- Depth Fade をもう一度乗算し、ノイズと合成してグラデーション状のエッジ効果に仕上げる（乗算を2段階にする理由として「STP（Step？※推定）後に値が均一になってしまうため」と説明。正確なノード構成は字幕からは確定できない）
- 最後に Particle Color を乗算し、Niagara 側から色を外部制御できるようにする

### 2. Niagara System 構成（6エミッタ積層）

1. **コア球（Mesh Renderer）**: Spawn Burst Instantaneous 1粒、Lifetime=5、Mesh Scale Mode で基準値=5。Particle Update に Scale Mesh Size（メッシュ拡縮カーブ、Normalized Age 0→0 / 0.5→0.5 / 0.8→1 / 1→0）を追加し、Scale Curve 倍率=8 で全体を拡大。カーブは「膨張してから消える」形状で、doctrine の「1粒バースト+カーブ駆動の器」パターンをメッシュのスケールに適用した例
2. **屈折シェル**: 別マテリアル（Water Caustics系テクスチャ＋ディストーション、詳細は「もう何度も作ったので」として省略）を同じ球メッシュに適用。**Color を上げる（20）だけでは足りず、Sort Order Hint=1 を設定して初めて可視化**された、という手順が明示的に語られている（値を上げても Sort Order が低いと下のレイヤーに隠れることがある、という実例）
3. **カラーコアシェル**: 屈折用マテリアルから Material Instance を作成し、Mask/Power/Speed/Tiling 等のパラメータを差し替えて別バリアントに（MI 化による低コストなバリアント量産、doctrine既知パターンの実例）。Color=100、Alpha=10 に強め、Scale Color ノードは削除
4. **地面デカール**: 空メタから Decal Renderer で新規。マテリアルは Material Domain=Deferred Decal、Blend Mode=Translucent、Base Color=黒（0）、**Opacity = Radial Gradient Exponential × 0.8**、Density=100。Particle Attributes の「Decal Size」パラメータをカーブ制御（0→0 / 0.5→1 / 0.8→1 / 1→0、Scale Curve=4000）してリング状に拡大収縮させる。他エミッタより発生を遅延（ディレイ）させて、本体の爆発が先行してから地面リングが追いつく間合いを作る
5. **中心グロー（Sprite）**: Spawn Burst、Color=100、Sprite Size≈100、Scale Sprite Size を上と同じカーブで駆動。**Sort Order Hint を99まで上げて初めて見えるようになった**、という失敗→修正の流れがそのまま実演されている
6. **スパーク**: Spawn Rate=200 と **Spawn Probability カーブ（Normalized Age 0→0.1、1→高い値）を併用**して発生密度を時間軸で変化させる。Shape Location = Torus（リング状の面から放射）。Sprite Size は Random Uniform 5〜10（当初大きすぎたため縮小）、Lifetime は Random 0.5〜0.8。Scale Sprite Size を Normalized Age 駆動カーブ＋Scale Curve=1500 でだんだん粒を大きくし「拡散していく」見た目を演出。Particle Update に **Curl Noise Force（Strength=1000, Frequency=25, Pan Noise Field 有効）＋ Acceleration Force（0→1 カーブ, Scale Curve=2000）を併用**し、有機的なドリフトと外向きの加速を両立。このエミッタも Sort Order Hint=99

### 3. System Loop 設定

- 最後に System の Loop Behavior を Once（自己一回のみ）にし、**Loop Duration=2.5秒**（パーティクル自体の Lifetime より短い）に設定。理由は「拡散が最大範囲に達するまでの前半だけシステムを走らせればよく、その後は個々のパーティクルの寿命任せで自然に消えていく」ため

## 新規性のある技術情報（既存ドクトリンとの比較）

- **接触検知型エッジ発光（Depth Fade→OneMinus→Emissive）**自体は [_1tmjPro1JM_scifi-dome-material.md](_1tmjPro1JM_scifi-dome-material.md) に先例があり本ノートでは重複扱いだが、本動画では**単色の1メッシュ全体にこれだけを適用し「接地/衝突時だけ全周が光るコア球」**という単純な用途に絞って使っている点は補足的な実例として記録
- **Sort Order Hint への依存度の高さ**: doctrine v2.4（層分け節）は「Sort Order Hintより(a)複数レンダラー(b)ブレンドモード分離」を推奨する立場だが、本動画は**6エミッタすべてを同一球メッシュ周辺に重ねる構成のため、実質的に Sort Order Hint（1・99・99…）が主要な層分け手段**になっている。「Color を上げても見えず、Sort Order Hint を上げて初めて見えた」という失敗実演は、**半透明が複数重なる爆発系エフェクトでは Sort Order Hint 調整が実務上避けにくい**という doctrine への反証的データ点として記録価値がある
- **Spawn Rate + Spawn Probability カーブの併用**によるスポーン密度の時間的シェーピングは既存ドクトリンに未収録。単純な Spawn Rate 定数ではなく確率カーブで「立ち上がりを抑えて後半に増やす」制御ができる、という組み合わせパターン
- **Torus 形状からのスパーク放出**（Shape Location = Torus）は、既存ノート群では見られなかった発生源形状（リング状爆発の輪郭に沿った放射パターン）
- **Curl Noise Force と Acceleration Force を独立した2つのカーブ制御で併用**し、有機的な乱流ドリフトと直線的な外向き加速を別々にチューニングする構成は doctrine の Fluids 節（気体/液体シム）とは別軸の軽量パーティクル力制御パターンとして新規
- **System Loop Duration をパーティクル Lifetime より意図的に短く設定**し「システムの再トリガー期間」と「個々の粒の余韻」を分離する設計判断は、doctrine未収録の実務 Tips

## SCRAP BLITZ UEへの応用メモ

- **ボス撃破・SP技フィニッシュの大型爆発演出への直接的な参考構成**: コア球（衝撃の中心）＋屈折シェル＋カラーコアシェル＋地面デカールリング＋中心グロー＋放射スパーク、という**6層積層で「密度のある一発大爆発」を作るテンプレート**として使える。既存の [cBc31YcWw_M_impact-burst-effects.md](cBc31YcWw_M_impact-burst-effects.md)（リング+グロー+スパーク+星の4層）と統合すると、より重厚なフィニッシュ演出の設計候補が増える
- **接触検知型エッジ発光**は、ボス撃破時にプレイヤー/地形とヒットボックスが接触する瞬間だけ光る「衝撃の芯」の表現として、SBBoss01 の死亡3フェーズ演出（freeze→explode→ring）の explode フェーズに転用できる可能性がある。ただし UE の Depth Fade はカメラ深度バッファ依存のため、2.5D固定カメラでの見え方は実機検証が必要
- **地面デカールの遅延発生（本体爆発→地面リングが遅れて追いつく）**というタイミング設計は、SBMine 型 AOE テレグラフの「予告→発生」とは逆方向（発生→余韻としての地面痕跡）の時間差パターンであり、ボス撃破時の「衝撃波が地面に広がる」演出に応用しやすい
- **Sort Order Hint 主体の積層**は、今回のプロジェクトで OC ジェムや大型 VFX を作る際、複数の半透明レイヤーが同一メッシュ周辺に密集するケースで実務的に有効な手段として再確認できた（doctrine の「Sort Order Hint より他手段を優先」という原則は保ちつつ、密集レイヤーでは併用が現実解になりうる）

## ソースの限界

- 英語自動字幕のみで手動字幕なし。認識誤りが多く（例: 「Valorant」→「warant」、「Niagara」→「neagra」、「Spawn Burst」→「swamp burst」、「Sort Order」→「sord order」、「Torus」→「TOS」）、特にマテリアルグラフの正確なノード名・接続順序（「STP後の値」「type Y/X」の箇所等）は本文中で「※推定」と明記した通り確度が低い
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。パラメータの数値（Mask=8/10、Power=20、Tiling R/G/B/Alpha の各値等）は字幕の聞き取りにブレがあり、実装時は UE 実機での再現・調整が前提
- 「屈折シェル」用マテリアルのディストーション構築手順は動画内で「もう何度も作ったので早送り」として省略されており、本ノートにも詳細を含められない
