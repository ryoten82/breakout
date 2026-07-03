# UE5.8 差分ドクトリン（core・蒸留版）

汎用エディタ知識のうち UE5.8 固有の変更点のみ。基礎操作全般は bg/fx 側の見本ノートで既習。

## UE5.8 固有の運用変更（要注意）

1. **Starter Content が Engine から削除**（5.7 以降）— 新規プロジェクトに無いので必要なら手動追加
2. **Fab plugin がデフォルト無効な場合がある** — Q+ アイコンに FAB ボタンが出ない時はプラグイン未インストールが原因。手動有効化で解消（※講師固有事象の可能性あり・要現況確認）
3. **Fab アセットのバージョン対応表記に注意** — 対応が「UE5.0〜5.7」等と5.8を含まない場合がある。近似バージョン指定でのダウンロードで回避可（詳細手順は元ノート参照）

## バージョン番号の目安（講師口頭・公式未照合）

- 5.1: Enhanced Input／5.2: PCG（Procedural Content Generation）／5.5: Megalights
- マイナーバージョンごとに新機能+パフォーマンス改善が入る

## 出典
[core/videos/57yLCKqC9m8_ue58-getting-started.md](videos/57yLCKqC9m8_ue58-getting-started.md)（差分ノート・Fable ペア照合済 2026-07-03）
