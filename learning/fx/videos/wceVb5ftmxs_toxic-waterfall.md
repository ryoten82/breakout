# 学習ノート — Unreal Engine 5 - Toxic Waterfall - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=wceVb5ftmxs （18分12秒、リスト先頭）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/wceVb5ftmxs.txt](../transcripts/wceVb5ftmxs.txt)

## エフェクト構築手順（工程順）

1. **[00:33]-[01:04]** Niagara System作成、パイプ用Emitter＋滝本体Emitter（Mesh Renderer）
2. **[01:35]-[04:07]** Erosionマテリアル：Additive+Unlit、ノイズ×マスク（Material Makerでグラデーション自作）、Particle Colorノードで色制御、Wrap Mode=Clamp（継ぎ目対策）、メインテクスチャ→Power→マスクAlpha乗算→Opacity。**Dynamic Parameterでチャンネル管理**（ch0=Power/Erosion、ch1=Tiling/Speed）
3. **[04:30]-[05:07]** UVスクロール：TexCoord×Tiling→Append→UV乗算、Time×Speed→Append→UVに加算
4. **[06:20]** Niagara側：Power=3、Erosion=0〜3、Tiling(1,2)、**Speed X=-1.5（マイナスでパイプから流れ出る向きに）**
5. **[06:54]-[08:04]** 2枚目waterfallレイヤー：別ノイズ、Erosion値を上げて「曲線的な筋」だけ残す、Tiling0.5・速度遅めでコントラスト
6. **[08:12]-[09:21]** Puddle（水たまり）：Blenderでコーン状に持ち上げた円盤メッシュを自作、専用グラデーションマスク（フェードイン後急にフェードアウトする非対称カーブ）
7. **[12:08]-[13:26]** Beam（光柱）：標準Plane使用、Additive+Unlit、**Depth Fadeで地面との交差部分を滑らかにブレンド**
8. **[14:32]-[17:02]** Shock Waves（衝撃波リング）：リングテクスチャ自作（Circle−縮小コピー=リング）、Scale Mesh Size/Scale Colorをカーブ+Autoで「拡大→フェードアウト」演出、最初のキーを0.2から開始（サイズ0だと点に見えるため）

## 判断基準・コツ

- Wrap Mode=Clampでテクスチャ継ぎ目のアーティファクト対策
- Dynamic Parameterでチャンネル管理：1マテリアルを複数エミッター（waterfall/puddle/beam）で使い回し、再利用性を上げる
- Speedを負値にする理由：プラスだと「吸い込まれる」動きになり不自然、パイプから流れ出る向きに符号反転
- 2種類のノイズ・2層構成：単一ノイズだと単調になるため、速度・タイリング・色味を変えて重ねる
- Depth Fadeをビームマテリアルに使う理由：Additive/Unlitの板ポリが地面と交差すると硬い切れ目が出るため
- Scale Mesh Size/Scale ColorをCurve+Autoタンジェントで制御：線形より滑らかな加減速で自然な「膨張して消える」動きに

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| Waterfall Power/Erosion | 3 / 0〜3 |
| Waterfall Speed X | -1.5 |
| Puddle Scale | 4（Uniform） |
| Beam Depth Fade Distance | デフォルト0 |
| Shock Wave Lifetime | 1秒 |
| Shock Wave 最終Size | 12 |

## SCRAP BLITZ UEの毒沼/液体系背景演出への応用可能性

- Erosionマテリアルの構造（ノイズ×マスク×Power→Opacity）は毒沼・溶岩・スライム等「不定形に揺らめく発光液体」全般に転用可能
- Puddle（コーン状メッシュ+専用グラデーション）は毒沼の水面が地形に馴染む縁のフェード表現に直結
- Beam+Depth Fadeは毒沼から立ち上るガスの発光演出に応用可
- Shock Wave（成長するリング）は毒ガス放出・気泡の演出に転用可
- 本プロジェクトのDrawDebug仮実装→本番Niagara差替の二段構え方針と直接整合。Material Maker依存部分（グラデーション・ビーム・リングテクスチャ）はUE標準ツールで代替可能

## 確信度が低い抽出

1. [06:20] Erosion範囲「0 to three」の具体的な数値関係
2. [09:52]-[09:55] Puddleグラデーションのキー位置(0.2)とalpha値(70)の単位（0-1か0-100か）
3. [15:41] Shock Wave Spawn Rate「2」の単位
