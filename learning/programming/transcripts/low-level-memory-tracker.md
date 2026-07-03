# SOURCE: Using the Low-Level Memory Tracker in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/using-the-low-level-memory-tracker-in-unreal-engine
取得方法: WebFetch（全文再現・非常に詳細・良質ソース）
取得日: 2026-07-04

---

**Low-Level Memory Tracker (LLM)** は Unreal Engine プロジェクトのメモリ使用量を追跡するツール。スコープタグシステムでエンジン・OSが確保する全メモリを記録する。全プラットフォーム対応。

## LLM Trackers（2種類）
- **Default Tracker**: エンジンからの全アロケーションを記録。`FMemory::Malloc` 経由の確保を記録。`stat LLM`/`stat LLMFULL` の統計元
- **Platform Tracker**: OSからの全アロケーションを記録（`Binned2` 等の内部アロケーションも含む、より低レベル）。Default Tracker の統計は Platform Tracker の統計の部分集合

## LLM Setup

**コマンドライン引数:**
- `-LLM` — LLM有効化
- `-LLMCSV` — 全ての値をCSVファイルに継続書き出し（自動的に-LLMも有効化）
- `-llmtagsets=Assets` — Experimental。アセットごとの合計を表示
- `-llmtagsets=AssetClasses` — Experimental。UObjectクラス種別ごとの合計を表示

**コンソールコマンド:**
- `stat LLM` — LLMサマリー表示（低レベルのエンジン統計は単一のEngine統計にまとめられる）
- `stat LLMFULL` — 全LLM統計表示
- `stat LLMPlatform` — OSから確保された全メモリの統計
- `stat LLMOverhead` — LLM自体が内部で使用するメモリ

`-LLMCSV` 使用時、CSVファイルは `saved/profiling/llm/` に出力される。各タグごとに1列（MB単位の現在値）。デフォルトで5秒ごとに新しい行が書き込まれる（`LLM.LLMWriteInterval` コンソール変数で変更可能）。

## LLM Tags
エンジンによる全メモリ確保（ゲームコード含む）にタグ値が割り当てられる。1回のメモリは1つのタグにのみ記録され、漏れも重複もない。全カテゴリの合計がゲームの総メモリ使用量になる。

タグは tag-scope マクロで適用される。そのスコープ内の確保はすべて指定タグが付与される。LLMはタグスコープのスタックを保持し、最上位のタグを確保に適用する。

**タグカテゴリ例:**
- **UObject** — UObject継承クラス全般＋そのプロパティのシリアライズ対象。他カテゴリに分類されないエンジン/ゲームメモリの受け皿（Mesh/Animationデータは別カテゴリ）。レベルに配置されたObject数に対応
- **EngineMisc** — 他カテゴリに分類されない低レベルメモリ
- **TaskGraphTasksMisc** — タスクグラフから起動され専用カテゴリを持たないタスク（通常は低い値）
- **StaticMesh** — `UStaticMesh` クラスと関連プロパティ（実際のメッシュデータは含まない）

## Custom Tags
Unreal Insights でメモリプロファイリング中、"LLM Untracked" とタグ付けされたメモリが見つかることがある。`LLM_DECLARE_TAG` と `LLM_DEFINE_TAG` マクロでカスタムタグを作成し、未追跡メモリの発見に役立てる。エンジンファイルの変更不要・ゲームモジュール/プラグインで作成可能。カスタムタグ使用時は `LLM_SCOPE_BYTAG` マクロを使う。

**手順:**
1. ヘッダファイルで `LLM_DECLARE_TAG` によりカスタムLLMタグを宣言
2. 対応する `.cpp` ファイルで `LLM_DEFINE_TAG` により定義
3. `.cpp` ファイル内でメモリ使用量を追跡したい箇所に `LLM_SCOPE_BYTAG` を使用

## Custom Tag Macros

### LLM_DECLARE_TAG
他所で定義されたタグを宣言。`LLM_SCOPE_BYTAG` や他の `LLM_SCOPE` で名前参照するために使う。
- パラメータ: `UniqueName` — タグの名前（`LLM_DEFINE_TAG`/`LLM_SCOPE`/`ELLMTag` に渡す全タグ間で一意である必要あり）

### LLM_DEFINE_TAG
`LLM_SCOPE_BYTAG` や他の `LLM_SCOPE` で使えるタグを定義。
- `UniqueNameWithUnderscores` — 名前の修正版。親のセパレータ `/` は `_` に置換
- `DisplayName`（省略可）— トレース時に表示する名前（親がある場合は親名と `/` で連結）
- `ParentTagName`（省略可）— 親タグの一意名。無ければ `NAME_None`
- `StatName`（省略可）— 毎フレームのLLMデータ公開時にこのタグの量を反映する統計名
- `SummaryStatName`（省略可）— 統計グループ名

### コード例
```cpp
// CustomTagExample.h
#pragma once
...
LLM_DECLARE_TAG(MyTestTag);

// CustomTagExample.cpp
LLM_DEFINE_TAG(MyTestTag);

AMyActor::AMyActor()
{
    LLM_SCOPE_BYTAG(MyTestTag);
    MyLargeBuffer.Reset(new uint8[1024*1024*1024]);
}
```

## Tag Sets（Experimental）
`LowLevelMemTracker.h` で `LLM_ALLOW_ASSETS_TAGS` を定義して使用。各確保にアセット名/オブジェクトクラス名も追加で保存される。メモリ・ランタイム性能双方にオーバーヘッドが増す。

## 技術的実装詳細
LLMはポインタでインデックスされた全アロケーションのマップを保持。ゲームは同時に最大400万件のライブアロケーションを持ちうるため、メモリオーバーヘッドを小さく保つことが重要。現在の実装は**1アロケーションあたり21バイト**（Pointer:8B / Pointer Hash Key:4B / Size:4B / Tag:1B / Hash Map Index:4B）。

`OnLowLevelAlloc` で確保が追跡される際、タグスタック最上位のタグが現在のタグとなり、そのポインタをキーとしてアロケーションマップに記録される。競合を避けるため、各タグのフレーム差分は `FLLMThreadState` クラスインスタンスごとに別々に追跡される。フレーム終了時にこれらの差分が合算され、統計システムと `.CSV` ファイルに公開される。

LLMは非常に早期に初期化されるため、デフォルトで有効になっていなければならない。コマンドラインで有効化されていない場合、自動的にシャットダウンして全メモリをクリーンアップし、オーバーヘッドが無いことを保証する。**LLMはTest/Shippingビルドでは完全にコンパイル対象外**。

LLMは統計システム無しでも動作可能（例: Testコンフィグ）。画面上に統計は表示できないが、`.CSV` ファイルへの書き出しは継続する。`LowLevelMemTracker.h` の `ENABLE_LOW_LEVEL_MEM_TRACKER` を変更して有効化する必要がある。

主なスコープマクロ: `LLM_SCOPE(Tag)` / `LLM_PLATFORM_SCOPE(Tag)`（それぞれ Default Tracker / Platform Tracker の現在スコープを設定）。プラットフォーム依存版（`LLM_SCOPE_[Console](Tag)`）も存在。統計を使うスコープマクロ（`LLM_SCOPED_TAG_WITH_STAT`）は非推奨。

LLM内部で使う全メモリはプラットフォーム提供の `LLMAlloc`/`LLMFree` 関数で管理される（LLM自身のメモリ使用を追跡しないため、無限再帰を避ける目的）。

## 追加の技術詳細
- LLMのオーバーヘッドは100MB以上になりうるため、コンソールでは large memory mode での実行が強く推奨される
- Testコンフィグでは画面上統計は出ないが `.CSV` 書き出しは行われる。Shippingでは完全に無効
- アセットタグ追跡はまだ早期の実験段階
