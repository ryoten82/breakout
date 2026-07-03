# 学習ノート — How to Create Realistic Fog & Mist in Unreal Engine

- 動画: https://www.youtube.com/watch?v=jlTO4FYDgpQ （7:31）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/jlTO4FYDgpQ.txt](../transcripts/jlTO4FYDgpQ.txt)（`[MM:SS]` で原文照合可能）
- 前提: 講師本人が「この技法は Mr 3D Dev から学んだ」と明言 [00:08–00:15]。ee-IOlWUZTo ノートの E1/E2（自作フォグ平面）とほぼ同一技法を、単体チュートリアルとしてゼロから解説している回。

## 全体ワークフロー（工程順）

1. **マテリアル準備** [00:23–01:04] — Content Browser にフォルダ作成 → 新規 Material を作成（名前: `M_fog` ※字幕は "mcore fog" と誤認識、命名規則から `M_fog` と復元）→ Material Editor でルートノードの **Blend Mode を Opaque → Translucent** に変更
2. **ベースのフォグシート構築** [01:04–02:34]
   - **Radial Gradient Exponential** ノードを追加
   - **Multiply** ノードを追加し、Radial Gradient Exponential を Base Color に接続、かつ Multiply の A 入力にも接続
   - **Depth Fade** ノードを追加し、Multiply の B 入力に接続
   - Multiply の出力を **Opacity** に接続
   - Depth Fade を制御するため **Scalar Parameter** を 2 つ追加: `Opacity`、`Fade Distance`（デフォルト値は両方 1）→ それぞれ Depth Fade のピンに接続
3. **平面への適用** [02:34–04:08]
   - Shapes から Plane を追加、スケール調整（目安 300※推定）、平面になるよう回転
   - マテリアルを直接使わず、**先に Material Instance を作成**してから Plane に適用（理由: instance 化すると Material Editor を開かずに Opacity / Fade Distance を調整できるため [03:03–03:14]）
   - Material Instance 側で Fade Distance を上げるとメッシュ交差部の**ハードエッジが消える** [03:35–03:52]、Opacity も同様に調整可能
4. **ノイズ入りバリエーション作成** [04:06–06:20]
   - 元の Fog マテリアルを複製（新しい名前を付ける）
   - Engine Content を表示（Settings → Show Engine Content を有効化）してエンジン内蔵の Noise テクスチャを検索
   - `T_Tiling_Noise_05` を使用（他候補として `T_Tiling_Noise_01` 等も提示、バリエーション用に複数使い分け可 [05:06–05:10]）
   - Noise テクスチャと既存の Multiply 出力をさらに **Multiply** で掛け合わせ、その出力を Opacity に接続
   - 同様に Material Instance を作って適用 → Fade Distance / Opacity を調整してエッジを馴染ませる
5. **アニメーション（UV パンニング）** [06:21–07:19]
   - Material Editor に戻り、Noise テクスチャサンプルの UV に **Panner** ノードを接続
   - Panner の Speed を制御するため Scalar Parameter `Speed` を追加してデフォルト値 1 を設定 → 適用すると流れが速すぎる
   - Material Instance 側で Speed を下げる（字幕上は "1" 台の小さい値 ※推定、具体的な最終値は音声からは不明瞭で復元不能）→ 自然な漂うフォグの動きになる

## クオリティを上げる教訓（講師が語った理由・判断基準）

### 1. Material Instance を経由する理由は「編集動線」[03:03–03:14]
講師は「Material Instance を作る理由は、Material Editor に入らずに Opacity と Fade Distance を制御できるから」と明言。見た目の理由ではなく**反復調整のワークフロー効率**が動機。ee-IOlWUZTo ノートの「MI 化して個体ごとに調整」の教訓と完全に一致する運用。

### 2. Depth Fade はハードエッジ対策の本丸 [03:35–03:52], [06:00–06:10]
両方のバリエーション（無地版・ノイズ版）で共通して、メッシュとの交差部に出る**硬い縁を Fade Distance の増加で解消**する手順を踏んでいる。「これらのハードエッジに気づくかもしれないが、簡単に直せる」という語り口から、**Depth Fade の値を詰めることが仕上げの必須工程**として扱われている。

### 3. ノイズテクスチャで単調さを崩す [04:59–05:12]
無地の Radial Gradient だけだと「シンプルな fog」で終わるが、Tiling Noise を Multiply で重ねることで模様に変化が出る。講師は複数のノイズ候補（05 / 01 等）を挙げ「バリエーションを作りたいなら他のも使える」と明言 — **1 パターンに固定せず複数のフォグマテリアルを使い分ける前提**の設計。

### 4. アニメーションは「まず極端な値を見てから合わせ込む」[07:00–07:12]
Speed パラメータのデフォルトを 1 にしていったん適用 → 「速すぎる」と確認 → 値を下げる、という順序を踏んでいる。**パラメータの妥当値は一発で決め打ちせず、実機（レベル上）で見てから戻す**という検証姿勢が繰り返し強調されている（Opacity/Fade Distance でも同じ「まず適用して見る→戻す」の反復）。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Material Root | Blend Mode | Opaque → Translucent | [00:58–01:04] |
| Depth Fade 制御用 Scalar Parameter | Opacity / Fade Distance（デフォルト値） | 1 / 1 | [01:56–02:23] |
| Plane | スケール | 300※推定 | [02:47–02:55] |
| ノイズテクスチャ | 使用アセット | `T_Tiling_Noise_05`（Engine Content） | [05:01–05:12] |
| UV アニメーション | Panner Speed（デフォルト） | 1 | [06:57–07:04] |
| UV アニメーション | Panner Speed（調整後） | 1 未満の小さい値※推定（字幕 "like1" で具体値不明瞭） | [07:12–07:18] |

※ = 字幕崩れ・音声不明瞭のため推定または未確定。

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [02:47–02:55] Plane のスケール具体値（字幕 "something 300" で切れており正確な数値・XYZ 個別スケールかは不明）
- [07:12–07:18] Panner Speed の最終調整値（字幕 "something like1" が数値として復元できず、実際に触ってみないと確定しない）
- マテリアルの正式名称（字幕 "mcore fog" は明らかな誤認識。`M_fog` 等の命名を推定復元しているが、画面のフォルダ表示を直接見ていないため確証なし）
- ノード同士の正確なピン接続順序（Multiply の A/B どちらに何が入るかは文脈から復元しているが、グラフのスクリーンショット未確認のため配線の左右関係までは保証できない）

---

**サマリ**: この動画は ee-IOlWUZTo で使われていた「自作フォグ平面マテリアル」技法そのものを、Radial Gradient Exponential + Depth Fade + Multiply という最小構成でゼロから解説する 7 分半のミニチュートリアル。Height Fog（遠景の大気）とは独立した、近〜中景用の半透明平面フォグの作り方に特化しており、Material Instance 経由での調整動線、Depth Fade によるハードエッジ解消、Tiling Noise によるバリエーション、Panner による UV アニメーションの 4 点が核。ee-IOlWUZTo ノートの該当箇所とほぼ完全に整合し、新規性は薄いが「なぜ Material Instance か」「なぜ Depth Fade を必ず調整するか」という判断基準がより明示的に語られている点で補強材料になる。

**監査用: 確信度が低い順 3 件**
1. [07:12–07:18] Panner Speed の調整後の具体値（字幕 "something like1" が数値として全く復元できていない）
2. [02:47–02:55] Plane のスケール値 300（字幕が "something / 300" と分断されており、単位・軸別スケールの前提が不明）
3. マテリアル名 `M_fog`（[00:43–00:47] 字幕 "mcore fog" からの命名規則ベースの推測。実際のアセット名は画面を見ないと確定できない）
