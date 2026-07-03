# 学習ノート — Data Driven Gameplay Elements in Unreal Engine（Epic 公式ドキュメント）

- ソース: https://dev.epicgames.com/documentation/unreal-engine/data-driven-gameplay-elements-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/data-driven-gameplay-elements.md](../transcripts/data-driven-gameplay-elements.md)

## 全体像

外部（Excel 等の表計算ソフト）で管理したデータをインポートし、ゲームバランスやコンテンツを管理する仕組み。ゲームの寿命が延びるほど増大する作業量・複雑さを緩和することが目的。中核となるのは **DataTable**（構造化された行データ）と **Data Curves / Curve Table**（2次元の数値データ）の2本柱。

## DataTable の構造と作り方（FTableRowBase継承・CSVフォーマット・インポート手順）

DataTable は関連データを構造化テーブルにまとめる。フィールドは有効な UObject プロパティ（アセット参照を含む）に対応する。CSV をインポートする前に、`FTableRowBase` を継承した row container（構造体）を作成する必要がある。

**構造要件:**
- 1列目は "Name" という名前で、行識別子を含む
- 以降の列は UStruct 変数に 1:1 対応する
- 列見出しはプロパティ名に対応する

**構造例（レベルアップシステム、原文コード）:**
```cpp
USTRUCT(BlueprintType)
struct FLevelUpData : public FTableRowBase
{
    int32 XPtoLvl;
    int32 AdditionalHP;
    TSoftObjectPtr<UTexture> AchievementIcon;
};
```

**CSV フォーマット例（原文）:**
```
Name,XPtoLvl,AdditionalHP,AchievementIcon
1,0,0,"Texture2d'/Game/Textures/AchievementIcon1'"
2,1000,9,"Texture2d'/Game/Textures/AchievementIcon2'"
```

重要な注記（原文）: "The double quotes around the asset type are important for the property importing pipeline."（アセット型の周りのダブルクォートはプロパティインポートパイプラインにとって重要）

### DataTable インポート手順
1. スプレッドシートを `.csv` としてエクスポートする
2. Content Browser で **Import** をクリックする
3. インポート種別を選択する: DataTable / CurveTable / Float Curve / Vector Curve / Linear Color Curve
4. ドロップダウンから DataTable Row Type を選択する
5. インポートオプションを設定する:
   - **Ignore Extra fields** — マッチしない列を無視する
   - **Ignore Missing Fields** — 期待されるが存在しないプロパティをバイパスする
   - **Import Key Field** — カスタム行識別子を指定する
6. Content Browser に DataTable オブジェクトが作成される
7. ダブルクリックで表示。右クリック → **Reimport** で更新する

## Data Curves / Curve Table（補間方法3種：Constant/Linear/Cubic）

**Data Curves** は DataTable と似た動作だが、浮動小数点値のみをサポートする。1列目は "Name" のままだが、以降の列は X軸変数とその対応する Y軸値を表す。

原文で挙げられている例: ダメージ進行テーブルでは、列が進行値（0〜3）を表し、行が Melee_Damage・Melee_KnockBack・Melee_KnockBackAngle・Melee_StunTime を進行スペクトラムに沿って追跡する。

**Curve Tables** は「2次元の数値データを定義するのに有用」（原文: "Curve Tables are useful for defining two dimensional numeric data."）。Curve Data Table Editor 上で Simple Curves・Rich Curves を外部プログラム無しに直接編集できる。Content Browser の **Miscellaneous** セクションから新規 Curve Table を作成する。

### Curve Table インポート手順
1. `.csv` としてエクスポートする
2. Content Browser で **Import** をクリックする
3. Import As オプションから **CurveTable** を選択する
4. Curve Table Type と補間方法を選択する:
   - **Constant** — 「X の間で Y の値は補間されない」（原文: "Values in Y Will not be interpolated between datapoints in X"）
   - **Linear** — 「Y の値は線形補間される」（原文: "Values in Y will be linearly interpolated"）
   - **Cubic** — 「Y の値は3次補間される」（原文: "Values in Y will be cubic interpolated"）
5. Content Browser に Curve Table オブジェクトが作成される
6. ダブルクリックでエディタを開く
7. グラフボタンで曲線を可視化できる。複数曲線の同時表示・右クリックメニューでのリネーム/削除に対応する

## データアクセス方法（FDataTableRowHandle/FCurveTableRowHandle・FindRow/GetCurve・キャッシュ禁止の制約）

テーブルデータを利用するには、**FDataTableRowHandle** または **FCurveTableRowHandle** 型の Blueprint 変数を公開する。それぞれ2つのサブフィールドを持つ:

| Subfield | 用途 |
|----------|------|
| DataTable/CurveTable | データソースへのコンテンツ参照 |
| RowName | 対象行の1列目識別子 |

### C++ でのデータ取得
ヘルパー関数 `FindRow()` と `GetCurve()` でデータアクセスが可能。`FCurveTableRowHandle` は `FRichCurve` ポインタを返す。`FDataTableRowHandle` はテンプレート化された呼び出しで対象構造体を指定する。

**重要な制約（原文）:** "All structures and curves returned should not be cached further than the local scope of a function"（返された構造体・曲線は関数のローカルスコープを超えてキャッシュすべきでない）— 再インポートされたデータ変更が即座に反映されるようにし、無効なポインタアクセスを防ぐため。

**遅延読み込みの注記:** `TSoftObjectPtr` を使うアセットフィールドはオンデマンドで読み込まれる。標準の `UTexture` フィールドはテーブルと同時に即座に読み込まれる。

## SCRAP BLITZ に活かせる部分

前提として、現状の C++ 実装が DataTable を既に使っているか、それとも数値がハードコードされているかは今回未確認。以下は「原文の仕組みをそのまま当てはめるとどうなるか」の整理であり、現状評価ではない。

本プロジェクトは `movies_log.xlsm` 等 Excel ベースのデータ管理実績を持つ（`project_movies_log.md`）。DataTable/Curve Table は「表計算ソフトで作った CSV を UE にインポートする」仕組みなので、Excel 運用との親和性は高いと考えられる。

**① 敵 tier（tier01〜06）のステータステーブル化**
敵の強度が tier01〜06 の段階で定義されている構造は、原文の「レベルアップシステム」構造例（`FLevelUpData` : `XPtoLvl` / `AdditionalHP` / `AchievementIcon`）とほぼ同型に対応させられる。tier ごとの HP・攻撃力・ノックバック耐性などを列に持つ `FEnemyTierData : public FTableRowBase` 構造体を作り、1列目 Name に `tier01`〜`tier06` を割り当てる形。原文のダメージ進行テーブル例（Melee_Damage・Melee_KnockBack・Melee_KnockBackAngle・Melee_StunTime を進行スペクトラムで管理）は、tier別ステータス管理の直接の参考になる構成。

**② OC パラメータの Curve Table 化（レベル/進行度に応じた数値変化）**
OC パラメータがレベルや進行度に応じて連続的に変化する数値（例: 威力倍率、SP コスト軽減率など）を持つ場合、Data Curves / Curve Table の「X軸=進行値、Y軸=対応する数値」という構造がそのまま当てはまる。補間方法の選択肢が3種（Constant/Linear/Cubic）ある点は、OC の性質によって使い分けられる可能性がある: 段階的にオンオフが切り替わるような効果は Constant、なだらかに強化されていく数値は Linear または Cubic、という対応が考えられる（※これは原文の補間定義からの当てはめであり、原文自体が OC やゲーム固有の推奨を述べているわけではない）。

**運用上の注意点**
- 「返された構造体・曲線をローカルスコープを超えてキャッシュしない」という制約は、tier/OC データを毎フレーム参照するような箇所（戦闘計算の内側など）で `FindRow`/`GetCurve` の呼び出しパターンを設計する際に踏まえる必要がある
- `TSoftObjectPtr` によるアセット遅延読み込みの仕組みは、tier別に異なるエフェクト/アイコンアセットを持たせる場合、即時ロードするテクスチャと使い分けられる

## ソースの限界

- 原文はワークフローの手順とデータアクセス API の概要にとどまり、パフォーマンス特性（大量データ時の検索コスト等）や DataTable/Curve Table のバージョン管理・差分運用についての言及はない
- Blueprint 側からのアクセス方法（ノードの具体的な使い方）についての記述はなく、C++ でのヘルパー関数（`FindRow`/`GetCurve`）の説明にとどまる
- CSV 以外のインポート元（JSON 等）についての言及はない
- 実際のプロジェクトでの大規模運用例（何百行規模のテーブルでの実践的な注意点）は含まれていない
