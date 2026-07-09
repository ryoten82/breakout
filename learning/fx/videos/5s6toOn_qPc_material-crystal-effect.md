# 学習ノート — UE5 Material Crystal Effect

- ソース: https://www.youtube.com/watch?v=5s6toOn_qPc （8:30）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\5s6toOn_qPc.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [AMMBcdjUoc8_niagara-crystal-attack-effect.md](AMMBcdjUoc8_niagara-crystal-attack-effect.md)（Crystal Attack Effect・Niagara側の spline 追従パーティクル配置編）。あちらのノートには「クリスタルマテリアル本体は前回動画からの流用で本編未収録」と明記されており、本ノートがそのマテリアル本体（本編）に相当する可能性が高い。ただし収録内容はスフィアメッシュへの適用で、AMMBcdjUoc8 側のメッシュパーティクル用マテリアルと完全同一かは確認できていない
- **注意**: 同名タイトル「UE5 Material Crystal Effect」の別動画（`7s30TJfvE8M`）が同一プレイリスト内に別途存在する。本ノートは `5s6toOn_qPc` のみを対象とする

## 概要

Translucent + Surface Translucency Volume 設定のマテリアル1枚で完結する結晶（クリスタル）マテリアルの構築手順。テクスチャ3枚（base color 相当・Patreon配布）を素材に、内部からの疑似屈折（bump/refraction 風の表現）・脈動する発光・半透明の不透明度・反射の4要素を Fresnel ノード中心に組み上げる。最終的に Material Instance で紫色に着色し、Fresnel の Exponent を負値にすることで「内側から光る」表現を作るのが山場。

## 技術詳細

### 1. ベース設定

- Blend Mode = Translucent、Shading Model・Two Sided はデフォルトのまま変更不要
- **Translucency Lighting Mode を Surface Translucency Volume に変更**（デフォルトの Volumetric Non-Directional 等から切替。半透明オブジェクトの陰影表現向けの設定）
- Base Color テクスチャ等 3 枚を接続

### 2. 動的な発光色（Fresnel + Time 駆動の脈動）

- Fresnel ノードで Emissive Color を「ダイナミックに」変化させる土台を作る（字幕上は「dynamic emissive color」の音声崩れ）
- Fresnel の Exponent を Time 駆動で 0〜1 の間で周期変化させる。**Sine ノード + 定数（Period/Scale 相当、字幕上は "A=2, B=3"）で作った波形を Time に乗せている**らしいが、正確なノード名・接続順は音声認識のブレが大きく再構成しきれていない（※推定）
- プレビューで確認しながら進める、という手順の実況が中心で、数値の意味付けそのものの説明は薄い

### 3. 疑似屈折（bump/refraction）— 本動画の核心技術

- Camera Vector を World Space から別の空間（Tangent 空間、と推測されるが字幕からは断定不可 ※推定）へ Transform
- Material Function（カスタムの Reflection Vector 系関数）に Camera Vector と Normal を接続
- 出力から **R・G チャンネルのみを Mask で取り出し、それを B チャンネルの絶対値で乗算**する。さらに **その絶対値を定数で除算**（この定数が「屈折の見かけの距離」を制御するパラメータになる）
- 得られた値に Bump 用テクスチャの Tiling を乗算し、Texture Coordinate に加算 → 最終的に Normal（または法線相当の入力、字幕上「wte」）に接続
- Distance 定数を 200→400→100 と変えるデモがあり、**値が大きいほど屈折/歪みの効いた距離が「遠く」に見え、小さいほど「近く」に見える**という関係が実演される
- **Plane メッシュでは Bump 効果が良く見えず、Sphere メッシュに変更**して初めて結晶らしい見た目になった、という重要な実装上の教訓あり（メッシュ形状依存の効果であることの明示）
- Distance の異なる2系統の Bump 効果（この手法をコピーしてもう1系統作り、値を変えて重ねる）を用意し、それぞれに Power（テクスチャを暗く寄せる）をかけた上で **Lerp で合成**。さらに Time 駆動で色を変化させる系統も追加し、Emissive Color 側に接続
- Bump 由来の色を Surface Color（Base Color 相当）に加算し、外部公開パラメータ（プロモートされた Scalar/Vector、デフォルト値設定あり）で強度を乗算してから最終的に Emissive Color へ接続

### 4. Opacity（不透明度）

- 別の Fresnel を用意し、Exponent を Opacity 制御に転用。パラメータ名は「CoreOpacity」相当にリネーム（字幕上「toore op」）、デフォルト値 0.04 前後（※推定、字幕"file 0 04"）
- Power の exponent = 0.5
- **Lerp（A=0.2, B=0.3）で Fresnel 出力を挟み込み、Opacity に接続**。これにより結晶の中心付近と縁付近で異なる不透明度になる

### 5. 反射（Reflection）

- Material 内で "Index of Reflection" 系のノード（詳細ノード名は字幕から特定不可）を検索して使用
- 反射専用の Fresnel を追加し、**Exponent = 1、Base Reflect Fraction = 0.1** に設定
- この Fresnel 出力も Lerp を通して Reflection 入力に接続

### 6. Material Instance でのバリエーション調整（山場）

- Material Instance を作成し、Base Color を紫系カラーに変更
- **反射用 Fresnel の Base Reflect Fraction = 0.01、Exponent を負値（最終的に -5 → 調整の過程で -1 も試している）に設定**することで「内側から光っているような（inside glow）」見た目を作る、と明言。**Fresnel Exponent の符号を反転させることで、通常は縁が強調される Fresnel の勾配を反転させ、中心が強く発光する分布に変える**という設計上の工夫がこの動画の核心的な着色判断
- 途中、発光が強すぎて調整が迷走する場面があり、原因は「Lerp の速度（Lerp Alpha 側の値、字幕上『L speed』）が 0.1 であるべきところが違っていた」ことだったと判明・修正（※推定、具体的にどのパラメータかは字幕から完全特定不可）
- 最終的に Exponent = -1 で、**「中心部分は黒に近く（＝半透明・透過）、Emissive の発光が強くなりすぎない」バランスに調整**、として作業を締めている

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` v2.4 の「マテリアル定型」節には Fresnel の一般的な使い分け（BlendMode 別 Tips、グロー勾配での基本形）はあるが、以下は未収録の新規パターン:

- **Fresnel Exponent を負値にして発光分布を反転させ「内側から光る」表現を作る**手法。既存ドクトリンの Fresnel 系記述は「エッジを立たせる」用途が前提で、**符号反転による中心発光**というパターンは記録なし。半透明オブジェクトの「内部が発光している」演出全般（結晶・魔法球・エネルギーコア等）に汎用転用できる可能性がある
- **Camera Vector（Transform 後）+ カスタム Reflection Vector 関数を使い、R/G チャンネルを B チャンネル絶対値で加工して法線/UV オフセットに変換する疑似屈折**は、既存ドクトリンの「Erosion 定型」「グロー勾配」いずれとも異なる、パン・タイリングに依らない静的な「内部に厚みがあるように見せる」歪み技法。メッシュ形状依存（Plane では効果が出ずSphereで機能）という実装上の制約が明示された点も新規情報
- **同一 Bump 効果を距離違いで2系統重ねる**という多層合成の考え方は、既存ドクトリンの「Additive2系統並列（Offset違いのUV制御関数をMultiply合成）」パターンと構造的に似ているが、対象がパン・タイリングではなく「屈折の見かけの距離」という点で別軸

## SCRAP BLITZ UEへの応用メモ

- **OC ジェムの見た目改善への直接的な転用可能性（最重要）**: memory `handoff_scrapblitz_2026-07-09_ocgem-vfx-billboard-bug-and-pacing-concern.md` にある通り、OC ジェムの絵作りは複数ラウンドの試行錯誤にもかかわらず収束していない。本動画の**「Fresnel Exponent 反転による内側発光」**は、これまでの OC ジェムの試行（Sparkle ビルボード・Fresnel シェル等、`setup_scrapblitz_ocgem_level_instance_overrides.md` 参照）とは異なる**マテリアルのみで完結する軽量な別アプローチ**であり、既存の Niagara/ビルボード主体の方向性が難航している状況を踏まえると、**技術選択そのものを変える候補**として検討価値がある。具体的には、OC ジェムの本体メッシュに直接この「Camera Vector 疑似屈折 + 内向き Fresnel 発光」マテリアルを適用し、周囲のパーティクル演出は最小限（既存の Aura/Sparkle は削るか簡略化）に留める設計が、往復コストを下げる可能性がある
- **メッシュ形状依存の注意点**: Plane では Bump 効果が出ず Sphere で機能したという実演は、OC ジェム（ダイヤモンド/球体系メッシュ）にとって好条件（既にラウンド開発で球体寄りのメッシュを使っている想定）。ただし OC ジェムがダイヤモンド型（多面体）の場合、Sphere ほど滑らかに効果が乗るかは未検証で、実機確認が必要
- **反射（Reflection）Fresnel の Base Reflect Fraction / Exponent パラメータ化**は、宝石・鉱石系アイテム全般（ドロップアイテムの結晶部分、ボスの結晶装甲パーツ等）に横展開しやすい汎用マテリアルパターンとして流用候補
- 導入前提として、本ノートの手順は音声認識の崩れ（ノード名多数）が大きいため、**実装時は UE エディタでノードを実際に組みながら検証する前提**（transcript の字面をそのまま信用しない）で進めるべき

## ソースの限界

- 英語自動字幕のみで手動字幕なし。誤認識が非常に多い動画で（例: "in anal engine" = "in Unreal Engine" の誤認識、"finel"/"finale" = "Fresnel"、"lurp" = "Lerp"、"damic" = "dynamic"、"im missive" = "emissive"）、**ノード名・接続順の細部は文脈からの再構成であり、動画実機を見ずに transcript のみから再現することは推奨しない**
- 特に「Camera Vector Transform 先の空間」「wte（法線入力先のノード名）」「Sine 波形生成の正確な構成（A=2, B=3 の意味）」「Lerp Speed 0.1 が具体的にどのパラメータを指すか」は※推定表記のまま未確定
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。数値パラメータ（Distance 200/400/100、Opacity Lerp 0.2/0.3、Exponent -5/-1 等）は字幕の音声認識結果をそのまま使っており、実装前に UE 実機で再検証が必要
- クリスタルマテリアルの「内部にひび割れが動くフリッカー」的な演出（AMMBcdjUoc8 側のノートで言及されていた「前回動画」の内容）は本動画には含まれておらず、本ノートの範囲外
