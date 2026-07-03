# 学習ノート — Lumen Global Illumination and Reflections in Unreal Engine

- ソース: 「Lumen Global Illumination and Reflections in Unreal Engine」Epic公式ドキュメント
- URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch（公式doc・要約止まり） → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/lumen-global-illumination.md](../transcripts/lumen-global-illumination.md)

## Lumen とは・有効化条件

Lumen は Unreal Engine 5 の、次世代コンソール向け**動的**グローバルイルミネーション・リフレクションシステム。

- 新規プロジェクトではデフォルトで有効化されている
- 既存の UE4 プロジェクトでは Project Settings の Rendering カテゴリから手動で有効化する必要がある

## 主要機能一覧

原文で列挙されているのは以下:

- Infinite diffuse bounces（無限回のディフューズバウンス）
- Color bleed effects（色移り効果）
- Indirect shadowing（間接影）
- 全 Light Type をサポート（static light を除く）
- Sky lighting with shadowing（影付きのスカイライティング）
- Emissive material の光の伝播
- Roughness に応じた reflections（粗さに応じた反射）

また、Lumen は **Nanite・World Partition・Virtual Shadow Maps と統合されている**、という記述がある。

## 設定箇所（Project Settings / Post Process Volume）

- **Project Settings**: ray tracing モード・品質設定
- **Post Process Volume**: 品質調整・trace distance・lighting update speed

原文にはこれ以上の個別パラメータ名・数値は記載されていない。

## SCRAP BLITZ に活かせる部分

- SCRAP BLITZ は UE5.8 で背景制作中。既存の bg 系ドクトリンは Lumen そのものの解説が薄かったため、「Lumen が Nanite / World Partition / Virtual Shadow Maps と統合されている」という位置づけ情報自体が新規性がある
- 品質・パフォーマンス調整の入口が Project Settings（ray tracing モード）と Post Process Volume（trace distance・lighting update speed）の2箇所に分かれる、という構造は押さえておく価値がある
- ソース自体が薄いため、具体的な数値調整や実装手順への展開はここでは行わない（別途、より詳細なソースでの補強が必要）

## ソースの限界（必須）

このソースは WebFetch が1度目に著作権懸念で全文取得を拒否し、要約のみを返した経緯がある。そのため他のプログラミング/背景系ソースより情報量が薄い。

- 「上級者向け考慮事項」として原文で言及されていたのは以下の3項目のみで、**言及があるだけで詳細な説明は無い**:
  - material ambient occlusion
  - clear coat の制限
  - bent normal maps
- 具体的なパラメータ数値（trace distance の推奨値、lighting update speed の設定範囲など）は原文に一切記載が無い
- 有効化の具体的な操作手順（Project Settings 内のどのメニュー階層か等）も記載が無い
- 本ノートは上記の薄い原文の範囲でのみ構成しており、一般知識での補完は行っていない
