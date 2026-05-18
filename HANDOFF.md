# 背景部屋 — 引継ぎ（2026-05-18 改：実装層拡張）

## 最新セッション（2026-05-18 改）：スコープ拡張

### 何が変わったか
本部屋を **「議論部屋」から「議論 + データ + 実装の三層部屋」に拡張**。
ユーザー意向：「背景仕様設定から制作、実装までを行うもの」。

### 追加された層
- **データ層**：`stages/stageNN/` ディレクトリ（議論が固まったステージの確定データ置き場）
- **実装層**：`gameproject02/src/stages/`, `gameproject02/src/props/` ディレクトリ（Three.js 実装）

### 分担方針
- **stage-room**：ステージ・背景・装飾・ギミック・配置データに専従
- **zealous-hertz worktree**：Phase 3 ゲームプレイ本流（敵 AI 本体・キャラ調整・必殺技・ゴアクリ等）
- 衝突回避は ROOM_README.md の「衝突回避ルール」参照

---

## 初回セッション（2026-05-18・前段）：部屋の立ち上げ

### 経緯
1. **Phase 2.4 完了**（実装部屋側で 2026-05-18 達成）。Phase 3 入りで「敵 AI・ボス・ステージ実装」が視野に
2. 仕様相談部屋で「仮ステージ構想・配置」の話を始めたが、扱う範囲が広い（レイアウト・ギミック・敵配置・ビジュアル・BGM・世界観）ため**専用部屋を分離**
3. 最初は spec-room の `discussions/stage-layout-room.md` に骨格作成
4. ユーザー希望で「左ペインの『部屋』グループに新規部屋として並べたい」→ **新 worktree（claude/stage-room）として独立**
5. 本日（2026-05-18 後段）に「議論だけでなく制作・実装まで」と拡張要望 → 本ハンドオフ更新

### 部屋の役割（再掲）
**「何を置くか」**＝個別ステージのレイアウト・敵配置・ギミック・楽しさの言語化、および**その実装**を扱う。
（「どう作るか」「何を置けるか」は spec-room の別議論ファイルに分離済み）

---

## 次セッションの推奨スタート

ユーザーに以下から選んでもらう：

- **A**：Stage 1 マップレイアウト議論を進める（議論層・既存路線）
  - `stage-layout-room.md` の Stage 1 セクションを詰める
  - セクション分割の妥当性検証 / 中ボス枠 / 楽しさの言語化
- **B**：`buildBackWallPillars()` を `props/factory/back-wall.js` に移管する（実装層・第一手）
  - 既存 index.html 内インライン装飾の module 化第一弾
  - zealous-hertz の編集状況を確認してから着手
- **C**：ウェーブデータ形式を決める（データ層）
  - `stages/stage01/waves.js` の構造設計（敵種別 / 出現位置 / トリガー）

---

## 現状の `stage-layout-room.md` の中身

骨格のみ作成済み・中身はほぼ未記入：
- 前提（確定済み土台）：ビジュアル方針・§16 ボス構成・北極星
- 設計の柱（演出弧 / 手触りファースト / CR / 難易度緩和 / ランダム性限定）
- **Stage 1（CRUSHER・廃工場）**：コンセプト・マップ・ギミック候補・ウェーブ・楽しさ言語化 — すべて叩き台のみ
- **Stage 2（SNIPER・距離戦）**：未着手レベル
- **Stage 3（OVERLORD・最終）**：未着手レベル

---

## 関連 memory

- `project_scrapblitz.md`（プロジェクト全体像）
- `project_scrapblitz_visual_doctrine.md`（廃工場テーマ・配色・床/壁意匠・`buildBackWallPillars()` の場所）
- `project_scrapblitz_stage_room.md`（本部屋のメタ情報・最新スコープ）
- `project_scrapblitz_combo_doctrine.md`（コンボ思想・ステージ設計の制約）
- `project_scrapblitz_currency.md`（CR 一本化）
- `project_scrapblitz_accessibility.md`（イージーモード NG・ゲーム内要素で緩和）
- `setup_worktree_workflow.md`（main 経由マージ・並走運用）
- `handoff_scrapblitz_2026-05-20_phase24-complete.md`（Phase 2.4 完了内容）
- `handoff_scrapblitz_2026-05-20_phase3-gore-scrap.md`（Phase 3 直近の進捗・zealous-hertz 側）

## 関連 spec-room ファイル（参照のみ・編集禁止）

- `discussions/stage-construction-workflow.md`（ワークフロー議論・保留中）
- `archive/prop-catalog-and-naming.md`（プロップ命名規約・昇格済み）
- `INDEX.md`（spec-room 全議論の目次）

## 衝突回避ルール（要点・詳細は ROOM_README.md）

- `stage-layout-room.md` の編集は **本 worktree でのみ**
- 実装は **新規 ES モジュール**を基本とし、`index.html` への直接編集は最小エントリ追加のみ
- 既存インライン装飾の props/ 移管は zealous-hertz の編集と被らないタイミングで
- 仕様書本体（`plans/buzzing-juggling-sedgewick.md`）への昇格は main 経由

## 次セッション開始時の手順

1. `ROOM_README.md` を読む
2. 本 `HANDOFF.md` を読む
3. `stage-layout-room.md` の現状を確認
4. `stages/` 配下の確定データを確認（存在すれば）
5. ユーザーに「A / B / C どこから？」を提示
