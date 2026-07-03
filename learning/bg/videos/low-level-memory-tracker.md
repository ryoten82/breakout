# 学習ノート — Using the Low-Level Memory Tracker (LLM)

- ソース: Epic公式ドキュメント「Using the Low-Level Memory Tracker in Unreal Engine」
- URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/using-the-low-level-memory-tracker-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../../programming/transcripts/low-level-memory-tracker.md](../../programming/transcripts/low-level-memory-tracker.md)

## LLM とは（Default/Platform Trackerの2層構造）

**Low-Level Memory Tracker (LLM)** は Unreal Engine プロジェクトのメモリ使用量を追跡するツール。スコープタグシステムでエンジン・OSが確保する全メモリを記録する。全プラットフォーム対応。

2種類のトラッカーが存在する:

- **Default Tracker**: エンジンからの全アロケーションを記録。`FMemory::Malloc` 経由の確保を記録。`stat LLM`/`stat LLMFULL` の統計元
- **Platform Tracker**: OSからの全アロケーションを記録（`Binned2` 等の内部アロケーションも含む、より低レベル）。Default Tracker の統計は Platform Tracker の統計の**部分集合**

つまり Default Tracker はゲームコード視点のメモリ内訳、Platform Tracker はOS視点の実際の確保量という棲み分け。

## 起動方法（コマンドライン引数・コンソールコマンド）

**コマンドライン引数:**
- `-LLM` — LLM有効化
- `-LLMCSV` — 全ての値をCSVファイルに継続書き出し（自動的に `-LLM` も有効化）
- `-llmtagsets=Assets` — Experimental。アセットごとの合計を表示
- `-llmtagsets=AssetClasses` — Experimental。UObjectクラス種別ごとの合計を表示

**コンソールコマンド:**
- `stat LLM` — LLMサマリー表示（低レベルのエンジン統計は単一のEngine統計にまとめられる）
- `stat LLMFULL` — 全LLM統計表示
- `stat LLMPlatform` — OSから確保された全メモリの統計
- `stat LLMOverhead` — LLM自体が内部で使用するメモリ

`-LLMCSV` 使用時、CSVファイルは `saved/profiling/llm/` に出力される。各タグごとに1列（MB単位の現在値）。デフォルトで5秒ごとに新しい行が書き込まれる（`LLM.LLMWriteInterval` コンソール変数で変更可能）。

## LLM Tags の仕組み（既定カテゴリ例）

エンジンによる全メモリ確保（ゲームコード含む）にタグ値が割り当てられる。1回のメモリは1つのタグにのみ記録され、漏れも重複もない。全カテゴリの合計がゲームの総メモリ使用量になる。

タグは tag-scope マクロで適用される。そのスコープ内の確保はすべて指定タグが付与される。LLMはタグスコープのスタックを保持し、最上位のタグを確保に適用する。

**タグカテゴリ例:**
- **UObject** — UObject継承クラス全般＋そのプロパティのシリアライズ対象。他カテゴリに分類されないエンジン/ゲームメモリの受け皿（Mesh/Animationデータは別カテゴリ）。レベルに配置されたObject数に対応
- **EngineMisc** — 他カテゴリに分類されない低レベルメモリ
- **TaskGraphTasksMisc** — タスクグラフから起動され専用カテゴリを持たないタスク（通常は低い値）
- **StaticMesh** — `UStaticMesh` クラスと関連プロパティ（実際のメッシュデータは含まない）

## カスタムタグの作り方（LLM_DECLARE_TAG/LLM_DEFINE_TAG/LLM_SCOPE_BYTAGとコード例）

Unreal Insights でメモリプロファイリング中、"LLM Untracked" とタグ付けされたメモリが見つかることがある。`LLM_DECLARE_TAG` と `LLM_DEFINE_TAG` マクロでカスタムタグを作成し、未追跡メモリの発見に役立てる。エンジンファイルの変更不要・ゲームモジュール/プラグインで作成可能。カスタムタグ使用時は `LLM_SCOPE_BYTAG` マクロを使う。

**手順:**
1. ヘッダファイルで `LLM_DECLARE_TAG` によりカスタムLLMタグを宣言
2. 対応する `.cpp` ファイルで `LLM_DEFINE_TAG` により定義
3. `.cpp` ファイル内でメモリ使用量を追跡したい箇所に `LLM_SCOPE_BYTAG` を使用

**マクロの詳細:**

`LLM_DECLARE_TAG`: 他所で定義されたタグを宣言。`LLM_SCOPE_BYTAG` や他の `LLM_SCOPE` で名前参照するために使う。
- パラメータ: `UniqueName` — タグの名前（`LLM_DEFINE_TAG`/`LLM_SCOPE`/`ELLMTag` に渡す全タグ間で一意である必要あり）

`LLM_DEFINE_TAG`: `LLM_SCOPE_BYTAG` や他の `LLM_SCOPE` で使えるタグを定義。
- `UniqueNameWithUnderscores` — 名前の修正版。親のセパレータ `/` は `_` に置換
- `DisplayName`（省略可）— トレース時に表示する名前（親がある場合は親名と `/` で連結）
- `ParentTagName`（省略可）— 親タグの一意名。無ければ `NAME_None`
- `StatName`（省略可）— 毎フレームのLLMデータ公開時にこのタグの量を反映する統計名
- `SummaryStatName`（省略可）— 統計グループ名

**コード例（原文まま）:**
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

**Tag Sets（Experimental）**: `LowLevelMemTracker.h` で `LLM_ALLOW_ASSETS_TAGS` を定義して使用。各確保にアセット名/オブジェクトクラス名も追加で保存される。メモリ・ランタイム性能双方にオーバーヘッドが増す。

## 技術的制約（1アロケーション21バイト・Test/Shippingでは無効等）

LLMはポインタでインデックスされた全アロケーションのマップを保持。ゲームは同時に最大400万件のライブアロケーションを持ちうるため、メモリオーバーヘッドを小さく保つことが重要。現在の実装は**1アロケーションあたり21バイト**（Pointer:8B / Pointer Hash Key:4B / Size:4B / Tag:1B / Hash Map Index:4B）。

`OnLowLevelAlloc` で確保が追跡される際、タグスタック最上位のタグが現在のタグとなり、そのポインタをキーとしてアロケーションマップに記録される。競合を避けるため、各タグのフレーム差分は `FLLMThreadState` クラスインスタンスごとに別々に追跡される。フレーム終了時にこれらの差分が合算され、統計システムと `.CSV` ファイルに公開される。

LLMは非常に早期に初期化されるため、デフォルトで有効になっていなければならない。コマンドラインで有効化されていない場合、自動的にシャットダウンして全メモリをクリーンアップし、オーバーヘッドが無いことを保証する。**LLMはTest/Shippingビルドでは完全にコンパイル対象外**。

LLMは統計システム無しでも動作可能（例: Testコンフィグ）。画面上に統計は表示できないが、`.CSV` ファイルへの書き出しは継続する。`LowLevelMemTracker.h` の `ENABLE_LOW_LEVEL_MEM_TRACKER` を変更して有効化する必要がある。

主なスコープマクロ: `LLM_SCOPE(Tag)` / `LLM_PLATFORM_SCOPE(Tag)`（それぞれ Default Tracker / Platform Tracker の現在スコープを設定）。プラットフォーム依存版（`LLM_SCOPE_[Console](Tag)`）も存在。統計を使うスコープマクロ（`LLM_SCOPED_TAG_WITH_STAT`）は非推奨。

LLM内部で使う全メモリはプラットフォーム提供の `LLMAlloc`/`LLMFree` 関数で管理される（LLM自身のメモリ使用を追跡しないため、無限再帰を避ける目的）。

**追加の技術詳細:**
- LLMのオーバーヘッドは100MB以上になりうるため、コンソールでは large memory mode での実行が強く推奨される
- Testコンフィグでは画面上統計は出ないが `.CSV` 書き出しは行われる。Shippingでは完全に無効
- アセットタグ追跡はまだ早期の実験段階

## SCRAP BLITZ に活かせる部分

本プロジェクトは学習部屋の handoff 記録にある通り、既に Content 整理（11GB+ 削減）でメモリ肥大化に一度向き合った経験がある。ただしそれはディスク上のアセットサイズ（.uasset ファイル）の話で、LLM が扱うのはランタイムのヒープメモリ確保であり、対象範囲が異なる点は区別しておく必要がある。

考えられる活用の方向性:

1. **SP技/OC/敵tier別のカスタムLLMタグで内訳を追う** — `LLM_DECLARE_TAG`/`LLM_DEFINE_TAG`/`LLM_SCOPE_BYTAG` を使えば、例えば「SP技のエフェクトバッファ」「OC強化系の一時アロケーション」「敵tier01〜06のスポーン時確保」ごとにタグを切って `stat LLMFULL` や CSV で内訳を追うことができる。今後α版以降で敵モデル/BP追加が進みメモリ調査ニーズが出た場合、どのシステムが実際にヒープを食っているかを特定する手段になる
2. **現状のスケールでこの粒度が必要か要検討** — 本プロジェクトはシングルプレイ・ベルトスクロールというスケールであり、LLMが前提とする「同時400万ライブアロケーション」規模のメモリ管理が必要になる場面は現時点では想定しにくい。カスタムタグ導入はコード側に計装（instrumentation）を追加する作業でもあるため、実際にメモリ起因の問題（クラッシュ・特定プラットフォームでの上限超過等）が顕在化してから導入を検討する方が費用対効果に合う可能性がある

現段階では「使えるツールがあると知っておく」レベルに留め、導入を積極的に勧める判断材料は無い。

## ソースの限界

- 本ドキュメントは Epic公式のリファレンスページであり、動画学習ノートのような字幕起因の欠落・推定値は無い。ただし実機での `stat LLMFULL` 出力例（実際のタグ別数値・スクリーンショット）は原文に含まれておらず、本ノートにも記載していない
- Tag Sets（`-llmtagsets=Assets`/`AssetClasses`、`LLM_ALLOW_ASSETS_TAGS`）は原文中で明示的に "Experimental" と記載されている機能であり、正式機能として扱わないこと
- 監査（ファクトチェック）は未実施。冒頭メタ情報の通り「Sonnet単独要約（監査待ち）」の状態
