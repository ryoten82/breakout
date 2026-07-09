# 学習ノート — UE5 Lightning Crack VFX（8:58）

- ソース: https://www.youtube.com/watch?v=4QF8sHC6HWo
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\fx\transcripts\4QF8sHC6HWo.txt`
- 関連ノート: 動画冒頭で「前の動画のライトニングバースト/ストライク演出を補完する」と明言されており、シリーズ後編の位置づけ（前編は本部屋未収録）。既存の電撃系記述は [fx/videos/mldLcKDpQk0_dmc-slash-vfx-replication.md](mldLcKDpQk0_dmc-slash-vfx-replication.md)（`M_Electric` = Radial Gradient Exponential+Particle Color+Multiply+Lerp）

## 概要

8分58秒の短編チュートリアル。地面や壁に走る「稲妻クラック（罅割れ状の光の亀裂）」エフェクトと、それに添えるシンプルなグローの2点を作る。素材はクラックテクスチャ・センターショックウェーブテクスチャ・グローフレアテクスチャの3枚のみで、マテリアル2枚（クラック用・グロー用）+ Niagara System 1つ（2エミッタ+複製1）という小規模構成。

## クラックマテリアルの構成

- Blend Mode / Shading Model は通常運用（Translucent 系・Unlit ※推定、動画内では詳細を明言せず「as usual」とのみ言及）
- **放射状に広がる形状の核**は Material Function「Vector to Radial Value」（字幕上は "vector to radio value" と崩れているが文脈から Radial Value 系ノードと判断）。通常のテクスチャを放射座標に変換する
- タイリングは2Dベクタで指定（例: X=3, Y=2）。**Radial 変換後のテクスチャは境界（放射の中心/端）でアーティファクトが出るため、Texture Sample の MIP Level を明示的に 0 に固定して回避**という具体的なトラブルシューティングが語られている
- 同じ Radial Value 変換をもう1系統複製し、タイリングを X=5, Y=1 に変更。さらに片方は「Vector to Radial Value」、もう片方は座標変換を「Vector to Angle」に差し替えることで、**渦を巻くようなクラックと、直線的に放射するクラックの2種類のパターン**を作り、**Blend Overlay で合成**する。これにより「捻れながら外側へ広がる罅」と「まっすぐ放射する筋」が同時に出る、有機的な分岐パターンの作り方
- Opacity: ショックウェーブテクスチャを上記ブレンド結果に乗算してマスクにする。さらに Dynamic Material Parameter を Power ノードに接続してクラックの強度を制御（乗算ではなく Power で、と明示的に訂正が入っている）
- 2つの Dynamic Material Parameter で「クラックがいつフェードするか」と「クラック形状（マスクのバリエーション）」を制御。**Power の値が大きいほどクラックが消えていく**という設計
- Emissive Color は上記ブレンド結果から**3層**を別々に加工して合成する:
  1. Power 5 を掛けた強い版（細く明るい、コア電流表現）
  2. Power 0.3 を掛けた粗い版（外側の暗いクラック）
  3. Radial Value を複製し、Panner（X speed 0.1, Y speed -0.1）を追加した「流れるアーク」層。外向きに広がりながらわずかに回転する見た目。この層だけ Emissive 強度を ×10 と最も高くし、Particle Random でランダム色（Hue Shift 駆動）にするか、そのまま Particle Color を使うかを選択可能にしている
  - 3層を Add して Emissive Color に接続

## Niagara System 構成（クラック側）

- Empty テンプレートでエミッタ追加、**Mesh Renderer**（エンジン標準の Plane/BaseShape メッシュ）にクラックマテリアルを適用（Sprite ではなく Mesh を使う点が特徴）
- Emitter State: Self, Loop Behavior=Once, Loop Duration=1秒、Spawn Count=1
- Initialize Particle: Lifetime=5秒、Color=Linear Color の User Parameter、Size=Random 2〜3
- **Initial Mesh Orientation** を追加してメッシュごとにランダムな初期回転を与え、同じクラック形状の反復感を消す
- Particle Update: Scale Color（Curve テンプレート、intensity=10）+ Scale Mesh Size（Curve、0.5→1に短時間で遷移させ「パッと出る」勢いを演出）
- Dynamic Material Parameter を2つ Niagara 側からも駆動:
  - クラック強度: Curve で寿命の 0.02〜1 の範囲を Power の 2〜100 にマッピング。**値0付近でクラックが最も強く、増加とともに弱まる**設計（マテリアル側の Power ロジックと対応）
  - マスク: Random 1〜3（毎回フェードし切らなくてよいパラメータと説明）

## グローマテリアル/Niagara（付随エフェクト）

- グローマテリアルは極めてシンプル: Glow Flare テクスチャ × Radial Gradient Exponential（表示範囲のマスク）× Particle Color × Alpha（Opacity 制御）。Blend Mode/Shading Model/Two Sided はクラック側と同様の設定
- Sprite Renderer、Emitter State は Self/Once/Spawn Count=1、Lifetime=0.2〜0.3秒（かなり短い、フラッシュ的な使い方）
- Particle Position を微オフセットし、Sprite Size=1000 から Scale Color（Curve intensity=2）と Scale Sprite Size（Curve）で減衰
- **同エミッタを複製し、サイズを絞って明るくした版**を重ねる: Sprite Size=500・Color Intensity=10 に変更するだけで「小さく強い中心グロー + 大きく淡い外周グロー」の2層グローが完成する、という量産パターン

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の電撃系記述「Radial Gradient Exponential→Particle Color→Multiply→Lerp→Emissive/Opacity/WPO」は**グロー側の最小形とほぼ一致**するが、**クラック（罅割れ）本体の作り方は未収録**であり、以下が新規:

- **Vector to Radial Value と Vector to Angle の2系統を異なるタイリングで作り Blend Overlay 合成**することで、渦状+放射状のハイブリッドな有機的分岐パターンを作る手法（既存ドクトリンの「グロー勾配」節はグラデーション表現のみで、分岐・亀裂状パターンの生成法は無い）
- **Radial 変換テクスチャの境界アーティファクトを MIP Level 0 固定で解消する**という具体的なトラブルシューティング Tips（他ノートに記載なし）
- **Power ノードの指数を Curve で 2→100 にアニメーションさせ「強度→フェード」を1パラメータで制御する**設計（乗算でなく Power を使う理由まで言及されている点が既存ドクトリンより具体的）
- **Mesh Renderer（Plane）+ Initial Mesh Orientation でランダム回転**という、Sprite ではなく板ポリメッシュ1枚+回転バリエーションでクラック形状の反復感を消す軽量パターン（既存ドクトリンの「1粒バースト」定型はLight/Decal/柱メッシュが対象で、平面クラックへの適用例は無い）
- **同一グローエミッタを複製しサイズ/強度だけ変えて2層化する**量産パターン自体は既存ドクトリンの「バリアント量産は数行差し替えだけ」と方向性は一致するが、本動画は具体的な数値ペア（1000/2 と 500/10）を示している点で補完的

## SCRAP BLITZ UEへの応用メモ

- ボス攻撃の**着弾・被ダメージ演出**（特に電撃・エネルギー系の敵/技）に、この「クラック+グロー」の2点セットはそのまま転用しやすい。既存の `M_Electric`（DMC スラッシュ由来）は人型シルエットに這わせる電撃で用途が異なり、本動画のクラックは**地面/壁/オブジェクト表面への着弾亀裂**という別レイヤーの表現。着弾FXの Physical Material 駆動分岐（doctrine既存項目）と組み合わせ、地面種別ごとにクラック色・強度を切り替える拡張も自然
- METEO の SP 技や敵の溜め攻撃着弾の「一瞬パッと広がる罅割れ」演出として、Mesh Renderer 1枚+短寿命（5秒程度だがフェードは早い）という軽量構成は現状の DrawDebug 仮実装からの差し替え候補になりうる
- Power ノードでの強度カーブ制御は、既存 AOE テレグラフ（SBMine型・opacity 0.20→0.95）とは別ロジックだが、「1つの Dynamic Material Parameter を Power の指数として使い減衰カーブを作る」考え方はテレグラフ以外の被弾フラッシュ全般に応用できる
- 本エフェクトは環境オブジェクト（壁・床）向けの想定だが、ボス本体の装甲にヒビが入る「損傷表現」演出（HPフェーズ移行の視覚化）にも転用可能性がある。現状 SCRAP BLITZ UE にこの種の表現はないため新規演出候補として記録するに留める

## ソースの限界

- 英語自動字幕のみで手動字幕なし。特に "Vector to Radial Value" が "vector to radio value" と一貫して誤認識されており、正式なノード名は※推定（Radial Gradient 系ノードであることは文脈上確実だが、Epic 公式の正式名称と一致するかは未検証）
- Blend Mode・Shading Model の具体的な設定値（Translucent/Unlit か等）は動画内で「usual」としか言及されず、実際の画面を見ていないため未確定
- 前提となる「前の動画（ライトニングバースト/ストライク）」は本部屋未収録のため、本エフェクトがどう組み合わさって最終的な稲妻演出になるかの全体像は本ノート単体では分からない
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約。ノード間の細かい接続順序（特に3層 Emissive の Add 順序、Dynamic Material Parameter のスロット番号対応）は聞き取れた範囲の推定を含む
