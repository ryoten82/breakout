# Stage 1 — CRUSHER（廃工場）テストプレイ用 最小構成 仕様

> ⚠️ **構造改編に伴う注記（2026-05-19 更新）**：
> Act 構造の確定（memory `project_scrapblitz_act_scale_aesthetic.md`）により、本ファイルが扱う「廃工場内部・柱組装飾」は**Act 1 / Stage 2（工場内部）の素材**となった。
> ファイル名は `stage01/layout.md` のままだが、内容は **Stage 2 テスト用確定版** として 2026-05-19 から扱う（[`../stage02/README.md`](../stage02/README.md)）。
> 起動：URL `?stage=stage02` → 本仕様で動く。
> 物理的な移管（index.html インライン関数の props/ 切り出し、本 md の `stage02/layout.md` への移動）は zealous-hertz と被らない別タスクで実施予定。それまで本ファイルが Stage 2 の仕様を表す。
>
> **ステータス**：Stage 2 テスト用確定（2026-05-19）。実装は stage-room worktree で着手済み・プレイ可能。
> 議論の派生・揺れは `stage-layout-room.md` 側に残し、本ファイルは「実装が参照する確定版」。

## ゴール

**プレイヤーがステージ左端から右端まで走り切り、最終ウェーブを倒すと「STAGE CLEAR」が出る**ところまで。
本仕様はテストプレイ用の最小構成。CRUSHER（本ボス）は別マイルストーンで本実装。

## ステージ全長と座標系

- ワールド X 軸：`x = 0`（左端 / 搬入口）〜 `x = 4000`（右端 / ボス前広場）
- 高さ・床は既存のまま（廃工場フロア）
- カメラはデッドゾーン追従。**進行ロックゾーン**でのみ右端を一時固定

## セクション分割（3 区画）

| # | 名前 | X 範囲 | 役割 | 進行ロック |
|---|---|---|---|---|
| S1 | 搬入口 | 0 〜 1700 | 操作練習帯。短いがウェーブ 1 個 | あり（W1） |
| S2 | 主工場フロア | 1700 〜 5100 | 中盤。ウェーブ 2 個 + 装飾密度ピーク | あり（W2 / W3） |
| S3 | ボス前広場 | 5100 〜 6500 | 最終ウェーブ。STAGE CLEAR トリガー | あり（W4） |

> ※ 2026-05-23：ウェーブ間隔を 1 画面（≒1200wu）確保するため全体を拡張（総長 4000→6500wu）。

セクション境界は装飾の切れ目（柱組の警告色帯）で視覚的に伝える。プレイヤー側に「ここからは戻れない」とは伝えない（戻れる）。

## ウェーブ構成（合計 4 ウェーブ）

> **命名規約**：`tier01..tier06` は**敵の強度ティア**。プレイヤー攻撃の `lv01..lv06`（ヒットレベル）とは別軸（2026-05-18 切り分け）。
> **性格軸**：brave / cunning / coward（chars/enem01.md §性格軸 × 攻撃頻度分布 参照）。stage01 は基本動作習得ステージなので **brave 中心**で構成。

### Stage 1 編成仕様（2026-05-19 確定）

**性格分布カーブ**：brave 80% / cunning 20% / coward 0%（キャリア・leaderless は stage02 以降）

| W# | セクション | trig x | spawnPattern | 敵編成（tier × 性格）| 学習目標 |
|---|---|---|---|---|---|
| W1 | S1 | 800 | **simultaneous** | brave tier01 × 2 | 基本振りに慣れる |
| W2 | S2 | 2300 | **staggered**（30F おき）| brave tier01 × 3 + brave tier03 × 1 | 突進タックル初登場 |
| W3 | S2 | 4000 | **encircle**（前 2 + 後 1）| brave tier01 × 2 + **cunning tier01 × 1 後方湧き** + tier05 | cunning 初導入・読み合い学習 |
| W4 | S3 | 5700 | **ambush**（待ち構え演出）| brave tier01 × 2 + cunning tier01 × 1 + tier06 | 卒業試験。**全滅で STAGE CLEAR** |

※ tier03/tier05/tier06 は既存 tier01 のパラメータ差替えで代用してよい（敵 AI 拡張は Phase 3 本流の zealous-hertz 側マター）。

### spawn パターン定義（共通仕様・全 stage 共有）

| パターン | 内容 | 演出 |
|---|---|---|
| `simultaneous` | triggerX 通過で全員一斉 spawn（既存）| プレーンな登場 |
| `staggered` | 一定間隔で順次 spawn（spawnInterval F おき or 個別 delay）| じわじわ増援・「次が来るぞ」のプレッシャー |
| `encircle` | プレイヤーの**前後左右**に同時 spawn（Z 軸の奥/手前も活用）| **進行方向を逆走して対応**する判断要求 |
| `ambush` | triggerX 時に既に画面端や物陰にいた設定で出現演出付き | 「待ち構えていた」感・予感のドラマ |
| `reinforcement` | 一部撃破後に追加 spawn（threshold で発火）| 「終わったと思ったら…」のサプライズ |

### wave データ拡張フォーマット（waves.js 用・実装時の出発点）

```js
{
  id: 'W3',
  section: 'S2',
  triggerX: 4000,
  spawnPattern: 'encircle',
  spawns: [
    { type: 'tier01', personality: 'brave',   x: 4300, z:   0, delay:  0 },
    { type: 'tier01', personality: 'brave',   x: 4400, z: -60, delay:  0 },
    { type: 'tier01', personality: 'cunning', xRel: -200, z: 60, delay: 30, entryFx: 'shadow' },
    { type: 'tier05', personality: 'brave',   x: 4500, z:   0, delay: 45 },
  ],
}
```

**拡張フィールド**：
- `personality`：性格軸（brave / cunning / coward）
- `delay`：個別出現遅延（F・wave トリガーからの相対）
- `z`：奥行き配置（-80 = 奥 / +80 = 手前）
- `xRel`（任意）：プレイヤー位置からの相対 X（後方湧きで負値）
- `entryFx`（任意）：登場演出（`normal` / `shadow` / `crash` / `fadein`）

### 出現演出（entryFx）

| fx | 演出 | 推奨パターン |
|---|---|---|
| `normal` | フェードイン（既存）| simultaneous |
| `shadow` | 床に影が先に表示 → 上から落下 | ambush（上空待機）|
| `crash` | 壁・床破壊エフェクトと共に出現 | ambush（物陰から）|
| `fadein` | 半透明から実体化 | reinforcement |

## 進行ロックの仕様（SOR 方式・最小版）

1. プレイヤーが **トリガー x を初めて超えた瞬間** にウェーブ生成
2. 同時に **カメラ右端をその時点の右端で固定**（プレイヤーは左には戻れる）
3. 該当ウェーブの敵全滅で **ロック解除**（カメラ追従再開）
4. 既に倒したウェーブを再トリガーしない（フラグで管理）

## STAGE CLEAR トリガー

- W4 を全滅させた瞬間に状態 `stageCleared = true`
- 演出：1.5 秒の暗転＋「STAGE CLEAR」テキスト
- 暗転後はリスタート / メニュー復帰は最小構成では実装しない（F5 リロードで再開）

## 背景装飾の使い方（最小構成）

- 既存の `buildBackWallPillars()` / `makeGridTexture()` を **そのまま使う**（props/ 移管は本最小構成の範囲外）
- セクション境界に視覚マーカーを足す：警告色テープ（黄黒ストライプ）の縦バンドを `x = 1200` と `x = 3000` に細い `Mesh` で 1 枚ずつ
- 装飾の追加密度・プロップ（コンベア・ドラム缶等）は最小構成では入れない（次マイルストーン）

## ギミック（最小構成では入れない）

プレス機・コンベア・破壊可能オブジェクトは本最小構成のスコープ外。「走り抜けて殴る」だけが成立すれば OK。
ギミック議論は `../../stage-layout-room.md` 側で継続。

## HUD

- 既存 HUD は触らない
- 追加：右上に小さく `WAVE 1/4` 形式の表示。ウェーブ進行中だけ表示、クリア間は非表示
- STAGE CLEAR テキストは画面中央・大きめ・1.5 秒フェード

## 楽しさのチェックポイント（言語化）

テストプレイで以下が成立しているかを評価軸にする：

- W1 の 2 体は **「軽くウォームアップ」** に感じられるか（多すぎないか）
- W2/W3 の中盤で **「動かしてて気持ちいい」が継続する**か（敵の質・量バランス）
- W4 のロック解除で **「終わった！」の達成感**が出るか
- セクション境界（警告色バンド）で **「次に進む高揚感」**が出るか

## 実装ファイル割当（次マイルストーン）

| 役割 | ファイル | 内容 |
|---|---|---|
| ステージランナー | `gameproject02/src/stages/stage01/index.js` | 初期化 / フレーム更新エントリ |
| ウェーブデータ | `gameproject02/src/stages/stage01/waves.js` | 本 md の W1〜W4 をデータ化 |
| 進行ロック | `gameproject02/src/stages/stage01/progress-lock.js` | カメラ右端のロック・解除 |
| クリア状態 | `gameproject02/src/stages/stage01/clear.js` | stageCleared フラグ + 暗転テキスト |
| HUD（ウェーブ表示） | `gameproject02/src/stages/stage01/wave-hud.js` | 右上 WAVE N/4 表示 |
| index.html エントリ | `gameproject02/index.html` の `<script type="module">` 1 行追加 | `src/stages/index.js` 経由で stage01 を起動 |

既存 `enemy-system.js` / `camera.js` / `hud-system.js` への直接編集は**最小限**（フック関数追加程度）。
背景装飾の props/ 移管は本最小構成では行わない。

## 参照

- 議論：`../../stage-layout-room.md`（Stage 1 セクション）
- ビジュアル：memory `project_scrapblitz_visual_doctrine.md`
- 仕様書：`plans/buzzing-juggling-sedgewick.md` §16 / §11
- 衝突回避：`../../ROOM_README.md`
