# 学習ノート — UE5 Niagara Lightning Mesh VFX（5:56）

- ソース: https://www.youtube.com/watch?v=NSM_hHHfprI
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\NSM_hHHfprI.en.vtt`（セッション一時領域。恒久保存は本ノートのみ）
- 関連ノート: [GMeRJudxcbw_lightning-vfx.md](GMeRJudxcbw_lightning-vfx.md) — **技術的にほぼ同一手法**（static mesh + Spline Thicken（Material Function）を World Position Offset に使い、Niagara の Mesh Renderer で雷ボルトを造形）。本ノートは重複部分を省略し、この動画固有の差分のみ記録する

## 概要

5分56秒。動画冒頭で「前回はマテリアルだけで雷エフェクトを作ったが、今回は static mesh を使う。マテリアルより static mesh の方がスタイルや捩れの調整がしやすい」と明言（この「前回動画」は本部屋未収録）。既存ノート [GMeRJudxcbw_lightning-vfx.md](GMeRJudxcbw_lightning-vfx.md) と同一カテゴリの手法だが、値・軸の割り当て・トラブルシューティングの見せ方に固有の差分がある。

## 技術詳細（既存ノートとの差分のみ）

### アセット・UV
- static mesh はリング状（"generate band" と発音、既存ノートの半リングと同系統の形状と推定。※推定：正式なノード/アセット名は不明瞭）
- 標準的なパーティクル用 UV。デフォルトは U 方向にバンドが入るため、**Swizzle（UV入れ替え）で V 方向に付け替える**必要があると明言（既存ノートでは Swizzle 使用の有無が明記されていなかった点で具体性が高い）

### Opacity（縦スイープ）
- ロジックは既存ノートとほぼ同一（TexCoord + Dynamic Material Parameter で UV オフセット、wipe を 1→-1 でスイープ、Alpha にマスク乗算）が、値は「wipe を 1 から -1」と明言（既存ノートは「2〜-1」）。※値の食い違いは動画ごとの実測差の可能性、両方とも「1本のパラメータで出現方向を制御する」設計は共通

### World Position Offset（トラブルシューティングが本動画の核心的な差分）
- Normal Map テクスチャで WPO 方向を制御 → ランダムオフセット・Panner → Edge Mask 乗算 → Transform Vector（Local→World）→ Spline Thicken へ加算、という配線自体は既存ノートと同一系統
- **本動画固有**: Transform Vector を意図的に外し「Local 空間のままだとどうなるか」を実演。Niagara System 自体を回転させると、法線テクスチャ由来の WPO 方向がメッシュに追従せず歪む、という不具合を明示的にデモしている。既存ノートには Transform Vector の配線手順はあったが「なぜ必須か」の実演デモは無かった
- 加えて Niagara の Mesh Renderer 側で **Local Space 設定**も必要と言及（マテリアル側の Transform Vector と、Niagara 側の Local Space 設定の両方が揃って初めて回転に正しく追従する、という2点セットの指摘）

### Niagara System（パラメータの割り当てが既存ノートと異なる）
- Lifecycle=Self、Spawn Rate=10（既存ノートは Burst+Rate 併用だったのに対し本動画は Spawn Rate のみ使用）
- Particle Lifetime 0.2〜0.3秒（既存ノートと同値）
- Color: Random Hue Shift 0〜1、または User Parameter（例: 青）をベースカラーに使う二択を提示
- Initial Mesh Orientation: Z軸を0〜1でランダム回転（既存ノートは「Z軸周りのランダム回転」とのみ記載、範囲の明記は本動画の方が具体的）
- **Scale Mesh（非対称スケールの考え方が既存ノートと異なる）**: Non-uniform ランダム。X=0.01（極薄）、Y=1.5、Z=0.5、X の最大値=0.02。X 軸の最小/最大差が「メッシュの曲がりの強さ」を制御すると説明。既存ノートは「X軸を縮小してボルト状に」という簡潔な記述のみで、Y/Z の値や「X の変動幅=曲がり強度」という関係性までは踏み込んでいなかった
- Dynamic Material Parameter: WPO=200、Spline Thicken=100、ランダムオフセット0〜1、wipe 1→-1（既存ノートの twist intensity 100〜200 と近い値域だが、本動画は WPO と Spline Thicken を別々のパラメータとして分けて設定）
- 終盤で「spline beam を追加し WPO を少し弱め、X軸も少し小さくして Niagara を回転させ、プレビューと同じ見た目に合わせる」という言及あり（※推定：字幕上の固有名詞のため正式なノード名か2つ目のエミッタ追加を指しているか不明瞭。既存ノートのカラフル版/リフロー版のような「複製してパラメータ変更」の量産パターンと同系統の可能性が高いが、詳細な操作手順は本動画からは復元できなかった）

### 素材差し替えによるバリエーション
- 手続き的な "generate band" 形状を、より写実的な雷テクスチャに差し替えるだけで見た目が向上する、という指摘。既存ノートのカラフル版/リフロー版（パラメータ変更のみで量産）とは異なり、こちらは**テクスチャそのものの差し替え**によるクオリティ向上の話

## 新規性のある技術情報（既存ドクトリンとの比較）

既存ノート [GMeRJudxcbw_lightning-vfx.md](GMeRJudxcbw_lightning-vfx.md) がすでに「Mesh+WPOで雷ボルトを造形する」技法をドクトリン非収録の新規パターンとして記録済みのため、本動画は**手法カテゴリとしては新規性なし**。本ノートが追加する価値は以下の実装 Tips のみ:

- **Transform Vector（Local→World）の必要性を「外すとどう壊れるか」まで実演した点**。既存ノートは配線手順のみで、なぜ必要かの実証がなかった。Niagara 側の Local Space 設定と組み合わせて初めて回転追従が成立するという2点セットの知見は、Mesh+WPO 系の雷を実装する際の典型的な失敗ポイントとして両ノート合わせて把握できる
- **Scale Mesh の非対称値（X最小0.01〜最大0.02、Y=1.5、Z=0.5）と「X軸の変動幅=曲がりの強さ」という関係性**の具体化。既存ノートより一段細かいパラメータ設計

## SCRAP BLITZ UEへの応用メモ

既存ノートの応用メモ（METEO SP技や電撃属性ボスの落雷演出への転用）がそのまま当てはまる。追加で:

- Mesh+WPO 雷を実装する際は、Niagara System・Actor 自体を回転させて使う設計（例: プレイヤー正面方向に雷を落とす、敵の向きに合わせて回転させる等）を検討するなら、**Transform Vector（マテリアル側）+ Local Space（Niagara側）の両方**を最初から組み込んでおく必要がある。回転を伴わない固定演出（例: 常に真上から落ちる単発演出）であればこの罠は踏まない

## ソースの限界

- 英語自動字幕のみで手動字幕なし。"generate band"（正式名不明、推定 Gradient/Band 系のノードまたは procedural テクスチャ）、"spline beam"（終盤の言及、正式名不明・2つ目のエミッタ追加を指す可能性）は字幕からの推定で、正式なノード名・操作内容を裏付けられていない
- 各種数値（Scale Mesh の 0.01/0.02/1.5/0.5、Dynamic Material Parameter の 200/100 等）は音声からの聞き取りであり、UI 上の実際の値と誤差がある可能性がある
- 「前回動画（マテリアルのみの雷エフェクト）」は本部屋未収録のため、本動画が前提とする基礎マテリアル（Spline Thicken を使わない版）の詳細は把握できていない
- 実際のノードグラフ画面は視聴しておらず transcript ベースの要約のため、入出力ピンの正確な名称・接続順序は推定を含む
