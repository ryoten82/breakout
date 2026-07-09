# 学習ノート — UE5 Material Crystal Effect（同名別動画）

- ソース: https://www.youtube.com/watch?v=7s30TJfvE8M （7:31）
- 視聴日: 2026-07-09 / 字幕種別: **英語手動字幕**（`--write-sub` で取得成功、自動字幕への切替不要）
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\7s30TJfvE8M.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [5s6toOn_qPc_material-crystal-effect.md](5s6toOn_qPc_material-crystal-effect.md)（同名タイトル「UE5 Material Crystal Effect」の別動画。あちらは Fresnel 中心の内側発光/疑似屈折/反射の4要素構成）

## 概要

同名別動画だが手法は**ほぼ非重複**。Fresnel を一切使わず、**Camera Vector をテクスチャ座標として流用した「偽の環境マップ」**をベースに、ノイズテクスチャのディストーション、2枚のひび割れ(crack)テクスチャの多重合成、Sine 駆動のフリッカーという別系統の構成でクリスタルらしさを作る。Base Color を最終的に切断し、Emissive のみで見た目を成立させている点が本動画独自の判断。

## 技術詳細

### 1. テクスチャ素材

- ISO Crystal 系テクスチャ（Substance Designer で自作、または Bridge/Megascans で "Frozen" 系検索）。実演では "Frozen Lake" サーフェスを使用

### 2. 偽の環境マップ（本動画の起点）

- Camera Vector（ピクセルからカメラへの方向）を Component Mask で X/Y チャンネルのみ取り出し、**そのままテクスチャ座標として使う**ことで環境マップ風の表現を偽装する定石を使用
- そのままだと見た目が崩れるため、**Transform Vector で World → Tangent 空間に変換**してから使うと改善する、という比較実演あり（Camera Vector を素の World 空間のまま使うと歪みが強すぎる、という失敗→修正の流れが明示的）

### 3. ノイズによるディストーション

- ノイズテクスチャを Multiply（係数）→ Add（オフセット）で加工し、その出力を「もう1つの Multiply」の B 入力へ、UV を A 入力へ接続してテクスチャ座標を歪ませる（典型的な UV ディストーション配線）
- Multiply の係数を変えることで歪みの強度を調整できる、という実演
- ノイズテクスチャに **Panner（Speed X/Y = 0.1）を追加**してディストーションをアニメーション化
- 歪ませた結果の RGB を **そのまま Emissive Color に接続**（この段階では Base Color は未切断）

### 4. ひび割れ(crack)の多重合成

- 同一テクスチャをコピーし、**Multiply 0.5** と **Multiply 2.0** の2系統を用意（UV スケールを変えて「太いひび」「細かいひび」を作り分ける）。**倍率が大きいほどひびが小さく密になる**という関係が実演で明示
- 2系統を **Add** で合成し、さらに **Multiply（色）** で着色
- 色は Material Instance 側で変更したいため、**Dynamic Vector（Vector Parameter）** として公開
- 2系統の合成前に **Power** をかけて全体を暗めに寄せてから Add することで、明るくなりすぎる問題を回避（5s6toOn_qPc ノートの「Power で暗く寄せてから Lerp/Add」という設計判断と同型のパターン）
- **Base Color を意図的に切断**（disconnect）した結果、Emissive 主体の見た目のほうが「クリスタルらしく見える」と判断・確定。これは本動画固有の明示的な設計判断

### 5. フリッカーするひび割れ（Sine 駆動）

- crack テクスチャをもう1コピー用意し、Power の Exponent に **Dynamic Parameter**（外部公開値）を接続
- **Sine(Time) を使い、定数で Scale（実演値: A=2, B=3 相当、字幕上明瞭だが具体的にどちらが Scale/Bias かは細部不明 ※推定）して 0〜1 の範囲に正規化**した値を「フリッカー強度」として使用
- このフリッカー値を色に Multiply → 既存の Emissive Color に Add で加算し、明滅する亀裂を実現
- 5s6toOn_qPc ノートの「Fresnel Exponent を Time 駆動で Sine 変調」と**波形生成の考え方は類似**だが、本動画は Fresnel を経由せず**テクスチャの Power Exponent を直接 Sine 駆動する**点が異なる

### 6. Fresnel(縁の発光)は明示的に保留

- 「エッジを光らせる Fresnel 効果も追加できるが、今回はこれで一旦保留する（aside for now）」と明言。**本動画では未実装**（5s6toOn_qPc の Fresnel 主体アプローチとは対照的に、こちらは Fresnel を使わない完成形として締めている）

### 7. UV タイリングの外部公開

- TexCoord → UE（UV 値？字幕上「UE」表記、詳細不明 ※推定）を Multiply → Dynamic Parameter で制御
- **Append Vector で U/V 別々のタイリング値を制御**し、それを Camera Vector 由来の座標に Add してから Texture UV に接続することで、Material Instance からタイリングを独立調整可能にする

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` v2.4 および 5s6toOn_qPc ノートとの比較で、以下が本動画固有の新規パターン:

- **Camera Vector を Component Mask で XY 抽出しそのままテクスチャ座標に転用する「偽環境マップ」**は、ドクトリンの Fresnel/UV 制御関数のいずれとも異なる第三のアプローチ。World→Tangent 空間変換が必須という実装上の注意点も新規
- **同一テクスチャを異なる UV スケール（Multiply 0.5 / 2.0）で2重取得し Add 合成する「粗密2層クラック」パターン**は、ドクトリンの「Additive2系統並列（Offset違いのUV制御関数をMultiply合成）」と構造は似るが、対象が**UVスケール違い（タイリング密度）**である点で軸が異なる（5s6toOn_qPc の「距離違いBump2系統」ともまた別軸）
- **Base Color を完全に切断し Emissive のみで質感を成立させる**という判断が明示的に語られている点。5s6toOn_qPc は Base Color を保持したまま Fresnel で発光を足す方式だった
- **Power Exponent を直接 Sine(Time) で駆動してテクスチャ全体の明滅を作る**手法。5s6toOn_qPc の「Fresnel Exponent を Sine 駆動」と発想は同型だが、対象ノードが異なる（Fresnel でなく Power）ため汎用性が高い（Fresnel を使わないマテリアルでも転用可能）

## SCRAP BLITZ UEへの応用メモ

- **OC ジェムへの適用可能性は 5s6toOn_qPc ノートより限定的**: 本動画は「Emissive 主体・Fresnel 不使用」の完成形であり、これまで OC ジェムで難航している「内側から光る」表現（`handoff_scrapblitz_2026-07-09_ocgem-vfx-billboard-bug-and-pacing-concern.md` 参照）には直接は効かない。ただし**「Base Color を切って Emissive のみにする」判断そのもの**は、OC ジェムの見た目が定まらない現状に対して**構成要素を減らして絵作りを単純化する**という角度の代替案になりうる（試行数を減らす方向の提案として記録）
- **粗密2層クラックの Add 合成パターン**は、宝石・鉱石アイテムのひび割れ演出（被弾時のダメージ表現、破壊直前の警告演出等）に転用候補。特に Power Exponent の Sine 駆動フリッカーは軽量な「警告点滅」表現として、AOE テレグラフ以外の箇所（低HP警告、破壊寸前オブジェクト）にも応用できる可能性がある
- **偽環境マップ（Camera Vector→UV）** は追加のテクスチャサンプルコストがほぼゼロで疑似的な質感変化を出せるため、モバイル/軽量指向のパーツ（背景の結晶装飾、非主役級の鉱石オブジェクト）への適用候補として記録

## ソースの限界

- 英語**手動**字幕（自動字幕ではない）のため誤認識は少ないが、UI 上の細かいノード名（例: 「UE」がどのノードを指すか、「add一つ」実演直前の文脈）は口頭説明のみで画面同期の確認ができておらず、一部 ※推定 表記のまま
- Sine 波形生成の定数（A=2, B=3 相当）が具体的にどのパラメータ（Period/Scale/Bias のどれ）を指すかは 5s6toOn_qPc 同様に断定できず、実装前に UE 実機で再検証が必要
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。数値パラメータ（Multiply 0.5/2.0、Panner Speed 0.1 等）は字幕の記述をそのまま使用しており、実装前の再検証が必要
