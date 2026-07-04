# 学習ノート — Unreal Engine 5 - Slash Attack VFX - Niagara Tutorial（クロススラッシュ）

- 動画: https://www.youtube.com/watch?v=meig8T9uWNc （17分57秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/meig8T9uWNc.txt](../transcripts/meig8T9uWNc.txt)
- 前作「Sword Slash VFX」（[djlnnPvFR0Q_sword-slash-vfx.md](djlnnPvFR0Q_sword-slash-vfx.md)）のメッシュ・基本マテリアルを流用した続編。新規要素は「4方向への複製によるクロス構成」「Ground Mark明暗2層化」「Debrisの物理挙動チューニング」の3点

## エフェクト構築手順（工程順）

1. **[00:46]-[04:56]** スラッシュ本体(sl01)：Lifetime=0.45、Position X移動距離をCurve化（最終キー1,800）、Scale 0.33→1.0、**Generate Location Eventを追加**（後続Sparks/Debris/Ground Markの発生源、Persistent IDs必須）、Event Send Rateをカーブ減衰
2. **[05:49]-[07:47]** spark01（火花）：Non-uniform Sprite（3×30）、Add Velocity(Cone, 800〜1500)、Velocity Aligned、**Event Handlerで Slashの Location Eventを受信**（Spawn Number=3）
3. **[08:22]-[10:42]** Debris：spark01を複製しMesh Renderer化、Drag弱め・Gravity Z×3・Collision Bounce=0.2（火花より重い物理挙動）
4. **[11:01]-[12:34]** Ground Mark Bright：地面焦げ跡（明）、Location Event受信でSpawn Number=1
5. **[12:34]-[13:20]** Ground Mark Dark：**Additiveでは暗色を表現できないためTranslucentに変更**、**Sort Order=-1でBrightより下に描画**
6. **[13:30]-[16:31]** 十字4方向複製：Position Scale Curve（±1）とOrientation（0/0.25/0.5/0.75=0°/90°/180°/270°）の使い回しで4本のスラッシュを効率的に量産

## 判断基準・コツ

- Generate Location Eventを使う（Sprite位置追従でなくイベント発信）：移動する斬撃の軌跡上に、動きに追従して火花・破片・地面痕を「後付け」でスポーンさせる疎結合設計
- Event Send Rateをカーブで減衰：斬撃の勢いが衰えるにつれエフェクト密度も下げ自然な収束感を出す
- Debrisは火花より重い物理挙動：Drag弱め・Gravity強め・Collision追加で「重さ」の差別化
- Ground Markを明暗2層に分離しSort Orderで暗色を下に描画：Additive（明）だけでは焦げ跡の影部分が表現できない
- 4方向複製でPosition Scale Curve（±1）とOrientationの使い回し：同じカーブ資産を符号反転・軸入れ替えだけで別方向に転用でき作業量を最小化

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| sl01 Lifetime | 0.45秒 |
| sl01 Position X移動距離 | 1,800 |
| spark01 Velocity | 800〜1500 |
| Debris Gravity Z | ベース×3 |
| Ground Mark Dark Sort Order | -1 |
| 4方向 Orientation Z | 0/0.5/0.25/0.75 |

## SCRAP BLITZ UE：METEOコンボ斬撃エフェクトへの応用可能性

- Generate Location Eventを使ったイベント駆動構成は、METEOの多段コンボ攻撃で「斬撃メッシュの軌跡に沿って火花・地面エフェクトを後付け発生させる」パターンにそのまま転用可能
- 十字4方向の複製手法は、SP技や強攻撃で「全方位斬撃」演出を作る際に1本分の資産を使い回せる効率的な設計
- Ground Mark明暗2層+Sort Order分離は、着地・斬撃痕エフェクトを地面に残す演出（DrawDebug仮実装→本番移行時）に直接使える

## 確信度が低い抽出

1. [06:57]-[07:11] Sparks Cone Axis Range数値
2. Color値（R/G/B）のレンジ解釈（HDRか0-1か）
3. Position移動距離・Send Rate等の単位（cm/uu）
