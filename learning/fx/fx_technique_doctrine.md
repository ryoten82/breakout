# FX（Niagara）ドクトリン（蒸留版 v2.1）

動画 20 本+公式 doc 4 ページ+**公式 Niagara Examples 実地検査（60 システム）**の横断抽出。**日常はこれだけ読む**（上限 3.5KB）。詳細は `videos/`・`inspections/`（Sonnet 委譲）。

## 構造の原則

1. **System > Emitter > Module > Parameter**。スタックは {System/Emitter/Particle}×{Spawn/Update} + Render
2. **一度だけ=Spawn、継続=Update**（Dynamic Material Parameter も同じ。侵食の経時進行は Update 側必須）
3. **値の設定と評価モジュールは分離** — Particle State・Solve Forces and Velocity が無いと効かない。依存警告は Fix Issue
4. **System 階層=監督**（実測）: System Spawn/Update で共通値（サイズ・色温度カーブ）を一元計算し全エミッタが参照。**バリアント量産は System Spawn の数行差し替えだけ**
5. UE5.8 の **Stateless（Lightweight）エミッタ**は軽量・省機能（Pickup/Marker 系が実例）。⚠MCP の Niagara ツールでは中身が読めない（inspections/tools のパーサで対応）

## マテリアル定型

- **基本形**: Texture×Particle Color→Emissive、Alpha×Alpha→Opacity。必ず MI 化・Usage の Niagara フラグ ON
- **ブレンド使い分け（実測更新）**: フレア=Additive／火花・破片=**Masked+Unlit**／煙・火球=公式は AlphaComposite+DefaultLit（当プロジェクトは Unlit+Translucent 簡略可）。**Translucent を 1 系統に絞るのが層問題の根本解**
- **Erosion 定型**: ノイズ→Power→Opacity(Mask)。公式は**パーティクル α を閾値に流用**（Use Particle Alpha As Threshold）。Dynamic Parameter で外部化、⚠Index 重複は競合
- **グロー勾配**: 1-x でなく Divide(小値)。交差面は Depth Fade。色は **HDR 値（R=20〜100）+User.Color 一点制御**が公式流

## Niagara 定型

- **1 粒バースト+カーブ駆動の器**: Light/Decal/PostProcess/柱メッシュは Burst1 粒で出し、System/Emitter 変数のカーブで駆動（寿命オフより上位形）。**Light+Sprite+Decal の 1 粒 3 レンダラー**は費用対効果最高（Impact 系実例）
- **層分け（実測で更新）**: Sort Order Hint より **(a) 1 エミッタ複数レンダラー+RendererVisibility タグ**（弾頭/トレイル、岩/破片の振り分け）**(b) ブレンドモード分離**が公式流
- **親子連鎖（実測で更新）**: Death Event+Persistent IDs より **AttributeReader（SpawnParticlesFromOtherEmitter/SampleParticlesFromOtherEmitter）が新しい推奨形**（GPU 対応・ID 不要）。二次火花・リボン化が実例。「当選フラグを親の属性に書き→子側で KillParticles」でランダム二次破裂
- **トレイル**: SpawnPerUnit+RibbonWidth 直指定+Screen facing が最小形（8 モジュール）。複数リボンは PartitionParticles→RibbonID 直書き
- **ストレッチ**: Size Non-uniform+Velocity Alignment（マズル火花系）
- **大量イベント FX は NDC**（Niagara Data Channel）: 常駐 1 システム+BP/C++ から Write。per-hit スポーンの置換候補
- **キャラ付随**: SkeletalMeshLocation を Spawn（表面発生）/Update（ボーン追従）で使い分け。全身グローは Partitions+カプセル
- カーブは全キー Auto、出現はオーバーシュート。**SBMine 型テレグラフ（時間軸予告）と常時装飾は別レイヤー**

## Fluids / Execution State（圧縮継承）

- 気体=グリッド/液体=FLIP、2D Gas=軽量常時/3D Gas=ヒーロー級（⚠導入は計測から）。Execution State=寿命制御、Inheritance で差分量産
