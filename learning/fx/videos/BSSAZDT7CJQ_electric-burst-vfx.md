# 学習ノート — UE5 Electric Burst VFX（8:40）

- ソース: https://www.youtube.com/watch?v=BSSAZDT7CJQ
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ**（`--list-subs` で手動字幕0件を確認、`yt-dlp --write-auto-subs --sub-langs en` で取得成功）→ 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\fx\transcripts\BSSAZDT7CJQ.en.vtt`（rolling caption形式、重複行を手動でデデュープしてから抽出）
- 関連ノート: 同チャンネル・同シリーズと推定される [fx/videos/4QF8sHC6HWo_lightning-crack-vfx.md](4QF8sHC6HWo_lightning-crack-vfx.md)（地面/壁の着弾クラック+グロー編）。動画冒頭で「今回のバースト効果は他のライトニングストライク/アークエフェクトと組み合わせ、将来の動画で完全な雷エフェクトへ統合する」と明言されており、シリーズの1パーツという位置づけ

## 概要

8分40秒の短編チュートリアル。**空間中の1点から放射状に瞬間的に拡散するライトニングバースト**（電撃が発生源から一気に広がるフラッシュ演出）を作る。素材はライトニングテクスチャ1〜3枚（Epic提供、投稿者Patreonで配布）、マテリアル1枚+ Niagara System 1つ（2エミッタ）という最小構成。

## マテリアルの基本設定

- Blend Mode = Additive、Shading Model = Unlit、Two Sided 有効

## ランダム形状の選び方（2手法、動画の主眼）

### 手法A: SubUV Flipbookの標準形
- SubUVテクスチャ + Flipbook Function + Particle Random Value ノードを使用
- Particle Random Value（0〜1のランダム値をパーティクルごとに生成）を Animation Phase 入力へ接続 → テクスチャUVを対応させる
- これにより4分割されたサブテクスチャがパーティクルごとにランダム表示され、形状にバリエーションが出る
- 最後に Particle Color を乗算

### 手法B: RGBAチャンネル+マスクテクスチャによる代替（本動画で新たに解説される方式）
- 2枚目のテクスチャ: **RGBA各チャンネルにそれぞれ別の電撃形状**を格納
- 3枚目のテクスチャ: 各チャンネル用の**マスク**（UV座標でどのチャンネルを表示するか制御）
- マスクテクスチャを ×4 → Floor → +0.5 → ×0.25 という一連の演算で処理。動画内で「ピクセル化テクスチャを作る手法に似ているが、今回はマスクテクスチャの1象限だけを表示する用途」と説明。+0.5は各サブ領域の中心にピボットをずらすための補正
- マスクのRGBAチャンネル×元テクスチャのRGBAチャンネルを乗算
- Particle Random Value を再度使い、ランダムに形状を切り替え
- **Particle Color（RGB）はテクスチャのRGBAチャンネルへ直接乗算できない**ため、Breakout Float（Break Float）ノードで4チャンネルに分解してから加算（Add）して合成
- 結果を Particle Color の Alpha に乗算
- Power ノードを追加して電撃形状の強度を制御。Additiveブレンドのため Opacity は別途扱う必要がないと明言

### 共通の仕上げ
- Depth Fade ノードで電撃と静的メッシュの境界をソフトにする
- ノイズテクスチャ × 「時間とともに拡大するマスク」を乗算してディストーションを追加。**このマスクが Particle Relative Time（スポーン時0→寿命終端付近で1に近づく）と Lerp + Diamond Gradient で駆動され、「発生源から外側へ暗→明のグラデーションで段階的に拡散する」バースト特有の見た目を作る核心部分**

## Niagara System 構成

- Sprite Renderer にマテリアルを適用
- Emitter State: Life Cycle = Self、Loop Behavior = Once、Duration = 0.3秒
- Spawn: Burst Count = 5 + Spawn Rate = 20（バーストと継続スポーンを同時併用し、短い0.3秒の中に密度を作る）
- Initialize Particle: Lifetime = Random 0.1〜0.15秒（かなり短命）、Color = User Parameter（青or紫を割り当て）、Sprite Size = 350〜600
- ノイズディストーション強度が強すぎたため ×0.1 で減衰調整（実測ベースのチューニング値として明記）
- Sprite Rotation = Random
- Particle Update: Scale Color + Scale Sprite Size（Curveで1→1.5へ緩やかに拡大）
- 制作中の実演で「R チャンネルのみ RGB 出力に接続していたため色が変わらないバグ」が発生し、RGB 全チャンネルへの接続に修正する場面あり（実装時のトラブルシュート事例として記録）
- **2層目のエミッタを複製して重ねる**: 粒子数を減らす（Spawn Rate=5）、寿命をさらに短く（0.05〜0.1秒）、サイズをやや大きく、色をより明るくする、という差分のみで「暗く長め」+「明るく短命」の2層構成が完成。1層目は"base burst"、2層目は"bright flash core"という役割分担

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の電撃系記述（Radial Gradient Exponential+Particle Color+Multiply+Lerp）と [4QF8sHC6HWo_lightning-crack-vfx.md](4QF8sHC6HWo_lightning-crack-vfx.md)（クラック+グロー、地形/壁面向け）は既収録。本動画は**空間中の瞬間バースト（発生源1点からの放射拡散）**という別レイヤーで、以下が新規:

- **RGBAチャンネル別形状テクスチャ + マスクテクスチャの「象限選択」技法**: マスクを ×4→Floor→+0.5→×0.25 で加工して1象限だけを抽出し、Particle Color RGBをBreakout Float+Addで手動合成するという、SubUV Flipbookとは異なるランダム形状選択の代替パターン。既存ドクトリンの「RGBを白1pxに差し替え色を分離」節とは逆方向（1テクスチャに複数形状をパック→選択的抽出）で新規
- **Particle Relative Time × Lerp × Diamond Gradient による「発生源からの段階的拡散」ディストーション**: 既存の稲妻クラック手法（Vector to Radial Value/Angleの2系統合成）とは別系統で、**バースト特有の「瞬間で外側へ広がる」時間駆動アニメーション**を1変数（Particle Relative Time）だけで実現する軽量パターン
- **Spawn Burst Count + Spawn Rate 併用+超短寿命（0.1秒未満）+ Loop Once/Duration 0.3秒の具体的パラメータセット**: 既存ドクトリンの「1粒バースト+カーブ駆動」項はLight/Decal/柱メッシュが対象で、Sprite多数粒による瞬間フラッシュ演出の実測数値例は未収録
- **同一エミッタ複製で「暗く長め」+「明るく短命」の2層構成**を作る量産パターン自体は lightning-crack ノートの「グローエミッタ複製」と方向性は一致するが、寿命0.05〜0.1秒という桁の短さと「コア/ベースの役割分担」という言語化は補完的な新情報

## SCRAP BLITZ UEへの応用メモ

- ボスの被弾/ダメージ瞬間の演出（ヒットストップと組み合わせた電撃バースト）に直接転用しやすい構成。ヒットストップで時間が止まる瞬間に**Particle Relative Time駆動の放射拡散**が「バチッ」という一瞬の閃光として機能しやすく、現状の DrawDebug 仮実装からの差し替え候補になりうる
- Spawn Burst Count=5 + Spawn Rate=20 の併用、寿命 0.1秒未満という超短命パラメータは、被弾フラッシュのような「一瞬で消える」演出に直結する具体的な起点値として使える（そのままの数値は proto/UE の見た目調整で要チューニングだが、桁感の参考になる）
- METEO の SP 技や敵の攻撃着弾に、本動画の「暗く長め」+「明るく短命」の2層エミッタ構成を適用すれば、被弾コア部分の輝度を強調しつつ周囲の余韻を残す2段階の見た目が作りやすい
- RGBAチャンネル+マスクによる形状選択パターンは、METEOの複数SP技で電撃系の形状違いを1テクスチャに集約したい場合に有効（テクスチャ枚数の節約になる一方、マテリアルグラフの複雑度は上がるトレードオフ）

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名（"breakout float"等）は文脈から標準ノード名（Break Float / Breakout Float）と判断したが、正式名称の完全一致は未検証
- Blend Mode/Shading Model 以外の細かいマテリアルグラフ配線順序（特にAdd/Multiplyの正確な接続順）は聞き取りベースの要約で、実際のノードグラフ画面は視聴していない
- 「マスクを ×4→Floor→+0.5→×0.25」の数値列は字幕から聞き取れた順序どおりに記録したが、実際のグラフでの正確なノード間配線（どの出力がどの入力に繋がるか）までは確認できていない
- 前提となる「以前作ったライトニングストライク効果」「今後組み合わせる予定の完全な雷エフェクト」は本動画・本ノート単体では扱われておらず、シリーズ全体像は不明
