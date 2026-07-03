# 学習ノート — Lower Sector Building Kit UE MCP実地検査（プロ配布アセットの一次情報）

- ソース: Lower Sector Building Kit（Fab・作者 tunami3d・CC BY 4.0・Allows usage with AI: Yes）
- 検査方法: UE5.8 検査専用sandboxプロジェクトへFab経由でインポート → UE公式MCP（読み取り専用）でSonnetエージェントが直接検査
- 学習日: 2026-07-04 / 抽出: UE MCP実地検査（読み取り専用）→ 独立検証済み → Sonnet整形（監査待ち）
- 原典: [../inspections/lower-sector-building-kit-report.md](../inspections/lower-sector-building-kit-report.md)

---

## この学習の性質（動画/ドキュメントと違う点）

これまでの `materials/` `bg/` 配下の学習ノートは、YouTube動画の字幕やUE公式ドキュメントを情報源としてきた。今回は**新しいソース種別**を扱う。

対象は実際にFabで配布されているプロ制作アセット「Lower Sector Building Kit」そのものであり、これをUE検査専用のsandboxプロジェクトへインポートし、UE公式MCP経由で**読み取り専用**で直接検査した結果が原典になる。

この検査は「なぜそう作ったか」という判断理由は含まない。作者がなぜTexCoordノードを組まなかったのか、なぜこの構成を選んだのかは、検査からは分からない。動画やドキュメントが教えてくれる「講師の意図・判断基準」がここには無い。

その代わりに得られるのは、「実際に配布されているプロダクトの中で何が使われているか」という**実測データ**である。動画で語られる技法は「教える側が意図的に見せた・言語化した」情報であるのに対し、今回のデータは配布物の中身をそのまま読んだものであり、性質が根本的に異なる。

---

## Kitの構成（フォルダ・アセット内訳）

`/Game/LowerSector_Mod/` 配下の構成:

- `Maps/`（デモレベル2種＋BuiltData）
- `Materials/`（BlockoutMaterials・共通Street01）
- `Models/` 配下にパーツ種別ごとのサブフォルダ: Apartment01, BG_Buildings, Bot, Building01, BuildingPaneling01, Cables, ConcreteWalls, Decals, Entrance01/01_Top/02, LightProps, Pipes, PowerBox, PowerCar, RollDoor01, RoofTop, SideWalk, Skybridge, SkyTower, Tower8x, Wall01, Wall6x, Workshop

アセット種別内訳（`find_assets` 実測、全261件）:

| 種別 | 件数 |
|---|---|
| Static Mesh | 90 |
| Material | 58 |
| MaterialInstanceConstant | 8 |
| Texture2D | 101 |
| Blueprint | 0 |
| MaterialFunction | 0 |
| その他（マップ・BuiltData等） | 4 |

MaterialInstance 8件の内訳: `Tower8x`（3個）・`Wall6x`（3個）・`Decals` のペイントライン用（1個、"white"バリエーション）。

Blueprintが0件という点は、BotのようなキャラクターアセットもStatic Meshのみで構成されており、Fabインポート直後の状態ではBP化されていない可能性が高いと報告されている（推測）。

---

## 実地検査で判明したマテリアル構成（Wall01/Tower8x/Apartment01/Bottington）

検査は全21種の建築パーツ全数ではなく、Wall01・Tower8x・Apartment01の3マテリアルとBot関連のサンプル調査に留まる。

### M_Wall01
- `SM_Wall01_L0` が使用、マテリアルスロット名 `b_wall01`
- BlendMode = `BLEND_Opaque`、ShadingModel = `MSM_DefaultLit`、TwoSided = false
- グラフ: TextureSample×3のみ。各TextureSampleの `UVs` 入力はすべてNone（未接続）。TexCoordノードがグラフに存在せず、UVスケール乗算の仕組みは組まれていない

### M_Tower8x
- `MI_Tower8x_Inst`〜`Inst3` の親、パネルマスク合成あり
- グラフ: `TextureSample_0`（ベースカラー）× `Multiply_1`（`VectorParameter_0` × `TextureSample_3`）→ `Multiply_0`
- `VectorParameter_0` のパラメータ名は `PaintColor`（デフォルト白）。Multiplyは2つとも「タイリング」ではなく「マスクテクスチャへのカラーティント合成」用。MaterialInstance3種はこの `PaintColor` だけを差し替えてパネル色違いを作る構成

### M_Apartment01
- TextureSample×3のみ、Wall01と同じく最小構成。TexCoordなし

### M_Bottington / SM_Bottington（Bot本体）
- Static Meshバウンズ: X≈274.8cm、Y≈264.9cm、Z=300cm（約2.7m×2.7m×3mの箱型）
- `SM_Bottington2` も同一マテリアルスロット `b_bot` を共有（LOD違いかバリエーションと推測）
- グラフ: TextureSample×4、`Multiply_0 = Constant_0(0.1) × TextureSample_1(RGB)`。Emissive強度を0.1倍に抑える単純な定数乗算（HitFlashAmount等の発光インフラとは無関係の素朴な実装）

**material-concepts-and-properties.md との接続**: BlendMode/ShadingModelの理論一覧（`BLEND_Opaque`・`MSM_DefaultLit` を含む7種/13種）は公式ドキュメントの要約から得ていたが、それが実際のプロアセットでどう選ばれているかは今回が初めての実測。M_Wall01・M_Tower8x・M_Apartment01のいずれも `BLEND_Opaque` + `MSM_DefaultLit` という最も標準的な組み合わせで、特殊なBlendMode/ShadingModelの使用例は見つからなかった。理論一覧にある7択・13択のうち、建築モジュラーキットは最もシンプルな1点に集中している、という実例が得られたことになる。

---

## 最重要の発見: タイリング対策パターンの不在(独立検証で確定済み)

`bg_technique_doctrine.md` の定型テクニックには「タイリング対策: TexCoord→Multiply→Scalar "tiling"」という手法が記載されている。この定型パターンが、調査した4マテリアル（Wall01, Tower8x, Apartment01, Bottington）のいずれにも見つからなかった。TexCoordノード自体が一度も出現しない。

Multiplyノードは存在するが、その用途はすべて「マスク合成」（M_Tower8xの`PaintColor`合成）または「Emissive強度調整」（M_Bottingtonの0.1倍定数乗算）であり、UVスケールを操作する「タイリング」用途とは異なる。

この主張は単一エージェントの検査結果に留まらない。別エージェントが同一マテリアル（`M_Wall01`）を独立にMCP再検査し、ノード単位・ピン単位で完全一致を確認している。

- `MaterialTools.get_expressions` で取得した全ノードは `MaterialExpressionTextureSample_0/1/2` の3個のみ。`MaterialExpressionTextureCoordinate` は文字列としても一切出現しない
- `MaterialTools.get_expression_inputs` で3ノードそれぞれの入力ピン（`UVs`/`Tex`/`Apply View MipBias`）を個別確認し、全ノード・全ピンが `expression: "None"`（未接続）であることを確認

これにより「TexCoord→Multiply→Scalar tiling」定型パターンの不在という主張は、単一エージェントの誤読・幻覚ではなく、独立した2回のMCP実測で裏付けられた事実として確定している。

### 既存ドクトリンとの矛盾をどう解釈するか

`bg_technique_doctrine.md` の「タイリング対策」項目には、既にこの発見を踏まえた適用条件が追記済みである。

> タイリング対策: TexCoord→Multiply→Scalar "tiling"。広域は Texture Bombing。**適用対象はLandscape等の広域連続面のみ**——プロ配布のモジュラーキット（Fab等）はパーツ専用ベイク済みでTexCoordノード自体が無いのが通常（実機検査で確認、⚠自作時に無条件適用しない）

このノートはその追記の**実測根拠**として位置づけられる。矛盾ではなく、適用範囲の違いとして整理できる。

- **Landscape等の広域連続面**: 1枚のテクスチャを広大な面に繰り返し貼るため、同じパターンの反復が視覚的に目立つ。動画講師が実演していた「自作Landscapeマテリアルでtilingパラメータ調整」（`ee-IOlWUZTo` ノート参照）は、この課題への対処として理にかなっている
- **モジュラー建築キットの個別パーツ**（Wall01・Tower8x・Apartment01等）: 各パーツのテクスチャはそのパーツの表面積に合わせて専用にベイクされており、UV1:1で単純に貼るだけで済む。パーツ自体が「タイル」の単位であり、パーツを並べて壁を組む段階でパターンの繰り返しをコントロールする設計になっている（推測。検査報告に明記された仮説であり、検査そのものからの直接証明ではない）

つまり「タイリング対策」というテクニック自体の有効性が否定されたわけではなく、**適用対象がLandscape等の広域連続面に限られ、パーツ専用ベイク済みのモジュラーキットには不要**、という条件が実測によって明確になったことになる。自作でモジュラーキット的なパーツを作る際に、TexCoordノードを「とりあえず入れておく」必要はない、という判断材料が得られた。

---

## SCRAP BLITZ に活かせる部分

- **建築系モジュラーパーツのマテリアル構成の目安**: 壁・タワー・アパートのような固定形状パーツは、TextureSample数枚を`BLEND_Opaque`+`MSM_DefaultLit`で組むだけの最小構成で十分という実例が得られた。SCRAP BLITZ のステージ背景パーツを自作・調整する際、複雑なノードグラフを組む必要は必ずしもない
- **色違いバリエーションの作り方**: M_Tower8xの`PaintColor`（VectorParameter）をMaterialInstanceで差し替えるだけでパネル色違いを量産する構成は、`bg_technique_doctrine.md` の「バリエーション量産」項目（Packed Level Actor分解→改変→再パッケージ）とは別の軽量な手法として参考になる。親マテリアル1枚+MaterialInstance数枚という構成は再コンパイル不要で高速に派生を作れる（`material-concepts-and-properties.md` のMaterial Instance定義と整合）
- **Emissive強度調整の最小実装例**: M_Bottingtonの`Constant×TextureSample`という定数乗算だけのEmissive制御は、SCRAP BLITZ の発光インフラ（HitFlashAmount/HitFlashColor、`setup_emission_infra.md`）とは設計思想が異なる素朴な実装。参考になるのは「発光強度だけを外部から触れるようにする最小限の作り方」という考え方であり、既存の発光インフラを置き換える提案ではない
- **タイリング対策の適用条件が実測で裏付いた**: 上記の通り、既存ドクトリンの追記内容がプロアセットの実例と一致することが確認できた。今後SCRAP BLITZ で建築モジュラーパーツを自作する際、Landscape以外ではTexCoordの組み込みを省略してよいという判断に自信が持てる

---

## この検査手法自体の評価（可能性と限界）

**ライセンス確認の重要性**: 今回検査対象にできたのは、Fabの商品ページに「Allows usage with AI: Yes」という明示的な条項があったためである（作者 tunami3d・CC BY 4.0）。この条項が無い配布アセットに対して同様の検査を行うことは、ライセンス違反のリスクを伴う。今後この手法を使う際は、検査対象のアセットに同条項があるかを毎回最初に確認する必要がある。

**検査コストの高さ**: 今回の検査では40種類以上のツールセットが利用可能な環境で、複数回のツール呼び出しを重ねてサンプル調査を行っている。全261アセットのうち実際に中身まで検査できたのは4マテリアル+Bot関連のみであり、動画1本の字幕要約（`ee-IOlWUZTo` ノート等）と比べて網羅性とコストの間にトレードオフがあることは明らかである（※具体的なトークン数・所要時間は検査報告に記載がなく未確認。桁感としては軽くない、という程度に留める）。

**得られた情報の質**: 一次情報である点は動画・ドキュメント学習にない強みだが、「なぜそう作ったか」という設計判断の理由は一切含まれない。今回の「TexCoord不在」という発見も、それ自体は単なる観測事実であり、「なぜプロはこう作るのか」の解釈（Landscape広域面向けの手法であり、パーツ専用ベイク済みのモジュラーキットには不要という仮説）は検査後に推測で補ったものであって、検査結果そのものが教えてくれたわけではない。

**今後この手法を使うかどうかの判断材料**:
- 使う価値がある場面: 「ドクトリンの言語化された技法が、実際のプロ制作物でどの程度使われているか」を検証したいとき。今回のように既存ドクトリンの記述に実測の裏付けを与えられる
- 使うコストが見合わない場面: 網羅的なカタログ作りや、多数のアセットを浅く広く見たい場合には、20分/1キット・120,697トークンというコストは重い。動画学習の方が同じ時間でより多くの「判断理由付きの情報」を得られる可能性が高い
- 必須の前提条件: ライセンス条項の確認（Allows usage with AI）、読み取り専用の徹底（write_file・set_properties・delete・move・save_assets等を一度も使わないこと）、そして可能であれば今回のような独立検証（別エージェントによる再確認）を組み合わせることで、単一エージェントの誤読・幻覚のリスクを減らせる

総合すると、この手法は「動画・ドキュメント学習を置き換えるもの」ではなく、「特定の技法仮説をピンポイントで実測検証する追加ツール」として位置づけるのが妥当。乱発するにはコストが高いが、ドクトリンの重要な一項目（今回のタイリング対策の適用条件）を実測で確定できた効果は大きい。
