# SOURCE: Lower Sector Building Kit — UE MCP 直接検査報告（一次情報）
対象: Fab「Lower Sector Building Kit」（tunami3d・CC BY 4.0・Allows usage with AI: Yes）
検査方法: UE5.8 検査専用sandboxプロジェクトへFab経由でインポート → 公式MCP（読み取り専用）でSonnetエージェントが直接検査
検査日: 2026-07-04
監査状態: 核心主張（TexCoord不在）は別エージェントによる独立再確認済み（下記追記参照）

---

## 0. ツールセット稼働状況

`list_toolsets`で確認。`ToolsetRegistry.AgentSkillToolset`に加え、目的の`EditorToolset`系（`EditorAppToolset`/`LogsToolset`）、`editor_toolset.toolsets.*`名前空間一群（`AssetTools`/`ActorTools`/`BlueprintTools`/`MaterialTools`/`MaterialInstanceTools`/`ObjectTools`/`SceneTools`/`StaticMeshTools`/`TextureTools`等）、Niagara/Sequencer/PCG/GAS/ControlRig等、合計40種類以上のツールセットが利用可能だった。

現在のレベル: `/Game/LowerSector_Mod/Maps/LowerSector_Mod`（Kit付属のデモレベル）。

## 1. Kitのフォルダ構成・アセット内訳

`/Game/LowerSector_Mod/`構成:
- `Maps/`（デモレベル2種＋BuiltData）
- `Materials/`（BlockoutMaterials・共通Street01）
- `Models/`配下にパーツ種別ごとのサブフォルダ: Apartment01, BG_Buildings, Bot, Building01, BuildingPaneling01, Cables, ConcreteWalls, Decals, Entrance01/01_Top/02, LightProps, Pipes, PowerBox, PowerCar, RollDoor01, RoofTop, SideWalk, Skybridge, SkyTower, Tower8x, Wall01, Wall6x, Workshop

アセット種別内訳（`find_assets`実測、全261件）:

| 種別 | 件数 |
|---|---|
| Static Mesh | 90 |
| Material | 58 |
| MaterialInstanceConstant | 8 |
| Texture2D | 101 |
| Blueprint | 0 |
| MaterialFunction | 0 |
| その他（マップ・BuiltData等） | 4 |

MaterialInstance 8件の内訳: `Tower8x`（3個）・`Wall6x`（3個）・`Decals`のペイントライン用（1個、"white"バリエーション）。

## 2. 代表アセットの実地検査

### M_Wall01
- `SM_Wall01_L0`が使用、マテリアルスロット名`b_wall01`
- BlendMode = `BLEND_Opaque`、ShadingModel = `MSM_DefaultLit`、TwoSided = false
- グラフ: TextureSample×3のみ。各TextureSampleの`UVs`入力は**すべてNone（未接続）** — TexCoordノードがグラフに存在せず、UVスケール乗算の仕組みは組まれていない

### M_Tower8x
- `MI_Tower8x_Inst`〜`Inst3`の親、パネルマスク合成あり
- グラフ: `TextureSample_0`（ベースカラー）× `Multiply_1`（`VectorParameter_0` × `TextureSample_3`）→ `Multiply_0`
- `VectorParameter_0`のパラメータ名は`PaintColor`（デフォルト白）。Multiplyは2つとも「タイリング」ではなく「マスクテクスチャへのカラーティント合成」用。MaterialInstance3種はこの`PaintColor`だけを差し替えてパネル色違いを作る構成

### M_Apartment01
- TextureSample×3のみ、Wall01と同じく最小構成。TexCoordなし

### M_Bottington / SM_Bottington（Bot本体）
- Static Meshバウンズ: X≈274.8cm、Y≈264.9cm、Z=300cm（約2.7m×2.7m×3mの箱型）
- `SM_Bottington2`も同一マテリアルスロット`b_bot`を共有（LOD違いかバリエーションと推測）
- グラフ: TextureSample×4、`Multiply_0 = Constant_0(0.1) × TextureSample_1(RGB)`。Emissive強度を0.1倍に抑える単純な定数乗算（HitFlashAmount等の発光インフラとは無関係の素朴な実装）

## 3. 既存ドクトリンとの一致点・相違点

**一致点**: BlendMode/ShadingModelは想定通り、すべて標準的な`BLEND_Opaque` + `MSM_DefaultLit`のPBR構成。特殊なトリックは無し。

**相違点（重要）**: 「TexCoord→Multiply→Scalar "tiling"」という定型パターンは、調査した4マテリアル（Wall01, Tower8x, Apartment01, Bottington）のいずれにも見つからなかった。TexCoordノード自体が一度も出現しない。プロのFabアセットはUV1:1で単純にベイクされたテクスチャをそのまま貼るだけで、タイリングスケール調整の仕組みは組み込まれていない。Multiplyノードの用途は全て「マスク合成」または「Emissive強度調整」であり、ドクトリンが想定する用途とは異なる。

BlueprintベースのBotは存在せず、Static Meshのみ（Fabインポート直後の状態でBP化されていない可能性が高い）。

## できなかったこと・確認できていない点

- プロジェクト名そのもの（.uprojectファイル名）を直接返すツールは見当たらず、コンテンツブラウザパス・現在レベルパスからの推測に留まる
- Static MeshのUVレイアウト自体（UV1:1かどうかの幾何学的な裏付け）はマテリアルグラフの接続情報からの推論であり、メッシュのUVチャンネルデータそのものは見ていない
- Bot以外の全21種の建築ピースについて全数検査はしておらず、Wall01/Tower8x/Apartment01の3マテリアルとBot関連のみのサンプル調査。他のパーツ（Entrance01/02, Pipes, Cablesなど）が異なるノード構成を持つ可能性は排除できていない
- 読み取り専用の制約は厳守（write_file・set_properties・delete・move・save_assets等の変更系ツールは一度も呼び出していない）

## 追記: 独立検証の結果（完全一致・Fable確認済）

別エージェントが同一マテリアル（`M_Wall01`）を独立にMCP検査し、**ノード単位・ピン単位で完全一致**を確認した。

- `MaterialTools.get_expressions` で取得した全ノード: `MaterialExpressionTextureSample_0/1/2` の3個のみ。`MaterialExpressionTextureCoordinate` は文字列としても一切出現しない
- `MaterialTools.get_expression_inputs` で3ノードそれぞれの入力ピン（`UVs`/`Tex`/`Apply View MipBias`）を個別確認し、全ノード・全ピンが `expression: "None"`（未接続）であることを確認

これにより「TexCoord→Multiply→Scalar tiling」定型パターンの不在という主張は、単一エージェントの誤読・幻覚ではなく、独立した2回のMCP実測で裏付けられた事実として確定した。
