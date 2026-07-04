# 学習ノート — Creating Simple Impact Burst Effects in Unreal Engine

- 動画: https://www.youtube.com/watch?v=cBc31YcWw_M （31分39秒、**UE4時代のCascade Particle System前提**。現行UE5.8はNiagara標準のためノード名は概念対応で読み替えが必要）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/cBc31YcWw_M.txt](../transcripts/cBc31YcWw_M.txt)

## エフェクト構築手順（工程順）

### テクスチャ作成（Photoshop）[02:01]-[07:56]
- リング2枚必要：シャープ版+ぼかし版（Gaussian Blur、Screen合成で明度加算）
- 完成したシャープ/ぼかしチャンネルを別カラーチャンネル（赤=シャープ、青=星形状）に格納し1枚のTGAにまとめる（**RGBチャンネル分割マスクはUE4/UE5共通の定番最適化**）

### マテリアル作成（Unreal）[08:02]-[10:38]
- ring01：Particle Color→Emissive、Blend Mode=Additive、Unlit、Two Sided。赤チャンネル（シャープ版）をOpacityへ
- ring02：ring01複製、参照チャンネルをぼかし版に差替
- star：Powerノードで指数0.2〜0.3程度に下げてエッジをシャープ化
- spark：Radial Gradient Exponentialでリング状マスク→鋭いドットに整形

### Cascadeエミッター構築 [10:38]-[31:13]
| エミッター | 主な設定 |
|---|---|
| Ring | Burst機能で1回に2パーティクル、Lifetime=0.4秒、Sprite Size初期値Uniform乱数約150、Size by Lifeカーブ |
| Glow | ring複製、Additiveぼかし版、密度を下げて柔らかく光らせる |
| Star | Velocity from Point（放射状）、Sprite Size大小2パターン、Lifetime 1.2〜2.5秒程度、Drag強め（途中で失速）、Rotation Rate（degree単位に注意） |
| Spark | Velocity、Size by Life（X軸縮小/Y軸伸長、線状→点のストレッチ表現）、Spawn Rate約20 |

最終的にリング色を白に統一 [30:16]

## 判断基準・コツ

- リングをシャープ+ぼかしの2種に分ける理由：単一レイヤーでは硬い/柔らかいのニュアンスを同時に出せない。Additiveで重ねて輪郭のキレと発光のにじみを両立
- PhotoshopのPower/Levels調整：テクスチャを作り直さずに「侵食されたような形状変化」を作る時短テク。マテリアル側Powerノードでも同じ効果を再現可能
- RGBチャンネル分けでマスクをまとめる：テクスチャサンプル数を抑える古典的最適化（現行UE5.8でも有効）
- **StarやSparkに強めのDragをかける理由**：飛び散った破片が途中で失速して残ることでインパクトの余韻（hang time）を演出。「一瞬で消えるとチープに見える」という経験則
- SparkのSize by LifeをXY非対称にする理由：加速中は線状に伸び、減速すると点に収束するモーションブラー的表現

## 主要パラメータ

| エミッター/項目 | 値 |
|---|---|
| Ring Lifetime | 0.4秒 |
| Ring Sprite Size | 約150 |
| Star Power指数 | 0.2〜0.3 |
| Star Lifetime | 1.2〜2.5秒 |
| Star Rotation Rate | ±90度→最終的に±50度程度 |
| Spark Spawn Rate | 約20 |

## 現行UE5.8での通用度

**通用しそうな部分**：RGBチャンネル分割マスク設計、Additive Unlitマテリアル設計思想、Radial Gradient Exponential（現行でも同名ノード健在）、Size by Life/Color by Lifeの「時間で変化させる」設計思想、強いDragによる余韻演出、Photoshopでのテクスチャ侵食テク

**古そうな部分（要読み替え）**：
- エディタ自体がCascade（UE5.8ではNiagara標準・Cascadeは非推奨）
- Burst→Niagara Spawn Burst Instantaneous、Size by Life→Scale Sprite Size（Curveベース）、Velocity from Point→Add Velocity/Point Attraction Force等
- GPU/CPUパーティクルの区別に言及なし（UE5ではNiagara GPUシミュレーションが主流）

## SCRAP BLITZ UEへの応用可能性

- **リング＋グロー＋スパーク＋星の4層構成は汎用インパクトの定番テンプレート**として流用価値が高い。既存のAOEテレグラフ統一システム（固定赤枠/円+橙塗り）と同様に、被弾インパクトも「リング拡大＋グロー＋飛散パーティクル」で統一フォーマット化できる
- 強いDragで飛散物を失速させる演出は、既存の`DoAttackHit`（GE+KB+hitstop一括処理）のヒットストップタイミングとスパークの失速タイミングを同期させると「重さ」が増す
- RGBチャンネル分割マスクは、被弾インパクト用の共通マスクアトラスとして最初に1枚作っておくとキャラ差分（METEO用/敵用等）の量産が楽になる
- リング最終色を白に統一する判断は、CLAUDE.mdの「ボスが白なのに爆発がオレンジはNG」という演出ポリシーと一致する考え方

## 確信度が低い抽出

1. Ring Lifetime「0.4秒」・Sprite Size「150」等の具体的数値（画面確認未実施）
2. Sprite Sizeパラメータの迷走箇所の技術的原因（Cascade内部仕様、特定不可）
3. Star Rotation Rate「±90度→±50度」（言い直しが多く最終値の確証が低い）
