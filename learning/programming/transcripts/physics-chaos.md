# SOURCE: Physics in Unreal Engine (Chaos Physics)
URL: https://dev.epicgames.com/documentation/unreal-engine/physics-in-unreal-engine
取得方法: WebFetch（全文再現・良質だが各サブシステムは1段落程度の紹介止まり＝目次的性格）
取得日: 2026-07-04

---

"Chaos Physics is a light-weight physics simulation solution available in Unreal Engine," built to meet next-generation game requirements.

## Chaos Physics の主要サブシステム（14種）

**Destruction** — "cinematic-quality levels of destruction in real time" を Static Mesh から構築した Geometry Collections で実現。「複数レベルの破砕・選択的破砕」機能。構造崩壊シミュレーション用の Connection Graphs。リプレイ用の Cache System。Niagara パーティクルシステム・Physics Fields と統合。

**Networked Physics** — マルチプレイヤー環境での物理駆動シミュレーションを可能にする。3つのレプリケーションモード: Default（レガシーモード）・Predictive Interpolation（サーバー権威+クライアント変更）・Resimulation（クライアント予測+サーバー状態比較）。

**Chaos Visual Debugger** — 物理シミュレーション状態を記録し「ツール内でシミュレーションを再生し、任意のフレームのデータを検査できる」デバッグツール。

**Rigid Body Dynamics** — 衝突反応・物理制約・減衰・摩擦・非同期シミュレーション・ネットワーク物理機能を含む。

**Rigid Body Animation Nodes and Physical Animation** — "the Physical Asset Editor" を使って Skeletal Mesh にリジッドボディをアタッチする設定。

**Cloth Physics and Machine Learning Cloth Simulation** — "Chaos Cloth provides accurate and performant cloth simulation"。Animation Drive システム、ランタイム変更用の Blueprint パラメータ公開、従来の物理ベースモデルより高忠実度な ML ベースの布シミュレーション。

**Ragdoll Physics** — "Rigid bodies connected to a Skeletal Mesh are animated (simulated) in real-time" — ヒューマノイドキャラクターアニメーション向け。

**Chaos Vehicles** — "Lightweight system for performing vehicle physics simulations"。設定可能なホイール・ギア・エアロフォイル面・推進力をサポート。

**Physics Fields** — "Chaos Physics simulations at runtime on a specified region of space" に影響を与える。力の行使・クラスタ破壊を通じて。

**Fluid Simulation** — "2D and 3D fluid effects in real time" をシミュレートするツール（Niagara Fluidsと同系統・詳細は fx/videos/niagara-fluids.md 参照）。

**Hair Physics** — "Strand-based workflow to render each individual strand of hair with physically accurate motion."

**Chaos Flesh** — "high-quality, real-time simulation of deformable (soft) bodies"。スケルタルアニメーション中のキャラクター筋肉変形向け。

**Dataflow Graph System** — "node-based procedural asset generation environment"。複数アセットタイプでのイテレーション時間改善を目的とする。
