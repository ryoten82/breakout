# 背景部屋（stage-room）

SCRAP BLITZ のステージ周りを **議論 → データ → 実装** まで一気通貫で扱う部屋。
Phase 3 ゲームプレイ本流（zealous-hertz worktree）とは独立に動かす。

## この部屋の役割（三層構造）

| 層 | 場所 | 内容 |
|---|---|---|
| **議論層** | `stage-layout-room.md` | 個別ステージの構想・敵配置案・ギミック案・楽しさ言語化（叩き台・継続記録） |
| **データ層** | `stages/stageNN/` | 議論が固まったステージのレイアウト確定版・ウェーブ構成 |
| **実装層** | `gameproject02/src/stages/`, `gameproject02/src/props/` | Three.js による背景プロップ・装飾・ギミックの実コード |

外部参照：
- `spec-room/discussions/stage-construction-workflow.md` — **どう作るか**（ツール・ワークフロー）
- `spec-room/archive/prop-catalog-and-naming.md` — **何を置けるか**（プロップ命名規約）

## セッション開始時に Claude が読むもの

1. `HANDOFF.md`（前セッションからの引継ぎ）
2. `stage-layout-room.md`（議論層の本体）
3. `stages/` 配下の確定データ（存在すれば）
4. memory：
   - `project_scrapblitz.md`（プロジェクト全体像）
   - `project_scrapblitz_visual_doctrine.md`（廃工場テーマ・配色）
   - `project_scrapblitz_stage_room.md`（本部屋のメタ情報・最新スコープ）
5. 仕様書 `plans/buzzing-juggling-sedgewick.md` の §16 / §11 / §1.5

## 前提（確定済みの土台）

- **Phase 2.4 完了済み**（2026-05-18）。Phase 3 入り
- **ビジュアル方針**：廃工場テーマ＋嘘パース／SOR4 風 45 度斜め平行線床／柱組クロスブレース＋警告色
- **配色**：METEO 赤・敵緑
- **CR 一本化**・**ランダム性は敵配置/OC/チップドロップのみ**・**手触りファースト**

## 衝突回避ルール（zealous-hertz 本流との並走）

stage-room と zealous-hertz は同一の `gameproject02/index.html` を編集し得るため、衝突を以下で抑える：

1. **stage-room 側の実装は原則 新規 ES モジュールとして作る**
   - 背景プロップ → `gameproject02/src/props/<theme>/<name>.js`
   - ステージ実装 → `gameproject02/src/stages/<stageNN>/<role>.js`
2. `index.html` への手入れは **エントリ追加のみ**（`<script type="module" src="src/stages/index.js"></script>` 等の最小差分）
3. 既存 index.html 内インライン装飾（`buildBackWallPillars()` 等）の props/ への移管は、zealous-hertz と同時編集していないタイミングで実施
4. 定期的に main 経由マージ（`setup_worktree_workflow.md` のハンドオフ手順）

## 編集ポリシー

- `stage-layout-room.md` の編集は **本 worktree でのみ**（spec-room 側は移行済みマーカーのみ・編集禁止）
- 仕様書本体（`plans/buzzing-juggling-sedgewick.md`）への昇格は、Stage 設計が固まってから main 経由で
- 他部屋の議論ファイル（チップ・OC 等）は触らない
