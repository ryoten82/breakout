# 学習ノート — C++ Introduction to Unreal Engine for Programmers（Epic公式コース）

- **ソース種別：Epic公式コースの配布スライドPDF**（動画のCC字幕ではなくスライド資料が一次情報源。Chrome拡張導入によりSPAページの壁を越えて取得）
- コース: 「C++ Introduction to Unreal Engine for Programmers」（UE 5.5, 講師 Martin Cosens）
- 元URL: https://dev.epicgames.com/community/learning/courses/45V/c-introduction-to-unreal-engine-for-programmers/
- PDF: 66ページ、著作権 2023 Private & Confidential（Epic Games）
- 抽出: PDF実体取得 → pypdf でテキスト層抽出 → Sonnet 5 が自分の言葉で要約（スライドの逐語コピーは避け、コード例・列挙値のみ引用）
- 学習日: 2026-07-07
- 既存 `programming/` ドメインの他ノートは Epic公式 documentation ページ（WebFetch）が中心。本ノートは**社内トレーニング用コーススライド**という別種のソースで、documentation より一段階「なぜこう設計されているか」「実務上どちらを選ぶか」の粒度が細かい記述を含む

## コース構成（11モジュール中、本PDFがカバーする範囲）

PDFは「Project Compilation」「Modules」「Unreal Build Tool (UBT)」「Reflection」「Building Blocks」「Garbage Collection」「Unreal Smart Pointers」「Object Lifecycle」「Actor Lifecycle」「Casting」「Scripting and Blueprint」の全章を1本のスライド資料としてカバーしている。ユーザーが挙げた4モジュール区分（Getting Started / UBT・Reflection・Building Blocks / GC・Smart Pointers / Actors・Casting・Blueprint）に相当する内容が全て含まれていた。

## Project Compilation — Config States and Targets

UBT のビルド方式には Config（ビルド構成）と Target（ビルド目的）の2軸があるとスライドは整理している。

- **Config**: Debug / DebugGame / Development / Test / Shipping
- **Target**: Client / Server / Editor / Game

SCRAP BLITZ の日常ビルドは `Development` + `Editor`（`ScrapBlitzEditor Win64 Development`）に相当する組み合わせ。Test/Shipping/Server 系は現状未使用だが、将来サーバー機能や出荷ビルドを検討する際の軸として押さえておける。

Editorについては「単なるスクリプトツールではない」「BlueprintはC++の代替ではなく対等な選択肢」「Epic Launcher版でもC++/Blueprint両方でプロジェクトを書ける（ソース非公開でも可、ただしソースも無料公開されている）」という位置づけが強調されている。

## Modules — モジュールアーキテクチャ

### UProjectの実体
UProjectは「1つのdll＝プライマリgameplayモジュール」から成り、モジュール同士は必要な機能に応じて依存リンクする。**Editor targetは各モジュールを個別dllとしてビルドし、Runtime targetは全依存モジュールライブラリから単一のモノリシックexeをビルドする**という違いがある。これはエディタでのイテレーション速度（差分dllのみ再リンク）とランタイムの配布形態（単一exe）の使い分けとして理解できる。

### モジュールの物理構成
典型的な作業ディレクトリは `Source/Runtime/<TestModule>/` 配下に以下を持つ：
- `<TestModule>.build.cs`（モジュール定義。`PublicDependencyModuleNames` / `PrivateDependencyModuleNames` という2つの重要な文字列配列を持つ）
- `<TestModule>.cpp`（モジュール実装）

モジュールは「勝手にビルドされない」——プライマリgameplayモジュールが直接・間接に依存するか、target.cs に直接モジュールを追加するか、UProjectのmodules配列にエントリを追加する必要がある。

### モジュール種別とロードフェーズ
モジュール種別（`EHostType`）: Editor / Runtime / DeveloperTool / ServerOnly / ClientOnly。
ロードフェーズ（`ELoadingPhase`）: PreLoadingScreen / Default / PostEngineInit ——モジュールが「いつ」スピンアップするかを制御する。

モジュールは初期化後、コード内から簡単にシングルトンとしてアクセスできる、ともスライドは述べている（具体的なAPI名の記載は薄い）。

### Plugin — モジュール群のパッケージ
Pluginは「メインプロジェクトから切り離されたモジュールの集合」で、「通常の」モジュールと全く同じ機能を持ち、複数種別のモジュールを複数保持できる。物理的には **Source フォルダの外側、Plugins フォルダに置かれ**、UProjectファイルの代わりにUPluginファイルを持つ以外はメインゲームプロジェクトとほぼ同一のアーキテクチャになる。

## Unreal Build Tool (UBT) — 実行パイプラインの順序

スライドはUBTの処理順序を明示的にリストしている。既存ノート群にはこのパイプライン順序の記述がなく、本ノートの新規情報。

1. ローカルのUProjectファイルを取得
2. target.cs ファイル群を収集
3. targetをインスタンス化し、モジュールをソースする
4. ヘッダーをパースしてUnreal固有のメタ情報を抽出
5. 抽出したメタ情報をUHT（Unreal Header Tool）へ渡す
6. ActionGraphを生成
7. ActionGraphをMakeFileとして保存
8. ActionGraphを実行

「UHTはUBTから呼び出される、ヘッダー解析の下流工程」という位置づけが明確になった点が新規性。既存の `reflection-and-metadata.md` はUBT/UHTの関係自体には触れていない。

## Reflection — 命名規約とマクロ

### プレフィックス規約（既存ノートを補完）
既存の `gameplay-classes-in-unreal-engine.md` はA/Uプレフィックスのみカバーしていたが、本スライドはF/E/Tも含む完全な一覧を提示：

| Prefix | 対象 |
|---|---|
| `U` | Actor基底でないUObject派生（`UObject`→`UDataAsset`） |
| `A` | Actor派生（`AActor`→`AExplodingBarrel`） |
| `F` | 構造体・非UObjectクラス（`FExplosionParams`, `FArchive`） |
| `E` | 列挙型（`EExplosionType`） |
| `T` | テンプレート型（`TMyTemplatedClass`, `TUniquePtr<T>`） |

### リフレクション有効化の3点セット
`#include "MyFileName.generated.h"` ＋ `UCLASS()`/`USTRUCT()`/`UENUM()` マークアップ ＋ `GENERATED_BODY()`。エディタのC++ Class Wizardがこれを自動生成する。

### `TObjectPtr<T>`（既存ノートに無い新規項目）
既存の `reflection-and-metadata.md` はスマートポインタ系を「詳細説明なし」と明記していたが、本スライドは`TObjectPtr<T>`について以下を挙げている：
- サイズは64bitポインタと等価
- アクセス追跡（access tracking）をサポート
- エディタビルドで遅延ロード（lazy load）挙動をサポート
- 解決済みオブジェクトアドレスをキャッシュ可能
- GCの扱いは生のリフレクション型ポインタと同じ
- `UnrealObjectPtrTool`で旧プロジェクトをUE5仕様に変換可能
- 高度なcook時依存関係追跡をサポート
- **UE5ではエンジン自体がTObjectPtrを使用**

SCRAP BLITZ の既存 `UPROPERTY()` で生ポインタを使っている箇所があれば、`TObjectPtr<T>` への置き換えでcook時依存関係追跡やエディタでのアクセス追跡が得られる可能性がある（ただし置換の要否・既存コードの現状は未確認）。

### 主要マクロの meta 対応（既存ノートとの関係）
`UCLASS()`（BlueprintType/Blueprintable/Abstract等）、`UPROPERTY()`（GC防止・EditAnywhere/EditDefaultsOnly/VisibleAnywhere/Replicated/Transient）、`UFUNCTION()`（BlueprintCallable/BlueprintCosmetic/Server/Client/NetMulticastでネットワーク越し関数呼び出しが可能）、`USTRUCT()`/`UENUM()`——これらは既存の `reflection-and-metadata.md` / `gameplay-classes-in-unreal-engine.md` と重複する内容で、新規性は薄い。

## Building Blocks — UObject / Actor / ActorComponent / SceneComponent

4階層の比較整理（既存ノートより簡潔だが「何が無いか」の観点が明確）：

- **UObject**: 全UE5オブジェクトの基底。ワールドに物理的な表現を**持たない**。組み込みのtick機能が**ない**。必ず「outer」を与えられる必要がある。ネットワーキングは追加設定なしでは非対応
- **Actor**: UObjectを直接拡張。クライアント・サーバー間の接続点を提供。コンポーネントアーキテクチャに適する
- **ActorComponent**: Actorに「追加」されることで再利用可能な機能を提供。Actorの存在が前提。BlueprintでUPropertyを介したデザイナー向け公開に向く
- **SceneComponent**: ActorComponentと同じだが物理的表現を持つ。他のSceneComponent・ボーン・ソケットにアタッチ可能。コリジョン検出にも使える

「UObjectはtick機能を持たない」「outerが必須」という制約は既存ノートに無い具体的な情報。

## Garbage Collection — GCフローと非UObject連携

### GCの基本動作（既存の物理ノートより詳細）
データはリフレクションマクロでマーク → 管理対象メンバは`FProperty`経由 → UObjectはRoot Setから到達可能でないと生存を維持できない → Actorは明示的にDestroy可能 → 破棄されたオブジェクトへのポインタは自動的にnullにされる。

### GCフロー（3段階の到達可能性解析）
スライドは図解として「全オブジェクトが Unreachable な状態」→「参照ツリーを構築」→「Obj1→Obj3参照を切った後のツリー」という3フェーズを示している。Root Setから辿れないオブジェクトが回収対象になるマーク&スイープ方式の可視化。

### `FGCObject`（既存ノートに無い新規項目）
**非UObjectがUObjectを参照する場合**、`FGCObject`を継承することでGCに参照を認識させられる。既存の `physics-chaos.md` や `reflection-and-metadata.md` はGCの仕組み自体に踏み込んでおらず、この「非UObject側からUObjectを守る」仕組みは本ノートで新規に確認できた情報。

### 開発者視点でのGC制約
- スレッドセーフでない
- 生ポインタは（GCの視点からは）見えない
- `PendingKill`でオブジェクトを手動破棄可能

## Unreal Smart Pointers — 型と生成パターン

### ポインタ種別一覧
| UE型 | std対応 |
|---|---|
| `TSharedPtr<T>` | `std::shared_ptr` |
| `TUniquePtr<T>` | `std::unique_ptr` |
| `TWeakPtr<T>` | `std::weak_ptr` |
| `TSharedRef<T>` | non-nullable版shared pointer（std対応なし） |
| `TWeakObjectPtr<T>` | weak raw pointerラッパー（UObject専用、std対応なし） |

利点: メモリリーク防止、`TSharedPtr<T, ESPMode::ThreadSafe>`によるスレッド安全性、`TSharedRef`によるランタイム安全性（non-nullable保証）。

### 生成パターン（既存ノートに無い新規項目）
非リフレクション型（UObject派生でない型）で`TSharedRef`/`TSharedPtr`を作るには、対象クラスを`TSharedFromThis<T>`から継承させる必要がある：

```cpp
class FExampleClass : public TSharedFromThis<FExampleClass>
```

これにより`MakeShared<T>()` / `MakeShareable()` / `AsShared()` / `SharedThis()`が使えるようになり、一度`TSharedRef`を得れば`TSharedPtr`へは容易にderefできる。

既存ノートはスマートポインタの「種類の名前」までしか持っておらず、`TSharedFromThis`継承の必要性・4つの生成関数の使い分けは本ノートで新たに得られた情報。

## Object Lifecycle — `NewObject<>()`の内部動作

`UMyObject* MyObject = NewObject<UMyObject>()`実行時の内部ステップとしてスライドが示す順序：

Malloc → Memset 0 → クラスコンストラクタ呼び出し → Post Construction Initialisation → MemCopy（`GetDefaults()`からのデフォルト値コピー）→ Post Init

CDO（Class Default Object）から生成のたびにデフォルト値がコピーされる、という具体的な内部フローは既存ノートに無い新規情報。

## Actor Lifecycle — スポーンから破棄までの全フロー

### 主要関数
`InitializeComponents`（Pre/Post）、`BeginPlay`、`Tick`、`EndPlay`、`Destroy`（`BeginDestroy`→`FinishDestroy`→解放を呼び出す）。

### スポーンフロー（2系統）
スライドの図は2つの経路を示している：

1. **レベルロード経路**: `LoadMap` → `AddToWorld` → ディスクからActorをロード → 各ActorがPostLoad呼び出し → `InitializeActorsForPlay` → `RouteActorInitialize` → 各Actorで `PreInitializeComponents` → `InitializeComponents` → `PostInitializeComponents` → `BeginPlay`
2. **動的スポーン経路**: `SpawnActor`（または`SpawnActorDeferred`+`FinishSpawningActor`）→ `PostSpawnInitialize` → `PostActorCreated` → `ExecuteConstruction`（`OnConstruction`）→ `PostActorConstruction` → `PreInitializeComponents` → `InitializeComponents` → `PostInitializeComponents` → `OnActorSpawned` → `BeginPlay`

PIE（Play in Editor）開始時は全Actorが新ワールドに複製され、`PostDuplicate`が呼ばれる経路も併記されている。

### 終了フロー
`EndPlay`が呼ばれる条件として、`Destroy`イベント呼び出し／Actor寿命超過／レベル遷移中／PIE終了中／ゲーム終了中／アプリケーション終了中、のいずれかがYESであれば発火。その後 Actor は `RF_PendingKill` としてマークされ、ULevelのActor配列から除去され、次のGCサイクルで解放される。`BeginDestroy` → `IsReadyForFinishDestroy` → `FinishDestroy` という順序で解放処理が進む。

この一連の詳細なフロー図（特に「EndPlayに至る6条件の分岐」「BeginDestroy/FinishDestroyの順序」）は既存の `programming/` ノート群に無い新規情報。SCRAP BLITZ の敵Actor破棄・ダウン演出・GA終了処理のタイミング設計を見直す際の参照になり得る。

## Casting — 4種のキャスト関数と挙動差

既存ノートに無い新規項目。スライドはリンゴ（`Apple`）を例に4種の違いを明示：

| 関数 | 挙動 |
|---|---|
| `UObject::IsA(UClass* OtherClass)` | 継承関係を問う（`Apple->IsA(UFruit::StaticClass)`） |
| `T* Cast<T>(UObject*)` | 成功時はポインタ、失敗時は`nullptr`（`Cast<UFruit>(CarrotPtr)`は失敗しfalse相当） |
| `T* ExactCast<T>(UObject*)` | **完全一致のクラスのみ**成功（`Fruit`型ポインタから`ExactCast<UFruit>`は成功するが、`Apple`型ポインタからは失敗＝派生クラスは弾かれる） |
| `T* CastChecked<T>(UObject*)` | 失敗時は**クラッシュ**（開発中のアサーション的用途、`CastChecked<UFruit>(CarrotPtr)`はクラッシュ） |

`ExactCast`が「派生クラスも含めた継承関係」ではなく「完全一致のみ」を見る点、`CastChecked`が失敗時に例外でなくクラッシュする点は、既存コードで安全なキャストを選ぶ際の判断材料になる。

## Scripting and Blueprint

Blueprintは「プロトタイピング向けの簡易ツール」ではなく「well-structuredであれば本番コードとして扱われるべき、フル機能のプログラミング環境」と位置づけられている。C++側の拡張ポイントとして：

- `UFUNCTION`: `BlueprintCallable`（`const`併用や`BlueprintPure`で純粋関数扱い）、`BlueprintImplementableEvent`（BP側で実装必須）、`BlueprintNativeEvent`（C++デフォルト実装+BP側オーバーライド可）
- `UPROPERTY` meta: `UIMin`/`UIMax`、`ClampMin`/`ClampMax`、`DisplayName`、`BlueprintGetter`/`BlueprintSetter`
- `UINTERFACE()`: BlueprintはInterfaceを完全サポート。`Blueprintable`指定子付きの`UINTERFACE()`マークアップが必要で、コード側での利用には特有の作法がある（スライドはこの「作法」の中身までは踏み込んでいない）

## SCRAP BLITZ に活かせる部分

- **UBT/UHTパイプライン順序**の把握は、ビルドが遅い・ヘッダー変更が反映されないといったトラブル時に「どの段階の問題か」を切り分ける手がかりになる（ヘッダー解析＝UHT側、リンク＝ActionGraph実行側、という切り分け）
- **`TObjectPtr<T>`**：既存コードで生ポインタの`UPROPERTY()`が多い場合、cook時依存関係追跡・エディタでのアクセス追跡のメリットを検討する余地がある。ただし本プロジェクトの既存コードが`TObjectPtr`をどの程度使っているかは未確認（要現況確認）
- **Actor Lifecycleの終了フロー**（`EndPlay`の6条件・`RF_PendingKill`・`BeginDestroy`/`FinishDestroy`順序）は、敵Actor撃破時の演出タイミング（`emitBarDebris`相当の破棄演出）や、GA側のタイマークリア処理（既存規約「GAのタイマー/フラグはEndAbilityで必ずクリア」）の裏付けとして参照できる
- **`ExactCast`と`CastChecked`の使い分け**：既存コードで`Cast<ASBBoss01>`のような分岐がある箇所は基本`Cast`で十分だが、「完全一致のみを許可したい」「型不一致は即座に開発中に検出したい」ケースがあれば`ExactCast`/`CastChecked`の使いどころとして押さえておける
- 上記はいずれも一般的な適用可能性の指摘であり、既存コードを実際に確認した上での断定的な改善提案ではない

## ソースの限界

- スライド資料であり、講師の口頭解説（「なぜ」の部分）はPDFのテキスト層には含まれていない。箇条書きの意味は文脈から補って要約したが、講師が実際に話した詳細な理由付けは本ノートには反映できていない
- UINTERFACE利用時の「特有の作法」（63ページ）はスライドタイトルのみで内容が図示のみ、または口頭説明前提と見られ、本ノートでは踏み込めていない
- Module singleton アクセス（15ページ）・Editor画面（6ページ）・Modules architecture図（10, 17-18ページ）は図中心で、テキスト層からは具体的なAPI名やコード例が取得できなかった
- 66ページ中、有効なテキストコンテンツがあったのはおよそ50ページ程度で、残りは画像のみ・見出しのみのページ（Fig説明画像のcaptionのみ等）だった
