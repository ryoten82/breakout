# 学習ノート — Epic公式コース「Introduction to Materials」（UE5.5、全11モジュール）

- 元コースURL: https://dev.epicgames.com/community/learning/courses/VRo/unreal-engine-introduction-to-materials/
- **ソース種別：Epic公式コースの配布スライドPDF**（動画のCC字幕ではなくスライド資料が一次情報源。コースページ自体はSPAでWebFetch不可のため長らくスキップ扱いだったが、Chrome拡張導入によりコースページから正式配布されているスライドPDFを取得できた）
- 学習日: 2026-07-07 / 抽出: PDF本文抽出（pdftotext）→ Sonnet単独要約（監査待ち）
- PDFはスライドの見出し・箇条書きが中心で、地の文の説明はほぼ無い（講師が口頭で補う前提の資料）。そのため本ノートは箇条書きの意図を汲んで文章化した要約であり、逐語再現ではない

## コース構成（4パート・11モジュール）

1. **Getting Started**: Real-Time Material Concepts（Materialとは何か・PBRとは何か）／Primary Nodes and Textures
2. **Materials Foundations**: Material Editor Interface／Organizing Materials／Material Editor and Parent Material Creation
3. **Animating Materials**: Animating Materials Part 1〜3（Diffuse/Spec→Rough→Normal/AOの順に1枚の水マテリアルを組み上げる実習）
4. **Wrap Up**: Cloth Materials／Outro

既存の [material-concepts-and-properties.md](material-concepts-and-properties.md)（Material Domain/Blend Mode/Shading Modelの体系一覧）と重複する基礎説明は本ノートでは繰り返さない。本ノートの独自価値は **Part3「Animating Materials」の実習手順（Pannerでの水面アニメーション構築）** と **Cloth Shading Model** にある。

---

## Primary PBR Inputsの実務上の勘所（既存ノートへの補足）

既存ノートはBase Color/Metallic/Roughness/Specularの定義列挙が中心だったが、本コースでは各パラメータの「実務でどう扱うか」の指針が示されている。

- **Specular**: デフォルト0.5のままでほぼ問題なく、代わりに**Roughnessを調整する方が優先度が高い**という考え方（Specularを弄るのは誇張的・非現実的な光沢を出したい時の例外的手段という位置づけ）
- **Metallic**: 実質0か1のバイナリ的な使い方が主流（0.5等の中間値は特殊ケース）。Roughnessのように連続値で追い込む対象ではない
- **テクスチャ解像度**: 2のべき乗必須（16〜8192）。正方形である必要はなく、16×128や2048×1024のような非正方形も許容

これは`materials_technique_doctrine.md`のMI量産手順・プロキット最小構成の実務判断に「どのパラメータを追い込むべきか」の優先順位として補足できる。

---

## Material Editorのショートカット一覧（実務効率化）

ノード配置の主要ホットキー:

| キー | ノード |
|---|---|
| U | TexCoord |
| B | BumpOffset |
| N | Normalize |
| M | Multiply |
| D | Duplicate |
| L | LERP |
| E | Power |
| R | Reflection Vector |
| **P** | **Panner** |
| **S** | **Scalar Parameter** |
| T | Texture Sample |
| 1/2/3/4（テンキー） | 各種定数バリアント |

[material-instances.md](material-instances.md)に既出のS（Scalar）/V（Vector）パラメータキーと合わせて、**P（Panner）**が今回新たに確認できたホットキー。UVアニメーションを組む頻度を考えると、Pannerノードの配置速度に直結する実務知識。

---

## Panner ノードによるマテリアルアニメーション（本コースの中核・実習パート）

Part3「Animating Materials」は、河原の石（River Stones）テクスチャセットと雨滴（Raindrop）テクスチャセットを使い、**1枚の「濡れた岩肌」マテリアルをレイヤー合成で組み上げる実習**になっている。手順を機能単位で整理すると：

1. **Diffuse（Base Color）**: 石のDiffuseをそのままBase Colorに接続
2. **Metallic層**: 雨滴テクスチャのUVにPannerを繋いでUV自体を時間でスクロールさせ、雨滴のAlpha的な情報と石のMetallic値をMultiply→Add で合成し、Metallic入力に接続。「濡れて光る部分だけ金属的に振る舞う」効果を、テクスチャの動きで表現する
3. **Roughness層**: 石のRoughnessテクスチャとScalar Parameterのstrength値をMultiplyし、そこに**別系統のPanner**（雨滴Metal02のUV）をBlend Overlayで重ねる。さらに任意でもう1系統（Waterfall Wavesテクスチャ+別Panner）をAddで足し込み、動きの層を増やせる
4. **Specular層**: 2つの雨滴系Pannerの出力をLERPで混ぜ、その結果と石のベーステクスチャをMultiply/Addで合成してSpecularに接続。「濡れている部分だけ強くハイライトが乗る」演出
5. **Normal層**: `BlendAngleCorrectedNormal`ノードで石のNormal（ベース）と雨滴のNormal（追加）を角度補正しながらブレンドし、雨滴側のUVにだけPannerを追加してアニメーションさせる
6. **AO層**: 雨滴用に別のPannerを立て、石のCavity/AOとMultiplyで合成後、さらにもう一段Multiplyで雨滴のAOを掛け合わせてAmbient Occlusionに接続

**この手順全体を貫く設計思想**: 「1本のPanner付きUV系統＝1つの動く要素」を、Metallic/Roughness/Specular/Normal/AOそれぞれの入力チャンネルに**独立して**差し込み、Multiply/Add/LERP/Blend Overlayで合成する。1つの水面マテリアルの中に**複数系統のPannerが並列で走る**構造であり、雨滴の動き・波の動きなど異なる周期・方向のアニメーションを層として積める。

### fx doctrine・原神バーバラノートとの関連（新規性の評価）

学習部屋には既にPannerを使ったUVアニメーション技法として、[fx/videos/tOllr_gjyUw_genshin-barbara-material.md](../../fx/videos/tOllr_gjyUw_genshin-barbara-material.md)に記録された `UV_Control001_00`（Panner + CustomRotator + Multiply/Add を1つのMaterial Functionに集約し、7つのFunction Inputで制御する設計）がある。両者を比較すると：

- **共通点**: どちらも「Pannerでスクロールさせたテクスチャを複数系統合成し、複雑な動きを作る」という基本発想は同じ
- **相違点（新規性）**: 原神バーバラノートの`UV_Control001_00`は**1つの再利用可能なMaterial Functionに汎用UV制御をまとめ、複数のマテリアルから使い回す**設計（Offset/Scale/Speed/Rotationを7パラメータで一元管理）。対して本コースの水マテリアル実習は、**PBR入力チャンネル（Metallic/Roughness/Specular/Normal/AO）ごとに個別のPannerを都度配置する**、より直接的・教育的な組み方になっている。**Material Functionへの集約という設計上の一段上の抽象化**は原神バーバラノート側にのみ存在し、本コースはその「土台」にあたる基礎的な組み方を示している
- **doctrineへの位置づけ**: `fx_technique_doctrine.md`の「UV制御1関数集約」パターンの理解を補強する具体例として、本コースの「PBR入力ごとにPanner系統を分ける」手順は**初学者向けの分解ステップ**として参照価値がある（いきなり関数化する前に、まず各チャンネルで何を動かしたいかを個別に組んでみる、という手順として）

---

## Parent Material（Master Material）とMaterial Instanceの作成手順

[material-instances.md](material-instances.md)には「なぜMaterial Instancingをするか」という概念とパラメータノードの作り方（S/Vキー）は既出だが、本コースは**実際にParent Materialを新規作成する時の作業順**をスライドで示している：

1. Albedo（Base Color）を単純な定数でなく**3成分Constant Vector（RGB）でパラメータ化**すると、Instance側で選べる色の自由度が上がる
2. Metallicパラメータの例: `Name: Metallic / Group: Metallic / Default: 0.0 / Min: 0.0 / Max: 1.0` という設定値が具体例として示されている（グループ名とパラメータ名を一致させる命名の一例）
3. **Roughnessの「レンジ拡張」テクニック**: Multiplyノード経由でScalar Parameterを掛けると、Addノードだけの場合の0〜1制限を超えて、より広い範囲（例として0〜10）でRoughnessの強さを調整できる。Multiply経由かAdd経由かで実効レンジが変わる点は、単純なAdd接続をしていると見落としやすい実装上の注意点
4. Material Instance側の調整は**再コンパイル不要で即座に反映される**（Parent側のみ再コンパイルが必要という前提の再確認）

Parameter GroupsやSort Priorityの詳細は[material-instances.md](material-instances.md)側に既述のため本ノートでは繰り返さない。

---

## Cloth Shading Model（学習部屋に新規の情報）

既存の[material-concepts-and-properties.md](material-concepts-and-properties.md)ではShading Model 13種を名称列挙するに留まっていたが、本コースは**Clothの内部挙動と設定手順**を実習ベースで扱っている点で新規性が高い。

### Clothモデルの仕組み

Cloth Shading Modelは「fuzz layer（毛羽立ち層）」をシミュレートし、布らしい質感（光の透過による色味の変化）を再現する。専用の2入力:

- **Fuzz Color**: 光が布を透過する際の色シフトを表現する入力
- **Cloth**: Fuzz Colorの強さを制御するマスク値。0でFuzz Colorの寄与なし、1でBase Colorに完全に覆いかぶさる

### セットアップ手順

1. 新規マテリアル作成、**Blend ModeをMasked**に設定
2. 布用テクスチャセットをドラッグ&ドロップ
3. Diffuse（Base Color）テクスチャのAlphaチャンネルを**Opacity Mask**に接続（Maskedモードなので不透明部分の切り抜きに使う）
4. Cavity（陰影凹凸）とGloss（光沢）テクスチャをAddノードで合成し、**Metallicノードに接続**（光沢のある布地・ストレッチ素材のような見た目にしたい場合の手法として紹介）
5. Fuzz ColorとClothの各入力には布のColorテクスチャ（または任意の色情報）を接続
6. Normalマップを追加
7. **Two Sidedを有効化**（布は薄いメッシュで両面が見える前提のため）

### 関連ノート・doctrineとの接続

- 布のCloth Shading Modelは、`materials_technique_doctrine.md`の必須3設定（Domain/Blend Mode/Shading Model）の実例として、**Masked + Cloth**という具体的な組み合わせを提供する新情報
- fx doctrineの原神バーバラノートでは`M_E_MK_001_00`（Masked、DepthFade不可・OpacityMask配線必須という実装上の罠）が記録されているが、こちらは**汎用マスク表現**でCloth特有のFuzz機能は使っていない。Cloth Shading Model自体はFXドメインというより衣装・キャラメッシュ寄りの用途と考えられる（本コースでも布地・服の質感向けとして紹介されている）
- SCRAP BLITZ UEでキャラの衣装・マント等の布表現をする場合、Two Sided + Masked + Cloth Shading Modelという組み合わせが選択肢になり得る。ただし**実際に布メッシュ・薄手のケープ等の表現要件があるかは未確認**であり、現時点では「引き出しとして持っておく」段階の情報

---

## ソースの限界

- 本PDFは**配布スライドのみ**であり、講師の口頭解説（各手順の「なぜ」の部分）は含まれていない。Panner合成の各段でMultiply/Addのどちらを選ぶ理由、Cloth Metallic合成の意図など、スライドの箇条書きから読み取れる範囲でしか記述できていない
- 実習パートは「テクスチャ名（River Stones、T_Rdrops_Sm、T_Rdrops_Metal02、WaterfallWaves等）」がMegascansのサンプルアセットに依存しており、具体的なノードグラフのスクリーンショット自体はPDF内に画像として存在するが、本ノートはテキスト抽出のみで作成しており画像内の正確なノード接続までは検証していない
- Material Editor Interface（Preview Window操作・Route Node管理・Named Route Declaration Node等の「Organizing Materials」節）は、スライドタイトルのみで内容が空白（実演のみで完結するスライド）だったため本ノートには含めていない
- Parameter Groups・Sort Priorityの詳細な設定値は本PDFにはほぼ記載がなく、既存の[material-instances.md](material-instances.md)の記述を参照する形とした
