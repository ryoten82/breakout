# 学習ノート 02 — UE5 Environment Tutorial for Beginners（Fantasy Castle 環境）

- 動画: https://www.youtube.com/watch?v=QPaJlGlirjA （42:58）
- 学習日: 2026-07-03 / 抽出: 自動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/QPaJlGlirjA.txt](../transcripts/QPaJlGlirjA.txt)（`[MM:SS]` で原文照合可能）
- 同シリーズ第1回（[ee-IOlWUZTo_ue5-environment-tutorial.md](ee-IOlWUZTo_ue5-environment-tutorial.md)）と工程は共通部分が多いため、共通項は簡潔に、本動画で新出のテクニックを厚く記載する。

## 全体ワークフロー（工程順）

1. **プロジェクト/レベル作成** [00:24–01:00] — Blank テンプレート（Starter Content 無し）→ 新規 Empty Level 作成、名前は "main"
2. **基盤ライティング** [01:00–02:49] — Directional Light / Skylight / Sky Atmosphere / Volumetric Cloud / Exponential Height Fog を個別に Place Actors から手動 drag & drop（見本回の Environment Light Mixer 一括生成とは異なる手順）→ 専用フォルダに整理 → Project Settings で Editor Startup Map / Game Default Map を "main" に変更 [02:29–02:49]
3. **Landscape とスケール基準** [02:51–03:31] — Landscape 作成時に Section Size を 63→127 に変更 → **キャラサイズ基準の Cylinder を最初に配置**（見本回と同一の教訓）
4. **地形彫刻とマテリアル** [03:34–07:40] — Sculpt/Raise/Smooth ツールで地形を作り込み → Quixel Bridge の Rock Cliff マテリアルを Landscape に適用 → Material Instance の Tiling offset を有効化し値を 0.1 に下げてタイリング対策 [06:51–07:01]
5. **城アセット導入** [07:40–10:27] — Epic Marketplace で無料 "Infinite Play Castle" を検索・追加 → BP_Castle と Exit Castle を配置、スケール調整 → Cliff の SM_Bridge を追加
6. **背景山アセット** [10:27–12:37] — Marketplace で "Background Mountains" を検索、バージョン非互換エラー時は対応バージョンを 5.0 Early Access に切り替えて追加 [10:58–11:07] → ランダム配置
7. **水面** [12:37–15:23] — Water Plugin を Edit > Plugins から有効化しエンジン再起動 → Water Body Lake を配置 → Landscape の "affects landscape" を無効化 → スプラインポイントで湖形状を編集 → Water Zone の Zone Extent を拡大してバグ修正 → Water Material 内の Absorption/Scattering で水色を調整
8. **植生ペイント** [15:23–19:05] — Marketplace の無料 "Landscape Pro 2.0" を追加 → Foliage Mode で SM Pine Trees を density 0.1、scale 2〜3 でペイント
9. **ライティング調整と遮光** [19:05–19:05] — 方向ライトを Ctrl+L ドラッグで角度調整 → 遮光用 Cube を山の位置に配置 → 遠距離で影が消える不具合を `r.Shadow.Distance.Scale 0` で修正 [18:07–18:37]
10. **キャラクターと前景アセット** [19:05–22:25] — Marketplace の無料 Paragon キャラ（Gideon/Grux 系スケルタルメッシュ）を追加・配置 → Quixel Bridge の岩・地面アセットで前景を作り込み → Foliage Mode で植物（草系）を追加ペイント
11. **Post Process 調整** [22:27–24:37] — Post Process Volume 追加、Infinite Extent (Unbound) 有効化 → Exposure Metering 有効化、Auto Exposure→Manual、Exposure Compensation 設定 → 方向ライトの Intensity/Color 調整 → Vignette・Sharpen 追加 → Saturation 1.2、Motion Blur 0.2・Target FPS 24 → Height Fog の Density 微調整
12. **スポットライトで局所照明** [24:37–26:26] — Spotlight 追加、Radius/Intensity（10,000→100,000）調整、Light Color を青系に、Foliage で木を追加植樹して光を遮る、Source Radius でシャドウの硬さを調整
13. **フォグマテリアル自作（本動画の核）** [26:26–33:12] — Translucent マテリアルを一から構築（詳細は下記教訓 2）
14. **Level Sequencer とシネマティックカメラ** [33:12–37:24] — Cine Camera Actor 追加・DSLR/Aperture/Focal Length 設定 → Transform キーフレームでカメラパン → キャラクターの Idle アニメーション追加 → Wind Directional Source でクロスシミュレーション
15. **ドラゴン・鳥の追加とアニメーション** [37:24–41:03] — Marketplace の無料 "Fantasy Creatures Pack"（ドラゴン）と "Animal Variety Pack"（鳥/Crow）を追加 → Sequencer で Transform キーフレーム + Fly アニメーションを付与し飛行させる
16. **レンダリング（Movie Render Queue）** [41:03–42:45] — プラグイン有効化・再起動 → PNG Sequence 出力、Temporal Sample Count 32、Override Anti-aliasing、Warm Up Count 120 を設定して local render

## クオリティを上げる教訓（新出を厚く）

### 1. フォグマテリアルのノード構成を最初から自作する [26:26–33:12]
見本回でも触れられていた自作フォグ平面だが、本動画はノード接続の**手順そのもの**が詳しく語られている:
- マテリアルの Blend Mode を Opaque → Translucent に変更 [26:54–27:01]
- **Radial Gradient Exponential** ノードを追加 [27:08–27:18]
- **Multiply** ノード（B = Depth Fade、A = Radial Gradient Exponential）→ 結果を **Opacity** に接続、Radial Gradient Exponential の出力は **Base Color** にも接続 [27:39–27:51]
- **Depth Fade** ノードを追加してハード交差線を防ぐ [27:31–27:39]
- Opacity と Fade Distance を **Parameter（Sキー+左クリックでパラメータ化）** にして Material Instance から調整可能にする — マテリアルエディタを毎回開かずに個体差を作れる理由がここで明言されている [27:54–28:22, 28:40–28:54]
- Material Instance 化 → Plane（Shape）に適用、スケール調整、Fade Distance を上げてエッジを消す [28:59–29:41]
- **バリエーション追加**: 複製したフォグマテリアルにエンジン内蔵 **Tiling Noise 05** テクスチャ（Engine Content 表示を有効化して検索）を追加の Multiply ノードで RGB→Opacity に掛け合わせ、単調さを崩す [30:03–31:04]
- **UV アニメーション**: **Panner** ノードを UVs に接続し、Speed パラメータ（0.1 で開始、速すぎたため 0.01 相当に減速）でフォグテクスチャを流動させる — 「動くフォグ」は Panner + Speed パラメータの組み合わせで作ると明言 [32:10–33:12]

この一連の手順は、見本回では結論（Radial Gradient Exponential / Depth Fade / Tiling Noise 使用）だけが書かれていたが、本動画では**ノードの繋ぎ方の順序と理由**（パラメータ化する理由＝MI から調整するため、Depth Fade を使う理由＝交差線対策）まで語られている点が新規性。

### 2. Level Sequencer によるシネマティック演出の一式 [33:12–41:03]
見本回にはなかった内容。カメラだけでなくキャラ・生物のアニメーションまで Sequencer 上で統合している:
- Cine Camera Actor を追加し、Digital Film Preset を DSLR に、Current Aperture を 4、Focal Length を 18 に設定、Frame Rate 24 [33:58–34:33]
- **Transform キーフレーム**をタイムライン開始・終了点で打ち、カメラをわずかに寄せることでシンプルなドリーインを作る。キーフレームの補間モードは **Cubic → Linear に変更**（等速に見せるため）[34:37–35:36]
- タイムライン長を 240 フレームに拡張、カメラカット長を対応させる [35:04–35:17]
- キャラクターを Sequencer にドラッグし Animation トラックで Idle アニメーションを割当てるだけで即座に再生される [35:40–36:12]
- **Wind Directional Source** を追加し、Speed 0.5・Strength 2 前後に設定してキャラの衣装（クロスシム）を靡かせる。**3 点メニュー→Simulate** で編集中にプレビュー可能、Speed を上げると（例: 9）揺れが強くなることを確認 [36:12–37:24] — クロスシミュレーションの検証手段として Simulate ボタンが明言されている点が新規
- ドラゴン・鳥も同様に Transform キーフレーム（開始・終了で位置を変える、補間は Linear）+ Animation トラック（fly アニメーション）を追加するだけで飛行演出になる、という**量産可能な定型パターン**が示されている [38:59–40:51]

### 3. Movie Render Queue の実務設定 [41:09–42:45]
見本回より簡潔だが具体値が明言されている:
- 出力を PNG Sequence に変更（デフォルトの JPEG Sequence を削除）[41:53–42:02]
- Anti-aliasing 設定を追加し、**Temporal Sample Count を 32 に**（64 にするとレンダ時間が倍になるため 32 を選択、という判断基準が明言）[42:04–42:19]
- Override Antialiasing を有効化 [42:22]
- Warm Up Count を **120** に設定（Advanced 設定内）[42:27–42:30]
- 出力ディレクトリ・解像度・フレームレートを最後に確認して Accept & Render Local [42:33–42:45]

### 4. 水面編集の実務手順 [12:37–15:23]
見本回では Water Body Lake の存在だけ触れられていたが、本動画は手順が明確:
- Water Plugin を有効化 → **必ずエンジン再起動**が必要 [12:43–12:58]
- Water Body Lake 配置前に **"affects landscape" を無効化**しないと地形に穴が開くバグが起きる、という順序の教訓 [13:09–13:19]
- スプラインポイントを右クリックで追加し湖の輪郭を編集 [13:23–13:55]
- 遠方で見た目が崩れるバグは **Water Zone の Zone Extent を拡大**すれば直る、という具体的な対処法 [13:59–14:19]
- Water Material 内の **Absorption / Scattering** パラメータで水色（青系）を調整 [14:37–15:16]

### 5. 影の距離減衰バグの直接対処 [18:01–18:37]
「一定距離でシャドウが消える」不具合に対し、コンソールコマンド **`r.Shadow.Distance.Scale 0`** を実行すると解決する、という具体的な console command と値がそのまま音声で確認できる（見本回では同種の設定がコピペ操作のため字幕に乗らず「取れなかったもの」扱いだった点との対比）。

### 6. 見本回と共通の教訓（簡潔に）
- スケール基準の Cylinder を最初に置く [03:22–03:31]
- タイリング対策として Material Instance の Tiling Offset を有効化・値を下げる [06:44–06:59]
- Post Process は Unbound + Manual Exposure + Vignette/Sharpen + Saturation 増し + 低めの Motion Blur という組み合わせ [22:42–24:11]
- 遮光目的で Cube 等の基本形状を配置し陰影をコントロールする [17:44–17:56, 26:08]
- Foliage は Density/Scale を必ず初期値から調整する（そのままだと密度過多）[16:47–17:03]

## 主要パラメータ表

| 対象 | パラメータ | 値 | 出典 |
|---|---|---|---|
| Landscape | Section Size | 63 → 127 | [03:05–03:09] |
| Landscape マテリアル | Tiling offset | 0.1 | [06:51–06:56] |
| Foliage（木） | Density / Scale | 0.1 / 2〜3 | [16:52–17:00] |
| コンソール | r.Shadow.Distance.Scale | 0 | [18:10–18:30] |
| Post Process | Saturation | 1.2 | [23:56–24:01] |
| Post Process | Motion Blur / Target FPS | 0.2※ / 24 | [24:01–24:11] |
| Spotlight | Intensity / Radius | 100,000 / 25,000 | [25:14–25:25] |
| フォグ Panner | Speed | 0.1 → 減速調整※ | [32:53–33:06] |
| Wind Directional Source | Speed / Strength | 0.5 / 2※ | [36:44–36:53] |
| Cine Camera | Aperture / Focal Length / FPS | 4 / 18 / 24 | [34:18–34:33] |
| Sequencer | Timeline 長 | 240 frames | [35:07–35:10] |
| Movie Render Queue | Temporal Sample Count | 32（64だと倍時間） | [42:12–42:19] |
| Movie Render Queue | Warm Up Count | 120 | [42:27–42:30] |

※ = 字幕崩れ・数値の聞き取りにくさのため推定（原文 "something like2" 等の崩れを文脈から復元）

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- [08:00–08:13] Epic Games Launcher でのアセット検索・追加 UI 操作の詳細（クリック位置等は文字情報だけでは再現不可）
- [27:00–28:22] フォグマテリアルのノードグラフの正確なピン接続順序（音声の説明と実際のドラッグ操作の対応関係は推測を含む。ノード名・接続方向は文脈から復元したが、ピン単位の細部は要目視確認）
- [42:33–42:45] Movie Render Queue の出力解像度・出力ディレクトリの具体的な値（「something like that」で明言されず画面操作のみ）
