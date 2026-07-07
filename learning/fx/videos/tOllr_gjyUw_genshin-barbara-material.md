# SOURCE: 【UE5】#3 原神バーバラのスキルエフェクトを作ろう～マテリアル編～

- 動画: https://www.youtube.com/watch?v=tOllr_gjyUw （作者: tobari VFX、26:28）
- 視聴日: 2026-07-06
- シリーズ構成（全4部）: #1 メッシュ編 → #2 テクスチャ編 → **#3 マテリアル編（本ノート）** → #4 Niagara編。**#1・#2・#4 は別ノートで扱う**

> ⚠**情報源の性質に関する注記（重要）**：この動画には**音声ナレーションが実質無い**（BGMのみの画面録画）。シーンチェンジ検出でffmpeg抽出したフレーム画像**194枚（f0001〜f0194、1280x720、不等間隔）を目視で読み取ることが一次情報源**。720pのためUnreal Editorのマテリアルグラフ・パラメータパネルの文字は概ね判読可能。判読できない・自信がない箇所は「不明瞭」「推測」と明記する（捏造禁止）。本ノートは3体のSonnetサブエージェント（f0001-65 / f0066-130 / f0131-194 の3分割）の読み取り結果をメインモデルが統合したもの。

## シリーズ全体の設計図（冒頭ロードマップ画像より）

動画冒頭とチェックポイントで繰り返し表示される「ロードマップ」画像に、シリーズ全体で作る**5つのMasterMaterial×17個のMaterialInstance**の一覧が示されている：

| MasterMaterial | Blend Mode | 主な用途（日本語ラベル） |
|---|---|---|
| `M_E_TR_DF` | Translucent | 虹・五線譜（レインボー/譜面ライン） |
| `M_E_AD_MT_DF` | Additive | 音符と音符のグロー・三角のバフ・五線譜エミッシブ2種・五線譜グロー・白発光の粒子 |
| `M_E_MK` | Masked | （マスク表現全般） |
| `M_E_TR_FR` | Translucent | フレネル系（リング状グロー表/裏） |
| `M_E_MK_unq`（実際は`M_E_MK_MT_DY`） | Masked→Additive | 滴る水・水の波紋 |

`MF_UVcontrol`（実装名`UV_Control001_00`）という共通Material Functionが全MasterMaterialから参照される中核部品。命名規則: `Texture→TX`, `Mesh→SM`, `Material→Mat`, `MasterMat→MM`, `MatInstance→MI`, `MatFunction→MF`。

## 中核部品: Material Function `UV_Control001_00`（全マテリアル共通のUV制御関数）

段階的に構築される様子が確認できた：
1. `Input RotationAngle(Scalar)` → `CustomRotator`（UVs/Rotation Center/Rotation Angle(0-1)入力、Rotated Values出力）
2. `TexCoord[0]` → `Multiply`（`Append`でScale_U/Scale_Vを合成）→ `Panner`（Coordinate/Time/Speedに`Append`でSpeed_U/Speed_Vを合成）→ `Add`（`Append`でOffset_U/Offset_Vを合成）→ CustomRotatorへ
3. 最終的に**7つのFunction Input**が確定: `Offset_U / Offset_V / Scale_U / Scale_V / Speed_U / Speed_V / RotationAngle`、出力は`Result`
4. 各Inputノードの**Sort Priority**値でMaterial Instance側のパネル表示順を制御（昇順で意図した並びにする）

**この「Pan+Scale+Rotateを1関数に集約し、Sort Priorityで見た目の並びも揃える」パターンは、既存fx doctrineのマテリアル定型に対する具体的な実装例として価値が高い。**

## MasterMaterial構築の流れ（BlendMode別に3パターン確認）

### 1. `M_E_TR_DF_001_00`（Translucent、最初のMM）
- `UV_Control001_00`出力 → 2つの`Multiply` → `Texture_RGB`（Param2D）・`Texture_Alpha`（Param2D）
- Particle Color・Vertex Colorをテクスチャに乗算
- `Power`→`CheapContrast`（In/Exp→Result）でコントラスト調整、`DepthFade`ノード追加
- Details: Material Domain=Surface, **Blend Mode=Translucent**, Shading Model=**Unlit**, Two Sided=**チェック**
- パラメータは全て数値プレフィックス付きでリネーム（`01_Offset_U`, `02_Scale_U`...）、Groupも`00_Texture`のように数値プレフィックスで整理
- 派生MI: `MI_Skill_003_00`（虹）、`MI_Skill_002_00`、`MI_Skill_007_00`、`MI_Skill_008_00`/`_01`（五線譜・音符・音符グロー）、`MI_Skill_006_00`（白発光粒子、Scale_U/V=1.0でタイリング無効化した単発ラジアルグロー）
- **RGBテクスチャを`T_1pixel_C`（白1px）に差し替えてAlphaマスクのみで形状を出す**手法が繰り返し使われている（色はVertex Color/Particle Color側で入れる設計と推測）

### 2. `M_E_AD_DF_MT_001_00`（Additive、2番目のMM）
- **UV_Control001_00を2系統並列**（Offset_U/V違いのみ、他パラメータは共通指定）→ それぞれ独立にTexture_Alphaをサンプル → Multiplyで合成 → Emissive Color/Opacity
- パラメータ命名: 2系統目は全て`02`サフィックス（`Offset_U02`, `Scale_U02`, `Power02`, `Contrast02`...）
- 用途: 2枚のUVアニメーションを重ねて複雑な揺らぎ・二重発光パターンを作る（ノートに"多層パン"技法として記録）

### 3. `M_E_MK_001_00`（Masked）
- Masked設定では**DepthFadeが使えないため削除**、Opacityは`OpacityMask`に配線し直す、というキャプション付き訂正が確認できた（重要な実装上の注意点）

### 4. `M_E_TR_FR_DF_001_00`（Translucent、フレネル）
- 新パラメータグループ`05_Frenel`（表記ママ、Fresnelの誤記の可能性）: `FrenelPower`（0.5→0.48）・`FrenelTexture`（T_E_BS_010_00_A）
- Preview MeshをCylinder（`SM_Cylinder_002_01`）に切り替えて縦グロー確認
- キャプション訂正: 「フレネル処理のテクスチャの繰り返し設定をClampにする」（タイリングアーティファクト回避、これは他のテクスチャでも繰り返し言及される注意点）
- 「フレネルなのでTwoSideのチェックは外す」という訂正キャプションも確認（前段のMMとは逆の設定）

### 5. `M_E_MK_MT_DY_001_00`（波紋、最終MM・Niagara連携あり）
- Blend Mode=**Additive**、Param2Dが3つ（RGB/Alpha01/Alpha02）、**Dynamic Parameter（Niagaraから駆動）ノードあり**
- 出力: Emissive Color / Opacity Mask / World Position Offset / Pixel Depth Offset
- 新規SMアセット`SM_Ring_001_00`（トーラス）が登場、地面波紋用と推測
- 派生MI `MI_Skill_011_00`のプレビューで、Power02を負値（-0.654）にしてリング状の輪が外側に広がる波紋マスクを確認

## Content Browser資産インベントリ（確認できた範囲）

- **MI folder**: MI_Skill_002_00, 003_00, 006_00, 007_00, 008_00/_01, 009_00, 010_00, 011_00
- **MM folder**: M_E_TR_DF_001_00, M_E_AD_DF_MT_001_00, M_E_MK_001_00, M_E_TR_FR_DF_001_00, M_E_MK_MT_DY_001_00
- **MF folder**: UV_Control001_00
- **SM folder**: SM_Cylinder_001_00/002_00/002_01, SM_Ring_001_00, DefaultMesh
- **Tex folder**: T_E_BS_001〜010番台（A=マスク/C=色）シリーズ、T_1pixel_A/C（プレースホルダ）

## 動画終端

f0192で暗転後、最終フレーム（f0193/f0194）は**Unreal Editorでなく、原神本編のゲームプレイスクリーンショット**（バーバラがパン屋の屋台でNPC2人と会話するシーン）で終わる。ナレーションが無いためこれが「元ネタ参照」なのか単なる締めのカットなのかは断定できない（不明瞭）。

## 学習部屋の既存fx doctrine（`fx_technique_doctrine.md` v2.2）との比較・新規性

1. **UV制御の1関数集約パターン**（`UV_Control001_00`）: doctrineの「マテリアル定型」節には無い具体的な実装（Panner+CustomRotator+Multiply/Add、7入力、Sort Priorityでパネル整理）。汎用UVアニメーション関数の設計として**doctrineへの追記候補が高い**。
2. **同一UV_Control関数を2系統並列（Offsetのみ違い）して合成する多層パン技法**（Additive MM）: doctrineの「層分け」節（RendererVisibilityタグ/ブレンドモード分離）とは異なる、**マテリアルグラフ内での多重サンプリング合成**という切り口。
3. **BlendMode別の実装上の罠**: Masked=DepthFade不可・OpacityMask配線必須、Fresnel=TwoSided外す、という2点は実装ミスを未然に防ぐ具体的知見でdoctrineに無い。
4. **RGBテクスチャを白1pxに差し替えてAlpha形状のみ使う手法**: 色をVertex Color/Particle Color側に委ねる設計。doctrineの「グロー勾配」節と関連するが、色分離の具体的手段としては新規。
5. **Dynamic Parameter（Niagara駆動）を持つMasked→Additiveマテリアル**（波紋MM）は、次のNiagara編（#4）でどう駆動されるかを見る前提の伏線。doctrineの「Dynamic Material Parameterも同じ、侵食の経時進行はUpdate側必須」という既存記述と直接対応する実例。

## 判読不能・不明瞭だった箇所

- Material Functionグラフ内の細かいノード接続順（ズームアウト時は視認できるが、個別ノードの正確な入出力ピン対応は一部推測）
- `M_E_MK_MT_DY_001_00`のDynamic Parameterノードの具体的なIndex/用途（#4 Niagara編側の記述と突き合わせる必要あり）
- Fresnelパラメータグループ名の正確な綴り（"Frenel"と表示されていたが、Fresnelの意図的な省略か単なる誤記かは不明）
- 動画終端の原神ゲームプレイ画面が持つ意図（参照カットか単なる締めか）
