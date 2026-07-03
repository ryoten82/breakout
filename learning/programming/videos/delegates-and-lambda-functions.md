# 学習ノート — Delegates and Lambda Functions in Unreal Engine（Epic公式ドキュメント）

- ソース: https://dev.epicgames.com/documentation/en-us/unreal-engine/delegates-and-lambda-functions-in-unreal-engine
- 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 学習日: 2026-07-04
- 原典 transcript: [../transcripts/delegates-and-lambda-functions.md](../transcripts/delegates-and-lambda-functions.md)

## Delegate の種類（Single/Multicast/Dynamic）と使い分け

Delegate は "Data types that reference and execute member functions on C++ Objects"（C++ オブジェクトのメンバ関数を参照・実行するデータ型）と定義される。ジェネリックかつ型安全な方法で C++ オブジェクトのメンバ関数を呼び出せるようにする仕組みで、任意のオブジェクトのメンバ関数に動的にバインドし、呼び出し側がそのオブジェクトの型を知らなくても後から呼び出せる。

エンジンがサポートする 3 種類:

- **Single** — 単一の関数にバインドする基本形
- **Multicast** — 複数の関数にバインドできる形
- **Dynamic**（UObject 向け・シリアライズ可能） — UObject を対象とし、シリアライズに対応する形

原文では 3 種の名称と Dynamic が「UObject 向け・シリアライズ可能」である点のみが明示されており、Single と Multicast それぞれの内部的な使い分け基準（例：単一 vs 複数リスナー）についての踏み込んだ説明はない。

## 宣言マクロのパターン

Delegate の宣言は、対象とする関数シグネチャに応じたマクロを使う。サポートされる機能:

- 戻り値を持つ関数
- `const` として宣言された関数
- 最大 4 つのペイロード変数
- 最大 8 つの関数パラメータ

基本的なマクロパターンとして `DECLARE_DELEGATE`、`DECLARE_DELEGATE_OneParam`、および `DECLARE_DELEGATE_RetVal` のような戻り値付きバリアントが挙げられている。

Delegate の関数宣言は、グローバルスコープ・namespace 内・クラス宣言内のいずれにも置けるが、関数本体の中には置けない。

## Bind系メソッド一覧（Bind/BindStatic/BindRaw/BindLambda/BindSP/BindUObject/UnBind）とそれぞれの使いどころ・判断基準

バインドの仕組みは以下のメソッド群を提供する:

| メソッド | 原文の説明 |
|---|---|
| **Bind** | 既存の delegate オブジェクトにバインドする |
| **BindStatic** | 生の C++ ポインタによるグローバル関数をバインドする |
| **BindRaw** | 生の C++ ポインタによる delegate をバインドする |
| **BindLambda** | functor / lambda 関数をバインドする |
| **BindSP** | shared pointer ベースのメンバ関数をバインドする |
| **BindUObject** | UObject のメンバ関数をバインドする |
| **UnBind** | delegate のバインドを解除する |

UObject および shared pointer へのバインドは弱参照（weak reference）を維持し、`IsBound()` や `ExecuteIfBound()` による安全な実行チェックを可能にする、と原文に明記されている。

原文には各メソッドの「どういう場面でどれを選ぶべきか」という判断基準の一般解説は無い。表の右列は原文の説明文をそのまま対応させたものであり、それ以上の使い分け指針（パフォーマンス比較・ライフタイム管理の詳細など）を述べる記述は原文中に見当たらない。

**ペイロードデータ**: バインド時に任意の変数を渡すことができ、呼び出し時にバインドされた関数へ転送される。原文の例: `MyDelegate.BindRaw( &MyFunction, true, 20 );` は bool と int32 を渡す。

## 実行系（Execute/ExecuteIfBound/IsBound）となぜ安全性チェックが必要か

`Execute()` 関数がバインドされた関数を呼び出す。安全性チェックとして以下が用意されている:

- **Execute**: バインドの確認をせずに実行する
- **ExecuteIfBound**: 実行前にバインドを確認する
- **IsBound**: バインド状態を確認する

「なぜ安全性チェックが必要か」について原文が直接述べているのは、UObject / shared pointer へのバインドが弱参照であるという性質（前節参照）であり、対象オブジェクトが破棄されている可能性があるためチェックが要る、という因果関係を原文の文章から読み取れる。ただし原文はこの因果関係を一文で示すのみで、「チェックを怠るとどうなるか（クラッシュ等）」を明示的には説明していない。

## SCRAP BLITZ に活かせる部分

※本節は現状の SCRAP BLITZ 実装詳細を読んだ上での断定ではなく、原文の内容から導ける一般的な判断基準として整理したもの。

SCRAP BLITZ はベルトスクロールアクションで、ヒット・被弾・SP技発動・OC発動などのイベントが頻発する。原文の Delegate 種別とバインド方式の説明を踏まえると、イベント通知の型選択には次のような一般的な判断基準が考えられる（※一般知識で補足を含む）:

- **UObject 間の通知（例: キャラクター⇔HUD、キャラクター⇔ゲームモード間でのヒット通知・撃破通知・SP発動通知）** には Dynamic Multicast Delegate が候補になる。原文で Dynamic が「UObject 向け・シリアライズ可能」と明記されている点、および Multicast が複数バインドに対応する点から、複数のリスナー（HUD・エフェクト・サウンド等）が同一イベントを購読する構成に適すると考えられる。
- **非 UObject（生ポインタで管理するオブジェクトや、パフォーマンスを重視する高頻度イベント）** には BindRaw / BindStatic が候補になる。原文で BindRaw が「生の C++ ポインタによる delegate」向けと説明されている点から、UObject のオーバーヘッドを避けたい経路（例: 高頻度で発火する当たり判定の内部コールバックなど）に適すると考えられる。※どの程度のパフォーマンス差になるかは原文に記述がなく、一般知識での推測を含む。
- **shared pointer で寿命管理しているオブジェクト間の通知** には BindSP が候補になる。
- **一時的なコールバック・その場限りの処理（インラインで書きたいヒット処理等）** には BindLambda が候補になる。
- いずれの場合も、原文が強調する「UObject / shared pointer へのバインドは弱参照 → `IsBound()` / `ExecuteIfBound()` で安全確認できる」という性質は、キャラクターが戦闘中に破棄されうる（撃破・ステージ遷移等）SCRAP BLITZ の性質と相性が良い。ヒット通知・撃破通知の実行時には `ExecuteIfBound()` を使うことで、対象オブジェクトが既に消滅しているケースの安全な握りつぶしが期待できる。

上記はあくまで原文が示す型ごとの性質からの一般論であり、現状のイベント通知実装（既存コードで何が使われているか）を確認した上での提案ではない。実装への適用判断は既存コードの確認後に行う必要がある。

## ソースだけでは取れなかったもの

- 原文は「Delegates and Lambda Functions」という題名だが、取得した本文には lambda 関数そのものの詳細な文法・使用例についての記述が無い（BindLambda というメソッド名の言及のみ）。ページの他セクション（コードサンプル等）が WebFetch の要約過程で欠落している可能性がある。
- 各 Bind 系メソッドのシグネチャ・実際のコード例（Single/Multicast/Dynamic それぞれの宣言〜バインド〜実行までの具体的なコード）は原文に含まれていない。
- Multicast Delegate と Dynamic Multicast Delegate の違い（Dynamic は UObject 向けとあるが、非 Dynamic の Multicast がどう違うのか）についての明示的な対比説明は無い。
- パフォーマンス特性の比較（BindRaw vs BindUObject vs BindLambda の実行コスト差等）は原文に記述が無い。
