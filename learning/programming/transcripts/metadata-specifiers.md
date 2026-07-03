# SOURCE: Metadata Specifiers in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/metadata-specifiers-in-unreal-engine
取得方法: WebFetch（2回試行・部分的な一覧取得。関数用/プロパティ用は「30以上」「25以上」の一部のみ）
取得日: 2026-07-04
注記: 網羅的な全項目ではなく代表例のみ。完全な一覧が必要な場合は公式ページを直接参照。

---

メタデータ指定子は「クラス、インターフェース、構造体、列挙型、関数、またはプロパティを宣言する際に、それらがエンジンとエディタのさまざまな側面とどのように相互作用するかを制御するために追加できる」もの。`UCLASS`、`UENUM`、`UINTERFACE`、`USTRUCT`、`UFUNCTION`、`UPROPERTY` マクロに `meta` キーワードを使用して追加する。

**重要**: メタデータはエディタにのみ存在し、ゲームロジックでメタデータにアクセスするコードを書いてはならない。

## クラス用メタデータ指定子（代表例）

| 指定子 | 効果 |
|--------|------|
| `BlueprintSpawnableComponent` | コンポーネントがBlueprint内でスポーン可能 |
| `BlueprintThreadSafe` | Blueprint関数ライブラリの関数をゲーム以外のスレッドで呼び出し可能 |
| `ChildCannotTick` | 子クラスはティック不可 |
| `ChildCanTick` | 子クラスはティック設定をオーバーライド可能 |
| `DeprecatedNode` | ビヘイビアツリーノードが非推奨 |
| `DisplayName="Name"` | Blueprintでの表示名を指定 |
| `IsBlueprintBase="true/false"` | Blueprintの基底クラスとしての適性を指定 |
| `ToolTip="Text"` | カスタムツールチップを設定 |

（※ Gameplay Classes ソースにはこれとは別に、より完全なクラス用 Meta Tag 一覧あり。重複時はそちらを正とする）

## 列挙型用メタデータ指定子

| 指定子 | 効果 |
|--------|------|
| `Bitflags` | フラグとして使用可能 |
| `Experimental` | 実験的で未サポートを表示 |
| `DisplayName="Name"` | 値の表示名を指定（値レベル） |
| `Hidden` | エディタに非表示 |

## インターフェース用メタデータ指定子

| 指定子 | 効果 |
|--------|------|
| `CannotImplementInterfaceInBlueprint` | Blueprintで実装不可 |

## 構造体用メタデータ指定子

| 指定子 | 効果 |
|--------|------|
| `HasNativeBreak="Module.Class.Function"` | カスタムBreakノード指定 |
| `HasNativeMake="Module.Class.Function"` | カスタムMakeノード指定 |
| `HiddenByDefault` | Make/Breakノードのピンをデフォルト非表示 |

## 関数用メタデータ指定子（代表例・全体は30以上）
`AdvancedDisplay`、`ArrayParm`関連、`BlueprintCallable`関連、`Latent`、`WorldContext`、`DisplayName`、`DeprecatedFunction` など

## プロパティ用メタデータ指定子（代表例・全体は25以上）
`ClampMin`/`ClampMax`、`DisplayName`、`EditCondition`、`ExposeOnSpawn`、`AllowedClasses`、`MakeEditWidget` など
