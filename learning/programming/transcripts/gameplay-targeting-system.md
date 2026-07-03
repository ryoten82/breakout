# SOURCE: Gameplay Targeting System in Unreal Engine
URL: https://dev.epicgames.com/documentation/unreal-engine/gameplay-targeting-system-in-unreal-engine
取得方法: WebFetch（要約モードだが具体的な関数名・構造まで取得できた良質ソース）
取得日: 2026-07-04

---

## 概要

Gameplay Targeting System は、データ駆動型のターゲティングリクエストを作成するフレームワーク。Gameplay Ability System プラグインを拡張しているが、独立して使用することも可能。

## Targeting Preset の構造

Targeting Preset はデータアセットで、「複数の Targeting Tasks を上から順に実行する」設定を定義する。各タスクはインラインプロパティ編集をサポートし、異なる UAsset を作成せずに再利用可能なタスクとプリセットを構築できる。

## Targeting Task の分類（3種）

1. **Selection（選択）** — ターゲット候補を選出
2. **Filtering（フィルタリング）** — 条件に基づいて絞り込み
3. **Sorting（ソート）** — 優先順位を設定

タスクは Blueprint 対応で、クラスデフォルトプロパティの設定から Blueprint callable events まで、様々な実装方式がある。

## 実行モデル（2種）

### 同期実行（Immediate Targeting Requests）
`UTargetingSubsystem::ExecuteTargetingRequest` 関数で実行。ゲームスレッドをブロックして即座に完了する。

### 非同期実行（Async Targeting Requests）
`UTargetingSubsystem::StartAsyncTargetingRequest` 関数で実行。サーバー認証待機やゲームプレイイベント待機など、時間のかかる処理に対応できる。

全プラグイン提供タスクは両モデルをサポートしており、ゲームコードの必要性に応じて実装できる。
