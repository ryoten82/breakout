# 学習ノート 01 — UE5 Environment Tutorial for Beginners（The Last of Us 風 黙示録的環境）

- 動画: https://www.youtube.com/watch?v=ee-IOlWUZTo （50:47）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet×3 並列要約 → Fable 監査（スポットチェック 5 件合格・幻覚なし）
- 原典 transcript: [../transcripts/ee-IOlWUZTo.txt](../transcripts/ee-IOlWUZTo.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

講師の作業順そのものが「環境制作の標準パイプライン」として学びになる:

1. **基盤** [00:15–01:30] — Blank プロジェクト → Empty Level → **Environment Light Mixer** で基本ライト一式（Skylight / Directional / Sky Atmosphere / Volumetric Clouds / Height Fog）をワンクリック生成 → **キャラサイズ基準の Cylinder を最初に置く**
2. **地形とベースマテリアル** [01:33–07:20] — Landscape 作成 → Quixel の Asphalt テクスチャで**自作 Landscape マテリアル**（既製 MI は Displacement 入力が無いため使わない）→ tiling パラメータでタイリング対策 → Landscape の Nanite 有効化 + Build data（Displacement 表示の前提）
3. **アセット導入・下ごしらえ** [07:52–14:10] — 無料アセット（キャラ・家・車等）を FBX インポート → テクスチャ手動接続（髪は Masked + Opacity Mask）→ 複数パーツは **Convert Actors to Static Mesh で 1 メッシュに結合**してから配置
4. **配置** [14:10–20:30] — 地面装飾 → 主役級プロップ（パトカー・家・標識）→ 背景山アセット → **遮光用の巨大 Cube** で太陽光を意図的に遮り陰影をコントロール
5. **植生と水** [20:32–28:30] — Foliage Mode で木・草・岩・瓦礫をペイント（Density/Scale/Z offset 調整、`foliage.ForceLOD 5` で FPS 確保）→ Water Plugin + Water Body Lake、湖底を Sculpt で彫る
6. **トーン統一（本命工程）** [28:33–34:30] — Post Process Volume（Unbound・Manual Exposure）→ Height Fog 調整 → **Unlit Mode に切り替えて全アセットの Albedo を Multiply/Tint でダークブルー系に一括で寄せる**
7. **空気感** [34:32–46:00] — 草の風揺れ有効化 → 路面デカール → **自作フォグ平面マテリアル** → スモークパーティクル → シネカメラ（DSLR/Prime レンズ/Tracking フォーカス）
8. **レンダリング** [47:53–50:30] — Movie Render Queue（PNG Sequence・Temporal Sample 32・`r.MotionBlurQuality 5` 等）

## クオリティを上げる教訓（SCRAP BLITZ に効く順）

### 1. シーン全体のカラーパレット統一 [30:15–34:19]
**寄せ集めアセットの「バラバラ感」の正体は色調の不統一。** Unlit Mode（ライティングの影響を排除して素の色を見る）に切り替え、全アセットのマテリアルを同じ色相（この動画ではダークブルー）へ寄せる。手法は 2 つ:
- Megascans 系: MI の **Color Overlay / Albedo Tint** を有効化して変更
- 任意マテリアル: グラフに **Multiply ノード（A=定数カラー, B=既存 Albedo）** を挟む — 既存の質感を壊さず色相だけ乗算で変える定型
- キャラのジャケットまで同じパレットに寄せている = 例外を作らない

### 2. フォグは「Height Fog + ローカルフォグ平面」の 2 層 [35:49–40:25]
遠景の空気遠近は Exponential Height Fog（density 0.08 前後・Start Distance は好みで調整）。近〜中景の「その場の湿気」は**自作の半透明平面マテリアル**:
- Translucent / **Radial Gradient Exponential** → Opacity と Base Color
- **Depth Fade** を Opacity に掛けて他メッシュとの交差線を消す（縁が硬いと即嘘になる [39:31]）
- バリエーション版はエンジン内蔵 **Tiling Noise 05** を Multiply（単調さ回避のため必ず 2 種以上作る [37:49]）
- MI 化して個体ごとに Opacity / Fade Distance を調整、回転・複製で散らす

### 3. 画作りは Post Process Volume で決める [28:44, 40:52–41:30]
- Unbound 有効化・**Exposure は Manual**（Auto に任せない。この動画は 9〜12 の間を試行）
- Vignette / Sharpen を足す、Saturation 1.1、Motion Blur 少量（Target FPS 24）
- **ムード（ライト・フォグ・露出）を先に決めてから物量を足す** [28:33] — 逆順だと物量調整が二度手間

### 4. スケール基準を最初に固定 [01:18]
キャラサイズの Cylinder を置いてから Landscape・配置に入る。プロポーション誤りを最初に潰す。

### 5. 配置の効率と負荷の管理
- 複数パーツ物は **Convert Actors to Static Mesh** で結合してから複製・移動 [12:36]
- 重い木は全面ペイントせず要所だけ手動配置 [18:33]
- Foliage は `foliage.ForceLOD 5` で作業時 FPS を確保、最終レンダのみ 0 [22:29, 50:14]
- 遮光 Cube のような「画面外の嘘」を使ってでも画角内の陰影を作る [20:04]

### 6. ディテールの最終レイヤー
- 路面デカール（駐車場ライン）[35:16] — 地面に「読める情報」を足す
- スモークパーティクル: FPS 24 / **Warm Up Time 500**（配置した瞬間から定常状態）/ Z 速度 400–600 / Spawn Rate 50 [44:55–45:33]
- 草の風揺れ（Megascans grass MI の wind 有効化）[34:32]

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Landscape マテリアル | Displacement Magnitude | 1 → 0.5※ | [05:11][06:52] |
| Foliage | ForceLOD（作業時/最終レンダ） | 5 / 0 | [22:29][50:14] |
| Post Process | Exposure (Manual) | 9〜12 を試行 | [29:11][34:24][42:38] |
| Height Fog | Fog Density | 0.08※ | [40:41] |
| Post Process | Saturation / Motion Blur FPS | 1.1 / 24 | [41:08][41:21] |
| シネカメラ | Lens / Aperture | 30mm Prime f1.4、50mm f1.8 | [42:23][47:09] |
| スモーク | WarmUp / Z速度 / SpawnRate | 500 / 400–600 / 50 | [44:59–45:29] |
| レンダ | Temporal/Spatial Samples | 32 / 2 | [49:23] |

※ = 字幕崩れのため推定値（原文 "like5" / "like8 2"）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [03:27] DefaultEngine.ini に追記した Displacement 用 RenderSettings **2 項目のキー名・値**（画面のコピペ操作で音声に乗らず）
- [07:00] Displacement 表示用**コンソールコマンド 2 つ**（同上）
- 各種ブラシワーク・配置センス（どこにどれだけ置くか）は文字情報に乗らない — ただし「判断基準」（縁を柔らかく・色を揃える・ムード先行）は言語で十分取れた
