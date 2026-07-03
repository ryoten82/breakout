# SOURCE: Control Rig Editor in Unreal Engine
URL: https://dev.epicgames.com/documentation/unreal-engine/control-rig-editor-in-unreal-engine?lang=en-US
取得方法: WebFetch（要約モードだが具体的な操作手順まで取得できた良質ソース。ユーザー指定コース「Creating and Modifying Control Rig」に最も近い実質ページ）
取得日: 2026-07-04

---

Unreal Engine 5.8 の Control Rig Editor についての説明。

## 主要なパネルと機能

**ツールバー**: "Compile" ボタンで「リグの変更を保存し実行開始」できる。Rig Hierarchy 内での変更時に必須。"Solve Direction" で異なるソルバーイベントチェーンをプレビュー可能。

**Rig Hierarchy パネル**: Controls・Bones・Nulls を作成・管理するエリア。右クリックメニューから新規作成・削除・複製・リネーム・ミラー処理が可能。

## Rig Graph でのノード操作

Rig Graph ではノードを複数操作できる:

- **Hierarchyパネルからのドラッグドロップ**: 要素をグラフに参照として追加
- **ノード作成**: 右クリックで検索またはコンテキストメニューナビゲーション
- **Function化**: 選択ノードを右クリックして「Collapse Nodes」または「Collapse to Function」を選択し、複数ノードをグループ化

作成された Function は "My Blueprint" パネルの Functions カテゴリからアクセス可能で、大規模グラフの整理や論理の再利用に活用できる。

**Details パネル**: 選択要素（Control・Bone・グラフノード）のプロパティ編集が行える。
