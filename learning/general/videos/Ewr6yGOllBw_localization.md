# 学習ノート — How to Easily Translate and Localize your Game In Unreal Engine 5 Tutorial

- 動画: https://www.youtube.com/watch?v=Ewr6yGOllBw （9:01）
- 学習日: 2026-07-04 / 抽出: 英語自動字幕(en-orig) → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/Ewr6yGOllBw.txt](../transcripts/Ewr6yGOllBw.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

1. **翻訳対象を用意** [00:38–01:29] — Third Person テンプレートに Text Renderer actor を追加し "hello" というテキストを設置。講師の注記：Unreal は **Text 型の要素/変数のみ翻訳する**。String 型の要素は翻訳されない [01:13–01:28]。
2. **Project Settings でパッケージ言語を設定** [01:30–03:16]
   - `Edit > Project Settings > Packaging > Advanced` を開く [01:33–01:48]
   - パッケージ時に含める言語一覧が並ぶ。English はデフォルトでチェック済み [01:50–01:57]
   - 英語の方言（English (Australia) / (Barbados) 等）も個別選択可能 [01:59–02:07]
   - 今回は Spanish を選択 [02:11–02:15]。方言まで個別に選ばず「Spanish」本体だけ選べば下位の方言は自動で含まれる [02:18–02:26]
   - 方言を出したくない場合は **Show Localized** を有効にする（Spanish 選択時に全方言が「Spanish」カテゴリの下にまとめられる）[02:33–02:49]
   - **Internationalization Support** を `All` に変更 [02:52–02:59]。デフォルトは English のみ。対応言語が European 系だけなら該当プリセット、Chinese/Japanese/Korean のような CJK 系ならそのプリセットもあるが、**多言語展開するなら All を選ぶのが安全**という判断 [02:59–03:14]
3. **Localization Dashboard でテキストを収集** [03:17–04:44]（`Tools > Localization Dashboard`）
   - `Gather from packages` を展開 → `Include Path Wildcards` → `Add Element` でスキャン対象フォルダを指定。今回は Content フォルダ全体を指定 [03:39–04:07]
   - `Add New Language` から Spanish を検索して追加。追加時に **Native to English = Yes** を必ず選択**（=このプロジェクトの基準言語=Englishであることを明示する設定）[04:12–04:32]
   - `Gather Text` → `Save Everything` を実行し、Content フォルダ内の全テキスト要素を収集 [04:34–04:44]
4. **翻訳を入力** [04:46–05:44]
   - `Edit Translations for this Culture` を開くと、収集された Text 要素の一覧（例：さきほどの "hello"）が表示される [04:50–05:04]
   - 各要素に対して翻訳文を入力・保存。"hello" → "hola" と入力 [05:12–05:22]
   - ダッシュボードに戻ると **Completed Translations** として翻訳済み件数が反映される [05:26–05:35]
5. **特定要素を翻訳対象から除外する方法** [05:43–06:16]
   - Text Renderer 上の小さいフラグアイコンをクリックすると **Localize** チェックボックスが表示される [05:57–06:04]
   - これを外しておくと、次回の Gather Text 時にこの要素は収集されない（＝翻訳対象にならない）。デフォルトはチェック済み [06:04–06:16]
6. **翻訳のコンパイル** [06:17–06:33] — Localization Dashboard で `Compile Text` を実行。プロジェクト内の全翻訳をコンパイルする [06:22–06:30]
7. **テスト方法の注意** [06:35–06:58] — **PIE（Play in Editor）では翻訳言語切替は機能しない**。Standalone Game でのみ正しくシミュレートされる、と講師が明言 [06:39–06:53]
8. **Blueprint での動的言語切替** [06:58–08:16]（Level Blueprint 上に実装）
   - キー入力（1キー）→ `Set Current Culture` ノードに `es`（Spanish の culture code）を渡す [07:04–07:45]
   - culture code は Localization Dashboard で各言語にマウスオーバーすると確認できる（Spanish=`es`）[07:24–07:34]
   - キー入力（2キー）→ 同ノードに English の culture code（"en" ※字幕上明瞭に読み取れず、文脈上 en と推定）を渡して英語に戻す [07:47–07:56]
   - `Set Current Culture` ノードを展開し **Save to Config** を有効にすると、切り替えた言語がセーブされ次回起動時も保持される [07:58–08:09]
9. **Standalone Game で最終確認** [08:11–08:30] — Compile → Standalone Game で Play → 1キーで Spanish（"hola" 表示）→ 2キーで English に戻ることを確認 [08:16–08:30]

## クオリティを上げる教訓（判断基準・なぜそうするか）

- **Text型 と String型 の使い分けが翻訳可否を決める** [01:13–01:28] — UI/表示テキストは必ず Text 型で持たせる。String型は翻訳パイプラインの対象外になるため、ローカライズ予定がある文字列は最初から Text 型で設計する必要がある。
- **Internationalization Support は迷ったら `All`** [02:59–03:14] — 対応言語が絞られている場合は該当プリセット（European / CJK 等）でも良いが、**多くの言語に対応させる予定なら All を選ぶことで将来の言語追加時の互換性トラブルを避けられる**という判断基準。
- **Native to English は基準言語宣言として必須** [04:22–04:32] — 新しい言語を追加する際、「これは英語を基準にした翻訳か」を明示する設定。講師は "very important" と強調しており、ここを飛ばすと翻訳の基準がずれる（＝逆に英語側が翻訳対象と誤認される等の混乱を招く可能性）。
- **Show Localized で方言の氾濫を防ぐ** [02:33–02:49] — 方言まで律儀に全部チェックすると管理項目が増えるだけなので、"show localized" を使い上位言語カテゴリに集約するのが実務的。
- **翻訳除外は Localize チェックボックスで局所制御** [06:04–06:16] — 全部を機械的に収集するのではなく、翻訳したくない要素（固有名詞・ロゴテキスト等を想定）は個別にフラグで除外できる。翻訳ワークフローの粒度を要素単位で制御可能。
- **PIE では翻訳系の挙動をテストできない** [06:39–06:53] — 動作確認は必ず Standalone（＝パッケージ後の実行に近い環境）で行う。ここを知らずに PIE で「翻訳が反映されない」と誤診断するのを防ぐ重要な注記。
- **Save to Config で言語設定を永続化** [07:58–08:09] — プレイヤーが選んだ言語をセッションを跨いで記憶させるには明示的にこのオプションを有効にする必要がある（デフォルトでは保持されない、という含意）。

## 主要な機能・設定値の表

| 機能・設定項目 | 場所 | 値・操作 | タイムスタンプ |
|---|---|---|---|
| パッケージ対象言語 | Project Settings > Packaging > Advanced | English がデフォルト、Spanish 等を追加チェック | [01:44–02:15] |
| 英語方言オプション | 同上 | English (Australia) / (Barbados) 等を個別選択可 | [01:59–02:07] |
| Show Localized | 同上 | 有効化で方言を上位言語カテゴリに集約表示 | [02:33–02:49] |
| Internationalization Support | 同上 | `All` を選択（多言語対応時の推奨） | [02:52–03:14] |
| Localization Dashboard | Tools > Localization Dashboard | 収集・言語追加・翻訳編集・コンパイルの中心画面 | [03:30–03:35] |
| Gather from packages > Include Path Wildcards | Localization Dashboard | Add Element で Content フォルダを指定 | [03:39–04:07] |
| Add New Language | Localization Dashboard | 言語名で検索して追加、Native to English = Yes | [04:10–04:32] |
| Gather Text / Save Everything | Localization Dashboard | テキスト収集の実行ボタン | [04:34–04:44] |
| Edit Translations for this Culture | Localization Dashboard | 収集済みText要素への翻訳文入力画面 | [04:48–05:22] |
| Localize チェックボックス（フラグアイコン経由） | 各 Text 要素（Text Renderer 等） | 個別要素を Gather 対象から除外（デフォルト有効） | [05:57–06:16] |
| Compile Text | Localization Dashboard | 翻訳データのコンパイル | [06:22–06:30] |
| Set Current Culture（Blueprint ノード） | Level Blueprint 等 | culture code（例: `es`=Spanish）を渡して即時切替 | [07:15–07:45] |
| culture code 確認方法 | Localization Dashboard | 各言語行にマウスオーバーで表示（Spanish=`es`） | [07:24–07:34] |
| Save to Config | Set Current Culture ノード展開オプション | 有効化で言語設定を永続化 | [07:58–08:09] |
| テスト環境 | — | PIE 不可、Standalone Game でのみ有効 | [06:39–06:53] |

## SCRAP BLITZ に活かせる部分

- **既存 i18n（辞書ベース・日本語運用）から UE StringTable/Text 型体系への移行方針**: Three.js プロトタイプ側は辞書ベースの簡易 i18n だったが、UE では「Text型変数のみが翻訳パイプラインに乗る」[01:13–01:28] という制約が根本的に異なる。UI 文字列・チップ名・フレーバーテキストを UMG / Blueprint に移す際は、**すべて FText（Text型）として保持する設計を最初から徹底する必要がある**。String型のまま残す実装（デバッグ表示・内部ID等）と、翻訳対象になる表示用テキストを型レベルで明確に分離するのが移行時の要点。
- **想定4言語（英語/簡体字/繁体字/ハングル）は Internationalization Support = `All` が妥当** [02:52–03:14] — CJK+ハングル+英語という組み合わせは動画内の言及する「Chinese/Japanese/Korean プリセット」では簡体字・繁体字・ハングルを跨ぐ構成のカバレッジが不明瞭なため、講師の判断基準（多言語なら All を選ぶ）がそのまま当てはまる。
- **PixelMplus12 との互換性は要検証（本動画では未言及）**: 動画はフォント差し替えに一切触れていないため、CJK/ハングルグリフの表示切替（フォント側の Culture 別 Fallback 設定等）は本ノートの範囲外。既存採用の PixelMplus12 は日本語 TTF だが、簡体字・繁体字・ハングルのグリフを含むかは別途確認が必要（このノートの transcript には根拠なし）。UE の Localization Dashboard 自体はテキスト収集・翻訳管理の話であり、フォントの Culture 別切り替え機構（Font本体の Fallback や Composite Font）は別トピックとして次の学習対象候補になる。
- **チップ名・フレーバーテキスト等の既存文字列の移行時の粒度制御**: 「Localize チェックボックスで要素単位に翻訳対象を除外できる」[05:57–06:16] 機構は、固有名詞的なもの（キャラ名・チップの記号的な短縮名など翻訳したくない文字列）を個別に除外する際にそのまま使える。全文字列を一律収集するのではなく、翻訳除外リストの運用を早期に決めておくと後工程が楽になる。
- **翻訳ワークフローの検証は必ず Standalone/パッケージ後の環境で行う** [06:39–06:53] という注記は、UE エディタでの動作確認習慣（本プロジェクトは UE5.8 に完全移行済み）に直結する。ローカライズ機能を実装した際、PIE でテストして「反映されない」と誤診断しないよう、確認手順に「Standalone Game でのカルチャー切替テスト」を組み込む必要がある。
- **Set Current Culture + Save to Config によるランタイム言語切替**[07:15–08:09] は、ゲーム内の言語設定オプション（本動画冒頭のメインメニュー言語ボタンに相当）をそのまま実装パターンとして流用できる。プレイヤーが設定画面で言語を選ぶ→即時反映→次回起動時も保持、という一連の挙動がこのノード一つでカバーされる。

## 字幕だけでは取れなかったもの

- [07:53–07:56] 2キー押下時に渡す English の culture code の実際の文字列。字幕は "type in Ian" と書き起こされており不明瞭（文脈上おそらく `en` だが、自動字幕の誤認識の可能性が高く断定できない）。※推定
- [02:20–02:26] "different dialects" を選択した場合に実際にどの言語コードがパッケージに含まれるかの詳細な一覧（画面のチェックボックス群の中身は字幕に現れず、UI操作の視覚情報が必要）
- フォント差し替え・Composite Font・言語別フォント Fallback の設定方法は本動画では一切扱われていない（動画のスコープ外。タイトル通りテキスト収集・翻訳・カルチャー切替が主題で、フォント側の話は含まれない）
