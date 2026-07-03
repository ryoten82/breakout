# SOURCE: Creating and Using Material Instances in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/creating-and-using-material-instances-in-unreal-engine
取得方法: WebFetch（要約モードだが具体的な操作手順まで取得できた良質ソース）
取得日: 2026-07-04

---

Material instancing is a workflow optimization technique that allows developers to create a parent Material with customizable properties that can be inherited by child Material instances.

## Material Instancing Process
2段階のプロセス:
1. パラメータノードを使って「パラメータ化された」親マテリアルを作成
2. Content Browser で Material Instance Constant を作成

## Parameter Nodes
マテリアル属性を編集可能にする特殊ノード。**"Scalar Parameter" と "Vector Parameter" にはそれぞれ S キー・V キーのショートカットがある**（配置を素早く行うため）。

## パラメータ化マテリアルの作成
Material Palette から追加するか、既存ノードを右クリックして「Convert to Parameter」を選択することでパラメータを追加できる。Details パネルでデフォルト値・値の範囲を設定できる。

## 整理機能
**Parameter Groups**: 関連パラメータをグループ化することで、特に複雑な master Material の可読性が上がる。グループはアルファベット順、または Sort Priority 値による順序付けが可能。

**親マテリアルの変更**: Material Instance Editor の General プロパティから Instance の親 Material を変更できる。ただし利用可能なパラメータが変わる可能性がある。

## 実例
BaseColor（Vector）・Roughness・Metallic（いずれも Scalar）の3パラメータを使ったシンプルな例を通して、単一の base Material から多数の見た目バリエーションを artist が生成できることを示している。
