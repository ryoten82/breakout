# 学習ノート 02 — Make an Underwater Scene in Unreal Engine 5

- 動画: https://www.youtube.com/watch?v=y1C9O9xZSD4 （5:01）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/y1C9O9xZSD4.txt](../transcripts/y1C9O9xZSD4.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

短尺チュートリアルだが、水中シーン制作の一連の手順を凝縮している:

1. **土台** [00:11–00:29] — 外部配布の Underwater Blueprint をダウンロード・展開 → 新規 Basic Level → デフォルトの地面を削除 → Content Browser からブループリントクラスをドラッグ&ドロップして配置
2. **Post Process Volume 設定** [00:31–01:19] — Visual Effects から Post Process Volume を追加し、水中の画作りをここでほぼ決め切る（詳細は下記教訓 1）
3. **キャラクター（サメ）導入** [01:09–01:53] — Sketchfab から無料 3D モデル（スケルタルメッシュ＋アニメーション）をダウンロード → FBX インポート（Skeletal Mesh 選択・アニメーションも import all）→ テクスチャをマテリアルに手動接続 → シーンに配置
4. **Level Sequencer とカメラ** [01:58–02:20] — 新規 Level Sequencer 作成 → カメラをインポートし "Snap object to view" で狙った位置に配置 → カメラの Film Back を Digital Film から DSLR に変更、Aperture を調整
5. **アニメーション** [02:23–03:06] — サメとカメラを Sequencer に追加 → カメラに Transform キーフレーム → サメにアニメーション追加（再生速度・フレームレート調整）→ サメの移動を始点・終点の Transform キーフレームで作り、補間モードを Linear に変更
6. **カメラシェイク** [03:08–03:44] — 新規フォルダに Camera Shake Base ブループリントを作成 → Perlin Noise Camera Shake Pattern を選択しパラメータ設定 → カメラに適用
7. **Movie Render Queue 準備** [03:45–04:05] — プラグイン有効化・エンジン再起動 → 再起動後の照明不具合は Post Process の Reflections Method 変更で対処
8. **レンダリング設定** [04:12–04:51] — Render 画面で PNG Sequence に変更、Anti-Aliasing・Temporal Sample・Warm Up 等を設定して Render Local

## クオリティを上げる教訓（講師が語った理由・判断基準）

### 1. Post Process Volume が水中の「画作り」の核 [00:31–01:19]
講師は最初にこれを最重要工程と明言している [00:59 "the most important part"]:
- **Infinite Extent (Unbound)** を有効化
- **Exposure**: Metering Mode を Auto → **Manual** に変更し、値を約8に設定（"set the value around a"＝字幕崩れ、詳細値は下表参照）
- **Bloom**: 有効化し、Method を Standard → **Convolution** に変更、Intensity を少し上げる（数値化された言及はなし）
- **Image Effects**: Vignette と Sharpen を追加
- **Global (色調)**: Saturation を有効化し **1.2** に設定
- **Global Illumination**（"the most important part" と講師が強調）: Lumen → **Screen Space** に変更 — 水中のライティング表現に GI 方式の切り替えが決定的に効くという判断
- **Motion Blur**: 追加し Target FPS を **24** に設定

判断基準として明言されているのは「GI を Lumen から Screen Space に変える」ことだけが "the most important part" と名指しされている点。他の設定（Bloom, Vignette 等）は手順として述べられるのみで、なぜそれを選ぶかの理由説明は字幕に出てこない。

### 2. カメラは映画的機材設定に寄せる [02:15–02:23]
Film Back を Digital Film から **DSLR** に変更し、Aperture を **4** に設定。理由の説明はないが、実写的な被写界深度・レンズ感を出す意図と推測される（※推定＝講師の説明なし、字幕からの手順のみ）。

### 3. インポートしたアニメーションは基本的に速すぎる前提で調整する [02:38–02:50]
講師: 「アニメーションが速すぎるのでスローダウンする」[02:38–02:39]。Animation Track のプロパティで Play Rate を 1 から変更し、Frame Rate も **24** に変更。既製アセットのモーション速度をそのまま使わず、シーンのペースに合わせて必ず調整するという姿勢。

### 4. 移動アニメーションは補間モードを明示的に Linear にする [02:59]
始点・終点の Transform キーフレームを打った後、Interpolation Mode を **Linear** に変更。デフォルト補間（Cubic 系の緩急）ではなく直線的な動きを意図的に選んでいる（理由の言語化は字幕になし）。

### 5. カメラシェイクは Perlin Noise ベースで有機的な揺れを作る [03:12–03:34]
Camera Shake Base ブループリント内で **Perlin Noise Camera Shake Pattern** を選択。Rotation Amplitude を **0.4**、Rotation Frequency を **6** に設定し、Duration を **0**（＝無限に持続、と推測される設定）にする。水中の漂うようなカメラの揺れをランダムノイズで表現する定型パターン。

### 6. プラグイン有効化後の不具合は Reflections Method 変更で対処という実践知 [03:58–04:06]
Movie Render Queue プラグイン有効化・再起動後に「lightning issues」（原文ママ、lighting の誤字幕）が出ることがあると講師は明言し、その対処法として Post Process Volume の **Reflections Method** を変更することを挙げている。既知のトラブルシューティング手順として言及。

### 7. レンダリング品質はサンプル数とウォームアップで担保 [04:30–04:49]
Anti-Aliasing で Temporal Sample Count を **32** に設定。さらに Anti-Aliasing タブで **Warm-up Count** を **120** に設定。これらは最終出力のノイズ除去・安定化のための定型値として提示されている（個別の理由説明は字幕になし）。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Post Process | Exposure Metering Mode | Auto → Manual | [00:46] |
| Post Process | Exposure 値 | 約8※ | [00:48]（字幕 "around a"、推定） |
| Post Process | Bloom Method | Standard → Convolution | [00:52–00:54] |
| Post Process | Saturation | 1.2 | [01:07] |
| Post Process | Global Illumination | Lumen → Screen Space（最重要と明言） | [01:09–01:15] |
| Post Process | Motion Blur Target FPS | 24 | [01:17–01:20] |
| カメラ | Film Back | Digital Film → DSLR | [02:17] |
| カメラ | Aperture | 4 | [02:20–02:23] |
| サメアニメーション | Play Rate | 1 → 0.4※ | [02:44]（字幕 "change... to4"、推定） |
| サメアニメーション | Frame Rate | 24 | [02:47–02:50] |
| 移動キーフレーム | Interpolation Mode | Linear | [02:59] |
| Camera Shake | Pattern | Perlin Noise Camera Shake Pattern | [03:23] |
| Camera Shake | Rotation Amplitude | 0.4 | [03:25–03:28] |
| Camera Shake | Rotation Frequency | 6 | [03:28–03:32] |
| Camera Shake | Duration | 0 | [03:34] |
| レンダー出力形式 | Image Sequence | JPEG → PNG | [04:18–04:23] |
| レンダー | Temporal Sample Count | 32 | [04:34] |
| レンダー | Warm-up Count | 120 | [04:46–04:49] |

※ = 字幕崩れのため推定値（原文 "set the value around a" [00:48] / "change the play rate from 1 to4" [02:44]）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [00:16–00:29] Underwater Blueprint の内部構成（ポストプロセス的な水表現の実装方法・どのアクター/マテリアルで構成されているか）は「ダウンロードして配置する」としか語られず、中身は不明
- [00:44] Bloom Intensity の具体的な数値（「少し上げる」としか言及なし）
- [01:44–01:49] シャークマテリアルのテクスチャ接続の具体的なノード構成（どのテクスチャをどのピンに挿したか、視覚操作のみで音声説明なし）
- [02:52–03:06] サメの移動アニメーションの具体的な始点・終点座標、タイムライン長の最終値（"increase the timeline length" とあるが数値なし）
- [04:04–04:06] Reflections Method の変更先の具体的な設定値（「変更する」としか言及なし、どのモードにするかは字幕に出ない）

---

①内容サマリ
Underwater Blueprint（外部配布）を土台に、Post Process Volume（Manual Exposure・Bloom Convolution・Saturation 1.2・GI を Screen Space に変更が最重要と講師が明言）で水中の画作りを作り込み、Sketchfab のサメモデルをインポートしてマテリアル接続、Level Sequencer でカメラとサメのアニメーションを設定（補間 Linear・Play Rate 調整）、Perlin Noise ベースのカメラシェイクを追加し、Movie Render Queue で PNG Sequence・Temporal Sample 32・Warm-up 120 でレンダリングする、という一連の短尺ワークフロー。理由説明が明示されているのは「GI を Screen Space にすることが最重要」という1点のみで、他は手順の羅列に近い。

②確信度が低い抽出 上位3件
1. [00:48] Exposure 値「around a」→ 数値として8と推定したが、自動字幕の崩れが大きく元の数値に確信が持てない
2. [02:44] Play Rate「from 1 to4」→ 0.4 と解釈したが、文脈上 1/4（0.25）等の可能性も排除できない
3. [04:04–04:06] Reflections Method の変更先（Lumen/Screen Space/Ray Tracing 等のどれか）が字幕に一切現れず、変更したという事実のみで具体的な設定値は完全に不明

