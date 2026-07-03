# SOURCE: Lumen Global Illumination and Reflections in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/lumen-global-illumination-and-reflections-in-unreal-engine
取得方法: WebFetch（要約モード。1回目は著作権懸念でツールが要約提案に切替。取得できたのは要約のみで全文再現は不可）
取得日: 2026-07-04
注記: 情報量は他ソースよりやや薄い（要約の要約に近い）。

---

Lumen is Unreal Engine 5's dynamic global illumination and reflections system for next-generation consoles. New projects enable it by default; existing UE4 projects must manually enable it via Project Settings under Rendering categories.

## 主要機能
- Infinite diffuse bounces（無限回のバウンス）
- Color bleed effects
- Indirect shadowing
- 全 Light Type をサポート（static light を除く）
- Sky lighting with shadowing
- Emissive material の光の伝播
- Roughness に応じた reflections

Lumen は Nanite・World Partition・Virtual Shadow Maps と統合されている。

## 設定箇所
- **Project Settings**: ray tracing モード・品質設定
- **Post Process Volume**: 品質調整・trace distance・lighting update speed

## 上級者向け考慮事項（言及のみ・詳細なし）
- material ambient occlusion
- clear coat の制限
- bent normal maps
