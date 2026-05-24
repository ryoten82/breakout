# 敵 AI 性格・役割軸の設計（叩き台）

開始：2026-05-19（spec-talk で起こした議論をここに移植）

## ユーザー初稿

敵 AI に性格を付ける：

- **勇敢**：基本的にプレイヤーに正面から戦いに行く
- **狡猾**：攻撃しているところの裏を突きに行く。また、まとまってやられないよう、軸を動かしやすい
- **臆病**：あまり戦おうとせず、逃げる。アイテムキャリアなどに使いたい。また、大きなボスの取り巻きなどで使用。**ボスがやられたら統率を失って逃げる**

## Claude 所感：3 軸の素性は良い

| 性格 | 既存実装との関係 | 新規実装量 |
|---|---|---|
| 勇敢 | 現状の `chase → attack` 直線型がそのままベース | ほぼ命名のみ |
| 狡猾 | SCRAP BLITZ 特有の **z 軸 AI** に直結。`attacking` 中フラグ + facing を読んで背後 z オフセットへ回り込み。密集回避の boid 的フロッキングも | 中（z 軸ターゲット・密集判定） |
| 臆病 | `retreat` フェーズ既存（recover 後 40F / 被弾 30F）→ trigger 確率と duration を上げるだけで素体ができる | 小（プロファイル拡張） |

## 設計判断：性格 1 軸では足りない → **性格軸 × 役割軸** の 2 軸構成

理由：臆病の用途が「アイテムキャリア」「ボス取り巻き」の 2 つに分かれ、挙動が矛盾するため。

| 用途 | 単独時の挙動 | 切替トリガー |
|---|---|---|
| アイテムキャリア | **常に**逃げる | スポーン時から |
| ボス取り巻き | **ボス生存中は普通に戦う**／死亡で逃げる | ボス死亡イベント |

→ 「臆病」一語では表現しきれない。**性格と役割を分離**して組み合わせる。

### 提案構造

```
性格 (personality): brave / cunning / coward
役割 (role):        standalone / carrier / escort
```

| 役割 | 説明 | 性格制約 |
|---|---|---|
| **standalone** | 通常敵。性格そのままの挙動 | brave / cunning / coward 何でも |
| **carrier** | アイテム持ち。常時逃走 | coward 固定（運用上） |
| **escort** | ボス取り巻き。`leaderId` を持ち、leader 生存中は通常挙動／死亡で「統率喪失」 | 何でも可 |

## キーメカニク：「統率喪失」フラグ

`leaderless = true` を **性格に上書きする一時状態**として実装：

| 性格 × leaderless | 挙動 |
|---|---|
| 勇敢 × leaderless | 一瞬怯む（statusStun 0.5s 程度？）+ 逃走 |
| 狡猾 × leaderless | 即座に隙を見て退却 |
| 臆病 × leaderless | そもそも逃走モード継続（差は小さい） |

→ **ボスを倒すと取り巻きが一気に総崩れになる**演出が自然に出る。SOR・ベルスク文脈では強い気持ちよさ。

### ボス死亡 hook

既存 `_triggerFinalExplosion`（hit-engine.js）に **escort broadcast** を追加：
```
enemies.filter(x => x.leaderId === dyingBoss.id).forEach(x => x.leaderless = true)
```

副次効果：**ボスを先に倒すと取り巻き処理が楽になる**攻略リターン。scrap / 経験値ボーナスを escort に乗せれば駆け引きが生まれる。

## 実装スケッチ：性格 = weight プロファイル

分岐肥大化を避けるため、共通ステートマシン上に weight プロファイルを乗せる：

```js
const PERSONALITY = {
  brave:  { chaseDistance: 近, retreatTrigger: 低, zDriftWeight: 0,   backstabPref: 0  },
  cunning:{ chaseDistance: 中, retreatTrigger: 中, zDriftWeight: 高, backstabPref: 高 },
  coward: { chaseDistance: 遠, retreatTrigger: 高, retreatDuration: 長, escapeOnHit: 高 }
}

const ROLE_OVERRIDES = {
  standalone: {},
  carrier:    { forceRetreatAlways: true },
  escort:     { ifLeaderless: { retreatTrigger: 最大, escapeWeight: '+++' } }
}
```

→ `getAIWeights(e)` が `PERSONALITY[e.personality]` + `ROLE_OVERRIDES[e.role]` + `e.leaderless` を合成して返す。AI 本体は 1 本。

### 個体属性
```
e.personality = 'coward'
e.role        = 'escort'
e.leaderId    = bossEnemyId   // null なら standalone / carrier
e.leaderless  = false         // leader 死亡で true
```

## 連携先（他部屋への波及）

- **stage-room**：ステージ別の性格混成比率テーブル（tutorial=brave 100%、後半=cunning 混成、etc.）
- **chip-ideas**：「臆病な敵が増える」「狡猾の出現率↑」系チップが出るなら効果定義
- **enem01.md**：個体属性 4 つ（personality / role / leaderId / leaderless）の正本化
- **boss-room**（未設立）：ボス AI と escort 連携の設計はボス側にも責務がある

## 2026-05-19 決着事項（slug worktree セッションで深掘り・実装側統合）

> 注：本セッションは slug worktree (`inspiring-hellman-95abfe`) で進行・worktree 消滅で下書きファイルは失われたが、決着内容は `chars/enem01.md` への直接パッチで保存済。本セクションは決着の議論記録。

### 1. 性格軸の拡張：3 軸 → 4 軸（berserker 追加）

| 性格 | 核 |
|---|---|
| brave / cunning / coward | 既存（変更なし） |
| **berserker** | ギミック破壊で覚醒（不可逆）・覚醒後は retreat 0 / hitstun 短縮 / 攻撃発生 up |

**berserker の所属**：当初「enem02 = シールドガーダー」想定だったが、実装現状確認で **midboss01（中ボス級）が既に berserker として完成済**と判明。berserker = midboss01 の標準性格と決着（詳細は `chars/midboss01.md`）。

**bully は不採用**：tier 物理値（mass / hitstunMul / retreatTrigger）で「重い brave」として表現可能なため、性格軸に持ち上げない。

### 2. 決定方式：D ハイブリッド（種別デフォルト + ステージ偏向）

```js
ENEMY_TIER = { tier01: { defaultPersonality: 'brave', weightOverride: {...} }, ... }
STAGE_BIAS = { stage01: { brave: +0.1, ... }, stage03: { brave: -0.1, cunning: +0.2, ... } }
rollPersonality(enemyType, stage) = weightedRandom(merge(TIER, BIAS))
```

- 種別ごとの傾向は **enemy-ai-room の責務**
- ステージごとの偏向は **stage-room の責務**
- chip-ideas の「偏向係数を弄るチップ」も STAGE_BIAS を runtime 変更する形

### 3. 視覚識別

**第 1 段の提案（カラーバリエーション微差）は撤回**。既存 enem01.md の二層構造（色相＋モノアイ発光パターン）を尊重して、berserker 用の輝度パターン行のみ追加：
- 通常時：弱発光（盾装飾あり）
- 覚醒時：強発光赤系 + 盾消失（`aiPhase=enraged` 突入で切替）

### 4. 統率喪失（leaderless）演出：C しっかり

ボス死亡 `_triggerFinalExplosion` 発火時、全 escort 同時に：
- `applyStatusStun(e, 15)` を発動（既存 default 90F ではなく 15F 短縮指定）
- 青白いカラーフラッシュ（被弾用白フラッシュとは別色で新規追加）
- 集団 SE 1 発（複数体でも 1 回だけ）
- 15F 後に statusStun 解除 → 既存 retreat フェーズに移行
- 性格別差なし・全 escort 同時発動

### 5. 密集回避：D 個別目標 z（cunning のみ）

```js
e.targetZ = randRange(-1.5, +1.5)  // スポーン時に決定
// chase 中の目標位置
const goalZ = player.z + e.targetZ
// 90F に 1 回、近接 cunning がいたら再振り
```

- 適用は cunning のみ
- 仮値 ±1.5、DEBUG_AI HUD で視覚化
- 背後取り（backstab）挙動は Phase 4 以降

### 6. escort 撃破：残党狩り + ドロップ数増

**残党狩り位置づけ**：主役はボス、escort はおまけ。leaderless escort は HP がごく小さくなる。初導入は中間ステージのボス（最終ボスではなく中ボス級）。

**ドロップは「個数増」で表現**（倍率は採らない）：
- 通常 escort 撃破時：CR 1 個
- leaderless escort 撃破時：CR 2 or 3 個
- コンボ倍率とは独立・数値は実装後調整・ボーナス無しの可能性も残す

### 7. 狡猾 × escort：特殊挙動なし

狡猾の通常挙動 + escort の通常挙動の単純合成のみ。残党狩り位置づけと整合。boss-room 立ち上げ時に再評価。

---

## 残論点（更新後）

決着済みは ✅、未決は 🟡 / 🟢。

1. ✅ 性格の決定方式 — D ハイブリッド
2. ✅ 視覚識別 — 二層構造（色相＋モノアイ発光）+ berserker 行追加
3. ✅ 統率喪失の演出 — C しっかり
4. ✅ 狡猾の密集回避 — D 個別目標 z
5. ✅ escort ボーナス — ドロップ数増（無しの可能性も残す）
6. ✅ 狡猾 × escort — 特殊なし
7. 🟡 連携先への波及タイミング — stage-room / chip-ideas / 将来 boss-room

### 追加された論点（berserker 由来）
8. 🟡 berserker を持てる中ボス枠の拡張（midboss01 以外への適用判断） — boss-room 議論で
9. 🟡 盾の hitbox / 破壊演出 — 既に midboss01 で実装済（参照のみ）
10. 🟡 CR の表示・ドロップ・回収仕様 — CR 議論で別途

## 反映先

本セッションの決着は以下に反映済：
- `chars/enem01.md` — Patch 1〜9 で直接編集（berserker 仕様 / 統率喪失演出 / targetZ / 残党狩り / 連携先波及）
- `chars/midboss01.md` — 既存実装が berserker のテンプレ。本ファイルから参照
