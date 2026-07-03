# 学習ノート — Gameplay Classes in Unreal Engine（Epic公式ドキュメント）

- ソース: https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-classes-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/gameplay-classes-in-unreal-engine.md](../transcripts/gameplay-classes-in-unreal-engine.md)（見出し名で原文照合可能。公式ドキュメント本文の全文再現モードで取得しているため要約された動画字幕より正確だが、WebFetch自体が要約AIを経由しているため細部の省略・言い換えの可能性は残る）

## 全体構造（UCLASSマクロ・クラス宣言・実装の要点）

UE5 の Gameplay Class は「クラスヘッダファイル（`.h`）」と「クラスソースファイル（`.cpp`）」の 2 本立てが基本。ヘッダにクラス・メンバ（変数・関数）の宣言、ソースに関数の実装を書く（原文「Class Headers」「Class Implementation」節）。

### 命名プレフィックス
クラス名の先頭 1 文字で種別が判別できる標準化された命名規則がある。

| Prefix | Meaning |
|--------|---------|
| `A` | spawnable gameplay objects のベースクラスを継承。Actor であり、ワールドに直接 spawn できる。 |
| `U` | 全 gameplay objects のベースクラスを継承。ワールドに直接インスタンス化できず、必ず Actor に属する（Component 等）。 |

### クラス追加
C++ Class Wizard がヘッダ・ソースの雛形を作り、ゲームモジュールも自動更新する。`UCLASS()` マクロなどエンジン固有のコードも自動で含まれる。

### クラスヘッダの命名慣習
クラス名から `A`/`U` プレフィックスを除いた名前が定義対象のファイル名になる（`AActor` → `Actor.h`）。ただし原文は「Epic のコードはこの慣習に従っているが、クラス名とソースファイル名の間にエンジン側の形式的な関係は存在しない」と明記している。つまり強制ではなく慣習。

ヘッダ先頭には生成ヘッダのインクルードが必須:

```cpp
#include "ClassName.generated.h"
```

### クラス宣言の構文

```cpp
UCLASS([specifier, specifier, ...], [meta(key=value, key=value, ...)])
class ClassName : public ParentName
{
    GENERATED_BODY()
}
```

`UCLASS` マクロに渡す specifier・metadata が `UClass`（エンジンの特殊化されたクラス表現）を生成する。`GENERATED_BODY()` はクラス本体の**先頭**に置く必要がある（原文で明記）。

### クラス実装
`.cpp` は対応する `.h` を include する。原文にはさらに古いエンジンの実装例として次の記載がある（現行エンジンでの必須性は明言されていない一節）:

```cpp
#include "EnginePrivate.h"
```

ベストプラクティスとして、ソース・ヘッダのファイル名はクラス名（プレフィックス抜き）に一致させる。"Add C++ Class" メニューがこれを自動で行う。

## クオリティを上げる教訓（判断基準・なぜそうするか）

原文中で「なぜそうするか」が明示されている判断基準を、根拠込みで整理する。

### 1. アセット参照はハードコードよりBlueprint経由が望ましい
原文: 「Ideally, asset references don't exist in classes. Hardcoded references are brittle; the preferred method uses Blueprints for configuring asset properties. However, hardcoded references remain fully supported.」
- 理由: ハードコードされた参照は壊れやすい（brittle）。アセットパスが変わる・リネームされると静かに壊れる
- ただし禁止ではなく「フルサポートされている」——C++ 側でどうしても必要な場面（デフォルト値の保証等）はあり得る

### 2. クラス参照は `StaticClass()` を優先、モジュール跨ぎのみ `FClassFinder`
原文: 「In many cases, you can use `USomeClass::StaticClass()` and skip ClassFinder complexity... For cross-module references, ClassFinder method is probably better.」
- 判断基準: 同一モジュール内で完結するなら `StaticClass()` で十分にシンプル。モジュールを跨ぐ参照のときだけ `ConstructorHelpers::FClassFinder` の複雑さに見合う価値が出る

### 3. ConstructorStatics は「初回のみコスト、以降はポインタコピー」という設計
原文: 「This `ConstructorStatics` struct creates only the first constructor run; subsequent runs copy a pointer, making it extremely fast.」
- `static FConstructorStatics ConstructorStatics;` という `static` 修飾がキモ——初回コンストラクタ実行時のみ重い初期化（アセット検索等）が走り、2 回目以降は既に構築済みの static インスタンスへのポインタコピーになるため高速
- これは C++ の static ローカル変数の初期化保証（一度だけ実行される）を積極的に使うパターン

### 4. コンポーネントは必ず UPROPERTY で保持する
原文: 「To ensure components always create, destroy, and properly garbage-collect, every component pointer created in the constructor should store in an UPROPERTY of the owning class.」
- 理由: UPROPERTY 化されていないと GC 対象として認識されず、生成・破棄・ガベージコレクションが正しく機能しない保証がなくなる。これは「お作法」ではなく UE のリフレクション/GC システムの前提条件

### 5. `MinimalAPI` はコンパイル時間とのトレードオフ
原文: 「Exports only the class's type information for other modules. Class can be cast to, but functions cannot be called (except inline). Improves compile times.」
- 判断基準: 他モジュールから型情報（cast 等）だけ必要で、関数呼び出しが不要なクラスに使うとコンパイル時間が改善する。裏を返すと「関数を呼べなくなる」制約とのトレードオフであり、無差別に付けるものではない

### 6. `Intrinsic` / `NoExport` は「新規クラスで使うな」という明示的な警告
原文: `Intrinsic` = 「Indicates the class was declared directly in C++, no boilerplate from Unreal Header Tool. Do not use on new classes.」
`NoExport` = 「Declaration shouldn't be included in auto-generated C++ header. Must be defined manually. Only valid for native classes; don't use for new classes.」
- 両方とも「新規クラスでは使うな」と原文が明記。エンジン内部の古いネイティブクラス向けの specifier であり、通常のゲームプレイコードでは対象外と読める

### 7. Metadata はエディタ専用、ゲームロジックから参照しない
原文: 「Metadata only exists in the editor; do not write game logic that accesses metadata.」
- 明確な禁止事項。Metadata Specifier はエディタの見た目・振る舞い制御のためのものであり、実行時のゲームロジック（パッケージビルドでは strip される可能性がある領域）から読みに行ってはならない

## Class Specifier 一覧表

原文の表をそのまま転記。

| Class Specifier | Effect |
|-----------------|--------|
| `Abstract` | Declares the class as an "abstract base class", preventing the user from adding Actors of this class to Levels. Useful for classes which are not meaningful on their own. |
| `AdvancedClassDisplay` | Forces all properties of the class to show only in the advanced sections of details panels. Override with `SimpleDisplay` specifier on individual properties. |
| `AutoCollapseCategories=(Category1, Category2, ...)` | Negates the effects of the **AutoExpandCategories** Specifier on a parent class for listed categories. |
| `AutoExpandCategories=(Category1, Category2, ...)` | Specifies categories that should be automatically expanded in the Unreal Editor Property window. |
| `Blueprintable` | Exposes this class as an acceptable base class for creating Blueprints. Default is `NotBlueprintable`. Inherited by subclasses. |
| `BlueprintType` | Exposes this class as a type for variables in Blueprints. |
| `ClassGroup=GroupName` | Indicates that Unreal Editor's **Actor Browser** should include this class in the specified `GroupName` when **Group View** is enabled. |
| `CollapseCategories` | Indicates properties should not be grouped in categories in Editor Property windows. Propagated to child classes; can be overridden by `DontCollapseCategories`. |
| `Config=ConfigName` | Allows this class to store data in a configuration file (`.ini`). Properties declared with `config` or `globalconfig` specifiers are stored in the named file. Propagated to child classes. |
| `Const` | All properties and functions are `const` and exported as `const`. Inherited by subclasses. |
| `ConversionRoot` | Limits a subclass to only convert to child classes of the first root class going up the hierarchy. |
| `CustomConstructor` | Prevents automatic generation of the constructor declaration. |
| `DefaultToInstanced` | All instances are "instanced". Instanced classes are duplicated upon construction. Inherited by subclasses. |
| `DependsOn=(ClassName1, ClassName2, ...)` | All listed classes are compiled before this class. Multiple dependencies use comma-delimited single line or separate lines. |
| `Deprecated` | Class is deprecated; Objects won't be saved when serializing. Inherited by subclasses. |
| `DontAutoCollapseCategories=(Category, Category, ...)` | Negates `AutoCollapseCategories` for listed categories from parent class. |
| `DontCollapseCategories` | Negates `CollapseCategories` inherited from base class. |
| `EditInlineNew` | Objects can be created from Editor Property window rather than referenced from existing Assets. Propagated to child classes; overrideable with `NotEditInlineNew`. |
| `HideCategories=(Category1, Category2, ...)` | Hides specified categories from the user entirely. Propagated to child classes. |
| `HideDropdown` | Prevents this class from showing in property window combo boxes. |
| `HideFunctions=(Category1, Category2, ...)` or `HideFunctions=FunctionName` | Hides specified functions from user entirely. |
| `Intrinsic` | Indicates the class was declared directly in C++, no boilerplate from **Unreal Header Tool**. Do not use on new classes. |
| `MinimalAPI` | Exports only the class's type information for other modules. Class can be cast to, but functions cannot be called (except inline). Improves compile times. |
| `NoExport` | Declaration shouldn't be included in auto-generated C++ header. Must be defined manually. Only valid for native classes; don't use for new classes. |
| `NonTransient` | Negates `Transient` inherited from base class. |
| `NotBlueprintable` | Not an acceptable base class for creating Blueprints. Default; inherited by subclasses. |
| `NotPlaceable` | Negates `Placeable` inherited from base class. Objects cannot be placed into Levels, UI scenes, or Blueprints in Editor. |
| `PerObjectConfig` | Configuration stored per Object, with sections in `.ini` named `[ObjectName ClassName]`. Propagated to child classes. |
| `Placeable` | Can be created in Editor and placed into level, UI scene, or Blueprint. Propagated to child classes; overrideable with `NotPlaceable`. |
| `ShowCategories=(Category1, Category2, ...)` | Negates `HideCategories` for listed categories from base class. |
| `ShowFunctions=(Category1, Category2, ...)` or `ShowFunctions=FunctionName` | Shows specified functions in property viewer. |
| `Transient` | Objects never saved to disk. Useful for non-persistent native classes like players or windows. Propagated to child classes; overrideable by `NonTransient`. |
| `Within=OuterClassName` | Objects cannot exist outside instance of `OuterClassName` Object. Creating requires `OuterClassName` instance as `Outer` Object. |

## Class Meta Tag 一覧表

原文の表をそのまま転記。

| Class Meta Tag | Effect |
|----------------|--------|
| `BlueprintSpawnableComponent` | Component Class can be spawned by a Blueprint. |
| `BlueprintThreadSafe` | Only valid on Blueprint function libraries. Marks functions as callable on non-game threads in animation Blueprints. |
| `ChildCannotTick` | For Actor and Component classes. If native class cannot tick, Blueprint-generated subclasses cannot tick, even if `bCanBlueprintsTickByDefault` is true. |
| `ChildCanTick` | For Actor and Component classes. If native class cannot tick, Blueprint-generated subclasses can override `bCanEverTick` flag, even if `bCanBlueprintsTickByDefault` is false. |
| `DeprecatedNode` | For behavior tree nodes; indicates class is deprecated and displays warning when compiled. |
| `DeprecationMessage="Message Text"` | Deprecated classes include this text with standard deprecation warning during Blueprint Script compilation. |
| `DisplayName="Blueprint Node Name"` | Blueprint Script node name replaced with provided value instead of code-generated name. |
| `DontUseGenericSpawnObject` | Do not spawn Object using Generic Create Object node in Blueprint Scripts; applies to Blueprint-type classes neither Actors nor Actor Components. |
| `ExposedAsyncProxy` | Expose proxy Object in Async Task nodes. |
| `IgnoreCategoryKeywordsInSubclasses` | Makes first subclass ignore all inherited `ShowCategories` and `HideCategories` Specifiers. |
| `IsBlueprintBase="true/false"` | States if class is acceptable base for creating Blueprints, similar to `Blueprintable` or `NotBlueprintable` Specifiers. |
| `KismetHideOverrides="Event1, Event2, .."` | List of Blueprint events not allowed to be overridden. |
| `ProhibitedInterfaces="Interface1, Interface2, .."` | Lists Interfaces incompatible with the class. |
| `RestrictedToClasses="Class1, Class2, .."` | Blueprint function library classes restrict usage to named classes. |
| `ShortToolTip="Short tooltip"` | Short tooltip for contexts where full tooltip might overwhelm, like Parent Class Picker dialog. |
| `ShowWorldContextPin` | Blueprint nodes in graphs owned by class must show World context pins, even if normally hidden, because Objects cannot be World context. |
| `UsesHierarchy` | Indicates class uses hierarchical data. Instantiates hierarchical editing features in Details panels. |
| `ToolTip="Hand-written tooltip"` | Overrides automatically generated tooltip from code comments. |
| `ScriptName="DisplayName"` | Name for class, property, or function when exporting to scripting language. Include deprecated names as additional semi-colon-separated entries. |

## コンストラクタパターン集（各パターンの使いどころ）

原文「Class Constructor」以下の節を、パターンごとの使いどころで整理する。

### 基本形（引数なし）
```cpp
UMyObject::UMyObject()
{
    // Initialize Class Default Object properties here.
}
```
Class Default Object（CDO = 将来の全インスタンスが基にするマスターコピー）のプロパティを初期化する最も基本的な形。原文の実例 `AUTDemoHUD::AUTDemoHUD()` はこの形で `SomeProperty = 26;` のような単純な代入を行っている。

### `FObjectInitializer` 付き
```cpp
UMyObject::UMyObject(const FObjectInitializer& ObjectInitializer)
: Super(ObjectInitializer)
{
    // Initialize CDO properties here.
}
```
使いどころ: プロパティやサブオブジェクトの生成を「上書き」したい場合。`FObjectInitializer` は `const` 修飾されているが、内部の mutable な関数経由で設定を変更できる（原文: 「despite being const-marked, configures via built-in mutable functions to override properties and subobjects」）。

実例（デフォルトサブオブジェクトの生成を止める）:
```cpp
AUDKEmitterPool::AUDKEmitterPool(const FObjectInitializer& ObjectInitializer)
: Super(ObjectInitializer.DoNotCreateDefaultSubobject(TEXT("SomeComponent")).DoNotCreateDefaultSubobject(TEXT("SomeOtherComponent")))
{
    // Initialize CDO properties here.
}
```
使いどころ: 親クラスが持つデフォルトサブオブジェクトのうち、サブクラスでは不要なものを明示的に生成しない場合。

両形式とも「初期化コードを書かなくてもエンジンが全フィールドを 0/NULL/デフォルトコンストラクタ値に初期化する」点は共通（原文: 「Although neither constructor performs initialization, the engine initializes all fields to zero, NULL, or default constructor values.」）。ただしこの初期化が有効なのは `CreateNewObject` や `SpawnActor` など「エンジン経由で正しく作られたインスタンス」に限る。

### ConstructorStatics + アセット参照（`FObjectFinder`）
```cpp
ATimelineTestActor::ATimelineTestActor()
{
    struct FConstructorStatics
    {
        ConstructorHelpers::FObjectFinder<UStaticMesh> Object0;
        FConstructorStatics()
        : Object0(TEXT("StaticMesh'/Game/UT3/Pickups/Pickups/Health_Large/Mesh/S_Pickups_Base_Health_Large.S_Pickups_Base_Health_Large'"))
        {
        }
    };
    static FConstructorStatics ConstructorStatics;

    StaticMesh = ConstructorStatics.Object0.Object;
}
```
使いどころ: コンストラクタ内でアセット（`UStaticMesh` 等）をハードコードパスから読み込みたい場合。`ConstructorHelpers::FObjectFinder` は `StaticLoadObject` を使って対象を検索し、見つからなければ失敗を報告する。`static` 修飾により初回のみ検索コストが発生する。

### クラス参照（`FClassFinder` / `StaticClass()`）
```cpp
APylon::APylon(const class FObjectInitializer& ObjectInitializer)
: Super(ObjectInitializer)
{
    static FClassFinder<UNavigationMeshBase> ClassFinder(TEXT("class'Engine.NavigationMeshBase'"));
    if (ClassFinder.Succeeded())
    {
        NavMeshClass = ClassFinder.Class;
    }
    else
    {
        NavMeshClass = nullptr;
    }
}
```
使いどころ: モジュールを跨いだクラス参照。同一モジュール内で完結するなら次のようにシンプルに書ける:
```cpp
NavMeshClass = UNavigationMeshBase::StaticClass();
```

### コンポーネント・サブオブジェクトの生成とアタッチ
```cpp
UCLASS()
class AWindPointSource : public AActor
{
    GENERATED_BODY()
    public:

    UPROPERTY()
    UWindPointSourceComponent* WindPointSource;

    UPROPERTY()
    UDrawSphereComponent* DisplaySphere;
};

AWindPointSource::AWindPointSource()
{
    WindPointSource = CreateDefaultSubobject<UWindPointSourceComponent>(TEXT("WindPointSourceComponent0"));

    if (RootComponent == nullptr)
    {
        RootComponent = WindPointSource;
    }
    else
    {
        WindPointSource->AttachTo(RootComponent);
    }

    DisplaySphere = CreateDefaultSubobject<UDrawSphereComponent>(TEXT("DrawSphereComponent0"));
    DisplaySphere->AttachTo(RootComponent);

    DisplaySphere->ShapeColor.R = 173;
    DisplaySphere->ShapeColor.G = 239;
    DisplaySphere->ShapeColor.B = 231;
    DisplaySphere->ShapeColor.A = 255;
    DisplaySphere->AlwaysLoadOnClient = false;
    DisplaySphere->AlwaysLoadOnServer = false;
    DisplaySphere->bAbsoluteScale = true;
}
```
使いどころ: Actor にコンポーネントを持たせて階層を組む標準パターン。原文が強調する 2 点:
1. `RootComponent` が未設定なら最初のコンポーネントを RootComponent にする、既にあれば `AttachTo` で子として繋ぐ、という分岐が定型
2. コンストラクタで生成したコンポーネントポインタは必ず `UPROPERTY` として所有クラスに保持する（GC・生成・破棄の保証のため）

親クラスのコンポーネントを変更する必要は通常ないが、`GetAttachParent` / `GetParentComponents` / `GetNumChildrenComponents` / `GetChildrenComponents` / `GetChildComponent` を任意の `USceneComponent`（root component 含む）に対して呼べば、親クラス分も含めた全アタッチ済みコンポーネントの一覧が取れる。

### ヘッダにインラインでコンストラクタを書く場合
原文: 「Constructors can be placed inline in class header files. However, if the header contains the constructor, the UClass must be declared with the `CustomConstructor` specifier, preventing automatic code generator creation.」
使いどころ: 通常は `.cpp` に置くが、ヘッダにインラインで書きたい場合は `CustomConstructor` specifier が必須（自動コード生成との衝突を避けるため）。

## SCRAP BLITZ に活かせる部分

本プロジェクトは UE5.8 で C++ 実装済み（`Source/ScrapBlitz/Private/` 配下に `SBCrate.cpp` 等の既存クラス群あり）。今回はコードを実際には読んでいないため、以下は「一般的な良し悪しの判断基準」として書く。断定的な診断ではない。

- **UCLASS specifier の使い分け確認**: 既存の Actor/Component クラスが `Blueprintable` / `BlueprintType` を意図通りに持っているか（デザイナーが BP でサブクラス化する想定のクラスに付いているか、逆に C++ 専用のクラスに不要な specifier が付いていないか）は、一般論として点検する価値がある観点
- **コンポーネントの UPROPERTY 保持**: 「コンストラクタで生成したコンポーネントポインタは必ず UPROPERTY で持つ」という原則は GC・シリアライズの正しさに直結する。SCRAP BLITZ の既存クラスでコンポーネントを動的生成している箇所があれば、この原則に沿っているか確認する価値がある一般的な観点
- **ConstructorStatics パターンの適用場面**: アセットをコンストラクタでハードコードパス読み込みしている箇所があれば、`static` なローカル構造体で「初回のみ検索」にできているか確認できる。ただし原文自体が「本来は Blueprint 経由が望ましく、ハードコードは brittle」と述べているため、まず「そもそもハードコードにする必要があるか」を優先して問うのが筋
- **`MinimalAPI` / コンパイル時間**: OC/SP 技の実装が進み C++ ファイル数・モジュール間参照が増えている段階では、他モジュールから型情報だけ必要なクラスに `MinimalAPI` を検討する余地があり得る（一般論。実測なしに導入すべきという話ではない）
- **RootComponent 分岐パターン**: 「未設定なら最初の生成コンポーネントを RootComponent にする、既にあれば AttachTo」という分岐は、機体・武器・OC エフェクト用の Actor サブクラスを新設する際の定型として参照できる

## ソースだけでは取れなかったもの

- 原文は Epic 公式ドキュメントの断片的な抜粋であり、ページ末尾で唐突に終わっている（「Modifying a component from the parent class...」の段落で完結しており、次章への接続や「Class Destructor」等の関連トピックへの言及は原文中に存在しない）。関連するはずの「デストラクタ」「シリアライズ詳細」「UPROPERTY specifier 一覧（今回は Class specifier/meta tag のみで Property specifier は対象外）」は本ソースの範囲外
- `EnginePrivate.h` のインクルード例は現行の UE5.8 でも通用する記法か原文からは判断できない（古いエンジンバージョンの慣習を引きずっている可能性があり、原文もこれを「必須」とは明言していない）
- 各 specifier / meta tag の「実際にどのクラスで使われているか」の具体例は、一覧表内では `Config` や `ClassGroup` など一部を除き記載が薄く、動作を目視確認できるような UI 挙動の画像・スクリーンショット相当の情報は当然ながらテキストのみでは再現できない
