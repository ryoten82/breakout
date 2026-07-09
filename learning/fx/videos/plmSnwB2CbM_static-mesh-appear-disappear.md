# 学習ノート — UE5 Static Mesh Appear And Disappear

- ソース: https://www.youtube.com/watch?v=plmSnwB2CbM （2:47・短尺）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\plmSnwB2CbM.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [iDrsEp3AGWA_magic-orbs.md](iDrsEp3AGWA_magic-orbs.md)（OCジェム/浮遊オーブ直結）、doctrine の Erosion 定型（ノイズ→Power→Opacity(Mask)）と隣接領域だが本動画はマテリアル側ではなく**駆動アーキテクチャ**が主題

## 概要

Static Mesh を任意のタイミングでフェード出現/消滅させる最小構成チュートリアル。マテリアル側は Masked ブレンド+Opacity Mask への接続という一般的な Dissolve 手法（既存 doctrine で既知）だが、本動画の主眼は**複数の Static Mesh を独立制御するための駆動方式選び**にある。

## 技術詳細

1. 対象 Static Mesh（例: chair）用のマテリアルを Custom Static Mesh Material として複製し、Blend Mode を **Masked** に変更
2. Dissolve 用ノード群をコピーして Opacity Mask に接続（ノイズ/しきい値ベースの一般的な構成、詳細ノードは字幕からは特定できず）
3. この Static Mesh を制御用 Blueprint（Static Mesh Component を持つアクター）に配置し、レベル上で Static Mesh を差し替え可能にする
4. 出現/消滅の速度パラメータ（字幕上「straight」＝Speed/Rate 系パラメータの誤認識と推測 ※推定）を **0.5** に設定するとアニメーションが遅くなる、という調整例
5. 2つ目の Static Mesh（例: sphere）でも同様にマテリアル複製→Masked化→Opacity Mask接続を行い、Base Color を黒（見づらい）から別の色に変更して視認性を確保

## 核心: MPC vs Dynamic Material Parameter（複数メッシュの独立制御）

- chair と sphere の両方に同じ Blueprint／同じ駆動パラメータを使うと、**2つの Static Mesh が同時に appear/disappear してしまう**問題が発生
- 原因として **Material Parameter Collection（MPC）** を使っていたことが挙げられる。MPC はレベル全体で共有されるグローバルパラメータのため、そのパラメータを参照するマテリアルすべてが同時に反応する
- 解決策として、**単一の Static Mesh だけを個別制御したい場合は MPC ではなく Dynamic Material Parameter（Dynamic Material Instance 経由のパラメータ）を使うべき**、と結論づけられる

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` には Dissolve/Erosion のマテリアル定型（ノイズ→Power→Opacity(Mask)）は既知だが、以下は未収録で新規:

- **MPC（グローバル共有）vs Dynamic Material Parameter（インスタンス個別）という「駆動アーキテクチャの選択基準」そのもの**が明示された点。doctrine には Dynamic Material Parameter の動的化手法（NormalizeAge基準のFloat from Curve）は既にあるが、「なぜ MPC ではダメで DMP が必要なのか」という設計判断の理由（同一マテリアルを参照する全アクターが同時に反応してしまう共有スコープの罠）は本動画が初出
- 複数アクターに同一 Dissolve マテリアルを使い回す設計では、**MPC = 一括同期制御用、Dynamic Material Parameter = 個体別制御用**という住み分けが成立する、という一般則として doctrine の「グロー勾配」節付近に追記候補

## SCRAP BLITZ UEへの応用メモ

- **アイテム拾得演出（Pickup フェード）に直結**: common01 §13 の Pickup マグネット/寿命管理と組み合わせ、拾得時に Static Mesh をフェードアウトさせる際は、複数の Pickup（OCジェム・SPオーブ等）が同一 Dissolve マテリアルを共有する構成になりやすい。その場合 MPC で駆動すると「1個拾ったら他のジェムも同時にフェードする」事故が起きうる — 本ノートの教訓どおり **Dynamic Material Parameter（Dynamic Material Instance 経由）で個体ごとに駆動する**のが正しい選択
- 敵の出現/撃破時の実体化・消滅演出にも同型で応用可能（複数の同時湧き敵が同じマテリアルを共有するケースで同じ罠が起きうる）
- マテリアル側の Dissolve 実装自体（ノイズ→Opacity Mask）は既存 doctrine の Erosion 定型で十分カバー済みのため、本ノートの価値は実装のマテリアル部分ではなく**「同一マテリアルを複数アクターで使い回す時の制御スコープ設計」**にある

## ソースの限界

- 英語自動字幕のみ・手動字幕なし。ノード名（例:「MCH」＝Mesh の誤認識、「liel」「pck」等）は認識精度が低く、正確なノード名・UIラベルは動画本編での目視確認が必要
- Dissolve マテリアル内部の具体的なノード構成（ノイズテクスチャの種類、Power値等）は字幕からは特定不可能で本ノートには含めていない
- 「straight like 0.5」の実際のパラメータ名（Speed/Rate/Duration等）は特定できず ※推定 表記のまま
- 短尺チュートリアルのため、appear/disappear のトリガー方法（イベント/インターフェース呼び出し等）の詳細は説明されていない
