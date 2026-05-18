# Act 1 / Stage 2 — 工場内部（生産フロア）

> **ステータス**：概念整理のみ完了（2026-05-18）。実体は未移管。
> 上位設計：[`../../stage-layout-room.md`](../../stage-layout-room.md) のステージ全体の流れ参照

## 位置づけ

Act 1 = factory の 2 番目のステージ。**工場内部の生産フロア**。屋外開放感（Stage 1 外周ヤード）から「中に入った」体感を出す。Stage 3 の工場深部（CRUSHER 戦）への通路役。

## 実体の所在（2026-05-18 時点）

**本ステージの実体（装飾・データ・実装）は現在 Stage 1 側に残存している**：

- 装飾：`gameproject02/index.html` 内のインライン関数（`buildBackWallPillars()` 等）
- データ：[`../stage01/layout.md`](../stage01/layout.md)（内部・テストプレイ最小構成）
- 実装：`gameproject02/src/stages/stage01/`（waves.js / progress-lock.js / wave-hud.js / clear.js / section-markers.js / index.js）

## 移管タスク（別セッション）

新構想（Act 1 内で stage1=外周ヤード、stage2=内部）に整合させるため、以下を**別タスク**として実施する：

1. `gameproject02/index.html` の `buildBackWallPillars()` 等インライン関数を `gameproject02/src/props/factory/back-wall.js` 等に切り出し
2. 現 `stages/stage01/layout.md` の内容を本 `stages/stage02/layout.md` に移動＋更新
3. `gameproject02/src/stages/stage02/index.js` を新設し、現 stage01 実装と同じ枠組みで動かす
4. waves.js / progress-lock.js / wave-hud.js / clear.js / section-markers.js を stage02 側に移管 or 共通化

### なぜ別タスクか

`index.html` への手入れが必要なため、**zealous-hertz worktree（実装本流）と同時編集を避けるタイミング**で実施しなければならない（ROOM_README.md 衝突回避ルール 3）。stage-room スコープ内では完結しない。

## 今は何ができるか

- Stage 1 外周ヤード（exterior プロト）の実装と**並走可能**
- Stage 2 の追加議論（マップレイアウト・カバー配置・敵編成）は [`../../stage-layout-room.md`](../../stage-layout-room.md) で継続
- 確定版仕様（`stages/stage02/layout.md`）は実体移管時に作る
