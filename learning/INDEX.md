# 学習部屋 — 目次

動画から UE5 制作の知識を抽出し、テストレベルで検証して本番へ昇格させる部屋。
背景から始めたが FX 等の全ドメインに転用（2026-07-03 ユーザー決定）。
方針: 学習 → テストレベル/テストアセットで実験 → 効果確認できたものだけ本番へ昇格（ユーザー判断）。

## アクセス規約（トークン節約・必読）

- **メインモデルが読んでよいのは本 INDEX と各ドメインの doctrine（3KB 上限）だけ**
- `<domain>/videos/` の個別ノートの深掘りは **Sonnet サブエージェントに読ませて要点だけ返させる**（メイン context で全文 Read しない）
- `<domain>/transcripts/` は監査用原典。grep で該当タイムスタンプ周辺を覗く用途のみ。全文 Read 禁止
- 新規動画のノートは**差分主義**: 既存 doctrine と重複する内容は書かず、新出テクニックのみ（1 本 数 KB 目安）
- 新知見は動画ノートに溜めず、その都度 doctrine に 1〜2 行で昇格。doctrine が 3KB を超えたら圧縮
- memory への登録は部屋の場所を示す 1 行のみ。学習内容の書き写し禁止
- 動画選定基準: **講師が「なぜそうするか」を喋る解説動画のみ**（無言タイムラプスは収穫ゼロ）。作業フェーズに合わせて just-in-time で追加。ユーザーは候補をざっと投入してよく、**学習価値が低い（既習と大半重複・判断基準の言語化なし）と Claude が判断したらスキップ記録のみで OK**（2026-07-03 ユーザー承認）
- 字幕の質 > 言語。優先順位: ①英語音声+英語**手動**字幕（母数・精度とも最良）②日本語音声+日本語**手動**字幕。**避ける: 自動翻訳字幕**（音声認識→機械翻訳の二重劣化）。投入前に `yt-dlp --list-subs <URL>` で手動字幕（manually written）の有無を確認
- モデル運用: **本部屋のメインセッションは Opus を使わない（2026-07-03 ユーザー判断・[[feedback_opus_excluded_video_learning]]）**。定常の動画投入（字幕取得〜Sonnet 抽出〜grep 監査）は **Sonnet 5 セッション**で行う（本 INDEX のテンプレで再現できる）。**doctrine への蒸留・取捨選択・実験計画への反映は Fable（上位モデル）**が担当。数本溜めてから Fable が一括レビューでよい

## ドメイン構成

### bg/ — 背景（16 本学習済・2026-07-03）
- **[bg/bg_technique_doctrine.md](bg/bg_technique_doctrine.md)** — 蒸留版 v2（日常はこれだけ読む）
- [bg/playlist_inventory.md](bg/playlist_inventory.md) — 動画目録・学習状況
- 個別ノート 16 本 = 環境系 3 + Starter Course 4 + フォグ/水中/スタイライズ + 工事現場（set dressing の本命）+ **Epic 公式 Medieval 最適化 5**（計測駆動 / Lights&Shadows / HLOD / Landscape+LayerBlendHeight / RVT）
- [bg/applications/bgtest01_experiment_plan.md](bg/applications/bgtest01_experiment_plan.md) — L_BGTest01 実験 E1〜E6（UE エディタ起動待ち）

### fx/ — エフェクト（1 本学習済・2026-07-03）
- doctrine: 未作成（2〜3 本溜まったら蒸留）
- [fx/videos/hnUQiwJweeg_niagara-intro.md](fx/videos/hnUQiwJweeg_niagara-intro.md) — Niagara 入門（日本語公式・Fable 照合済。5 ステージ役割分担・Particle State 必須の消滅仕様・Add Velocity のステージ配置で初速/継続加算が変わる）

### ui/ — ゲーム UI（0 本・2026-07-03 新設）
- doctrine: 未作成。UMG/HUD 系動画の投入待ち

### core/ — 汎用エディタ・UE バージョン差分（1 本学習済・2026-07-03）
- **[core/core_technique_doctrine.md](core/core_technique_doctrine.md)** — 蒸留版（Starter Content 削除・Fab plugin デフォルト無効・Fab アセットのバージョン対応注意）
- [core/videos/57yLCKqC9m8_ue58-getting-started.md](core/videos/57yLCKqC9m8_ue58-getting-started.md) — UE5.8 Getting Started 1h37m（差分ノート・Fable ペア照合済。9割は既習と重複のためスキップ、5.8 固有差分のみ抽出）

## 動画追加の手順テンプレート

1. **字幕確認 → 取得**: まず `python -m yt_dlp --list-subs <URL>` で手動字幕の有無を確認。`--write-subs`（手動）を最優先し無ければ `--write-auto-subs`（自動）で可＝用語崩れ前提で監査を厚めに。取得: `python -m yt_dlp --skip-download --write-subs --write-auto-subs --sub-langs en -o sub_<ID> <URL>`（日本語動画は `--sub-langs ja`。429 が出たら `--sleep-requests 10 --retries 5 --retry-sleep 30`）
2. **整形**: scratchpad の `vtt2txt.py`（無ければ本手順の下に再掲あり※）で `.vtt` → タイムスタンプ付きテキスト。最終タイムスタンプが動画長と整合するか確認 → `<domain>/transcripts/<videoID>.txt`
3. **Sonnet 委譲**（30 分超の動画はチャンク分割・並列も可）: 見本ノート（bg/videos/ee-IOlWUZTo）の構成踏襲・全項目タイムスタンプ必須・「※推定」明記・プロジェクト文脈を prompt に含め「活かせる部分」を書かせる。最終メッセージに「確信度が低い抽出 3 件」を自己申告させる
4. **Fable 監査**: 申告 3 件 + 新出の核心概念を transcript と grep 照合（幻覚チェック）
5. **doctrine へ蒸留**・目録更新

※ vtt2txt.py が消えていたら: WEBVTT のタイムスタンプ行から [MM:SS] を作り、タグ除去・ロールアップ重複行 dedup するだけの 30 行スクリプト。過去セッションの transcript 形式を見て再作成

## 運用知見

- 自動字幕でも工程・判断基準・パラメータの大半は取れる（幻覚はスポットチェックで未検出）。取れないのは画面コピペ操作と視覚センス
- UE 用語の字幕崩れ（Fage→foliage 等）は Sonnet が文脈復元可能。数値崩れは「※推定」で残し実験時に実値検証
- 日本語公式字幕は英語自動字幕より高信頼
- 第 2 段階構想: ffmpeg キーフレーム抽出 → 画像ごと学習（視覚依存分野=モーション・造形で有効）。背景運用が安定してから
- コスト実測: 1 本 ≒ Sonnet 5〜7 万トークン + 監査 grep 数回。読み込み側は INDEX + doctrine で頭打ち
- **完了通知が唯一の完了根拠**: background agent の成果は完了通知の受領後にのみ監査・目録更新・memory 登録する（先走り禁止）
- **監査はペア照合**: ノートの記述と transcript 原文を同一 grep 出力に並べて確認する。片側だけの「確認済み」を信用しない（2026-07-03 の幻覚事故の教訓）
