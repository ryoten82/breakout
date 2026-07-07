# FX（Niagara）ドクトリン（蒸留版 v2.3）

動画 25 本+公式 doc 4 ページ+**公式 Niagara Examples 実地検査（60 システム）**の横断抽出。**日常はこれだけ読む**。詳細は `videos/`・`inspections/`（Sonnet 委譲）。

## 構造の原則

1. **System > Emitter > Module > Parameter**。スタックは {System/Emitter/Particle}×{Spawn/Update} + Render
2. **一度だけ=Spawn、継続=Update**（Dynamic Material Parameter も同じ。侵食の経時進行・カーブ駆動は Update 側必須。実写確認: NormalizeAge基準のFloat from Curveでマテリアル値を動的化）
3. **値の設定と評価モジュールは分離** — Particle State・Solve Forces and Velocity が無いと効かない。依存警告は Fix Issue
4. **System 階層=監督**（実測）: System Spawn/Update で共通値を一元計算し全エミッタが参照。**バリアント量産は数行差し替えだけ**
5. UE5.8 の **Stateless（Lightweight）エミッタ**は軽量・省機能。⚠MCP の Niagara ツールでは中身が読めない（inspections/tools のパーサで対応）

## マテリアル定型

- **基本形**: Texture×Particle Color→Emissive、Alpha×Alpha→Opacity。必ず MI 化・Usage の Niagara フラグ ON
- **UV制御は1関数に集約**（実装確認）: Panner（Coordinate/Time/Speed）→Add（Offset）→CustomRotator（RotationAngle）を1 Material Function化し、Offset_U/V・Scale_U/V・Speed_U/V・RotationAngleの7入力+Sort Priorityでパネル順を整列。全MasterMaterialから共通参照する設計が量産の要
- **BlendMode別の実装Tips（実装確認）**: Masked=DepthFade不可・**Opacity は OpacityMask に配線**／Fresnel系は**TwoSided を外す**（他は基本チェック）／Additive2系統並列（Offsetのみ違う2つのUV制御関数をMultiply合成）で多層パン
- **ブレンド使い分け**: フレア=Additive／火花・破片=**Masked+Unlit**／煙・火球=公式は AlphaComposite+DefaultLit（簡略はUnlit+Translucent）。**Translucent を 1 系統に絞るのが層問題の根本解**
- **Erosion 定型**: ノイズ→Power→Opacity(Mask)。公式は**パーティクル α を閾値に流用**。Dynamic Parameter で外部化、⚠Index 重複は競合
- **グロー勾配**: 1-x でなく Divide(小値)。交差面は Depth Fade。色は **HDR 値+User.Color 一点制御**が公式流。電撃系は Radial Gradient Exponential→Particle Color→Multiply→Lerp→Emissive/Opacity/WPO
- **RGB を白1pxに差し替え色を分離**（実装確認）: 形状は Alpha マスクのみ、色は Vertex Color/Particle Color 側に委ねる分業

## Niagara 定型

- **1 粒バースト+カーブ駆動の器**: Light/Decal/PostProcess/柱メッシュは Burst1 粒。**Light+Sprite+Decal の 1 粒 3 レンダラー**は費用対効果最高
- **層分け**: Sort Order Hint より **(a) 1 エミッタ複数レンダラー+RendererVisibility タグ (b) ブレンドモード分離**。タイミングをsequencerでずらす「時間軸オフセットの層」も併用可
- **親子連鎖**: Death Event+IDs より **AttributeReader（SpawnParticlesFromOtherEmitter/SampleParticlesFromOtherEmitter）が新推奨形**（GPU対応・ID不要）。「当選フラグを親属性に書き→子側でKillParticles」で二次破裂
- **トレイル/光の筋**: SpawnPerUnit+RibbonWidth直指定+Screen facingが最小形。稲妻は Curve Tension+Jitter Position（Update Beam下流）。**Ribbon不使用の軽量代替**（tobari VFX、文字起こし確認済み・フル手順）：
  1. テクスチャ側で形状を作る：黒背景+白い長方形を変形（先細りくさび形）→レイヤーマスクで白黒グラデーション（塗り60%）→別レイヤーに楕円+ガウスぼかしで根元グローを合成
  2. マテリアルは関数不要のスタンダード構成（Textureをそのままemissive/opacityへ）
  3. **核心技**: Sprite Rendererの**Default Pivot in UV Space**をデフォルト(0.5,0.5)からテクスチャの先端（根元側）にずらす。これだけで中心から放射状に伸びる/回転するようになる（ずらさないと双方向に伸びて中心に戻る動きになる）
  4. Initial Sprite Sizeを**Random Non-Uniform**にしてX(幅)/Y(長さ)を独立制御
  5. Particle Update: Sprite Rotation Rate（Random Range Float、例最大30°/秒）で緩い回転。Scale Sprite Size（Non-Uniform Curve）でX=1.0→0.75（先細り）・Y=0.3→1.0（伸長）。Scale Color: RGB×1.5、Alphaは0→ピーク0.35→0の山形カーブ（Float from Curve）
  6. 複数エミッタが重なる場合はSprite Rendererの**Sort Order Hint**で前後関係を調整（対象自体でなく「他のエミッタ側」を前に出す方が綺麗な場合もある、と実例あり）
  - ⚠UE5.8 PythonではSprite Renderer等の新規モジュール追加が不可（実測済み）なので上記はスクリプト化不可、手動Niagaraエディタ作業が前提。静的メッシュ+マテリアル近似で代替する場合はテクスチャ形状（②の合成手順）だけでも流用価値あり
- **アイテムグロー総合**（CGHOW "Glowing Magical Potion"、字幕無くタグ情報のみ）: emissive material shader + fresnel + procedural star particle material + material distortion with noise + floating trails の組合せが定番構成。星形スパークルは「procedural star particle material」＝マテリアルグラフ内で星型を計算生成（テクスチャ不要）するアプローチが示唆される
- **ストレッチ**: Size Non-uniform+Velocity Alignment
- **大量イベント FX は NDC**（Niagara Data Channel）: 常駐1システム+BP/C++からWrite
- **キャラ付随**: SkeletalMeshLocationをSpawn(表面)/Update(ボーン追従)で使い分け。全身グローはPartitions+カプセル。Meshベースは**User Param Binding経由でNiagara→マテリアル接続**
- カーブは全キーAuto、出現はオーバーシュート。**テレグラフと常時装飾は別レイヤー**
- **画面全体演出はNiagaraと分離**: Radial Blur+Chromatic AberrationはMPC+マテリアルインスタンス1枚で実装可

## Fluids / Execution State（圧縮継承）

- 気体=グリッド/液体=FLIP、2D Gas=軽量常時/3D Gas=ヒーロー級。Execution State=寿命制御、Inheritanceで差分量産
