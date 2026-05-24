# 敵 AI 部屋（enemy-ai-room）

SCRAP BLITZ の敵 AI 仕様を **議論 → データ → 実装** まで一気通貫で扱う部屋。
Phase 3 本流（敵 AI ステートマシン拡張・ボス・ステージとの統合）に直結する。

## この部屋の役割（三層構造）

| 層 | 場所 | 内容 |
|---|---|---|
| **議論層** | `discussions/*.md` | 性格軸・役割軸・統率喪失・AI ステート遷移・敵種別固有 AI などの叩き台 |
| **データ層** | `data/personalities.json` 等（議論が固まったら） | 性格プロファイル（weight 表）・役割定義・敵種別 × 性格対応表 |
| **実装層** | `gameproject02/src/ai/` 等（実装着手時） | personality engine / role handler / leader linkage の実コード |

外部参照：
- `chars/enem01.md` — 敵共通仕様（`aiPhase` ステート機械の正本）
- `chars/common01.md` — 状態系の正本
- `memory/project_scrapblitz_enemy_tier_naming.md` — tier 体系
- `stage-room` — ステージ別の敵配置・性格混成比率（連携先）
- `chip-ideas` — チップで AI 性向を変える効果系（連携先）

## セッション開始時に Claude が読むもの

1. `HANDOFF.md`（前セッションからの引継ぎ・存在すれば）
2. `discussions/` 配下（議論層の本体）
3. `data/` 配下の確定データ（存在すれば）
4. memory：
   - `project_scrapblitz.md`（プロジェクト全体像）
   - `project_scrapblitz_enemy_ai_room.md`（本部屋のメタ情報・最新スコープ）
   - `handoff_scrapblitz_2026-05-20_phase3-gore-scrap.md`（既存 aiPhase 実装）
5. 仕様書 `chars/enem01.md` / `chars/common01.md`

## 前提（確定済みの土台）

- **Phase 3 入り済み**。`aiPhase = idle / chase / attack / retreat / hitstun` ステートマシン実装済
- **retreat フェーズ既存**：攻撃 recover 後 40F / 被弾→wait01 復帰後 30F の後方退却
- **死亡フロー（ゴア・スクラップ）実装済**：reacting → stunned → final/burst → exploded
- **DEBUG_AI HUD**（数字キー 8）で aiPhase 可視化済

## 衝突回避ルール（他 worktree との並走）

1. 敵 AI 実装は原則 **新規 ES モジュール**として作る：`gameproject02/src/ai/<role>.js`
2. 既存 `hit-engine.js` / `enemy-spawn.js` への手入れは、フック追加のみで本流ロジックは温存
3. ボス AI は本部屋で議論、実装は実装系 worktree と相談
4. ステージ別出現テーブルは stage-room 側に責務を持たせる（本部屋は性格プロファイルまで）

## 編集ポリシー

- `discussions/*.md` の編集は **本 worktree でのみ**
- 仕様書本体（`chars/enem01.md`）への昇格は、設計が固まってから main 経由で
- 他部屋（chip-ideas / oc-ideas / stage-room）の議論ファイルは触らない
