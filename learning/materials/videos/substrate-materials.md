# 学習ノート — Substrate Materials（UE5.8 新マテリアルフレームワーク・Beta）

- ソース: [Substrate Materials in Unreal Engine (hub)](https://dev.epicgames.com/documentation/en-us/unreal-engine/substrate-materials-in-unreal-engine) / [Overview of Substrate Materials in Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-substrate-materials-in-unreal-engine)
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/substrate-materials-overview.md](../transcripts/substrate-materials-overview.md)

---

## Substrate とは（Beta機能）

**重要: Substrate は UE5.8 時点で Beta 機能である。本番環境での使用には注意が必要（原文に明記）。**

Substrate は、Default Lit や Clear Coat のような「固定的なシェーディングモデルとブレンドモード」を、より表現力豊かでモジュール化されたフレームワークに置き換える、UE5 のマテリアルオーサリングへの新アプローチ。

Core Concept として、マテリアルは "slabs of matter"（物質の薄層）として概念化され、interface と medium で構成される。metallic や specular のような抽象値ではなく、**物理量でパラメータ化**される点が従来体系との根本的な違い。

### 有効化
- UE 5.7+ の新規プロジェクトでは**デフォルトで有効**
- 既存プロジェクトは Project Settings > Rendering からオプトイン可能
- 既存の非 Substrate マテリアルはそのまま動作するが、Substrate ネイティブの恩恵を受けるには明示的な変換が必要（原文: Compatibility 節）

---

## 従来体系（Blend Mode/Shading Model）との関係 — 既存ノートとの接続

既存ノート [`material-concepts-and-properties.md`](./material-concepts-and-properties.md) は、Blend Mode 7種・Shading Model 13種という「マテリアルの用途を固定パターンの中から選ぶ」レガシー体系をまとめたものだった。

Substrate はこのレガシー体系を**置き換える**新フレームワークという位置づけ（原文: "replaces the traditional fixed shading models and blend modes... with a more expressive, modular framework"）。ただし、以下の点は原文からは明確な対応関係が読み取れない。

- レガシーの Shading Model 13種（Default Lit, Clear Coat, Subsurface 等）が Substrate 側の何に個別対応するのか、原文には詳細な対応表がない。Substrate 側では代わりに BSDF ノード（Slab, Eye, Hair, Clear Coat 等）で表現する、という粒度の記載にとどまる。
- Blend Mode については、Substrate 側も「8種類（translucent + opaque）」として Masked・Additive・Colored Transmittance・AlphaComposite 等が存在すると原文にあるが、レガシー7種との一対一の対応かどうかは原文からは断定できない。

**Beta 機能であることを踏まえると**、現行プロジェクトがどちらの体系で動いているかは実装判断に直結する（詳細は後述「SCRAP BLITZ に活かせる部分」）。

---

## GBuffer Formats の選択（Blendable vs Adaptive のトレードオフ）

Substrate では GBuffer の格納方式を2種類から選択する（Programmer Guides: Programming with Substrate GBuffer Formats）。

| Format | 特性 |
|---|---|
| **Blendable GBuffer** | パフォーマンス重視。メモリフットプリントが固定。レガシーマテリアルに近い挙動 |
| **Adaptive GBuffer** | 視覚的忠実度を優先。複雑なシェーディングをサポートするが、パフォーマンスコストは高い |

トレードオフの軸は「固定コスト・レガシー互換寄り」か「表現力・可変コスト寄り」かの二択。どちらを選ぶべきかの具体的な判断基準（例: ターゲットプラットフォーム別の推奨値、閾値となるマテリアル複雑度）までは原文に記載がない。

---

## Material Node Types（BSDF/Operator/Building Blocks/Extras/Helpers）

Substrate のマテリアルグラフは5種類のノードカテゴリで構成される。

| カテゴリ | 内容（原文列挙） |
|---|---|
| **BSDF nodes** | Slab, Eye, Hair, Clear Coat 等 |
| **Operator nodes** | Coverage Weight, Horizontal Blend, Vertical Layer, Add, Select |
| **Building Blocks** | 事前設定済みの material function |
| **Extras** | Decal, Light Function, Post Process, UI |
| **Helpers** | 変換・ユーティリティノード |

Slab が中心的な BSDF ノードで、前述の「slabs of matter」という Core Concept と対応していると読める。Operator ノード（Horizontal Blend / Vertical Layer 等）で複数の Slab を組み合わせて layered マテリアル（例: クリアコート上塗りのような表現）を作る設計だと推測されるが、各ノードの入出力ピンや具体的な組み方は原文（要約止まり）には記載がない。

---

## パラメータ化の変化（Metallic/Specular → F0/Diffuse Albedo）

レガシー体系では Metallic・Specular という抽象的なスカラー/値でマテリアルの反射特性を表現していたが、Substrate では **F0（垂直入射時の反射率）・Diffuse Albedo** という物理量でパラメータ化する（原文: Parameterization 節）。

原文が明記する利点は「エネルギー保存を維持しながらより柔軟性を提供する」の一点。F0 の具体的な値の決め方（金属・非金属それぞれの目安値など）は、hub 側の Developer's Blog 一覧に「F0の適切な値の見つけ方」という個別記事タイトルが存在することが確認できるのみで、その記事本体の内容までは今回のソースに含まれていない。

---

## パフォーマンス最適化（Parameter Blending・自動簡略化）

- **Parameter Blending**: 複数の slab を統合し、ランタイムコストを削減する仕組み
- **予算上限超過時の自動簡略化**: マテリアルが定められた予算を超えると、自動的に簡略化が発生する
- **デバッグ可視化モード**: パフォーマンスのボトルネックを特定するための可視化モードが存在する

いずれも原文では概要レベルの記載にとどまり、Parameter Blending が具体的にどのタイミング（コンパイル時/ランタイム時）で発生するか、予算上限の具体的な数値や設定箇所、可視化モードの呼び出し方（コンソールコマンド名など）までは記載がない。

---

## SCRAP BLITZ に活かせる部分

**前提として、Substrate は Beta 機能である。** 以下はいずれも「検討候補」であり、Beta 機能を本番プロジェクトへ積極導入すべきという結論ではない。

1. **現行プロジェクトがどちらの体系か、未確認**
   SCRAP BLITZ は UE5.8 で開発中であり、原文の通り UE5.7+ の新規プロジェクトは Substrate がデフォルト有効になっている。一方、既存ノート `material-concepts-and-properties.md` はレガシー体系（Blend Mode 7種・Shading Model 13種）を前提にフォグ材（Translucent）等の記述をしていた。**このプロジェクトが実際に Substrate 有効な状態でマテリアルを作っているのか、それともレガシー体系のままなのかは、今回のソース調査だけでは判別できない。** Project Settings > Rendering の Substrate 設定を確認しないと断定できない事項であり、本ノートでは断定しない。

2. **ガラス・金属質感への Slab/BSDF 活用の可能性**（※一般知識で補足: 本ソースはガラス・金属材の具体例を挙げていない。以下は「物理量でパラメータ化」「エネルギー保存」という原文の一般的記述からの推測）
   廃工場・廃滑走路といった SCRAP BLITZ の舞台設定には、ガラス（割れた窓等）・金属（機体外装、錆びた構造物）の質感表現が必要になる場面が想定される。Substrate の Slab BSDF や F0/Diffuse Albedo による物理量パラメータ化は、こうした質感の作り込みに有効な可能性がある。ただし、ガラス材や金属材の具体的な作例・ノード構成手順は本ソースに含まれていない（当初参照予定だった Substrate Glass Tutorial は今回未取得）。

3. **導入判断は Beta のリスクとセットで検討すべき**
   仮に Substrate へ移行する場合、GBuffer Format の選択（Blendable/Adaptive）やパフォーマンスコストが既存の描画パイプラインに影響しうる。Beta 機能ゆえに将来のエンジンアップデートで仕様が変わるリスクも考慮した上で、実際に導入するかどうかは別途の検証（現行プロジェクトの Substrate 有効状態の確認、対象アセットでの試作）を経てから判断すべき段階と考えられる。

---

## ソースの限界

- 本ソースは hub ページと Overview ページの WebFetch 要約を統合したものであり、公式ドキュメントの完全な原文（各ノードの入出力仕様、コードサンプル、図版）は含まれていない。
- ユーザーが当初参照を意図していた元チュートリアル「Create Realistic Glass Material - Substrate Glass Tutorial」はSPAのため直接取得できず、Substrate 材システム自体の公式ドキュメントで代替した。**ガラス材の具体的なノード構成手順そのものは本ソースに含まれない。**
- hub の Developer's Blog セクションには「A Deep Dive on Substrate Materials」という詳細学習コースの記事タイトル一覧（F0/F90/Specular Color の理論、Simple Dielectric Materials、Gemstones/Metalloids/Semiconductors、Conductors、F0の適切な値の見つけ方、Thin Film Interference/Secondary Roughness、Mean Free Path、BSDFレイヤリングとSubstrate Operators、Metallic Representationと補間、Fuzzy Shading）が確認できるが、各記事の本文内容は今回取得していない。F0 の実務的な決め方や BSDF レイヤリングの具体手順が必要な場合は、これらの個別記事を別途参照する必要がある。
- レガシー体系（Shading Model 13種）と Substrate の BSDF ノードとの対応関係は、原文に明示的な対応表がなく、本ノートでも断定を避けた。
- Blend Mode「8種類」の内訳は Masked・Additive・Colored Transmittance・AlphaComposite の4つのみ原文に名前が挙がっており、残り4種の名称は本ソースからは特定できない。
- 本ノートはまだ Fable 監査を経ていない。
