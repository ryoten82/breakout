# 学習ノート — Exploring Substrate Materials Basic to Advanced Techniques（Unreal Fest Bali 2025）

- 資料: https://www.docswell.com/s/EpicGamesJapan/ZRE424-unreal-fest-bali-substrate （Epic Games公式、全91ページ、発表者Syuya Mukai・Epic Gamesシニアソリューションアーキテクト、2025-10-15公開）
- 学習日: 2026-07-04 / 抽出: WebFetch → 独立再取得3項目ペア照合（全一致）
- ソース種別: 公式スライド資料（docswell.com、ページ番号付きで内容照合可能）
- 既存ノートとの関係: [substrate-materials.md](substrate-materials.md)（UE5.7+デフォルト有効化・Beta機能の概要）を補完する、より実践的・応用寄りの深掘り資料

## Substrateのバージョン別状況（p.4）

| バージョン | ステータス |
|---|---|
| UE5.1 | Strata (Experimental) |
| UE5.2 | Strata→Substrate改名 (Experimental) |
| UE5.3, 5.4 | Experimental |
| UE5.5, UE5.6 | **Beta（本資料時点の現在地）** |
| UE5.7（目標） | Production-Ready & Default |

## コア概念

- Substrateは新しい素材作成方式で、Principled BSDFを活用し、従来方式では不可能だった表現（肌上の水滴、多層自動車塗装、物体上の塵）を実現
- レガシー material との主な違い：①上層を通過する光の相互作用を考慮しない従来方式の限界を解消 ②金属/非金属混在時のアーティファクトを解消 ③Standard Surface・OpenPBRとのフォーマット互換性

## ノード構造

- **Root Node**：「Front Material」がSubstrateの入力。UE5.6以降、レガシー入力の変換にも対応
- **Slab BSDF**：インターフェース＋メディウムの組成で、ほぼあらゆる物質表現が可能な中核ノード

### 主要パラメータ

| パラメータ | 説明 | 標準範囲 |
|---|---|---|
| Diffuse Albedo | 材質色（BaseColor相当） | 金属は0 |
| F0 Specular | 法線垂直時の反射率 | 非金属0〜0.08、金属1 |
| F90 | エッジの反射色 | 法線90度時 |
| Roughness | 表面粗さ | 0〜1 |

### ヘルパーノード群
- **IOR-to-F0**：誘電体IORをF0値に変換
- **Second Roughness**：磨かれた・磨耗したミラー表面用
- **Fuzz**：微細繊維の散乱光シミュレーション（ファブリック・ベルベット用）
- **Glint**：雪・自動車塗装用きらめき表現
- **SSS MFP**：平均自由行路（subsurface scattering制御）

### オペレーターノード
- **Vertical Layer**：コーティング構造（厚さ単位cm）
- **Horizontal Blend**：スラブ混合（Mix入力で比率制御）
- **Coverage Weight**：Vertical Layer用マスキング

## パフォーマンス管理（判断基準として重要）

### メモリバジェット（バイト/ピクセル、p.86）
| クオリティ層 | 最大バイト数 | 内容 |
|---|---|---|
| Simple | 8バイト | Albedo・F0・Roughness・Normal |
| Single | 24バイト | +F90・Second Roughness・Fuzz |
| Complex | 36バイト | +異方性・Specular Profile |
| Complex Special | 52バイト | +Glint対応 |

**予算超過時の挙動**：バジェット超過時はパラメータブレンディングで自動簡略化される。`r.Substrate.BytesPerPixel`（デフォルト**80バイト**、p.87）で調整可能。

## 応用事例（11種類・要点のみ）

1. 雪の蓄積：SSS・Glint活用
2. Naniteディスプレイスメント：テッセレーション
3. 金属車塗装：プライマー→ベースコート→クリアコート→グリント層の多層構成
4. カメレオン塗料：Specular Profile LUT（View/Light vs Half Angle）
5. 水たまり・油膜：薄膜干渉表現
6. メッシュペイント：Virtual Texture活用
7. 葉付き流水：Normal + POM組合せ
8. 苔：Fuzzによる繊維表現
9. ひび割れガラス：TranslucentColoredTransmittance設定
10. 粗い屈折：Roughness・Thickness値で背景ぼかし
11. 汚れたガラス：多層構造

## 特殊設定

- **翻訳ガラスのBlend Mode**：TranslucentColoredTransmittance（ThinTranslucentシェーディング相当）vs TranslucentGreyTransmittance（フォールバック）。Lighting ModeはSurface Forward Shading推奨
- **Specular Profile LUT方式**：View/Light（直感的サンプリング）vs Half Angle（物理的精密性）の2方式
- **Topology Closure**：パフォーマンス最適化の重要検討項目として言及（詳細未確認、要現地確認）

## 監査（ペア照合）

以下3項目を独立してWebFetch再取得し、原文ページ番号付きで一致確認済み：
1. メモリバジェット（Simple 8B/Single 24B/Complex 36B/Complex Special 52B、p.86）— 一致
2. `r.Substrate.BytesPerPixel`デフォルト80バイト（p.87）— 一致
3. バージョン別ステータス（p.4）— 一致

## SCRAP BLITZ UE への応用メモ

- [materials_technique_doctrine.md](materials_technique_doctrine.md)に「本プロジェクトSubstrate有効(Adaptive GBuffer)・実害なし確認済み」との既存記録あり。本資料のメモリバジェット表（Simple/Single/Complex/Complex Special）と`r.Substrate.BytesPerPixel`は、今後マテリアル複雑化時のパフォーマンス予算判断基準として直接使える
- OCジェム（`SBOcGem`）のダイヤモンドマテリアルのような光沢・屈折表現を作り込む場合、Glint・Second Roughness・SSS MFPノードが候補になる（現状は仮マテリアルのため、本格実装時の参照先）
- 応用事例11種のうち「金属車塗装（多層コーティング）」「ひび割れガラス」はプロダクト内の金属質感プロップ・破損表現に転用できる可能性がある（未検証）
