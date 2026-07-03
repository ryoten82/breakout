# SOURCE: Automation Test Framework in Unreal Engine + Run Automation Tests in Unreal Engine
URL1: https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine
URL2: https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine
取得方法: WebFetch（両方とも良質・具体的なコマンド例まで取得）
取得日: 2026-07-04

---

## 概要（Automation Test Framework より）
Unreal Engineのオートメーションシステムは、機能テストフレームワークの上に構築されており、ユニットテスト・機能テスト・コンテンツストレステストを実行するために設計されている。

## テスト分類（5種類）

| テスト種別 | 説明 |
|-----------|------|
| **ユニット** | APIレベルの検証テスト。`TimespanTest.cpp`や`DateTimeTest.cpp`が例 |
| **機能** | PIE、ゲーム内統計、解像度変更などを検証するシステムレベルテスト |
| **スモーク** | "エディタ、ゲーム、コマンドレット起動時に毎回実行できるよう意図された高速テスト。すべてのスモークテストは1秒以内に完了することを想定" |
| **コンテンツストレス** | 全マップの読み込みやBlueprintコンパイルなど、システムの包括的テスト |
| **スクリーンショット比較** | QAテストが異なるバージョン間のレンダリング問題を迅速に検出できるテスト |

## インターフェース
- **Automation Spec** — BDD（行動駆動開発）手法に対応
- **Automation Driver** — ユーザー入力シミュレーション機能
- **Functional Testing** — Blueprintによるレベルテスト
- **Screenshot Comparison Tool** — スクリーンショット撮影・比較
- **FBX Test Builder** — FBXファイルテスト
- **Blueprint エディタテスト** / **Python エディタテスト** — それぞれの言語でエディタテスト作成
- **CQTest** — 非同期実行の構文簡略化とテストフィクスチャを提供

## テスト設計時の心得（Epic Games推奨）
- "ゲームやエディタの状態を想定しないこと。テストは順序が異なったり、マシン間で並列実行されることもある"
- "ディスク上のファイル状態は変更前と同じままにしておくこと。テストがファイルを生成した場合は、完了時に削除すること"
- "テストが前回実行時に悪い状態で終了したと想定すること。テスト開始前にファイルを生成・削除する習慣が効果的"

---

## テスト実行方法（Run Automation Tests より）

### エディタインターフェイスから
1. プロジェクトを開く
2. **Functional Testing Editor** と実行したいテストを含むプラグインを有効化
3. Unreal Editor を再起動
4. **Tools > Test Automation** に移動
5. **Sessions Frontend** の **Automation** タブの **Test** 列で実行するテストを選択（親チェックボックスで全体、展開で詳細選択）
6. **Start Tests** ボタンをクリック
- **Test** パネルで進行状況・結果を監視。テスト行選択で **Results** パネルにイベント表示。スクリーンショット比較結果は **Screen Comparison** タブ

### Session Frontend から
デフォルトはエディタインスタンスから実行だが、Session Frontendは追加のエディタ/クライアントインスタンスに接続可能（ネットワークテスト向け）。接続前に追加インスタンスの起動が必要（Quick Launch機能で可能）。左パネルの **My Sessions** からインスタンス選択。テストをクライアント専用に設定しエディタインスタンスで利用不可にすることも可能。

### Unreal Frontend (UFE) から
スタンドアロンアプリケーションとしてクライアントテストを起動可能。エディタなしでリモートコンソールへのビルド・パッケージング・デプロイに便利。インターフェースはエディタと同じ。

### コマンドラインから
- `-ExecCmds="Automation RunTest Test1+Test2;Quit"` — Test1とTest2を実行後、実行可能ファイルを閉じる
- `-ExecCmds="Automation RunTest MySet.MySubSet;Quit"` — MySet.MySubSetセクション下の全テストを実行
- `-ExecCmds="Automation RunTest Group:MyGroup;Quit"` — グループMyGroupでフィルタリングされた全テストを実行
- `-ReportExportPath="<output path>"` — 結果をJSON形式＋関連HTMLファイルで保存
- `-ResumeRunTest` — `-ReportExportPath`と併用時、JSONファイルを読み込み未実行とマークされた最初のテストから再開。進行中テストは失敗とマーク。重大障害時のテスト再開に便利
