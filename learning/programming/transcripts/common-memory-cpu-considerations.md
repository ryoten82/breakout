# SOURCE: Common Memory and CPU Performance Considerations in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/common-memory-and-cpu-performance-considerations-in-unreal-engine
取得方法: WebFetch（1回目は著作権懸念で拒否、2回目「具体的手順・数値の列挙」プロンプトで詳細取得）
取得日: 2026-07-04

---

## ガベージコレクション（GC）設定
設定場所: Project Settings > Engine > Garbage Collection。GC間隔・最大オブジェクト数等が調整可能（具体的な推奨数値は原文に記載なし）。手動GCはローディング画面等スパイクが許容される場面でのみ推奨。

## Object Pooling
"instead of spawning a new projectile every time you need to fire one, your weapon would pre-spawn the maximum number of projectiles it could possibly have active"（毎回新規スポーンする代わりに、可能な限り最大数を事前スポーンしておく）。Actor生成コスト削減とメモリ増加のトレードオフ。具体的な最大数の数値例は無い。

## Tick の代替
Tickロジックの代わりに、コールバック・タイマー・カスタムセッターで「変化時のみ処理」する設計を推奨。

## 非同期スポーン分散（具体的数値あり）
"spawn only up to 5 enemies per frame until it has reached the specified limit"（1フレームあたり最大5体まで敵をスポーンする）
"30 enemies spawning over the course of 6 frames"（30体を6フレームにわたってスポーン＝30÷5=6フレーム）

## 並列処理
Task System・FRunnableによる並列処理の活用に言及。

## PSO Precaching
シェーダーコンパイルによるヒッチ（初回描画時のカクつき）対策。「自動生成可能」と記載されているが、具体的な設定手順は原文になく、詳細ドキュメントへのリンクのみ。
