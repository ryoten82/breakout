# 学習ノート 02 — Unreal Engine 5 Beginner Tutorial - UE5 Starter Course 2024（環境構築パート）

- 動画: https://www.youtube.com/watch?v=1ApMMOvGSuw （32:18）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/1ApMMOvGSuw.txt](../transcripts/1ApMMOvGSuw.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

Starter Course 系のため基礎操作説明（プロジェクト作成・保存等）は圧縮し、環境クオリティに関わる工程を厚めに記載。

1. **基盤** [00:34–01:24] — Blank プロジェクト（starter content 無し）作成 → File > New Level > Basic Level → Ctrl+S で `main` として保存 → Project Settings > Maps & Modes で Open World を `main` に変更
2. **Landscape 作成とスカルプト** [01:24–03:22] — Landscape ツールでサイズを 63→31 に変更、**Edit Layers を有効化**して作成 → Sculpt ブラシ（Strength/Brush Size/Brush Falloff 調整）で地形を作り込み、Shift 押下で削り込み、Smooth ツールで均す
3. **3D モデルのインポート** [03:23–07:15] — 外部サイトから風車小屋（windmill）モデルと丸太小屋（wooden cabin）モデルをダウンロード → Content Browser にフォルダ分けしてドラッグ＆ドロップでインポート（Import all）→ 分割パーツは選択して **Ctrl+G でグループ化** → テクスチャ（Albedo/Normal/Metallic/AO）を手動でマテリアルノードに接続して Apply
4. **Landscape マテリアルと Quixel Bridge 素材** [07:19–11:52] — Quixel Bridge から地面用マテリアル（grassy soil）をインポートし Landscape に適用 → **タイリングが目立つ問題をマテリアルの Tiling Offset 値を下げて解消** → Albedo マップの明度・Vibrance・Saturation を調整してリアルさを出す
5. **プロップ配置と Foliage** [12:00–17:45] — 木製フェンス・日本風神社階段などを Quixel からインポートして配置 → Foliage Mode で草（ribbon grass）・植物・花・岩（mossy stone pack）をペイント（Scale/Density/Intensity 調整）
6. **ライティングと Post Process** [17:46–20:23] — Ctrl+L でディレクショナルライトの角度を調整 → Post Process Volume を追加し **Infinite Extent（Unbound）を有効化** → Exposure を Manual にして Intensity を調整（9 前後） → Bloom / Vignette / Sharpen / Color Grading（Saturation・Shadow Saturation・Mid-tones）/ Motion Blur（Target FPS 24）
7. **水と背景山** [20:24–24:35] — Water Plugin を有効化しエンジン再起動 → Water Body Ocean を配置 → **Landscape への影響（Landscape Effect）を無効化**して地形の見た目を保持 → Epic Marketplace の無料アセット「background mountains」をインポートして背景に配置
8. **植生アニメーションと Billboard 木** [24:35–25:12] — Megascans マテリアルインスタンスで **Grass Wind を有効化**し風揺れを付与 → 遠景には木の Billboard（軽量版スプライト）を Foliage でペイントして負荷軽減
9. **レベルシーケンサーとカメラアニメーション** [25:12–30:37] — Level Sequencer 作成 → Cine Camera Actor を追加し視点にスナップ → Film Back を DSLR、Focal Length・Aperture を調整 → シーケンサーにカメラと風車のスケルタルメッシュを追加しアニメーション（羽の回転等）を割り当て、フレームレートを 30→24 に変更 → Epic Marketplace の無料アセット「animal pack」からキツネ・カラスを追加しアニメーション（idle look around 等）と Transform キーフレーム（補間モードを Linear に変更）を設定
10. **レンダリング** [30:37–32:18] — Movie Render Queue プラグインを有効化しエンジン再起動 → 出力形式を PNG Sequence（+ EXR 任意）に設定、Temporal Sample Count を 64、Warm Up Frames を 120 に設定 → 出力先ディレクトリ指定 → Render Local

## クオリティを上げる教訓

### 1. Landscape マテリアルのタイリング対策は必須工程として扱われている [08:54–09:20]
講師は「Quixel の地面マテリアルをそのまま貼るとタイリングが目立って悪い」と明言し、マテリアルを開いて **Tiling Offset のタイリング値を下げる**ことで見栄えが改善すると説明している。「見た目が悪い→パラメータを疑う」という順序が明示されている数少ない箇所。

### 2. Albedo の明度・彩度を後から手動調整する判断 [11:10–11:51]
アセット配置が終わった後で「Landscape の明るさを下げる」と述べ、Albedo マップのブライトネスを 7 程度に下げ、Vibrance と Saturation を上げている。理由の言語化は薄いが、**「配置→トーン調整」の順序**（先に物量、後で色）は前掲ノート（ee-IOlWUZTo）の「ムード先行」とは逆の手順であり、この動画では暗に「置いてから馴染ませる」ワークフローになっている点は対比として記録に値する。

### 3. Water Body Ocean の Landscape Effect は明示的に無効化が必要 [21:05–21:34]
「Ocean を追加すると Landscape に影響を与えてしまう（地形が変形/侵食されるような効果）ので、これを無効にする必要がある」と明言。detail panel からこの効果を切ることで「Landscape の見た目が良くなる」と述べている。**水系アクターは地形への副作用を持つため、意図しない変形を都度チェックする**という教訓。

### 4. Post Process の設定は Cine Camera 側と重複させない [26:47–26:53]
シネカメラ設定時に「これらは Post Process Volume で既に変更した設定と同じなので、ここでは変更する必要がない」と明言。**Exposure/Aperture 系の設定は Post Process Volume かカメラかのどちらか一方に置き、二重設定を避ける**という運用上の注意。

### 5. 背景の木は静的配置ではなく Foliage + Billboard で軽量に扱う [24:02–24:22]
遠景の山にペイントする木は通常の Static Mesh ではなく **Tree Billboard**（サムネイルにあるビルボード版アセット）を選んで Foliage Mode でペイントしている。近景の高精細アセットと遠景の軽量アセットを使い分ける発想が読み取れる（ただし「なぜ Billboard か」の理由説明自体は字幕に無く、選択している事実のみ）。

### 6. マーケットプレイスの無料アセットには質のばらつきがあると講師自身が言及 [29:45–29:50]
鳥アセットについて「マーケットプレイスの鳥はそこまで良くない。もっと良い品質が欲しいなら課金して別のものを買うこともできる」と明言。**無料アセットで妥協するライン**を講師自身が示している数少ない品質判断コメント。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Landscape | Size | 63 → 31 | [01:26–01:36] |
| Landscape | Albedo Brightness | 7 | [11:26–11:30] |
| Post Process | Exposure (Manual) Intensity | 9 | [18:51–18:59] |
| ディレクショナルライト | Intensity | 60 | [19:03–19:12] |
| Post Process | Saturation | 1.4 → 1.3 に微調整 | [20:14–19:58] |
| Post Process | Shadow Saturation | 1.2※ | [20:01–20:10] |
| Post Process | Mid-tones Saturation | 1.1 | [20:10–20:15] |
| Post Process | Motion Blur / Target FPS | 2 / 24 | [20:15–20:24] |
| Foliage（花） | Sub Scale | 20〜25 | [14:29–14:34] |
| Foliage（花） | Density | 5 | [14:39–14:45] |
| Foliage（岩・後半セット） | Scale | 7〜9 | [17:20–17:23] |
| シネカメラ | Film Back | DSLR | [25:52–25:55] |
| シネカメラ | Focal Length | 17〜19※ | [25:58–26:08] |
| シネカメラ | Aperture | 3.5〜4 | [26:20–26:28] |
| レベルシーケンサー | Frame Rate | 30 → 24 | [27:11–27:16] |
| Movie Render Queue | Temporal Sample Count | 64 | [31:38–31:41] |
| Movie Render Queue | Warm Up Frames | 120 | [31:48–31:51] |

※ = 字幕の数値が不明瞭・言い直しがあり確度が低い推定値

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [01:52–01:58] Sculpt ブラシの Strength / Brush Size / Falloff の**具体的な数値**（「増やす」「減らす」という操作の方向性のみで数値は画面操作のため音声に乗っていない）
- [07:00–09:12] Landscape マテリアルの Tiling Offset で**実際に下げた数値**（「decrease」としか言われておらず、コピー＆ペーストした具体的な値は不明）
- [12:22–13:17] フェンス・神社階段などプロップの**配置座標・回転・個数**（「アーティスティックな選択」と明言されており数値情報が元々存在しない）
- [16:33–17:46] 岩・追加植生の Scale/Density の一部設定（音声が「increase a little bit」等の曖昧な表現に留まる箇所が複数）
- Quixel Bridge・Megascans アセットの**具体的なアセット名**（画面のサムネイル選択に依存し、字幕では「this one」としか言及されない箇所が多数）
