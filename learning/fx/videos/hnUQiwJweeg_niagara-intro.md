# 学習ノート — Niagara 入門 (Unreal Engine 5 チュートリアル)

- 動画: https://www.youtube.com/watch?v=hnUQiwJweeg （13:30）
- 学習日: 2026-07-03 / 抽出: 日本語字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/hnUQiwJweeg.txt](../transcripts/hnUQiwJweeg.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

1. **アセット作成** [00:31–00:47] — Content Browser で右クリック → Niagara System → **「完全に空の状態（Empty）」を選んで作成**（テンプレートから作らず、理解を深めるためゼロから構築 [00:40]）
2. **エディタの構成把握** [00:53–01:47] — ダブルクリックで開くと、Preview パネル（見た目確認）/ パラメータ / Timeline（再生プレビュー） / **System Overview**（Emitter を並べて設計する場所）の 4 領域がある
3. **Emitter の追加方法を確認** [01:52–02:05] — 右クリック→Add Emitter で「Fountain」等の既製 Emitter テンプレートを試せるが、この動画では削除して**ゼロから自作**する方針
4. **5 大ステージの説明** [02:14–02:45] — Emitter Spawn / Emitter Update / Particle Spawn / Particle Update / Renderer の役割を先に整理してから着手
5. **Renderer 設定** [02:45–02:55] — Renderer グループに **Sprite Renderer** を追加（パーティクルの見た目の素材になる）
6. **Emitter Update: Spawn Rate** [02:57–03:23] — Emitter Update グループに **Spawn Rate** モジュール追加（デフォルト 1 = 毎秒 1 個生成）。追加時にエラーメッセージが出たら「Fix Issue」をクリックして依存モジュールを自動補完 [03:10]
7. **Particle Spawn: Initialize Particle** [03:27–04:07] — Particle Spawn グループに **Initialize Particle** モジュール追加。ここで色などパーティクル生成時の初期値を設定（例: 赤に設定）
8. **Lifetime の罠と Particle Update: Particle State** [04:07–05:29] — Initialize Particle 側で Lifetime を 1 秒に設定しても**それだけでは消滅しない**（Timeline 上で計算が合わない [04:24–04:47]）→ **Particle Update に Particle State モジュールを追加**して初めて寿命経過で消滅する [04:51–05:11]。教訓: 「設定しただけでは効かない項目がある。上書き（実際に効かせるモジュール）が別途必要」[04:07]
9. **Particle Spawn: Add Velocity** [05:35–09:51] — 速度を与えるモジュール。Spawn 側に追加すれば生成時の初速、Update 側に追加すれば毎フレーム加算 [05:38–05:58]。X/Y 速度・Random Range Vector（最小最大間のランダム速度）・Velocity Mode（Linear / Cone 等）・Cone 角度・Velocity Scale（全体倍率）などを設定
10. **Initialize Particle 詳細（色・スプライト属性）** [09:55–13:02] — Particle Lifetime の再確認、色を Random Range で 2 色の中間にする設定、Sprite Attributes（Size: Uniform / Random Uniform / Non-uniform / Random Non-uniform、Rotation Mode: Random / Direct Angle）
11. **配置** [13:05–13:16] — 完成したら Niagara System タブを最小化し、レベル内にドラッグ＆ドロップして配置

## Niagara の概念構造（最重要）

### System / Emitter / Module / Renderer / パラメータの関係 [00:38–02:45]
- **Niagara System** = 一番外側の器。複数の Emitter を束ねる（今回は空の System を作りゼロから Emitter を組んだ）
- **System Overview パネル** = System 内の Emitter 一覧を見て設計する場所 [01:18]
- **Emitter** = パーティクルの「見た目や動作」そのものを制御する単位 [01:40–01:44]。空の Emitter は何も出さない（要設計 [01:47–01:50]）
- **Module** = 各ステージ（Spawn/Update 等）のグループに追加する個別機能ブロック（Spawn Rate, Initialize Particle, Particle State, Add Velocity など）[03:03, 05:29–05:33]
- **Renderer** = パーティクルの見た目を最終的にどう描画するか制御（Sprite Renderer 等）[02:41–02:53]
- **パラメータ** = 各モジュール内で調整する値（色・速度・サイズ等）。モジュール追加時に依存関係のエラーが出ることがあり、「Fix Issue」で自動補完される [03:10, 06:14–06:23]

### ステージ（5 大設定）の役割分担 [02:14–02:45]
| ステージ | 発生タイミング |
|---|---|
| Emitter Spawn | Emitter が最初に起動したとき **一度だけ** |
| Emitter Update | Emitter が動作している間、**毎フレーム** |
| Particle Spawn | 生成されるパーティクル**ごとに一度** |
| Particle Update | 生きている全パーティクルについて**毎フレーム** |
| Renderer | パーティクルの見た目を制御 |

同じモジュール（例: Add Velocity）でも**どのステージに置くかで意味が変わる** — Spawn に置けば「生成時の初速」、Update に置けば「生きている間ずっと加算され続ける速度」[05:38–05:58]。これが Niagara の設計における最重要判断基準: **「一度だけでよい処理は Spawn、継続的に効かせたい処理は Update」**という区分けをモジュール追加のたびに考える。

### 「設定しただけでは効かない」問題 [04:07–05:33]
Initialize Particle で Lifetime を設定しても、実際にパーティクルを消滅させる仕組み（Particle State モジュール、Particle Update ステージ）が別途無いと反映されない。Niagara は「値の設定」と「その値を実際に評価・適用するモジュール」が分離しているため、**値を変えたのに挙動が変わらない場合は「評価側のモジュールが有効か」を疑う**のが基本デバッグ手順。

## SCRAP BLITZ に活かせる部分

戦闘 FX（ヒット・爆発・延焼・粉塵等）制作と MCP 自動化への直結ポイント:

- **MCP の `AddModule` 呼び出し順は「ステージ選び」に対応する** — 本チュートリアルの Emitter Update→Spawn Rate、Particle Spawn→Initialize Particle/Add Velocity、Particle Update→Particle State という配置パターンは、MCP で `AddModule` する際に「どのグループ（Spawn/Update）に足すか」を明示的に選ぶ判断基準そのもの。ヒット FX なら「発生時に一度だけ吹き飛ばす初速」は Particle Spawn 側、「延焼のように継続してダメージ/色が変化する」ようなものは Particle Update 側に対応するモジュールを置く発想が使える [05:38–05:58]
- **Lifetime を設定しただけでは消えない**という罠 [04:07–05:29] は、MCP でパーティクルシステムを組む際に**必ず Particle State（またはそれに相当する寿命終了処理）を Particle Update に足し忘れない**というチェックリスト項目にできる。爆発・ヒットスパーク等の一過性 FX で「消えないパーティクル」バグが出たらまずここを疑う
- **Random Range Vector による速度のばらつき** [07:53–08:23] は、爆発の破片飛散や粉塵の拡散に直接応用できる考え方（最小値/最大値ベクトルで方向・強さをランダム化）
- **Velocity Mode の Cone** [08:45–09:08] は、爆発の円錐状拡散や火花の指向性表現に使える設定
- **Sprite Attributes の Random Uniform / Non-uniform サイズ** [10:51–12:22] は、粉塵・火花のサイズばらつきによる「均一すぎて安っぽく見える」問題の回避に直結
- **色を Random Range で 2 色の中間にする** [10:28–10:45] は、炎（赤〜オレンジ）や延焼エフェクトの色ばらつきに応用できる
- **エラー時の「Fix Issue」ワンクリック補完** [03:10, 06:14–06:23] は、MCP 経由でモジュール追加した際に依存関係エラーが出るケースの理解に役立つ（GUI 操作の裏で何が起きているかの参考）

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Emitter Update | Spawn Rate（初期値/変更後） | 1/秒 → 5/秒 | [03:18–03:23][06:57–07:04] |
| Particle Spawn | Initialize Particle: Color | 赤 | [03:52–03:57] |
| Initialize Particle | Particle Lifetime（動画内テスト値） | 1秒 → 0.5秒 | [04:17][10:11–10:16] |
| Particle Spawn/Update | Add Velocity: X/Y | 各50 | [06:25–06:52] |
| Add Velocity | Random Range Vector 最小/最大 | -100 / 100（各軸） | [08:05–08:11] |
| Add Velocity | Velocity Mode: Point 速度 | 50 → 200 | [08:35–09:00] |
| Add Velocity | Cone Angle | 10 | [09:02–09:08] |
| Add Velocity | Velocity Scale | 1（デフォルトに戻す） | [09:35–09:48] |
| Timeline | プレビュー再生時間 | 10秒（例で5秒に変更可） | [07:16–07:37] |

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- モジュール追加時に実際にどのメニュー階層をクリックしているか（「新しいモジュールを追加」のサブメニュー構成）は音声のみでは不明瞭 [03:03, 05:53–06:10]
- Sprite Attributes の Size/Rotation Mode の UI 上のドロップダウン項目名の正確な英語表記（字幕は日本語訳のため、UI 上の実際の英語ラベルは要確認）[10:51–13:02]
- Particle State モジュールの具体的な設定項目名・チェックボックスの正確な位置 [04:51–05:11]
- Fix Issue ボタンが実際にどのモジュールを自動追加したかの詳細（「必要な関連情報を自動的に追加」としか字幕になし）[03:12–03:18]

---

内容サマリ:
本動画は Niagara の最小構成（空の System → Emitter → 5 ステージへのモジュール追加）をゼロから組む入門編。System/Emitter/Module/Renderer の階層関係と、Emitter Spawn・Emitter Update・Particle Spawn・Particle Update・Renderer という5ステージの役割分担が核。「Lifetime を設定しただけでは消えない、Particle State モジュールが別途必要」という設定と評価の分離が最大の学びどころ。Add Velocity のモジュール配置（Spawn=初速 vs Update=継続加算）や Random Range Vector、Cone モード、Sprite のサイズ・色バリエーションなど、戦闘 FX の基礎パーツがひと通り扱われている。

監査用: 確信度が低い順3件
1. [10:51–13:02] Sprite Attributes の各モード名（Uniform/Non-uniform/Random Uniform 等）は日本語字幕からの逆翻訳であり、UI 上の正式な英語表記と一致するか未確認
2. [04:51–05:11] Particle State モジュールの具体的操作（チェックボックスの意味・位置）は字幕の説明が簡潔で、実際の UI 挙動の解釈にやや推測が入っている
3. [03:10–03:18] 「Fix Issue」クリックで自動追加される「関連モジュール」の中身が不明なため、Spawn Rate 追加時の依存関係の詳細は断定していない
