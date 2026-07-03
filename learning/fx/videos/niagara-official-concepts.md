# 学習ノート — Niagara 公式ドキュメント概念編（Overview + System/Emitter/Module Reference 統合）

- ソース1: [Overview of Niagara Effects for Unreal Engine](https://dev.epicgames.com/documentation/unreal-engine/overview-of-niagara-effects-for-unreal-engine)
- ソース2: [System and Emitter Module Reference for Niagara Effects in Unreal Engine](https://dev.epicgames.com/documentation/en-us/unreal-engine/system-and-emitter-module-reference-for-niagara-effects-in-unreal-engine)
- 学習日: 2026-07-04 / 抽出: WebFetch（公式doc） → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/niagara-overview.md](../transcripts/niagara-overview.md) / [../transcripts/niagara-system-emitter-module-reference.md](../transcripts/niagara-system-emitter-module-reference.md)
- 既存ノート: [hnUQiwJweeg_niagara-intro.md](hnUQiwJweeg_niagara-intro.md)（日本語チュートリアル動画・5ステージ実践編）との対応関係整理を主眼とする

---

## Niagara の中核概念（System/Emitter/Module/Parameter）と既存ノートとの対応関係

公式ドキュメントは既存ノート（動画実践編）で触れた要素を、より抽象化した語彙で定義している。対応関係は以下の通り。

| 公式ドキュメントの定義 | 既存ノート（動画）での呼称・扱い | 対応関係の補足 |
|---|---|---|
| **System** = 必要な要素すべてを保持するコンテナ。system-level behaviors が全体に適用される | 「一番外側の器。複数の Emitter を束ねる」 | 同一概念。動画では「空の System を作りゼロから Emitter を組む」という最小構成の実践だった |
| **Emitter** = パーティクルを生成し、誕生・経年・見た目・挙動を Emitter Spawn / Emitter Update / Particle Spawn / Particle Update / Event Handler / Render という組織化されたスタックのグループを通じて制御する | 「パーティクルの『見た目や動作』そのものを制御する単位」＋5ステージの実践 | ほぼ同一。ただし公式は **Event Handler グループ**を明示しており、動画の「5大ステージ」には Event Handler が含まれていなかった（後述） |
| **Module** = 上から下へ順次処理される基本ビルディングブロック。HLSLでデータに数学的操作を行うが、グラフノードでビジュアルに構築可能。既存モジュールの検査・コピーが可能 | 「各ステージのグループに追加する個別機能ブロック（Spawn Rate, Initialize Particle, Particle State, Add Velocity など）」 | 同一概念。動画は実例（具体的なモジュール名）を提示、公式は抽象定義（HLSL・上から下への順次処理という実行モデル）を提示 |
| **Parameters** = シミュレーション内のデータを抽象化する4種類（Primitive/数値データ、Enum/固定名称値、Struct/PrimitiveとEnumの結合、Data Interfaces/外部データを提供する関数） | 「各モジュール内で調整する値（色・速度・サイズ等）」 | 動画は「値」としてのみ扱い、4分類には触れていない。**Data Interfaces がパラメータの一種として定義される**のは既存ノートに無い新規情報（詳細は後述の高度な概念で扱う） |

**新規に明確化された点**: 「**A module is an item, but an item is not a module**」（モジュールはユーザーが作成・編集可能なアセット、アイテムはシステムやエミッター内のユーザーが作成不可な要素）という区別。既存ノートでは Module と「ステージ内の要素」を同一視していたが、公式は両者を明確に区別している。これは MCP でモジュール一覧を扱う際、「編集可能なモジュール」と「編集不可のビルトイン要素」を混同しないための語彙整理として有用。

---

## Stack実行モデル（System→Emitter→Particle→Renderグループ、既存ノートの5ステージとの対応関係を整理）

公式ドキュメントは実行順序を **System → Emitter → Particle → Render の4グループ** として定義している。既存ノートの「5大ステージ」との対応は以下の通り。

| 公式の実行グループ（上から下へ実行） | 役割 | 既存ノートの5ステージとの対応 |
|---|---|---|
| **System グループ** | すべてのエミッターに共有される動作を処理 | 既存ノートに明示的な対応なし（動画は単一Emitterの最小構成だったため System レベルの共有動作は扱っていない）※新規情報 |
| **Emitter グループ** | 各ユニークなエミッターごとに実行 | Emitter Spawn + Emitter Update が該当（動画では「Emitter が最初に起動したとき一度だけ」「動作している間毎フレーム」という2段階に分けていたが、公式の4グループ定義ではこの2段階は明示されていない） |
| **Particle グループ** | 個別エミッター内の各パーティクルごとに実行 | Particle Spawn + Particle Update が該当（同様に動画は「生成ごとに一度」「毎フレーム」の2段階） |
| **Render グループ** | シミュレーション済みパーティクルデータの画面描画方法を定義 | Renderer ステージと同一 |

**整理すると**: 公式の4グループ（System/Emitter/Particle/Render）は「どのレベルで実行されるか」の分類軸であり、既存ノートの5ステージ（Emitter Spawn/Update, Particle Spawn/Update, Renderer）は「Spawn時か Update時か」という**もう一つ別の軸**を組み合わせたもの。つまり実際のスタックは「Emitterグループ × {Spawn, Update}」「Particleグループ × {Spawn, Update}」という2軸のマトリクスになっており、公式ソースの4グループ定義だけでは Spawn/Update の区分けは読み取れない（既存ノートの実践的知見が補完している形）。

なお、既存ノートの5ステージには **Event Handler グループが含まれていなかった**。Overview 側では Emitter の構成要素として「Emitter Spawn, Emitter Update, Particle Spawn, Particle Update, **Event Handler**, Render」という6グループが明記されており、これは既存ノートに無い新規情報（Event Handler の詳細は後述）。

---

## Execution State（Active/Inactive/InactiveClear/Complete）— 既存ノートに無い新規情報

System and Emitter Module Reference から得られた完全な新規情報。既存ノート（動画）はこの概念に一切触れていない。

システムとエミッターは以下の4つの Execution State を持つ:

| State | 内容 |
|---|---|
| **Active** | シミュレーション実行、スポーン許可 |
| **Inactive** | シミュレーション実行、スポーン禁止 |
| **InactiveClear** | パーティクル破棄後、Inactive状態へ移行 |
| **Complete** | シミュレーション非実行、非描画 |

原文からはこの4状態の定義以上の詳細（状態遷移のトリガー条件、どのモジュールでこれを制御するか等）は取得できていない。状態遷移の具体的な実装方法（例: どのAPI/ノードで Complete に遷移させるか）はソースの限界として後述する。

---

## 高度な概念（Inheritance/Dynamic Inputs/Micro Expressions/Events/Data Interfaces）

いずれも Overview ソースのみに記載されており、既存ノートには対応する記述がない完全新規パート。

- **Inheritance（継承）**: 階層的な組織化を通じてアセットの再利用を実現する。子エミッターは親の値をオーバーライドできる。
- **Dynamic Inputs（動的入力）**: パラメータマップではなく値の型に対して作用することで拡張性を提供し、モジュールの肥大化を減らす。
- **Micro Expressions（マイクロ式）**: インライン値を小規模な一回限りの機能のためのHLSLスニペットに変換する。
- **Events（イベント）**: 構造化されたデータペイロードを通じて、パーティクル・エミッター・システム間の通信を促進する。
- **Data Interfaces（データインターフェース）**: メッシュ情報・音声・外部ソースを含む任意のデータへのアクセスを可能にする。
- **Houdini 統合**: CSV形式で計算済みデータをインポートし、パーティクルのスポーンや位置決めに使用できる。

原文はいずれも1〜2文の簡潔な定義のみで、具体的な設定手順やUIの操作方法までは踏み込んでいない。

---

## SCRAP BLITZ に活かせる部分

戦闘FX（ヒット・爆発・延焼・粉塵等）をMCP経由でNiagara構築する際に直結するポイント。

### Execution State を FX の寿命管理に使う

既存ノートで「Lifetime を設定しただけでは消えない、Particle State モジュールが Particle Update に必要」という罠を記録済みだが、これは**パーティクル個々の寿命**の話だった。Execution State はその一段上、**エミッター/システム全体の寿命**を制御する仕組みとして使える可能性がある。

- **Complete 状態**（シミュレーション非実行・非描画）は、ヒットエフェクトや爆発のような一過性FXが「役目を終えた後にどう片付けられるか」の受け皿になりうる。既存ノートの Particle State は「個々のパーティクルが消える」仕組みだが、Complete はその**System/Emitter自体の完全停止**に相当すると考えられる（※一般知識で補足: 一般にNiagaraコンポーネントは全パーティクルの消滅後、Loop設定によって自動的に破棄されるか再スポーンするかが決まる仕様のはず。原文からはこの自動遷移条件までは確認できていない）
- **InactiveClear**（パーティクル破棄後にInactiveへ移行）は、「攻撃がキャンセルされた瞬間にエフェクトを即座に打ち切りたい」ケース（例: FLAME UPPER のキャンセル即時化のような、SP技の中断でエフェクトも巻き戻したい場面）で、既存パーティクルは破棄しつつ再スポーンは止める、という制御に対応しそうな挙動に見える
- 現状の実装（HitFlashAmount/HitFlashColor等の発光インフラや、ヒットエフェクトの実装）でエフェクトの「消し方」を明示的に制御していない箇所があれば、Active→Inactive/Complete への遷移を使って「エフェクトの寿命をコード側から明示的に断ち切る」設計に応用できる余地がある。ただし**状態遷移をどのAPI/BPノード/C++関数で行うかは原文に情報が無い**ため、実装時は別途UE公式リファレンス（Niagara Component の SetPaused/Deactivate/Complete 系関数など）を確認する必要がある

### Inheritance と既存の「バリエーション量産」ドクトリンの接続

`project_scrapblitz_derived_attack_pattern.md`（派生攻撃量産パターン）のドクトリンは攻撃・技のバリエーション量産を扱っているが、Niagara の **Inheritance**（親エミッターの値を子エミッターがオーバーライドする仕組み）は、FXレベルで同じ発想を適用できる可能性がある。

- 例: 「爆発FX」の基本エミッターを親として作り、火属性版・氷結版・粉塵版といった属性差分（`project_scrapblitz_element_doctrine.md` の4属性ドクトリン）を子エミッターのオーバーライドだけで量産する、という設計と相性が良さそうに見える
- 既存の「バリエーション量産」ドクトリンがコード/デザイナー側の攻撃パターン量産を指すのに対し、Inheritance はアセット（Niagara System）側の量産手段であり、**両者は層が異なる**（攻撃ロジックのバリエーションとFXアセットのバリエーションは別々に量産され、後から組み合わされる）と整理するのが妥当に見える
- ただし原文は「子エミッターは親の値をオーバーライドできる」という1行の定義のみで、具体的な継承階層の作り方（Emitter Inheritance の設定手順、どこまで継承・オーバーライド可能か）は記載が無い。実装時は別途詳細ドキュメントの確認が必要

### モジュール/アイテムの区別とMCP操作

「A module is an item, but an item is not a module」という区別は、MCP経由でNiagaraを操作する際、既存のビルトイン要素（アイテム）とユーザーが自由に追加・編集できるモジュールを取り違えないための注意点として実務に直結する。

---

## ソースの限界

- Overview ソースは各高度な概念（Inheritance/Dynamic Inputs/Micro Expressions/Events/Data Interfaces/Houdini統合）について1〜2文の定義のみで、具体的な設定手順・UIの操作方法・実例には一切触れていない。実装時は別途詳細ページの確認が必要
- System and Emitter Module Reference は「要約モードでの取得」と明記されており、Execution State の4分類は取得できたが、**状態遷移のトリガー条件**（何をすると Active から Complete に移るのか）、**どのモジュール/ノード/APIで制御するか**は原文に記載が無い
- 同ソースは Overview 側で明記されていた Event Handler グループの実行順序上の位置づけ（System/Emitter/Particle/Renderの4グループの中でどこに挟まるか）を明示していない
- 両ソースとも英語UI上の正式なラベル名・メニュー階層の実例が無いため、MCP実装時に実際のノード名・関数名と突き合わせる作業が別途必要
