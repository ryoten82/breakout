# SOURCE: UE5.8 公式 Niagara Examples — 実地検査①（カタログ + PickUp/Markers/Player）

対象: 公式「Niagara Examples」パック（`C:/Users/90g-r/Documents/Unreal Projects/MyProject` の `/Game/NiagaraExamples/`、669アセット・NiagaraSystem 60件）
検査方法: UE5.8 公式 MCP（`ModelContextProtocol`+`AllToolsets` プラグイン、`http://127.0.0.1:8000/mcp`、読み取り専用）+ Stateless エミッター向け .uasset 直接解析（`tools/` の自作パーサ）
検査日: 2026-07-04 ／ 検査エージェント: Sonnet（読み取り専用厳守・アセット無変更）

## 検査方法（重要な発見を含む）

- **公式 MCP**（`http://127.0.0.1:8000/mcp`）の `AssetTools.find_assets` で全 NiagaraSystem を列挙
- **🔴 発見：FX_PickUp / FX_Markers / FX_Misc 等は UE5.8 の Lightweight（Stateless）エミッター構成**で、`NiagaraToolset_System` のスタック検査ツール（GetEmitterTopology / GetScriptStackTopology 等）は**スタックが空で返る**（stateless 非対応）。アセットタグ `ActiveStatelessEmitters` で判別可能
- そのため FX_PickUp / FX_Markers は **.uasset 直接解析**（読み取りのみ。`tools/ua_parse.py`（Name/Import/Export map パーサ）+ `tools/ua_props.py`（UE5.8 タグ付きプロパティデコーダ）+ `tools/ns_digest.py`）で全モジュール値を抽出
- FX_Player は従来型（versioned）エミッターなので MCP ツールで検査（`tools/player_digest.py` ドライバ）

---

## 1. カタログ（NiagaraSystem 全 60 件）

| フォルダ | システム |
|---|---|
| **FX_Explosions** (6) | NS_Explosion / NS_Explosion_Medium / NS_Explosion_Small / NS_Dirt_Explosion / NS_Dirt_Explosion_Medium / NS_Dirt_Explosion_Small |
| **FX_Fog** (0) | （NiagaraSystem なし — マテリアル/BP のみ） |
| **FX_Footstep** (4) | NS_Footstep_LW / NS_Footstep_Gravel / NS_Footstep_Fire / NS_Footstep_Bubbles |
| **FX_Markers** (2) | NS_Marker_Target / NS_Marker_Location |
| **FX_Misc** (13) | NS_Fire / NS_FireworkBurst / NS_HitDissolve / NS_Bubble_Burst / NS_SkeletalMeshTris_Loop / NS_SkeletalMeshTris_Burst / NS_SkeletalMeshBones_Loop / NS_SkeletalMeshBones_Burst / NS_Boundary / NS_Boundary_Box / NS_Boundary_Cylinder / NS_Boundary_Sphere |
| **FX_NDC** (4) | NS_NDC_Footsteps / NS_NDC_Footsteps_Fire / NS_NDC_Footsteps_Bubbles / NS_NDC_Impacts |
| **FX_PickUp** (4) | NS_Pickup_Idle / NS_Pickup_Spawn / NS_Pickup_Success / NS_Pickup_Timeout |
| **FX_Player** (7) | NS_Player_Teleport_In / NS_Player_Teleport_Out / NS_Player_Buff_Looping / NS_Player_DeBuff_Looping / NS_Player_Electricity_Looping / NS_Weapon_Buff_Looping / NS_Weapon_DeBuff_Looping |
| **FX_Ribbons** (1) | NS_TeslaCoil |
| **FX_SkeletalMesh** (2) | NS_Dino_Tri_Loop / NS_Dino_Tris_Color_Burst |
| **FX_Smoke** (2) | NS_Smoke_Plume / NS_Chimney_Smoke |
| **FX_Sparks** (3) | NS_Spark_Burst / NS_Spark_Continuous / NS_Spark_Impact_Looping |
| **FX_Weapons** (7) | Trails: NS_SimpleRibbonTrail / NS_RocketTrail / NS_BulletTracer、MuzzleFlashes: NS_MuzzleFlash、Impacts: NS_Impact_Wood / NS_Impact_Metal / NS_Impact_Glass / NS_Impact_Concrete |
| その他 | Utilities/SpriteGeneration ×3、Materials/Reference ×1 |

---

## 2. FX_PickUp 詳細（全4件・全て Stateless エミッター）

共通: User 変数 `User.Color`（既定 シアン (0, 0.504, 1)）と `User.Color Secondary`（白）。粒子色は `InitializeParticle の Color=Binding` → User.Color で染まる。EffectType=NET_Gameplay_Looping、FixedBounds ±100。

### NS_Pickup_Idle（常時ループ・4エミッター）
1. **Element**（スプライト、M_Energy + SubUV 8×8 T_Plasma_Wisps + CutoutTexture）: Rate 3/s + 起動 Burst 1。Lifetime 2.0、サイズ 50、初期回転 rand(0–360°)。SubUVAnimation: 64 frames / InfiniteLoop / LoopsPerSecond=-0.5（逆再生）。ScaleColor はαのみのフェードイン/アウトカーブ。ScaleSpriteSize [1→0]
2. **Glow**（LightRenderer + スプライト MI_Pickup_Flare / CutoutMask / OSM_GreenChannel）: Burst 1・無限寿命（InactiveResponse=Kill）。LightAttributes: Radius カーブ 0.9→1.0→0.9（呼吸）、Falloff 1.5、RadiusScale 175。ScaleSpriteSize 0.8↔1.0 の脈動カーブ
3. **Sparkles**（スプライト MI_Pickup_Sparkles、SortOrderHint 2）: Rate 15/s。Lifetime rand(0.5〜)、サイズ rand(4–6)。**ShapeLocation: Sphere 半径 23.5 (Local)** → AddVelocity FromPoint **-20**（中心に吸い込まれる）+ 上向き 30×(0,0,1)。Drag あり。ScaleSpriteSize は 0.1→1 → 0 カーブ
4. **Sphere**（メッシュ SM_Sphere_1Unit + **MI_Pickup_Sphere**）: Burst 1・無限寿命。MeshScale 50、ScaleMeshSize 0.95→1.0→0.95 の脈動

### NS_Pickup_Spawn（出現ワンショット、LoopBehavior=Once）
- **Element**: Burst 1、Lifetime rand(0.5–0.75)、サイズ rand(120–140)、αフェードカーブ + サイズ収縮 1→0.4
- **Glow**: Burst 1、Lifetime 0.2、サイズ 150、CameraOffset -20、LightAttributes Radius カーブ 0.5→1.28→…、フラッシュ演出
- **Sparkles**: **Burst 45**、Lifetime rand(0.15–0.25)、サイズ rand(2–4)、Sphere 半径 60 → FromPoint **-300**（激しく吸い込み）+ CurlNoise(強50/周波数100)
- **Sphere**: Burst 1、Lifetime 0.22、ScaleMeshSize 1.75→1.0（縮んで定着）

### NS_Pickup_Success（取得成功、Once）
- **Element**: Burst 1、Lifetime rand(0.6–0.7)、サイズ 150、AddVelocity Cone(角360°/20)+FromPoint rand(10–15)（ふわっと放出）、SubUV StartFrame 25 固定 + LoopsPerSecond 0.66、α 1→0
- **Glow**: Burst 1、Lifetime 0.33、サイズ 200、Light Radius カーブ 0.15→1.0→減衰、Falloff 2.0、RadiusScale 200、ScaleColor RGB 1→0（白→黒でライト消灯）
- **Sparkles**: **Burst 45**、Sphere 半径 20 → FromPoint **+rand(75–200)**（外向きに爆散）+ CurlNoise(25/60) + Drag 3 + **GravityForce +150Z（上向き！）**
- **Sphere**: Burst 1、Lifetime 0.25、ScaleMeshSize 1→1.5 拡大、ScaleColor **RGB 3.0**（HDR フラッシュ）→ α0

### NS_Pickup_Timeout（消失、Once）— Success の「沈む」版
- Element: Burst 2、ScaleColor 先頭 RGB 0.5（暗い）、サイズ 0.25→1.0 拡大しつつ α フェード、SubUV LoopsPerSecond 0.5
- Glow / Sphere: Success とほぼ同構成だが控えめ（Glow サイズ 120、Sphere 1→1.25）
- Sparkles: **Burst 15**、FromPoint rand(20–)、Gravity +100Z、色は白（User.Color 二次色寄り）

**再現手順の要点**: ①Stateless エミッターで作る（Spawn Rate/Burst + InitializeParticle + ShapeLocation(Sphere) + AddVelocity(FromPoint±) + Scale系カーブのみで完結）②色は全て `User.Color` バインドにして 1 システムを色替え運用 ③「Idle=Rate+脈動 / Spawn=吸い込み / Success=爆散+HDRフラッシュ / Timeout=暗色+弱め」の4部作パターン。

---

## 3. FX_Markers 詳細（全2件・Stateless、メッシュ+デカール構成）

### NS_Marker_Target（地面ターゲットリング、User.Color=赤 (1,0,0)）
User 変数で **User.Radius=50 / User.Height=100 / User.Decal / User.Mesh / User.Particles**（bool トグル）を公開し、BP から部位別に ON/OFF できる設計。
1. **Beacon**: Burst 1、LoopBehavior=**Once**、MeshScale (125,125,**2000**) の縦長シリンダー（cylinder メッシュ + **MI_Boundary_TechGrid**）＝光の柱。DecalAttributes: Orientation(90,0,0)、Size カーブ 10→…、Fade カーブ 1→0
2. **Ring**: Burst 1、**LoopCount 3 / LoopDuration 0.2**、SM_Cylinder_1Unit + **MI_Marker_Target**、InitialMeshOrientation Rotation(0,90,0)、MeshScale 125
3. **Rings_Inwards**: LoopBehavior=Multiple ×3 / LoopDuration 0.1333、Lifetime 0.33、**ScaleMeshSize 3.0→1.0（外→内に収束するリング）**、αはカーブでパルス

### NS_Marker_Location（味方位置マーカー、User.Color=緑 (0,1,0,2)）
1. **Beacon001（矢印）**: Burst 1、LoopCount 2、**SM_Arrow + MI_Mesh_Arrow**、InitialPosition (0,0,126)、OrientToAxis (0,0,-1)（下向き矢印）、AddVelocity (0,0,-280) + AccelerationForce (0,0,+310) ＝ **落ちて跳ね戻るバウンス**を力学だけで表現
2. **Beacon（柱）**: Burst 1、Lifetime 1.1、MeshScale (50,50,2000) + MI_Boundary_TechGrid、DecalAttributes Size 2.5→7 拡大 + Fade 0→0.99→減衰
3. **Rings_Outward**: Multiple ×3 / 0.2s、Lifetime 0.4、DecalAttributes Size **150→25**…、ScaleMeshSize **6→1（収束）**

**再現手順の要点**: ①1 パーティクル Burst＋MeshRenderer（1Unit シリンダー）＋DecalRenderer の重ね ②リング連打は「LoopBehavior=Multiple + LoopCount + 短 LoopDuration」で1粒子×Nループ ③サイズ/フェードは全部 ScaleMeshSize / DecalAttributes のカーブ ④User bool でメッシュ/デカール/パーティクルを個別トグル。

---

## 4. FX_Player 詳細（5/7件・versioned エミッター、MCP で検査）

共通: `User.Color` 公開。**System.Skeletal Mesh**（SkeletalMesh DI）にキャラメッシュをバインドし、`SkeletalMeshLocation` でサーフェス/ボーンサンプリング。**Partitions**（System 変数）+ `PartitionParticles` モジュールでボーン割当を分散。移動追従は `InheritSourceMovement`。

### NS_Player_Teleport_In / Teleport_Out（対構成）
- **Skeletal_Mesh_Particle_Spawner**（GPUSim、MI_BasicSprite）:
  - Emitter Update: EmitterState(Infinite/1s) + SpawnRate 90 + **SpawnBurst 256**
  - Particle Spawn: InitializeParticle(Lifetime rand In:0.33–0.5 / Out:0.5–2、Color=User.Color) → **SkeletalMeshLocation(Surface Triangles ランダム)** → AddVelocity(法線方向 ×-200 ＝体表面へ吸着方向) + AddVelocity(0,0,50)
  - Particle Update: CurlNoise(カーブ制御強度/30Hz) + AccelerationForce(Multiply dyn) + InheritSourceMovement + SpriteRotationRate + ScaleSpriteSize(カーブ) + ScaleColor(RGB/α別カーブ) + OffsetPosition
  - In と Out の差: 寿命と速度スケールの符号系（In=収束して実体化、Out=発散）
- **Glow**（CPU、**M_Glow_Capsule**）: EmitterState Once/0.25s、SpawnBurst Count=System.Partitions、**PartitionParticles(Sequential)** で各ボーンに 1 枚ずつカプセル状グローを配置。SkeletalMeshLocation(Bones Direct) を **Particle Update で毎フレーム実行**（ボーン追従）。SpriteFacingAndAlignment: Alignment=ReturnMeshOrientation dyn（ボーン向きにスプライトを整列）

### NS_Player_Buff_Looping / DeBuff_Looping（対構成、User.Color=緑）
3エミッター構成（Sparkle / Element / Glow）:
- **Sparkle**（MI_Flare）: Burst 30 + Rate 120。ShapeLocation(Cylinder r1×h1 ＝ System 側でスケール) + SkeletalMeshLocation(Bones) → AddVelocity(Shape法線 × System.Shape Normal Velocity) + AddVelocity(System.Initial Velocity Direction × Initial Velocity)。**Buff は上昇気流、DeBuff は下降**（System 変数の符号差、CurlNoise 強度 150 vs 50）。Drag 2 + Gravity=System.Acceleration Force + InheritSourceMovement + CameraOffset 2
- **Element**（M_Energy + SubUV Linear）: Burst 30 + Rate 60、Color=System.ElementColor、ScaleColor RGB 0.5
- **Glow**（M_Glow_Capsule）: Teleport と同じ「Partitions ボーン別カプセルグロー」パターン（Once/0.25s、Lifetime 0.5）

### NS_Player_Electricity_Looping（User.Color=緑、感電状態）
- **Main_Element**（M_Energy + MI_SmokeWispy_8x8_Emissive の2レンダラー）: Buff の Element 相当 + SubUV InfiniteLoop / RandomStartFrame
- **Arcs_Secondary**（**リボン M_Ribbon_Arc + スプライト MI_Flare + デカール M_Decal_Glow** の複合）: **ビーム型リボン**。Emitter Update で SetVariables 群（BeamParticleCount / RandomBone / BeamEndRandom / BeamDirectionRandom / BeamID=LoopCount）→ ループ毎に「ランダムボーン → ランダム終点」の電弧を生成。Particle Spawn で RibbonID / RibbonLinkOrder=SpawnOrder、Particle Update で Particles.Position をカスタム dyn（FX_Player 内のスクリプト）で始点→終点補間 + ジッター。Decal_Attributes で接地グロー
- **Glow**: 例の Partitions カプセルグロー（RGB×2 の HDR）

**再現手順の要点**: ①キャラ付随 FX は「SkeletalMesh DI + SkeletalMeshLocation」を Spawn（表面発生）か Update（ボーン追従）のどちらに置くかで性格が決まる ②「Partitions + PartitionParticles + Glow カプセル」は全身グローの定番テンプレ ③電弧は SetVariables でビームパラメータをエミッター変数化 → リボンレンダラー。

---

## 5. SCRAP BLITZ UE への応用候補

1. **OCジェム/Pickup 演出の4部作パターン**（Idle=Rate+脈動グロー / 取得=Burst45吸い込み→HDRフラッシュ / 消滅=暗色弱め）は pickup FX の仕上げにそのまま流用可能。全て Stateless で組めるので大量ドロップでも軽い
2. **NS_Marker_Target の「Multiple ループ×収束リング」**は AOEテレグラフ（SBMine 型 DrawDebug 仮実装）の Niagara 本実装の教科書。DecalRenderer + ScaleMeshSize 6→1 収束が「範囲警告→着弾」の文法に一致
3. **User.Color 一本で色替え**する設計（全エミッターが Color=Binding）は、敵種別/レアリティ別の色分けを 1 システムで賄うのに有効
4. **Partitions + カプセルグロー**は METEO のバフ/OC 状態表示（プレイヤー付随 FX）に applicable。SkeletalMeshLocation(Bones) を Update に置くだけでボーン追従
5. MCP の NiagaraToolset は **Stateless エミッター非対応**（スタック空返し）— 今後 Niagara Examples を参照する際は `tools/` のパーサ（`ua_parse.py` / `ua_props.py` / `ns_digest.py`）を再利用するのが早い

## 使用ツール（再現性のため）

- MCP: `editor_toolset.toolsets.asset.AssetTools`（find_assets / get_asset_tags / load_asset / get_dependencies）、`NiagaraToolsets.NiagaraToolset_System`（GetSystemSummary / GetEmitterTopology / GetScriptStackInputValues / GetRendererData / GetSystemDependencies / GetEmitterData / GetSystemData）、`EditorToolset.EditorAppToolset`（OpenEditorForAsset）— **全て読み取り系のみ、Set/Add/Save 系は未使用**
- 自作スクリプト（`tools/` に保存）: `mcp_call.py`（MCPヘルパー、PYTHONIOENCODING=utf-8 必須）、`ua_parse.py`、`ua_props.py`、`ns_digest.py`、`player_digest.py`
