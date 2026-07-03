# 学習ノート — Physics in Unreal Engine (Chaos Physics)

- ソース: Epic公式ドキュメント「Physics in Unreal Engine (Chaos Physics)」
- URL: https://dev.epicgames.com/documentation/unreal-engine/physics-in-unreal-engine
- 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 学習日: 2026-07-04
- 原典 transcript: [../transcripts/physics-chaos.md](../transcripts/physics-chaos.md)

## Chaos Physics とは

"Chaos Physics is a light-weight physics simulation solution available in Unreal Engine" として提供される、次世代ゲーム要件を満たすことを目的とした軽量物理シミュレーションソリューション。原文はこの定義を導入として掲げた上で、14 のサブシステムを列挙する構成になっている。

## 14サブシステム一覧

- **Destruction** — Static Mesh から構築した Geometry Collections でシネマティック品質のリアルタイム破壊を実現。複数レベル/選択的破砕、構造崩壊用 Connection Graphs、リプレイ用 Cache System、Niagara・Physics Fields との統合を持つ。
- **Networked Physics** — マルチプレイヤー環境での物理駆動シミュレーションを可能にする。Default（レガシー）・Predictive Interpolation（サーバー権威+クライアント変更）・Resimulation（クライアント予測+サーバー状態比較）の3レプリケーションモード。
- **Chaos Visual Debugger** — 物理シミュレーション状態を記録し、任意フレームのデータをツール内で再生・検査できるデバッグツール。
- **Rigid Body Dynamics** — 衝突反応・物理制約・減衰・摩擦・非同期シミュレーション・ネットワーク物理機能を含む基盤サブシステム。
- **Rigid Body Animation Nodes and Physical Animation** — Physical Asset Editor を使い、Skeletal Mesh にリジッドボディをアタッチする設定を扱う。
- **Cloth Physics and Machine Learning Cloth Simulation** — 高精度・高性能な布シミュレーション（Chaos Cloth）。Animation Drive、Blueprint 経由のランタイムパラメータ公開、従来手法より高忠実度な ML ベース布シミュレーションを含む。
- **Ragdoll Physics** — Skeletal Mesh に接続されたリジッドボディがリアルタイムでアニメーション（シミュレーション）される、ヒューマノイドキャラクターアニメーション向けの仕組み。
- **Chaos Vehicles** — 車両物理シミュレーション用の軽量システム。設定可能なホイール・ギア・エアロフォイル面・推進力をサポート。
- **Physics Fields** — 特定の空間領域を対象に、ランタイムで Chaos Physics シミュレーションへ影響を与える（力の行使・クラスタ破壊を通じて）。
- **Fluid Simulation** — リアルタイムの2D/3D流体エフェクトをシミュレートするツール（詳細は別ノート fx/videos/niagara-fluids.md 参照）。
- **Hair Physics** — 個々の毛髪ストランドを物理的に正確な動きでレンダリングする、ストランドベースのワークフロー。
- **Chaos Flesh** — スケルタルアニメーション中のキャラクター筋肉変形向け、高品質・リアルタイムな変形可能（ソフト）ボディのシミュレーション。
- **Dataflow Graph System** — 複数アセットタイプでのイテレーション時間改善を目的とした、ノードベースの手続き型アセット生成環境。

## SCRAP BLITZ に活かせる部分

原文はいずれのサブシステムも1段落の紹介に留まり、設定手順や実運用上の勘所は含まれていない。以下は原文の説明範囲から一般的に想定できる関連性の整理であり、SCRAP BLITZ の既存実装（死亡モーション・物理パラメータまわり）の詳細を確認した上での断定ではない。

- **Ragdoll Physics × 死亡モーション演出**：原文の定義（Skeletal Mesh に接続したリジッドボディをリアルタイムでシミュレーションする）に従えば、死亡時にアニメーション制御からリジッドボディ制御へ切り替える手法として一般的に使われるものと考えられる。SCRAP BLITZ では死亡skeletal mesh不可視問題（`setup_ue_dying_mesh_visibility` に経緯あり）を扱った経験があるため、Ragdoll 導入を検討する場合は同種の可視性問題（Physical Asset のシミュレーション状態と描画の食い違いなど）が再発しないか確認が必要になりそうだが、これは原文からは判断できず※一般知識で補足の域を出ない。
- **Physics Fields × 被弾ノックバック演出**：原文は「特定の空間領域に対し力の行使やクラスタ破壊を通じて影響を与える」とのみ記述しており、パーティクルやキャラクターへの一時的な力積の与え方（既存のノックバック実装との関係）は原文に情報がない。演出強化の選択肢として存在を把握しておく程度に留まる。
- **Destruction × 背景破壊演出（廃工場の瓦礫等）**：原文は Geometry Collections による複数レベル/選択的破砕、Connection Graphs による構造崩壊、Niagara・Physics Fields との統合を挙げている。廃工場ステージの瓦礫演出に転用できる可能性はあるが、パフォーマンスコストや Nanite との併用可否など実務上の判断材料は原文に含まれていない。
- **Rigid Body Dynamics（キャラ固有物理パラメータとの関係）**：SCRAP BLITZ にはキャラ固有物理パラメータの経験（`project_scrapblitz_physics_per_char`）があるが、原文の Rigid Body Dynamics の説明は「衝突反応・制約・減衰・摩擦・非同期シミュレーション・ネットワーク物理を含む」という機能列挙のみで、キャラ単位のパラメータ差別化に関する記述は無い。関連付けは推測の域を出ない。

## ソースの限界

原文は Chaos Physics の14サブシステムそれぞれを1段落程度で紹介する「目次的」なページであり、各サブシステムの設定手順・具体的パラメータ・数値・ワークフローの詳細は一切含まれていない。Destruction の Connection Graphs の組み方、Ragdoll Physics の Physical Asset Editor 上の具体的操作、Physics Fields で使える Field ノードの種類、Networked Physics の各モードの切り替え方法など、実装に踏み込むための情報はこのソースだけでは得られない。上記「SCRAP BLITZ に活かせる部分」の記述も、この制約を前提とした一般的な可能性の整理にとどまる。
