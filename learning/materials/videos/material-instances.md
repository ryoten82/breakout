# 学習ノート — Creating and Using Material Instances in Unreal Engine（Epic公式ドキュメント）

- ソース: https://dev.epicgames.com/documentation/en-us/unreal-engine/creating-and-using-material-instances-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch（公式doc） → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/material-instances.md](../transcripts/material-instances.md)

## Material Instancing とは（2段階プロセス）

Material instancing は、開発者がカスタマイズ可能なプロパティを持つ親 Material を作成し、それを子の Material Instance が継承できるようにするワークフロー最適化テクニックである。

プロセスは以下の2段階:
1. パラメータノードを使って「パラメータ化された」親マテリアルを作成する
2. Content Browser で Material Instance Constant を作成する

## パラメータノードの作り方（Scalar/Vector Parameter・ショートカットキー・Convert to Parameter）

パラメータノードは、マテリアル属性を編集可能にする特殊ノード。

- **"Scalar Parameter" と "Vector Parameter" にはそれぞれ S キー・V キーのショートカットがある**（配置を素早く行うため）
- パラメータ化マテリアルの作成は、Material Palette から追加するか、既存ノードを右クリックして「Convert to Parameter」を選択することでパラメータを追加できる
- Details パネルでデフォルト値・値の範囲を設定できる

## Parameter Groups による整理（Sort Priority含む）

**Parameter Groups**: 関連パラメータをグループ化することで、特に複雑な master Material の可読性が上がる。グループはアルファベット順、または Sort Priority 値による順序付けが可能。

また、Material Instance Editor の General プロパティから Instance の親 Material を変更できる。ただし、変更すると利用可能なパラメータが変わる可能性がある。

## 実例（BaseColor/Roughness/Metallic）

BaseColor（Vector）・Roughness・Metallic（いずれも Scalar）の3パラメータを使ったシンプルな例を通して、単一の base Material から多数の見た目バリエーションを artist が生成できることを示している。

## SCRAP BLITZ に活かせる部分

`bg_technique_doctrine.md` および個別動画ノート（[ee-IOlWUZTo_ue5-environment-tutorial.md](../../bg/videos/ee-IOlWUZTo_ue5-environment-tutorial.md)）では「MI 化して個体ごとに調整」という手法が既に複数回登場している（自作フォグ平面の Opacity/Fade Distance 調整、Megascans 系の Color Overlay/Albedo Tint 変更など）。本ソースは、その「MI 化」という言葉が指す**具体的な作業手順**の裏付けにあたる。

- **S/V キーでのパラメータ配置**: フォグ平面マテリアルや Landscape マテリアルの tiling パラメータなど、既存ドクトリンで既に「MI 化する」と書かれている箇所は、この S（Scalar）/V（Vector）ショートカットを使えば配置作業自体が速くなる。Opacity・Fade Distance・tiling 値はいずれも Scalar Parameter（S キー）、BaseColor 系のトーン調整は Vector Parameter（V キー）に対応する
- **Convert to Parameter**: 既にノードを組んでから「後でこの値だけ個体ごとに変えたい」と気づいた場合、ノードを作り直さず右クリックで Convert to Parameter すればよい。フォグ平面やタイリング対策のように、まず固定値で組んでから汎用化する開発順序と相性が良い
- **Parameter Groups + Sort Priority**: 自作フォグ平面のように Opacity・Base Color・Fade Distance・Noise 系など複数パラメータを持つ master Material は、グループ分けと Sort Priority で Material Instance Editor 上の見通しが良くなる。パラメータ数が増えがちな master Material（Landscape マテリアルなど）ほど効果が出る

## ソースの限界

- WebFetch による要約ベースの取得であり、原文の詳細な手順（画面操作の逐一やスクリーンショット相当の情報）は失われている可能性がある
- Material Instance Editor の UI 詳細、Sort Priority の具体的な設定方法（数値の意味・デフォルト値）など、原文に記載がない箇所は本ノートにも含めていない
- 実例パートは BaseColor/Roughness/Metallic の3パラメータ構成が説明されているのみで、具体的なノード接続グラフやスクリーンショットの内容は取得できていない
