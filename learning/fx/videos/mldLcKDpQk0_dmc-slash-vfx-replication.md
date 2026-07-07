# SOURCE: [UE5] Devil May Cry 'SLAY ALL!!' Slash VFX Replication + Tech Breakdown

- 動画: https://www.youtube.com/watch?v=mldLcKDpQk0 （作者: RickyLyu、102秒）
- 視聴日: 2026-07-05（初回360p解析→同日中に720p再解析で大半の判読精度を改善）

> ⚠**情報源の性質に関する注記（重要）**：この動画には音声ナレーション・字幕が一切ない（YouTube自動字幕生成すら不可）。そのため本ノートは、他のfx学習ノート（自動字幕→Sonnet抽出）とは**情報の取得経路が根本的に異なる**。
> 初回は640x360のフレーム画像（2fps、204枚）で目視読み取りを行ったが、System名・モジュール名・パラメータ数値の大半が判読不能だった。原因は`yt-dlp`が高解像度format（720p以上のdashストリーム）のダウンロードにJSランタイム（署名解決）を必要とし、環境になかったこと。**Deno（`winget install DenoLand.Deno`）を導入し`--js-runtimes deno`を指定することで解決**、1280x720のフレームで再抽出・再解析を行った。以下は720p版の結果を正としつつ、360pでも720pでも読めなかった箇所は引き続き「判読不能」と明記する。

## 見えたSystem/Emitter構成（720p再解析で確定）

| 秒数（目安） | System名 / キャプション | 備考 |
|---|---|---|
| 0-25s | （エディタ画面なし） | ゲームプレイのみ。白い装甲マネキンがチェッカーボード床で白キューブ3個を斬るループを2回再生 |
| 25.5-38s | （エディタ画面なし・PinP合成） | **DMC本編と思われる別収録映像**（独自HUD・モーションブラー・フィルムグレイン付き）と、UE側の白マネキンテストが**主画面/子画面(PinP)を入れ替えながら同時再生**。両者が同一エンジンセッションでない別動画である可能性が高い |
| 37-37.5s | **"Breakdown"**（大型タイトル） | セクション見出し。以降がNiagara内訳解説パート |
| 38-50.5s | **System名 "NS_Slash"** | Emitter Stack 4列: **slash1**（"Empty"から改名）・**Refract**・**Light**・**Phantom**。Sequencer/Timelineにも同名トラックが並ぶ |
| 37-50.5s | キャプション: **"Flare"**→**"Phantom"**→**"Fraction"**→**"Bit of light"** | 各Emitterの役割を順に紹介するキャプション列。"Fraction"はEmitter名"Refract"とは別の語（誤読ではなく綴りは"Fraction"で確定） |
| 51.5-55.5s | **System名 "NS_SphereSmoke"** | ~~前回"NS_SphereDecal"と推測~~→720pで訂正確定。青い渦巻き状の地面/大気エフェクト |
| 51.5-55.5s | キャプション: **"Three atmosphere Materials"** | 大気表現に3種マテリアルを使う旨 |
| 55.5-65s | **System名 "NS_DMCSlashRock"** | ~~前回"NS_DMCSlashWork"と推測~~→720pで訂正確定。Emitter名 **"Rocks"** |
| 55.5-65s | キャプション: **"Rotating Debrits"**（原文ママのタイポ、"Debris"ではない） | 白→赤に色変化する回転デブリの単体テスト |
| 58-60s | （赤い警告バナー、ビューポート左上） | **720pでも判読不能**。Niagara標準の警告文言と推測されるが確定不可 |
| 65-70.5s | **System名 "NS_DMCSphereSlashSingle"** | ~~前回"NS_DMCSlash...Single/Sample"（判読困難）~~→720pで完全確定。モジュールスタックは4列でなく**6列**（列名の大半は判読不能） |
| 65-70.5s | キャプション: **"Single Spherical Slash"** | 三日月弧のスラッシュを単体プレビュー再生 |
| 71-83.5s | Material/Levelエディタ（Niagaraでない） | タブ名 **"MPC_DMC"**・**"MI_FPDMC_body"**・**"M_PPDMC_Iris"**（末尾は"_Lens"の可能性もあり中確信度）。Outlinerに**"DMCSlash (Fixed)"**レベル、子要素に**BP_DMCEnemy/BP_DMCEnemy2/BP_DMCEnemy3**・Floor・PlayerStart（実在の敵Blueprintを含むテストレベルと確認） |
| 71-83.5s | キャプション: **"Post Processing Radial Blur + Chromatic Aberration"** | Niagaraでなくポストプロセスマテリアルの解説 |
| 85.5-96.5s | **System名 "NS_Lighting"** | ~~前回"FX_Lighting"と推測~~→720pで訂正確定（接頭辞は標準の"NS_"）。Emitter名は左が"Empty"のまま、右は判読不能 |
| 85.5-96.5s | キャプション: **"Electric on Skeleton Mesh"** / **"+ Huge amount of other BP Control"** | 電撃パーティクルがSkeleton Meshに沿って人型シルエットを形成（720pで頭・両腕・胴・両脚が判別可能なレベルで確認）。Blueprint側からの大量パラメータ制御を示唆 |
| 93.5-97.5s | コンテンツブラウザ | 稲妻テクスチャ複数の中から **"M_Electric"** を選択（青ハイライト） |
| 97.5-101.5s | **マテリアル "M_Electric"** | ~~前回"M_Electrical"と推測~~→720pで訂正確定（"-al"なし）。グラフ判読: **Radial Gradient Exponential**（UVs/CenterPosition/Radius/Density/Invert Density入力）→**Particle Color**ノード→**Multiply**複数連結→**Lerp**→出力ノードの**Emissive Color/Opacity/World Position Offset**。**Panner**ノードでテクスチャスクロールも使用（中確信度） |
| 100-101.5s | キャプション: **"Thanks for watching"** | エンディング |

## 720p再解析で訂正された主な誤読（360p版からの変更点）

| 360p版の推測 | 720p版の確定 | 判定 |
|---|---|---|
| "NS_DMCSlashWork" | **NS_DMCSlashRock**（"Rotating Debrits"の方） | 訂正 |
| "NS_SphereDecal(x)" | **NS_SphereSmoke** | 訂正 |
| "M_Electrical" | **M_Electric** | 訂正 |
| "FX_Lighting" | **NS_Lighting** | 訂正 |
| モジュールスタック4列（Single Slash） | 実際は**6列** | 訂正 |
| 右クリックコンテキストメニュー | 実際はNiagara標準の**Windowsドロップダウンメニュー** | 訂正 |
| "Flare"は不明瞭 | **"Flare"確定**（NS_Slashのキャプション） | 確度向上 |
| Emitter名は判読不能 | **slash1/Refract/Light/Phantom**（NS_Slash）、**Rocks**（NS_DMCSlashRock）確定 | 新規判明 |
| PinP関係は推測 | ゲームプレイ区間は**別収録映像とUEテストが主/子画面を入れ替える構成**と確認 | 確度向上 |

それでも720pで判読不能だったもの: 58-60sの赤い警告バナー文言、Single Spherical Slashのモジュールスタック内個別モジュール名、Material Instance/MPCのパラメータ数値の大半。

## 学習部屋の既存fx doctrine（`fx_technique_doctrine.md`）との比較・新規性

1. **Emitterの役割分割が名前から明確**: NS_Slashは`slash1`（本体アーク）・`Refract`（屈折/歪み）・`Light`（発光）・`Phantom`（残像）の4役割に分割。doctrineの「RendererVisibilityタグ/ブレンドモード分離」という層分け原則と方向性は一致するが、本動画は**Emitter自体を役割ごとに完全分割**しており、より粒度の細かい実例。
2. **画面全体演出の分離設計（確信度が向上）**: "Post Processing Radial Blur + Chromatic Aberration"はNiagaraでなくMPC(Material Parameter Collection)+マテリアルインスタンス（MPC_DMC / MI_FPDMC_body）で実装。しかも**実在の敵Blueprint（BP_DMCEnemy等）を含むテストレベルで動作確認**しており、SP技/BURST演出への応用がより具体的に見えてきた。
3. **稲妻マテリアルの定型が判明**: `M_Electric`は**Radial Gradient Exponential→Particle Color→Multiply連結→Lerp→Emissive/Opacity/World Position Offset**という比較的シンプルなノード構成。Panner併用でテクスチャスクロールも追加。SBの電撃系OC/SP演出のマテリアル雛形として直接参考にできるレベルの具体性。
4. **"Electric on Skeleton Mesh"の人型シルエット形成**（720pで明瞭に確認）: doctrineの「SkeletalMeshLocationをSpawn/Updateで使い分け」と合致するが、輪郭をなぞる見た目の作り込みレベルが高い実例として引き続き参考価値あり。
5. **"+ Huge amount of other BP Control"の位置付け**: Niagara単体の定型が厚いdoctrineに対し、**Blueprint側から大量のUser Parameterを外部制御する設計**の実例として引き続き言及価値がある（詳細な制御内容は本動画からは不明のまま）。

## 運用面の学び（学習部屋INDEX.mdへ反映済み）

字幕なし動画は「解像度で読める情報量が大きく変わる」ことを実証。360p→720pで多数の誤読（Work→Rock、Decal→Smoke、Electrical→Electric、FX→NS接頭辞、4列→6列）が訂正された。**低解像度フレームでの初回解析は「参考程度」と割り切り、重要な動画は最初から720p以上で抽出するのが望ましい**（yt-dlpの高解像度formatはJSランタイム=Deno導入が前提）。
