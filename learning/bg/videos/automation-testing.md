# 学習ノート — Automation Test Framework / Run Automation Tests（UE5 公式ドキュメント）

- ソース1: Automation Test Framework in Unreal Engine — https://dev.epicgames.com/documentation/en-us/unreal-engine/automation-test-framework-in-unreal-engine
- ソース2: Run Automation Tests in Unreal Engine — https://dev.epicgames.com/documentation/en-us/unreal-engine/run-automation-tests-in-unreal-engine
- 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 学習日: 2026-07-04
- 原典 transcript: [../../programming/transcripts/automation-testing.md](../../programming/transcripts/automation-testing.md)

---

## Automation Test Framework とは（既存autopilotとの目的の違い）

Unreal Engineのオートメーションシステムは、機能テストフレームワークの上に構築されており、ユニットテスト・機能テスト・コンテンツストレステストを実行するために設計されている。

SCRAP BLITZ には既に autopilot（`-SBBot` ヘッドレス検証）による OC/SP 技の実装直後チェック運用がある。両者は目的が異なる。

- **Automation Test Framework（本ノートの対象）**: 機能回帰検証が目的。API レベルの正しさ、システムの状態変化、レンダリング差分の有無などを「合格/不合格」で判定する仕組み。
- **autopilot（既存運用）**: 性能計測・プレイテストが目的。ヘッドレスで bot にプレイさせ、OC/SP 技実装直後の挙動や負荷を観察する仕組み。

原文はこの対比を明示的に述べているわけではなく、上記の整理は本ノート側での目的比較（両者の役割の違いを本セッションの文脈から言語化したもの）。

## 5種のテスト分類

| テスト種別 | 説明 |
|-----------|------|
| **ユニット** | APIレベルの検証テスト。`TimespanTest.cpp`や`DateTimeTest.cpp`が例 |
| **機能** | PIE、ゲーム内統計、解像度変更などを検証するシステムレベルテスト |
| **スモーク** | "エディタ、ゲーム、コマンドレット起動時に毎回実行できるよう意図された高速テスト。すべてのスモークテストは1秒以内に完了することを想定" |
| **コンテンツストレス** | 全マップの読み込みやBlueprintコンパイルなど、システムの包括的テスト |
| **スクリーンショット比較** | QAテストが異なるバージョン間のレンダリング問題を迅速に検出できるテスト |

## 主要インターフェース一覧

- **Automation Spec** — BDD（行動駆動開発）手法に対応
- **Automation Driver** — ユーザー入力シミュレーション機能
- **Functional Testing** — Blueprintによるレベルテスト
- **Screenshot Comparison Tool** — スクリーンショット撮影・比較
- **FBX Test Builder** — FBXファイルテスト
- **Blueprint エディタテスト** / **Python エディタテスト** — それぞれの言語でエディタテスト作成
- **CQTest** — 非同期実行の構文簡略化とテストフィクスチャを提供

## テスト設計時の心得（Epic推奨の3原則）

- "ゲームやエディタの状態を想定しないこと。テストは順序が異なったり、マシン間で並列実行されることもある"
- "ディスク上のファイル状態は変更前と同じままにしておくこと。テストがファイルを生成した場合は、完了時に削除すること"
- "テストが前回実行時に悪い状態で終了したと想定すること。テスト開始前にファイルを生成・削除する習慣が効果的"

## 実行方法4種

### 1. Editor UI から
1. プロジェクトを開く
2. **Functional Testing Editor** と実行したいテストを含むプラグインを有効化
3. Unreal Editor を再起動
4. **Tools > Test Automation** に移動
5. **Sessions Frontend** の **Automation** タブの **Test** 列で実行するテストを選択（親チェックボックスで全体、展開で詳細選択）
6. **Start Tests** ボタンをクリック
- **Test** パネルで進行状況・結果を監視。テスト行選択で **Results** パネルにイベント表示。スクリーンショット比較結果は **Screen Comparison** タブ

### 2. Session Frontend から
デフォルトはエディタインスタンスから実行だが、Session Frontendは追加のエディタ/クライアントインスタンスに接続可能（ネットワークテスト向け）。接続前に追加インスタンスの起動が必要（Quick Launch機能で可能）。左パネルの **My Sessions** からインスタンス選択。テストをクライアント専用に設定しエディタインスタンスで利用不可にすることも可能。

### 3. Unreal Frontend (UFE) から
スタンドアロンアプリケーションとしてクライアントテストを起動可能。エディタなしでリモートコンソールへのビルド・パッケージング・デプロイに便利。インターフェースはエディタと同じ。

### 4. コマンドラインから
- `-ExecCmds="Automation RunTest Test1+Test2;Quit"` — Test1とTest2を実行後、実行可能ファイルを閉じる
- `-ExecCmds="Automation RunTest MySet.MySubSet;Quit"` — MySet.MySubSetセクション下の全テストを実行
- `-ExecCmds="Automation RunTest Group:MyGroup;Quit"` — グループMyGroupでフィルタリングされた全テストを実行
- `-ReportExportPath="<output path>"` — 結果をJSON形式＋関連HTMLファイルで保存
- `-ResumeRunTest` — `-ReportExportPath`と併用時、JSONファイルを読み込み未実行とマークされた最初のテストから再開。進行中テストは失敗とマーク。重大障害時のテスト再開に便利

## SCRAP BLITZ に活かせる部分

前提として、Automation Test Framework は機能回帰検証、既存 autopilot は性能計測・プレイテストという目的の違いがある。この節はその上で参考になりうる要素の整理であり、導入すべきという結論は出さない。単独開発体制での運用コスト（テストコード保守・実行環境整備の手間）対効果は本ノートの範囲外で別途検討する。

- **Screenshot Comparison Tool** — ビジュアルリグレッション（FX変更時の見た目差分検知）に使える可能性がある。原文では「QAテストが異なるバージョン間のレンダリング問題を迅速に検出できる」役割として説明されており、FX の意図しない見た目変化を検出する用途に転用できる可能性はある。ただし原文に FX 特化の記述はなく、これは用途の類推。
- **コマンドライン実行（`-ReportExportPath` 等）** — autopilot 運用のログ集計改善に参考になる可能性がある。`-ReportExportPath` は結果を JSON + HTML で出力する仕組みであり、autopilot のログをどう構造化・保存するかの参考パターンになりうる。ただし autopilot は Automation Test Framework 自体を使っていないため、直接流用できるわけではなく、あくまで「出力形式の設計参考」という位置づけ。

## ソースの限界

- ソースは公式ドキュメント2ページ（Automation Test Framework / Run Automation Tests）の統合であり、実際のテストコード記述例（C++ でのテスト実装方法など）は含まれていない。
- 監査（ファクトチェック）待ちの単独要約であり、まだ第三者レビューを経ていない。
- Screenshot Comparison Tool や CQTest など各インターフェースの詳細な使い方・API は原文に記載がなく、名称と概要以上の情報はここにない。
