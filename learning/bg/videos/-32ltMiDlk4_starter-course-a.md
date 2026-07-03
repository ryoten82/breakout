# 学習ノート 02 — Unreal Engine 5 Beginner Tutorial - UE5 Starter Course 2024

- 動画: https://www.youtube.com/watch?v=-32ltMiDlk4 （47:58）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/-32ltMiDlk4.txt](../transcripts/-32ltMiDlk4.txt)（`[MM:SS]` で原文照合可能）

## 全体ワークフロー（工程順）

Starter Course だが実際にやっている内容は「湖畔の岩山環境」制作の一通りの流れ。基礎操作（プロジェクト作成・ドラッグ＆ドロップ配置など）は圧縮し、環境クオリティに関わる工程を厚めに記載。

1. **プロジェクト作成〜基盤** [00:49–02:02] — Third Person テンプレート（Starter Content 無し）→ 新規 Level（Basic）→ 既定の Plane を削除・保存 → Landscape をデフォルト設定でそのまま作成
2. **参照アセットで地形の下敷き** [02:05–03:48] — Quixel Bridge から "Huge Nordic Castle Cliff" をインポートし配置・回転・複製して**地形のスカルプト参照**として使う（このメッシュ自体は最終アセットではなく形状ガイド）
3. **Sculpt** [03:08–04:05] — Sculpt モードで Brush Size を小さく・Tool Strength を下げ・Falloff を上げてから、参照メッシュの形に沿って地形を掘る（Shift 押しながらで下げ彫り）
4. **Water Plugin 導入** [04:11–04:31] — Water 関連プラグインを Plugins から 2 つ有効化 → エンジン再起動 → 保存
5. **Water Body Lake 配置** [04:36–07:29] — Water Body Lake をドラッグ配置 → 詳細パネルで **Affects Landscape をオフ**（湖が地形をこれ以上変形しないように） → スケール調整 → **Spline Point で湖岸の形を追加編集** → Water Material を開き Absorption で水色を調整、Scattering 有効化で見た目変化、Wave の Depth を上げて波を強調
6. **アセット一括インポート** [07:38–11:44] — Quixel Bridge から建物・岩・地物一式をインポート（作業自体は早送りされ「単調な作業」と講師コメント）→ 配置は完全に「好みのアーティスティックな判断」と明言 [09:14–09:30]
7. **Landscape マテリアル適用** [11:44–14:10] — Quixel の "Rocky ground" Material Instance をインポートし Landscape に割り当て → **タイリングの繰り返しが目立つ問題**が発生 → Material Instance の Tiling パラメータを調整（詳細は下記教訓参照）
8. **Foliage 配置（岩上の下草・低木）** [14:10–21:38] — Foliage Mode で複数種の 3D Plant static mesh を選択し Density/Scale/Pen（Paint）密度を試行錯誤しながら岩の上にペイント
9. **Foliage 配置（草・追加植物）** [24:41–28:16] — 別レイヤーで grass・plants を追加ペイント、underwater にも一部配置（見える角度なら追加、見えないなら**パフォーマンスのためスキップ**）[28:19–28:48]
10. **Foliage の風アニメーション** [21:38–23:00, 33:32–34:19] — 各 Foliage Type の Material（Wind 対応マテリアル）で **Grass Wind を有効化**し Wind Intensity を調整（0.1 前後に決定）
11. **Post Process / ライティング** [28:58–33:30] — Post Process Volume（Infinite Extent・Unbound）を追加、Exposure を Manual・値 7 に設定、Directional Light の Intensity を試行錯誤（15→20→30 前後）、Bloom 有効化、Sharpen 追加、Color Grading の Saturation を 1.3 に設定
12. **Height Fog** [32:57–33:00, 38:08–38:27] — Exponential Height Fog を追加、色味を調整
13. **背景山・木の追加アセット** [34:41–38:04] — Epic Marketplace の無料 "Background" パックをプロジェクトに追加し、遠景の山メッシュ・木（Tree card mesh）を配置。木は Foliage 経由でも追加密度調整（Scale 4→7、Density 20）
14. **VFX（蝶・魚・鳥）** [38:27–40:38] — Marketplace の無料 VFX Starter Pack（蝶パーティクル）・魚パック（水中）・Animal Variety Pack（カラス等の鳥）を追加
15. **Level Sequence とカメラアニメーション** [40:38–44:57] — Level Sequence 作成 → Cine Camera Actor 追加 → シーケンサーにスナップ → Frame Rate を 30→24 に変更、Filmback を 16:9 DSLR に設定 → カメラの Transform にキーフレームを打ち始点・終点を設定 → 両キーフレームを **Linear 補間**に変更 → 鳥（Crow）にも Transform キーフレームで飛行アニメーションを付与、Linear 補間に変更、複製で数を増やす
16. **ライティングの最終調整** [43:57–44:15] — Directional Light を Ctrl+L で回転させ方向を微調整
17. **Movie Render Queue でレンダリング** [44:27–47:53] — プラグイン有効化・再起動 → Output Directory 指定 → 出力形式を PNG Sequence に変更（JPEG を削除）→ Temporal Sample Count を 64（64 か 32 のどちらかで検討）に設定 → Console Variables に画質系の値を追加（Motion Blur Quality・Depth of Field Quality 等、詳細は概要欄参照と講師言及）→ 24fps 指定 → Anti-Aliasing の Warm Up Frame を 120 に設定 → Render (Local) 実行

## クオリティを上げる教訓（講師が語る理由・判断基準）

### 1. 参照メッシュを地形スカルプトのガイドに使う [02:05–03:48]
Quixel の既製 Cliff メッシュを配置・回転・複製して「見た目のリファレンス」として置き、それに沿って Landscape を Sculpt する。最終シーンにこのメッシュ自体を残すかは明言されていないが、**地形の狙った形をまず視覚的に固定してから彫る**という順序が明確。

### 2. Water Body の Affects Landscape をオフにする理由 [05:16–05:22]
Water Body Lake を配置すると自動で地形を変形させてしまうため、既に自分でスカルプトした地形を壊されないよう **Affects Landscape を無効化**。「これでランドスケープにこれ以上影響しない」と明言。

### 3. Foliage の Scale（密度に対する影響）[16:24–16:48]
「Foliage のサイズが小さいと、同じ範囲をペイントしたときに生成される個体数（Foliage number）が多くなり、パフォーマンスが大きく落ちる。だから Foliage のサイズは適切に保つことが重要」と明言。**サイズを上げてから密度を下げる**、という組み合わせで負荷を制御する判断基準。

### 4. 見えない場所には Foliage / Rocks を置かない [28:19–28:48]
水中や上空から見えない角度なら、「water shot」のような特殊なカット（水中撮影ショット）を作る予定が無い限り、**Foliage や Rocks を underwater に配置しない**。理由は明確にパフォーマンス（decrease your performance）。見た目に寄与しない負荷は削る、という判断基準。

### 5. 配置は「完全にアーティスティックな選択」と明言 [09:14–09:30]
アセットをどこに置くかは「私と同じである必要はない、好きな場所に置いていい」と講師が明言。地形・水・ライティングの手順（再現可能な操作）と、配置センス（属人的な判断）を切り分けている。

### 6. Exposure は Manual + 試行錯誤で値を決める [29:38–30:05]
Post Process Volume の Exposure を Manual に切り替え、値を 7 に設定。Auto に任せず数値で固定する判断（前作環境ノートと同じ思想: Auto Exposure に任せない）。

### 7. Directional Light Intensity は試行錯誤で収束 [30:14–30:48]
15 → 20 → 30 と数値を変えながら見た目を確認し、最終的に 30 前後に決定。「let's just experiment with it」と発言 — 一発で決め打ちせず反復調整するプロセス自体が教訓。

### 8. Saturation は 1.2〜1.6 の幅を試し 1.3 に決定 [31:44–32:10]
「1.2 で良い見た目になった。1.4 や 1.6 にするともっと saturated になるが、今回は 1.3 くらいがちょうどいい」と、上限を把握した上で控えめな値を選ぶ判断。

### 9. Foliage の Wind Intensity も数値を絞り込む過程を明示 [22:12–22:52]
1 → 0.2 → 0.1 と下げていき、「0.1 が良い、好きな値にしていい」で着地。風の強さは「動いていることが分かる最小限」を狙っている読み取り。

### 10. タイリングが目立つ問題への対処 [12:43–14:07]
Landscape Material の Tiling が「本当に repeating（繰り返し）が目立つ」と気づき、Material Instance の詳細から Tiling パラメータを開いて調整。値を 5 → 0.2 と変えながら確認し、「見えるのは水際とこの範囲だけだから、残りのエリアは気にしなくていい」と**画面に映る範囲だけ質を上げれば十分**という判断基準を明言 [13:39–13:54]。

### 11. キーフレームは Linear 補間に変更する [42:24–42:33][43:42–43:46]
カメラの Transform キーフレーム、鳥（Crow）の Transform キーフレームともに、打った後に両方選択して右クリックで **Linear 補間**に変更。デフォルトのスムーズ補間ではなく直線的な動きにする選択（理由の明言はないが両方で同じ操作を徹底）。

### 12. レンダリング設定は概要欄に外部化 [46:56–47:04]
Console Variables の追加設定について「まだ他にもいくつかあるが、説明欄で提供するのでそこからコピペしてください」と発言。**動画内で音声化されなかった数値がある**ことが transcript からも確認できる（下記「取れなかったもの」参照）。

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Landscape Material | Tiling | 5 → 0.2※ | [13:12][14:00] |
| Post Process | Exposure (Manual) | 7 | [30:02] |
| Directional Light | Intensity | 15→20→30※ | [30:22–30:43] |
| Post Process | Saturation | 1.3（1.2〜1.6 で試行） | [31:48–32:05] |
| Foliage（岩上下草） | Scale | 6→7 | [16:30–16:34] |
| Foliage（岩上下草） | Wind Intensity | 0.1 | [22:20–22:52] |
| Foliage（草） | Scale | 1.5〜2.5 → 1.5 | [25:08–25:24] |
| Foliage（木・背景） | Scale / Density | 4→7 / 20 | [37:31–37:43] |
| Cine Camera | Frame Rate / Filmback | 24fps / 16:9 DSLR | [41:39–41:50] |
| Motion Blur | Target FPS | 24 | [32:46] |
| Movie Render Queue | 出力形式 | PNG Sequence | [45:50–45:59] |
| Movie Render Queue | Temporal Sample Count | 64（32 も候補） | [46:08–46:18] |
| Movie Render Queue | Warm Up Frame | 120 | [47:22–47:27] |
| Movie Render Queue | フレームレート | 24 | [47:10–47:14] |

※ = 字幕崩れのため一部推定を含む（Directional Light Intensity は "15 be 20... 3... size and also 30 maybe" という崩れた字幕から試行錯誤の値遷移を再構成）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [46:28–46:56] Console Variables に追加した具体的なコマンド・数値（"like some aeration... blood as quality something like two... r dot something like that depth of field quality" — 字幕が大きく崩れており、Motion Blur Quality・Depth of Field Quality らしき項目名しか復元できない。講師自身も「概要欄を見て」と発言しており動画内で完全には言語化されていない）
- [12:00–14:07] Tiling パラメータの正確な UI 項目名・入力欄構成（"tiling offset" 等、画面操作のスクリーン内容が字幕に乗っていない）
- 各 Foliage レイヤーの Density の最終数値（試行錯誤の過程で "30... no... 20 is great" のように何度も変わり、どの数値が最終的にどの Foliage Type に適用されたか、字幕だけでは対応関係が曖昧な箇所が複数ある

