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

## 残論点（次回以降）

- 性格は **敵種別固定**か **スポーン時ランダム**か（tier01 = brave 固定など）
- 視覚的に性格を見分けられるべきか（カラーバリエーション or 装飾差）
- 「統率喪失」発動時の **演出**（怯み SE / カラーフラッシュ / オーラ消失 等）
- 狡猾の **密集回避（boid）** をどこまで実装するか（重い）
- escort の **scrap ボーナス**の数値感
- 「狡猾 × escort」の特殊挙動（leader を盾にする？）
