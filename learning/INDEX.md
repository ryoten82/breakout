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

### bg/ — 背景（25 本学習済・2026-07-04）
- **[bg/bg_technique_doctrine.md](bg/bg_technique_doctrine.md)** — 蒸留版 **v5**（2026-07-04 Fable 蒸留。KitBash3D 273分コース統合: PLIワークフロー詳細化（Pivot設計・事後変更不可・1.75倍則）・Is Spatially Loaded・MPC一括制御・構図原則F/M/B+フォーカルポイント・大→中→小の密度・Shared Wrap地雷・Mesh to Collision）
- [bg/playlist_inventory.md](bg/playlist_inventory.md) — 動画目録・学習状況
- [bg/videos/AkDRS7g0LtM_kitbash3d-mission-to-minerva.md](bg/videos/AkDRS7g0LtM_kitbash3d-mission-to-minerva.md) — KitBash3D「Mission to Minerva」フルコース273分（9チャンク並列抽出・**Fableスポット照合済**: Is Spatially LoadedのASR崩れ"especially loaded"復元と1.75倍則[196:53]を原文確認）。**Packed Level Instanceワークフロー・Is Spatially Loadedオフ・MPC一括制御**が横断的な核心技術
- [bg/videos/oEQCAnwclTg_realistic-scifi-free-assets.md](bg/videos/oEQCAnwclTg_realistic-scifi-free-assets.md) — 無料アセットでSci-Fi通路を組む17分動画（**Fableスポット照合済**）。ライト非対称配置（主光源6/補助光2）・プロップで継ぎ目を隠す手法・Exposure方向をジャンルトーンから逆算
- 個別ノート 23 本 = 環境系 3 + Starter Course 4 + フォグ/水中/スタイライズ + 工事現場（set dressing の本命）+ Epic 公式 Medieval 最適化 5（計測駆動 / Lights&Shadows / HLOD / Landscape+LayerBlendHeight / RVT）+ Mesh Paint（UE5.5+ 新機能）
- [bg/videos/pcg-overview.md](bg/videos/pcg-overview.md) — PCG（Points/NodeGraph16種/Attributes-Metadata）。**set dressing自動化の可否を仮説整理**（anchor連鎖=不向き／整列崩し・decal散布=向く候補）
- [bg/videos/common-memory-cpu-considerations.md](bg/videos/common-memory-cpu-considerations.md) — GC/ObjectPooling/非同期スポーン分散(5体×6フレーム具体例)/PSOPrecaching。§9-13「計測の次の対策」（Fable監査済・原文数値照合一致）
- [bg/videos/low-level-memory-tracker.md](bg/videos/low-level-memory-tracker.md) — LLM Default/Platform Tracker・カスタムタグ作成（コード例付）。メモリ専用追跡は既存doctrineに無い新規軸（Fable監査済・技術制約値原文照合一致）
- [bg/videos/automation-testing.md](bg/videos/automation-testing.md) — Automation Test Framework（既存autopilotとは目的が異なる=機能回帰検証）・5種テスト分類・実行4方式（Fable監査済）
- [bg/videos/rendering-optimization-guidelines.md](bg/videos/rendering-optimization-guidelines.md) — draw call目安(**モバイル基準に注意**)・Translucent overdrawコスト・テクスチャ最適化（Fable監査済・自己申告1件は許容範囲の推論と確認）
- [bg/videos/PLVihattEEQ_military-trench.md](bg/videos/PLVihattEEQ_military-trench.md) — 「軍事塹壕」動画だが実際はRVT実装トラブルシュート(Tangent Space シーム・DXT1オーバーサブスクライブ)+PCG実用パターン(Level InstanceのPCG化・Self-Pruning)+Insightsプロファイリング。**タイトルと中身の乖離実例**（Fable監査済・低確信3件は原文の曖昧さを正直反映と確認）
- [bg/applications/bgtest01_experiment_plan.md](bg/applications/bgtest01_experiment_plan.md) — L_BGTest01 実験 E1〜E6（UE エディタ起動待ち）
- Fab リスティング「Military Trench」（無料サンプルプロジェクト）: WebFetch 403 + Chrome拡張未接続で今回アクセス不可。ダウンロード+UE MCP直接検査という新経路の実現性はある（要Fabプラグイン経由のGUI操作+エディタ別インスタンス）が未実施

### fx/ — エフェクト（22 本学習済 + 公式サンプル実地検査 60 システム・2026-07-04）
- **[fx/fx_technique_doctrine.md](fx/fx_technique_doctrine.md)** — 蒸留版 **v2.1**（2026-07-04。動画19本統合のv2に公式Niagara Examples実測を上書き反映: **公式はSort Order HintでなくRendererVisibilityタグ+ブレンドモード分離／Death EventでなくAttributeReader連鎖が推奨形**・System階層=監督パターン・NDC・Stateless(Lightweight)エミッタ・1粒3レンダラー）
- **[fx/inspections/](fx/inspections/)** — **UE MCP実地検査**（公式Niagara Examples、MyProject sandbox、読み取り専用）。3レポート: [01=カタログ60件+PickUp/Markers/Player](fx/inspections/niagara-examples-01-catalog-pickup-markers-player.md)（Pickup 4部作パターン・Marker収束リング=テレグラフ教科書・Statelessは.uasset直接解析が必要）／[02=Explosions/Smoke/Sparks](fx/inspections/niagara-examples-02-explosions-smoke-sparks.md)（System監督・VisibilityTag分岐・二次火花当選方式・AlphaComposite+DefaultLit煙）／[03=Weapons/Ribbons/NDC](fx/inspections/niagara-examples-03-weapons-ribbons-ndc.md)（MuzzleFlash 6エミッタ・Impact骨格・SimpleRibbonTrail最小形・TeslaCoil・NDC常駐バッチング）。検査ツール一式は [fx/inspections/tools/](fx/inspections/tools/)（mcp_call.py+uassetパーサ、再検査時に再利用）
- [fx/playlist_inventory_toxic-falls-etc.md](fx/playlist_inventory_toxic-falls-etc.md) — 「Toxic Waterfall」等50本のプレイリスト目録。実質チュートリアル14本を全処理（残り35本超はショーケース映像のためスキップ）。**Dynamic Parameter外部化・Generate/Receive Event疎結合・Additive/Translucent使い分け・Sort Order Hint描画順制御**が横断的な共通設計。**2026-07-04 Fableスポット照合済（幻覚なし）**
- [fx/videos/wceVb5ftmxs_toxic-waterfall.md](fx/videos/wceVb5ftmxs_toxic-waterfall.md) / [graozMcShMA_anime-waterfall-splash.md](fx/videos/graozMcShMA_anime-waterfall-splash.md) — 毒沼/背景水表現。Erosionマテリアル・Voronoi浸食
- [fx/videos/SGoNF1UTD3I_muzzle-flash-vfx.md](fx/videos/SGoNF1UTD3I_muzzle-flash-vfx.md) — 交差平面+コーンの4層マズルフラッシュ構成
- [fx/videos/djlnnPvFR0Q_sword-slash-vfx.md](fx/videos/djlnnPvFR0Q_sword-slash-vfx.md) / [meig8T9uWNc_slash-attack-vfx.md](fx/videos/meig8T9uWNc_slash-attack-vfx.md) — METEOコンボ斬撃直結。Mesh Rotation Forceイージング・多層Bright/Dark構成・4方向クロス複製
- [fx/videos/EXWwZ4F_reA_ground-slash-vfx.md](fx/videos/EXWwZ4F_reA_ground-slash-vfx.md) — 地上SP技。Decal+Light+Follow Ground Blueprint
- [fx/videos/NbbFytz-JDk_vertical-beam-vfx.md](fx/videos/NbbFytz-JDk_vertical-beam-vfx.md) — 光柱SP技。5層積層（コア/フレネル/暗背景/Voronoi×2）
- [fx/videos/omkwqdWMB_U_scifi-barrier.md](fx/videos/omkwqdWMB_U_scifi-barrier.md) — ボス/プレイヤーシールド。ドット+ノイズ+ボーダー加算
- [fx/videos/HRagD5L-WF8_stylized-smoke-vfx.md](fx/videos/HRagD5L-WF8_stylized-smoke-vfx.md) / [OnxiEY3Khow_stylized-fire-vfx.md](fx/videos/OnxiEY3Khow_stylized-fire-vfx.md) — 爆発煙/炎3層構成（Flames+Smoke+Embers）
- [fx/videos/kS4Y5DKqsAI_ice-attack-effect.md](fx/videos/kS4Y5DKqsAI_ice-attack-effect.md) — 属性攻撃。Generate/Receive Event同期・多段ウェーブカスケード
- [fx/videos/-Cdn0_98PXM_meteor-rain-vfx.md](fx/videos/-Cdn0_98PXM_meteor-rain-vfx.md) — 広範囲SP技。Location/Death Event分岐
- [fx/videos/iDrsEp3AGWA_magic-orbs.md](fx/videos/iDrsEp3AGWA_magic-orbs.md) — OCジェム/浮遊オーブ直結。Sort Order Hint多層構成
- [fx/videos/R2-BsWb5Bqg_sparks-vfx-engine-comparison.md](fx/videos/R2-BsWb5Bqg_sparks-vfx-engine-comparison.md) — 汎用スパーク。User Parameters公開手法
- [fx/videos/hnUQiwJweeg_niagara-intro.md](fx/videos/hnUQiwJweeg_niagara-intro.md) — Niagara 入門（日本語公式・Fable 照合済。5 ステージ役割分担・Particle State 必須の消滅仕様・Add Velocity のステージ配置で初速/継続加算が変わる）
- [fx/videos/niagara-official-concepts.md](fx/videos/niagara-official-concepts.md) — 公式 System/Emitter/Module/Parameter概念 + Execution State（Active/Inactive/InactiveClear/Complete=既存ノートに無い新規情報）+ Inheritance等の高度な概念。既存ノートとの用語対応関係も整理（Fable監査済・Execution State原文照合一致確認）
- [fx/videos/niagara-fluids.md](fx/videos/niagara-fluids.md) — グリッド(気体)/FLIPハイブリッド(液体)・圧力解法・5種シミュレータ比較(2D/3D Gas・2D/3D FLIP・Shallow Water)。**FLAME UPPER(3D Gas候補)・延焼(2D Gas候補)への応用示唆**（実装未確認、Fable監査済・5種シミュレータ全項目原文照合一致確認）
- [fx/playlist_inventory_cghow-niagara.md](fx/playlist_inventory_cghow-niagara.md) — CGHOWチャンネル「Niagara VFX Tutorials」全461本の目録（実践的エフェクトレシピ集、UE4世代混在）。461本全処理は費用対効果が見合わず目録のみ作成、5本をパイロット処理（**2026-07-04 Fableスポット照合済・幻覚なし**）
- [fx/videos/_1tmjPro1JM_scifi-dome-material.md](fx/videos/_1tmjPro1JM_scifi-dome-material.md) — SF Domeマテリアル。Depth Fadeで接触部分発光・クリスクロスパターン・Divide(小値)によるグロー化Tips。**Stage3巨大発光球体への適合性が高い**
- [fx/videos/owdDqNd-_-s_danger-zone-vfx.md](fx/videos/owdDqNd-_-s_danger-zone-vfx.md) — Danger Zone VFX。既存SBMine型AOEテレグラフとは「常時ループの装飾」vs「時間軸に紐づく攻撃予告」で目的レイヤーが異なると整理、フェイクグロー/Spring Force拘束は装飾レイヤーとして流用検討
- [fx/videos/UyFSE5fIAWU_perfect-hit-marker.md](fx/videos/UyFSE5fIAWU_perfect-hit-marker.md) — Perfect Hit Marker。多層リング+放射ストリークでコンボヒット/ジャストブロック差別化に応用可、地面向き設定は2.5D固定カメラ向けに要再検討
- [fx/videos/u1Cm5g0lhVg_force-push-ring.md](fx/videos/u1Cm5g0lhVg_force-push-ring.md) — Force Push Ring。Sine×2両側フェード・Floor+Divide段階化・ColorRamp着色の3層構成、SuperKnockChainノックバック演出への応用
- [fx/videos/cBc31YcWw_M_impact-burst-effects.md](fx/videos/cBc31YcWw_M_impact-burst-effects.md) — Impact Burst（UE4 Cascade動画、Niagara読み替え注記あり）。リング+グロー+スパーク+星の4層テンプレート、強Dragによる余韻演出

### ui/ — ゲーム UI（4 本 + 参照DB 3 件・2026-07-04）
- **[ui/ui_technique_doctrine.md](ui/ui_technique_doctrine.md)** — 蒸留版 v1（2026-07-04 Fable 蒸留。Fast/Slow Path負荷原理とチェックリスト・機能選定表（CommonUI/ViewModel等）・テーマ管理定型と3つの罠（親Pre Construct/Draw As/Save All）・Size Box vs Scale Box・参照DB観察の要点）
- [ui/playlist_inventory.md](ui/playlist_inventory.md) — UE UI Designシリーズ全13本の目録・学習状況（3本パイロット済・**Fableスポット照合済**、残り10本は継続要否未決定）
- [ui/videos/epic-ue5-ui-design-optimization.md](ui/videos/epic-ue5-ui-design-optimization.md) — Epic Games Japan公式スライド「UE5で作成するUIと最適化手法」81ページ（WebFetch可・独立再取得4項目ペア照合済）。UE5新機能6種（UMG Preview/Slate PostBuffer/UI Component/SlateIM/CommonUI/UMG ViewModel）対応バージョン表・最適化チェック項目（Canvas Panel乱用禁止/Collapsed vs Hidden等）・Fast Path/Slow Pathの負荷原理
- [ui/videos/bnJ3wDK1f04_part01-setup.md](ui/videos/bnJ3wDK1f04_part01-setup.md) / [PwAUEKNOuCA_part06-button.md](ui/videos/PwAUEKNOuCA_part06-button.md) / [EkEUU7j3x4w_part12-list-item.md](ui/videos/EkEUU7j3x4w_part12-list-item.md) — UE UI Designシリーズ（UE5.3収録・やや古い）パイロット3本（**Fableスポット照合済**: 親Pre Construct罠[15:15]・Save All運用[08:55]・Size Box切替[18:34]を原文確認）。共通親Widget継承・構造体+Data Tableテーマ管理は現行UE5.8でも通用と判断。スタイル管理は現行ではWidget Style Asset等がモダンと注記
- [ui/reference/gameuidatabase_ghostwire-tokyo.md](ui/reference/gameuidatabase_ghostwire-tokyo.md) — **画像リファレンスDB**（gameuidatabase.com、Ghostwire: Tokyoの実機UI65枚をカテゴリ分類）。常時HUD/Skill Tree/Inventory/Weapon Wheel/通知オーバーレイの重ね順・レイアウト設計を6枚実閲覧して観察。実画像は`reference/images/`でgit管理外
- [ui/reference/gameuidatabase_concord.md](ui/reference/gameuidatabase_concord.md) — 画像リファレンスDB（gameuidatabase.com、Concordの5v5戦闘UI）。ワールド空間名前タグ+HPバー一体型ラベル・ability icon+キーバインド+クールダウン塗りつぶし・チームHPロースターを6枚実閲覧して観察
- [ui/reference/gameuidatabase_blazblue-entropy-effect-x.md](ui/reference/gameuidatabase_blazblue-entropy-effect-x.md) — 画像リファレンスDB（gameuidatabase.com、BlazBlue Entropy Effect Xの2.5D横スクロールアクション×ローグライクUI＝**SCRAP BLITZ UEと同ジャンル**）。六角形MPゲージ・ボス戦時のみ出現するHPバー・横方向バー選択肢UI（強化/休憩選択）を6枚実閲覧して観察

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
- **[animation/animation_technique_doctrine.md](animation/animation_technique_doctrine.md)** — 蒸留版 v1（2540B・2026-07-04 Fable 蒸留。Asset 作成 2 方式の使い分け・Editor 要点・Modular CtrlRig は Experimental につき不採用）
- [animation/videos/animation-system-and-control-rig.md](animation/videos/animation-system-and-control-rig.md) — Skeletal Mesh Animation System全体マップ + Rigging with Control Rig（Control Rig Asset作成2方式）。**project の motion-room の実運用 Control Rig パイプラインと直結**（Fable監査済・自己申告1件ヘッジ確認済）
- [animation/videos/modular-control-rigs.md](animation/videos/modular-control-rigs.md) — Module/Connector/Socket構造・実行順序（root→leaf・単一スレッド）。**Experimental機能**・現行パイプライン置換は提案しない位置づけ（Fable監査済・Experimental明記+実行順序をWebFetch独立再照合し原文完全一致確認、自己申告1件は修正済）
- [animation/videos/control-rig-editor.md](animation/videos/control-rig-editor.md) — Control Rig Editor主要パネル（ツールバー/Rig Hierarchy/Details）+ Rig Graphノード操作（Hierarchy参照・Function化）。ユーザー指定コース「Creating and Modifying Control Rig」の実質的な代替（Fable監査済・Compile/SolveDirection原文照合一致確認、自己申告1件は適切にヘッジ確認済）
- スキップ: 「Modular Control Rig - Rigging with Modules」チュートリアル（`/community/learning/tutorials/` もSPA・Chrome拡張復旧待ち。代替探索でも既存 modular-control-rigs.md と同一ページ止まりのためユーザー判断でスキップ）
- 関連: ユーザー指定の元コース「Introduction for Gameplay Animation」「Skeleton Creation and Body Rigging」（いずれもSPA・Chrome拡張復旧待ち）

### lighting/ — ライティング（3 本学習済・2026-07-04）
- ソース種別・監査方式は programming と同じ
- **[lighting/lighting_technique_doctrine.md](lighting/lighting_technique_doctrine.md)** — 蒸留版 v1（2026-07-04 Fable 蒸留。Light5種/Mobility基礎 + SQEX実務ワークフロー: Exposureロック先行・色はライトで作る・極端値での角度決定分離・SourceRadius硬軟・黒で締める・Emissive豊富なら直射光を弱められる）
- [lighting/videos/lighting-overview-and-mobility.md](lighting/videos/lighting-overview-and-mobility.md) — Lighting全体マップ + Light Type5種/Mobility3状態（Stationary4灯制限等、bgドクトリン§11と棲み分け整理済）（Fable監査済・自己申告なし）
- [lighting/videos/lumen-global-illumination.md](lighting/videos/lumen-global-illumination.md) — Lumen概要・Nanite/WorldPartition/VirtualShadowMaps統合（ソースやや薄いと明記、Fable監査済・WebFetch独立再照合で統合関係を原文確認・自己申告なし）
- [lighting/videos/lighting-tips-unreal-fest-tokyo-2025-sqex.md](lighting/videos/lighting-tips-unreal-fest-tokyo-2025-sqex.md) — スクウェア・エニックス講演（Unreal Fest Tokyo 2025）。Exposureロック・SourceRadius硬軟・「黒で締める」引き算ライティング・Lumen Hit Lightingの4項目を独立再取得ペア照合（3項目一致・Hit Lightingのパラメータ表記のみ曖昧と明記）

### materials/ — マテリアル（4 本学習済・2026-07-04）
- [materials/videos/substrate-unreal-fest-bali-2025.md](materials/videos/substrate-unreal-fest-bali-2025.md) — Epic公式Substrate深掘り講演（Unreal Fest Bali 2025・91ページ）。メモリバジェット表（Simple8B/Single24B/Complex36B/Complex Special52B）・`r.Substrate.BytesPerPixel`デフォルト80B・応用事例11種を独立再取得3項目ペア照合（全一致）。既存[substrate-materials.md](materials/videos/substrate-materials.md)（概要）を補完する実践編。**メモリ予算はdoctrineへ昇格済（2026-07-04）**
- ソース種別・監査方式は programming と同じ
- **[materials/materials_technique_doctrine.md](materials/materials_technique_doctrine.md)** — 蒸留版 v1（2930B・2026-07-04 Fable 蒸留+Substrate有効化+実機確認を同日反映。必須3設定・プロキットは最小構成・MI量産手順・タイリング適用条件・**本プロジェクトSubstrate有効(Adaptive GBuffer)・実害なし確認済み**・実地検査手法の使い所）
- **[materials/inspections/](materials/inspections/)** — **新ソース種別：UE MCP実地検査**（動画/ドキュメントとは別経路）。[lower-sector-building-kit-report.md](materials/inspections/lower-sector-building-kit-report.md)：生の検査報告（一次資料）
- [materials/videos/lower-sector-building-kit-inspection.md](materials/videos/lower-sector-building-kit-inspection.md) — 上記を正式ノート化。Fab「Lower Sector Building Kit」（CC BY 4.0・AI利用許可済）実地検査。**「TexCoord→Multiply→Scalar tiling」定型パターンがプロ配布モジュラーキットには存在しない**という発見は**独立検証2回・ノード/ピン単位で完全一致**（幻覚でないことを確認）→ bgドクトリン§定型テクニックに適用条件（Landscape等広域面限定）を追記済み。**検査手法自体の評価も収録**（ライセンス確認必須・高コスト=1キット約20万トークン相当・「なぜ」は分からない、を踏まえた要否判断）
- [materials/videos/material-concepts-and-properties.md](materials/videos/material-concepts-and-properties.md) — Material Domain7種/Blend Mode7種/Shading Model13種の完全列挙。bgドクトリンの実践知識=フォグ材Translucent選択等を体系的に裏付け（Fable監査済・自己申告1件は既述ヘッジ確認済）
- [materials/videos/substrate-materials.md](materials/videos/substrate-materials.md) — **UE5.7+ デフォルト有効・Beta機能**。従来Blend Mode/Shading Model体系を置き換える新枠組み。Slab/BSDF・GBuffer Formats選択（Blendable/Adaptive）・F0/DiffuseAlbedoパラメータ化。**現行プロジェクトがSubstrate有効かレガシーか要確認**（Fable監査済・Beta文言をWebFetch独立再照合し原文完全一致確認、自己申告1件ヘッジ追記済）
- スキップ: 「Unreal Engine: Environment Basics」チュートリアル（SPA・良い代替documentation無し・bgドメインが既に類似内容を十分カバー済のため見送り）
- 関連: ユーザー指定の元チュートリアル「Create Realistic Glass Material - Substrate Glass Tutorial」（SPA・Chrome拡張復旧待ち。Substrate材システム自体の公式docで代替、ガラス材の具体的ノード構成手順は未取得）
- [materials/videos/material-instances.md](materials/videos/material-instances.md) — Parameter作成のS/Vキーショートカット・Convert to Parameter・Parameter Groups。bgドクトリンの「MI化」フレーズの具体的作業手順（Fable監査済・S/VキーをWebFetch独立再照合し原文完全一致確認）
- 関連: ユーザー指定の元コース「Introduction to Materials」（本セッション冒頭で最初に依頼されたコース・SPA・Chrome拡張復旧待ち）

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
