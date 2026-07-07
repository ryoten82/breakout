# UE5.8のAIエージェント向けプラグイン群 調査記事（Qiita, Naotsun氏）

- 資料URL: https://qiita.com/Naotsun/items/0a73c47b35da361a2b3e
- 学習日: 2026-07-07 / 抽出: WebFetch要約
- ドメイン: core（MCPツーリング基盤）
- 位置づけ: [unreal-mcp-official-docs.md](unreal-mcp-official-docs.md)（公式ドキュメント、ModelContextProtocol本体の仕様）を補完する、**周辺プラグイン群の実装状況を独自調査した記事**。公式ドキュメントには無い個別Toolsetの中身・制約が具体的に書かれている

## 記事の主題

UE5.8で追加されたAI統合機能を、エディタを"AI向けサーバ"として機能させる基盤として深掘り調査したもの。ToolsetRegistry経由でC++関数を`meta=(AICallable)`タグでAI向けに公開する仕組みを軸に、複数の周辺プラグインを解説している。

## 紹介されているプラグイン群（本部屋の既存ノートに無い新規情報）

| プラグイン名 | 機能概要 | SCRAP BLITZ UEへの関連度 |
|---|---|---|
| **ToolsetRegistry** | ツール管理の心臓部。`meta=(AICallable)`タグでC++関数を自動公開（[unreal-mcp-official-docs.md](unreal-mcp-official-docs.md)の内容と対応） | 既に間接的に使用中（AllToolsets経由） |
| **ModelContextProtocol** | エディタをMCPサーバ化（HTTP/SSE対応） | 既に使用中 |
| **SlateInspectorToolset** | エディタUIオートメーション。スクリーンショット取得・ウィジェット操作 | ★HUD/UMGデバッグに使える可能性 |
| **AutomationTestToolset** | 自動テスト連携。テスト検索・実行・結果取得 | ★既存Automation Test Framework知見（bg/videos/automation-testing.md）と接続できる |
| **GASToolsets** | GameplayAbilitySystemの観測（アトリビュート値取得等） | ★★SCRAP BLITZ UEはGA(GameplayAbility)を多用（SBGA_Sp03等）。デバッグに直結しうる |
| **GameplayTagsToolset** | タグ管理（追加・削除・リネーム・参照検索） | ★GameplayTag運用があれば有用 |
| **SemanticSearch** | 自然言語クエリでのアセット検索（外部MLサービス利用） | 公開ビルドでは実質動作しない（下記制約参照）、優先度低 |
| **MCPClientToolset** | 逆方向：UE側が外部MCPサーバへ接続するクライアント機能 | 用途不明、優先度低 |
| **AIAssistant** | ブラウザベースのEpic Developer Assistantをエディタ内表示 | 参考程度 |

## 導入・制約

- UE5.8にExperimentalプラグインとして標準同梱。AIAssistant等の一部は手動有効化が必要
- **PIE開始・停止、Runtime中のアクター観測は未対応。Editor専用**（既存の「実地検査はエディタ内のアセット検査に限る」運用と一致する制約）
- 認証機能なし（Origin検証のみ）——[unreal-mcp-official-docs.md](unreal-mcp-official-docs.md)の「認証レイヤーなし」という公式記述と一致
- **認可コード取得後のトークンが平文保存される**（公式ドキュメントには無かった具体的なセキュリティ注意点）
- SemanticSearchの埋め込みは非公開MLサービス経由のため、公開ビルドでは実質動作しない

## SCRAP BLITZ UEへの応用候補（優先度順）

1. **GASToolsets**: GA（GameplayAbility）のアトリビュート値をMCP経由で観測できれば、SP消費・ダメージ計算等のデバッグに直結する可能性。ただしExperimental機能につき有効化時に警告プロンプトが出る点は要確認
2. **AutomationTestToolset**: 既存のAutomation Test Framework知見と組み合わせれば、テスト実行〜結果取得までAIエージェント経由で完結できる可能性
3. **SlateInspectorToolset**: SBComboHUD等のCanvas描画HUDはSlateウィジェットでないため直接の恩恵は薄いかもしれないが、UMG系UIがあれば有効
4. **GameplayTagsToolset**: プロジェクトでのGameplayTag運用実態を確認してから要否判断

⚠これらは全てExperimental機能。有効化前に「実際に該当プラグインがsandbox環境（MyProject）に存在し、意図通り動くか」を検証してから本番導入判断すべき（公式ドキュメントも「多くの機能はまだ不完全」と明言）。
