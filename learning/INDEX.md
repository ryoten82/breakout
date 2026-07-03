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
- **タイトルは中身を保証しない**（2026-07-04 実例）: 「Military Trench Environment」という題名の動画が、実際は RVT/PCG/プロファイリングの技術チュートリアルで、塹壕のset dressingセンスにはほぼ触れていなかった。動画投入前にタイトルから期待した内容と、実際の transcript の内容は別物になりうる前提で扱う（ノートには「タイトルとの乖離」を明記させる）

## ドメイン構成

### bg/ — 背景（23 本学習済・2026-07-04）
- **[bg/bg_technique_doctrine.md](bg/bg_technique_doctrine.md)** — 蒸留版 v4（3149B・日常はこれだけ読む。§14にパフォーマンス対策の引き出し追加・圧縮済）
- [bg/playlist_inventory.md](bg/playlist_inventory.md) — 動画目録・学習状況
- 個別ノート 23 本 = 環境系 3 + Starter Course 4 + フォグ/水中/スタイライズ + 工事現場（set dressing の本命）+ Epic 公式 Medieval 最適化 5（計測駆動 / Lights&Shadows / HLOD / Landscape+LayerBlendHeight / RVT）+ Mesh Paint（UE5.5+ 新機能）
- [bg/videos/pcg-overview.md](bg/videos/pcg-overview.md) — PCG（Points/NodeGraph16種/Attributes-Metadata）。**set dressing自動化の可否を仮説整理**（anchor連鎖=不向き／整列崩し・decal散布=向く候補）
- [bg/videos/common-memory-cpu-considerations.md](bg/videos/common-memory-cpu-considerations.md) — GC/ObjectPooling/非同期スポーン分散(5体×6フレーム具体例)/PSOPrecaching。§9-13「計測の次の対策」（Fable監査済・原文数値照合一致）
- [bg/videos/low-level-memory-tracker.md](bg/videos/low-level-memory-tracker.md) — LLM Default/Platform Tracker・カスタムタグ作成（コード例付）。メモリ専用追跡は既存doctrineに無い新規軸（Fable監査済・技術制約値原文照合一致）
- [bg/videos/automation-testing.md](bg/videos/automation-testing.md) — Automation Test Framework（既存autopilotとは目的が異なる=機能回帰検証）・5種テスト分類・実行4方式（Fable監査済）
- [bg/videos/rendering-optimization-guidelines.md](bg/videos/rendering-optimization-guidelines.md) — draw call目安(**モバイル基準に注意**)・Translucent overdrawコスト・テクスチャ最適化（Fable監査済・自己申告1件は許容範囲の推論と確認）
- [bg/videos/PLVihattEEQ_military-trench.md](bg/videos/PLVihattEEQ_military-trench.md) — 「軍事塹壕」動画だが実際はRVT実装トラブルシュート(Tangent Space シーム・DXT1オーバーサブスクライブ)+PCG実用パターン(Level InstanceのPCG化・Self-Pruning)+Insightsプロファイリング。**タイトルと中身の乖離実例**（Fable監査済・低確信3件は原文の曖昧さを正直反映と確認）
- [bg/applications/bgtest01_experiment_plan.md](bg/applications/bgtest01_experiment_plan.md) — L_BGTest01 実験 E1〜E6（UE エディタ起動待ち）
- Fab リスティング「Military Trench」（無料サンプルプロジェクト）: WebFetch 403 + Chrome拡張未接続で今回アクセス不可。ダウンロード+UE MCP直接検査という新経路の実現性はある（要Fabプラグイン経由のGUI操作+エディタ別インスタンス）が未実施

### fx/ — エフェクト（3 本学習済・2026-07-04）
- doctrine: 未作成（3本到達、次回蒸留を検討）
- [fx/videos/hnUQiwJweeg_niagara-intro.md](fx/videos/hnUQiwJweeg_niagara-intro.md) — Niagara 入門（日本語公式・Fable 照合済。5 ステージ役割分担・Particle State 必須の消滅仕様・Add Velocity のステージ配置で初速/継続加算が変わる）
- [fx/videos/niagara-official-concepts.md](fx/videos/niagara-official-concepts.md) — 公式 System/Emitter/Module/Parameter概念 + Execution State（Active/Inactive/InactiveClear/Complete=既存ノートに無い新規情報）+ Inheritance等の高度な概念。既存ノートとの用語対応関係も整理（Fable監査済・Execution State原文照合一致確認）
- [fx/videos/niagara-fluids.md](fx/videos/niagara-fluids.md) — グリッド(気体)/FLIPハイブリッド(液体)・圧力解法・5種シミュレータ比較(2D/3D Gas・2D/3D FLIP・Shallow Water)。**FLAME UPPER(3D Gas候補)・延焼(2D Gas候補)への応用示唆**（実装未確認、Fable監査済・5種シミュレータ全項目原文照合一致確認）

### ui/ — ゲーム UI（0 本・2026-07-03 新設）
- doctrine: 未作成。UMG/HUD 系動画の投入待ち

### audio/ — サウンド（1 本学習済・2026-07-04 新設）
- doctrine: 未作成（2〜3 本溜まったら蒸留）
- [audio/videos/KG0uD64AG1Y_sound-course.md](audio/videos/KG0uD64AG1Y_sound-course.md) — FREE UE5 Sound Course 18分（Fable ペア照合済。Sound Cue の Random/Modulator/Delay でSEの単調さ回避、Attenuation は Linear/Natural Sound 推奨、共有 Blueprint 化。Sound Class/Mix/Concurrency 未収録＝別途補完要）

### programming/ — C++エンジンプログラミング（8 本学習済・2026-07-04）
- **ソース種別が動画と異なる**: Epic公式 documentation ページ（`dev.epicgames.com/documentation/`）。`/community/learning/courses/` 系はSPAでWebFetch不可（Chrome拡張要）だが、documentation系はWebFetch可
- 監査方式が動画と異なる: grep原文照合でなく、WebFetch再取得による独立照合（documentationページはASR字幕と違い原文自体は高信頼だが、WebFetchの要約AI層を経由するため軽い監査は必要）
- doctrine: 未作成
- [programming/videos/gameplay-classes-in-unreal-engine.md](programming/videos/gameplay-classes-in-unreal-engine.md) — Class Specifier表31項目・Class Meta Tag表19項目・コンストラクタパターン5種（Fable監査済・自己申告1件ヘッジ確認済）
- [programming/videos/delegates-and-lambda-functions.md](programming/videos/delegates-and-lambda-functions.md) — Single/Multicast/Dynamic・Bind系メソッド・実行時安全性（Fable監査済・自己申告2件ヘッジ確認済）
- [programming/videos/epic-cpp-coding-standard.md](programming/videos/epic-cpp-coding-standard.md) — 命名規則/モダンC++/フォーマット/API設計/インクルーシブ用語。既存コードレビューのチェックリストとして直接活用可（Fable監査済・自己申告なし）
- [programming/videos/reflection-and-metadata.md](programming/videos/reflection-and-metadata.md) — Reflection System概要+Metadata Specifier代表例（統合ノート・ソース情報量薄めと明記、Fable監査済・自己申告1件ヘッジ確認済）
- [programming/videos/gameplay-ability-system.md](programming/videos/gameplay-ability-system.md) — GAS 5大構成要素（AbilitySystemComponent/Abilities/AttributeSet/Effects/AbilityTasks）。**既存SP技/OCシステムとの概念対応は仮説段階・置換提案ではない**（自己申告1件ヘッジ確認済）
- [programming/videos/data-driven-gameplay-elements.md](programming/videos/data-driven-gameplay-elements.md) — DataTable(FTableRowBase継承+CSV)/CurveTable(Constant/Linear/Cubic補間)+コード例。敵tier/OCパラメータのテーブル化に直結（自己申告1件ヘッジ確認済）
- [programming/videos/physics-chaos.md](programming/videos/physics-chaos.md) — Chaos Physics 14サブシステム一覧（Ragdoll/Destruction/PhysicsFields等）。既存の死亡mesh問題・キャラ固有物理パラメータと関連（自己申告：ヘッジ文言が定型と異なるが意味は明確・修正不要と判断）
- [programming/videos/gameplay-targeting-system.md](programming/videos/gameplay-targeting-system.md) — Targeting Preset・Selection/Filtering/Sorting3分類・同期/非同期実行。**既存マルチロック/comboTarget HUDとの比較検討材料**（自己申告2件ヘッジ確認済）
- スキップ: Containers in Unreal Engine（ページ本文がほぼ空のスタブ）
- 関連: ユーザー指定の元コース「C++ Introduction to Unreal Engine for Programmers」（SPA・Chrome拡張復旧待ち）。姉妹コースに「C++ Introduction to Gameplay in Unreal Engine for Programmers」「C++ Introduction to AI in Unreal Engine for Programmers」あり（将来候補）

### animation/ — アニメーション・リグ（3 本学習済・2026-07-04 新設）
- ソース種別・監査方式は programming と同じ（Epic公式documentation・WebFetch再取得照合）
- doctrine: 未作成
- [animation/videos/animation-system-and-control-rig.md](animation/videos/animation-system-and-control-rig.md) — Skeletal Mesh Animation System全体マップ + Rigging with Control Rig（Control Rig Asset作成2方式）。**project の motion-room の実運用 Control Rig パイプラインと直結**（Fable監査済・自己申告1件ヘッジ確認済）
- [animation/videos/modular-control-rigs.md](animation/videos/modular-control-rigs.md) — Module/Connector/Socket構造・実行順序（root→leaf・単一スレッド）。**Experimental機能**・現行パイプライン置換は提案しない位置づけ（Fable監査済・Experimental明記+実行順序をWebFetch独立再照合し原文完全一致確認、自己申告1件は修正済）
- [animation/videos/control-rig-editor.md](animation/videos/control-rig-editor.md) — Control Rig Editor主要パネル（ツールバー/Rig Hierarchy/Details）+ Rig Graphノード操作（Hierarchy参照・Function化）。ユーザー指定コース「Creating and Modifying Control Rig」の実質的な代替（Fable監査済・Compile/SolveDirection原文照合一致確認、自己申告1件は適切にヘッジ確認済）
- スキップ: 「Modular Control Rig - Rigging with Modules」チュートリアル（`/community/learning/tutorials/` もSPA・Chrome拡張復旧待ち。代替探索でも既存 modular-control-rigs.md と同一ページ止まりのためユーザー判断でスキップ）
- 関連: ユーザー指定の元コース「Introduction for Gameplay Animation」「Skeleton Creation and Body Rigging」（いずれもSPA・Chrome拡張復旧待ち）

### lighting/ — ライティング（2 本学習済・2026-07-04 新設）
- ソース種別・監査方式は programming と同じ
- doctrine: 未作成
- [lighting/videos/lighting-overview-and-mobility.md](lighting/videos/lighting-overview-and-mobility.md) — Lighting全体マップ + Light Type5種/Mobility3状態（Stationary4灯制限等、bgドクトリン§11と棲み分け整理済）（Fable監査済・自己申告なし）
- [lighting/videos/lumen-global-illumination.md](lighting/videos/lumen-global-illumination.md) — Lumen概要・Nanite/WorldPartition/VirtualShadowMaps統合（ソースやや薄いと明記、Fable監査済・WebFetch独立再照合で統合関係を原文確認・自己申告なし）

### materials/ — マテリアル（3 本学習済・2026-07-04）
- ソース種別・監査方式は programming と同じ
- doctrine: 未作成（3本溜まったので次回蒸留を検討）
- **[materials/inspections/](materials/inspections/)** — **新ソース種別：UE MCP実地検査**（動画/ドキュメントとは別経路）。[lower-sector-building-kit-report.md](materials/inspections/lower-sector-building-kit-report.md)：生の検査報告（一次資料）
- [materials/videos/lower-sector-building-kit-inspection.md](materials/videos/lower-sector-building-kit-inspection.md) — 上記を正式ノート化。Fab「Lower Sector Building Kit」（CC BY 4.0・AI利用許可済）実地検査。**「TexCoord→Multiply→Scalar tiling」定型パターンがプロ配布モジュラーキットには存在しない**という発見は**独立検証2回・ノード/ピン単位で完全一致**（幻覚でないことを確認）→ bgドクトリン§定型テクニックに適用条件（Landscape等広域面限定）を追記済み。**検査手法自体の評価も収録**（ライセンス確認必須・高コスト=1キット約20万トークン相当・「なぜ」は分からない、を踏まえた要否判断）
- [materials/videos/material-concepts-and-properties.md](materials/videos/material-concepts-and-properties.md) — Material Domain7種/Blend Mode7種/Shading Model13種の完全列挙。bgドクトリンの実践知識=フォグ材Translucent選択等を体系的に裏付け（Fable監査済・自己申告1件は既述ヘッジ確認済）
- [materials/videos/substrate-materials.md](materials/videos/substrate-materials.md) — **UE5.7+ デフォルト有効・Beta機能**。従来Blend Mode/Shading Model体系を置き換える新枠組み。Slab/BSDF・GBuffer Formats選択（Blendable/Adaptive）・F0/DiffuseAlbedoパラメータ化。**現行プロジェクトがSubstrate有効かレガシーか要確認**（Fable監査済・Beta文言をWebFetch独立再照合し原文完全一致確認、自己申告1件ヘッジ追記済）
- スキップ: 「Unreal Engine: Environment Basics」チュートリアル（SPA・良い代替documentation無し・bgドメインが既に類似内容を十分カバー済のため見送り）
- 関連: ユーザー指定の元チュートリアル「Create Realistic Glass Material - Substrate Glass Tutorial」（SPA・Chrome拡張復旧待ち。Substrate材システム自体の公式docで代替、ガラス材の具体的ノード構成手順は未取得）
- [materials/videos/material-instances.md](materials/videos/material-instances.md) — Parameter作成のS/Vキーショートカット・Convert to Parameter・Parameter Groups。bgドクトリンの「MI化」フレーズの具体的作業手順（Fable監査済・S/VキーをWebFetch独立再照合し原文完全一致確認）
- 関連: ユーザー指定の元コース「Introduction to Materials」（本セッション冒頭で最初に依頼されたコース・SPA・Chrome拡張復旧待ち）
- 学習中: Lighting the Environment（全体マップ）+ Light Types and Their Mobility（5種のLight Type・3種のMobility・Stationary4灯制限等）の統合ノート／Lumen Global Illumination and Reflections（ソースやや薄いと明記）
- bg ドクトリンの「影の設計」（Medieval動画由来）と重複回避・前提知識として整理する方針
- 関連: ユーザー指定の元コース「Introduction to Lighting」（SPA・Chrome拡張復旧待ち）

### general/ — 汎用・システム系（2 本学習済・2026-07-04 新設）
- doctrine: 未作成。**general はトピックが毛色違い（localization/savegame等）のため、単一 doctrine でなく「同一トピックが2〜3本溜まった時点でそのトピック単位に蒸留」方針
- [general/videos/Ewr6yGOllBw_localization.md](general/videos/Ewr6yGOllBw_localization.md) — ローカライズ方法 9分（Fable ペア照合済。Localization Dashboard/StringTable/Gather Text→翻訳→Compile、String型は翻訳対象外=表示文字列はText型必須、PIE不可・Standalone必須。project_scrapblitz_i18n の「Unreal移行後」条件成立で着手）
- [general/videos/-0111fuUPz8_savegame.md](general/videos/-0111fuUPz8_savegame.md) — SaveGame 14分（Fable ペア照合済。Game Instance 経由でレベル跨ぎ永続化・全体/部分保存の使い分け・Async版は本編未使用。CR/機体LV/OC等の永続化データ構造化に直結。現状の実装状況は要現況確認）

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
