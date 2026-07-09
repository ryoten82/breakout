# 学習ノート — UE5 Niagara: 円柱メッシュ召喚/リスポーン/テレポート・ポータル VFX

- ソース: https://www.youtube.com/watch?v=CBadY5I3YZI （12:30）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\CBadY5I3YZI.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [h-gp4l1oIbU_portal-vfx.md](h-gp4l1oIbU_portal-vfx.md) / [58RyWzN8O84_magic-portal-vfx.md](58RyWzN8O84_magic-portal-vfx.md)（いずれも正面から見る平面/ディスク型ポータル）、[NbbFytz-JDk_vertical-beam-vfx.md](NbbFytz-JDk_vertical-beam-vfx.md)（垂直に伸びる単一メッシュコアのビーム柱）。**違い**: 本ノートは開口円柱（キャップ除去）メッシュを「容れ物」として据え、その表面・内部・周囲に3種のパーティクルエミッタを重ねる構成で、平面ポータルともビーム柱型とも異なる第3の構成パターン

## 概要

キャラクターの召喚・リスポーン・テレポート演出用の垂直ポータルを作るチュートリアル。前作動画で作ったノイズテクスチャベースのマテリアルを流用し、今回はそのマテリアルを Dynamic Material Parameter 化して Niagara から制御できるようにした上で、円柱スタティックメッシュ＋3層のパーティクルエミッタで柱状エフェクトを組み立てる回。

## 技術詳細

### 1. スタティックメッシュ準備（Modeling Mode）

- Modeling Mode で円柱プリミティブを作成
- Model Poly Group Edit でキャップ（上下の蓋面）を選択して削除 → 中身の見える開口円柱に
- UV を手動調整（詳細な数式操作は字幕からは追いきれず、UV Editor 上での位置合わせ）

### 2. マテリアルの Dynamic Material Parameter 化

前作で作ったノイズマテリアルの固定パラメータ（U/V オフセット・Tiling 等）を、Niagara の Dynamic Material Parameter ノードに差し替える工程が本編の核。

- Dynamic Parameter の Param1/Param2 → U/V オフセット、Param3 → Tiling としてリネームして使用
- 新しいノイズテクスチャに差し替え（動画内では配布元記載のみ、テクスチャ自体は入手不可）
- **Dynamic Parameter Index を1つ追加**（Niagara 側で露出するパラメータ数を増やすため）し、追加した Param1 を「Power（ノイズ強度）」、Param2 を「UV オフセット」としてリネーム
  - この UV オフセット用パラメータには **Particle Random Value をそのまま接続**：どちらも 0〜1 のレンジで完全一致するため、追加の Random Range ノードなしにパーティクルごとのノイズ位相をばらけさせられる、という省力化テクニック
- **Particle Color でエッジの不透明度を制御**：Alpha チャンネルを Subtract → 最終的に乗算する形で構成し、**`1 - x`** することで「メッシュのエッジ部分が明るく、中心に向かって透明になる」表現を得る。この `1-x` の結果を（ノイズ/浸食ノードの）**Radius パラメータに接続**してエッジ遷移の滑らかさを調整（0.1 に設定）
- **カーブ作成時の実務Tips（字幕内で明言）**：Alpha チャンネルも同様に `1 - Alpha` をカーブに使うと、寿命に対して `0 → 1 → 0` という一般的なパターンの形になる。`1-x` をしないと `1 → 0 → 1` という直感に反する不自然な形になってしまう、という理由付き注意点
- 最終的に Particle Spawn モジュールで Dynamic Material Parameter に具体値を設定：UV/Tiling=5、Tiling=15、Power=1.5 等（エミッタごとに個別調整）

### 3. Niagara エミッタ構成（3層）

**Emitter 1（降り注ぐ火の粉・上空スポーン）**
- Render: Sprite Renderer を削除し Mesh Renderer に変更、円柱メッシュ＋上記マテリアルを使用
- Spawn Rate 30、Lifetime はランダム 1.5〜3秒
- Position: Z 軸に +1000 オフセットして「空中」からスポーン
- Add Velocity: Z 軸のみ、負の値でランダム（-6000 〜 -100）＝落下方向
- Initial Mesh Orientation: Rotation モード、Z 軸 0〜1 でランダム初期回転
- Particle Update に Update Mesh Orientation を追加、Z 軸のみ回転率 0.5 で継続回転
- Color: カーブ制御。開始色=青、終了色=赤（寿命に応じたグラデーション）、Scale Color を 30 に設定して発光強度を底上げ
- Mesh Size: 非一様スケールでランダム化（min/max 値は字幕が不明瞭※推定）

**Emitter 2（メッシュ表面に張り付く火花）**
- Emitter 1 を複製して作成、Spawn Rate 30
- **Add Velocity モジュールを削除**（表面に留まらせるため移動させない）
- Shape Location = Cylinder、Height=10、**Surface Only を有効化**（内部ではなく円柱表面ちょうどにのみスポーンさせるオプション）
- Particle Update 側の追加変更は不要

**Emitter 3（中心軸を上昇する光の筋）**
- Emitter 1 を複製し、**Add Velocity モジュールをそのまま流用**（同じ設定を再利用）
- Spawn Rate 75、Lifetime 2〜3秒
- Position は Emitter 1 と同じ Z+1000 オフセット
- Shape Location = Cylinder、Height=100、**Radius=0**（半径ゼロにすることで、円柱表面ではなく中心軸の直線上にのみスポーンさせる、という Emitter 2 とは逆の使い方）
- Particle Update に Drag モジュールを追加
- 仕上げ調整として **Emitter 1 にも遡って Drag モジュールを追加**（挙動を落ち着かせるため）
- 最終チューニング：Dynamic Material Parameter の Power を Random(0.5, 1) にして明るさにばらつきを持たせ、視認性を向上

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` には Dynamic Material Parameter 全般や Erosion 定型（ノイズ→Power→Opacity）の記載はあるが、以下は未収録で新規:

- **Particle Random Value を UV オフセット用 Dynamic Parameter に直結**する省力化パターン（両者が 0〜1 で完全一致するため追加ノード不要）。ドクトリンの「Dynamic Material Parameterで動的化」節に具体例として追記候補
- **メッシュの Alpha チャンネル（Particle Color 経由）から `1-x` でエッジマスクを作り Radius パラメータに接続**する手法。ドクトリンの Erosion 定型はノイズ由来のマスクが前提で、**メッシュ自体のアルファ情報を浸食マスクの起点にする**という別ソースの組み合わせは新規
- **カーブ形状の実務注意点**：`1-x` を通さないとカーブが `1→0→1` という不自然な形になる、という具体的な失敗パターンと回避策の言及
- **Cylinder Shape Location の Surface Only オプション**（メッシュ表面ちょうどにパーティクルを固定）と、**Radius=0 のシリンダー形状で中心軸の直線スポーンにする**という2つの対照的な使い方。ドクトリンの「Niagara 定型」節には Shape Location のバリエーションとして未収録
- **エミッタ間でのモジュール使い回し**（Emitter 1→3 へ Add Velocity をコピー、Emitter 3→1 へ Drag を遡って追加）という実務的なワークフロー。1つの Niagara System 内で複数エミッタの役割を分けつつ共通モジュールを使い回す設計判断の実例

## SCRAP BLITZ UEへの応用メモ

- **キャラクター出現/リスポーン演出**にほぼそのまま転用可能な設計：本動画自体が「attack character respawn or teleport」を想定した汎用ポータルとして作られている。ボス召喚演出・プレイヤーのリスポーン地点表示・隠しエリア出現などに直結
- 開口円柱メッシュ＋3層パーティクル（降り注ぐ粒子/表面の粒子/中心軸上昇の粒子）という構成は、**2.5D固定カメラのSCRAP BLITZ UEでも正面〜斜めから立体感のある柱として視認しやすい**。既存 doctrine の「1粒バースト+カーブ駆動の器」原則よりは重めだが、メッシュ1個+マテリアル1枚+パーティクル3層で完結する軽量寄りの構成
- **Dynamic Material Parameter 経由での UV オフセット/Power/Tiling の外部制御**は、OC ジェムや既存 Niagara 資産のノイズ/エロージョン系マテリアルにも横展開しやすい。特に Particle Random Value を UV オフセットに直結する省力パターンは、同種のノイズマテリアルを複数箇所で使い回す際の実装コスト削減に使える
- Cylinder Shape Location の Surface Only / Radius=0 という2パターンは、今後 AOE テレグラフや召喚エフェクトで「輪の縁だけ」「中心の柱だけ」を作り分けたい場面での実装オプションとして選択肢に加えられる

## ソースの限界

- 英語自動字幕のみで手動字幕なし（`yt-dlp --list-subs` で確認：本動画には Available automatic captions のみ存在し、通常字幕は "has no subtitles"）。音声認識のブレが大きく、数値パラメータ（Emitter 2 のメッシュスケール値、Emitter 1/3 のカーブキー時刻など）は本文中「※推定」または記載省略とした箇所が複数ある
- 前提となる「前作動画」（ノイズマテリアルの基本構築）は本ノートの対象外。マテリアルのベース構造（ノイズテクスチャの基本接続）を知るには前作の別途学習が必要
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。特にマテリアル側のノード接続順序（どのノードがどの Dynamic Parameter に対応するか）は字幕の言葉だけでは完全には特定できていない箇所がある
