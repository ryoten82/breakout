# SOURCE: UE5.8 公式 Niagara Examples — 実地検査③（Weapons / Ribbons / NDC / Footstep / Misc / Fog）

対象: `/Game/NiagaraExamples/FX_Weapons・FX_Ribbons・FX_NDC 他`
検査方法: UE5.8 公式 MCP 読み取り専用（検査①と同じ）。検査日: 2026-07-04

**使用ツール**: `editor_toolset.toolsets.asset.AssetTools`（list_folders / find_assets / get_asset_class / get_referencers / get_asset_tags）、`NiagaraToolsets.NiagaraToolset_System`（GetSystemSummary / GetEmitterTopology / GetEmitterInputValues / GetRendererData / GetModuleInputValues）

## 1. FX_Weapons 詳細（再現手順粒度）

### 1-1. NS_MuzzleFlash（6エミッター・ほぼ CPUSim・全て Loop=0.5s の burst 型）

**User パラメータで完全外部制御**する設計が最大の特徴: `User.Flash Base Color`(RGBA 100,23.9,1.2 = HDR オレンジ)・`User.Global Scale`・`User.Side Flash Num`(=6)・`User.Side Flash Probability`(=0.8)・`User.Use Bullet Shell` 等 12 個。

| Emitter | 構成 | 再現ポイント |
|---|---|---|
| **Flash_Center** | Sprite+**Light** | Burst 1 個。Size 65–85、`FaceCamera/Unaligned`、SubUV 2×2（`MI_MuzzleFlash_Sphere`）。Particle Update に `Light_Attributes` で同一パーティクルからライトも発光 |
| **MuzzleFlash_Front** | Sprite | Burst 2 個。**`SpriteFacingAndAlignment`**（Facing=DYN MakeVector・Alignment=(1,0,0) Local）＋レンダラー `CustomFacingVector`/`CustomAlignment` で「銃口軸に張り付く十字ブレード」を作る。`AngleAlphaFade`（カメラ角でフェード、真横から見た板ポリ消し）。SubUV 2×1 Random |
| **MuzzleFlash_Side** | Sprite | `ShapeLocation`=Ring/Disc **Direct 分布 + U Position=ReturnNormalizedExecIndex** で銃口穴 N 個へ均等配置。`Rotation Angle = User.Side Flash Angle` でリング傾け。Spawn Count=DYN(Bool→Int) で確率発火 |
| **Muzzle_Smoke** | Sprite | Loop **Once**。寿命 0.2–0.3s、Size 50–65、Cone 30° (1,0,0)、SubUV 8×8（`MI_Flipbook_Smoke_Muzzle`） |
| **Muzzle_Sparks** | Sprite (**GPU**) | 寿命 0.05–0.12s、Size 0.25–0.5。ShapeLocation=Sphere → AddVelocity Cone 50°。**レンダラー `VelocityAligned` + FaceCamera**（`MI_Sparks`） |
| **Bullet_Shell_Eject** | **Mesh** | `InitialMeshOrientation` → `MeshRotationForce`(Lever Radius 100cm) → `ApplyInitialForces`。Update で Drag/Gravity/**Collision**(Radius Scale 0.333) → 薬莢が跳ねて転がる |

**組む順序**: ①中心フラッシュ+Light → ②軸ブレード（CustomFacing）→ ③サイドフラッシュ（Ring 分布）→ ④煙 → ⑤火花 → ⑥薬莢。全部 User パラメータへ配線してから BP/C++ で色・規模を一括制御。

### 1-2. NS_Impact_Concrete（5エミッター・GPU 主体）— 着弾の教科書

User: `Burst Amount`(40) / `Base Color` / `Hit Direction` / `Hit Normal` / `Hit Velocity` / `Variability`。System 層で `System.Burst Direction`・`System.Local Hit Velocity` に加工して全エミッターが共有。

| Emitter | 構成 | 再現ポイント |
|---|---|---|
| **Debris** (GPU) | **Mesh+Sprite 二重レンダラー** | `Particles.VisibilityTag = DYN MakeCustomIntFromBool`（Emitter.Rock Probability=0.2）で**同一エミッター内で 20% を岩メッシュ、80% をスプライト破片に振り分け**（Mesh=RendererVisibility 1 / Sprite=0）。寿命 2.5–3s、Mass 0.75–1.25。AddVelocity In Cone 90°（軸=Burst Direction）+ Linear(Hit Velocity)。Update: CurlNoise(freq150) → Drag(1) → Gravity(-980) → **Collision**(GPU Depth Buffer, Restitution 0.4, 回転制御・Rest State あり) → SolveForces → UpdateMeshOrientation(Rotation Rate) |
| **Dust** (GPU) | Sprite | 寿命 0.8–1.5s、Size 20–30、`MI_SmokePuffLight_8x8_Emissive`(SubUV 8×8)。Color=**Random HSV**(Value 0.7–1)。**WindForce**（System.WindDirection/Strength 連動）+ Drag 6。ScaleColor は Alpha カーブのみ |
| **Sparks** (GPU) | Sprite | 寿命 0.05–0.25s、Cone 120°。`Emitter.SecondaryProbability=0.25`。Collision(Restitution 0.4)で跳ねる |
| **SecondarySparks** (GPU) | Sprite | **`SpawnParticlesFromOtherEmitter`（Attribute Reader、emitterName="Sparks"）+ `SampleParticlesFromOtherEmitter`**：親 Sparks の位置/速度(×0.5)/色を継承して子火花を Spawn Rate per-particle で湧かせる。**イベント不使用・GPU 対応の親子連鎖**。MaxDistance 750 で Sleep するスケーラビリティ付き |
| **LightDecal** (CPU) | **Light+Sprite+Decal の 3 レンダラー 1 粒子** | Emitter Update で `Emitter.LightRadius=500`・`Emitter.CoreEmissive=カーブ` を毎フレーム計算し、Sprite の MaterialParameters に **attributeBinding（"Emissive Gain" ← Emitter.CoreEmissive）**。`Decal_Attributes` で `MI_BulletHole` を **`Particles.ReadFromNDC.Normal`** 方向へ投影（NDC 由来の面法線を使う前提の作り） |

### 1-3. NS_Impact_Metal — Concrete と同骨格（Debris 無しの 4 エミッター）

差分のみ: Dust が `MI_SmokeWispy_8x8_Emissive`・寿命 0.5–1s・Size 10–15・Cone 45°・Drag 10（金属は砂埃が少なく速く消える）。Sparks 寿命 0.1–0.3s（やや長め＝金属火花）。SecondarySparks Restitution 0.6。**マテリアル 3 種（Sparks/ImpactFlash/BulletHole）は Concrete と共通**＝着弾バリエーションは「共通骨格＋数値とマテリアル差し替え」で量産する設計。

### 1-4. NS_BulletTracer（1エミッター "Minimal" CPU・**1エミッター4レンダラー**）

Ribbon(`M_TracerRibbon`, Screen facing, Tess 16) + Sprite(`MI_Tracer`, **VelocityAligned**, RendererVisibility=1) + Light(Visibility=1) + Mesh(Visibility=0 予備)。
- Emitter Update: **`SpawnPerUnit`**（Spacing=System.Spawn Spacing、Velocity=System.TravelVelocity）でトレイル粒子 + `SpawnBurst`(Spawn Group=2) で弾頭 1 個 + `SpawnRibbonParticles`（FirstFrame 時に一括生成）
- **弾頭とトレイルを Spawn Group / RendererVisibility で振り分け**、弾頭 Sprite+Light だけ Visibility 1
- Particle Update: `Particles.Age / RibbonLinkOrder / Position` を **DYN MaskFloat/MaskPosition** で更新（グループ別マスク書き込み）。CurlNoise(強30/周波数5) + LinearForce(0,0,30) で軽い揺らぎ
- 色は `Emitter.Color=(30,12.4,1.4)` の HDR。User.Hit / User.InitialSpeed / User.TrailDuration で外部制御

### 1-5. NS_SimpleRibbonTrail（最小リボンのリファレンス）

1 エミッター・Ribbon のみ・**モジュール 8 個**の最小構成:
`SpawnPerUnit`(Spacing=20, Max Movement Threshold 50000) → InitializeParticle(Lifetime 0.1 直指定, Color HDR(5,0.9,0), **Ribbon Width Mode=Direct Set 3**) → Update で RibbonLinkOrder/Position を Mask 系 DYN で維持。レンダラー: DefaultRibbonMaterial, FacingMode=**Screen**, TessellationFactor=16, UV0/1=`ScaledUsingRibbonSegmentLength`+Locked, DrawDirection=FrontToBack, Shape=Plane, MultiPlaneCount=2。
**斬撃トレイルはこれを雛形に、Width カーブとマテリアルを差し替えるのが最短**。

## 2. FX_Ribbons: NS_TeslaCoil（7エミッター・上級リボン）

雷アーク（ビーム型リボン）の完成形。User: `PositionTarget` / `Smoke Color` / `Speed`。

**Arc_Main**（CPU, Sprite+Decal+Light+Ribbon の 4 レンダラー）:
1. Emitter Update **`Arc_Setup`**: Lifetime(Random)・Lead Particle Count=10・Arc Start/End（End=System.Beam End）・開始/終了タンジェント・**Branch Count=RandomRangeInt** → `SpawnBurst` Count=DYN Multiply_Int（=要素数×粒子数）
2. Particle Spawn **`PartitionParticles`**: Sequential / Partitions=Emitter.ArcElementCount / Per Partition=LeadParticleCount、**Partition→RibbonID、Partition Index→RibbonLinkOrder に直接書き込み**（1 バーストで本体+枝の複数リボンを一括生成）
3. **`Arc_Spawn`**: Lead Width=40 / Branch Width=20 / Branch Lifetime=0.66 / Branch Length 50–100×カーブ / Branch Angle 20–60°×カーブ / Branch Spawn Range 0.05–0.75 — 枝分かれ雷のパラメトリック生成
4. Particle Update **`Arc_Update`**: Noise Frequency=8 / Magnitude=40×カーブ / **Lock Lead Start/End**（端点固定でギザギザだけ動かす）/ Pan Noise=ArcDirection
5. 同一粒子から `Decal_Attributes`（IsLeadStart の粒子だけ床グロー 15×20×20）と `Light_Attributes`（Radius Scale 1.5, AndOperation で条件点灯）と `CameraOffset`(=粒子半径分)
6. Ribbon レンダラー: `M_Ribbon_Arc`, Screen facing, **TessellationFactor=2**（ノイズ密度が高いので細分不要）, UV1 は `TiledOverRibbonLength`+SmoothTransition（電流スクロール用）

**Arcs_Ambient** は同構成の常時弱アーク版。**Smoke/Sparks**（GPU）は `PartitionParticles`(Infinite, 3個/組) と CameraOffset 併用、Smoke は MaterialParameters attributeBinding("Emissive Color" ← System.Color)。**Tesla_Node_Decals**: SpawnRate 120・Sphere r=53 表面に `Sprite Facing=ShapeLocation.ShapeNormal`（面法線向きフレア）+ Decal。**Glow/GlowLight はモジュール 0 個・レンダラー 0 個の空エミッター**（無効化された残骸）。

## 3. FX_NDC 概要（Niagara Data Channel）

構成: **NDC アセット 2 個**（`NDC_Footsteps` / `NDC_Impacts`、class=`NiagaraDataChannelAsset`）+ 読み手 NS 4 個。

- **書き手**: `AN_Footstep`（AnimNotify、FX_Footstep フォルダ）と Gallery の `AN_Gallery_Footstep` が NDC_Footsteps へ足音イベント（位置・法線等）を Write（get_referencers で確認）
- **読み手**（NS_NDC_Footsteps の Smoke エミッターで実測）:
  - System 層に `System.NDCRead`（`NiagaraDataInterfaceDataChannelRead`）を 1 個定義
  - Emitter Update **`SpawnDirect`**: NDCRead を参照し、**チャネルに入ったイベント 1 件ごとに Min 1〜Max 2 個スポーン**
  - Particle Spawn **`ReadFromNDC`**: イベントのペイロードを `Particles.ReadFromNDC.*`（Position/Normal 等）へ展開 → 後続の SetVariables/InitializeParticle が消費
- つまり「**ワールドに 1 個だけ常駐する NS が、全キャラの足音/全着弾を 1 システムで描画**」するバッチング機構。NS_NDC_Impacts は Debris/Dirt/Sparks/Smoke/Impact_Flash/Decal の 6 エミッターで FX_Weapons/Impacts 相当を NDC 駆動化した版。Impact_Concrete の Decal が `ReadFromNDC.Normal` を参照していたのもこの文脈（同一モジュール資産の流用）

## 4. FX_Footstep / FX_Misc / FX_Fog 一覧

**FX_Footstep**（すべて `User.RightFoot` で左右切替、FootprintBase エミッター共通）
- `NS_Footstep_LW`: 土煙のみの軽量足音（Dust+FootprintBase）
- `NS_Footstep_Gravel`: 砂利。岩メッシュ(Rocks)+Dust
- `NS_Footstep_Fire`: 炎の足跡。FlamesAndEmbers+Smoke+Burst
- `NS_Footstep_Bubbles`: 泡の足跡（User.Color 付き）

**FX_Misc**
- `NS_SkeletalMeshTris_Loop/Burst`: スケルタルメッシュ表面(三角形)からパーティクル湧出（ループ/単発）
- `NS_SkeletalMeshBones_Loop/Burst`: ボーン位置から湧出（ループ/単発）
- `NS_Boundary` (+`_Box/_Cylinder/_Sphere`): プレイエリア境界の可視化（Sparkles+Decal、形状バリエーション）
- `NS_Bubble_Burst`: 泡の破裂単発
- `NS_Fire`: 常駐炎。Flames+Smoke+Light+**ComponentRenderer**(BaseLight) の 5 エミッター
- `NS_FireworkBurst`: 花火。Leaders(打ち上げ)+Burst(開花)の 2 段
- `NS_HitDissolve`: ヒット時ディゾルブ火花（Sparks+SecondarySparks 連鎖、Impact 系と同パターン）

**FX_Fog**: NiagaraSystem は**ゼロ**。`BP_FogBankCard` / `BP_FogBankVolume` + **SparseVolumeTexture**（SVT_FogBank_Seed0-2, Whisps 0-2）+ プリセット CVC のみ＝Niagara ではなく SVT ボリュームフォグのサンプル。

## 5. 学習部屋ドクトリンとの比較

**一致（裏付けが取れたもの）**
- **Velocity Alignment**: Muzzle_Sparks / BulletTracer 弾頭 Sprite が `VelocityAligned`。ただし Non-uniform ストレッチは DYN 側でなくマテリアル/サイズ側で吸収しており、Impact の Sparks は `Automatic` のまま（速度整列はマズル系のみ）
- **多層レンダラー**: 全面的に採用。ただし**「Sort Order 多層」ではなく SortOrderHint はほぼ全部 0**。層分けは (a) 1 エミッター複数レンダラー + **RendererVisibility タグ**（BulletTracer 弾頭/トレイル、Debris の岩/破片振り分け）、(b) エミッター分割、で実現している

**相違（公式はより上級/別解）**
- **Death Event + Persistent IDs は不使用**。親子連鎖は **`SpawnParticlesFromOtherEmitter` / `SampleParticlesFromOtherEmitter`（Attribute Reader）**で実装（SecondarySparks、GPU で動く・ID 管理不要）。チュートリアルの Generate/Receive Location Event より新しい推奨形
- **NDC**: チュートリアル世代には無い「常駐 1 システム+イベントストリーム」パターン。大量ヒットエフェクトのドローコール/システム数削減の公式解
- **PartitionParticles → RibbonID 直書き**（TeslaCoil）: イベント無しで 1 バーストから複数リボンを作る上級技
- **外部制御の徹底**: 全システムが User.* を大量公開し、色は HDR 値（R=30〜100）で発光を作る。Emitter属性→MaterialParameters の attributeBinding（Emissive Gain 等）も常用

## 6. SCRAP BLITZ UE への応用候補

1. **ヒット演出は NS_Impact_Metal 骨格の移植が最短**: Sparks(Cone120°+Collision) + SecondarySparks(AttributeReader連鎖) + LightDecal(Light+Flash+Decal 1粒子3レンダラー) を `User.Hit Direction/Velocity/Base Color` 付きで 1 システム化 → DoAttackHit から色/方向だけ渡す
2. **斬撃/移動残像は NS_SimpleRibbonTrail 雛形**（SpawnPerUnit+RibbonWidth 直指定+Screen facing）に武器ソケット追従を足す。弾系は BulletTracer の「SpawnPerUnit トレイル+Spawn Group 弾頭+RendererVisibility 振り分け」
3. **敵大量ヒット・足音・破片の常態化には NDC 移行が有効**: SBEnemy 群のヒットスパークを NS_NDC_Impacts 型（常駐 1 システム + C++/BP から DataChannel Write）にすると、現行の per-hit SpawnSystemAtLocation を置換できる
4. **OD/SP 技の電撃系は TeslaCoil の Arc_Setup/Arc_Spawn/Arc_Update モジュール**を流用可能。Branch 系パラメータで雷の派手さをデータ駆動化
5. **色統一ポリシーとの相性**: 公式は全て User.Color(HDR)一点制御なので、SCRAP BLITZ の「演出色統一」ルールを User パラメータ規約（例: `User.FX Color`）として全自作 NS に敷くと管理が楽
