# 学習ノート — Unreal Engine 5 Niagara - Force Push Ring VFX Tutorial for Beginners

- 動画: https://www.youtube.com/watch?v=u1Cm5g0lhVg （CGHOW、18分52秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/u1Cm5g0lhVg.txt](../transcripts/u1Cm5g0lhVg.txt)

## エフェクト構築手順（工程順）

### マテリアル`M_Ring`（Unlit+Translucent）
1. **[02:59]-[03:22]** Radial Gradient→**Sine×2**でリング形成（1回だと非対称になるため両側フェードに）
2. **[03:27]-[04:29]** "aura texture"をRadial Gradientに接続してリング状に変換、Texture Sampler Wrap=Clamp（シーム除去）、Radial Gradientと Multiply
3. **[04:38]-[05:32]** **段階的シェーディング化**：値をLayers（デフォルト4）でMultiply→Floor→同じLayersでDivide → 明暗が段々の層になりフェード感が消える
4. **[05:53]-[07:47]** ColorRampノード（UE5.xで新規追加）で着色。段階値をMultiply(×3程度)→Saturateで0-1クランプ後、層ごとに色を割当（暗→青→明るい青→白）
5. **[08:03]-[09:16]** 不透明度マスク：Float3(RGB)で受けてAlphaとMultiply（Float4のまま扱うと型エラー）
6. **[09:32]-[10:19]** パラメータ公開：Layers/Tiling(TX,TY)/Ring Thickness

### Niagara System
7. **[10:23]-[11:37]** Empty System、Emitter Minimal、Burst 1 particle、Sprite Size≒200→150→120、Dynamic Material ParametersでLayers=4/Tiling=1/Ring Thickness=6初期設定
8. **[12:06]-[13:09]** Ring ThicknessをCurveでアニメーション（フェードイン→維持→フェードアウト）。Spawn Burst Instantaneous 1粒+Life無限、Loop Duration相当2.5固定
9. **[13:09]-[14:14]** レイヤー2つ目複製：Thickness増、Tiling(2,4)、Opacity減、青み強化 → 1層目フェード+2層目シャープの2層同時表現
10. **[14:18]-[15:16]** 3層目複製：さらに薄く、Tiling増、回転速く、明るさ調整
11. **[15:31]-[16:14]** 背景を暗くする追加レイヤー（1層目複製、黒色化、Alpha増）
12. **[16:14]-[18:00]** Distortion追加：Noise Texture+Panner(速度0.1/0.1目安)でUVを歪ませる、Distortion Strengthパラメータで層ごとに歪み量を変える（1層目弱め、2層目1.0程度）
13. **[18:09]-[18:47]** Rotation Rate再調整、Point Light（青）追加で仕上げ

## 判断基準・コツ（リング状の力の広がりの表現）

- Sineを2回使う理由：Sine1回だと非対称形状になり「一方向にだけ力が広がる」ように見える。2段重ねで両側均等フェードにし「中心から均等に力が放出される」自然なリング形状に
- **複数レイヤーの重ね合わせが本質**：役割の異なる3層（フェード基調層／シャープディテール層／高速回転装飾層）を重ねることで力の"厚み"や"複雑さ"を演出
- Floor+Divideによる段階化の意図：フェードのままだと"力強さ"が弱く見える。値を層状に区切ることでダメージ/パワーの"押し出し感"を強調
- ColorRampで層ごとに色を変える理由：エネルギーの密度差（中心=高エネルギー=明るい、外側=低エネルギー=暗い）を色で表現
- Ring Thicknessのカーブアニメーション：太さを絞る/緩める動きで「発生の瞬間に力が凝縮し、そこから解放される」時間軸演出
- Distortion（UVパンニング+Noise）の意図：完全な幾何学形状にせず有機的な流動感を追加し、単なる図形に見えないようにする
- Burst 1粒+Life無限の構成理由：Spawn Rateだと粒子が連続発生してリングが重なり続ける。1回のBurst+マテリアルパラメータのCurveアニメーションで「1回だけ発生するリング」を制御しやすくする

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| Blend Mode | Unlit+Translucent |
| Layers | 4 |
| Sprite Size | 200→150→120 |
| Burst数 | 1 particle |
| Loop Duration相当 | 2.5 |
| 2層目Tiling | (2,4) |
| Distortion強度（1層/2層） | 0（低）／1.0程度 |

## SCRAP BLITZ UEのノックバック演出への応用可能性

- SuperKnockChain等の「力を込めて吹き飛ばす」表現に、このリング拡散VFXが「衝撃波（インパクトリング）」としてそのまま転用可能。ヒット位置中心・ノックバック方向に垂直な平面でBurst発生させる構成
- ノックバック強度パラメータがあれば、Ring Thickness/Sprite Size初期値・Curve振幅にリンクさせ「強いノックバックほど太く大きいリングが一瞬で広がる」直感的な強弱表現ができる
- 段階着色（ColorRamp+Floor/Divide）は、CLAUDE.mdの「色・エフェクトは統一感を保つ」方針に合わせ、ColorRampの色スウォッチを白〜シルバー系に差し替えるだけで既存演出色に適合させやすい
- 1層目（フェード）＋2層目（シャープ）＋3層目（高速回転装飾）の3層構成は、ヒット強度ランク（弱/強/BURST）に応じてレイヤーON/OFF・強度切替する設計と相性が良い。BURST化コンボの着地演出（common01 §11）に3層フル使用で視覚的差別化がしやすい
- ColorRampノードのUEバージョン対応状況（動画は「3週間前に追加された新機能」と発言）は事前確認が必要

## 確信度が低い抽出

1. [12:14] 「thickness is 2.7」「decreasing like 40」の数値対応関係
2. [16:43]-[16:56] Panner速度「0.1」の単位
3. [18:12]-[18:19] 「maybe 50 and 10」がどのパラメータを指すか
