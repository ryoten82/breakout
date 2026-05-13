---
status: 検討中
created: 2026-05-14
related_spec: §26 アセット調達戦略 / §13 経済システム（CR ドロップ源） / 命名規約（攻撃 ID）
tags: [プロップ, ステージ構築, 命名規則, カタログ]
---

# プロップ種類カタログ + 命名規則

## 背景・きっかけ

ステージ構築ワークフロー（stage-construction-workflow.md）で案を比較したが、ユーザー反応：

> 触ってみないと分からんけど、ちょっと難しそうではあるね…
> ただ、プロップの種類リストや命名規則とかはやれそうか

ワークフロー本体の判断は実プロトを触ってから保留。先行して**プロップカタログと命名規則**を確定させる方向。
理由：
- どのワークフローを最終的に選んでも、プロップカタログは必ず要る
- 命名規則は実コード書く前に決めないと、後でリファクタが重い
- カタログを書く過程で「自分が何を並べたいか」が見えてくる → ワークフロー判断材料が増える
- 既に攻撃 ID 命名規約（`c{キャラID}_atk_{弱強}_{連番}`）の前例があり、揃えやすい

## 論点

1. プロップのカテゴリ分け（何を「種類」とするか）
2. 命名規則のフォーマット
3. 各プロップが持つべきデータ項目（コリジョン・HP・ドロップ・破壊挙動・サイズ等）
4. ステージ固有プロップと汎用プロップの扱い
5. Three.js プロトでの仮実装と Unreal 移行後のアセット差し替えの紐付け方

## カテゴリ分け（叩き台）

ベルスク的に必要そうな要素を粗く列挙：

| カテゴリ | 役割 | 例 |
|---|---|---|
| **terrain**（地形） | 床・段差・壁・通行不可ライン | floor_concrete / wall_metal / gap_pit |
| **destructible**（破壊オブジェクト） | 殴れる・CR/チップを落とす | crate_wood / barrel_oil / vending_machine |
| **hazard**（ハザード） | 触れると被弾・敵が踏むと利用可能 | spike_floor / fire_jet / electric_panel |
| **gimmick**（ギミック） | 動く・押せる・乗れる | conveyor / lift_platform / explosive_drum |
| **decoration**（装飾） | 当たり判定なし・世界観演出 | rusted_pillar / sign_neon / debris_pile |
| **bg_layer**（背景レイヤー） | bgCamera 側に配置・パララックス | parabola_antenna / distant_city / smoke_plume |
| **spawn_marker**（スポーンマーカー） | 敵出現点・カメラ停止点等の論理マーカー | wave_trigger / camera_pause / cutin_anchor |

→ カテゴリ数は **7つくらいが叩き台**。多すぎず、当たり判定の扱い別に整理されている。

## 命名規則（叩き台）

攻撃 ID 命名規約と整合させる形式：

```
{category}_{subtype}_{variant}[_modifier]
```

| パーツ | 意味 | 例 |
|---|---|---|
| `{category}` | 上記カテゴリの短縮形（terr / dest / haz / gim / dec / bg / spwn） or 全綴り | `dest` または `destructible` |
| `{subtype}` | サブタイプ（素材・形状・機能の区分） | `crate` / `barrel` / `pillar` |
| `{variant}` | バリエーション番号 or 識別子 | `01` / `02` / `wood` / `metal` |
| `_modifier` | 状態・大きさ等のオプション | `_large` / `_explosive` / `_indestructible` |

**例**：
- `dest_crate_01` — 破壊可能な木箱（基本形）
- `dest_barrel_oil_explosive` — 爆発する油樽
- `terr_wall_metal_01` — 金属壁
- `haz_spike_floor_01` — 床トゲ
- `dec_pillar_rusted_large` — 装飾用の大きな錆びた柱
- `bg_antenna_parabola_01` — パラボラアンテナ（背景レイヤー）
- `spwn_wave_01` — ウェーブ 1 のスポーンマーカー

**運用ルール案**：
- 新規プロップを追加する前にユーザーに ID 案を提示して確認（攻撃 ID と同じ運用）
- 連番より素材名のほうが読みやすい場合は素材名を採用
- カテゴリ短縮形 vs 全綴りはどちらかに統一（要決定）

## 各プロップのデータ項目（共通スキーマ叩き台）

カタログ定義時（種類の登録）と配置時（インスタンス作成）で項目を分ける：

### カタログ定義（種類ごとに1回書く）

```js
PROPS_CATALOG.dest_crate_01 = {
  category: "destructible",
  visual: { mesh: "crate_wood.glb", scale: 1.0 },   // Unreal 移行で差し替え
  collider: { type: "box", w: 60, h: 60, d: 60 },
  hp: 30,
  destroy: {
    breakInto: "particle_wood",
    drop: { table: "scrap_common", count: [1, 3] },
  },
};
```

### ステージ配置時（インスタンスごとに書く）

```js
{ "type": "dest_crate_01", "x": 800, "z": 0, "rot": 0 }
```

→ カタログ側が「種類の性質」、配置側が「位置と回転だけ」。攻撃 ID テーブル（`SB.ATTACKS`）と同じ思想。

### ドロップとの紐付け

§13 で「CR は雑魚撃破・破壊オブジェクトから」と定義済。プロップカタログに `drop` フィールドを持たせて、ドロップテーブル ID を指すようにすれば §13 の経済システムと自動連動する。

## ステージ固有 vs 汎用

- **汎用プロップ**: どのステージでも使い回せる（`dest_crate_01` 等）
- **ステージ固有プロップ**: そのステージだけのアセット（`dec_boss1_throne` 等）
- 命名は同じ規約。ID プレフィックスや tag フィールドで区別すれば検索しやすい

## Three.js プロト → Unreal 移行

- カタログ側の `visual.mesh` を Three.js では procedural BoxGeometry に差し替え
- Unreal 移行時に同じ ID に対して GLTF / 自作モデルを紐付け
- カタログの構造が同じなら、配置データ（JSON）は無修正で Unreal でも読める

## 現時点の傾き（叩き台）

カテゴリ分け・命名規則は上記の叩き台ベースで進める。ただし以下は要相談：

- **カテゴリ短縮形 vs 全綴り**（`dest_crate_01` vs `destructible_crate_01`）
- **subtype に素材名を含めるか**（`crate_wood_01` か `crate_01_wood` か）
- **bg_layer と decoration の境界**（パララックス背景は分離した方が扱いやすい？）
- **最初に揃えるべき "ミニマムカタログ" の規模**（5個 / 10個 / 20個？）

## 派生論点（本トピックでは決めない）

- 具体的なプロップ 1 個 1 個の数値（HP・ドロップ量・サイズ）
- ハザード被弾の damage 計算（§14 HP システムとの連動）
- ギミック挙動の実装（コンベア・リフト等は別トピック）
- 破壊エフェクト・パーティクルの種類

## 次のアクション

- [ ] ユーザーに命名規則の細部を確認（短縮形 vs 全綴り、素材名の位置 等）
- [ ] ミニマムカタログの規模・優先順を決定（プロト用に何個揃えるか）
- [ ] 確定したら §26 もしくは新セクションとして仕様書本体へ昇格
- [ ] プロップ ID 一覧テーブルを別ファイル化するか（`chars/` 配下のような）検討

## 決定（昇格 or 廃案時に追記）

- 日付:
- 結果:
- 反映先:
- 廃案理由:
