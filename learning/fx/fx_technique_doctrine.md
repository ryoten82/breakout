# FX（Niagara）ドクトリン（蒸留版 v2.5）

動画 71 本+公式 doc 4 ページ+**公式 Niagara Examples 実地検査（60 システム）+ 開発者ライブ配信（設計意図の裏付け）**の横断抽出。**日常はこれだけ読む**。詳細は `videos/`・`inspections/`（Sonnet 委譲）。

## 構造の原則

1. **System > Emitter > Module > Parameter**。スタックは {System/Emitter/Particle}×{Spawn/Update} + Render
2. **一度だけ=Spawn、継続=Update**（Dynamic Material Parameterも同じ。実測: NormalizeAge基準のFloat from Curveで動的化）。⚠DMPをParticleステージで直接ランダム化すると粒ごとにばらける（Emitter Spawnで一度だけ設定→Particle側は参照のみ）
3. **値の設定と評価モジュールは分離** — Particle State・Solve Forces and Velocityが無いと効かない
4. **System 階層=監督**（実測）: Spawn/Updateで共通値を一元計算し全エミッタが参照。バリアント量産は数行差し替えだけ。**タイミング予測不可能な演出（被弾リアクション等）は本体Systemに混ぜず別Systemに分離**
5. **Stateless（Lightweight）エミッタが第一選択**（公式開発者推奨）: まずLightweightで作り行き詰まったらStatefulへ移行。Cascadeより軽い。制約=ローカル空間限定・Component Renderer非対応・NDC不可。⚠MCPツールでは中身が読めない（inspections/toolsのパーサで対応）
6. **Position直接上書きよりForce駆動**（実測）: Particle.Positionを毎フレームLerp代入すると他Force（Curl Noise等）と共存不可・ジッター発生。目標へのベクトルをLinear Forceに渡す設計に置き換える。引力↑+乱流↓のカーブを逆位相に交差させると「乱流優勢→引力優勢」の自然な遷移も作れる（変身/召喚系に応用）

## マテリアル定型

- **MPC vs Dynamic Material Parameter**（複数インスタンス個別制御の分岐点。詳細は`materials_technique_doctrine.md`）: 複数個体が同一マテリアルを共有する構成（Pickup複数体・雑魚敵等）はDMP必須。MPCを使うと全個体が同時反応する事故になる
- **基本形**: Texture×Particle Color→Emissive、Alpha×Alpha→Opacity。必ずMI化・Usage Niagaraフラグ ON
- **UV制御は1関数に集約**: Panner→Add(Offset)→CustomRotator(RotationAngle)を1 Material Function化、7入力+Sort Priorityでパネル整列。全MasterMaterialから共通参照
- **BlendMode別Tips**: Masked=Opacity→OpacityMask配線必須／Fresnel=TwoSided外す／Additive2系統並列（Offset違いのUV制御関数をMultiply合成）で多層パン
- **ブレンド使い分け**: フレア=Additive／火花・破片=Masked+Unlit／煙・火球=公式AlphaComposite+DefaultLit（簡略はUnlit+Translucent）。Translucentを1系統に絞るのが層問題の根本解。**Niagara不使用のマテリアル1枚+バースト1粒(球メッシュ)だけでも爆発表現は成立する**（多数同時発生・軽量化優先の場面向け選択肢）
- **Erosion定型**: ノイズ→Power→Opacity(Mask)。パーティクルαを閾値流用、Dynamic Parameterで外部化
- **グロー勾配**: 1-xでなくDivide(小値)。交差面はDepth Fade。色はHDR値+User.Color一点制御。電撃系はRadial Gradient Exponential→Particle Color→Multiply→Lerp→Emissive/Opacity/WPO
- **エッジ/リング抽出は大小2枚の同一マスク差分**（実測・独立2チャンネル収束）: マスク生成ロジックを複製しパラメータを一回り大きくした版を作り、大−小でエッジ部分だけ残す。グロー勾配とは別軸
- **RGBを白1pxに差し替え色を分離**: 形状はAlphaマスクのみ、色はVertex/Particle Color側に委ねる分業
- **Sine(Time)正規化は任意パラメータの汎用駆動信号**（実測・4本収束）: Emissive強度に限らずFresnel Exponent・Power指数・回転角・Lerp Alphaのどれにでも接続できる。周期違いの2つのSineを多段Lerpすると単調でない揺らぎになる
- **Mesh Rendererでの垂直配置定石**（実測・独立2チャンネル収束）: Plane等をビルボード代わりに使う場合、Initial Mesh Orientation X=0.25（Rotation Mode=None）で垂直に立つ
- **Mesh+WPO（Spline Thicken Material Function）で稲妻/光の筋を実体メッシュとして造形**: Ribbon・Sprite Pivotずらしとは異なる第三のトレイル表現。⚠Transform Vector(Local→World)をマテリアル側・Local SpaceをNiagara Mesh Renderer側、両方セットしないとSystem回転時にWPO方向がメッシュに追従せず歪む
- **WPO+Lerpによる幾何学的収縮の開閉表現**: World Position−Object Positionを算出しLerp補間、Sphere Mask等を乗算してWPO出力へ。パラメータ0でオブジェクト中心に収縮した「閉じた」状態になる。Opacity/Scaleカーブとは別の第三の開閉手法
- **テクスチャレス形状生成**: 幾何形状マスク（三角形/矩形/円）はノード演算のみで作れる。**Lengthノードへの入力は必ずMax(x,0)でクランプ**（符号消失で中心が誤って明るくなるバグを回避）。`Ceil(UV+0.5)-0.5`でUVタイル中心座標を抽出すればSphere Mask 1個がグリッド全体に自動複製される。Texture Bombing/Four-Way Chaos（組込Material Function）でタイル反復・多層パンの単調さを1関数で崩せる

## Niagara 定型

- **Sprite Alignment/Facing Modeは3点セットで確認**（実測・3本収束・最頻出の罠）: 地面固定エフェクトはCustom+Fixed Alignment（カメラ追従回転防止）／Alignment=Velocityにするなら必ずFacing Mode=Face Cameraを明示（未設定だと粒子がカメラを向かず破綻）／常時特定方向へ固定（垂直な光条等）はCustom+Facing Vector
- **1粒バースト+カーブ駆動の器**: Light/Decal/PostProcess/柱メッシュはBurst1粒。Light+Sprite+Decalの1粒3レンダラーが費用対効果最高。**Return Exec Index×定数**をInitial Mesh Orientationに使うと、スポーン順インデックスがそのまま等間隔回転値になりN方向対称配置が最小実装で作れる
- **層分け**: Sort Order Hintより(a)1エミッタ複数レンダラー+RendererVisibilityタグ(b)ブレンドモード分離。sequencerでの時間軸オフセット層も併用可。同一ロジックのEmitter複製+座標オフセットのみ（Z+100等）でも密度・重心を底上げできる簡易多層化
- **親子連鎖**: Death Event+IDsよりAttributeReader（SpawnParticlesFromOtherEmitter/SampleParticlesFromOtherEmitter）が新推奨形（GPU対応・ID不要）。「当選フラグを親属性に書き→子側でKillParticles」で二次破裂。**Velocity Samplingは既定無効**（有効化+Scale 0〜1ランダムで方向継承・速度ランダム化の中間継承）。Get Quaternion by Indexで兄弟Emitter間のフェーズ切替時の姿勢継承、Component Renderer(種別=Niagara)で完成System丸ごとの部品化も同系統の応用
- **トレイル/光の筋**: SpawnPerUnit+RibbonWidth直指定+Screen facingが最小形。稲妻はCurve Tension+Jitter Position。**Ribbon不使用の軽量代替**（Sprite RendererのDefault Pivot in UV Spaceを先端にずらすのが核心技、詳細手順は[light-streak-niagara.md](videos/CoFmCf4z3X0_light-streak-niagara.md)）。多数スプライトを同時放射させる場合も同じPivot Offset技で中心発生の不自然さを解消できる。⚠UE5.8 PythonはSprite Renderer新規追加不可（実測）
- **ストレッチ**: Size Non-uniform+Velocity Alignment。Scale Sprite SizeのX軸を山型カーブ（増加→減少）にすると静的比率でなく時間駆動の動的ストレッチになる
- **大量イベントFXはNDC**（Niagara Data Channel）: 常駐1システム+BP/C++からWrite。UEFN未対応（配信時点）。**多数対象への個別効果付与（範囲内バリア付与等）はNDCでなくアクター単位ループが基本形**（対象検出はゲームプレイ側、対象1体につき1Systemインスタンスをアタッチスポーン）
- **キャラ付随**: SkeletalMeshLocationをSpawn(表面)/Update(ボーン追従)で使い分け。**表面サンプリング（Triangle/Vertices）で発生源を分散**（実測・独立2チャンネル収束: 単一発生源は不自然になりやすく、Velocity From Point等のOriginをサンプル点群に紐付ける）。全身グローはPartitions+カプセル（実装は「各ボーンに手動でカプセル寸法をマッピングする力技」と公式が明言）。**Niagara非依存の代替**: 全身の状態変化（燃焼/凍結等）はSet Overlay Materialでマスキング/ボーン追従コスト無しに実現可能（局所パーティクルはNiagara、全身色調はOverlay Materialの二層構成）。MeshベースはUser Param Binding経由でNiagara→マテリアル接続
- カーブは全キーAuto、出現はオーバーシュート。テレグラフと常時装飾は別レイヤー
- **画面全体演出はNiagaraと分離**: Radial Blur+Chromatic AberrationはMPC+マテリアルインスタンス1枚で実装可
- **着弾FXはPhysical Material駆動で分岐**: 地形/オブジェクト種別ごとに爆発サイズ・システムを切替。動的オブジェクトへの着弾はSpawnSystemAttached、固定壁面はSpawnSystemAtLocationで使い分け
- **Burst/Loop系の罠**: Loop DelayとLoop Durationは独立指定必須（片方だけだとその範囲でしかスポーンしない）／System Loop TimeはParticle Lifetimeより長く（短いと再スポーンでガタつく）／ループ跨ぎの見た目連続性はEmitter Loop Countを掛け算ソースに使う
- **GPU Distance Field Collision**: デフォルト半径だと床にめり込む→Particle Radius拡大で補正。Align Particles with Collision Planeで着地姿勢を補正
- **動く破片の可視判定は距離条件だけだと誤消失する**: 「固定基準点からの距離」or「初期位置からの移動距離」をOR結合する（飛散する破片で顕著な罠。Crate/GasCanister演出に直結）
- **設計判断の指針**（公式開発者言明）: Blueprint中心構成は性能でなくアクセシビリティのため。ボトルネックは大抵レンダリング側で、ベストプラクティスに従えばシミュレーションコスト自体は問題にならない

## Fluids / Execution State（圧縮継承）

- 気体=グリッド/液体=FLIP、2D Gas=軽量常時/3D Gas=ヒーロー級。Execution State=寿命制御、Inheritanceで差分量産
- **Density Buoyancyは値を上げると流体方向を反転できる**: 既定は密度が軽いほど上昇（炎的挙動）、重さを持たせると下降に反転（溶岩等の環境ハザードに転用）
- Fluid CollisionはActor Tagで選択的に効かせられる（特定タグのメッシュのみ衝突判定、堰き止め対象の限定に使える）
