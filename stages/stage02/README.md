# Act 1 / Stage 2 — 工場内部（生産フロア）

> **ステータス**：**テスト用確定（2026-05-19）**。プレイ可能。
> 上位設計：[`../../stage-layout-room.md`](../../stage-layout-room.md) のステージ全体の流れ参照
> 起動方法：URL `?stage=stage02` でアクセス → 工場内部柱組＋床↘パース＋4 ウェーブ＋tier06 中ボス

## 位置づけ

Act 1 = factory の 2 番目のステージ。**工場内部の生産フロア**。屋外開放感（Stage 1 外周ヤード）から「中に入った」体感を出す。Stage 3 の工場深部（CRUSHER 戦）への通路役。

## 実装内容（2026-05-23 独立ランナー化）

`gameproject02/src/stages/stage02/index.js` は **独自ランナー**：

- ウェーブ：敵編成は stage01 と共用（`STAGE01_WAVES` を再 export）。META は stage02 専用
  （`stage02/waves.js`：worldXMax 6900 / `clearWalkX` 6650 / nextStageId stage03）
- ウェーブ間隔は 1 画面（≒1200wu）確保（2026-05-23 拡張）。trig x = 800 / 2300 / 4000 / 5700
- 地面穴ギミック（`floor-hazard.js`）：Stage 2 固有。**穴 3 個**をウェーブ合間に配置（後述）
- 壊れ物：序盤コンテナ多め → 後半ボンベ多め。穴に重ならないよう x をずらして配置
- OC コンテナ：**最終ウェーブ撃破後**、`clearWalkX` 手前の余白（x=6500）に固定 1 個
- 装飾：既存の内部柱組（`buildBackWallPillars`）＋床↘パース＋bgElements
- 動作：exterior は適用しない（`SELECTED_STAGE === 'stage02'` 時は initStage01Exterior をスキップ）
- 仕様参照：[`../stage01/layout.md`](../stage01/layout.md)（ウェーブ編成・装飾の共通仕様）

## 地面穴ギミック（2026-05-23 複数化）

`floor-hazard.js` が管理。穴 3 個を `HAZARD_CONFIG.holes` 配列で定義し、ウェーブ合間に分散：

| 穴 | X 範囲 | 配置 |
|---|---|---|
| 穴1 | 1640〜1980 | W1–W2 合間 |
| 穴2 | 3120〜3460 | W2–W3 合間 |
| 穴3 | 4980〜5320 | W3–W4 合間 |

- いずれの穴 x 範囲にも敵スポーン x を含めない（「湧いた瞬間に落ちる」事故の回避）
- 敵を穴に落とすと CR コインを「落ちた穴の手前（プレイヤー側）」へドロップ
- 接地歩行は見えない段差でブロック、ジャンプで入って着地すると落下判定

## 起動例

```
http://127.0.0.1:5502/index.html?stage=stage02
```

または DevTools コンソール：
```js
location.search = '?stage=stage02';
```

## 残りの移管タスク

- ✅ stage02/index.js を独自ランナー化（2026-05-23 完了）
- ✅ stage02 専用 META を `stage02/waves.js` に分離（2026-05-23 完了）
- 装飾の実体は **まだ stage01 / index.html 側にある**（`buildBackWallPillars` 等）
- 本実装フェーズで以下を実施する想定：
  1. `index.html` の `buildBackWallPillars()` 等を `gameproject02/src/props/factory/back-wall.js` 等に切り出し
  2. `stages/stage02/layout.md` を作成（現 stage01/layout.md の内容を移植・更新）
  3. 敵編成を stage02 専用へ（現状は STAGE01_WAVES 共用。下記「編成仕様」が独立化時の出発点）

### なぜ移管が別タスクか

`index.html` への手入れが必要なため、**zealous-hertz worktree（実装本流）と同時編集を避けるタイミング**で実施しなければならない（ROOM_README.md 衝突回避ルール 3）。

---

## Stage 2 編成仕様（独立実装時の出発点・2026-05-19 確定）

stage01 wrap から独立実装へ移管する際の編成方針。テーマ：**応用・群れの脅威 / cunning 比率上昇 / キャリア初登場**。

### 性格分布カーブ
**brave 50% / cunning 40% / coward 10%**（キャリア coward 初登場）

### ウェーブ構成（4 wave）

| W# | trig x | spawnPattern | 敵編成（tier × 性格）| 学習目標 |
|---|---|---|---|---|
| W1 | 800 | **simultaneous** | brave tier01 × 2 | ステージ感覚リセット |
| W2 | 2300 | **staggered**（30F おき）| brave × 1 + **cunning × 2** + tier03 | cunning 多め・**にらみ合い**練習 |
| W3 | 4000 | **encircle**（前 2 + 後 1）| brave × 1 + cunning × 2 + **キャリア coward × 1** | **アイテム狙い vs 戦闘優先**の判断初体験 |
| W4 | 5700 | **midboss 単体 wave**（推奨）| **midboss01 シールドガーダー × 1**（中盤の山場・障害として登場）| **盾を割って倒す**動機付け・berserker 体験 |

### キャリア coward（enem06 仕様・stage02 W3 初登場）
- 攻撃ロジック完全 OFF（性格 coward の挙動ルール準拠）
- プレイヤー接近で `walk_back` / `dodge` で距離取り
- 倒すと**特別ドロップ**（CR / 強化チップ / SP 回復素材等・経済設計と直結）
- 詳細：`chars/enem01.md` §coward の発生経路

### spawn パターン定義
`../stage01/layout.md` §spawn パターン定義 を参照（共通仕様）。

### 連携
- `chars/enem01.md` §性格軸 × 攻撃頻度分布 / §複数体時 attack token 制御
- 性格・spawn・編成・キャリアすべて連携した仕様セット
