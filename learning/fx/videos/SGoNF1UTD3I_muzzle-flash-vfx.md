# 学習ノート — Unreal Engine 5 - Muzzle Flash VFX - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=SGoNF1UTD3I （22分09秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/SGoNF1UTD3I.txt](../transcripts/SGoNF1UTD3I.txt)

## エフェクト構築手順（工程順）

1. **[00:51]** マズルフラッシュの基本構造 = **2枚の交差平面（クロスプレーン）+ コーンメッシュ**の計2メッシュ
2. **[01:18]** Spawn Burst Instantaneous, Count=1（単発バースト＝瞬間発光）
3. **[01:38]-[03:25]** Blenderで交差平面自作：ピボットを銃口側の辺に設定（スケールが銃口起点で広がるように）
4. **[03:59]-[05:11]** Lifetime=0.1〜0.2秒（わずかにランダム）、Scale Mesh Size（0→1成長カーブ）、メッシュをワールド原点にセンタリング（中心から広がる問題の解消）
5. **[06:11]-[08:50]** テクスチャ手描き（1024×1024、ミラー描画で左右対称に、Smearブラシで「奥へ流れる」モーション感）
6. **[09:16]-[10:44]** マテリアル：Translucent、Particle Colorノード（RGB×RGB→Emissive、Alpha×Alpha→Opacity）、**Two SidedをON（板ポリの片面カリング対策）**
7. **[11:08]-[13:46]** コーンメッシュ自作（Cap Fill Type=None、中央に穴を開けて奥行き感）
8. **[14:04]-[17:48]** コーンEmitter：Scale Alphaのみカーブ化、**Initial Mesh Orientationは軸を絞る（Y軸のみランダム、X/Zは0固定）**、コーン専用テクスチャは回転複製で作成（円錐UVは水平展開になるため）
9. **[18:04]** クイックフラッシュ（閃光）レイヤー：Sprite Renderer、Scale Sprite Size大→小、Alpha 0.01〜0.05
10. **[19:36]** ストレッチスパーク：Add Velocity（Cone）、**Sprite Renderer Alignment = Velocity Alignment**

## 判断基準・コツ（特に瞬間発光の演出）

- Spawn Burst Instantaneous, Count=1：マズルフラッシュは単発イベント、Rate系ではなくBurstで「一瞬で出す」
- Lifetimeを短く・わずかにランダム化：完全固定だと機械的に見える
- ピボットを銃口位置に設定：スケール基準点がズレると成長方向が不自然になる
- Two Sidedマテリアル設定：板ポリは視点によって消えるため必須
- Initial Mesh Orientationは軸を絞る：全軸ランダムだと銃口方向がズレて破綻する
- コーン用テクスチャは回転複製で作る：円錐UVの水平展開に平面用絵をそのまま貼ると横縞に見える
- ストレッチスパークはVelocity Alignment必須：初期状態は速度方向を考慮しないため

## 主要パラメータ

| 項目 | 値 |
|---|---|
| テクスチャ解像度 | 1024×1024 |
| Lifetime（フラッシュ本体） | 0.1〜0.2秒 |
| Mesh Scale（コーン） | 1.2〜1.4 |
| クイックフラッシュSprite Size | 400〜800 |
| スパークSprite Size(X,Y) | 5〜15, 60〜100 |

## SCRAP BLITZ UEへの応用可能性

- 「交差平面+コーン+フラッシュSprite+ストレッチスパーク」の4層構成は、METEO等の遠距離攻撃発生エフェクトにそのまま踏襲できる
- Spawn Burst Instantaneous+短寿命+わずかなランダム性は「攻撃発生の瞬間演出」全般（踏み込みエフェクト、SP技発動フラッシュ）に転用できる汎用パターン
- Initial Mesh Orientationの軸限定（発射軸周りのみランダム化）は飛び道具メッシュ回転に応用可能
- Velocity Alignmentによるストレッチスパークは遠距離攻撃着弾/発射時の火花演出に直接使える

## 確信度が低い抽出

1. [04:07] Lifetimeランダム範囲の正確な秒数
2. [04:57]-[05:02] 平面メッシュY軸スケール最小値
3. [19:56]-[20:09] スパークX軸幅・速度上限値
