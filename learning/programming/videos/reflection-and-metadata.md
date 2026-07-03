# 学習ノート — UE5 Reflection System と Metadata Specifiers

- ソース1: Unreal Engine Reflection System（[../transcripts/reflection-system.md](../transcripts/reflection-system.md)）
  - URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/reflection-system-in-unreal-engine
- ソース2: Metadata Specifiers in Unreal Engine（[../transcripts/metadata-specifiers.md](../transcripts/metadata-specifiers.md)）
  - URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/metadata-specifiers-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc・情報量やや薄い) → Sonnet単独要約（監査待ち）

---

## Reflection System とは

Unreal Engine の Reflection System は「様々なマクロでクラスをカプセル化し、エンジンとエディタの機能を提供するもの」と説明されている。原文が言及する中核要素は以下（いずれも概要レベルの言及にとどまり、詳細説明やコード例は無い）。

- **UObject**: Unreal 内のオブジェクトの基底クラス
- **UCLASS マクロ**: UObject から派生したクラスにタグを付与する
- **TSubclassOf**: UClass の型安全性を提供するテンプレートクラス
- **USTRUCT()**: 構造体定義用マクロ
- **スマートポインタライブラリ**: Shared Pointers、Weak Pointers、Unique Pointers、Shared References を含む（原文に詳細説明なし）
- **インターフェース**: 複数のクラスで実装可能な関数と挙動（原文に詳細説明なし）
- **メタデータ指定子**: クラス、インターフェースなどとエンジン・エディタの相互作用を制御するもの（詳細は次章）
- **UFUNCTION / UPROPERTY マクロ**: エンジンにクラス・関数・変数を認識させ、ガベージコレクション対象にする

原文はこれらを列挙する形で「見取り図」を示しているのみで、各要素がどう連携するか（例えば UCLASS と UPROPERTY の関係、ガベージコレクションの仕組み自体）についての踏み込んだ説明はない。

## Metadata Specifier とは何か・Class Specifier との違い

メタデータ指定子は「クラス、インターフェース、構造体、列挙型、関数、またはプロパティを宣言する際に、それらがエンジンとエディタのさまざまな側面とどのように相互作用するかを制御するために追加できる」ものと定義されている。`UCLASS`、`UENUM`、`UINTERFACE`、`USTRUCT`、`UFUNCTION`、`UPROPERTY` の各マクロに `meta` キーワードを使って追加する。

原文が明記する重要な注意点として、**メタデータはエディタにのみ存在し、ゲームロジックでメタデータにアクセスするコードを書いてはならない**とされている。

Class Specifier との違いについて、原文はこの一点（`meta` キーワード経由で付与し、エディタ専用の情報である）以外を明示的には説明していない。両者の構文上・機能上の違いを一般化して述べた記述は原文中に見当たらなかった。

## メタデータ指定子一覧（代表例）

原文には以下のカテゴリ別の指定子が挙げられている。クラス用・列挙型用・インターフェース用・構造体用は原文の一覧をほぼそのまま転記できる分量だが、関数用・プロパティ用は原文自体が「代表例のみ」であることを注記している（詳細は次章参照）。

### クラス用メタデータ指定子

| 指定子 | 効果 |
|--------|------|
| `BlueprintSpawnableComponent` | コンポーネントが Blueprint 内でスポーン可能 |
| `BlueprintThreadSafe` | Blueprint 関数ライブラリの関数をゲーム以外のスレッドで呼び出し可能 |
| `ChildCannotTick` | 子クラスはティック不可 |
| `ChildCanTick` | 子クラスはティック設定をオーバーライド可能 |
| `DeprecatedNode` | ビヘイビアツリーノードが非推奨 |
| `DisplayName="Name"` | Blueprint での表示名を指定 |
| `IsBlueprintBase="true/false"` | Blueprint の基底クラスとしての適性を指定 |
| `ToolTip="Text"` | カスタムツールチップを設定 |

（原文注記: Gameplay Classes という別ソースにはこれとは別に、より完全なクラス用 Meta Tag 一覧があるとされている。重複時はそちらを正とする、との言及あり）

### 列挙型用メタデータ指定子

| 指定子 | 効果 |
|--------|------|
| `Bitflags` | フラグとして使用可能 |
| `Experimental` | 実験的で未サポートを表示 |
| `DisplayName="Name"` | 値の表示名を指定（値レベル） |
| `Hidden` | エディタに非表示 |

### インターフェース用メタデータ指定子

| 指定子 | 効果 |
|--------|------|
| `CannotImplementInterfaceInBlueprint` | Blueprint で実装不可 |

### 構造体用メタデータ指定子

| 指定子 | 効果 |
|--------|------|
| `HasNativeBreak="Module.Class.Function"` | カスタム Break ノードを指定 |
| `HasNativeMake="Module.Class.Function"` | カスタム Make ノードを指定 |
| `HiddenByDefault` | Make/Break ノードのピンをデフォルトで非表示 |

### 関数用メタデータ指定子（代表例・全体は30以上あるうちの一部）

原文が挙げているのは次の項目のみ: `AdvancedDisplay`、`ArrayParm` 関連、`BlueprintCallable` 関連、`Latent`、`WorldContext`、`DisplayName`、`DeprecatedFunction` など。個々の効果の説明文は原文になく、名称の列挙にとどまっている。

### プロパティ用メタデータ指定子（代表例・全体は25以上あるうちの一部）

原文が挙げているのは次の項目のみ: `ClampMin`/`ClampMax`、`DisplayName`、`EditCondition`、`ExposeOnSpawn`、`AllowedClasses`、`MakeEditWidget` など。こちらも個々の効果の説明文は原文になく、名称の列挙にとどまっている。

## SCRAP BLITZ に活かせる部分

本プロジェクトは UE5.8 で C++ 実装済みであり、UCLASS/UPROPERTY/UFUNCTION は既存コード全体で既に使用されている。ソース自体が概要レベルの情報しか持たないため、ここでは方向性の確認にとどめる。

- 既存コードの `UPROPERTY`/`UFUNCTION` 宣言に付いている `meta = (...)` 指定子（`ClampMin`/`ClampMax`、`EditCondition`、`DisplayName` 等）は、Blueprint 連携やエディタ上の表示・入力制限の調整に使われている可能性がある指定子として一致する。既存コードのメタデータを見直す・追加する際の名称の手がかりにはなる。
- 「メタデータはゲームロジックからアクセスしてはならない」という原則は、実装時に踏み外さないための確認ポイントとして留めておく価値がある。
- それ以上の具体的な適用判断（どの指定子をどのプロパティに付けるべきかなど）は、本ノートの情報量では踏み込めない。

## ソースの限界（重要）

両ソースとも情報量が薄く、次の点で不足がある。

- **Reflection System**: 概念の見取り図（UObject・UCLASS・TSubclassOf・USTRUCT・スマートポインタ・インターフェース・メタデータ指定子・UFUNCTION/UPROPERTY の名前と一行説明）のみで、各要素の詳細な動作説明やコード例が一切ない。ガベージコレクションの仕組み、スマートポインタ各種の使い分け、インターフェースの実装方法などは原文に踏み込んだ記述がなく、本ノートでも扱えていない。
- **Metadata Specifiers**: クラス用・列挙型用・インターフェース用・構造体用は一覧として扱えたが、**関数用は全体30以上のうち代表例のみ**、**プロパティ用は全体25以上のうち代表例のみ**であり、全項目を網羅していない。個々の指定子の詳細な使用例・引数の書式・組み合わせ時の挙動も原文に記述がない。
- 上記いずれについても、詳細な情報が必要な場合は公式ページ（本ノート冒頭の URL）を直接再取得し、必要であれば WebFetch を複数回・セクション単位で試すなどの追加抽出が必要。
