# SOURCE: UE5.8 公式 Niagara Examples — 実地検査②（Explosions / Smoke / Sparks）

対象: `/Game/NiagaraExamples/FX_Explosions・FX_Smoke・FX_Sparks`（計 11 システム中 8 本を深掘り）
検査方法: UE5.8 公式 MCP 読み取り専用（検査①と同じ）。検査日: 2026-07-04

## 1. FX_Explosions — NS_Explosion（再現手順粒度）

### システム階層 = 「監督」パターン（最重要発見）
System Spawn/Update スクリプトが全エミッタ共通のパラメータを一元計算する：

- **System Spawn**: `SpriteSizeMin=400 / SpriteSizeMax=550`（Small は 150/200）、`TemperatureDecay=6`、`LightRadius = SpriteSizeMax×2`、`DecalSize = (0.2,1,1)×SpriteSizeMax`
- **System Update**: `System.LightTemperature` を毎フレーム `×(1 - TemperatureDecay×dt)` で減衰させ、それを index に **ColorFromCurve**（黒体放射風の R>G>B カーブ）→ `×ExposureCompensation×1,000,000` で `System.LightColor` を生成。`System.FlareColor` も同様の別カーブ
- Wind 系は **NPC（Niagara Parameter Collection）`NPC_NiagaraExamples`** からグローバル供給

→ 全エミッタは System.* を参照するだけ。サイズ違いバリアント（Small/Medium）は **System Spawn の数値 2〜3 行差し替えだけで成立**している。

### エミッタ別レシピ（発火順）

1. **Explosion（火球・CPU）**: Burst `RandomRangeInt(2,3)` + SpawnRate カーブ `60→0 (0.25s)` の**バースト+短テール併用**。InitializeParticle: Lifetime Random 3–7s、Color=User.Smoke Color（HSV ランダム V/A ±20%）、SpriteSize Min/Max=System 参照（X 方向 2 倍の横長）。`Particles.Temperature = Rand(0.5,1)` を自前定義し、Update で毎フレーム減衰 → 上昇力 `LinearForce(0,0,1000)×Temperature`・SubUV 再生速度・DynamicMaterialParameter(Index0) を全部 Temperature で駆動。レンダラー: Sprite、**MI_ExplosionRoil_8x8**（8x8 フリップブック、SubImageBlend on、SortMode=ViewDistance）
2. **Debris（瓦礫・GPU）**: Burst **1500–2000 粒**。**PartitionParticles（Alternating）+ Distribution Curve** でサイズ分布を作り、`VisibilityTag`（curve≥0.8 → tag=1）で **同一エミッタ内の Mesh レンダラー（岩メッシュ4種）と Sprite レンダラー（MI_SimpleDebris）に振り分け**。Collision（GPU Depth Buffer / Restitution 0.2）+ `HasCollided` で回転停止（`UpdateMeshOrientation` の Rotation Rate を bool 切替）
3. **SparkDebris（火の粉・GPU）**: **Burst 2 本立て**（30–75 粒の HDR 火花 RGBA(20, 8.25, 0.94) + 1000 粒の暗色破片）を **SpawnGroup でマスク分岐**（`MaskLinearColorBySpawnGroup` / `MaskFloatBySpawnGroup` で色・初速 15 vs 6・Drag 5 vs 1 を出し分け）。MI_Sparks
4. **Streamers_Source（CPU, 12 粒バースト）→ Streamers（Ribbon）**: Source は初速 500–2500 の弾道粒子（実質リーダー粒子）。Streamers が **SpawnParticlesFromOtherEmitter（30/s/粒）+ SampleParticlesFromOtherEmitter（Position 追従）** でリボン化。`TipNormalizedAge = SampledAge/SampledLifetime` を自前計算して**先端からフェード**。`RibbonSeed = SampledMaterialRandom×1000` でリボン分離。MI_SmokeTrail_2x16（2x16 フリップブック）、FacingMode=Screen
5. **Decal_Light_Flash**: **Lightweight（Stateless）エミッタ**（MCP からスタック/レンダラーが読めない = 空応答。System.LightColor/FlareColor/DecalSize と User.Decal Material を消費して Light+Decal+Flare を出す構成と推定）
6. **NE_PostProcess**: **Component Renderer → Engine.PostProcessComponent** を 1 粒バーストで生成。`Particles.Blend = (カメラ距離 400→1500 を 1→0 に Remap)² × 寿命フェード` で**距離減衰つきポスプロ**（CameraShake CS_Explosion_01 も依存に含まれる）
7. **GroundDust（GPU, 30 粒）**: ShapeLocation=**Ring/Disc** で地面リング状に配置、Z 速度を `Normalized Index In Partition` 比例にして波状に立ち上げ

### NS_Dirt_Explosion の差分
Streamers 系 2 エミッタなし。火球の Color が User.Dust Color（土色）、上昇力の Temperature が `Rand(0,1)`（火弱め）、SpawnRate カーブが 0.15s と短い。Debris の Burst Direction 制御が追加。

## 2. FX_Smoke — NS_Smoke_Plume / NS_Chimney_Smoke

両者は**完全に同一レシピの係数違い**（Plume: BaseSize 100 / Buoyancy 1 / CurlStrength 20、Chimney: BaseSize 10 / Buoyancy 0.25 / CurlStrength 4）。再現手順:

1. **Emitter Spawn** に SetVariables で `Emitter.Buoyancy / BuoyancyDecay / BaseSize / WindDirection(NPC)` を定義（**エミッタ定数の宣言場所**として Emitter Spawn を活用）
2. SpawnRate = User.SpawnRate（5–10/s）。Lifetime Random 3–12s、Sprite Size = User 値 ×0.75–1.25、回転 0–360°
3. **Particle Spawn で `VectorNoiseValue`（位置ベースノイズ）を 1 回サンプル** → NoiseX を Temperature(0.75–1) に、**NoiseY を初期アルファに** Remap（個体差を「ランダム」でなく空間ノイズで作る）。α<0.01 は `KillParticles` で即殺
4. **Particle Update**: Temperature 減衰 → `LinearForce(0,0,200)×Temperature×Buoyancy`（浮力）、`CurlNoiseForce`（強度は NormalizedAge カーブで 1→0 減衰、Frequency 3.5、PanNoiseField (0,0,0.5) で上方流動）、`WindForce`（NPC 由来 + Curl 乱流）、Drag 1、SolveForcesAndVelocity
5. **SubUVAnimation = Infinite Loop / Loops Per Second**、**Play Rate を速度ベクトル長から Remap(0–1000 → 0.1–1)**（速く動く煙ほど速く沸き立つ）+ NormalizedAge カーブで後半減速
6. ScaleColor: α = Curve[(0,0),(0.025,1),(1,0)]（急峻イン・長尾アウト）。ScaleSpriteSize: `1 + カーブ×5`（寿命で最大 6 倍膨張）
7. レンダラー: **MI_SmokePuffLight_8x8**（8x8、SubImageBlend on）。SortMode は Plume=ViewDistance、Chimney=**CustomDescending**

## 3. FX_Sparks — 3 システム（共通ファミリー）

核は 4 エミッタ構成: **Light / Sparks / SecondarySparks / Smoke**

1. **Light（CPU, 1 粒）**: NiagaraLightRenderer（SourceMode=**Emitter**、bUseInverseSquaredFalloff、radius 500）+ **M_BrightCore スプライト**（コア光芒、Emitter.CoreSize/CoreEmissive/CoreTemperature 駆動）。`Emitter.Color = RGBA(10, 4.42, 0.945)×カーブ×200`（HDR オレンジ）。Continuous 版は `System.NoiseCurveRate`（**Waveform（Random 波形, Phase=System.Age×4）を Remap** した 0–1 のゆらぎ）で光量・スポーン率を同期変調 → 溶接風の明滅
2. **Sparks（GPU）**: Burst Rand(10–60) ± SpawnRate。Lifetime = Rand(0.1–1)×User、**サイズは DistributionCurveFloat(0.5–2)**。AddVelocity **From Point**（0–300）+ Linear（指向性）。Update: **CurlNoiseForce 強度 700×(1-NormalizedAge)、Frequency 150**（高周波=火花のジグザグ）、Drag 2、Gravity -980×2、**Collision（GPU Depth Buffer, Restitution 0.6, スポーン後 0.25s は無効）**。ScaleColor: RGB を Lerp((0.5),(5))×カーブ（**末期に 10 倍明滅**）。寿命最終フレームに `Particles.MaterialRandom` へ「二次バースト当選フラグ」（確率 = User.Spark Burst Probability）を書き込む
3. **SecondarySparks（GPU）**: `SpawnParticlesFromOtherEmitter`（200/s/粒, cap 2500）+ `SampleParticlesFromOtherEmitter` で親の位置・速度(×0.5)を継承 → **親の MaterialRandom<1 なら KillParticles**。つまり**「死亡時に当選した火花だけが破裂する」パチパチ表現**。寿命 0.05–0.07s
4. **Smoke（GPU）**: MI_SmokePuffLight_8x8 使い回し、薄い α(0.05–0.5)
5. Impact_Looping には **Sparkles001 = Lightweight（Stateless）エミッタ**あり（MCP で内部不可視）
6. System Spawn で `System.Color = RGBA(0.435, 0.034, 5)`（HDR 青白）を定義 → 全火花色の源
7. レンダラー: 全火花 **MI_Sparks / SortMode=None**。Alignment/Facing=Automatic（Velocity 引き伸ばしはマテリアル側 M_Sparks の Shutter/DeltaTime パラメータで処理と推定）

### マテリアル実測（ObjectTools で確認）

| マテリアル | Blend | Shading | 用途 |
|---|---|---|---|
| M_SmokeAndFire_Sprites（→MI_ExplosionRoil_8x8 / MI_SmokePuffLight_8x8 / MI_SmokeTrail_2x16） | **AlphaComposite** | **DefaultLit** | 煙・火球・リボン |
| M_Sparks（→MI_Sparks） | **Masked** | Unlit | 火花 |
| M_Flare / M_BrightCore | **Additive** | Unlit | フレア・光芒コア |
| M_SimpleDebris / M_Pebbles | Masked | DefaultLit | 破片 |

M_SmokeAndFire_Sprites は 1 個の uber-material：パラメータに **Opacity Exponent / Opacity Threshold Range / Use Particle Alpha As Threshold（=エロージョン一式）**、BlackBody ノード + Temperature Min/Max、Sphere Normal（球面法線偽装）、Fake Directional/Ambient Light、Depth Fade、SubUV Tiles X/Y。テクスチャは **EOO パック（Emission/Occlusion/Opacity を RGB 3ch に格納）+ 別 Normals Atlas**。

## 4. チュートリアル由来ドクトリンとの比較

| ドクトリン | 公式サンプル | 判定 |
|---|---|---|
| Burst 1 粒+寿命オフの土台 | Light/NE_PostProcess が「Burst 1 粒 + Lifetime Direct Set」で同型。ただし寿命オフでなく **System/Emitter 変数をカーブで駆動して粒はただの器**にする方が主流 | ◯ 一致（上位形あり） |
| 多層 Sort Order | **不使用**。SortOrderHint は全て 0。代わりに SortMode=ViewDistance / CustomDescending / None を使い分け、**そもそも Translucent を煙系 1 系統に絞って層問題を回避**（火花=Masked、フレア=Additive） | △ 相違（より上級：ブレンドモードで層を分離） |
| Additive/Translucent 使い分け | Additive=フレア系のみ。煙・火球は Translucent でなく **AlphaComposite + DefaultLit（ライティングされる煙）** | △ 相違（AlphaComposite は一段上のパターン） |
| Erosion=ノイズ→Power→OpacityMask | M_SmokeAndFire_Sprites に Opacity Exponent/Threshold/Particle Alpha As Threshold として内蔵。**パーティクル α をエロージョン閾値に流用**し、DynamicMaterialParameter でも制御 | ◯ 一致（閾値の供給元がパーティクル属性な点が上級） |
| （新規パターン） | ①System 階層=監督（バリアント量産・色温度カーブ）②PartitionParticles+VisibilityTag で 1 エミッタ Mesh/Sprite 分岐 ③AttributeReader 2 段連鎖（リボン化・二次火花）④Component Renderer で PostProcess/CameraShake ⑤NPC でワールド風を全 FX 共有 ⑥Lightweight エミッタ | — 動画にない収穫 |

## 5. SCRAP BLITZ UE への応用候補

- **爆弾・ガスキャニスター爆発**: NS_Explosion_Small の構成比（火球 2–4 粒 + 破片 250–500 + 火の粉 30–75+150 + リング状 GroundDust 20）と System 監督パターンをそのまま流用。サイズ違いは System Spawn の SpriteSizeMin/Max 差し替えだけで爆弾/ガス缶/ボス死亡の 3 段が作れる
- **被弾スパーク**: NS_Spark_Burst の「CurlNoise 700×(1-Age)・Freq 150 + Gravity×2 + Restitution 0.6 + 末期 RGB×10 明滅」が最短レシピ。HDR 色 RGBA(20,8.25,0.94)（橙）/(0.435,0.034,5)（青白）は写経価値あり
- **SuperKnock/OC 演出の「当選パチパチ」**: MaterialRandom フラグ + SpawnParticlesFromOtherEmitter の二段火花は、コンボ演出のランダム二次破裂にそのまま使える
- **破壊演出の煙**: VectorNoiseValue で初期 α に空間ムラ + SubUV PlayRate を速度連動、が「安い割に生きて見える」核。ボス死亡のスロー演出とも相性が良い（PlayRate が勝手に落ちる）
- **注意**: 公式は煙に DefaultLit/AlphaComposite を使うが、当プロジェクトは 2.5D 固定カメラなので Unlit+Translucent 簡略でも破綻しにくい。逆に Light Renderer + BrightCore の 2 点セット（1 粒 CPU エミッタ）は費用対効果が高く即導入候補

## 使用ツール
- `NiagaraToolsets.NiagaraToolset_System`: GetSystemSummary / GetEmitterTopology / GetScriptStackInputValues / GetDynamicInputChain / GetRendererData / GetEmitterData
- `editor_toolset.toolsets.asset.AssetTools`: find_assets / get_dependencies / get_asset_tags
- `editor_toolset.toolsets.object.ObjectTools`: get_properties（マテリアルの BlendMode/ShadingModel）
- `editor_toolset.toolsets.material.MaterialTools`: get_expressions / `material_instance.MaterialInstanceTools`: list_parameters

**MCP 検査上の既知の限界**: Lightweight（Stateless）エミッタはスタック・レンダラーとも空応答で読めない。また Git Bash から `/Game/...` パスを渡す際は `MSYS_NO_PATHCONV=1` 必須（パス変換で `C:/Program Files/Git/Game/...` に化ける）。
