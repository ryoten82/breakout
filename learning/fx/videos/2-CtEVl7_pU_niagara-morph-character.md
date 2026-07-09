# 学習ノート — UE5 Niagara Morph Character（キャラクター間モーフ効果）

- ソース: https://www.youtube.com/watch?v=2-CtEVl7_pU （10:15）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\2-CtEVl7_pU.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: `fx_technique_doctrine.md` の「キャラ付随」節（SkeletalMeshLocation の Spawn/Update 使い分け）と直接関連。本ノートはその発展形（2キャラ間のパーティクル移送によるモーフ演出）

## 概要

Niagara の Empty テンプレートから「あるキャラクターのメッシュ表面から発生したパーティクル群が、時間経過とともに別のキャラクターのメッシュ表面へ移動して再構成される」モーフ演出を作る動画。核心は「パーティクル位置を直接上書きする素朴な補間」ではなく、「引力（Linear Force）と乱流（Curl Noise / Vortex）を時間軸で competing させる」ことで、他の Force モジュールと共存可能な滑らかな移送を実現する設計判断にある。

## 技術詳細

### 1. Emitter 基本設定

- Empty テンプレートから新規作成、名前を "Morph" に変更
- Emitter Properties の **Life Cycle Mode を Self に設定**（字幕上は「left cycle mode to self」と表記されており「Life Cycle Mode」の誤聴写と判断）
- Loop Behavior は最終的に **Once** に修正（動画中盤で「これを直し忘れていた」と言及。Once にすることで Loop Duration の値自体は意味を持たなくなる）
- Spawn Rate: 最初 200,000 と言いかけてすぐ **20,000 に訂正**（パーティクル数が多いため）
- パーティクル数が多いことを理由に **Sim Target = GPU**、**Fixed Bounds を有効化**

### 2. Initialize Particle

- Lifetime（字幕上「left time」= Life time の誤聴写と判断）: 最初 10、後半で **プレビュー用に 5 へ再調整**
- Color: User Parameter の Linear Color を検索して割り当て、デフォルト値は青
- Sprite Size Mode = Random Uniform、範囲 **0.2〜0.5**
- Rotation Mode は未調整（デフォルトの Sprite Material が対称的なため回転させても見た目に差が出ないと明言）

### 3. Skeletal Mesh Location ×2（2キャラ分）

- 同一エミッタに **Skeletal Mesh Location モジュールを2つ**追加し、それぞれに Skeletal Mesh 型の User Parameter（Skeleton Mesh / Skeleton Mesh One）をバインド。これによりレベル上の任意のキャラクターアクターをその User Parameter 経由で選択・差し替え可能にする
- Mesh Sampling Type は **Triangle**、**Surface**（Bones ではない）を選択 → メッシュ表面上のランダム点をサンプリング
- 各モジュールのサンプル結果を **Vector 型のパーティクル属性（SKM Position One / SKM Position Two）に個別保存**（Set Particle Position ではなく、まず属性として保持する点がポイント）
- Preview Mesh を各モジュールに設定（SKM Mannequin を仮キャラクター1体として使用）
- Particle Spawn の最後で `Particle.Position` に **SKM Position One** を代入し、初期スポーン位置をキャラクター1の表面上にする

### 4. 素朴な補間の問題点（動画内で明示的に検証・否定される手法）

- Particle Update 内で `Particle.Position` に対し、Float from Curve（0→1）で駆動した **Lerp(A=SKM Position One, B=SKM Position Two)** を毎フレーム直接代入する方法は「動作はする」が2つの欠点があると説明
  1. **Particle Update 内で位置を直接上書きするため、他の Force モジュール（Curl Noise 等）を追加で組み合わせられない**
  2. FPS が不安定なとき、直接位置代入と Force 系の挙動が競合し **パーティクルが震える（jitter）**
- この問題を実演で見せた上で、次項の「Force ベースの引力」方式に置き換える、という構成

### 5. Force ベースの解決策 — 本ノートの核心

直接位置代入をやめ、**Linear Force モジュールに「目標位置へ向かうベクトル」を Force として与える**方式に切り替える。

- Subtract ノードで `A（目標位置） - B（Particle.Position）` を計算し、目標方向ベクトルを得る
- **A（目標位置）自体もさらに Lerp**: A = Lerp(SKM Position One, SKM Position Two, Alpha)。Alpha は Float from Curve（0→1）で、**Key を 0.5 の位置で値 1 に設定**することで「寿命の半分が経過した時点で目標が完全にキャラクター2側へ切り替わる」という段階的な移送を作る
- 得られた方向ベクトルを **Multiply Vector by Float** で Strength（Float from Curve、Scale Curve で 0〜1 の出力を **500〜1500** にリマップ、Key を寿命終盤側＝0.9 付近に配置）と乗算し、Linear Force モジュールへ供給
- **Curl Noise Force** を追加（乱流でランダムに飛散させる）。Noise Strength も Float from Curve 化し、Offset Curve を **1→0**（＝寿命序盤に強く、終盤にかけて弱まる）に設定。Key の位置を「少し早め」に調整し、寿命終了時に正しい最終位置へ収束するよう帳尻を合わせる
- **Vortex Force** を追加。Curl Noise 用に作った強度カーブをコピー流用。Vortex Axis = (1, 1, 1)、Strength カーブ範囲 **300〜700**
- 最後に **Drag** を追加、係数カーブ **3〜5**

**設計の要点**: Linear Force（目標への引力）の強度カーブは終盤にかけて強くなる一方、Curl Noise / Vortex（乱流）の強度カーブは序盤に強く終盤にかけて弱まる。この**2系統のカーブを逆方向に交差させる**ことで、「序盤は乱流でランダムに飛び散り、終盤は引力に負けて目標キャラクターの形状に収束する」という自然な遷移になる、と説明される（＝どちらの Force が支配的かを毎フレームのカーブ値の大小関係で切り替える設計）。

### 6. レベル上での運用

- レベルに Character 1 / Character 2 の2体を配置し、Niagara System 側の User Parameter（Skeletal Mesh 型）でレベル上のアクターを選択してバインド
- アクターの Scale も個別に調整可能
- 結果、キャラクター1表面のパーティクルが飛散しつつキャラクター2表面へ移送されるモーフ効果が確認される

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の「キャラ付随」節は SkeletalMeshLocation の Spawn(表面)/Update(ボーン追従) という基本パターンのみ収録。以下は未収録で新規:

- **2つの Skeletal Mesh Location モジュールを同一エミッタ内で並行使用し、2キャラクター間のパーティクル移送モーフを構成する**という応用パターン自体
- **「直接位置代入 vs Force ベースの引力」という設計判断の言語化**: 位置を毎フレーム直接上書きする方式は他の Force モジュールと共存できず FPS 不安定時にジッターを起こす、という失敗パターンと、その回避策として Linear Force（目標へのベクトル）に置き換える設計思想は doctrine 未収録
- **時間軸で強度カーブを逆方向に交差させることで「乱流優勢→引力優勢」の遷移を作る**手法（Curl Noise/Vortex の強度を序盤強・終盤弱、Linear Force の強度を序盤弱・終盤強にする対称設計）。doctrine の「グロー勾配」節等にあるカーブ駆動パターンとは異なる「複数 Force の相対的優劣を時間で入れ替える」という新しい軸
- **目標位置そのものを Lerp でキャラクター1→キャラクター2へ段階的に切り替える**（Linear Force の入力ベクトル計算の A 側に Lerp を仕込む）ことで、単純な「開始点→終了点」の直線補間ではなく「途中まではキャラ1に留まろうとする力、以降はキャラ2に向かう力」という非対称な遷移カーブを作る手法

## SCRAP BLITZ UEへの応用メモ

- **キャラクターの変身/形態変化演出への転用が最有力**: 本テクニックはまさに「あるキャラの見た目から別の見た目へパーティクルで移送する」演出そのものであり、METEO や敵キャラの形態変化・進化演出（例: ボスの第2形態移行、パワーアップ時の姿変化）に直接応用できる構成
- SP 技の**変身/覚醒演出**（例: BURST 化演出）にも転用余地: 現在キャラクターの輪郭からパーティクルが飛散し、強化後の姿へ収束していく表現として、既存の DrawDebug 仮実装から Niagara 本実装へ移行する際の候補技法になり得る
- 「乱流優勢→引力優勢」の時間軸交差カーブという設計思想は、モーフに限らず**敵の召喚演出（実体化）**や**撃破時の消滅演出**（引力を逆にして拡散させる）にも応用可能。本ノートの「収束」ロジックを反転させれば「拡散して消える」演出になる
- 2体のキャラクターを User Parameter で自由に差し替え可能な構成のため、汎用 Niagara System として一度実装すれば **METEO と敵キャラなど任意の組み合わせで使い回せる**可能性がある（proto 側にはこの種の演出は存在しないため、UE 側で新規に検討する場合の技術的土台として記録）
- ただし GPU Sim・20,000 パーティクル・Fixed Bounds という設定は据え置きカメラでの高負荷演出向け。SCRAP BLITZ UE は 2.5D 固定カメラで敵/プレイヤーが画面内に収まる規模のため、パーティクル数は実機性能を見ながら大幅に削減する前提で検討する必要がある

## ソースの限界

- 英語自動字幕のみで手動字幕なし。音声認識の誤聴写と思われる箇所が複数あり（「left cycle mode」→ Life Cycle Mode、「left time」→ Life time/Lifetime、と判断して読み替えている）。この読み替え自体が誤っている可能性は残る
- Spawn Rate（20,000）、Lifetime（5 or 10）、各種カーブの数値（0.2〜0.5、500〜1500、300〜700、3〜5、Key 位置 0.5/0.9 等）は音声認識ベースの transcript からの抽出であり、実際の UE 上のノードグラフ画面は視聴していない。実装前提として使う場合は UE 実機で再検証が必要
- Linear Force モジュールの入力ピン名・Subtract ノードの正確な接続順序（どちらが A でどちらが B か）は字幕の説明順序から再構成したものであり、実際のノードグラフのスクリーンショットでの確認はできていない
- 動画後半の「Vortex Force のカーブをコピー」「Drag のカーブ値」など細部の因果関係（なぜその数値か）についての解説は薄く、字幕からは実装手順の列挙以上の設計意図が読み取れない箇所がある
