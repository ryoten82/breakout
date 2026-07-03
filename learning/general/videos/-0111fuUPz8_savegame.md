# 学習ノート — How to Easily Save Games with SaveGame Objects in Unreal Engine (Demo and Guide)

- 動画: https://www.youtube.com/watch?v=-0111fuUPz8 （14:02）
- 学習日: 2026-07-04 / 抽出: 英語自動字幕(en-orig) → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/-0111fuUPz8.txt](../transcripts/-0111fuUPz8.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

1. **デモ（完成形の挙動確認）** [00:00–00:46] — Health/Speed/Hat（着用アイテム）を持つプレイヤーで、Speed を1000に変更・ダメージを与えて Health を減少・帽子を frog hat に変更した状態で Save。位置を移動後、帽子をなしに変更し Health を増加させてから Load すると、Health・Speed・帽子・プレイヤーの位置が保存時点に復元される。Delete を押すとセーブが削除され、次回プレイ時はデフォルトステータスでセンター位置から開始する [00:00–00:46]。
2. **SaveGame Blueprint の作成** [01:27–01:56] — Content Browser で右クリック → Blueprint Class → All Classes 内から `Save Game` を検索して選択・作成 [01:27–01:41]。作成した Blueprint（例: BP Example Save）の中に、保存したい変数をすべて用意する。今回の例では Health・Speed・着用中の Hat・Location・Rotation の5変数 [01:43–01:56]。
3. **どこで Create/Load するかの設計判断** [01:57–03:07] — 講師は過去作を例に、Save/Load ロジックの置き場所を比較している。
   - 過去作「Purpose Fun Zone」（小規模プロジェクト）: First-Person Character 内で Create/Load を完結させていた [02:06–02:19]
   - 過去作「Magma Island」（より大規模）: Game Instance 内で Create/Load するように変更。より柔軟な方式と判断 [02:19–02:34]
   - Game Instance の性質: アプリケーションの生存期間全体で存続する persistent object。ゲーム起動と同時に生成される [02:36–02:50]。Level Blueprint や Game Mode と異なり、レベル間を移動しても Game Instance 内の情報は保持される。この性質のため save game data の保存場所として適している、というのが講師の判断根拠 [02:50–03:07]。
4. **Game Instance Blueprint の作成** [03:08–03:29] — blueprints フォルダで右クリック → Blueprint Class → `Game Instance` を選択・作成。例: `BP Third Person Example Game Instance` [03:08–03:29]。
5. **Event Initialize でセーブの存在確認 → Create or Load** [03:29–04:33]
   - Game Instance の Event Graph で `Event Initialize` を配置。ゲーム開始と同時に実行される [03:29–03:38]
   - `Does Save Game Exist` ノードを使用。スロット名は変数化しており、例では変数名 `slot one` に値 `save` を持たせている（＝スロット名 "save" の存在確認）[03:38–03:53]
   - セーブが**存在しない**場合: `Create Save Game Object` ノードで対象の Save Game クラス（例: BP Example Save）を指定して生成 [03:53–04:11]
   - セーブが**存在する**場合: `Load Game from Slot` ノードでスロット "save" から読み込み、結果を対象の Save クラスに Cast し、変数として保持（＝Game Instance 内に Save への参照を確保）[04:12–04:33]
6. **Blueprint Function Library でどこからでも参照可能にする** [04:33–06:04]
   - 右クリック → Blueprint → `Blueprint Function Library` を選択・作成。任意の Blueprint から呼び出せる関数群の置き場所 [04:39–04:55]
   - 内部に「Game Instance を取得する関数」を1つ作成: `Get Game Instance` ノード → 自分の Game Instance クラス（例: Third Person Example Game Instance）に Cast → 右クリックで `Convert to Pure Cast` → Return Node に接続し、Pure Function 化 [04:57–05:24]
   - この Pure Function（例: `Get Third Person Game Instance`）を Third Person Character・Level Blueprint など任意の場所から呼び出すことで、Game Instance 経由の Save 参照（`Get Save Game Reference`）にどこからでもアクセスできるようになる [05:25–06:04]
7. **正しい Game Instance が使われているかの確認** [06:06–06:29] — `Edit > Project Settings` → 検索欄で "game instance" → `Game Instance Class` の項目で、作成した Game Instance が選択されているか確認。ここが正しくないとシステム全体が機能しない、と講師が明言 [06:06–06:29]。
8. **保存処理の実装（Widget Blueprint のボタン経由）** [06:30–10:31]
   - 動作確認用に Health・Speed・Hat 着用状況の表示と、Save/Load/Delete ボタンを持つ Widget Blueprint を用意 [06:42–06:57]
   - Save ボタンの On Click → Blueprint Function Library 経由で Game Instance を参照 → Game Instance 内の `Save Player Stats` 関数を呼び出す [07:03–07:22]
   - `Save Player Stats` 関数内部: Save Game Reference を取得し、`Set Speed` 等のノードで保存したい値をセットしていく（Speed・Health・Hat・Location・Rotation 全てをセット）[07:31–08:59]
   - 値をセットしただけでは保存されないため、別途 Game Instance 内に `Save Game` という関数を用意。中身は `Save Game to Slot` ノード1つで、Save 参照とスロット名を渡すだけ [07:55–08:17]
   - 全体の流れ: Save Game Reference 取得 → 各値を Set → Save Game 関数呼び出し（＝Save Game to Slot 実行）という2段階 [08:19–08:26]
   - `Save Game to Slot` は Save Player Stats 関数の中に直接書くことも可能（講師が実演）。スロット名は変数化しておくとタイプミスが減り安全、という判断 [08:27–08:53]
   - **部分保存の例**: 全項目を保存する代わりに、特定の値だけを保存する関数も作れる。例として `Save Player Speed` 関数を作成し、Speed のみを保存 [09:12–09:31]。Widget 側からもこの部分保存関数を個別に呼び出せる [09:31–09:44]
   - 関数化は必須ではなく、直接ノードを組んでインラインで実装することも可能（講師が実演）。関数にまとめるのは「その方がすっきりしてミスが減るから」という運用上の理由 [09:46–10:31]
9. **読み込み処理の実装** [10:32–12:22]
   - Load ボタン → カスタムイベントを起動 → Third Person Game Instance 参照 → Save を取得 → Save 内の全情報（Health・Speed・Hat・Location・Rotation）を取得 [10:38–10:59]
   - Speed の反映例: Widget 内に `Update Player Speed` というカスタムイベントを用意。Widget が保持しているプレイヤーキャラクターへの参照（Character Movement コンポーネント経由）に Speed をセットし、あわせて Widget 上の Speed 表示スライダーの値も更新 [11:01–11:46]
   - Widget がプレイヤーキャラクターへの参照を持つ仕組み: Third Person Character の `Event Begin Play` で Widget を Create する際、Widget が持つ変数にプレイヤーキャラクター自身の参照をセットしている [11:14–11:33]
   - Health・Hat・Location・Rotation も基本的に同じパターンで読み込み・反映を行う [11:52–12:06]。Hat の場合はプレイヤー側に「着用中の帽子を更新する関数」を用意し、Load 時にその関数を呼び出して見た目を反映 [12:24–12:41]
10. **削除処理の実装** [12:43–13:08] — Delete ボタン → Game Instance 参照 → Game Instance 内の `Delete Save Game` 関数を呼び出す。中身は `Delete Game in Slot` ノードにスロット名を渡すだけ [12:43–13:08]。

## クオリティを上げる教訓（判断基準・なぜそうするか）

- **Save/Load ロジックの置き場所はプロジェクト規模で変えるべき** [02:06–02:34] — 小規模プロジェクトなら Character 内に直接書いても問題ないが、プロジェクトが大きくなるほど柔軟性が必要になる。講師は自身の過去作2本（小規模 Purpose Fun Zone vs 大規模 Magma Island）を比較し、大規模化するにつれ Character 内実装から Game Instance 実装へ移行したと述べている。
- **Game Instance を選ぶ理由は「レベルを跨いでも生存する」という一点** [02:36–03:07] — Level Blueprint・Game Mode はレベルごとにリセットされるが、Game Instance はアプリケーション生存期間全体で persistent。セーブデータのようにレベル遷移をまたいで保持すべき情報は Game Instance に置くのが自然、という設計判断の根拠。
- **Blueprint Function Library で「どこからでもアクセス可能」を実現する** [04:33–04:55] — Game Instance への参照取得を Pure Function として1箇所にまとめておくことで、Character・Widget・Level Blueprint など呼び出し側のロジックを重複させずに済む。Pure Cast にしているのも、値を返すだけで実行ピンを消費しない（＝ノードがすっきりする）ための工夫 [05:14–05:24]。
- **スロット名は変数化する** [08:42–08:53] — 文字列を直接タイプするのではなく変数として持たせることで、タイプミスによるバグ（存在しないスロット名を参照してしまう等）を防げる、という講師の明言。
- **関数化は必須ではないが「クリーンさ」のためにやる** [09:46–10:31], [10:24–10:31] — Save Game to Slot 等は直接インラインで組むこともできるが、講師は繰り返し「関数にした方がすっきりしてミスが少ない」という理由で関数化を選んでいる。機能的な必須要件ではなく、保守性のための設計選択だと明示している。
- **保存項目は用途に応じて全体保存/部分保存を使い分けられる** [09:12–09:44] — 全データをまとめて保存する関数（Save Player Stats）とは別に、特定の値だけを保存する関数（Save Player Speed）を用意することで、「今この操作ではこの値だけ確定させたい」という場面に対応できる。
- **Project Settings の Game Instance Class 設定を忘れると全体が機能しない** [06:06–06:29] — Game Instance Blueprint を作成しただけでは反映されず、プロジェクトが実際にそのクラスを使うよう明示的に設定する必要がある。講師は "otherwise this won't work" と明言しており、詰まりやすいポイントとして強調している。

## 主要な機能・設定値の表

| 機能・設定項目 | 場所 | 値・操作 | タイムスタンプ |
|---|---|---|---|
| Save Game Blueprint 作成 | Content Browser 右クリック > Blueprint Class > All Classes | `Save Game` を検索・選択 | [01:29–01:41] |
| 保存対象変数の例 | Save Game Blueprint 内 | Health, Speed, Hat, Location, Rotation | [01:48–01:56] |
| Game Instance の性質 | — | アプリ生存期間全体で persistent、レベルを跨いで情報保持 | [02:36–03:07] |
| Game Instance Blueprint 作成 | Content Browser 右クリック > Blueprint Class | `Game Instance` を検索・選択 | [03:15–03:24] |
| Event Initialize | Game Instance Event Graph | ゲーム開始時に実行されるイベント | [03:29–03:38] |
| Does Save Game Exist | Game Instance Event Initialize 内 | スロット名を渡して存在確認、結果を変数化 | [03:38–04:00] |
| Create Save Game Object | セーブ非存在時の分岐 | 対象 Save Game クラス（例: BP Example Save）を指定して生成 | [04:01–04:11] |
| Load Game from Slot | セーブ存在時の分岐 | スロット名を渡して読み込み、対象クラスに Cast して変数化 | [04:14–04:32] |
| Blueprint Function Library 作成 | Content Browser 右クリック > Blueprint | `Blueprint Function Library` を選択 | [04:51–04:55] |
| Get Game Instance → Cast → Convert to Pure Cast | Function Library 内の関数 | Pure Function 化して Return Node に接続 | [05:03–05:24] |
| Game Instance Class 設定 | Edit > Project Settings（検索: "game instance"） | 作成した Game Instance を選択 | [06:13–06:25] |
| Save Player Stats（関数） | Game Instance 内 | Save Game Reference 取得 → 各値を Set | [07:17–07:53] |
| Save Game（関数） | Game Instance 内 | `Save Game to Slot` ノード（Save 参照＋スロット名） | [08:02–08:17] |
| Save Game to Slot（ノード） | Game Instance 内 | Save 対象参照とスロット名を接続して実行 | [08:34–08:53] |
| 部分保存の例（Save Player Speed） | Game Instance 内 | Speed のみをセット・保存する専用関数 | [09:24–09:31] |
| Update Player Speed 等（カスタムイベント） | Widget Blueprint 内 | Load 時にプレイヤー参照へ値を反映＋UI更新 | [11:01–11:46] |
| Widget → プレイヤー参照の確立 | Third Person Character の Event Begin Play | Widget Create 時に変数へ自身の参照をセット | [11:14–11:33] |
| Delete Save Game（関数） | Game Instance 内 | `Delete Game in Slot` ノードにスロット名を渡す | [12:53–13:08] |
| 保存/読込対応データ型 | — | Unreal Engine の任意の変数型を保存・読込可能（講師の総括） | [13:20–13:23] |

## SCRAP BLITZ に活かせる部分

- **永続化データの置き場所として Game Instance 経由の SaveGame 構成がそのまま適用できる**: SCRAP BLITZ は CR（通貨）・機体LV進行（2段階）・OC 選択状況・ステージ進行状況などセッションをまたいで保持すべきデータを多数持つプロジェクトだが、現状のセーブ/永続化実装状況は本ノート作成時点では未確認（要現況確認）。動画で示された「Game Instance が Save Game への参照を保持し、Blueprint Function Library 経由でどこからでもアクセス可能にする」という構成 [02:36–03:07], [04:33–06:04] は、CR・機体LV・OC 所持状況といった複数システムから読み書きされるデータの置き場所として素直に転用できる設計。
- **全体保存 vs 部分保存の使い分けは CR/機体LV/OC の更新頻度差に対応できる**: 動画の `Save Player Stats`（全項目保存）と `Save Player Speed`（Speed のみ保存）の使い分け [07:17–07:53], [09:12–09:44] は、SCRAP BLITZ で例えば「CR 獲得のたびに全データを保存し直すのは重い」場合に、CR だけを更新する軽量保存関数を別途持つ、といった設計の参考になる。ただし現状の永続化実装（Three.js プロトタイプ期の localStorage 等）との対応関係は本ノートでは断定せず、要現況確認とする。
- **スロット名の変数化はセーブスロット運用（周回・複数セーブ枠等）の土台になる**: スロット名をハードコードせず変数として扱う設計 [08:42–08:53] は、将来的に複数セーブスロットやエンドレスモード（デスマーチ）用の別スロットなどを検討する際の基本パターンとして使える。
- **Does Save Game Exist による初回起動判定**: `Does Save Game Exist` → 存在しなければ `Create Save Game Object`、存在すれば `Load Game from Slot` という分岐 [03:38–04:32] は、初回プレイ時にデフォルト状態（CR=0、機体LV初期値等）で開始し、2回目以降は永続化データを引き継ぐという roguelite の基本フローにそのまま対応する。
- **Delete Game in Slot によるセーブ削除**は、SCRAP BLITZ でプレイヤーがセーブデータをリセットしたい場合（デバッグ用途・進行リセット機能等）の実装パターンとして流用可能 [12:53–13:08]。
- **保存対象データ構造の設計は SaveGame Blueprint 内の変数群としてシンプルに列挙する形**でよいことが分かる [01:48–01:56]。CR・機体LV・OC 所持リスト・ステージ進行状況等を SaveGame クラス内の変数として素直に並べる設計で対応可能と考えられる（※推定: 動画では単純な値型のみの例で、配列やより複雑な構造体を保存する例は扱われていない）。

## 字幕だけでは取れなかったもの

- [03:38–03:53] スロット名を保持する変数名について、字幕上は「slot one」という命名として書き起こされているが、実際の変数名表記（`Slot1` 等の可能性）は画面を見ないと確定できない。※推定
- [09:57–10:01] 部分保存の実演部分で "I could just" のあとの具体的なノード操作手順が字幕の言い回しだけでは机上のノード配置まで再現しきれない。実演の画面操作（どのピンからどこへドラッグしたか）は視覚情報が必要。
- 動画全体を通じて **Async 版のノード（Async Save Game to Slot 等）への言及は一切ない**。今回の実装は同期版の `Save Game to Slot` / `Load Game from Slot` のみが使われており、大容量データや高頻度呼び出し時のパフォーマンス配慮（Async 化の要否）については講師のコメントが transcript 中に存在しない。
