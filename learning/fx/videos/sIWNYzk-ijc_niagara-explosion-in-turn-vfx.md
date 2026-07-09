# 学習ノート — UE5 Niagara Explosion In Turn VFX

- ソース: https://www.youtube.com/watch?v=sIWNYzk-ijc （8:14）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\scratch_tmp\transcript_raw.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: 前作「burst effect（グレネード/爆竹風の一斉バースト）」動画（本チャンネルの前編、URL 未特定・本ノート内では前提として言及されるのみで詳細な作り方は含まれない）。パーティクル発生源としては Sprite Emitter に位置情報を供給する「Source Emitter」構成が前提になっている

## 概要

前作で作った「一斉に弾けるバースト（グレネード/爆竹風）」エフェクトを改造し、**パーティクルのインデックス番号を使って発生順序を制御し、下から上へ方向性を持って連鎖的に弾ける（in turn = 順番に）**エフェクトに変える動画。新規ノードを増やすというより、既存バーストの「位置」「寿命」「重力の効かせ方」の3箇所をパーティクルインデックス駆動に作り替える構成。

## 技術詳細

### 1. Source Emitter 方式の前提
- Niagara 側では Source Emitter 1つだけを直接編集する。他の実際に見えるパーティクル用エミッタは Source Emitter からパーティクル位置を受信（Receive）する構成になっており、Source Emitter 側の位置を書き換えるだけで全体の配置が連動する
- プレビューの見やすさのため、作業中は Velocity・Acceleration・Scale Mesh Size を一旦無効化しておく

### 2. Return Normalized Exec Index による整列配置（Initialize Particle）
- 核となるノードは **Return Normalized Exec Index**：そのエミッタからスポーンされた各パーティクルに、0〜1 に正規化されたインデックス値を割り当てる（例: 100 パーティクルなら 0, 0.01, 0.02 … 1）
- これを Make Vector で Z 軸に Multiply（Set Float to Negative 500 ※推定: `-500` の意）することで、パーティクルを Z 軸方向に合計 500 ユニットの幅で順番に整列配置する
- Update Mesh Orientation は一旦無効化して確認

### 3. Unique ID による X軸の左右振り分け（Initialize Particle）
- 同じ「インデックスで分岐」でも、こちらは **Return Normalized Exec Index ではなく Unique ID**（正規化されていない整数インデックス、0, 1, 2 … 99）を使う
- Unique ID を 2 で Mod（剰余）することで 0 か 1 が交互に出力される値を作り、Lerp の Alpha（Branch on Bool で比較）に接続してパーティクルを X 軸の正方向/負方向に交互に向かせる
  - Mod が 0 のとき出力 0.125、1 のとき出力 -0.125（※推定：字幕上は両方 "0.125" と聞こえるが文脈上symmetricに正負が入れ替わるはず）
- 同じ Lerp 構成を Y 軸にも複製し、オフセット値を X 軸より大きめ（10 と -10）に設定
- パーティクルサイズも不均一化（0.15 / 0.15 / 0.3）、Lifetime は 1 に設定、Shape Location は無効化 → ここまでで「順番に発生する」バースト自体は完成

### 4. 下から上へのタイミング制御（Lifetime 駆動）
- 「下から上に向かって連鎖的に弾ける」演出は、位置ではなく **Lifetime をインデックスに応じて可変にする**ことで実現している
- 再度 Return Normalized Exec Index を使い、`1 - normalized_index` を Multiply Float の入力 B に接続 → 下側（インデックスが小さい＝下に配置されたパーティクル）ほど Lifetime が短くなり先に弾け、上側ほど Lifetime が長く後から弾ける
- 初期状態では連鎖速度が速すぎるため、乗算するパラメータ値を大きくして間延びさせる調整を行う
- 副作用: Lifetime を伸ばすと、各 Emitter の Loop Duration（デフォルト 1 秒）を超えた分でパーティクルが再スポーンされなくなり、エフェクトが「消える」ように見える → Loop Duration を Lifetime に合わせて長め（動画内では 5）に、**全エミッタ個別に**修正する必要がある

### 5. 「弾ける瞬間だけ」重力を効かせる（Branch on Bool + Particle Lifetime）
- 単純に全パーティクルへ Gravity を有効化するのではなく、**「まさにこれから弾けようとしている（Lifetime 残り時間が短い）パーティクルにだけ」**重力と Point Force を適用する設計
- `Particle Lifetime - Particle Age`（残り寿命）を計算し、残り時間が 0.2 秒未満なら true を返す Branch on Bool を作る
- true の場合: Point Force を Random Value（500〜10,000）で有効化。false の場合は Force = 0
- Point Force の Position と Force Origin は両方とも**現在のパーティクル位置**に設定する必要がある（デフォルトのままだと Simulation の原点1点だけに力が働き、狙った演出にならないという注意）
- 力を受けた際の見た目向上のため、Update Mesh Orientation も同様の Branch on Bool（true なら orientation 更新、false なら無回転）で条件付き有効化する

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` には「1粒バースト+カーブ駆動の器」「親子連鎖（AttributeReader/Death Event）」の記載はあるが、**単一エミッタ内でパーティクルインデックスを使って発生順序そのものをずらす**パターンは未収録で新規:

- **Return Normalized Exec Index を Lifetime の乗数に使い、インデックスが小さいパーティクルほど先に寿命を迎えさせることで「発生順序の連鎖」を作る**手法。Death Event や親子エミッタを使わず、単一エミッタの Lifetime 分布だけで時間差連鎖を表現している点が、doctrine の親子連鎖パターン（27行目）とは異なる軽量な代替アプローチ
- **Unique ID を Mod 2 した結果を Lerp の Alpha にする「偶数/奇数で分岐」パターン**：パーティクルを2グループに交互振り分けする最小構成として汎用性がありそう
- **Branch on Bool（残り Lifetime < 閾値）で Force/Orientation 更新を条件分岐する「弾ける瞬間にだけ物理を効かせる」設計**：常時 Gravity を有効にするのではなく、パーティクルのライフサイクル終盤だけ選択的に物理演算をオンにする考え方。ドクトリンの「値の設定と評価モジュールは分離」原則（9行目）と親和性があるが、「Lifetime 残量をトリガー条件に使う」という具体パターンは未収録

## SCRAP BLITZ UEへの応用メモ

- **クレート連鎖破壊・コンボ演出への転用が本命**: 本動画の核心技術（Return Normalized Exec Index を使ったインデックス駆動の発生順序制御）は、複数オブジェクトが同時ではなく順番に破壊されるような演出（クレート連鎖破壊、コンボヒット時の複数エフェクト、STREAK 達成時の演出等）にそのまま応用できる。ただし本動画は**単一エミッタ内のパーティクル**が対象であり、SCRAP BLITZ UE の「複数の独立したクレートアクター」を連鎖させる用途にはそのままでは使えない点に注意（後述）
- 直接使えるのは「1つの爆発エフェクト自体を、下から上・あるいは任意の軸方向に連鎖的に弾けさせる」単一エフェクトの内部演出として。例えばボス撃破時の3フェーズ演出（freeze→explode→ring、CLAUDE.md 記載）の explode フェーズで、爆発の破片が一斉にではなく下から上へ順にバーストする、といった質感向上に使える
- **「発生順序をインデックスで、タイミングを Lifetime で」という設計思想自体は複数アクター連鎖にも転用可能**: 個々のクレートに「破壊順序インデックス」を持たせ、そのインデックスに比例した delay で破壊トリガーを遅延させれば、同じロジックを BP/C++ 側で再現できる（Niagara 内で完結する技術ではなく設計パターンとしての転用）
- Force/Orientation の条件付き有効化（Branch on Bool + 残り Lifetime 閾値）は、破片が「まさに弾ける瞬間だけ」ノックバック的な力を受ける演出に流用でき、既存の破片物理チューニング（`handoff_scrapblitz_2026-07-02...`）と組み合わせられる可能性がある

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ASR（自動音声認識）特有の誤認識が随所にあり、特に以下は「※推定」扱い：
  - "AIS" → "axis"、"lurp" → "lerp"、"ball"（Branch on Bool の意味で使われている箇所）→ "Branch on Bool" の誤変換とみられる
  - Lerp の出力値「0.125」が Mod=0 と Mod=1 の両方で同じ値として字幕化されている箇所は、正負が入れ替わっているはずだが字幕からは判別不能
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。ノードの正確な接続順序・パラメータ名の綴りは UE 実機での再現時に確認が必要
- 前作（一斉バースト版）の詳細な作り方自体は本ノートの対象外
