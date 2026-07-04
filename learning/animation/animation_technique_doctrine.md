# アニメーション・リグ ドクトリン（蒸留版）

公式 doc 3 ページからの横断抽出。**日常作業ではこのファイルだけ読む**（上限 3KB）。
出典・詳細は `videos/` の個別ノート（読むときは Sonnet 委譲）。
motion-room の実運用パイプライン（MCP キー打ち）が正、本 doctrine は背景知識の整理。

## Control Rig Asset 作成（2 方式の使い分け）

1. **SkelMesh 右クリック → Create > Control Rig** — `_CtrlRig` サフィックスで自動生成・骨格自動割当。対象メッシュが確定している通常ルート
2. **Content Browser 手動作成 + Import Hierarchy** — 後から骨格を手動割当。**骨格の向け直し・差し替え検証に使う**（リターゲット破綻・TargetSkeleton 不一致系トラブルの切り分け手段になる）

## Control Rig Editor の要点

- **Rig Hierarchy 変更後は Compile 必須**（保存+実行開始）
- Rig Hierarchy パネル右クリック: 作成・削除・複製・リネーム・**ミラー**（左右対称リグの定型操作候補。⚠仕様詳細は原文に無し）
- Rig Graph: Hierarchy 要素をドラッグ=参照ノード化。ノード群は **Collapse to Function** で再利用可（My Blueprint パネルから呼出。⚠Asset 間共有可否は未確認）
- Solve Direction = ソルバーイベントチェーンのプレビュー切替（詳細不明・存在だけ把握）

## 全体マップ（公式 7 分類）

Animation Editors / **Animation Blueprints**（挙動ロジック・blending）/ Animation Assets / Live Link（外部 DCC ストリーミング）/ Debug&Optimization / Workflow Guides / Shortcuts

## Modular Control Rig（⚠Experimental・導入しない）

- Module（腕/脚/背骨等の部品）+ Connector（接続点、resolve 必須）+ Socket（Bone/Control/Null）で Visual Rigging
- **inlined Control Rig より重い**（root→leaf 逐次・単一スレッド）
- 判断: 現行パイプラインは置換しない。正式機能化後に再評価。Connector Rules の「resolve 可能対象の明示」モデルは骨格ミスマッチ不具合の再発防止観点で将来参考になりうる、という程度

## 運用

- 新規キャラ追加は方式 1、骨格不整合の調査・共有骨格の使い回しは方式 2 の Import Hierarchy、が判断の起点
- 複数キャラ共通のリグロジックが出てきたら Function 化を検討（共有可否の実地確認が先）
