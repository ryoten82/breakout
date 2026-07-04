# マテリアル・ドクトリン（蒸留版）

公式 doc 3 ページ + Fab アセット MCP 実地検査 1 件からの横断抽出。**日常作業ではこのファイルだけ読む**（上限 3KB）。
出典・詳細は `videos/` の個別ノート（読むときは Sonnet 委譲）。

## 基礎の原則

1. **必須 3 設定を最初に決める** — Material Domain（7 種: Surface/Decal/LightFunction/Volume/PostProcess/UI/VirtualTexture）／Blend Mode（7 種）／Shading Model（13 種）
2. **プロの建築キットは最小構成に集中**（実測）— BLEND_Opaque + DefaultLit + TextureSample 数枚のみ。ステージ背景パーツに複雑なグラフは不要
3. **データ型は Float/2/3/4 の 4 種のみ**。接続は型一致必須
4. **Unlit = ライティング非依存** — 発光的 FX マテリアルの候補（フォグ平面は Translucent、加算的な光は Additive も点検候補）

## Material Instance 運用（バリエーション量産の第一手段）

- パラメータ配置: **S キー=Scalar / V キー=Vector**。既存ノードの後付けは右クリック **Convert to Parameter**（固定値で組む→汎用化、の順で OK）
- 親 Material 1 枚 + MI 数枚で色違い量産（実測例: `PaintColor` VectorParameter 差し替えのみでパネル 3 色）。再コンパイル不要・軽量。Packed Level Actor 分解より先に検討
- パラメータが増えたら **Parameter Groups + Sort Priority** で整理

## タイリング対策の適用条件（bg ドクトリンと共有）

- TexCoord→Multiply→Scalar tiling は **Landscape 等の広域連続面のみ**。プロ配布モジュラーキットはパーツ専用ベイク済みで TexCoord 自体が無い（独立検証 2 回で実測確定）。⚠自作パーツで無条件に入れない

## Substrate（UE5.7+ デフォルト有効・⚠Beta）

- 従来の Blend Mode/Shading Model 固定体系を置換する新枠組み。Slab（物質薄層）BSDF を Operator（Horizontal Blend/Vertical Layer 等）で積層。Metallic/Specular でなく **F0/Diffuse Albedo の物理量**でパラメータ化
- GBuffer 選択: Blendable=軽量・レガシー互換 / Adaptive=高忠実・高コスト
- **本プロジェクトは Substrate materials 有効・GBuffer=Adaptive**（2026-07-04 手動ON、従来OFF）。**実機確認済み**: 有効化直後に一部テクスチャが一時未貼付→再貼付される一過性挙動のみ、以降は見た目・性能とも変化なし（実害なし）

## Fab アセット実地検査という手法（使い所）

- 前提: **「Allows usage with AI: Yes」の明示必須** + 読み取り専用徹底 + 独立再検証
- 高コスト（1 キット約 20 分・12 万トークン）。網羅カタログ用途は不向き、**ドクトリン仮説のピンポイント実測検証**専用。「なぜ」は取れない
