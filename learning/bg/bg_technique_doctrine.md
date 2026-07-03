# 背景クオリティ・ドクトリン（蒸留版）

学習動画 20 本+公式doc 4本からの横断抽出。**日常作業ではこのファイルだけ読む**（上限 3.5KB・超過時は要圧縮）。
出典・詳細・全パラメータは `videos/` の個別ノート（読むときは Sonnet 委譲）。

## 画作りの原則

1. **露出は Manual 固定が先、物量は後** — Auto Exposure に画を任せない
2. **色調統一が「寄せ集め感」を消す** — Unlit Mode で確認し全マテリアルを Multiply で同一色相へ。例外なし
3. **縁・継ぎ目を消すのが質感の分水嶺** — フォグは Depth Fade／地形の粗は地物で隠す／decal でシーム隠し／接地は RVT
4. **スケール基準を最初に固定**（自機 10m canonical）

## set dressing（配置センス）

5. **anchor 連鎖** — 大物→関連小物へ「物語」を連鎖。均等散布しない
6. **整列崩し** — 直線に小回転・寄り掛からせ生活感
7. **構造物は構図装置** — barrier / leading line / 陰影とディテール面積
8. **decal 3 種で汚す** — 漏水シミ・埃堆積・路面ライン。地面に「読める情報」

## 定型テクニック

- **自作フォグ平面**: Translucent + Radial Gradient Exp + Depth Fade + Noise版2種 → MI 化
- **タイリング対策**: TexCoord→Multiply→Scalar "tiling"。広域は Texture Bombing。**適用対象はLandscape等の広域連続面のみ**——プロ配布のモジュラーキット（Fab等）はパーツ専用ベイク済みでTexCoordノード自体が無いのが通常（実機検査で確認、⚠自作時に無条件適用しない）
- **Height Fog** density 0.08 前後。**PostProcess**: Unbound / Manual Exposure(9〜12) / Vignette / Saturation 1.1
- **RVT 2 Volume**（接地の height blend）。⚠垂直面シーム残存／Tile size変更は要再起動+DXT1オーバーサブスクライブ注意
- **Layer Blend Height** / **Mesh Paint（UE5.5+）**: weight blendの「べったり感」を height 情報で解消。低ポリでも高解像度の個体差汚し可（UVクリーン前提）
- **PCG Self-Pruning**: 小物重なり回避は実寸バウンズ判定（キューブでなく Get Bounds→Self-Pruning）
- **バリエーション量産**: Packed Level Actor 分解→改変→再パッケージ

## パフォーマンス（計測してから削る）

9. **ms で考える** — 固定 PerfCam + Insights で再現計測。budget は機能別配分
10. **映る範囲だけ品質** — 見えない Foliage は置かない・遠景 billboard・Cull Distance 必須
11. **影の設計** — CSM近景+DFS遠景+FarCascade(巨大構造物opt-in)。重いライト5点検: MaxDrawDistance/Intensity0/Attenuation過大/不要shadow/LightFunction誤用
12. **draw call 統合** — Merge Actors→ISM化・遠景は HLOD
13. **開発/本番切替** — 作業時 `foliage.ForceLOD 5`、レンダ時 0 + `r.ScreenPercentage 200`
14. **スポーン/メモリ対策の引き出し**: 大量スポーンはフレーム分散（例5体×6フレーム）／頻繁生成はObject Pooling／新規FX初出現のヒッチはPSO Precaching／メモリ内訳調査はLLM（カスタムタグ可）

## 運用

- **タイトルは中身を保証しない**（実例: "Military Trench"動画が実際はRVT/PCG技術解説だった）
