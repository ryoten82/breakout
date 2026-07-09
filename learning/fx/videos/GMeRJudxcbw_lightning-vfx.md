# 学習ノート — UE5 Lightning VFX（8:05）

- ソース: https://www.youtube.com/watch?v=GMeRJudxcbw
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\GMeRJudxcbw.txt`（セッション一時領域。恒久保存は本ノートのみ）
- 関連ノート: 動画冒頭で「前回動画で作った雷バースト（radial 系）に続く後編」と明言。既存ノート [4QF8sHC6HWo_lightning-crack-vfx.md](4QF8sHC6HWo_lightning-crack-vfx.md) は**地面/壁に走る罅割れ（放射テクスチャブレンド）**が題材だったのに対し、本動画は**天から落ちる稲妻の「筋」そのもの**を Mesh + World Position Offset で造形する点が根本的に異なる技法

## 概要

8分5秒。半リング状の static mesh 1本を Spline Thicken（WPO）でうねらせ、Niagara の Mesh Renderer で「空から落ちる雷の一撃」を作る。テクスチャ3枚+static mesh 1個、マテリアル1枚、Niagara エミッタ1つ（複製2つでバリエーション追加）というごく小規模な構成。

## 技術詳細

### アセット
- テクスチャ3枚（Epic 提供）+ static mesh 1個（半リング形状、UV は縦方向に flat 展開）

### マテリアル基本設定
- Blend Mode = Translucent、Lighting Mode = Unlit、Two Sided = ON

### World Position Offset（雷の形状そのものを作る核）
- エンジン標準のマテリアル関数 **Spline Thicken** を使用。static mesh に WPO として作用し、スプラインの太さ（base width / tip width）を制御する。値は 15 / 20 に設定（static mesh の実寸に応じて調整）
- 追加のランダム揺らぎ: Normal Map テクスチャ → TexCoord+Panner（speed=1, tiling=2）→ Component Mask で R/G 抽出 → 小さい係数を乗算して Spline Thicken の thickness 入力に加算
- Edge Fade: 別 TexCoord の G チャンネルを 1-x で反転（中心領域だけ効かせる）→ ×4 → Power で中心へタイトに絞り込み、さらにノイズテクスチャを乗算してランダム性を追加
- 上記結果に Dynamic Material Parameter（乱数スタート位置、speed=0.2/0.4）で駆動したテクスチャを乗算 → Transform Vector で Local→World 変換 → 最終的に WPO 全体の強度パラメータで乗算してマテリアルに反映

### Opacity（縦方向スイープ）
- マスクテクスチャ: Break Float で R チャンネルをそのまま使用、G チャンネルは Dynamic Material Parameter を Lerp のパラメータ（範囲 2 〜 -1）に接続し、**上から下へのスイープ**を作る
- 上記に WPO 側の Edge Fade マスクを乗算（縁の硬さを消す）、さらに Particle Color の Alpha を乗算して Opacity に接続

### Emissive（雷本体の発光）
- Lightning テクスチャの UV は static mesh が縦向きのため、Breakout/Swizzle で R をそのまま、G に Dynamic Material Parameter（乱数値、ボルトごとに UV 開始位置を変える）を使い Panner に接続（X 軸のみ speed 指定、縦移動のみで横移動は不要）
- Derive HDR from LDR を経由して Particle Color に出力
- 別経路: ノイズテクスチャ（任意チャンネル、A=100, B=1）を Lerp で Particle Color に混ぜて色にダイナミックな変化を加え、HDR Tint 経由で最終的に Emissive Color へ

### Niagara System
- 前回動画（バースト系）で作った Niagara System 内に新規エミッタを追加、名前を lightning に変更
- デフォルトの Sprite Renderer を削除し **Mesh Renderer** に差し替え、上記マテリアル+static mesh を適用
- Emitter State: Self, Loop Behavior=Once, Loop Duration=0.1秒
- Spawn Burst + Spawn Rate 併用（前回動画の設定をコピー）: Burst Count=3, Spawn Rate=5
- Initialize Particle: Lifetime=0.2〜0.3秒（短寿命）、Color は User Parameter 制御。Start Position の Z 軸=400（空から落ちてくる位置）
- Mesh Scale: static mesh が大きいため X 軸スケールを縮小してボルト状の細さに調整
- Initial Mesh Orientation: Z 軸周りにランダム回転を追加
- Scale Color は Curve テンプレートで発光を強調
- マテリアル側の複数の定数を Dynamic Material Parameter 化し、Niagara 側からリアルタイム調整: マスク用カーブ（0→1、上→下スイープ）、Random UV（0〜1）、WPO の「twist intensity」（100〜200、強くねじれる設定）

### バリエーション量産
- **カラフル版**: エミッタ複製、Duration を少し延長、Color を Random Hue（Hue Shift 範囲 0〜1）に変更するだけ
- **リフロー（残光が引いていく）版**: エミッタ再複製、マスクカーブを反転（1→0）するだけで、雷が消えていく方向の演出が作れる

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の電撃系記述（Radial Gradient Exponential→Particle Color→Multiply→Lerp）および既存ノートのクラック技法（放射テクスチャ2系統 Blend Overlay）は**いずれも面（Sprite/Decal 相当）ベースの表現**だったのに対し、本動画は以下の点で明確に異なる技法カテゴリを追加する:

- **Spline Thicken（Material Function）を WPO に使い、static mesh そのものを雷の形状に変形させる**手法。既存ドクトリンの「トレイル/光の筋」節は Ribbon（SpawnPerUnit+RibbonWidth）または Sprite Pivot ずらしのみを列挙しており、**Mesh+WPO で1本のボルト形状を造形するパターンは未収録**
- **Dynamic Material Parameter で WPO の thickness/twist intensity を Niagara 側から直接アニメーションさせる**設計。既存ドクトリンの Dynamic Material Parameter 活用は Opacity/Emissive 系の強度制御が中心で、**WPO パラメータの動的制御という応用先は新規**
- **縦方向スイープ（Lerp のパラメータ範囲を 2→-1 にして上→下に走らせる）で「稲妻が落ちる」タイミングを Opacity 側だけで表現**する軽量パターン。マスクカーブを反転するだけで「出現」と「消失（リフロー）」を1本のロジックで両方作れる点が量産効率として具体的
- Mesh Renderer 側の「大きい static mesh を X 軸だけ縮小してボルト状に見せる」というスケール調整の考え方は、doctrine の「1粒バースト+カーブ駆動の器」（Light/Decal/柱メッシュ）に近い発想だが、対象が「WPO で動的変形する mesh」である点が新しい

## SCRAP BLITZ UEへの応用メモ

- METEO の SP 技や、電撃属性の敵/ボス攻撃で「上から降ってくる一撃（範囲攻撃の着弾直前予兆〜発生）」演出として、この Mesh+WPO 雷ボルトはテレグラフ→発生の2段階表現に転用しやすい。現状の AOE テレグラフ（SBMine 型、赤枠+橙塗り 0.20→0.95）とは別レイヤーの「発生した瞬間の一撃そのもの」の視覚化に使える
- Dynamic Material Parameter で WPO 強度をリアルタイム制御する考え方は、被弾フラッシュだけでなく、既存の「ボス装甲へのヒビ」候補演出（クラックノートで記録済み）とも組み合わせて、静的な罅割れに「稲妻が走る」動きを足す拡張も考えられる
- カラフル版（Random Hue）とリフロー版（マスク反転）はどちらも**既存エミッタの複製+パラメータ1〜2個の変更**で作れる量産パターンであり、METEO 専用色/敵専用色のバリアント展開にそのまま使える設計思想

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名の一部（"text cord node" = TexCoord、"break out float" = Break Float 等）は文脈から復元した表現であり、正式なノード名と完全一致するかは未検証
- 「Spline Thicken」という関数名は字幕上で明瞭に発音されているが、実際のノードグラフ画面は視聴しておらず transcript ベースの要約のため、入出力ピンの正確な名称・順序は推定を含む
- 各種数値（base width=15, tip width=20, twist intensity=100〜200 等）は音声からの聞き取りであり、UI 上の実際の値と誤差がある可能性がある
- 「前回動画（雷バースト）」は本部屋未収録のため、本動画が前提とする Niagara System 全体（バースト側の設定）は本ノート単体では把握できない
