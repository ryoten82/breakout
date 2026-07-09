# マテリアル・ドクトリン（蒸留版）

公式 doc 3 ページ + Fab アセット MCP 実地検査 1 件 + FXチュートリアル動画 8 本からの横断抽出。**日常作業ではこのファイルだけ読む**（目安 3KB、実用性優先で若干超過）。
出典・詳細は `videos/`・`fx/videos/` の個別ノート（読むときは Sonnet 委譲）。

## 基礎の原則

1. **必須 3 設定を最初に決める** — Material Domain（7 種: Surface/Decal/LightFunction/Volume/PostProcess/UI/VirtualTexture）／Blend Mode（7 種）／Shading Model（13 種）
2. **プロの建築キットは最小構成に集中**（実測）— BLEND_Opaque + DefaultLit + TextureSample 数枚のみ。ステージ背景パーツに複雑なグラフは不要
3. **データ型は Float/2/3/4 の 4 種のみ**。接続は型一致必須
4. **Unlit = ライティング非依存** — 発光的 FX マテリアルの候補（フォグ平面は Translucent、加算的な光は Additive も点検候補）

## Material Instance 運用（バリエーション量産の第一手段）

- パラメータ配置: **S キー=Scalar / V キー=Vector**。既存ノードの後付けは右クリック **Convert to Parameter**（固定値で組む→汎用化、の順で OK）
- 親 Material 1 枚 + MI 数枚で色違い量産（実測例: `PaintColor` VectorParameter 差し替えのみでパネル 3 色）。再コンパイル不要・軽量。Packed Level Actor 分解より先に検討
- パラメータが増えたら **Parameter Groups + Sort Priority** で整理

## MPC vs Dynamic Material Parameter（個体別制御の分岐点）

- **MPCはレベル全体で共有されるグローバル値** — 参照する全アクターが同時に反応する。**複数インスタンスが同一マテリアルを個別参照する構成（Pickup複数体・雑魚敵・OCジェム等）はDynamic Material Parameter必須**。MPCを使うと全個体が同時発火する事故になる（実演確認済み）
- 例外: **同一アクター内でMaterialとNiagara等の異システム間の値同期**にはMPCが適する（ディゾルブ境界のmask値をNiagara側パーティクル発生位置と同期させる等）。「複数アクター間の独立性→DMP」「単一アクター内の複数システム同期→MPC」で住み分ける

## Fresnel の応用（クリスタル/宝石系）

- **Fresnel Exponentを負値にすると発光分布が反転し「内側から光る」表現になる**（通常は縁が強調されるが符号反転で中心発光に）。⚠Planeでは効果が出ずSphereで機能（形状依存、実演確認）
- Translucency Lighting Mode = Surface Translucency Volumeで半透明立体の陰影が改善（結晶/氷系）
- Camera VectorをそのままテクスチャUVに使う「疑似環境マップ」も低コストな質感変化の選択肢（World空間のままだと歪みすぎるためTangent空間へ変換してから使う）

## タイリング対策の適用条件（bg ドクトリンと共有）

- TexCoord→Multiply→Scalar tiling は **Landscape 等の広域連続面のみ**。プロ配布モジュラーキットはパーツ専用ベイク済みで TexCoord 自体が無い（独立検証 2 回で実測確定）。⚠自作パーツで無条件に入れない

## Substrate（UE5.7+ デフォルト有効・⚠Beta）

- 従来の Blend Mode/Shading Model 固定体系を置換する新枠組み。Slab（物質薄層）BSDF を Operator（Horizontal Blend/Vertical Layer 等）で積層。Metallic/Specular でなく **F0/Diffuse Albedo の物理量**でパラメータ化
- GBuffer 選択: Blendable=軽量・レガシー互換 / Adaptive=高忠実・高コスト
- **本プロジェクトは Substrate materials 有効・GBuffer=Adaptive**（2026-07-04 手動ON、従来OFF）。**実機確認済み**: 有効化直後に一部テクスチャが一時未貼付→再貼付される一過性挙動のみ、以降は見た目・性能とも変化なし（実害なし）
- **メモリ予算**（Epic 公式 Bali 講演・ペア照合済）: Simple 8B/px → Single 24B → Complex 36B → Complex Special 52B。`r.Substrate.BytesPerPixel` デフォルト 80B、超過時はパラメータブレンドで自動簡略化。複雑化する際の予算判断基準に使う
- 表現の引き出し: Second Roughness/Fuzz/Glint/SSS MFP（応用 11 種は個別ノート参照）

## Fab アセット実地検査という手法（使い所）

- 前提: **「Allows usage with AI: Yes」の明示必須** + 読み取り専用徹底 + 独立再検証
- 高コスト（1 キット約 20 分・12 万トークン）。網羅カタログ用途は不向き、**ドクトリン仮説のピンポイント実測検証**専用。「なぜ」は取れない
