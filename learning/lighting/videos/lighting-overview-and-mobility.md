# 学習ノート — Lighting the Environment / Light Types and Their Mobility

- ソース1: [Lighting the Environment in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/lighting-the-environment-in-unreal-engine?lang=en-US)（目次的ハブページ）
- ソース2: [Light Types and Their Mobility in Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/light-types-and-their-mobility-in-unreal-engine?lang=en-US)（具体的詳細ページ）
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/lighting-the-environment.md](../transcripts/lighting-the-environment.md) / [../transcripts/light-types-and-mobility.md](../transcripts/light-types-and-mobility.md)

lighting ドメイン1本目。目次的ページ（全体マップ把握用）と実質ページ（Light Type/Mobilityの基礎）を1本に統合。

## UE5 ライティングシステムの全体マップ

Lighting the Environment ページはハブ的性格で、以下のカテゴリ名を列挙するのみ（各カテゴリの中身の詳細な説明は原文になし）:

- **Lighting Features** — Lumen（dynamic global illumination and reflections）、Virtual Shadow Maps（大規模ワールド向け高解像度シャドウ）
- **Lighting Essentials** — 基礎概念。本ノートが扱う「Light Types and Their Mobility」、および「Direct Lighting」（ライトのプロパティ・機能）
- **Lighting Features and Tools** — 環境ライティングシステム（fog/clouds/sky/atmosphere）、グローバルイルミネーションの選択肢、mesh distance fields、ray tracing、シャドウイング手法、reflection capture システム
- **Lighting Tools and Plugins** — Contact Shadows・Capsule Shadows（skeletal mesh 向けソフトシャドウの専門ツール）
- **General** — post-process効果、volumetric fog、light shafts、マテリアル透明度、bump offset、IES light profiles、HDRI Backdrop Visualization Tool

このノートで扱う「Light Types and Their Mobility」は上記の中では **Lighting Essentials（基礎概念）** に位置づけられる。つまりLumen・VSM・reflection captureといった上位機能群を使う前提として、まずライトの種類とmobilityを理解する、という積み上げ構造。原文はこの位置づけを図や相互参照リンクでは示しておらず、カテゴリ名の並びから読み取れる範囲に留まる。

## Light Type 5種の使い分け

大規模ライティング（シーン全体を覆う光）と局所的ライティング（特定オブジェクト周辺の光）の2群に分かれる。

**大規模ライティング:**
- **Directional Lights** — "the primary outdoor light, or any light that needs to appear as if it's casting light from extreme, or near infinite, distances."（太陽光の定番）
- **Sky Lights** — シーン背景をキャプチャしてレベルジオメトリに適用する

**局所的ライティング:**
- **Point Lights** — 1点からの全方向光源
- **Spot Lights** — 1点からの円錐状の指向性光源
- **Rect Lights** — 矩形面からの投光

原文は各タイプの用途をこの一文程度の説明に留めており、パラメータの詳細（減衰カーブ・Source Radius等）や使い分けの具体的な判断基準までは踏み込んでいない。

## Light Mobility 3状態とトレードオフ

各ライトは以下3つのmobility設定を持ち、パフォーマンスと機能性が決まる。

1. **Static** — 一切動かない・変化しないライト。事前計算済みライトマップに寄与するが、movable objectへのdynamic shadowはサポートしない
2. **Stationary** — 位置は固定だがゲームプレイ中に色・強度などのプロパティは変更可能。movable actorへのdynamic shadowをサポートするが、**1オブジェクトあたり最大4灯まで**という制限がある
3. **Movable** — ゲームプレイ中に追加・削除・再配置が可能。dynamic shadowのみをキャストし、shadowing有効時はパフォーマンスコストが高い。ただしnon-shadowing版は比較的軽量

Mobilityの選択はパフォーマンス・見た目の品質・設計上の柔軟性のトレードオフに直結する。原文はこの3行の説明に留まり、「実際のコスト差が何ms相当か」「Stationaryの4灯制限に達した場合に5灯目がどう扱われるか（無視/フォールバック/警告）」といった定量的・実装的な深掘りはない。

## SCRAP BLITZ に活かせる部分

既存の `bg_technique_doctrine.md` §11「影の設計」（CSMは近景に絞り、遠景はDistance Field Shadows、巨大構造物のみFar Cascade opt-in、重いライト点検5種）は、**すでにライトが配置された後のシャドウ手法の最適化**を扱っている。本ソースはその一段手前、**ライトそのものの選定とmobility設定**を扱っており、両者は競合せず前提レイヤーの関係にある。

- **Stationary の4灯制限は既存ドクトリンに無い新規情報。** §11の「重いライト点検5種」はMaxDrawDistance未設定・Intensity0常時描画・Attenuation過大・不要shadow cast・Light Function誤用の5点だが、「1オブジェクトが受けられるStationaryライトは最大4灯」という上限そのものには触れていない。L_Stage01（廃工場・廃滑走路ヤード）のような複数光源が競合するシーンで、同一オブジェクト付近にStationaryライトを積み増す際の設計制約として点検リストに追加する価値がある
- **Directional Lightsの位置づけの再確認** — 太陽光の定番として明記されている。既存ドクトリンの「遮光用の巨大Cube」（Medieval動画由来、`ee-IOlWUZTo_ue5-environment-tutorial.md`）はDirectional Lightを前提にした画面内制御手法であり、本ソースの記述と矛盾しない
- **Movableのshadowingコスト言及** — 「shadowing有効時はパフォーマンスコストが高い、non-shadowing版は軽量」という区別は、§11の重いライト点検の考え方（不要shadow castを削る）と方向性が一致する。動的に動く光源（例: 車両のヘッドライト等を将来追加する場合）を検討する際は、まずnon-shadowing Movableで足りないか検討する、という判断軸が補強される

## ソースの限界

- **Lighting the Environment はカテゴリ名の列挙止まり。** 各機能（Lumen、VSM、reflection capture等）の中身の説明は原文になく、本ノートでも詳細を書いていない。これらは別途専用ページを読む必要がある
- **Light Types and Mobility は5行程度の説明×2セットに留まり、定量的なコスト差の深掘りはない。** 具体的には以下が原文に無い:
  - 各Light Type（Point/Spot/Rect等）の詳細パラメータ（Source Radius、減衰カーブ等）
  - Static/Stationary/Movableの実際のレンダリングコスト差（ms単位の目安等）
  - Stationaryの「4灯制限」に達した場合の具体的な挙動（5灯目が無視されるか、警告が出るか等）
  - Directional Light・Sky Lightの「大規模」とPoint/Spot/Rectの「局所的」という分類以上の使い分け基準
- 上記はいずれも原文に記載がないため本ノートでは推測・補完していない。※一般知識で補足すべき箇所は無し（該当なしのため明記省略ではなく、今回は一般知識補足を使用しなかった）
