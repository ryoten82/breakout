# 学習ノート — UE5 Flame Weapon Trail

- ソース: https://www.youtube.com/watch?v=F4hVpyKOBno （8:46）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ**（`--list-subs` で本動画に手動字幕なしを確認。rolling caption形式のvttをパースして使用。文単位の切れ目や固有名詞（Patreon等）以外は認識精度は概ね安定しているが、数値・語尾は「※推定」注記箇所に留意）
- 関連ノート: [mE5lmlGNaYA_niagara-trail-vfx.md](mE5lmlGNaYA_niagara-trail-vfx.md)（同チャンネル・Ribbon Renderer本流のトレイル基礎編。本動画は字幕内で「in previous video, we created a basic trail」と明言しており、その**直接の続編**。基礎トレイルの Niagara System をコピーしてマテリアルだけ差し替え、さらに炎らしい火の粉/燃え上がり演出のエミッタを追加する内容）

## 概要

前作の汎用トレイル（水法線テクスチャ由来のRibbonトレイル）をベースに、マテリアルを「炎」向けに差し替えて**武器の炎エンチャント風トレイル**を作る続編。前作Niagara Systemの複製→マテリアル差し替えという最小工数のバリアント量産に加え、Sprite Rendererベースの「flame flipbook（燃え盛り）」エミッタと「flying particle（火の粉）」エミッタを追加し、Ribbon+Sprite+Sprite の3エミッタ構成に発展させている。

## 技術詳細

### 1. 炎マテリアル — 前作トレイルマテリアルの流用+差し替え

- Blend Mode / Shading Model / Two Sided の基本設定は前作と同一（字幕は「similar to the previous material」とだけ述べ詳細説明を省略）
- 使用テクスチャ: **ノイズ2枚 + 火のフリップブックテクスチャ1枚**（fire / wispy と呼称。作者Patreonで配布と言及）
- 基本形状: fire texture と wispy texture を **Add** した後 **Multiply**、そこに強度調整用の定数（Constant）を掛け、最後に炎色の Color を掛けて炎らしい色形状を作る
- **歪み（Distort）は前作と同一の技法を再利用**: ノイズテクスチャ1枚に別テクスチャを加算して distort 用のUVオフセットを作り、「炎の周囲に立ち上る陽炎・蒸気のような反射風効果（reflection-like effect）」を演出。字幕は「炎が生成される時は必ず周囲に蒸気が発生する」という理由付けをしている
- 合成順序: (fire + distort) を Multiply → **shape mask**（前作と同一のマスク）を掛ける → 最後に **Particle Color と Alpha channel** を掛けて最終形状にする

→ この時点でのマテリアル構築自体に新規ノードパターンは無く、**前作の距離感を保ったまま色/テクスチャだけ炎向けに差し替えた**という位置づけ。

### 2. トレイル（Ribbon）エミッタ — Niagara System複製+マテリアル差し替えのみ

- 前作で作った Niagara System を複製し `fire` にリネーム、マテリアルを上記の炎マテリアルに差し替え
- Particle Color を炎らしい色に変更、寿命末尾に向けて **暗く（darker）** + **Opacity を 0 まで**フェードさせる調整のみ追加
- ここまでで基礎シェイプ自体は前作Ribbon Trailを継承した「炎の帯」が完成

### 3. Spark（flame flipbook）エミッタ — Ribbon→Sprite Rendererへの差し替え併用パターン

前作のRibbonトレイル用エミッタを**複製**し、「トレイル用パラメータを流用したいから」という理由で以下を改造:

- **Ribbon Renderer を削除し Sprite Renderer に差し替え**（本ノートで初出。前作はRibbon Rendererのみで完結していた）
- マテリアルはフリップブック用（8×8 SubUV）
- Particle Update に **SubUV Animation** モジュールを追加、Animation Mode = **Curve** を選択してアニメーション再生レートをカーブで制御（※字幕は「animation's rate」とのみ言及、具体的なカーブ形状は不明・推定含む）
- Initialize Particle: Size = **Random Uniform 60〜100**、Rotation Mode = **Random**
- Particle Update に **Scale Alpha**（テンプレートカーブ）と **Scale Sprite Size**（テンプレートカーブ）を追加し明滅・サイズ変化を作る
- Spawn は「Spawn Per Frame」を削除し **Spawn Rate = 50** に変更（Per Frameだと発生が速すぎたため）
- Lifetime = **Random 0.3〜0.5**（短命の火の粉）
- 実機配置時、武器のピボット中心にスポーンされない問題が発覚 → 発生位置に **Random Range Float(0〜1)** をオフセットとして加算し、武器全体にランダム分布させる実務的な対処
- 炎（トレイル）とスパークで色味が食い違う問題も発覚 → 炎側の Particle Color を暗めの値（字幕上「one and 0.1」＝おそらく `(1, 1, 0.1)` 相当の黄橙寄り値、※推定）に再調整して統一

### 4. Flying Particle（火の粉/エンバー）エミッタ — 3つ目のエミッタ

Spark エミッタをさらに複製し、以下を改造:

- SubUV は **1×1**（フリップブックなし）に変更、マテリアルもデフォルトのスプレー/スパーク用マテリアルに差し替え
- SubUV Animation モジュールを削除
- Size = **1〜3**、Lifetime = **1.0〜1.5**（トレイル/スパークより長命）
- 前作由来で不要になった Ribbon 関連属性モジュールを削除（Sprite化に伴う整理）
- **Add Velocity**: Vector = **True Facing**、Float = **Random Float(5〜10)** を Multiply Vector by Float で合成し、武器の向きに沿ってランダムな飛散速度を与える
- Particle Update に **Aerodynamic Drag** を追加して減速させる
- **Initial Mesh Orientation** を追加（Sprite化しているためメッシュ回転系モジュールは通常不要のはずだが、字幕上テンプレート由来のモジュールとして残されている可能性あり、※推定）
- Scale Sprite Size のカーブを **0→1→0**（開始時は大きく表示→終盤で0まで縮小して消える）に調整。単純なフェードでなく**サイズ側で終端を作る**設計
- 最終的に Spawn Rate を **約100**（初期50から引き上げ）に調整して3エミッタの見た目バランスを取る

## 新規性のある技術情報（既存ドクトリンとの比較）

- **既存トレイルノートの直接的な発展形**: [mE5lmlGNaYA_niagara-trail-vfx.md](mE5lmlGNaYA_niagara-trail-vfx.md) が単一Ribbonエミッタでのトレイル「本体」構築を扱ったのに対し、本動画は**Ribbon（帯）+ Sprite（燃え盛りフリップブック）+ Sprite（火の粉/エンバー）の3エミッタ合成**で「炎トレイル」という完成形を作る手順を補完する。ドクトリンの「System 階層=監督」「バリアント量産は数行差し替えだけ」という記述の**具体的な実演例**（Niagara System複製→マテリアル・色のみ差し替えでバリアント化）
- **同一エミッタ内でRibbon RendererからSprite Rendererへ差し替える再利用パターン**: 「パラメータ（トレイル用の初期設定値）だけ流用したいのでエミッタを複製し、Renderer種別を丸ごと差し替える」という工数削減手法はドクトリン未収録。Rendererを差し替えても Spawn/Lifetime/Update系モジュールの下地は流用できるという実務知見
- **SubUV Animation の Animation Mode = Curve でフリップブック再生レートを外部制御**する構成は、ドクトリンの「Dynamic Material Parameterも同じ（一度だけ=Spawn、継続=Update）」原則とは別軸で、**モジュール自体のモード切替でアニメーション速度を作る**という選択肢の一例
- **アタッチ先の中心からズレる問題への実務対処**（Random Range Float でスポーン位置をランダムオフセット）は、武器メッシュ等の非対称ピボットにNiagaraをアタッチする際の汎用Tipsとして新規
- **Scale Sprite Size を 0→1→0 にしてフェードでなくサイズ側で終端演出を作る**設計は、既存ドクトリンの「グロー勾配」節（Divide小値でのグロー化）とは異なる、消滅表現の別アプローチ

## SCRAP BLITZ UEへの応用メモ

- **METEOの武器エンチャント（炎属性化）演出**: 本動画の3エミッタ構成（Ribbon帯+燃え盛りSprite+火の粉Sprite）はそのまま「武器に炎エンチャントが乗っている間、攻撃軌跡に沿って炎が伸びる」演出の骨格として転用しやすい。既存の武器軌跡Niagara System（[mE5lmlGNaYA](mE5lmlGNaYA_niagara-trail-vfx.md)由来のRibbonトレイルがすでにMETEOの斬撃軌跡候補として挙がっている）に対し、エンチャント時だけ**マテリアルパラメータ/Niagara Systemを炎版に差し替える**設計は、ドクトリンの「System階層=監督」パターンに沿った低コストな実装（同じ骨格のSystemをエンチャント種別ごとに複製・マテリアル差し替えのみで量産）
- **SubUV Animation の Curve駆動**は、既存の炎系フリップブック演出（[OnxiEY3Khow_stylized-fire-vfx.md](OnxiEY3Khow_stylized-fire-vfx.md)等）と組み合わせて、攻撃の速さ/エンチャント強度に応じてフリップブック再生速度を変える拡張が考えられる
- **武器アタッチ時のスポーン位置ランダムオフセット**は、METEOの武器メッシュに直接Niagaraをアタッチする際、ピボットが柄尻や中心からズレているケースで実際に踏む可能性が高い問題。実装時の先回りチェックポイントとして有用
- 火/水/氷/闇など複数属性エンチャントを持たせる場合、**マテリアル・色・Particle Color差し替えだけでSystem本体は共有する**という本動画の設計方針は、量産コストを抑える上で直接参考になる

## ソースの限界

- **本動画には手動字幕が存在せず、自動生成字幕のみ**（`yt-dlp --list-subs` で確認）。「なぜその数値/設計にしたか」の説明は前作以上に薄く、多くの手順が「Okay, we do X」的な簡潔な実況にとどまる
- ノードグラフの画面自体は視聴しておらず字幕ベースの要約のみ。特に「shape mask の具体的なチャンネル構成」「Distort合成の正確な演算（Add/Lerp等）」「炎色の正確な数値（字幕上『one and 0.1』の解釈）」は自動字幕からは断定できず、実装時はUE実機での再現検証が必要
- 「Initial Mesh Orientation」がSprite Rendererの構成でなぜ必要とされたか、字幕からは意図が読み取れず本ノートでも未解決（※推定と明記）
- 動画内で言及される「前作」は本ノートが既に収録済みの [mE5lmlGNaYA_niagara-trail-vfx.md](mE5lmlGNaYA_niagara-trail-vfx.md) と同一シリーズと推定されるが、動画内直接リンクでの確認はできていない（チャンネル・内容の一致から推定）
