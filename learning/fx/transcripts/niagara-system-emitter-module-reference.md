# SOURCE: System and Emitter Module Reference for Niagara Effects in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/system-and-emitter-module-reference-for-niagara-effects-in-unreal-engine
取得方法: WebFetch（要約モードだが実行順序モデルは正確に取得。良質ソース）
取得日: 2026-07-04

---

## Niagara Selection Stack Model（ニアガラ選択スタックモデル）

ニアガラのパーティクルシミュレーションは**スタック構造**で動作する。"Particle simulation in Niagara operates as a _stack_, simulation flows from the top of the stack to the bottom" というように、上から下へ順序立てて実行される。

各モジュールには実行タイミングを定める**グループ**が割り当てられており、以下の順序で実行される:

1. **System グループ** — すべてのエミッターに共有される動作を処理
2. **Emitter グループ** — 各ユニークなエミッターごとに実行
3. **Particle グループ** — 個別エミッター内の各パーティクルごとに実行
4. **Render グループ** — シミュレーション済みパーティクルデータの画面描画方法を定義

重要な区別: "**A module is an item, but an item is not a module**"。モジュールはユーザーが作成可能な編集可能アセット、アイテムはシステムやエミッター内のユーザーが作成不可な要素。

## Execution State Management（実行状態管理）

システムとエミッターは以下の4つの Execution State を持つ:

- **Active** — シミュレーション実行、スポーン許可
- **Inactive** — シミュレーション実行、スポーン禁止
- **InactiveClear** — パーティクル破棄後、Inactive状態へ移行
- **Complete** — シミュレーション非実行、非描画
