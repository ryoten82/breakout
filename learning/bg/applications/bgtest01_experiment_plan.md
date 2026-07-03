# 適用実験計画 — テストレベル L_BGTest01

方針（ユーザー指示 2026-07-03）: **学習したテクニックは新規テストレベルで試す**。L_Stage01 には直接触らない。テストレベルで効果が確認できたものだけ、ユーザー判断を経て本番（L_Stage01）へ昇格。

- テストレベル: `L_BGTest01`（新規・使い捨て前提）
- 学習元: [../videos/ee-IOlWUZTo_ue5-environment-tutorial.md](../videos/ee-IOlWUZTo_ue5-environment-tutorial.md)
- セットアップ: 床 Plane + Fab の廃墟系プロップ数点 + 自機スケール基準（10m 基準は spec §0 canonical）を置いた最小構成で各実験を独立検証

## 実験一覧（優先順）

| # | 実験 | 動画出典 | 実行手段 | L_Stage01 の弱点との対応 |
|---|---|---|---|---|
| E1 | **自作フォグ平面マテリアル**（Translucent + Radial Gradient Exponential + Depth Fade + Tiling Noise 05、MI で Opacity/FadeDistance 可変） | [35:49–40:25] | UE MCP（マテリアル生成・ノード接続・配置） | 空気感の欠如。廃滑走路の「湿気・塵」レイヤー |
| E2 | **Post Process Volume 画作りセット**（Unbound・Manual Exposure・Vignette・Sharpen・Saturation・少量 Motion Blur） | [28:44][40:52–41:30] | UE MCP | 画のまとまり・締まり不足 |
| E3 | **カラーパレット統一**（サンプル 3〜4 アセットの MI に Albedo Tint / Multiply 定数を挟み同一色相へ寄せる。Unlit Mode で確認） | [30:15–34:19] | UE MCP + 視覚確認はユーザー | 寄せ集め Fab 素材の色調バラバラ感 |
| E4 | **Exponential Height Fog 調整**（density 0.08 前後・Start Distance 試行） | [40:30–40:44] | UE MCP | 遠景の空気遠近が無い |
| E5 | **スモークパーティクル**（FPS24 / WarmUp 500 / Z速度 400–600 / Rate 50。手持ちの Niagara/VFX 素材で代替） | [44:55–45:33] | UE MCP（既存素材次第） | 廃墟の「生きた空気」不足 |
| E6 | **路面デカール**（既存 Fab decal 素材：M_PaintLine / DecalStopLine / RoadDirt） | [35:16] | UE MCP | 地面に読める情報が無い（滑走路 decal 案と同根・handoff 済み素材リスト流用） |

## 評価方法

- 各実験は独立に ON/OFF できる形で置く（タグ `BGTEST_E1`〜`E6`）
- スクリーンショット比較（実験前/後）→ 最終判断はユーザーの目視
- 効果あり判定の実験のみ `l_stage01` 昇格リストに記載（本ファイル末尾に追記）

## 昇格リスト（テスト合格分）

（未実施）
