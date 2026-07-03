# SOURCE: Data Driven Gameplay Elements in Unreal Engine
URL: https://dev.epicgames.com/documentation/unreal-engine/data-driven-gameplay-elements-in-unreal-engine
取得方法: WebFetch（全文再現に近い・コードサンプル/CSV例まで取得できた非常に良質なソース）
取得日: 2026-07-04

---

## Overview
"Data Driven Gameplay helps mitigate the amount of work and complexity involved for games" with extended lifetimes. 外部（Excel等の表計算ソフト）で管理したデータをインポートしてゲームバランス・コンテンツを管理する仕組み。

## DataTables

DataTables は関連データを構造化テーブルにまとめる。フィールドは有効な UObject プロパティ（アセット参照含む）に対応する。CSV インポート前に `FTableRowBase` を継承した row container を作成する必要がある。

**構造要件:**
- 1列目は "Name" という名前で、行識別子を含む
- 以降の列は UStruct 変数に 1:1 対応
- 列見出しはプロパティ名に対応

**構造例（レベルアップシステム）:**
```cpp
USTRUCT(BlueprintType)
struct FLevelUpData : public FTableRowBase
{
    int32 XPtoLvl;
    int32 AdditionalHP;
    TSoftObjectPtr<UTexture> AchievementIcon;
};
```

**CSV フォーマット例:**
```
Name,XPtoLvl,AdditionalHP,AchievementIcon
1,0,0,"Texture2d'/Game/Textures/AchievementIcon1'"
2,1000,9,"Texture2d'/Game/Textures/AchievementIcon2'"
```

重要な注記: "The double quotes around the asset type are important for the property importing pipeline."（アセット型の周りのダブルクォートはプロパティインポートパイプラインに重要）

### DataTable インポート手順
1. スプレッドシートを `.csv` としてエクスポート
2. Content Browser で **Import** をクリック
3. インポート種別を選択: DataTable / CurveTable / Float Curve / Vector Curve / Linear Color Curve
4. ドロップダウンから DataTable Row Type を選択
5. インポートオプションを設定:
   - **Ignore Extra fields** — マッチしない列を無視
   - **Ignore Missing Fields** — 期待されるが存在しないプロパティをバイパス
   - **Import Key Field** — カスタム行識別子を指定
6. Content Browser に DataTable オブジェクトが作成される
7. ダブルクリックで表示。右クリック→**Reimport** で更新

## Data Curves

Data Curves は DataTables と似た動作だが、浮動小数点値のみサポート。1列目は "Name" のまま、以降の列は X軸変数とその対応する Y軸値を表す。

**ダメージ進行テーブルの例:** 列が進行値（0-3）を表し、行が Melee_Damage・Melee_KnockBack・Melee_KnockBackAngle・Melee_StunTime を進行スペクトラムに沿って追跡。

## Curve Tables

"Curve Tables are useful for defining two dimensional numeric data." Curve Data Table Editor 上で Simple Curves・Rich Curves を外部プログラム無しに直接編集可能。Content Browser の **Miscellaneous** セクションから新規 Curve Table を作成。

### Curve Table インポート手順
1. `.csv` としてエクスポート
2. Content Browser で **Import** をクリック
3. Import As オプションから **CurveTable** を選択
4. Curve Table Type と補間方法を選択:
   - **Constant** — "Values in Y Will not be interpolated between datapoints in X"
   - **Linear** — "Values in Y will be linearly interpolated"
   - **Cubic** — "Values in Y will be cubic interpolated"
5. Content Browser に Curve Table オブジェクトが作成される
6. ダブルクリックでエディタを開く
7. グラフボタンで曲線を可視化。複数曲線表示・右クリックメニューでのリネーム/削除に対応

## Data Hookup & Access

テーブルデータを利用するには、**FDataTableRowHandle** または **FCurveTableRowHandle** 型の Blueprint 変数を公開する。それぞれ2つのサブフィールドを持つ:

| Subfield | 用途 |
|----------|------|
| DataTable/CurveTable | データソースへのコンテンツ参照 |
| RowName | 対象行の1列目識別子 |

### C++ でのデータ取得
ヘルパー関数 `FindRow()` と `GetCurve()` でデータアクセス可能。FCurveTableRowHandle は FRichCurve ポインタを返す。FDataTableRowHandle はテンプレート化された呼び出しで対象構造体を指定する。

**重要な制約:** "All structures and curves returned should not be cached further than the local scope of a function"（返された構造体・曲線は関数のローカルスコープを超えてキャッシュすべきでない）— 再インポートされたデータ変更が即座に反映され、無効なポインタアクセスを防ぐため。

**遅延読み込みの注記:** `TSoftObjectPtr` を使うアセットフィールドはオンデマンドで読み込まれる。標準の `UTexture` フィールドはテーブルと同時に即座に読み込まれる。
