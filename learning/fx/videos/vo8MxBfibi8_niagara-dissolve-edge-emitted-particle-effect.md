# 学習ノート — UE5 Niagara Dissolve Edge Emitted Particle Effect（7:01）

- ソース: https://www.youtube.com/watch?v=vo8MxBfibi8
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\yt2\UE5 Niagara Dissolve Edge Emitted Particle Effect - Tutorial [vo8MxBfibi8].en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [Z94oJR3LsB4_two-directions-dissolve-vfx.md](Z94oJR3LsB4_two-directions-dissolve-vfx.md)（マテリアルのみで完結する2方向ディゾルブ）、[plmSnwB2CbM_static-mesh-appear-disappear.md](plmSnwB2CbM_static-mesh-appear-disappear.md)（MPC vs Dynamic Material Parameter の制御スコープ）。本動画はこの2本と異なり、**ディゾルブの境界線からパーティクルを発生させる Niagara 側の実装**が主題

## 概要

キャラクターのディゾルブ（消滅）マテリアルは前提として既に存在する短いチュートリアルで、本編の主眼はそのディゾルブと**同じマスクロジックを Niagara 側に複製**し、溶けている境界（エッジ）だけからパーティクルを湧かせる手法にある。マテリアルとパーティクルシステムという別々のシステムが、同一のノイズテクスチャと同一の Material Parameter Collection（MPC）値を参照することで、見た目上ぴったり同期した「エッジから発光パーティクルが舞う」演出になる。

## 技術詳細

### 1. マテリアル側（前提）

- 既存のマテリアル関数（Mask 出力）をキャラクターマテリアルの Opacity Mask に接続
- マテリアル内に Scalar パラメータ `mask` を追加し、MPC の Collection Parameter ノード経由でマスク値を外部制御する構成（MPC 一括駆動という設計はドクトリン既知）
- ノイズテクスチャは Tiling Noise 系のテクスチャ（字幕上「tiling noise zero five」、具体的なアセット名は特定不可 ※推定）

### 2. Niagara System の基本設定

- Empty テンプレートから新規 System を作成
- Spawn Rate を高い値（最初 10,000 → 後半 100,000 に増量）に設定し、パーティクル密度を確保
- 実行方式を GPU 側に、Bounds を Fixed に設定（字幕「gpuc bounce mode to fixed」= GPU Bounds Mode を Fixed にした可能性 ※推定）
- Sprite Size を Uniform、初期値 1（後に 0.1 へ縮小調整）

### 3. スケルタルメッシュ表面へのパーティクル配置

- **Sample Skeletal Mesh** モジュールを追加し、対象メッシュにキャラクターの Skeletal Mesh を指定
- Sample Skeletal Mesh の Sample Position を Particle Position に接続 → 一度メッシュ全体にランダム配置される状態を確認
- サンプリングモードを **Surface Triangles** に変更し、頂点でなくメッシュ表面上に均一にパーティクルが乗るようにする

### 4. エッジ判定モジュール（本動画の核心）

マテリアル関数と**同じディゾルブ判定をモジュールとして Niagara 内に再構築**する:

1. Sample Skeletal Mesh の Sampled UV を使い、マテリアルと同じノイズテクスチャをパーティクル側でもサンプリングする（Sample Texture ノード）
2. モジュールの入力パラメータはマテリアル関数と同じ「テクスチャ」と「マスク」の2つ、加えて **bias（バイアス）** でエッジの太さ（Width）を追加制御できるようにする
3. 判定ロジック: `テクスチャ値 >= mask` かつ `テクスチャ値 <= mask + Width` の論理積（AND）を取り、範囲内なら 1、範囲外なら 0 を出力する（If/Select ノードで True→1・False→0）
4. この 0/1 の結果を Float 型変数（namespace = Particles）として保持。字幕上は「Hill particles」だが文脈から **Kill Particles 用のフラグ**である可能性が高い（※推定：実際は既存の Particles.Scale 属性を一時的に流用してフラグを格納している）

### 5. Kill Particles によるフィルタリング

- Kill Particles モジュールを追加し、Group by を「fluid comparison」（比較演算）に設定
- 条件は「Particle.Scale が 0 に等しければ Kill」。前段でエッジ範囲外のパーティクルの Scale を 0 にしておくことで、**マスクとテクスチャがちょうど一致する狭い帯（境界）にいるパーティクルだけが生き残る**仕組み

### 6. レベルへの配置と MPC 同期

- Niagara System をキャラクターにアタッチ
- MPC 側の `mask` 値を Niagara System 内で使っている mask パラメータの値と一致させる（同じ MPC を両方が参照する構成にすれば、マテリアルのディゾルブ進行に合わせてパーティクル発生位置も自動的に追従する）

### 7. 見た目の仕上げ

- Sample Texture で得た RGBA を Particle Color にそのまま適用（テクスチャの発光色を使う）
- Sprite Size を 0.1 に縮小、Spawn Rate を 100,000 に増量して粒度を上げる
- **追加のエミッタ**（元のエミッタを複製）で「浮遊して飛んでいくパーティクル」を作成:
  - Curl Noise Force を追加（Strength=100、Frequency=25、フィールド重み=1 ※推定）で有機的な揺らぎを付与
  - パーティクルの寿命（Lifetime）を Random 1〜2 秒程度に短縮調整
  - Scale（Speed/Size）カーブを 0→1→0 のテンプレートで設定し、発生時に膨らんで消える動きを付与
  - 同じカーブを Scale RGB / Scale Alpha にも Set and Use で流用し、フェードアウトも同時に処理

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の Erosion 定型「ノイズ→Power→Opacity(Mask)。パーティクルαを閾値流用、Dynamic Parameterで外部化」は**マテリアル内で完結する**パターンだが、本動画は以下の点で一段先を行く:

- **同一のノイズテクスチャ判定ロジックを Niagara モジュール側にも複製し、マテリアルの Opacity Mask 境界と Niagara のパーティクル発生位置を空間的・時間的に一致させる**という「マテリアルと VFX の同期」技法。doctrine には該当項目がなく新規
- **range 判定（`mask <= texture <= mask+Width`）で「境界の薄い帯」だけを抽出**する発想。既存 Erosion 定型は単一の閾値比較（Power→Opacity Mask）だが、本動画は上下2つの閾値で挟むことで「エッジのみ」を切り出している
- **Sample Skeletal Mesh の Surface Triangles サンプリング + Sampled UV でテクスチャをパーティクル側から直接参照する**手法。doctrine の「キャラ付随」節（SkeletalMeshLocation を Spawn/Update で使い分け）には言及があるが、UV サンプリングでマテリアルと同じテクスチャをパーティクル側からも読む用途は未収録
- **MPC を「マテリアルと Niagara という異なるシステム間」の同期ハブとして使う**運用。[plmSnwB2CbM ノート](plmSnwB2CbM_static-mesh-appear-disappear.md)で得た「MPC=一括同期・DMP=個体別」という整理と符合するが、今回は「同一アクター内の複数システム間の値共有」という新しい適用範囲

## SCRAP BLITZ UEへの応用メモ

- **敵撃破ディゾルブ演出の強化**: [Z94oJR3LsB4 ノート](Z94oJR3LsB4_two-directions-dissolve-vfx.md)で検討した「頭/足2方向ディゾルブ」に本動画のエッジパーティクル技法を重ねれば、「溶ける境界そのものから発光粒子が舞い散る」演出になる。doctrine の Erosion 定型（マテリアル）+ 本技法（Niagara 側の境界抽出）は分業として自然に組み合わせられる
- **Spawn Rate 100,000 は明らかにチュートリアル用の過剰値**。実運用では敵の同時撃破数・画面内エフェクト数に応じて桁を落とす必要がある（doctrine「ボトルネックは大抵レンダリング側」の指摘とも整合。密度より Sprite Size とパーティクル寿命の調整で見た目を作るべき）
- **Stateless（Lightweight）優先原則との緊張関係**: 本技法は Sample Skeletal Mesh によるメッシュ表面サンプリングという処理を要し、doctrine の「Stateless エミッタが第一選択」の制約（ローカル空間限定・Component Renderer非対応）に抵触しないか実装時に要検証。Stateful 必須なら、常時多数出現する雑魚敵（enem01/enem02）ではなく boss01/midboss01 等の限定的な撃破演出に絞るのが妥当
- **MPC 同期の罠に注意**: [plmSnwB2CbM ノート](plmSnwB2CbM_static-mesh-appear-disappear.md)の教訓どおり、同一 MPC パラメータを複数の敵インスタンスが同時参照すると「1体倒したら他の敵も同時にディゾルブする」事故が起きる。本技法を複数体撃破の演出に使う場合は、マテリアル側・Niagara 側とも Dynamic Material Parameter / Niagara User Parameter（インスタンス個別バインド）に置き換える設計が必要

## ソースの限界

- 英語自動字幕のみ・手動字幕なし。誤認識と思われる箇所が多数: 「gpuc bounce mode」（GPU Bounds Mode の可能性）、「Hill particles」（Kill Particles の可能性）、「bios」（bias）、「rjba」（RGBA）、「spirit」（Sprite）、「Bells」（意味不明・恐らく別単語の誤変換）など。断定できない箇所は本文中に ※推定 と明記した
- ノイズテクスチャの具体的なアセット名、モジュール内の正確なノード名・接続順序は字幕からは特定できず、動画本編の目視確認が必要
- 7分の短尺チュートリアルであり、数値パラメータ（Strength=100、Frequency=25 等）の選定根拠については説明がない
