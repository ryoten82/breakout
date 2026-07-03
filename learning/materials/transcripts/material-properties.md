# SOURCE: Unreal Engine Material Properties
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-material-properties
取得方法: WebFetch（要約モードだが列挙系は網羅的。良質ソース）
取得日: 2026-07-04

---

UE5.8 における Material Properties の解説。

## Material Domain
マテリアルの用途を決める設定: **Surface**（デフォルト）/ **Deferred Decal** / **Light Function** / **Volume** / **Post Process** / **User Interface** / **Virtual Texture**

## Blend Mode
マテリアルが背景ピクセルとどう合成されるかを制御。7種類:
- **BLEND_Opaque** — 完全不透明
- **BLEND_Masked** — "Final color = Source color if OpacityMask > OpacityMaskClipValue"（式そのまま原文引用）
- **BLEND_Translucent** — 半透明
- **BLEND_Additive**
- **BLEND_Modulate**
- **AlphaComposite**
- **AlphaHoldout**

## Shading Model
入力がどう合成されて最終色になるかを決める。選択肢: **Unlit** / **Default Lit** / **Subsurface** / **Preintegrated Skin** / **Clear Coat** / **Subsurface Profile** / **Two Sided Foliage** / **Hair** / **Cloth** / **Eye** / **Single Layer Water** / **Thin Translucent** / **From Material Expression**

## Physical Properties
Physical Material 設定は物理挙動（弾性等）を定義。Physical Material Mask はカラーチャンネルごとに異なるマテリアルを割り当て、音・エフェクトに使う。

## Advanced Features
- Translucency lighting modes（Volumetric・Surface-based 系の選択肢）
- self-shadowing parameters
- メッシュ種別ごとの usage flags
- モバイル最適化設定
- refraction methods
- world position offset controls
- lightmass properties（静的ライティング向け）
