# 学習ノート — Unreal Engine 5 - Ground Slash VFX - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=EXWwZ4F_reA （20分41秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/EXWwZ4F_reA.txt](../transcripts/EXWwZ4F_reA.txt)

## エフェクト構築手順（工程順）

1. **[01:09]-[04:57]** スラッシュメッシュをBezier Curveから自作。**UVを「手前=明/奥=暗」に意図的配置**（グラデーションテクスチャで刃の進行方向側が光る演出の要）
2. **[05:02]-[08:02]** マテリアル：Additive、Gradient Horizontalテクスチャ、Lifetime=1.8、**Scale Alphaのみカーブ制御**（RGBは変えず透明度だけフェード）、Local Space=ON
3. **[08:05]-[09:15]** Light Emitter追加：Color Value=8,000（非常に高輝度）、Position Offset Z=+50（地面めり込み防止）、Light Radius=100
4. **[09:21]-[13:00]** Decal（地面焼き付き）Emitter：Material Domain=Deferred Decal、**Particle ColorをDecal Colorノードに置換（Decal専用ノードが必須）**、Decal Sizeをカーブで縮小（薄く細くなる）
5. **[12:47]-[14:30]** Blueprint：Line Trace（Z軸下方投影）で地形追従、Reduce Speed boolで減速補間 → 「地形に張り付きながら滑走し途中減速して止まる」
6. **[14:39]-[19:11]** デブリ：Blender Cell Fracture（**Noise=1が重要**、規則的すぎる破片を回避）、空中デブリ（Gravity+Collision追加）と地面デブリ（力学系モジュール全削除）を使い分け

## 判断基準・コツ

- UVレイアウトが最重要工程：グラデーションテクスチャで狙った箇所を光らせるにはUV設計が土台
- Scale Alphaのみカーブ制御：色そのものは変えず透明度だけ変化させ、両方カーブにすると色味が破綻するのを避ける
- Decalは専用マテリアル（Decal Colorノード必須）：通常のParticle ColorではDecal Domainで正しく動作しない
- Emitter StateをSystemでなくSelfに設定：単発エフェクトのループ挙動を自身の寿命で制御
- Cell FractureのNoise=1：破片の割れ方に不規則性を持たせ、規則的すぎる不自然な形状を避ける
- デブリ2層（Air/Ground）でGravity/Collision有無を使い分け：地面固定デブリには力学系モジュールがそもそも不要

## 主要パラメータ

| 項目 | 値 |
|---|---|
| Slash Lifetime | 1.8秒 |
| Light Color Value | 8,000 |
| Decal Loop Duration | 1.8秒 |
| Debris Air Velocity | 250〜450 |
| Debris Ground Lifetime | 約3秒 |
| Cell Fracture Noise | 1 |

## SCRAP BLITZ UE地上攻撃/SP技への応用可能性

- メッシュ型スラッシュ+Additiveマテリアルは、METEO系SP技の地上斬撃（衝撃波状の刃）にそのまま流用できる
- Decal（地面焼き付き）+Light Emitter併用の三層構成（メッシュ/ライト/デカール）は、DrawDebug仮実装からNiagara/Decal本番差替に合致するテンプレート
- デブリ2層のGravity/Collision使い分けは、SBMine型AOE演出の「着地後も残る破片」表現に転用可能（既存の`emitBarDebris()`とは役割が異なるため名称分離が必要）
- proto側の座標・単位系（wu:uu=1:1、速度×60）に合わせた再チューニングが必須

## 確信度が低い抽出

1. [08:36]-[08:40] Light Color Value「8,000」の色空間解釈
2. [11:53]-[12:19] Decal Sizeカーブキーのタイミング対応
3. [17:08]-[17:32] Debris Air Scale Mesh Sizeカーブキーの時間軸順序
