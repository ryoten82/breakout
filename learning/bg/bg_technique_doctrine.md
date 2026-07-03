# 背景クオリティ・ドクトリン（蒸留版）

学習動画 16 本からの横断抽出。**日常作業ではこのファイルだけ読む**（上限 3.5KB・超過時は要圧縮）。
出典・詳細・全パラメータは `videos/` の個別ノート（読むときは Sonnet 委譲）。

## 画作りの原則

1. **露出は Manual 固定が先、物量は後** — Auto Exposure に画を任せない。ムードを決めてから密度を足す
2. **色調統一が「寄せ集め感」を消す** — Unlit Mode で素の色を確認し、全マテリアルを Albedo Tint / Multiply で同一色相へ。例外を作らない
3. **縁・継ぎ目を消すのが質感の分水嶺** — フォグ平面は Depth Fade／地形の粗は地物で隠す／decal でシーム隠し／接地は RVT
4. **スケール基準を最初に固定** — 基準オブジェクト先置き（自機 10m canonical）

## set dressing（配置センス）

5. **anchor 連鎖** — 大物→関連小物へ「物語」を連鎖（重機→資材→工具）。均等散布しない
6. **整列崩し** — 直線に小回転・アセット同士を寄り掛からせ生活感
7. **構造物は構図装置** — barrier（視線止め）/ leading line / 陰影とディテール面積
8. **decal 3 種で汚す** — 漏水シミ・埃堆積・路面ライン/汚れ。地面に「読める情報」

## 定型テクニック

- **自作フォグ平面**: Translucent + Radial Gradient Exp → Opacity/BaseColor、Depth Fade、Noise 版 2 種以上 → MI 化
- **タイリング対策**: TexCoord→Multiply→Scalar "tiling"（全 Landscape 材）。広域は Texture Bombing（Sampler Source=Shared Wrap）
- **Height Fog** density 0.08 前後。**PostProcess**: Unbound / Manual Exposure(9〜12) / Vignette / Sharpen / Saturation 1.1
- **RVT 2 Volume 構成**（BaseColor+Spec+Rough+Normal 系 / WorldHeight 系）: 地形×設置物の接地を height ベース blend で馴染ませる
- **Layer Blend Height**: weight blend の「べったり感」を height 情報で解消（ひび割れ・劣化表現に直結）
- **バリエーション量産**: Packed Level Actor 分解→改変→再パッケージ

## パフォーマンス（計測してから削る）

9. **ms で考える**（FPS は非線形）— 固定 PerfCam + `trace.start/stop` → Unreal Insights で再現計測。budget は機能別配分
10. **映る範囲だけ品質** — 見えない場所に Foliage を置かない・遠景 billboard・Foliage Cull Distance 必須（Bulk Edit via Property Matrix）
11. **影の設計** — CSM は近景に絞り、遠景は Distance Field Shadows、巨大構造物のみ Far Cascade（opt-in）。重いライト点検 5 種: MaxDrawDistance 未設定 / Intensity0 常時描画 / Attenuation 過大 / 不要 shadow cast / Light Function 誤用
12. **draw call 統合** — 同型メッシュは Merge Actors で ISM 化・遠景はサブレベル単位 HLOD（Generate Single Cluster For Level → Build）
13. **開発/本番切替** — 作業時 `foliage.ForceLOD 5`、最終レンダのみ 0 + `r.ScreenPercentage 200`
