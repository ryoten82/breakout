# SOURCE: Light Types and Their Mobility in Unreal Engine
URL: https://dev.epicgames.com/documentation/unreal-engine/light-types-and-their-mobility-in-unreal-engine?lang=en-US
取得方法: WebFetch（要約モード。具体的な技術詳細まで取得できた良質ソース）
取得日: 2026-07-04

---

## 5種類の Light Type

**大規模ライティング:**
- **Directional Lights** — "the primary outdoor light, or any light that needs to appear as if it's casting light from extreme, or near infinite, distances."
- **Sky Lights** — シーン背景をキャプチャしレベルジオメトリに適用

**局所的ライティング:**
- **Point Lights** — 1点からの全方向光源
- **Spot Lights** — 1点からの円錐状の指向性光源
- **Rect Lights** — 矩形面からの投光

## Light Mobility の3状態

各ライトはパフォーマンスと機能性を決める3つの mobility 設定を持つ。

1. **Static** — 一切動かない・変化しないライト。事前計算済みライトマップに寄与するが、movable object への dynamic shadow はサポートしない
2. **Stationary** — 位置は固定だがゲームプレイ中に色・強度などのプロパティは変更可能。movable actor への dynamic shadow をサポートするが、**1オブジェクトあたり最大4灯まで**という制限あり
3. **Movable** — ゲームプレイ中に追加・削除・再配置が可能。dynamic shadow のみをキャストし、shadowing 有効時はパフォーマンスコストが高い。ただし non-shadowing 版は比較的軽量

Mobility の選択はパフォーマンス・見た目の品質・設計上の柔軟性に大きく影響する。
