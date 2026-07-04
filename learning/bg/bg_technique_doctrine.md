# 背景クオリティ・ドクトリン（蒸留版 v5）

動画 25 本+公式 doc 4 本の横断抽出（v5: KitBash3D 273 分統合）。**日常はこれだけ読む**（上限 3.5KB）。詳細は `videos/`（Sonnet 委譲）。

## 画作りの原則

1. **露出は Manual 固定が先、物量は後**
2. **色調統一が「寄せ集め感」を消す** — Unlit Mode 確認・全マテリアル Multiply で同一色相へ
3. **縁・継ぎ目が質感の分水嶺** — フォグ=Depth Fade／地形の粗は地物で隠す／decal でシーム隠し／接地=RVT
4. **スケール基準を最初に固定**（自機 10m canonical）
5. **構図は F/M/B + フォーカルポイント** — 全リーディングラインを焦点へ収束、「どこからでも見える」を保証。コントラスト最大は焦点側のみ

## set dressing

6. **anchor 連鎖** — 大物→関連小物へ物語を連鎖。**大→中→小の順で密度を積む**
7. **整列崩し** — 人工物はスナップ ON、自然物は OFF+Local 非一様スケール
8. **構造物は構図装置** — barrier / leading line / 好奇心を誘うシルエット
9. **decal 3 種で汚す** — 漏水・埃・路面ライン
10. **見えない場所に手間をかけない** — 密度に緩急、奥は岩で隠す程度。プレイテストで視認範囲を確認

## 定型テクニック

- **PLI 量産**: 使い回す群を選択→Packed Level Actor 化（Pivot=MinZ 接地/Center。⚠事後変更不可）。Edit→Commit で全インスタンス反映。複製は回転+スケールでシルエット差し（一様 1.3〜1.7・**非一様 1.75 倍までバレない**［伝聞・未検証］）
- **Is Spatially Loaded=OFF** — WP で遠景が距離消失する時の第一手。恒久表示の書割に必須
- **MPC 一括制御** — 環境全体トーンは MI 個別でなく MPC へ。**「後で直す」より「入口で決める」**（Bridge 側で Master Material 指定後に Add）
- **自作フォグ平面**: Translucent + Radial Gradient Exp + Depth Fade + Noise 版 2 種 → MI
- **タイリング対策**: TexCoord→Multiply→tiling は広域連続面のみ（プロキットはベイク済で TexCoord 無し・実測）。広域は Texture Bombing、単調さは 8K オーバーレイ（Lerp 0.5 前後）
- **Landscape 造形**: Flatten はピンポイント／高さ揃えは Flatten Target／Smooth→Erosion→Smooth 反復。地形はラフで良い
- **Layer Blend**: Sampler Source=**Shared: Wrap 必須**（16 上限の地雷）／Height Blend で境界の説得力／真っ黒=Layer Info 未登録
- **Height Fog** density 0.08 前後。**PostProcess**: Unbound / Manual Exposure(9〜12) / Saturation 1.1
- **RVT 2 Volume**（⚠垂直面シーム）／**Mesh Paint（5.5+）**／**PCG Self-Pruning**（実寸バウンズ）
- **Mesh to Collision（Modeling Mode）**: 汎用キットは Convex Hulls/Per Component 生成が SM エディタ内蔵より良好。すり抜け時のみ Complex as Simple

## パフォーマンス（計測してから削る）

11. **ms で考える** — 固定 PerfCam + Insights、budget 機能別配分
12. **映る範囲だけ品質** — 遠景 billboard・Cull Distance 必須
13. **影の設計** — CSM+DFS+FarCascade。重いライト 5 点検
14. **draw call 統合** — Merge Actors→ISM・HLOD。作業時 `foliage.ForceLOD 5`↔0
15. **スポーン/メモリ** — フレーム分散・Object Pooling・PSO Precaching・LLM

## 運用

- **タイトルは中身を保証しない**（実例: Military Trench→RVT 解説）
