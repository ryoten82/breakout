# 学習ノート — Unreal Engine 5 - Meteor Rain VFX - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=-Cdn0_98PXM （17分26秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/-Cdn0_98PXM.txt](../transcripts/-Cdn0_98PXM.txt)

## エフェクト構築手順（工程順）

4つのEmitterの組み合わせ。「本体（隕石頭部）」がGenerate Event（Location/Death）を発火し、他3つが受信して連動。

1. **[00:16]-[04:52]** 隕石本体：Color(764,160,0=HDR的高輝度)、**Shape Location Sphereの Zスケールを0にして「円形の降下エリア」に**、Velocity Z=-10000、Collision+Advanced Aging で衝突後に強制消滅、**Generate Event（Location+Death）**でトレイル・着弾演出の発生源に
2. **[05:54]-[10:58]** 尾（Ribbon Renderer）：Location Event受信、Scale Colorグラデーション（黒→オレンジ→黒）、Ribbon Width先端太く末尾細く。**Additive版+Translucent版（黒・太め）を重ねてコントラスト強調**
3. **[11:03]-[13:12]** 着弾フラッシュ：Death Event受信、Lifetime=0.2（一瞬）、Scale Sprite Sizeで拡大→縮小
4. **[13:15]-[15:52]** 着弾スパーク：Death Event受信（Spawn Number=40）、Add Velocity(Cone, 2000〜10000)、Gravity Z=-10000で落下、Velocity Alignment

## 判断基準・コツ

- Shape LocationのZスケールを0にする：球を潰して円形の降下エリアにし3D的に散らばせず地表投影的な広がりを作る
- 色に1.0を超える極端な値を使う：発光（Emissive/HDR的な輝度）を強く見せるため
- Generate EventにLocationとDeathの両方を使う：Location=移動軌跡沿い（尾）、Death=消滅の瞬間（フラッシュ・火花）で使い分ける一般設計パターン
- Requires Persistent IDsを有効化：Generate Eventの前提条件
- Additive版とAlpha Blended（Translucent）版を重ねる：Additiveは黒を表現できないため、暗い色でコントラストを作るには別ブレンドモードのレイヤーが必要

## 主要パラメータ

| Emitter | パラメータ | 値 |
|---|---|---|
| 隕石本体 | Spawn Rate | 2/秒 |
| 隕石本体 | Velocity Z | -10000 |
| 尾 | Ribbon Width（始点） | 70（Additive）/100（Translucent） |
| 着弾フラッシュ | Lifetime | 0.2 |
| 着弾スパーク | Event Spawn Number | 40 |

## SCRAP BLITZ UEの広範囲SP技エフェクトへの応用可能性

- Generate Event（Location/Death）による多段構成パターンは、隕石雨に限らず「広範囲弾幕・爆撃系AOE」全般に転用できる骨格。1つの弾本体EmitterからLocation EventとDeath Eventを分岐させる設計は、METEOの広範囲SP技のNiagara実装骨格としてそのまま参考になる
- proto側でAOEの複数着弾定義を確認した上で、UE側は「本体Emitterのspawn rate/shape locationのradius」で降下エリアと密度を制御する設計に対応させられる
- 着弾時の「フラッシュ+火花」の2段構成は、既存AOEテレグラフ（予告）とは別レイヤーの「着弾後演出」。警告→降下→着弾エフェクトの3段が完成する
- Requires Persistent IDsの要件はUE Niagara特有の制約としてそのまま踏襲する必要がある

## 確信度が低い抽出

1. [01:19] Color値「764」（8bit色域超のHDR的表現）
2. [06:58] Ribbon UV Mode「5」の対象パラメータ
3. [07:47]-[08:19] Ribbon Width設定の正確なモジュール構成
