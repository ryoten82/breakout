# 学習ノート — Unreal Engine 5 - Vertical Beam VFX - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=NbbFytz-JDk （15分30秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/NbbFytz-JDk.txt](../transcripts/NbbFytz-JDk.txt)

## エフェクト構築手順（工程順）

全体は「メッシュコア」「フレネル層」「暗色背景層」「Voronoiエロージョン層×2色」「ストレッチパーティクル」の積層構造。

1. **[00:16]-[02:45]** Mesh Core：円柱（Cap Fill Type=None）、**ピボットを底に配置**（Zスケール時に下から伸びる挙動）、Lifetime=3、**Mesh Scale Non-Uniform、Zを15倍にストレッチ→カーブで急成長→安定→ワブル**
2. **[04:00]-[06:01]** Mesh Outside Fresnel：Additive、Fresnel×色をMultiply→Emissive、Fresnel Power=2（デフォルト）
3. **[06:01]-[06:39]** Mesh Outside Dark：ほぼ黒+ダークパープル、**Sort Order=-1で最背面固定**（明るい層とのコントラスト作り）
4. **[06:39]-[10:24]** Mesh Outside Voronoi（オレンジ）：Blend Mode=Masked、**Dynamic ParameterでErosion/Power/Tiling/Speedを外部制御**、Index重複回避が重要
5. **[10:24]-[10:47]** 2色目Voronoi層（青）：オレンジ層を複製し色・Erosion違いで重ねる
6. **[11:17]-[13:20]** Stretched Particles：Shape Location=Torus（下部の輪から湧出）、Velocity Z=5,000、Sprite Renderer Alignment=Velocity方向

## 判断基準・コツ

- Cap Fill Type=None：ビームは中身を見せる必要がないためリング状にしてポリゴン数・描画コストを抑える
- ピボットをメッシュ底部に置く：Zスケール時に「下から伸びる」自然な成長挙動になる
- 複数レイヤー（Core/Fresnel/Dark/Voronoi×2）を半径違いで重ねる：単一メッシュでは表現できない発光・コントラスト・揺らぎを層ごとに分離制御
- Dark層のSort Order=-1：明暗のコントラストを強調するには暗い層が必ず最背面に描画される必要がある
- Voronoiの Blend Mode=Masked：Erosion表現にはOpacityでなくMaskが必要、揺らめきながら消える有機的な形状変化が作れる
- ストレッチパーティクルの発生源をTorus形状に：Sphereだと全方向均等スポーンで柱外周のイメージと合わない

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| Mesh Core Lifetime | 3秒 |
| Mesh Core Z スケール初期値 | 15 |
| Fresnel Brightness | 約2,250 |
| Voronoi（オレンジ）Tiling X/Y | 5/3 |
| Stretched Particles Velocity Z | 5,000 |

## SCRAP BLITZ UE SP技ビームエフェクトへの応用可能性

- 中心の高輝度コア+フレネル発光縁+暗背景コントラスト+Voronoi侵食層という4〜5層積層は「天からの光柱」演出に直結。SP技発動演出（召喚エフェクト等）で情報量のある画になる
- Dynamic ParameterによるErosion/Tiling/Speedの外部露出は、既存AOEテレグラフ実装（SBMine型）と設計思想が近い。「マテリアル側の詳細パラメータをNiagara/Blueprint側でチューニング可能にする」パターンとして踏襲価値あり
- Z軸カーブによる急成長→安定→収束は、SP技発動時の「せり上がってから持続し、フェードする」タイミング制御の参考になる
- Torus形状からの湧出パーティクルは召喚/降臨系エフェクトの足元演出に転用しやすい
- 現時点の仮実装段階では直接の実装対象にはならず、本番演出フェーズ用の参考資料として保持するのが妥当

## 確信度が低い抽出

1. [02:05] マテリアル名「Goman Alpha」→ "Glow Man Alpha"と推定
2. 各層のColor RGB具体値（レンジ・桁数）
3. [12:34]-[12:37] Torus Large/Small Radius具体値の対応関係
