# 学習ノート — Unreal Engine 5 - Stylized Fire VFX - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=OnxiEY3Khow （13分10秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/OnxiEY3Khow.txt](../transcripts/OnxiEY3Khow.txt)

## エフェクト構築手順（工程順）

1. **[00:16]-[01:41]** Fireマテリアル：Additive、Particle Color×Texture→Emissive/Opacity、Material Instance化
2. **[01:54]-[04:07]** Flamesエミッター基本設定：Spawn Rate=20、Lifetime 1.0〜1.7、Color R=30/G=3.5/B=1、Add Velocity(Cone, 1〜25, Angle40, 上方向)
3. **[04:08]-[05:00]** Sprite Rotation Rate(-60〜60)、Scale Sprite Sizeカーブ（大→0.6に縮小、Auto補間）
4. **[04:58]-[07:36]** **Voronoi浸食（2段Power構成）**：1段目Power=Voronoiの影響度、2段目Power=炎全体の浸食度。Dynamic Parameterでニ値を公開、Erosionカーブで**寿命開始時点でも少し浸食させておく**（唐突な出現を避ける）
5. **[07:38]-[09:44]** Smokeエミッター：**Blend Mode=Translucent（Additiveでは黒を表現できないため）**、Color=0（黒）、**Sort Order Hint=-1（炎より下に描画）**
6. **[09:45]-[11:53]** Embersエミッター：Color Random Range（明暗の火の粉バリエーション）、Vortex Force（乱流でランダムな揺れ）、Scale Color終端で黒（フェードアウト）

## 判断基準・コツ

- Add Velocity警告時は「Fix Issue」で自動解決：Solve Forces and Velocity依存
- カーブキーの補間はAutoモード：Linearだと機械的で不自然
- Power2段構成：テクスチャ影響度と浸食強度を独立制御するため
- 煙は黒色を使うためTranslucent必須：Additiveは黒=無加算=見えなくなる
- Sort Order Hint=-1：煙を炎より背面に描画する重要設定
- 不要なモジュールは削除して良い：「差が出ないなら削らない理由がない」という簡略化判断

## 主要パラメータ

| Emitter | パラメータ | 値 |
|---|---|---|
| Flames | Color(RGB) | R=30, G=3.5, B=1 |
| Flames | Sprite Size | 15〜20 |
| Smoke | Blend Mode | Translucent |
| Smoke | Sort Order Hint | -1 |
| Embers | Vortex Force Amount | 20 |

## SCRAP BLITZ UEの炎系エフェクトへの応用可能性

- 爆弾・ガスキャニスター爆発の炎表現：Flames+Smoke+Embersの3層構成がそのまま基本構造として流用しやすい。SmokeのTranslucent+Sort Order Hintによる描画順制御は爆発の黒煙を炎の下に重ねる演出に直結
- Voronoi浸食（Dissolve）テクニックは炎に限らず消滅演出（ボス死亡エフェクト等）全般に応用できる可能性がある
- Embersのランダム色バリエーション（Min/Max Color）は、爆弾・ガスキャニスターの火花・破片が均一に見えない工夫として直接転用可能
- 既存AOEテレグラフ（着弾前予告）とは別レイヤー（着弾後の炎自体）なので、混同せず組み合わせる設計が妥当

## 確信度が低い抽出

1. [06:45] Voronoi power具体値「8」（1でも良いとの発言もあり）
2. [07:01]-[07:14] Erosionカーブのvalue「7」「0.1」対応関係
3. Smoke Shape Radius「5」の解釈
