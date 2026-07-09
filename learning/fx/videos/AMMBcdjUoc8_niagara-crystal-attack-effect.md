# 学習ノート — UE5 Niagara Crystal Attack Effect

- ソース: https://www.youtube.com/watch?v=AMMBcdjUoc8 （14:27）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\AMMBcdjUoc8_transcript.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: なし（クリスタルマテリアル自体は「前回動画」由来と説明されており本動画未収録。本ノートは Niagara 側の spline 追従パーティクル配置のみを対象とする）

## 概要

前提として「クリスタルマテリアル」は別動画（未視聴・未収録）で作成済みのものを流用し、本動画はそのマテリアルを使った**メッシュパーティクルを spline に沿って配置し、Blueprint 側で spline の位置・向きを変えることで攻撃方向を制御できる Crystal Attack Effect** の Niagara 側構築が主題。マテリアルの詳細（Dynamic Parameter でひび割れのフリッカーを制御する仕組みそのもの）は「前回動画からの流用」としてほぼスキップされている。

## 技術詳細

### 1. Spline 追従パーティクル配置（本動画の核）

- Blueprint に Spline Component を追加し、その Blueprint 内に Niagara System を配置
- Niagara 側は Particle Update ステージにカスタムモジュールを作り、**Sample Spline Position by Unit Distance** ノードで spline 上の位置をサンプリング
  - Float U（0〜1）= spline 上の正規化距離（0=開始、1=終了）
  - この U に「正規化したパーティクル index」を渡すことで、パーティクルが spline 全体に均等分布する
- ハマった点（実装ミスの実況込み）: モジュール内で Namespace を Particles に変更しても、**Particle.Position への書き込みは自動では起きない**。Sample Spline Position の出力を明示的に `Particle.Position` に Set する配線を追加して初めて機能した（値の計算と実際の反映は別配線という、Niagara の一般的な「モジュール内 Map Set の出力は自動で標準パラメータに届かない」罠の一例）

### 2. ループ安全なインデックス設計（Loop Count × Spawn Count）

- Life Cycle を Self・Loop Behavior を Multiple に変更し、Loop Count と Loop Duration をそれぞれ Integer/Float の **User Parameter として公開**（Blueprint から動的に変更可能にする）
- 単純な「正規化した Spawn 時 index」だと、バーストがループするたびに index がリセットされてしまい spline 上の分布が壊れる。これを避けるため：
  - パーティクルの **Unique ID**（Particle.ID、整数）を使って非正規化 index を再構成
  - `Max Count = Loop Count × Spawn Count`（全ループ通算の総パーティクル数）を分母にして正規化 index を計算し直す
  - つまり「見た目上のバースト回数」と「spline 上の位置の一貫性」を両立させるために、ループ回数を織り込んだ index 正規化を行う、という設計

### 3. Remap Range によるサイズの位置依存グラデーション

- カスタムモジュール内で Remap Range を使い、Input Min/Max = 0〜(Max Count − 1)（＝上記の非正規化 index の範囲）、Output Min/Max = 公開した Mean Size / Max Size パラメータ
- 出力を Particles.Module 名前空間の Size パラメータとして持ち、Particle Update の Scale Mesh Size モジュール（Vector from Float で一様スケール化 → Multiply Float で係数を掛ける）に接続
- Mesh Scale Mode は Particle Spawn 側で Random Non-Uniform を選択し、初期スケールにも Mean/Max のランダム幅を持たせる（縦に伸ばすため XYZ 非対称値、例: Mean=(0.8,0.8,3) / Max=(1,1,3.5)）

### 4. Spline サンプル位置 + 速度駆動上昇の合成（Set ではなく Add）

- 上昇演出のため Particle Spawn に Add Velocity（Z 軸に大きな初速）+ Particle Update に Drag（減速）を追加
- ただし、上記のカスタムモジュールが**毎フレーム Particle.Position を spline サンプル値で上書き**していたため、Velocity による上昇が反映されない問題が発生
- 解決策: カスタムモジュール内で Particle.Position を「絶対値として Set」ではなく、**spline サンプル位置は X/Y 軸成分のみに使い、既存の Particle.Position（Velocity 積分で更新済みの Z 成分を含む）に Add する**形に変更。つまり「静的な軸（spline に沿う横方向）」と「動的な軸（速度で変化する高さ方向）」を Set と Add で使い分けて共存させる
- 副作用として地面から浮いて見えたため、別途 Position Offset パラメータの Z 軸を負値（-500）にして接地位置を調整

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` v2.4 には「キャラ付随」節で SkeletalMeshLocation を Spawn/Update で使い分けるパターンはあるが、**Spline Component をパーティクル配置の空間基準として使う手法（Sample Spline Position by Unit Distance + 正規化 index による分布）はドクトリン未収録**。攻撃方向を Blueprint 側の spline 変形だけで制御できる、という設計上の利点も新規性がある。

以下も既存ドクトリンの各原則（#3「値の設定と評価モジュールは分離」）を裏付ける具体例だが、パターンとして独立して記録する価値がある:

- **ループするバーストの index 破綻対策**（Loop Count × Spawn Count を分母にした非正規化 index の再構成）は、ドクトリンの「親子連鎖」「大量イベント FX」節とは別軸の、**単一エミッタ内でのループ安全性**に関する技術。ドクトリンに項目なし
- **Set と Add の使い分けによる「静的配置軸」と「動的物理軸」の共存**（spline 位置は Set、速度積分による軸は Add で温存）は、ドクトリンの「ストレッチ」「トレイル」節のような特定エフェクトの型ではなく、より汎用的な「モジュール間の役割分担パターン」。今後 spline 以外（例: Attractor Force、Curve 駆動の基準位置）と Velocity を併用する場面全般に転用できる可能性がある

## SCRAP BLITZ UE への応用メモ

- **METEO の技エフェクト**: 直線・曲線軌道の斬撃/衝撃波系 SP 技（例: ground-slash・vertical-beam 系）は現状 Ribbon やコーン/平面の重ね合わせで構成されているが、本動画の spline 追従パーティクル配置は「攻撃軌道そのものを spline で自由に曲げられる」利点があるため、**曲線軌道を伴う新規 SP 技**（薙ぎ払い・弧を描く斬撃等）の破片・結晶質パーティクル演出に転用しやすい。ただし UE 側は Blueprint Spline を攻撃 GA から動的生成する手間が発生するため、直線軌道が大半の既存技には過剰スペック
- **ボス攻撃（enem/boss 系）**: ボスの範囲攻撃で「地面から突き上がる結晶」「予測線に沿って隆起する障害物」のようなテレグラフ演出に応用しやすい。特に spline を攻撃の予告線（現状 SBMine 型の固定形状 AOE テレグラフ）に流用し、spline 形状自体を「攻撃範囲の可視化」として使う設計は、既存の赤枠/橙塗り AOE 文法とは異なる新しい選択肢になりうる（ただし本プロジェクトの演出ポリシー上、導入前に既存 AOE 文法との統一感を要検討）
- **ループ安全な index 設計**は、本プロジェクトで多段ヒット・連続バースト系の技（コンボ延長 VFX 等）を作る際、ループのたびに分布が乱れる不具合の一般的な回避策として直接使える知見

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名・パラメータ名の一部は音声認識の崩れから文脈で復元しており（例: 「naira」は Niagara の誤認識、「logs static mesh」は "Rock" 系スターターコンテンツメッシュの誤認識の可能性が高いが原語不明のため「logs」のまま※推定表記）、断定できない箇所は本文中で明示した
- クリスタルマテリアル本体（ひび割れフリッカーの Dynamic Parameter 制御を含む）は「前回動画」からの流用としてほぼ説明が省略されており、本ノートには含まれていない
- 実際のノードグラフ画面は視聴しておらず（transcript ベースの要約）、Remap Range・Scale Mesh Size 周辺の正確なノード名・接続順序は字幕の記述から再構成したものであり、細部の接続順は動画と完全一致しない可能性がある
