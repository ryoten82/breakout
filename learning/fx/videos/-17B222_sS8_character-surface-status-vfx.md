# 学習ノート — UE5 Character Surface Status VFX

- ソース: https://www.youtube.com/watch?v=-17B222_sS8 （7:24）
- 視聴日: 2026-07-09 / 字幕種別: **英語手動字幕**（`-17B222_sS8.en.vtt`、`Kind: captions`。自動字幕ではない）
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\-17B222_sS8.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: なし（本チャンネルの他動画への言及は本動画内になし）

## 概要

キャラクターの「サーフェス状態エフェクト」（燃焼・凍結・酸ダメージ等）を、Niagara パーティクルではなく **Overlay Material（オーバーレイマテリアル）+ Blueprint Interface によるトリガー伝達**で実現するチュートリアル。タイトルに VFX とあるが、動画本編で実際に扱われるのは UE 標準機能のオーバーレイマテリアル設定と、トリガー用ブループリント同士を疎結合に繋ぐ設計パターンが中心で、Niagara の具体的なノード作成は登場しない（冒頭で「Niagara システムを追加すれば」と言及されるのみ）。

## 技術詳細

### Overlay Material によるキャラ全身の状態表現

- Mixamo キャラクターのキャラクターブループリントに対し、**キャラ自身のベースマテリアルを直接差し替えるのではなく**、Skeletal Mesh コンポーネントの **Set Overlay Material** ノードで別マテリアルを重ねる方式を採用
- この方式の利点として「マスキングを必要としないサーフェスエフェクトを作る際に向いている」と明言される。ベースマテリアルのレイヤー構造を意識せず、丸ごと上から覆う設計
- マテリアル自体は **Fresnel（フェイクフレネル系ノード）+ Noise テクスチャ**というシンプルな構成で、両方ともエンジン標準の default アセットを使用（作り方の詳細解説は「デフォルトアセットなので割愛」とスキップされる）

### トリガー→キャラへのデバフ伝達設計（Blueprint Interface パターン）

1. **Buff Blueprint**（Box Collision + Sphere メッシュ）を用意。Sphere にオーバーレイ用マテリアルを適用
2. Box の `OnActorBeginOverlap` で侵入したアクターを変数に保存 → カスタムイベント `buff` を発火
3. トリガー側ブループリントとキャラクター側ブループリントを**直接参照せず疎結合に繋ぐ**ために、Blueprint Interface（`BPI_GetCharacter`、関数名 `Get Character`、戻り値型 Skeletal Mesh Component）を新規作成
4. Buff Blueprint は Class Settings に `BPI_GetCharacter` を追加し、保存済みアクターに対して `Get Character` メッセージを送る
5. キャラクターブループリント側も同インターフェースを実装し、Interface タブで `Get Character` にキャラの Skeletal Mesh コンポーネントを紐付ける
6. 戻ってきた Skeletal Mesh Component に対して `Set Overlay Material`（マテリアルは Sphere のものを直接指定、または独立した変数として選択可能にする設計案も提示）を呼び出し、デバフ発火が完結
- 「インターフェース経由でデータは渡せても、送信先を知らなければ動かない」ため、**トリガー側とキャラ側の両方に同じ Interface を追加する必要がある**という UE Blueprint Interface の基本挙動（片方だけでは機能しない）が実演を通じて確認されている

### 汎用化・応用例

- 色を変えるだけで別種のバフ/デバフ表現に流用可能（実演では赤色に変更）
- 別のキャラクターブループリントに対しても同じ Buff Blueprint がそのまま機能することを確認（Interface ベースの疎結合設計の恩恵）
- 「バフ」に限らず、**地面ギミック**（燃えている地面・凍った地面・酸で腐食する地面等）にも同じ overlay + trigger 構成を転用できると言及。地面側のトリガーアクターに置き換えるだけで同じ仕組みが使い回せる設計

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の「キャラ付随」節には SkeletalMeshLocation を Spawn(表面)/Update(ボーン追従) で使い分ける Niagara ベースの手法と、全身グローを Partitions+カプセルで作る力技が記載されている。本動画の手法はそれとは**別軸**で、既存ドクトリンに未収録:

- **Set Overlay Material（コンポーネント標準機能）によるキャラ全身の色/質感変化**: Niagara パーティクルを一切使わず、マテリアルの重ね掛けだけでキャラ全体の状態表現を完結させる手法。マスキング不要・ボーン追従の実装コスト自体が発生しない（コンポーネントに紐づくため自動追従）という点で、Niagara の SkeletalMeshLocation 手法よりも実装コストが低い代替経路
- **Blueprint Interface によるトリガー⇔キャラの疎結合デバフ伝達パターン**: VFX 技法そのものではないが、「トリガーアクターがどのキャラに何のエフェクトを適用するか」を直接参照なしに解決する設計パターンとして、既存ドクトリンにはない知見。汎用ブループリント設計の話であり、既存の Niagara/マテリアル定型節とは階層が異なる

## SCRAP BLITZ UEへの応用メモ

- **METEO・敵キャラのデバフ演出**（毒/延焼/氷結等の状態異常）表現の候補技術として有力: Overlay Material は全身の色調・質感を一括変化させる用途に向いており、既存の Niagara キャラ付随手法（SkeletalMeshLocation・カプセル力技）よりも実装が軽い。**役割分担**として、「全身の色調・発光変化はマテリアルオーバーレイ、局所的な火花/凍結結晶/毒の泡等の粒子表現は Niagara」という二層構成が現実的
- 現状 SCRAP BLITZ UE の敵状態異常演出は GAS（GameplayEffect/GameplayAbility）ベースで実装されているはずだが、**Overlay Material は GAS の GameplayEffect 適用と組み合わせやすい**（Effect の Duration に応じて Set Overlay Material のオン/オフを切り替えるだけで良く、Niagara コンポーネントのアタッチ/デタッチ管理より単純）。デバフ VFX の実装コスト削減を検討する価値あり
- Blueprint Interface のトリガー伝達パターンは、C++ の virtual フック方式（`ShouldXxx()` override）を既に採用している本プロジェクトの設計哲学とは別レイヤーの疎結合手法だが、**Niagara/マテリアル側からキャラを特定する必要がある新規エフェクト**（例: 地形ギミックが特定キャラにのみデバフを与える、等）を作る際の参考になる
- 「地面ギミックにも同じ overlay 手法が転用できる」という言及は、ステージ上のハザード床（溶岩・氷床等）演出のアイデアとしても流用可能

## ソースの限界

- タイトルは「VFX」だが、実際の内容の大半は UE 標準機能（Overlay Material・Blueprint Interface）の使い方であり、Niagara パーティクルの具体的な作成手順は本動画に含まれない（冒頭で「Niagara システムを追加すれば」と一言触れられるのみで実装は未収録）
- マテリアルグラフのノード接続順序は画面上で早口に進行する区間があり、字幕からは各ノードの正確な接続経路まで確認できない箇所がある（Fresnel/Noise の具体的な合成方法など）
- 手動字幕だが `[music]` タグが挿入されている箇所は音声が一部 BGM に埋もれており、文脈から意味の欠落は小さいと判断したが完全性は保証できない
