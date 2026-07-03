# 学習ノート 12 — Runtime Virtual Textures: Medieval Game Environment extended tutorial

- 動画: https://www.youtube.com/watch?v=rSYEBIflhLU （7:44・Epic Games 公式）
- 学習日: 2026-07-03 / 抽出: 英語手動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/rSYEBIflhLU.txt](../transcripts/rSYEBIflhLU.txt)（`[MM:SS]` で原文照合可能）
- 話者: Matt Oztalay（Epic Games Developer Relations Technical Artist）。前回動画（landscape material 構築編）の続編

## RVT とは何か・何のためにあるか [00:42–00:58]

Runtime Virtual Texture は「大量の情報を top-down で単一の巨大テクスチャセットに描き込み、それを通常なら発生する巨大なメモリオーバーヘッド無しで扱う」仕組み [00:42–00:52]。
具体例として挙げられているのが**道路マテリアルを地形に投影する**ケース [00:52–00:58]: 道路側に「地形をどう描画するか」の追加命令を一切持たせずに、地形の上に道路の見た目を焼き込める。これは SCRAP BLITZ の「地面と設置物の縁を消す」を UE の仕組みとして正式に実装する方法にあたる。

## この projectでの構成: RVT asset 2 種 + Volume 2 つ [00:58–01:32]

- **RVT Landscape 01**: 出力先が Base Color / Specular / Roughness / Normal [01:02–01:06]
- **RVT Landscape Height 01**: 出力先が World Height [01:06–01:10]
- 両方とも `Materials/Landscape/RVT` フォルダに配置 [01:11–01:16]
- ワールド内には **Runtime Virtual Texture Volume を 2 つ**（RVT ごとに 1 つ）設置し、**bounds を landscape のサイズに一致させる** [01:16–01:24]
- Landscape actor 自体の設定: 両方の RVT に draw する + **Draw in Main Pass = Always** [01:24–01:30]
  - Draw in Main Pass = Always の意味: マテリアルのうち「virtual texture に出力する部分」は volume に紐づく RVT へレンダリングされ、**それとは別に**通常の main pass（画面に見える描画）にも自身を描画する [01:32–01:44]。つまり RVT への焼き込みと通常描画は独立した 2 系統。

## 制約: RVT 描画時は dynamic 情報が一切使えない [01:44–02:04]

RVT に書き込むマテリアル計算では **camera・time・vector など動的な情報に一切アクセスできない** [01:48–01:56]。そのため landscape material は計算を 2 系統に分割する設計になっている:
1. dynamic 情報なしで完結する計算 → RVT output node へ
2. dynamic 情報が必要な計算 → 別系統で処理

具体例として挙げられているのが landscape height に対するわずかなオフセット計算 [02:23–02:33]: RVT に出力する landscape pixel の world position は **World Position Offset を考慮しない**（RVT 書き込み時点では WPO 由来の変位が反映されないため）。

## フォールバック: Doesn't Support Virtual Texturing 分岐 [02:41–02:55]

ハードウェアが virtual texturing 非対応の場合に備え、**switch ノード**で分岐を作る [02:41–02:44]。非対応時は、RVT に出力する予定だった計算結果をそのままマテリアルの残りの部分へ直接パイプする [02:44–02:55]（RVT を経由しないバイパス経路）。

## 読み戻し: RVT sample parameter [02:55–03:14]

もう一方の入力は **runtime virtual texture sample parameter** [02:46–02:50]。すでに RVT に描き込んだ内容をサンプルするだけでよい。このマテリアルでは world height 情報が不要なため、デフォルトターゲットは RVT landscape（Base Color 系）に設定 [02:55–03:00]。

要約すると RVT の使い方の核はこの一行 [03:04–03:14]:
> dynamic でない重い計算をマテリアルで行い RVT に出力する → その値を RVT から読み戻して最終マテリアルを組む

## 応用: 地形とメッシュを自動でブレンドする仕組み [03:14–03:42]

RVT があることで得られる情報 [03:18–03:37]:
- **volume 内の任意の xy 座標に対応する color 情報**を、計算せずにテクスチャルックアップとして取得できる
- **z position（landscape の高さ）**も world height RVT からわかる

この 2 つを使うと、**追加の decal・追加の draw call・手動セットアップ無しで、地形に自然にブレンドするマテリアル**を作れる [03:33–03:42]。プロジェクトの `M_BlendMaster` がこの実装例 [03:42–03:45]。

## M Bendable Master Material の構築手順（実演） [03:45–06:47]

1. **M Standard Master をコピー**して `M_MyBendableMasterMaterial` を作成 [03:49–03:56]
2. Material Details パネルで **Use Material Attributes** をチェック [03:56–04:04]
3. albedo / specular / roughness / normal の計算を **Set Material Attributes** ノードの対応入力へ接続（= ベースマテリアル側） [04:04–04:17]
4. **Runtime Virtual Texture parameter** を作成し、デフォルト値として **RVT landscape** をターゲットに設定 [04:17–04:22]
   - このノードは world position を入力として使うため、対応する landscape 上の位置をサンプルするのに**追加作業は不要** [04:22–04:32]
5. RVT から出てきた base color / specular roughness / normal を、もう一つの **Set Material Attributes** ノードへ接続（= landscape 側） [04:32–04:39]
6. base material 側と landscape 側の両方の Material Attributes を **Blend Material Attributes** ノードに入力 [04:39–04:45]
7. **ブレンドの alpha（いつ・どうブレンドするか）を組む** [04:45–06:47] ← ここが本題

### alpha 計算: 高さベースのスムーズグラデーション [04:45–05:51]

- 目標: landscape に近づくほど landscape 側の割合を増やす、遠いほどベースマテリアル側を残す [04:50–04:59]
- **if ノードは使わない**（ハードカットオフになるため）[05:13–05:20]
- 代わりに **Normalized Range** 相当の計算をスカラーパラメータ **Blend Distance** で構成 [05:20–05:30]:
  1. `world position z − world height`（world height は RVT height からサンプル）[05:39–05:43]
  2. それを `blend distance` で divide [05:43–05:47]
  3. `1 − 上記の値`
  4. **saturate** して 0〜1 に収める [05:47–05:51]
- 結果: landscape との交点で値 = 1、**そこから 64 unit 離れると値 = 0** になるグラデーション [05:54–06:01]（動画内でのプレビュー観察値。Blend Distance の設定値そのものではない点に注意）

### 追加補正: 垂直面での破綻を防ぐ [06:01–06:47]

- RVT は **top-down projection** のため、上記のブレンドは**垂直面ではうまく機能しない**（UV error のような見た目になる）[06:01–06:13]
- 対策: **Vertex Normal World Space の .b 成分**を使う [06:13–06:17]
  - 真上向き = 1、真下向き = −1 [06:21–06:26]
  - 「表面が水平（horizontal）に近づくにつれてブレンドしない」ようにしたい、というのが狙い [06:26–06:30]
- 実装: この値を **saturate**（下向き面のブレンドは気にしないので楽ができる、と明言）[06:33–06:39] し、先に計算した height blend と **multiply** [06:39–06:42]
- 最終的にこの値を **Blend Material Attributes ノードの Alpha 入力**へ接続 [06:42–06:45]
- 講師コメント: 「この blend の解き方は無数にある。これは一例」 [06:30–06:33]

### 動作確認結果 [06:47–06:56]

- rock を landscape 上で動かすと、edge 付近で自然にブレンドする [06:47–06:51]
- box を drop しても、**unwanted texture smearing は発生しない** [06:51–06:56]

## 関連リソース（言及のみ） [07:02–07:14]

- Ben Cloward の landscape material 動画シリーズ（UE4、より詳細な解説）が紹介されている。本動画では内容の詳細には踏み込んでいない。

## SCRAP BLITZ に活かせる部分

L_Stage01 の「滑走路とプロップの接地・継ぎ目」課題に対して、RVT ブレンドは以下のように直接効く手法:

1. **RVT Volume 2 種構成をそのまま流用できる** [00:58–01:32] — Base Color/Specular/Roughness/Normal 用 + World Height 用の 2 RVT を landscape/滑走路サイズの Volume として設置し、Landscape/滑走路 actor 側で「両方に draw + Draw in Main Pass = Always」にすれば、既存の見た目を変えずに RVT 出力を追加できる。
2. **decal に頼らない自動シーム消し** [03:33–03:42] — 現状ドクトリンの「decal 3 種で汚す」「Depth Fade でフォグの縁を消す」は手動配置・個別調整が必要な対症療法。RVT ブレンドは**設置物側のマテリアルに組み込む一度限りのセットアップ**で、プロップを何個置いても・どこに動かしても自動で追従する。滑走路上に量産配置するプロップ（コンテナ・瓦礫・資材等）と相性が良い。
3. **Blend Distance パラメータで「馴染ませ範囲」を意識的にチューニングできる** [05:27–05:51] — 動画内では 64 unit 相当のグラデーション幅。SCRAP BLITZ 側で採用する場合はプロップのスケール感（自機 10m canonical）に対して meters 換算で妥当な値を実測し直す必要がある（動画の 64 unit をそのまま流用しない）。
4. **Vertex Normal の .b 成分での垂直面除外** [06:13–06:30] — 滑走路脇に**縦に立つ壁・構造物**を置く場合、この top-down 前提のブレンドをそのまま当てると破綻する（動画内でも明言されている弱点）。垂直面は別処理（既存の decal/Depth Fade 路線）に振り分けるか、alpha 計算に同じ normal 補正を必ず入れる。
5. **前提条件の確認が先** — この手法は「地形材料が RVT に対応済み」であることが前提（前回動画で構築済みという設計）。SCRAP BLITZ の landscape/滑走路マテリアルが RVT output 対応済みかどうかは実装前に要確認（既存ドクトリンにこの記述は無い＝現状 proto/UE 側は未対応の可能性が高い）。

## 字幕だけでは取れなかったもの（視覚依存・要検証）

- 実際のノードグラフのレイアウト・具体的なノード配線図（音声説明のみで画面操作は文字化されていない）
- `M_BlendMaster` 内の実際の完成形グラフ全体（動画内で「見てほしい」と参照されるのみで手順の実演対象は自作の `M_MyBendableMasterMaterial` 側）
- RVT Volume の bounds 設定の具体的な数値（「landscape のサイズに合わせた」とのみ言及、実測値なし）
