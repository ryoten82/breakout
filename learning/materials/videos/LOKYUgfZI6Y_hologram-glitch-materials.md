# 学習ノート — How To Create Hologram And Glitch Effects - Unreal Engine 5 Materials Tutorial（Pitchfork Academy）

- ソース: https://www.youtube.com/watch?v=LOKYUgfZI6Y （32:50、講師 velocity / Pitchfork Academy）
- 視聴日: 2026-07-08 / 字幕種別: **英語自動字幕のみ（手動字幕なし。`yt-dlp --list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\LOKYUgfZI6Y.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: 同チャンネル Pitchfork Academy の姉妹チュートリアル [oOwI0QCSqXw_post-process-toon-outlines.md](oOwI0QCSqXw_post-process-toon-outlines.md) / [iMJJYXHMw4o_toon-shading-ue58.md](iMJJYXHMw4o_toon-shading-ue58.md)。ただし本動画はポストプロセスではなく**通常のオブジェクトマテリアル**（Unlit + Translucent/Masked）で、上記2本とは適用対象が異なる

## 概要

「アイテム/キャラクターに貼るホログラム風マテリアル」を Unlit + Translucent（または Masked）で一から組む動画。大きく4パーツで構成される: ①中心/外周2色フレネルグラデーション（発光色） ②不透明度制御＋Dither Temporal AA によるノイズ/透け方 ③パンする走査線（大小2種） ④頂点法線を使ったワールド・ポジション・オフセット（WPO）ベースのグリッチ振動。最後にマテリアルインスタンス階層化・Overlay Material スロット適用・モーションブラー対策までデモしている。

## マテリアル作成の基本設定

- Material Domain: Surface（既定のまま）、**Blend Mode: Opaque → Translucent**、**Shading Model: Default Lit → Unlit**（ライティング・反射を一切受けず Emissive のみで発光させるため）

## 色グループ（Color）

- `ColorInner`（Vector Parameter、赤）／`ColorOuter`（Vector Parameter、黄橙）
- `ColorInnerIntensity`（Scalar、既定 1）／`ColorOuterIntensity`（Scalar、既定 100 — 外周を強く光らせるための倍率）。それぞれ Multiply で対応する色に掛ける
- Fresnel ノードを Lerp の Alpha に接続し、A=Inner側・B=Outer側をブレンド（Fresnel の値が低い＝中心寄りで A、明るい＝外周でB が出る、という基本挙動をまず素の Fresnel で確認してから精緻化）
- Fresnel の Exponent In を `ColorFresnelExponent`（Scalar、既定 1）でパラメータ化。さらに Fresnel 出力側に **Power ノード（既定指数 2、固定値）** を挟んでコントラストを鋭くする
- Power 出力 → Multiply（**この時点では未接続の空きソケット。後で走査線信号を合流させるプレースホルダ**）→ **Saturate**（0〜1にクランプし、グリッチっぽい異常値が出ないようにする定型処理）→ **Divide by EyeAdaptation ノード**（シーンの自動露出値で割る）。この最後の割り算は Lumen 環境で Emissive の強い光が周囲を過度に白飛びさせるのを緩和するための補正で、地面への映り込みは残しつつ誇張されないようにする狙い、と説明されている
- Comment ボックス「Color」でグラフ全体を、Parameter Group「Color」でパラメータ5個をそれぞれまとめる

## 不透明度グループ（Opacity）

- `OpacityInner`（Scalar、既定 0.5）／`OpacityOuter`（Scalar、既定 10）を、色グループと同様に別の Fresnel（専用 Exponent パラメータ `OpacityFresnelExponent` 既定 1）の Alpha で Lerp
- Lerp 出力に **Dither Temporal AA ノード**を Multiply。このノードの `Alpha Threshold` 入力を `DitherThreshold`（Scalar、既定 0.5）としてパラメータ化。Random 入力は未接続のまま（空でも動作する）
- 最終出力は **Opacity と Opacity Mask の両方**に接続。理由は、後で Blend Mode を Translucent→Masked に切り替える運用に備えるため（Masked では Opacity Mask 側が効く）
- Comment「Opacity」、Parameter Group「Opacity」

## 走査線（Scan Line）— マクロ/ミクロ2系統

マクロ側:
1. **Screen Aligned UVs** ノードをテクスチャ座標として使用。これによりカメラからの距離に関わらず走査線の太さ・向きが画面基準で一定になる（SF調の見た目を狙った意図的選択、と明言）
2. Panner の Speed 入力はベクトルを要求するため、Append Vector で X=定数0（左右には動かさない）・Y=`MacroScanLineSpeed`（Scalar、既定 -0.1、下方向）を合成して接続
3. Panner 出力 → **Linear Gradient（Vertical/V 側）** → `MacroScanLineAmount`（Scalar、既定 2＝ラインの本数）を Multiply
4. → **Frac ノード**（入力の小数点以下だけを取り出すことで繰り返しグラデーションを作る）
5. → 自分自身との Multiply（自乗して縁をソフトにする）
6. → **Clamp（0.5〜1）**で値域を絞る

ミクロ側は同じ構造を複製しつつ2点変更:
- **Frac の代わりに Sine ノード**を使用（両端に鋭いエッジが出ず、両側が滑らかなグラデーションになる）
- `MicroScanLineSpeed`（既定 -0.05※推定、下方向）／`MicroScanLineAmount`（既定 70＝マクロよりずっと多い本数）

マクロ・ミクロを Multiply で掛け合わせたうえで、さらに両者の **Dot Product**（内積）を取る一手間を加えることで、単純な乗算より少し複雑な合成結果を得ている（「なぜ内積か」は動画内で厳密な理屈の説明はなく、著者の経験則的な仕上げ処理という位置づけ）。この最終結果を、Color グループで空けておいた Multiply プレースホルダに接続する。Comment「Scan Lines」、Parameter Group「Scan Line」に `MacroScanLineAmount`/`Speed`/`MicroScanLineAmount`/`Speed` をまとめる。

## グリッチ（Glitch）— 頂点オフセット

### 方向選択ロジック
- **Vertex Normal (World Space)** を Component Mask で R/G/B（前後・左右・上下に相当する3方向）に分解
- Lerp①: A=R、B=G、Alpha=Frac(Time × `DirectionTimingA`（Scalar、既定 0.3）)
- Lerp②: A=Lerp①の出力、B=B チャンネル、Alpha=Frac(Time × `DirectionTimingB`（Scalar、既定 0.5）)
- 2段階の Lerp で「時間経過に応じて前後/左右/上下のどの方向にグリッチが起きるかがランダムに切り替わる」信号を作る、という設計（速度が異なる2つの Frac(Time) を使うことで周期がズレて揃わないようにしている）。Comment「Direction」、Parameter Group「Glitch」に `DirectionTimingA/B` を格納

### 発生タイミング・強度ロジック
- Time × `GlitchTimingA`（Scalar、既定 1）→ Frac（1秒ごとにリセットするループ信号）→ **If ノード**で「Frac結果 ≤ 0.1（定数）」を判定し、真の時だけ `GlitchIntensity`（Scalar、既定 25）を出力、それ以外は 0（＝グリッチが一瞬だけパルス状に発生する仕組み）
- 同じ構造を複製し `GlitchTimingB`（既定 0.45。0.5 にすると A と周期が一致してしまうため意図的にズラした値、と説明あり）で2本目のパルス列を作成。`GlitchIntensity` は共通
- Time × `GlitchTimeSwitch`（Scalar、既定 5.25。速すぎず遅すぎない適当な値でよいとされる）→ Frac を Alpha として、パルス列A/Bを Lerp。これにより「今どちらのタイミングが有効か」自体もランダムに切り替わり、強度 0〜25 の間で予測しづらい揺れを作る
- Comment「Glitch Timing」、Parameter Group「Glitch」に `GlitchTimingA/B`・`GlitchIntensity`・`GlitchTimeSwitch` を格納

### 最終合成 → World Position Offset
- Direction 信号（Lerp②出力）× ミクロ走査線の Clamp 出力 × Glitch Timing の Lerp 出力、を2段の Multiply で掛け合わせ、**World Position Offset に直結**。これがメッシュ頂点をランダムな方向・タイミング・強度でカクカク動かす「グリッチ」の正体

## マテリアルインスタンス運用

- 完成マテリアルを Material Instance 化（`MI_Hologram_Orange` 相当）してキャラクターメッシュに適用し確認
- パラメータ調整の実演: `GlitchIntensity=0` で振動オフ、値を上げるほど暴れる／`ColorFresnelExponent` を上げるとコントラストが締まる／`ColorOuterIntensity` を下げると外周の眩しさが落ち着く／`DitherThreshold=0` でノイジーな見た目、`=1` でディザなしのシャープな不透明度境界になる、等
- **MI の親子連鎖パターン**: 色違いバリエーションを作る際、複製ではなく「良い設定ができた MI（Orange）を親に指定した新規 MI（Blue）」を作る手法を推奨。子側は Color グループだけチェックを入れてオーバーライドし、他パラメータは親から継承する運用（Green はさらにこの Blue を複製して作成、という組み合わせも実演）
- **Shader Complexity ビューモードでのコスト比較**: Translucent のままだと赤〜ピンクで表示され、複数のホログラムが重なるとさらに悪化。Blend Mode を **Masked** に切り替えると緑（軽量）に戻る。Masked でも Opacity Mask 側に Dither Temporal AA の出力が入っているため、見た目は多少ドット状（ディザパターン）になるが半透明風の見え方は概ね維持される。モバイル/Switch 等の低スペック向けには Masked を推奨、PC/ハイエンドコンソールなら Translucent のままで問題ない、という判断基準が語られている
- **Overlay Material スロットでの適用**: キャラクターの通常マテリアルはそのままに、メッシュ詳細パネルの Overlay Material にホログラムマテリアルを差すことで、元の見た目を保ちながら WPO のグリッチが周期的に「浮き出る／めり込む」ような重ね掛け効果になる。`GlitchIntensity` を下げるとより穏やかな常時発光オーバーレイとして使える
- **モーションブラー起因のゴースト対策**: Translucent 材をキャラに適用してプレイ中に左右移動すると強いゴースト（残像）が出る問題があり、Post Process Volume（Infinite Extent Unbound）の **Motion Blur Amount をデフォルト 0.5 → 0.1 に下げる**ことで軽減できる、と紹介

## 新規性のある技術情報（既存ドクトリンとの比較）

`materials/materials_technique_doctrine.md` にはホログラム/グリッチ表現に関する記述は**doctrine未収録**。以下は新規性が高いと判断できる要素:

1. **EyeAdaptation ノードでの除算による Emissive 露出補正**という具体的パターン（Lumen 環境で強い発光値のマテリアルを使う際の白飛び対策）。doctrine の Substrate/メモリ予算節にも記載がない別系統の知見
2. **Frac(Time × 速度) を使った周期パルス生成 + If ノードによる閾値判定**という、時間ベースでランダムっぽい間欠発生を作る定型パターン（2本の異なる周期を Lerp で混ぜて予測しづらくする手法込み）。fx ドメインの Niagara ベースの間欠発生パターン（`Danger Zone VFX` 等の Spring Force 拘束）とは実装層が異なる（マテリアルグラフ内で完結、Niagara 不要）
3. **Vertex Normal (World Space) の R/G/B チャンネルを個別方向のグリッチ源として使い、時間差 Lerp で切り替える WPO グリッチ手法**。既存の fx ドクトリンにあるパーティクルベースの演出とは別に、「マテリアルだけでメッシュを振動させる」軽量な代替手段
4. **Screen Aligned UVs による距離非依存の走査線**。bg/fx ドクトリンの「TexCoord→Multiply→Scalar tiling」節（広域面限定の定型パターン）とは別カテゴリで、カメラ距離が変わっても模様のスケール・向きを一定に保つ用途に特化
5. **Translucent ⇄ Masked の切り替えを Opacity Mask に Dither Temporal AA の出力を常時流しておくことで両対応にする**設計（Blend Mode を変えるだけでコスト/見た目のトレードオフを切り替えられる）は doctrine の Blend Mode 節を補完する実践知

doctrine本体への追記可否は判断待ち（本ノートは差分抽出のみ）。

## SCRAP BLITZ UEへの応用メモ

アイテムのホログラム表現差し替えを想定した場合の転用ポイント:

- **MI 親子連鎖パターンはそのまま流用しやすい**。SCRAP BLITZ UE 側で既に採用しているOCジェムの Fresnel シェル実装（親MI+色違い子MIの構成）と同様に、まずベースとなる `MI_Hologram_Base` を作り込み、アイテム種別ごとに色パラメータだけ差し替えた子 MI を量産する運用が合う。露出すべきパラメータは最低限 `ColorInner/Outer`・`GlitchIntensity`・`DitherThreshold` の4つに絞れば、演出調整の見通しが良い
- **パフォーマンス懸念**: Shader Complexity で Translucent が赤〜ピンクだったという実測は要注意。アイテムピックアップは画面内に複数同時表示されうる（Crate/GasCanister のドロップテーブル等）ため、重なった場合のオーバードローコストが無視できない可能性がある。まずは Masked + Dither での実装を基本線にし、Translucent は「単体で目立たせたい特別演出」限定にするのが安全
- **WPO グリッチの効きはメッシュの頂点密度に依存**する（動画では Quinn マネキンの高頂点密度メッシュで実演）。既存のピックアップ用ローポリメッシュだとグリッチが目立たない可能性があり、適用前に対象メッシュの頂点数を確認する必要がある
- **EyeAdaptation 除算のトリック**は本プロジェクトの露出設定（Lumen 有無・Auto Exposure の設定）に依存するため、そのまま移植可能かは要現況確認。過度に発光の強いアイテム（`ColorOuterIntensity` を高めに使う場合）で周囲が白飛びするようなら候補になる
- **Unlit + Emissive** という設計自体は、シーンのライティング状態に関わらずアイテムの視認性を一定に保ちたいという用途（Pickup マグネット系の常時視認要件）と相性が良い
- **Overlay Material スロット**の使い方は、通常表示を保ったまま一時的な状態（バフ/デバフ、無敵時間、警告表示等）を上乗せする表現に転用できる可能性があり、アイテム表示以外の応用先としても記録しておく価値がある

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名・パラメータの厳密な既定値・If ノードの A/B ピン割り当てなど、音声認識の崩れにより文脈から復元した箇所がある。特に「マクロ/ミクロ走査線の Speed 既定値」「Dot Product を挟む理由」「If ノードの正確な配線」は動画内の説明自体も口頭で駆け足になっており、本ノートの記述は文脈からの解釈を含む（**上記該当箇所は本文中に「※推定」と明記**）
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のため接続順序・ピン名の視覚的な確認はできていない。実装時は動画本編でのノード配線を直接確認することを推奨
- チャプター区切り情報が取得できなかったため、節区切りはタイムスタンプと内容から本ノート側で独自に構成した

## 確信度が低い抽出（自己申告・3件）

1. **MicroScanLineSpeed の既定値**: transcript 上「マイクロ走査線の既定値は .05」という発言と「70に設定」という発言の順序がやや曖昧で、Speed=-0.05・Amount=70 という対応関係は文脈からの復元（※推定）
2. **Dot Product を挟む工程の意図**: 「マクロとミクロの内積を取ると少し面白い効果になる」という発言のみで、数式的な根拠の説明はない。ノードの並び自体は明確だが「なぜ効果的か」は著者の感覚的コメントにとどまる
3. **If ノードのピン配線詳細**: グリッチタイミングの If ノード（A/B/A=B/A<B の4出力のうちどれをどう使っているか）は音声だけでは配線の一部が判別しづらく、「Frac結果が閾値以下ならIntensityを出力、それ以外は0」という機能的な要約にとどめた。正確なピン単位の配線は動画の画面確認が必要
