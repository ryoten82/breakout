# 学習ノート — Modular Control Rigs in Unreal Engine（Epic 公式ドキュメント）

- ソース: https://dev.epicgames.com/documentation/unreal-engine/modular-control-rigs-in-unreal-engine?lang=en-US
- 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 学習日: 2026-07-04
- 原典 transcript: [../transcripts/modular-control-rigs.md](../transcripts/modular-control-rigs.md)

> **重要: これは Experimental（実験的）機能である。** 原文冒頭に "an experimental feature for character rigging in Unreal Engine" と明記されている。UE の将来バージョンで API・ワークフローが変わる可能性がある前提で読むこと。

---

## Modular Control Rig とは（Visual Rigging・Module・Connector・Socketの関係）

**Modular Control Rig** は、あらかじめ用意された Control Rig の部品（**Module**）を組み合わせて構築するリグ。原文の定義では「each Module represents a part of the character's body, such as an Arm, Leg, or Spine.」（各 Module がキャラクターの身体パーツ＝腕・脚・背骨などに対応する）。

この Module をビューポート上で組み合わせていく作業を **Visual Rigging** と呼び、**Schematic Overlay** という UI 要素を使って Module 同士を接続する。

3 要素の関係は以下の通り:

- **Module**: 身体パーツ単位の再利用可能なリグ部品
- **Connector**: Module 同士をつなぐ接続点。「need to be resolved to a rig element for the module to operate correctly」（Module が正しく動作するには、Connector がリグの要素に解決＝resolve されている必要がある）
- **Socket**: スケルトン上の接続ポイントで、Connector を resolve する対象。Bone・Control・Null のいずれかになりうる

つまり「Module が Connector を持ち、Connector が Socket に resolve されることで Module 同士・Module とスケルトンが接続される」という構造。

## セットアップ手順

前提条件:
- Skeletal Mesh を用意していること
- Control Rig Modules プラグインを有効化していること（オプションだが推奨と明記）

ワークフロー:
1. Modular Rig アセットを作成する
2. プレビュー用の Mesh を選択する
3. ビューポート上で Module を Socket にドラッグ＆ドロップする
4. 未解決（unresolved）の Connector があれば手動で resolve する

## Module Authoring（カスタムModule作成時の要素）

Module の作者（原文: Module authors）は、既存の Control Rig アセットを変換してカスタム Module を作る際に、以下を定義する:

- **Primary Connector**: Module につき 1 つ。通常は Socket に resolve される
- **Secondary Connectors**: 複数持てる。Bone・Control・Null のいずれにも resolve できる
- **Connector Rules**: 各 Connector がどのヒエラルキー要素に resolve可能かを定義するルール
- **Metadata and Events**: 自動解決（auto-resolution）や Module 間通信をサポートする仕組み

## 技術的な注意点（実行順序・パフォーマンス）

- **実行順序**: Module は root → leaf（根から末端）の順に**逐次実行**され、**単一スレッド**で処理される
- **パフォーマンス**: Modular Control Rig は現状、**inlined Control Rig よりパフォーマンスコストが高い**。ただし原文では「the benefits of ease-of-use and speed of building a character rig」（構築の容易さ・速さのメリット）がこのコストを上回ると見込まれている、という記述がある

## SCRAP BLITZ に活かせる部分

現行の motion-room では Control Rig ベースのモーション制作パイプラインを実運用中であり、Modular Control Rig は Experimental かつ「inlined Control Rig よりパフォーマンスコストが高い」と原文に明記されている。この段階で**現行パイプラインを置き換える提案はしない**。

その上で、将来的な検討候補としてメモしておく価値がある点:

- **Module = 身体パーツ単位の再利用部品**という発想は、SCRAP BLITZ のように複数キャラクター（c01〜c04 等）が存在し、腕・脚・背骨といった共通パーツを持つ構成と相性が良さそうに見える。ただし現状はあくまで「見える」レベルで、実運用への適用検討は Experimental の卒業（正式機能化）後が妥当
- Connector / Socket による resolve の仕組みは、キャラごとに骨格差分がある場合の柔軟な接続に使える可能性がある（※一般知識で補足: プロジェクト側では過去に骨格ミスマッチによる不具合＝TargetSkeleton 違いでの mesh 崩壊を経験したという記録がセッション内メモリにあり、これは原文にはない本セッション固有の背景情報。Connector Rules のような「何が resolve 可能か」を明示するモデルは、その種の不具合の再発防止という観点で将来的に参考になりうる、という筆者の推測）
- ただし単一スレッド・逐次実行という制約は、キャラクター数やリグの複雑さが増すほどパフォーマンス面で不利になりうる点は留意が必要

現時点でのアクションアイテムはなし。将来 UE バージョンでこの機能が正式化された際に再評価する程度の位置づけとする。

## ソースの限界

- 原文はドキュメントの要約であり、UI 操作の詳細（ボタン名・メニュー階層・具体的なスクリーンショット）は含まれていない
- Connector Rules の具体的な記法（どう定義するか）や、Metadata/Events による Module 間通信の具体例は原文に記載がない
- パフォーマンスコストの定量的な数値（何倍遅いか等）は原文に記載がなく、「更に重い」という定性的な記述のみ
- 実際の操作画面・Schematic Overlay の見た目は本ノートには含まれない（文章のみの抽出のため）
