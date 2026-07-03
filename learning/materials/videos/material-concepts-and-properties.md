# 学習ノート — Essential Material Concepts + Material Properties（UE5.8 マテリアル基礎）

- ソース1: [Essential Unreal Engine Material Concepts](https://dev.epicgames.com/documentation/en-us/unreal-engine/essential-unreal-engine-material-concepts)
- ソース2: [Unreal Engine Material Properties](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-material-properties)
- 学習日: 2026-07-04 / 抽出: WebFetch（公式doc） → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/essential-material-concepts.md](../transcripts/essential-material-concepts.md) / [../transcripts/material-properties.md](../transcripts/material-properties.md)

---

## マテリアル作成の基本プロセス（3つの必須設定：Material Domain / Blend Mode / Shading Model）

マテリアルは Material Editor 上で **Material Expression** ノードをグラフに組み、以下の 3 つの必須プロパティを設定した上で Main Material Node にデータを接続し、コンパイルすることで作成される。

1. **Material Domain** — マテリアルの用途（Surface / Decal / Volume 等）
2. **Blend Mode** — 背景ピクセルとの合成方法
3. **Shading Model** — 入力値がどう合成されて最終色になるか

ノードベースのビジュアルインターフェースで組んだグラフは、裏側で自動的に HLSL コードへ変換される（ユーザーは直接 HLSL を書く必要がない）。

効率化の仕組みとして、親マテリアルから再コンパイル無しで高速に派生を作れる **Material Instance**、再利用可能なノード群をまとめる **Material Function** がある。

---

## Material Domain 一覧（7種）

マテリアルの用途を決める設定。

| Domain | 用途 |
|---|---|
| **Surface**（デフォルト） | 通常の 3D オブジェクト表面 |
| **Deferred Decal** | デカール |
| **Light Function** | ライトの投影パターン制御 |
| **Volume** | ボリューム表現 |
| **Post Process** | ポストプロセス効果 |
| **User Interface** | UI |
| **Virtual Texture** | Virtual Texture 用 |

※各 Domain の内部的な違い・使い分けの詳細な効果説明までは原文に記載なし（「ソースの限界」参照）。

---

## Blend Mode 一覧（7種、BLEND_Maskedの式を含む）

マテリアルが背景ピクセルとどう合成されるかを制御する設定。

| Blend Mode | 概要 |
|---|---|
| **BLEND_Opaque** | 完全不透明 |
| **BLEND_Masked** | `Final color = Source color if OpacityMask > OpacityMaskClipValue`（原文の式をそのまま引用） |
| **BLEND_Translucent** | 半透明 |
| **BLEND_Additive** | 加算合成 |
| **BLEND_Modulate** | 乗算的な合成 |
| **AlphaComposite** | アルファ合成 |
| **AlphaHoldout** | ホールドアウト（アルファで背景を「くり抜く」系） |

BLEND_Masked 以外の各モードについて、原文には概要以上の詳細な合成計算式の記載はない。

---

## Shading Model 一覧（13種）

入力（Base Color, Roughness 等）がどう合成されて最終的な陰影・色になるかを決める設定。

1. **Unlit** — ライティングの影響を受けない
2. **Default Lit** — 標準的な陰影計算
3. **Subsurface** — 半透明素材の内部散乱
4. **Preintegrated Skin** — 肌向け
5. **Clear Coat** — クリアコート層
6. **Subsurface Profile** — Subsurface Profile アセット参照型
7. **Two Sided Foliage** — 両面描画の植生向け
8. **Hair** — 髪
9. **Cloth** — 布
10. **Eye** — 目
11. **Single Layer Water** — 単層水面
12. **Thin Translucent** — 薄い半透明素材（ガラス等）
13. **From Material Expression** — Shading Model をグラフ内で動的に選択

各モデルの内部処理（例: Clear Coat が具体的にどう second specular lobe を計算するか等）は原文に記載がなく、名称と用途の列挙にとどまる。

---

## Material Expression / Material Function / データ型（Float/Float2/3/4）の位置づけ

- **Material Expression**: HLSL のコードスニペットに対応するノード。特定の処理（演算・テクスチャサンプリング等）を担い、ケーブル接続でグラフ内をデータが流れる。
- **Material Function**: 再利用可能なノードネットワークをまとめたもの。効率化のための仕組み。
- **データ型**: マテリアルグラフ内の情報はすべて 4 種類の浮動小数点型（**Float / Float2 / Float3 / Float4**）で表現される。ノード同士を接続する際は型の一致が重要（原文: "proper type matching being essential for node operations"）。

---

## SCRAP BLITZ に活かせる部分

`bg_technique_doctrine.md` には既に「自作フォグ平面 = Translucent」「Mesh Paint」など実践的なマテリアル技法の記載があるが、Blend Mode 7種・Shading Model 13種の**体系的な選択肢一覧**が言語化されたのは今回が初めて。既存記述はこの一覧の中の実例として位置づけられる。

- **フォグ平面（Translucent）の妥当性**: `bg_technique_doctrine.md` の自作フォグ平面は BLEND_Translucent を使っている。7 択の中では「半透明で背景と合成したい」用途に対応するモードであり、選択の方向性自体は一覧と整合する。ただし実際のマテリアルアセットの設定値までは今回読んでいないため、Opacity 計算の詳細や他モード（Additive 等）との比較優位は断定できない。
- **FX（爆発・被弾等）で検討候補になる Shading Model**: 13種の中で **Unlit**（原文定義: 「ライティングの影響を受けない」）は、ライティングに依存しない発光的な表現に向く可能性がある（※一般知識で補足。両ソースに「FX用途に向く」という直接の記載はない）。SCRAP BLITZ の既存 FX マテリアルが実際にどの Shading Model を使っているかは未確認であり、「変更すべき」という結論ではなく「選択肢の一つとして意識できる」というレベルの示唆にとどまる。
- **Blend Mode の選び直しの視点**: 既存マテリアルで Translucent を使っている箇所（フォグ以外にもあれば）について、Additive や AlphaComposite の方が意図した見た目に近い可能性がある、という「点検の切り口」が今回得られた一覧から得られる。実装変更が必要かどうかは既存アセットの確認が別途必要。

---

## ソースの限界

両ソースとも WebFetch による**要約止まり**であり、公式ドキュメントの完全な原文（コードサンプル・図版・各設定の詳細な内部計算式）までは取得できていない。

- **Material Domain 7種**は名称と一言用途の列挙のみで、各 Domain がノードグラフの利用可能な入出力にどう影響するかの詳細（例: Post Process Domain で使えるノードの制限等）は記載がない。
- **Blend Mode**は BLEND_Masked のみ式が原文引用できたが、他 6 種（Opaque / Translucent / Additive / Modulate / AlphaComposite / AlphaHoldout）については合成計算式やレンダリングパス上の違いまでは踏み込めていない。
- **Shading Model 13種**は名称列挙にとどまり、**Clear Coat の second specular lobe の仕組み**、**Subsurface Profile と Subsurface の違いの内部処理**、**Single Layer Water の反射・屈折計算**など、各モデル固有の技術的な処理内容は原文に含まれていない。
- **Physical Properties**（弾性等の物理挙動、Physical Material Mask）や **Advanced Features**（Translucency lighting modes、self-shadowing、モバイル最適化、refraction methods、world position offset、lightmass properties）は項目名の列挙のみで、パラメータの具体値や設定手順は取得できていない。
- 本ノートはまだ Fable 監査を経ておらず、`essential-material-concepts.md` の抽出メモにある通り「1回目は著作権懸念で全文再現を拒否・要約のみ返却」という制約下で作られた要約の要約である点に留意。
