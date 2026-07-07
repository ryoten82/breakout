# 学習ノート — Unreal Engine 5.5 Motion Design Tutorial: Animators & Shockwave Effector

- 動画: https://www.youtube.com/watch?v=KdR1Fjsc8Bo （8分02秒、RedefineFX | Jesse Pitela）
- 視聴日: 2026-07-07 / 字幕種別: **英語自動字幕（ASR、手動字幕なし）**。原音声が英語のためASR＝音声認識のみで、翻訳字幕による二重劣化ではない
- チャプター: Intro(0-22s) / Taken from Unreal Motion(22-42s) / Enable Motion Design Mode(42-64s) / Cloner Settings(64-85s) / Create Linked Effector(85-125s) / Noise Field Effector(125-237s) / Animator(237-270s) / Operator Stack Animators Settings(270-351s) / Make it Loopable(351-482s)

## 🔴 重要な位置づけ（学習部屋 fx ドメインとして初めて扱う別システム）

本動画は **Niagara ではなく「Unreal Motion Design」**（UE5.5 で導入された、Cinema 4D の MoGraph 的ワークフローに相当するモーショングラフィックス専用ツールセット）についての動画である。

fx_technique_doctrine.md（v2.3時点）は Niagara / マテリアルグラフを中心に蓄積されたドクトリンであり、Motion Design はパーティクルシミュレーションではなく **メッシュ/オブジェクトの大量複製＋パラメトリックなモーション制御**という別の設計体系を持つ。そのため本ノートの内容は既存 doctrine への直接差分反映の対象ではなく、**新しい参照カテゴリ（Motion Design 系ノートの1本目）として記録する**位置づけとする。将来 Motion Design 関連動画が増えた場合の合流点として扱う。

## Cloner / Effector / Animator / Operator Stack 用語対応表（初出のため整理）

| 用語 | 役割 | Niagara の近い概念（あくまで機能イメージの対応・実装は別物） |
|---|---|---|
| **Cloner**（クローナー） | 選択したメッシュ（Cube等）を格子状・その他のレイアウトで大量複製するアクター | Emitter の Spawn（大量生成の起点という点で近いが、Clonerは静的メッシュの複製配置が主体） |
| **Effector**（エフェクター） | Cloner が複製した各インスタンスの位置・スケール・回転等に影響を与えるモディファイア。Linked Effector（形状ベース）・Noise Field Effector（ノイズベース）等の種類がある | Module（各パーティクルのプロパティを変化させる処理単位）に近い |
| **Animator**（アニメーター） | Effector 等のパラメータをキーフレームなしで時間経過に応じて変化させる機能。Time / Bounce / Curve / Oscillate 等のモードを持つ | Curve/Float モジュールの時間駆動パラメータ制御に近い |
| **Operator Stack** | Cloner/Effector に適用されたモディファイアやアニメーターを一覧・編集するパネル（Modifiers タブ / Animators タブ切替） | Niagara の Module Stack（Emitter内のモジュールリスト表示）に近い |

## Motion Design 制作手順（動画で実演されている範囲・工程順）

1. **[00:42]-[01:00] Motion Design モードの有効化**：空のシーン（ライトと床のみ）から Actors メニューで Cloner Actor を追加。位置・回転をリセットし高さを調整
2. **[01:00]-[01:22] Cloner の Layout 設定**：Count Z を 0 にして平面配置にし、Count X/Y をそれぞれ 50×50 に設定。複製元メッシュを Cube にし、スケールを 0.5（全軸）に縮小、Spacing を 53×53 まで詰めてグリッド間隔を狭くする
3. **[01:22]-[01:47] Linked Effector（1個目）の作成**：Cloner の Effector メニューから Create Linked Effector。形状を Torus（トーラス）に変更し、スケールを 0 にした上で Invert Type（反転）を有効化。この状態で Effector 自体をスケールさせると、リング状に広がる衝撃波（Shockwave）の見た目が得られる
4. **[01:47]-[02:00] Z軸の高さ調整**：Effector の Scale モードを Free（各軸個別スケール）にし、Z軸を 0.5〜1 程度に設定してキューブに高さを持たせる
5. **[02:00]-[02:24] Noise Field Effector（2個目）の作成**：再度 Create Linked Effector し、今回は形状を Unbound（無制限）、モードを Noise に設定。Cloner と両 Effector をまとめて床に沿う高さまで移動
6. **[02:24]-[02:47] Noise Effector のパラメータ**：Scale を Free にし、Scale Strength を Z軸方向に 3、Pan を 0.5、Frequency を 8 に設定。これによりキューブの高さがランダムかつ継続的に上下する動きになる
7. **[02:47]-[03:20] マテリアル設定**：あらかじめ用意した3種の青系マテリアル（明るい青／暗い青／ほぼ白）を Cube に順に割り当て、Ctrl+D で複製。Cloner の Rendering 設定内 Mesh Render Mode を Random にすることで、インスタンスごとにランダムなマテリアルが割り当てられる
8. **[03:20]-[03:39] Torus 形状の調整**：Torus Radius・Inner Radius・Outer Radius を調整し、Effector 境界での立ち上がりをよりシャープな遷移にする
9. **[03:39]-[04:22] Animator の追加（キーフレームなしのアニメ手法）**：1個目の Effector（Torus）を選択し、Scale プロパティを右クリックすると Bounce / Curve / Oscillate / Time 等のアニメーターモードが表示される。時間経過で0から拡大させたいだけなので **Time** モードの **Relative Scale (3D Vector)**（3軸まとめて制御するモード）を選択
10. **[04:22]-[05:34] Operator Stack の Animators タブで数値調整**：Effector を選択した状態で Operator Stack パネルを開き（デフォルトは Modifiers タブ）、Animators タブに切り替える。デフォルトでは Amplitude Min/Max が両方 0 のため何も起きない。**Amplitude Max を全軸 1** に設定すると拡大が始まる。拡大速度は **Cycle Duration** で制御（本編は最終的に1秒→試行錯誤の末3秒に調整）。デフォルトの **Additive** モード（元のスケール値に加算）ではなく **Absolute** モード（Amplitude 値そのものに置き換え）に変更することで、スケール0から明確に立ち上がる挙動にする。最終的に Amplitude Max を **4** まで引き上げ、Cycle Duration を **3秒**に設定
11. **[05:34]-[05:57] Cloner の複製数を増やす**：拡大範囲が広がると初期のグリッド範囲（50×50）ではキューブが足りなくなるため、Cloner の Count を全軸 **100** に増やす
12. **[05:54]-[06:15] ループ化**：Effector の Animator 設定で **Cycle Mode を Loop から Pingpong に変更**すると、拡大→収縮を往復するループアニメーションになる。F11キーでUI非表示にして最終見た目を確認
13. **[06:15]-[06:53] 仕上げ（イージング）**：Effector の Easing Mode（デフォルト Linear）を **In and Out Cubic** に変更し、キューブが出現・消失する際の緩急を滑らかにする

## 判断基準・コツ

- **Additive vs Absolute の切替が Animator 適用の核心**：デフォルトの Additive はベース値に加算するため「元の値＋変化量」になり、意図通りスケール0から始まらない。純粋に0→任意値へ遷移させたい場合は Absolute に切り替える必要がある、という実演上の学び
- **Torus 形状 + Invert Type + スケールアニメ**の組み合わせが「中心から外側へ広がるリング状の衝撃波」を作る核となる構造。Torus の内外径調整で境界のシャープさを追加制御できる
- **Cycle Mode = Pingpong** が最も手早いループ化手法（往復させるだけで継ぎ目のないループになる。逆再生用の別アセットや複雑な補間設計は不要）
- Cloner の複製数（Count）は Effector の作用範囲拡大に合わせて後から調整が必要になる（先に密度・間隔を決めてから、動きの規模に応じて数を増やす順序）

## 動画終盤（7:00以降）は宣伝パート — 実演されていない発展的機能

[07:00] 以降は作者が展開する有料コース（redefineeffects.com「Unreal Motion」コース）の紹介であり、**本動画内では実演されていない**。言及のみで、操作手順やパラメータの提示はない：

- コリジョン（Collision）反応
- 色の変化（color changing）
- 接触時に発光するエミッシブマテリアルへの切替
- 近接（proximity）ベースの力の発動
- 速度（speed）に応じた色付け、ライフタイム等の条件による制御
- マテリアルをメタルからウッドに変更する例
- オーディオリアクティブな Shockwave（本動画の衝撃波をベースに音声反応させた発展例、として言及のみ）
- ノイズキャンセリング的なエフェクト

これらは動画内の実演手順（上記1〜13）とは明確に区別し、**「言及のみで手順不明」の項目として扱う**。実装検証を行う場合はこれらの発展機能は別途情報源が必要。

## 確信度が低い抽出（自己申告）

1. [01:22] Torus 形状名は "Taurus" と字幕表記されている（"Torus" の自動字幕誤変換と判断し、本文では Torus として記載）
2. Cycle Duration の最終値について、[04:52]-[05:34] 付近で「1秒→5秒でスロー→5秒でスピードアップ→やっぱり1秒→最終的に3秒」と試行錯誤の発言が連続しており、字幕の音声認識だけでは各時点の意図（試しているのか確定しているのか）の境界がやや曖昧。本ノートは最終到達値（Amplitude Max=4, Cycle Duration=3秒）を確定値として記載したが、中間の試行錯誤の順序は簡略化している
3. Noise Field Effector の Pan 値「0.5」（[02:34]-[02:37]付近、字幕上は "a pan of 5" と表記）は小数点が字幕から欠落している可能性があり、0.5 と解釈したが確度は高くない

## SCRAP BLITZ UE への応用可能性（仮説段階）

- 本動画自体は Motion Design（Cinema 4D 的な複製オブジェクトのプロシージャルモーション）の入門であり、既存のプレイヤー/敵キャラクター VFX（Niagara + マテリアル中心）とは制作パイプラインが異なる。**即座に転用できる技術ではない**
- 概念としては、大量オブジェクトを一括生成し Effector で群制御する仕組みは、背景演出（工場の稼働物・大量パーツの群制御アニメーション等）やタイトル画面のロゴ/ロビー演出のような**非戦闘系のモーショングラフィックス的表現**に応用余地がある可能性がある程度に留め、断定はしない
- 「Cycle Mode = Pingpong によるループ設計」という考え方自体は Motion Design 固有の機能ではなく一般的なループ設計思想であり、Niagara 側の Curve/Time モジュールでの往復ループ設計時にも参考になる可能性がある

## doctrine との比較（新規性チェック）

fx_technique_doctrine.md v2.3 は Niagara System/Emitter/Module/マテリアルグラフを対象にしたドクトリンであり、Cloner/Effector/Animator/Operator Stack という Motion Design 固有の概念・UI は一切扱っていない。本ノートはこの意味で**新規カテゴリの初出**であり、既存 doctrine の項目への統合・差し替えは行わない。将来 Motion Design 系ノートが複数溜まった段階で、独立した Motion Design 用の参照カテゴリ（または doctrine）を新設するかどうかを判断する。
