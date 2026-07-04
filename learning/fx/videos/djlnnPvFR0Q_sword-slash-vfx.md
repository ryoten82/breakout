# 学習ノート — Unreal Engine 5 - Sword Slash VFX - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=djlnnPvFR0Q （16分27秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/djlnnPvFR0Q.txt](../transcripts/djlnnPvFR0Q.txt)

## エフェクト構築手順（工程順）

1. **[00:22]-[02:22]** 三日月型メッシュ自作（シリンダーvertices=32、Cap Fill Type=None、中央Edge LoopをProportional Editingで膨らませZ軸潰し）
2. **[00:27]-[04:15]** Lifetime=0.35、Mesh Renderer、**Mesh Rotation Force + Y軸カーブ（1→終端0.75で-0.25）でスラッシュの回転を制御。Scale Curve=250が回転力（振りの勢い）の支配パラメータ** → 「最初は速く、終盤で減速する」斬撃モーション
3. **[04:15]-[08:47]** マテリアル：Additive、Voronoiノイズ+マスク乗算→Emission、**Dynamic Parameter 2系統**（index0=power/erosion、index1=tiling/speed）、Erosion Curveで開始0.05→終端1（完全消滅）
4. **[08:53]-[10:52]** 多層構成：Bright（コア）/Bright02（オレンジ、Power4）/Dark（黒、**Additiveだと黒が見えないためTranslucentに変更、Render Order=-1で最背面**）
5. **[10:52]-[12:11]** インパクトエフェクト（着地閃光）：フレア状テクスチャ、Scale Sprite Sizeで膨らみ→縮小
6. **[12:11]-[15:05]** ストレッチパーティクル：Add Velocity(Cone)、**Sprite Size Non-uniform(X=5,Y=80)+Velocity Alignment**で速度感を演出
7. **[15:05]-[16:20]** 浮遊パーティクル：Shape Location=Torus（斬撃と同じ弧形状に発生源を一致させる）、Wind Force+Aerodynamic Drag

## 判断基準・コツ

- Mesh Rotation Force+Y軸カーブ（1→終端で減速）：**「速さ→減速」という斬撃の緩急を作る核心**。実際の刀の振りも初速最大→自然収束するため説得力が出る
- 多層構成（Bright/Bright02/Dark）：単色1枚では平坦、明部・中間色・暗部を重ねることで奥行きと発光の強弱を演出
- Darkレイヤーだけ Translucentに変更：Additiveは黒を表現できない（加算=0=見えない）
- Non-uniform Scale(5×80)+Velocity Alignment：進行方向に細長く伸ばし「速すぎて残像になる」視覚的嘘を作る
- 浮遊パーティクルをTorus+斬撃と同じ向きに整列：発生源の形状を武器の軌跡に一致させ「斬撃から飛び散った」因果関係を担保
- Local Space ON：エフェクト発生元（キャラ/武器）が移動・回転しても追従するため

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| コアスラッシュLifetime | 0.35 |
| Rotation Scale Curve | 250 |
| Erosion Scale Curve | 10 |
| Darkレイヤー Render Order | -1 |
| ストレッチSprite Size (Non-uniform) | X=5, Y=80 |
| 浮遊Torus Large Radius | 160 |

## SCRAP BLITZ UEコンボ斬撃エフェクトへの応用可能性

- 三日月メッシュ+Mesh Rotation Forceのイージングカーブは各段攻撃の斬撃軌跡表現に転用可能。コンボ段によってScale Curve（回転力）を変えれば「軽い1段目→重い最終段」の緩急差を表現できる
- 多層構成（Bright/Bright02/Dark）は`char01.md`のコンボ補正システムと絡めて段数が進むほどレイヤーを追加/色を変化させる演出フックにできる
- ストレッチパーティクルはMETEOのダッシュ攻撃やSP技の高速斬撃に直結
- Local Space ON徹底が必須（UE CMCベースでキャラが常に移動するため）

## 確信度が低い抽出

1. [02:49] ライフタイム「0.35」、[02:56]-[03:21]「0 to 25」表記の小数点位置
2. [08:01]-[08:02] Speed X/Y値（-2, 3）の符号
3. [07:32]-[07:33] コアカラー値のレンジ（0-1かHDRか）
