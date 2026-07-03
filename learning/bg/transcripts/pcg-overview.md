# SOURCE: Procedural Content Generation Overview (+ Framework hub)
URL1: https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview （良質・詳細）
URL2: https://dev.epicgames.com/documentation/unreal-engine/procedural-content-generation-framework-in-unreal-engine （hub・薄い）
取得方法: WebFetch（要約モードだが概念説明は詳細に取得できた良質ソース）
取得日: 2026-07-04
注記: PCG は非常に大きなトピック（Node Reference・Biome Core Plugin・GPU Processing等の子ページが多数存在）。今回は中核概念（Overview）のみ取得。ノード個別リファレンスは未取得。

---

The Procedural Content Generation Framework (PCG) is a toolset for creating procedural content and tools inside Unreal Engine that provides technical artists, designers, and programmers with the ability to build fast, iterative tools and content of any complexity, ranging from Asset utilities like buildings or biome generation, up to entire worlds.

## Points（ポイント）の概念

PCG フレームワークにおける "Points" は、3D空間内の位置を表現する。具体的には「PCGグラフにより生成される3D空間内のロケーション」であり、メッシュのスポーン時に頻繁に使用される。各ポイントは以下の情報を保持できる:
- 変換情報（transform）
- 境界（bounds）
- 色（color）
- 密度（density）
- 傾斜（steepness）
- シード（seed）
- ユーザー定義の属性（user-defined attributes）

## Procedural Node Graph（手続き型ノードグラフ）

PCG フレームワークの中核を成す要素で、**マテリアルエディタに類似した形式**で機能する。空間データはレベル内の PCG コンポーネントからグラフへ流入し、一連のノードを通じてポイントがフィルタリングおよび変更され、リアルタイムで出力が更新される。結果として生成されたポイントは様々なアセットをスポーンするために使用される。

ノードは以下のカテゴリに分類される: **Blueprint / Control Flow / Debug / Density / Filter / Generic / Hierarchical Generation / Input Output / IO / Metadata / Param / Point Ops / Sampler / Spatial / Spawner / Subgraph**

## Attributes（属性）と Metadata（メタデータ）

属性は変数に類似し、名前と型によって定義されたデータを保存する。
- **静的属性**（例: `$Position` のように `$` で始まる）
- **動的属性**（実行時に作成されメタデータの一部として保存される）

メタデータは3つのドメインで管理される:
- **Data ドメイン** — データ自体に設定された単一値の属性用。`@Data` プレフィックス
- **Points ドメイン** — `@Points` プレフィックス
- **Elements ドメイン** — 属性セット用。`@Elements` プレフィックス

属性セレクタにより、静的属性と動的属性間の相互運用性が提供され、特定のノードで利用可能な属性の一覧が表示される。
