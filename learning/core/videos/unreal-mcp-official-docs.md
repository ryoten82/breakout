# Unreal MCP in Unreal Editor（公式ドキュメント）

- 資料URL: https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor
- 学習日: 2026-07-07 / 取得: Chrome拡張経由（WebFetch単体はタイムアウトしたため切替）
- ドメイン: core（汎用エディタ・MCPツーリング基盤）
- 位置づけ: 本セッションでも実際に使用した「UE MCP実地検査」手法（`materials/inspections/`・`fx/inspections/`）の**土台となる公式仕様書**。今まで実践経験ベースでmemoryに散らばっていた知見（`setup_scrapblitz_ue_build_launch.md`等）を、公式ドキュメントで裏付け・補完する位置づけ

## Unreal MCPとは

エディタプロセス内にMCPサーバーを埋め込み、Claude Code・Cursor・MCP Inspector等のMCP対応AIエージェントがローカルHTTP経由でエディタを操作できるようにするプラグイン。Actorのスポーン・ライティング設定・マテリアルインスタンス作成・Slateウィジェット検査・自動化テスト実行等をToolとして公開する。**エンジン内の識別子（uplugin/C++シンボル/コンソールコマンド）は`ModelContextProtocol`、Plugin Browser上の表示名が「Unreal MCP」**。ツールセット自体はUnreal MCP本体でなく**別プラグイン`AllToolsets`が有効化して提供**する（本セッションでMyProjectに導入した2プラグイン構成と一致）。

⚠公式が明言: 「多くの機能はまだ不完全・未実装。APIとデータ形式は今後変化しうる」。

## セットアップ手順（公式の正順）

1. `Edit > Plugins`で"Unreal MCP"を有効化（`Toolset Registry`プラグインが依存関係として自動有効化）→ 再起動
2. `Edit > Editor Preferences > General > Model Context Protocol`で**Auto Start Server**を有効化。デフォルトで`http://127.0.0.1:8000/mcp`にバインド（ポート/URLパスも同パネルで変更可）
3. コンソールで`ModelContextProtocol.GenerateClientConfig ClaudeCode`（対応クライアント: ClaudeCode/Cursor/VSCode/Gemini/Codex/All）→ プロジェクトルートに`.mcp.json`を書き出し
4. AIエージェントをそのプロジェクト/ワークスペースのルートから起動して接続

JSON形式の設定（Claude Code等）は既存エントリとマージされ**再実行しても安全**。Codex CLIのTOML設定は**書き込み一回限り**（既存ファイルがあれば上書き拒否、手動削除が必要）。

## Tool Search（今回の実地検査で実際に使った方式の公式仕様）

デフォルトで`bEnableToolSearch = true`。この時`tools/list`は全ツールでなく**3つのメタツール**のみを返す：
- `list_toolsets` — 利用可能なツールセット名と説明一覧
- `describe_toolset` — 指定ツールセットのスキーマ
- `call_tool` — 指定ツールセットの指定ツールを引数付きで呼び出し、同ターンで結果を返す

これはまさに本セッションのLower Sector Building Kit検査・Niagara Examples検査で実際に使った`list_toolsets`→`describe_toolset`→`call_tool`のパターンそのもの。**エージェント側はこの発見経路を前提にすべき**（ツールが最初から全部並ぶ想定はしない）。`false`にすると全ツールを最初から公開するが初期スキーマが肥大化する。

## 独自ツールセットの作り方（SCRAP BLITZ UE向けに応用できる可能性）

- **Python方式（推奨・大半の標準ツールセットはこちら）**: `unreal.ToolsetDefinition`を継承し`@unreal.uclass()`。各Tool関数に`@toolset_registry.tool_call`＋`@staticmethod`。型ヒントがJSON Schemaに反映される。docstringはGoogle style（`Args:`/`Returns:`）
- **C++方式**: `UToolsetDefinition`継承、`UCLASS(BlueprintType, Hidden)`、static `UFUNCTION(meta = (AICallable))`。既存プラグイン未公開のエンジン機能に触る場合・USTRUCT等リフレクション型を使う場合・ホットパスでPython-エンジン間コストが問題になる場合はこちら
- 作成後は`ModelContextProtocol.RefreshTools`で再ポーリングが必要。**C++で新規UFUNCTIONを追加した場合はLive Codingが反映せず、エディタ再起動が必要**（既存memoryの「Live Coding禁止」運用と別の角度からの裏付け）

## 制限事項（実地検査を今後行う際に踏まえるべき点）

- HTTP + Server-Sent Eventsのみ対応。stdio・WebSocketは非対応
- **ループバック限定がデフォルト**（`[HTTPServer.Listeners] DefaultBindAddress`）、非ローカルOriginヘッダは拒否、**認証レイヤーなし**——ローカルマシン外に公開するのは安全でない、と公式が明言
- MCP Resources/Promptsは現状どのツールセットでも未提供（Tool呼び出しのみ）
- Toolset Registryのアダプタは**エディタ限定**。Cooked/Shippingビルドでも`IModelContextProtocolModule::AddTool()`で明示登録すればサーバー自体はホスト可能だが、レジストリ経由の自動検出はされない

## デバッグ手段（公式が案内する正規の切り分け方）

- 起動時のOutput Logにバインドアドレス・ポート・URLパスが出る。バインド失敗（ポート競合・依存プラグイン欠落等）はここで判明
- `LogModelContextProtocol`ログカテゴリ、`Log LogModelContextProtocol Verbose`で詳細化
- **MCP Inspector**（`npx @modelcontextprotocol/inspector`）——ブラウザで`http://127.0.0.1:8000/mcp`（Streamable HTTP）に接続すると、全Toolのスキーマ一覧とフォーム形式の呼び出しUIが使える。AIエージェントの解釈を介さない生の検証に使える

## コンソール変数・コマンド一覧（リファレンス）

| 種別 | 名前 | 既定値 | 用途 |
|---|---|---|---|
| コマンド | `ModelContextProtocol.StartServer [port]` | - | サーバー起動（ポート上書き可） |
| コマンド | `ModelContextProtocol.StopServer` | - | サーバー停止・全セッション切断 |
| コマンド | `ModelContextProtocol.RefreshTools` | - | ツールセット再ポーリング |
| コマンド | `ModelContextProtocol.GenerateClientConfig <Client|All>` | - | クライアント設定ファイル生成 |
| CVar | `ModelContextProtocol.WrapPODToolResultsInObject` | true | プリミティブ結果を`{"result":...}`でラップ |
| CVar | `ModelContextProtocol.AudioResultOggFormat` | false | 音声結果をOGGで返す（既定WAV） |
| CVar | `ModelContextProtocol.ProgressIntervalSeconds` | 1.0 | progress通知の最小間隔 |
| CVar | `ModelContextProtocol.PaginationPageSize` | 0（無効） | ページネーション最大件数 |
| CVar | `ModelContextProtocol.EnableAnalytics` | true | テレメトリ送信の可否 |
| 起動フラグ | `-ModelContextProtocolStartServer` | - | Auto Start設定に関わらず起動時にサーバー開始 |
| 起動フラグ | `-ModelContextProtocolPort=N` | - | ポート上書き（1〜65535） |

## SCRAP BLITZ UE運用への示唆

- 今後別プロジェクト（sandbox以外）でMCP実地検査を行う際も、セットアップ手順は「①Unreal MCP有効化 ②AllToolsets有効化 ③Auto Start Server ON ④GenerateClientConfig」の4点セットで再現できる。既存memory（`setup_scrapblitz_ue_build_launch.md`等）の手順と齟齬がないか一度突き合わせる価値がある
- 独自ツールセット（Python/C++）を書けば、SCRAP BLITZ UE固有の検査項目（例: SBEnemy派生クラス一覧の一括ダンプ等）をToolset化できる可能性がある。ただしToolset Registryアダプタはエディタ限定機能である点に注意
- MCP Inspectorはツールのスキーマ齟齬（今回のNiagara Stateless Emitter検査で遭遇した「スタックが空で返る」問題等）の切り分けに使える可能性がある。次回同種の問題に当たったら選択肢に入れる
