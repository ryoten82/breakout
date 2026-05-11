# SCRAP BLITZ — 作業ガイド

近未来ベルトスクロールアクション。Three.js + 2.5D固定カメラ。
**単一HTML + インラインJS** 構成（`index.html` 一つで完結）。
将来 Unreal Engine への移行を予定。

---

## 🟢 セッション開始時の必読資料

新しいチャットを開始した時点で、必ず以下の順に読み込み、ゲームの全体像を把握すること：

1. **このファイル（自動読込）** — 作業ガイド
2. **仕様書** — `~/.claude/plans/buzzing-juggling-sedgewick.md`（**ゲームの全体仕様・1ファイルで把握可能**）
3. **メモリ**（自動読込）— `~/.claude/projects/G--claude-code-local/memory/MEMORY.md` 経由
4. 必要時のみ：`gameproject02/index.html`（実装の真の source of truth）

→ 仕様書を最初に読むことで、世界観・キャラ・戦闘・経済・解放等の全容を把握できる。
→ ユーザーが「設計図」「プラン」と言っても、それは **仕様書** を指す（旧呼称は廃止済み）。

---

## 設計の北極星（仕様書 §4 と同期）

1. **手触り重視・ノイズ最小化** — 完全ローグライトではない。技は基本固定、ランダム性は敵配置・OVERCLOCK・チップドロップのみ
2. **板野思想** — 全動作に推力理由を持たせる。ジャンプ・方向転換・キャンセル時に噴射演出を必ず入れる
3. **メカは重い** — ジャンプ初速は控えめ＋長押しブースターで継続推力
4. **永続強化（チップ・CR・キャラ解放）と一時強化（OVERCLOCK）を分離**
5. **マルチプレイ意識** — OVERCLOCK発動はウェーブクリア時（同期可能タイミング）

詳細・根拠は仕様書 §4 を参照。

---

## ランタイム調整パターン

数値の調整はコンソール経由で即反映できる構造にする：

```js
window.SB.PHYSICS.JUMP_V = 12        // 即変更可
window.SB.ATTACKS.z1.damage = 8      // 即変更可
window.SB.SP_CONFIG.REGEN_RATE = 0.05 // SP回復速度
```

新パラメータを足すときは `PHYSICS` / `ATTACKS` / `SP_CONFIG` 等の定数オブジェクトに追加し、
`window.SB = { PHYSICS, ATTACKS, SP_CONFIG, ... }` に必ず露出させる。

---

## 変数定義順の鉄則（TDZ事故防止）

`STATE` / `PHYSICS` / `ATTACKS` / `SP_CONFIG` / `Z_CHAIN` は **`players` 配列の宣言より前**に定義する。
順序ミスで画面真っ黒になった実績あり。新しい定数を足すときも同じ位置に置く。

---

## 現Phase 進捗

- ✅ Phase 1: 移動・ジャンプ（ブースター式）・ヨースラスター
- ✅ Phase 2.1: 弱攻撃3段（J）/ ヒットストップ / シェイク / キャンセルジャンプ
- 🔄 Phase 2.2: SP ゲージ（実装済）/ 強攻撃K / ダッシュ / 打ち上げ / グラブ / メガクラッシュ / コマンド技 / 敵AI
  - ✅ キーバインド変更：弱攻撃 Z→**J**、強攻撃 X→**K**、セカンダリ：**L**
  - ✅ SP ゲージ実装（MAX:100 / 初期値:0 / REGEN_RATE:0.01/frame / GAIN_ON_HIT:+8）

詳細タスクは仕様書 §29 参照。

### Phase 2.2 着手前の懸念は解決済み
旧🔴項目（❶〜❺）は仕様書 §30 で全て決断済み。後付け波及の心配なく実装に集中できる。

---

## エンジン移行方針

| フェーズ | エンジン |
|---------|---------|
| 〜Phase 2.x（現在） | Three.js（プロトタイプの手触り検証速度を優先） |
| Phase 3〜 | **Unreal Engine**（ユーザー経験あり・3DSMax 親和性・Niagara 演出） |

Unity は採用しない。詳細は仕様書 §3 参照。

---

## 関連ファイル

- 仕様書（**最初に読む**）：`~/.claude/plans/buzzing-juggling-sedgewick.md`
- メモリ：`~/.claude/projects/G--claude-code-local/memory/project_scrapblitz.md`
- ユーザー全体ガイド：`~/.claude/CLAUDE.md`
- 実装：`gameproject02/index.html`
