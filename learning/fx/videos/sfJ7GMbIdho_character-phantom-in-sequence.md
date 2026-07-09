# 学習ノート — UE5 Character Phantom in Sequence

- ソース: https://www.youtube.com/watch?v=sfJ7GMbIdho （7:34）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（`en-orig`、手動字幕なし。`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\sub\sfJ7GMbIdho.en-orig.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: 動画冒頭で「前回動画で Phantom（残像）トレイルエフェクトを作った」と言及されるが、そのシリーズ前編の URL は本動画内で特定できず未収録。トレイル/残像系の既存ノートとしては [ZulJMtoBHq0_niagara-dash-vfx.md](ZulJMtoBHq0_niagara-dash-vfx.md)（Niagara メッシュ回転式ダッシュ残像）があるが、技術領域は異なる（後述）

## 概要

前編で作った「Phantom（残像）トレイルエフェクト」は Blueprint 駆動（`Get Player Character` 依存）だったため **Sequencer（シーケンサー）内では動作しない**、という制約を解決する短編。Niagara のノード技術そのものではなく、**Blueprint ベースの VFX を Sequencer 上のシネマティック演出として再利用可能にする配線パターン**が主題。Niagara 側は「Trail と Spark（Sparkle）マテリアルで特筆すべき点はない」と明言され、動画の力点は完全に Blueprint/Sequencer 側の統合にある。

## 技術詳細

### 背景（前編からの引き継ぎ、簡略）

- Phantom エフェクトは「一定間隔でキャラクターの現在のアニメーションポーズをスタティックメッシュ的にスポーンする」方式（0.5 秒ごとに Set Timer by Event でポーズを複製し Pose 用マテリアルを設定、という説明のみで前編の詳細ノードグラフは本動画に含まれない）
- Niagara 側は Trail + Sparkle の 2 マテリアル構成とだけ触れられ、ノードの中身説明は無し

### Sequencer 対応化の核心課題

- 通常の Phantom 用 Blueprint は `Get Player Character` でプレイヤーを取得する設計だが、**Sequencer からトリガーする文脈ではこのノードが機能しない**（Sequencer 再生はゲームプレイ実行フローの外側にあるため、という前提が暗黙にある）
- 解決策: `Get Player Character` への依存を排除し、**対象キャラクターを明示的な参照変数として外部から差し込む**設計に変更する

### Blueprint 構成（2 つの Blueprint に分離）

1. **BP_ShadowUseSequence**（元の Phantom 用 Blueprint を複製・改修）
   - `Get Player Character` の代わりに、型 `Skeletal Mesh Actor` の変数を新規追加、変数名は「Character」にリネーム、**Instance Editable** に設定
   - この Character 変数から Skeletal Mesh Component を取得し、既存のポーズ複製ロジックへ接続し直す（ロジック本体は変更不要、参照元だけ差し替え）
   - Phantom スポーンを開始する Custom Event（字幕上「IEX」※推定・正式名称不明）を用意

2. **BP_Call**（新規・Sequencer からのトリガー役）
   - Character 変数（Skeletal Mesh Actor 型）を Instance Editable で保持し、レベル配置後にディテールパネルで対象キャラクターを選択する運用
   - Custom Event「Call」: Set Timer by Event（Looping ON、Time=0.5秒）で BP_ShadowUseSequence の Phantom スポーン用イベントを定期発火。Spawn Actor from Class（Class=BP_ShadowUseSequence、Spawn Transform=Character の World Transform）でシャドウアクターを生成し、生成直後に Character 変数を BP_Call 自身の Character 参照でセットする（＝各シャドウが常に正しい対象のポーズを参照できるようにする配線）
   - Custom Event「End」: Clear Timer でループを停止（Phantom スポーンの終了トリガー）

### Sequencer 側の配線

1. キャラクター（動画内ではサードパーソンテンプレートのキャラ）をシーケンスに追加し、カメラ・アニメーショントラック（Third Person Run、後述の理由で Walk に変更）・**位置トラック**（開始位置キー＋終了位置キーの2点でパス移動）を設定
2. **BP_Call をアクタートラックとして追加し、Event（イベント）トラックで「Call」と「End」の2つの Custom Event 呼び出しキーを配置**: 開始位置に「Call」（Phantom スポーン開始）、終了位置に「End」（スポーン停止）。「Phantom を出したい区間は Call、出したくない区間は End」という単純な ON/OFF 制御
3. **Niagara コンポーネントもシーケンスに追加し、Parameter（User Parameter）トラックでトレイルの重み（Weight）をキーフレーム制御**: 使用したい区間の開始・終了で Weight=1、使わない区間は Weight=0 にする、という同様の ON/OFF パターンをパラメータトラックで実現

### トラブルシューティング（実演内で発生した実例）

- 初回再生時、Phantom が発火しなかった。原因は**シーケンサーのイベントトリガーのタイミング**で、Event トラックのキーの Trigger Time を手動で `1`（フレーム単位※推定）にずらすことで解決したと説明。「Blueprint を Sequencer 内で使う際、キーのタイミングを手動微調整しないとトリガーが正しく発火しないことがある」と一般的な注意として言及
- アニメーションは当初 Run を使っていたが、移動速度に対してエフェクトの見え方を確認しやすくするため **Walk に変更**（実演上の調整であり技術的必然ではない）

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` は Niagara のノード/マテリアル技法が中心で、**Blueprint 駆動 VFX を Sequencer で制御する配線パターン自体は未収録の別カテゴリ**:

- **`Get Player Character` 依存の VFX Blueprint を、明示的な Instance Editable な Actor 参照変数に置き換えることで Sequencer 文脈に対応させる**という汎用パターン。Sequencer は通常のゲームプレイ実行フロー外で走るため、プレイヤー取得ノードに依存する既存 VFX Blueprint を移植する際に転用できる考え方
- **トリガー役 Blueprint（BP_Call）とエフェクト本体 Blueprint（BP_ShadowUseSequence）を分離し、Sequencer の Event トラックからは Custom Event の Call/End 2 点だけを叩く**という疎結合設計。Sequencer 側は「いつ開始/停止するか」だけを制御し、エフェクトの内部実装（ポーズ複製ロジック等）には触れない
- **Niagara Parameter トラック（User Parameter の Weight）でエフェクトの有効/無効区間をシーケンス上でキーフレーム制御する**手法。ドクトリンの Niagara 節にはユーザーパラメータのランタイム外部化パターン（Dynamic Material Parameter・Erosion 定型）はあるが、**Sequencer のパラメータトラックから直接ドライブする**運用は未収録
- **Sequencer の Event トラックのトリガータイミングが不安定でキー位置の手動調整が必要になる場合がある**という実務上の落とし穴情報（ノード技術ではなく運用上の注意点として新規）

## SCRAP BLITZ UEへの応用メモ

- SCRAP BLITZ UE は 2.5D アクションでゲームプレイ中心のため、本動画の主眼（シネマティック Sequencer 演出）がそのまま刺さる場面は限定的（ボス登場ムービー、必殺技演出用のカットシーンがあれば該当）だが、**「ゲームプレイ用 VFX Blueprint を Sequencer 文脈に対応させる設計パターン」自体は転用価値がある**: METEO の SP 技演出などを将来 Sequencer ベースの専用カットシーンとして作る場合、既存の Niagara/GA 側エフェクトがプレイヤー参照に依存していると同様の壁にぶつかる。「対象を明示的な Instance Editable 参照に切り替える」「トリガー役とエフェクト本体を分離する」という配線方針は流用できる
- 既存の [ZulJMtoBHq0_niagara-dash-vfx.md](ZulJMtoBHq0_niagara-dash-vfx.md)（メッシュ回転式の残像/風切りエフェクト）とは**残像の実現方式が根本的に異なる**点に注意: dash-vfx はメッシュ+マテリアルによる汎用トレイル、本動画の Phantom は**キャラクターの実際のアニメーションポーズを一定間隔で複製してスポーンする「残像=過去の自分の姿そのもの」方式**（ダブル・ゴースト表現）。ダッシュ/回避の風切り演出には dash-vfx 方式が軽量で適しているが、**「必殺技の予備動作を連続した残像姿で見せる」「ボスの分身攻撃」のような"キャラクター形状そのものを複製する"演出**が必要になった場合はこちらの方式（ポーズ複製+タイマー駆動スポーン）が候補になる。ただし本ノートには前編のポーズ複製ロジックの具体的なノード実装が含まれておらず、実装には前編相当の調査が別途必要
- Sequencer を使わない通常プレイ中の残像であれば、GAS の Ability 内から Set Timer by Event 相当（UE の `SetTimerByFunction` / Ability Task）でポーズ複製をキックし、BP_Call/BP_ShadowUseSequence のような分離構成をそのまま GA 内のロジックに落とし込める可能性がある

## ソースの限界

- 英語自動字幕のみで手動字幕なし。特に Custom Event 名（「IEX」）、Trigger Time の単位（フレーム/秒不明、値「1」）、変数型名（「SK to MH actor」＝ Skeletal Mesh Actor と解釈）は音声認識のブレを含む可能性があり「※推定」と明記した
- 前編（Phantom エフェクト本体の作成方法）の動画は未特定・未視聴のため、ポーズ複製ロジックやマテリアル設定の具体的なノード構成は本ノートに含まれない。前編相当の情報が必要な場合は別途調査が必要
- 実際のノードグラフ・Sequencer 画面は視聴しておらず、transcript ベースの要約のみ。ノード間の正確な接続順序、変数のデフォルト値、Sequencer トラックの正確な階層構造は音声説明からの推定を含む
- 動画自体が「うまくいかなかった箇所をその場で修正する」実演形式のため、最終的に安定動作する構成の全体像が体系的に整理されて語られていない（試行錯誤の過程がそのまま字幕になっている）
