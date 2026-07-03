# SOURCE: Unreal Engine Reflection System
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/reflection-system-in-unreal-engine
取得方法: WebFetch（要約モード。2回試行したが原文詳細の抽出不可＝ページ自体が概要止まりの可能性）
取得日: 2026-07-04
注記: このソースは他ページ（Gameplay Classes 等）に比べ情報量が薄い。概念の見取り図として扱うこと。

---

Unreal Engine Reflection System は "encapsulates your classes with various macros that provide engine and editor functionality" と説明されている。

## 中核要素（概要レベルの言及のみ）

- **UObject**: Unreal内のオブジェクトの基底クラス
- **UCLASS マクロ**: UObjectから派生したクラスにタグを付与
- **TSubclassOf**: UClass型安全性を提供するテンプレートクラス
- **USTRUCT()**: 構造体定義用マクロ
- **スマートポインタライブラリ**: Shared Pointers、Weak Pointers、Unique Pointers、Shared Referencesを含む（詳細説明なし）
- **インターフェース**: 複数のクラスで実装可能な関数と挙動（詳細説明なし）
- **メタデータ指定子**: クラス、インターフェースなどとエンジン・エディタの相互作用を制御（詳細は metadata-specifiers.md 参照）
- **UFUNCTION/UPROPERTY マクロ**: エンジンにクラス、関数、変数を認識させ、ガベージコレクション対象にする
