# 学習ノート — UE5 Niagara Shockwave & Crack VFX

- ソース: https://www.youtube.com/watch?v=iHEwyd2vwn8 （6:23）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\iHEwyd2vwn8.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [4QF8sHC6HWo_lightning-crack-vfx.md](4QF8sHC6HWo_lightning-crack-vfx.md)（同じ「Vector to Radial Value」を軸にしたクラック系エフェクト。あちらは Vector to Radial Value と Vector to Angle の2系統を Blend Overlay して渦+放射ハイブリッド形状を作る手法が主題。本ノートは形状生成でなく**サーフェス上に広がるショックウェーブ・リング**が主題で、テクスチャ2枚（水面反射テクスチャ + ノイズ）と Sphere Mask の組み合わせによる、より簡素な構成）

## 概要

レベル上を外側へ広がっていくショックウェーブ／ひび割れ表現をマテリアルのみで作る短編（6分強）。使用テクスチャは水の反射（caustics）テクスチャとノイズテクスチャの2枚のみで、既存の Vector To Radial Value マテリアル関数を軸に、Sphere Mask・Shape・Animation の3系統をレイヤーとして合成する構成。Niagara 側は Sprite 1枚のバースト+ Dynamic Material Parameter によるカーブ駆動というシンプルな器。

## 技術詳細

### マテリアル構成（3系統のレイヤー）

1. **Sphere Mask 系統**: 標準の Sphere Mask に、水面反射テクスチャ（同チャンネルの別動画で使用済みのテクスチャを流用、と言及）を使った歪み(distort)を加える。歪みは「Vector To Radial Value の出力に UV タイリング用の 2D ベクトルを乗算」という既出手法で作り、その結果を RG チャンネルのマスクとして取り出し ×0.1 で歪み強度を弱める。これで「不規則な（isotropicでない）Sphere Mask」を作る。このマスクの半径は Dynamic Material Parameter に接続し、Niagara 側からリアルタイムで動かせるようにする（＝広がりアニメーションの駆動源）
2. **Shape 系統**: caustics テクスチャに Vector To Radial Value を適用するだけ（Sphere Mask 系統とはタイリング値を変えて差別化）
3. **Animation 系統**: ノイズテクスチャに Vector To Radial Value + Panner を適用して放射状アニメーションを作り、Sphere Mask（もしくは Radial Gradient。動画内で「値は同じ」と明言）を乗算

### Opacity 合成 — 2層ブレンドで「層状」表現

- 1層目: Animation 出力に Power（指数=2）をかけ、さらに ×7 して強度を上げる。これに Shape と Sphere Mask を乗算
- 2層目: 同じ Animation 出力に対し異なる係数（×2 して +0.9、Floor で整数化）で「より強い」別バージョンを作る
- 2層を Blend（合成）することで単一の Power カーブだけでは出ない**多層的な広がり感**を作る、という設計判断
- 最終的に 0〜1 に Clamp → Particle Color の Alpha チャンネルを乗算 → Depth Fade ノードに接続して Opacity 出力とする

### Emissive — Sine 周期違いの2トーン配色

- Sphere Mask を Lerp のアルファに使い、マスク値が 1 に近い領域と 0 に近い領域で異なる色（A/B）を出力する2トーン構成
- 片方（下側/Bの側）は Sine の Period を 5、もう片方は Period を 3 に設定して**周期をずらすことで色の変化タイミングを意図的にずらす**（同期させないことで単調な明滅を避ける狙いと推測）
- 出力を 0〜1 Clamp して LDR 入力、さらに ×5 した値を HDR Tint として使う2段構成（LDR/HDR 分離）

### Niagara 側のセットアップ

- Sprite Renderer（Mesh Renderer でも可、と言及）。地面に張り付くエフェクトのため Sprite Facing を Z 軸上向きに設定
- Alignment/Facing Mode を Custom + Sprite Alignment に設定しないと、カメラを動かした時にパーティクルがカメラに追従して回転してしまう不具合が出る、という実演あり（地面固定エフェクトの定番の罠として明示的に言及）
- Spawn Burst、Life Cycle は検証中は Infinite（毎フレーム確認しやすいよう）、2秒おきに1回スポーンする設定で継続プレビュー
- **Dynamic Material Parameter に Curve from 0→1 を接続**し、Key 0.5 の時点で値 1 になるようカーブを組む → これがマテリアル側の Sphere Mask 半径を駆動し「外側へ広がる」アニメーションになる
- 色は Scale Color（Vector from Float and Curve）で駆動。色を ×5 して最後は 0.1 まで減衰。Alpha は同じカーブを流用、Scale Curve は 1 固定
- **Depth Fade を使っている関係で、床（メッシュ）に近い場所に置くと Opacity が減衰してしまう**ため、実際にレベルに置く際はエフェクトの位置を少し浮かせる必要がある、という実践的な注意点あり

### 応用示唆（動画内言及）

- caustics テクスチャの代わりにグリッド状のテクスチャに差し替えると、より規則的な「座標線」のような形状になり別の見た目になる、と簡単に言及（詳細な作例なし）

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` は Radial Gradient Exponential ベースの電撃/グロー定型を収録済みだが、本動画は以下の点で補完的:

- **Opacity を「同じ Animation 出力から異なる係数（Power×7 系統 / ×2+0.9 Floor 系統）で2枚作って Blend する」という多層化パターン**は、既存の「グロー勾配」節（1-xでなくDivideの小値、等）とは別軸の、**単一ソースからの2重派生ブレンドによる「層感」演出**として新規
- **Sine の Period を意図的にずらした2トーン Lerp 配色**（Period 5 / Period 3）は既存 doctrine 未収録。単色の明滅でなく2色が非同期で変化する視覚効果を、追加テクスチャなしで Sine ノードのパラメータ差だけで作る軽量パターン
- **Sprite Alignment（Custom + Fixed）を設定しないと地面固定エフェクトがカメラ追従回転してしまう罠**は実務上有用な具体的注意点として新規収録（既存ノートに同種の言及なし）
- [4QF8sHC6HWo_lightning-crack-vfx.md](4QF8sHC6HWo_lightning-crack-vfx.md) と同じ Vector To Radial Value を使うが、あちらは「2系統の Radial 変換を Blend Overlay して形状そのもの（渦+放射ハイブリッド）を生成する」のに対し、本動画は Vector To Radial Value を**単に歪みマスク・テクスチャタイリングの下ごしらえとして使い**、主眼はリング状に広がる Opacity/Emissive のレイヤー合成にある。同じ関数でも用途の重心が異なる点を区別して記録

## SCRAP BLITZ UEへの応用メモ

- **ボスの着地攻撃・叩きつけ系の地面ショックウェーブ演出に直結**する構成: Sprite 1枚+Dynamic Material Parameter のカーブ駆動という最小構成は、既存 doctrine の「1粒バースト+カーブ駆動の器」原則そのままで、着地の瞬間に Sphere Mask 半径をカーブで 0→1 に広げるだけで「衝撃波が地面を走る」表現が作れる
- **地面ひび割れ演出**（着地/着弾のクラック）は、[4QF8sHC6HWo](4QF8sHC6HWo_lightning-crack-vfx.md) のような形状生成型のクラックより本動画の手法の方が実装コストが低く、まず本動画の構成（Sphere Mask 歪み + caustics/ノイズ Shape）で試作し、視覚的に物足りなければ Blend Overlay 系のクラック生成に切り替える、という段階的な導入順序が妥当
- Depth Fade による「床に近いと Opacity 減衰」という罠は、SCRAP BLITZ UE の地面固定 AOE テレグラフ（SBMine 型）実装時にも同様に起こりうるため、既存の DrawDebugMesh fan/SolidBox 系テレグラフではなく本手法のマテリアルベース実装を将来検討する際は要注意点として引き継ぐ
- カメラ追従回転の罠（Sprite Alignment 未設定）は、地面固定演出全般（着地エフェクト、床ギミック演出）に共通する実装チェック項目として記録に値する

## ソースの限界

- 英語自動字幕のみで手動字幕なし。テクスチャ名（"water costics" と表記されているが文脈から caustics = 水面反射テクスチャの誤認識と判断）、係数の一部（Power指数=2、×7、×2+0.9 等）は音声認識のブレを含む可能性があり、実装時は UE 実機で再検証が必要
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。特に Sphere Mask 系統と Animation 系統が最終的にどのノードで正確に乗算・分岐しているかの配線順序は字幕の言葉だけでは完全には特定できていない箇所がある
- Niagara パーティクルの Lifetime 具体値・Dynamic Material Parameter のカーブの正確なキー配置など、一部の数値は字幕上で言い淀み/聞き取り不能な区間があり省略されている
