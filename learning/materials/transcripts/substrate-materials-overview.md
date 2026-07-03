# SOURCE: Substrate Materials in Unreal Engine (hub) + Overview of Substrate Materials in Unreal Engine
URL1: https://dev.epicgames.com/documentation/en-us/unreal-engine/substrate-materials-in-unreal-engine （5.8 hub）
URL2: https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-substrate-materials-in-unreal-engine （5.7 概要・良質ソース）
取得方法: WebFetch（hub側は要約モード、Overview側はより詳細な要約）
取得日: 2026-07-04
注記: ユーザー指定の元チュートリアル「Create Realistic Glass Material - Substrate Glass Tutorial」はSPAで直接読めなかったため、Substrate材システム自体の公式ドキュメントで代替。ガラス材の具体的なノード構成手順そのものは本ソースに含まれない。

---

## 概要（hub より）

Substrate は「固定的なシェーディングモデルとブレンドモード（Default Lit や Clear Coat など）を、より表現力豊かでモジュール化されたフレームワーク」で置き換える UE5 のマテリアルオーサリングアプローチ。

**重要: Beta 機能であることが明記されている。本番環境での使用には注意が必要。**

### hub のセクション構成
- **Getting Started**: Substrate Materials Overview（principled BSDF ベースのマテリアルオーサリングの概要）
- **Programmer Guides**: Programming with Substrate GBuffer Formats
- **Developer's Blog**: 「A Deep Dive on Substrate Materials」という詳細学習コースが複数トピックで構成 — F0/F90/Specular Color の理論、Simple Dielectric Materials、Gemstones/Metalloids/Semiconductors、Conductors、F0の適切な値の見つけ方、Thin Film Interference/Secondary Roughness、Mean Free Path、BSDFレイヤリングとSubstrate Operators、Metallic Representationと補間、Fuzzy Shading

## Core Concept（Overview より）

マテリアルは "slabs of matter"（物質の薄層）として概念化され、interface と medium で構成され、metallic や specular のような抽象値ではなく**物理量でパラメータ化**される。

## Enabling Substrate
- UE 5.7+ の新規プロジェクトではデフォルトで有効
- 既存プロジェクトは Project Settings > Rendering からオプトイン可能

## GBuffer Formats（2種類の選択）
- **Blendable GBuffer**: パフォーマンス重視、メモリフットプリント固定、レガシーマテリアルに近い
- **Adaptive GBuffer**: 視覚的忠実度優先、複雑なシェーディングをサポートするがパフォーマンスコスト高

## Material Node Types
- **BSDF nodes**: Slab, Eye, Hair, Clear Coat 等
- **Operator nodes**: Coverage Weight, Horizontal Blend, Vertical Layer, Add, Select
- **Building Blocks**: 事前設定済みの material function
- **Extras**: Decal, Light Function, Post Process, UI
- **Helpers**: 変換・ユーティリティノード

## Parameterization
Substrate はレガシーの Metallic/Specular パラメータの代わりに **F0/Diffuse Albedo** を使用し、エネルギー保存を維持しながらより柔軟性を提供する。

## Blend Modes
8種類（translucent + opaque）: Masked・Additive・Colored Transmittance・AlphaComposite 等。対応する Lighting Modes が適切なシェーディング計算のために存在する。

## Performance Optimization
- **Parameter Blending**: slab を統合してランタイムコストを削減
- 予算上限を超えると自動的にマテリアルの簡略化が発生
- デバッグ可視化モードでパフォーマンスのボトルネックを特定可能

## Compatibility
既存の非 Substrate マテリアルは動作するが、Substrate ネイティブの恩恵を受けるには明示的な変換が必要。
