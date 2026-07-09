# 学習ノート — UE5 Lava&Magma Flow VFX - Tutorial（Alex Huang）

- ソース: https://www.youtube.com/watch?v=BJjNWKNptKc （7:09、投稿 2026-06-03）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし。`yt-dlp --list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\BJjNWKNptKc_transcript.txt`（ローカル一時ファイル、恒久パスではない。dedup 済みテキスト）
- 関連ノート: [niagara-fluids.md](niagara-fluids.md)（グリッド/FLIP の概念・5 種シミュレータ比較。本ノートはその「3D Gas」を使った具体的な作例）
- **タイトルと中身の関係の注記**: タイトルの "Flow VFX" は UV パンニング等のマテリアル手法を連想させるが、実際は**マテリアルのフローマップではなく Niagara Fluids（Grid3D Gas シミュレーション）による物理ベースの流動表現**。手法カテゴリが想起と異なる点に注意

## 概要（章立てなし・7 分の実演のみ）

Niagara Fluids プラグインの Grid3D Gas テンプレートを流用し、キャラクター/スタティックメッシュの表面から発生して重力方向に流れ落ち、タグ付きメッシュに衝突すると堰き止められる溶岩エフェクトを作る。既存の「炎」テンプレートを土台に、少数のパラメータ変更だけで「上昇する火」から「下降する溶岩」へ性質を反転させるのが核。

## 技術詳細

### セットアップ

- プラグイン「Niagara Fluids」を有効化
- 新規 Niagara System を「Template or behavior example」から作成し、フルードテンプレート群の中から **Grid3D Gas Simple Particle Source** を選択（炎に見えるプリセット）

### 発生源をスケルタルメッシュ表面に変更

- Particle Source Emitter の Particle Update ステージで、発生位置を「球」から **Skeletal Mesh Location** モジュールに差し替え、対象メッシュを選択
- デフォルトはボーン位置サンプリング。**Mesh Sampling Type を Triangle または Vertices に変更**するとメッシュ表面（ボーンでなく面）から発生するようになる
- Velocity を Z 方向 +50 に設定、World Space Size を 800 に拡大（発生ボリュームのスケール）
- Fluid Source Attributes の Radius を 1 に（粒が小さく見える場合の対処）
- グリッド解像度は下げても見た目への影響が小さく、パフォーマンス確保のため下げる運用

### Grid3D Gas マスターエミッタの調整（全モジュールでなく要所のみ）

| モジュール | パラメータ | 値 | 役割 |
|---|---|---|---|
| Source | Density Scale | 50 | 密度変化量 |
| Source | Temperature Scale | 25 | 温度変化量（燃焼時間に相当） |
| Source | Comp Mode（両方） | Max | シミュレーション delta time を自動加算させない（フレームレート依存の蓄積を防ぐ） |
| Source | Velocity Scale Change | 2（やや低め） | 基本形状の勢い |
| Source | Velocity Radius Scale | 1 | 同上 |
| Force | Vorticity | 5 | 渦・乱流感 |
| Force | Vorticity Velocity Falloff | 1 | 渦の減衰 |
| Collision | Actor Tag | 例: `1` | このタグを持つメッシュのみ流体と衝突判定 |
| Render | Density Range | 0.3〜1 | 粒を明るく見せる |
| Render | Temperature Mapping | Black Body → **Curve** に切替、カーブ終端をピンク系色に | 既定の火の色（黒体放射）でなく溶岩色を作る |
| Render | Color Gain | 0.5 | 発色量 |
| Simulation | **Density Buoyancy** | **0.5** | ※後述、最重要パラメータ |
| Simulation | Dispersion Rate | 0.1 | 拡散速度 |
| Simulation | Dissipation Rate / Subtraction Amount | 1 | 消滅速度・黒化速度 |
| Simulation | Attribute Resolution Multiplier | 2 | 属性解像度 |

- **Density Buoyancy がこの手法の核心**: Gas Fluid の浮力は本来「密度が軽いものほど上昇する」という炎的挙動がデフォルト。ここでは密度に「重さ」を持たせ、浮力の向きを下向きに効かせることで、素のテンプレートの「上昇する炎」を「重力で流れ落ちる溶岩」に反転させている。値を上げるほど下方向への効果が強くなる、との説明
- Collision は **Actor Tag ベースの選択的衝突**: レベル内の 2 つのスタティックメッシュ（球＝タグなし、コーン＝タグあり）で比較実演。タグなしは流体がすり抜け、タグを付けると堰き止める。「衝突させたいメッシュにだけ個別にタグを付ける」運用

### ループ制御・デバッグ表示

- 常時ループでなく単発演出にしたい場合: Source Emitter の **Loop Duration Mode を Fixed** にし、任意の Spawn Time（例: 5 秒）を設定
- **Draw Bounds をオフ**にすると実行時のバウンディングボックス表示を消せる

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の「Fluids / Execution State（圧縮継承）」節は「気体=グリッド/液体=FLIP、2D Gas=軽量常時/3D Gas=ヒーロー級」という概念レベルの要約に留まり、Grid3D Gas の具体的なパラメータ運用は未収録。姉妹ノート [niagara-fluids.md](niagara-fluids.md) もシミュレータ比較の概念止まりで実装例なし。本動画は両者を補完する**Grid3D Gas Simple Particle Source テンプレートを使った作例一本**を提供する:

- **Density Buoyancy による流体方向の反転**という汎用技法。炎テンプレートの「上昇」をそのまま「下降流動」に転用できる、と分かる具体例は既存ノートになし
- **Skeletal Mesh Location の Mesh Sampling Type（Triangle/Vertices vs Bone Location）**: doctrine の「キャラ付随」節は SkeletalMeshLocation を Spawn/Update で使い分ける旨は書いてあるが、発生表面をボーンでなく面/頂点サンプリングに切り替えるという設定項目までは踏み込んでいない。本動画はその欠落を埋める
- **Actor Tag ベースの選択的コリジョン**: 「このタグを持つメッシュだけ流体に衝突判定を持たせる」という運用は、doctrine の着弾 FX 節（Physical Material 駆動の分岐）とは別系統の、Fluids 特有の衝突制御パターンとして新規
- Comp Mode=Max（delta time 自動加算の抑制）は Gas Fluid 特有のフレームレート非依存化テクニックで、他の doctrine 節（Niagara 定型のフレームレート非依存化＝主に Curve/Velocity Alignment 系）とは別軸

## SCRAP BLITZ UE への応用メモ

- 本プロジェクトは 2.5D ボス戦アクションで環境ギミック・ボス演出の余地がある。Grid3D Gas は「ヒーロー級」コストとdoctrineに明記されている通り重量級のため、**常時ループの背景装飾には不向き**。用途は以下のように「一時的・単発・ボス専用」に絞るのが現実的:
  - **ボス撃破/フェーズ移行演出**でのボス躯体からの溶岩流出（本動画の Skeletal Mesh Location + Triangle/Vertices サンプリングがそのまま転用可能）
  - **床ギミックの溶岩流下**（斜面に沿って流れ落ちる床ハザード）に Density Buoyancy 反転技法を使い、既存の DrawDebug 仮実装から Niagara 本番演出への差替え候補に加える
  - **Actor Tag ベースの選択衝突**は、ボスステージ内の一部の足場だけを溶岩の堰き止め対象にする、といった演出設計（プレイヤーの避難経路演出）に直結して使える
- 単発演出用途（撃破時等）では Loop Duration Mode=Fixed + Spawn Time の組み合わせがそのままボス死亡演出の 3 フェーズ（freeze→explode→ring、CLAUDE.md 記載）の explode 相当区間に差し込める長さ調整の型として参考になる
- ただし本動画は「レベル上の据え置きデモ」であり、フレームごとの高速移動を伴う 2.5D アクション中でのパフォーマンス実測はされていない。**ボス演出に採用する場合は実機で FPS 影響を検証すること**（doctrine の Lightweight/Stateless 優先方針とは別枠＝Gas Fluid は Stateful 前提の技術であることに留意）

## ソースの限界

- 英語自動字幕のみで手動字幕なし。パラメータ名・数値は字幕上明瞭に発音されており誤認識は少なかったが、「World Space Size」等の UI 上の正式名称は自動認識の音声書き起こしに依存しており、実際の UI ラベルと完全一致するかは未確認（画面を目視していないため）
- 実際のノードグラフ・パラメータパネルの画面は視聴しておらず、transcript ベースの要約。値の入力欄がスカラーかベクターか等の UI 詳細は確認できていない
- Density Buoyancy が具体的にどの計算式で「重さ」を表現しているか（密度と浮力の内部計算ロジック）までは動画内で説明されておらず、本ノートも「浮力方向が反転する」という観察結果の記述に留まる
- 7 分の短尺チュートリアルで、Grid3D Gas の全モジュール・全パラメータの網羅的解説ではなく「触った箇所だけ」を追った実演。触れられなかったモジュール（例: Render の他の設定、Collision の詳細設定）は本ノートにも含まれない
