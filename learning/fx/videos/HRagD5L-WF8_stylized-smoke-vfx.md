# 学習ノート — Unreal Engine 5 - Stylized Smoke VFX - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=HRagD5L-WF8 （11分39秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/HRagD5L-WF8.txt](../transcripts/HRagD5L-WF8.txt)

## エフェクト構築手順（工程順）

1. **[00:19]-[02:18]** Mesh Renderer使用（**平面テクスチャでなく塊感のあるstylized煙を出すのがこの手法の核**）、Spawn Rate=20、Add Velocity(Cone, 800, 上方向)
2. **[02:34]-[04:07]** Blenderでベースメッシュ制作：Ico Sphere×2〜4個複製→結合→**Remesh(Voxel)→Decimate（この順序が重要）**、UV=Sphere Projectionで簡易展開
3. **[05:21]-[05:53]** Mesh Orientation=Random（同じメッシュでも向きランダムで単調さ回避）、Scale Mesh Sizeをカーブ（0.1→1.5、膨張表現）
4. **[06:03]-[07:54]** マテリアル：Blend Mode=Masked、**Power×Power の2段構成**（1段目=テクスチャ影響度、2段目=浸食強度）、Dynamic Parameter（Erosion/Power）
5. **[08:06]-[09:10]** Erosion Curveは「高い値=無消散、低い値=完全消散」という**逆転ロジック**（開始位置0.3で値15→終端で消散）
6. **[09:38]-[10:11]** Wind Force追加（Drag必須、配置順序に注意）、**Turbulenceは無効化**（一定方向の流れの方がリアルな煙のなびきに近い）

## 判断基準・コツ

- Mesh Rendererを使う：平面テクスチャでは出せない塊感のあるstylized煙の立体感
- Remesh(Voxel)→Decimateの順序：Subdivision適用直後は頂点過多、Remeshで再構築してからDecimateで軽量化
- Dynamic Parameterは必ずパーティクル側（Spawn/Update）に置く：エミッタ側だとパーティクル単位のアニメーションができない
- Erosionカーブの逆転ロジック：Opacity MaskへのR×Erosion値の乗算回路上、この数値設計になる（勘違いしやすいポイント）
- Wind追加時はDragモジュールの並び順に注意：Solve Forces and Velocityより前に配置する制約

## 主要パラメータ

| モジュール | パラメータ | 値 |
|---|---|---|
| Emitter Update | Spawn Rate | 20 |
| Blender Remesh | Voxel Size | 0.5※推定 |
| Scale Mesh Size Curve | 開始/終了 | 0.1 / 1.5 |
| Erosion Curve | 開始位置0.3で値15、終端で消散 | |
| Wind Force | Turbulence | 無効化 |

## SCRAP BLITZ UEへの応用可能性

- コンテナ破壊時の煙：Mesh Renderer+Erosion Dissolve方式は、Niagara Mesh Emitterを使った低ポリ煙塊としてそのまま流用しやすい
- ボス死亡演出（explode フェーズ）に、Wind Force+上方向Cone Velocityの組み合わせが「爆煙が上昇しながら広がる」効果として応用可能。ボス色統一ルール（「ボスが白なのに爆発がオレンジはNG」）に対応するには、Scale Color/Particle Colorを白〜グレー系に差し替える
- Blender側のIco Sphere複製→Remesh→Decimateは、複数の煙バリエーション（コンテナ用/ボス用/小爆発用）を同じワークフローで作り分けるテンプレートとして使える

## 確信度が低い抽出

1. [03:33] Voxel Size「0.5」（0.05の可能性も）
2. [06:52]-[07:08] Dynamic Parameter Erosionデフォルト値「20」
3. [10:03]-[10:09] Wind Speed X/Z値「1500/1500」
