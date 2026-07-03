# 学習ノート — Landscape Basics: Medieval Game Environment extended tutorial（Epic Games 公式）

- 動画: https://www.youtube.com/watch?v=HVoaR0Um08w （12:25）
- 話者: Matt Oztalay（Epic Games Developer Relations Technical Artist。Quixel Medieval Game Environment のマテリアル・パフォーマンス担当）
- 学習日: 2026-07-03 / 抽出: 英語手動字幕 → Sonnet 単独要約（監査待ち）
- 原典 transcript: [../transcripts/HVoaR0Um08w.txt](../transcripts/HVoaR0Um08w.txt)（`[MM:SS]` で原文照合可能）
- 位置づけ: Landscape Material 解説の前編（後編は Runtime Virtual Texture 活用編、別動画）

## この動画の範囲

Landscape Material の内部構造（Layer 定義 → blend → wetness/puddle → RVT 出力 → 読み戻し → specular 補正 → grass type）を、実際に組んだマテリアルグラフを見せながら解説する回。Sculpt 操作や解像度/section 設定など「地形そのものの作り方」の実演は含まれない（タイトルの Landscape Basics は Quixel 環境のマテリアル基礎という文脈）。**Landscape Layer の 2 種類（weight-blended / non-weight-blended）の使い分けと Layer Blend Height が本編の核**。

## Landscape Layer の基礎（Epic 公式の説明）[01:07–02:18]

- Landscape にペイントする時、任意の値を **Landscape Layer** という単位に書き込んでいる [01:07]
- Layer には 2 種類ある [01:14]:
  - **weight-blended layer**: 塗られた全レイヤーの寄与を正規化して集約値を出す。rock→grass→dirt の順に塗ると最終的に dirt が上に乗る（後勝ちで自然に混ざる）[01:27–01:38]
  - **non-weight-blended layer**: 単独で存在できる値。grass→dirt→rock と塗ると 3 つが不自然に均等ミックスされる望ましくない結果になる [01:38–01:48]
- **通常の地形ブレンドには weight-blended を使うのが基本** [01:48]。non-weight-blended は「wetness」「foliage mask」のような**補助的な単独マスク**用途に使う、という使い分けが明言されている [01:51–01:56]
- weight-blended の利点は 2 つ [01:57–02:18]:
  1. 頂点カラーやカラーマスキング（大抵 4 チャンネル止まり）より**はるかに多いレイヤー数**をブレンドできる
  2. **順序非依存**（order-independent）— どれが先／後かを明示的に決める必要がない

## マテリアル全体構造（左から右への処理順）[02:18–02:53]

1. 各 Landscape Layer を Material Function で個別定義
2. それらを blend
3. wetness と puddle を適用
4. Runtime Virtual Texture へ出力（World Height Offset も一緒に）
5. RVT をサンプルして最終出力
6. Specular 値に補正をかけ、遠距離でのシワが出ないようにする

各レイヤーの Material Function は Quixel Megascans plugin 付属の **M_StandardMaster** を緩くベースにしている [02:53–02:57]。

## Material Function 化した理由と手法 [02:57–03:35]

UE のマテリアルパラメータは名前が一意でなければならない制約があるため、レイヤーごとにロジックを複製せずコントロールを作る工夫として:

- Quixel master material の機能を **Material Function にコピー** [03:10–03:14]
- Function 内で関連する出力を **SetMaterialAttributes ノード**にルーティング [03:19–03:22]
- Vector/Texture/Scalar パラメータ入力の代わりに **Function Input** に置き換え、デフォルト値で動作確認 [03:25–03:33]
- 各レイヤーの Function では入力パラメータ名をレイヤーごとに一意にし、**Parameter Group を設定**して Material Instance ウィンドウでアーティスト向けに整理する [05:14–05:24]

## Texture Bombing（タイリング対策・ドクトリン既出分の差分のみ）[03:35–04:16]

ドクトリンの「TexCoord → Multiply → Scalar Param "tiling"」とは別系統の手法として、この動画では **Texture Bombing** が使われている:

- 手法: テクスチャの異なる領域をランダムサンプルし、オプションでランダム回転をかけてブレンドする [03:41–03:47]
- エンジンにデフォルトでいくつかバージョンが同梱されているが、本プロジェクト用に改造したものを使用。場所は `Materials, Functions, Texture Bombing` フォルダ [03:50–03:57]
- コスト: ブレンドのため**各テクスチャを 2 回サンプルする必要があり**、テクスチャサンプリングコストが増加する [03:59–04:04]
- 対策: **Sampler Source を Shared Wrap に変更**することでマテリアルあたりのテクスチャサンプル数のハードリミットを回避できる [04:06–04:13]（詳細は動画の説明欄リンク参照、との言及のみ）

## Opacity ピンを Displacement 運搬に転用 [04:42–05:10]

- MaterialAttributes 構造体の **Opacity 入力ピンを流用して displacement 値を運ぶ** [04:42–04:48]
- Opacity は最終マテリアルでは未使用だが、SetMaterialAttributes 構造体と一緒にデータが運ばれるため安全な置き場所として選定 [04:48–05:00]
- Displacement マップは高さ情報を持ち、**このマテリアルは tessellation も displacement も使っていないにもかかわらず後で利用する** [05:00–05:10]（後述の Layer Blend Height 用）

## Layer Blend Height（本編のハイライト）[05:44–06:32]

Unreal はマテリアルが Landscape に適用されている場合、レイヤー間のブレンドを自動で処理してくれる [05:36–05:44]。ブレンドオプションは複数ある:

- **デフォルトの weight blending**: 塗られた領域内の全レイヤーの weight 値を滑らかにブレンドする。特定レイヤー同士のブレンドには有効だが、例えば **sand を brick にブレンドする時に弱点が出る** [05:47–05:59]
  - Brick の目地（grout）は表面より低いため、sand が先に目地を埋めてから brick 全体を覆ってしまう挙動になる [05:59–06:07]
- 対策: 各レイヤーの Material Function に既に displacement/height 情報があるため、**Blend Mode を Layer Blend Height に変更** [06:07–06:15]
  - Layer Blend Height は各レイヤーに**追加の height 入力**を持つ [06:15–06:18]
  - Material Function の height 出力をそこに接続する [06:19–06:22]
  - 結果: sand が brick に「lerp で上から被さる」のではなく**自然に染み込むようにブレンドされる** [06:22–06:29]
- 基本セットアップの締め: Layer Blend ノードの出力を MaterialAttributes 入力にドラッグして繋げば完成 [06:32–06:39]

**※このセクションが本動画で最も具体的かつ再利用価値の高い技術情報。** 「sand→brick」の例えは transcript 原文どおりだが、SCRAP BLITZ の廃滑走路（アスファルト→土/砂利/ひび割れ）にほぼそのまま当てはまる状況設定。

## Wetness と Puddle（Ben Cloward 由来の技法）[06:39–08:16]

Quixel 側の追加要望として、寂れた村の設定に合わせ landscape を濡らしたり水たまりを作れるようにする機能 [06:42–06:55]。**Ben Cloward の Rain Material から 2 つの技法を採用**（プレイリストは動画説明欄にリンク）[06:55–07:04]。

### Wetness [07:04–07:34]
- `MF_Wetness` という Material Function で実装 [07:07–07:10]
- 処理: 入ってきた base color を **脱彩度 → 少し暗く → roughness を下げる** [07:10–07:16]
- 入力の一つが `Layer Sample 'Wetness'` ノード — これは前述の **non-weight-blended layer** の実例 [07:16–07:24]
- Landscape のどの部分でも独立して濡らせるよう、この layer は単独で存在し絶対値をどこでもサンプルできる [07:24–07:34]

### Puddle [07:34–08:16]
- Ben Cloward の技法をさらに応用 [07:39–07:42]
- ブレンド済みマテリアルの height 情報を使い、**wetness 値に基づいて水位を上げていく** [07:42–07:50]
- 水は実質的にマスクにすぎない。roughness を下げ、specular を上げ、水深が増すほど base color を曇らせる（それぞれ独自のコントロール付き）[07:50–07:59]
- 将来のための備えとして puddle mask も出力しておく [08:01–08:06]
- **重要な制約**: ripple や wave は一切実装していない。理由は **Runtime Virtual Texture に描画されるマテリアルは time を知らない**ため。もし panning normal map を仕込んでも静止したままになる [08:06–08:20]

## RVT 出力と読み戻し [08:20–09:16]

- この時点までの処理は**カメラ・時間に依存しない計算がすべて完了**している状態 [08:20–08:25]
- 該当する値を Runtime Virtual Texture 出力ノードへ出力する [08:25–08:30]
- 同時に、**base color から Specular 値を導出**する簡易トリックを Quixel チームから教わって使用。displacement 値に応じて specular 応答を少しずらしたいというアーティスト要望に対応 [09:36–09:52]
  - オフセットを計算し、それを **World Position の Height に加算**して **World Height 入力ピン**（RVT 出力ノード内）へ出力 [08:52–09:03]
  - この World Height 値は次編（RVT 活用編）で landscape へのブレンドに使う、との予告のみ [09:03–09:08]
- 出力後、**同じ RVT を今度はマテリアル自身でサンプルして読み戻す** [09:08–09:16] — 「landscape 全体をテクスチャに一度焼き付けてから読み直している」という説明 [09:16–09:20]

## RVT サンプル後に足せる要素（Epic 公式の例示・実装詳細なし）[09:23–09:40]

サンプル後の段階ではカメラ情報にアクセスできるため、以下が可能と言及（本動画では実装せず例示のみ）:
- puddle への ripple 追加
- lava の flow
- 距離ベースのテクスチャブレンド
- カメラ情報を使った reflection 効果

## Glancing Angle Specular Correction [09:40–10:01]

- アーティストからの最大の要望だった機能 [09:40–09:45]
- 課題: 過去の landscape マテリアルでは、**カメラに対して一定の距離・角度になると specular 応答が平坦化して見える**問題があった [09:45–09:54]
- 対策: **depth fading と最終段の math** にいくつかのコントロールを加え、アーティストが遠距離での specular 応答を調整できるようにした [09:54–10:01]
- 具体的な数式・パラメータ名までは transcript に言及なし（「a bit of depth fading and final math」という抽象的表現のみ）

## Landscape Grass Type（フォリージ配置の仕組み）[10:01–10:37]

- アーティストの作業を楽にするため、**各レイヤーに専用の landscape grass type を設定** [10:01–10:09]
- Landscape Grass Type は特殊な foliage で、**マテリアル内でどこに配置するか指定できる** — landscape layer sample を landscape grass output に繋ぐだけでも機能する [10:09–10:16]
- 加えて、もう一つの **non-weight-blended layer「Foliage Mask」**を追加し、アーティストが植生を狙って削れるようにした [10:16–10:22]
- Landscape Grass Type アセットは作成が容易で、以下をコントロールできる [10:22–10:37]:
  - 複数種の草のバリエーション
  - density（密度）
  - random rotation / scaling
  - **Cull Distance**（重要、と明言 [10:37–10:40]）

## デモ手順（Landscape Layer Info 作成の実務）[10:40–11:46]

- Landscape に material instance を適用した直後は**レイヤー情報が無いため黒一色**になる [10:52–10:55]
- Unreal は適用したマテリアルをスキャンし、マテリアル内で名前付けされた全レイヤーを検出する [10:55–11:02]
- ペイントには **Landscape Layer Info** というアセットが必要。**Landscape Mode パネルから素早く作成できる** [11:02–11:10]
- 運用 Tips: これらのアセットは使用する map の近くに保管する [11:10–11:12]
- wetness / foliage mask レイヤーは作成時に明示的に **non-weight-blended として作成**する [11:12–11:19]
- デモの実演内容:
  - dirt レイヤーを塗ると landscape grass type により小石が出現 [11:19–11:25]
  - grass を塗ると草の foliage が付随して出現 [11:25–11:33]
  - grass の中央に puddle を塗ると、**grass layer がサンプルされ続けているため池の中にも草が生える**という不具合が可視化される [11:33–11:41]
  - **Foliage Mask で該当箇所を塗り消して解決** [11:41–11:46]

## SCRAP BLITZ に活かせる部分

L_Stage01 の地面（廃滑走路）は「アスファルト → 剥落・ひび割れ → 土/砂利の露出」という劣化表現が主題であり、この動画の Layer Blend Height の説明（sand→brick 問題）は構造的にほぼ同型の課題:

1. **Layer Blend Height への切り替えが最優先候補** [06:07–06:29]
   - 現状 L_Stage01 のアスファルト材が標準 weight blending だとすると、ひび割れ部分の砂利/土がアスファルト表面に「べったり乗る」不自然な見た目になっている可能性が高い（要現況確認）
   - Height 情報は displacement map から取得可能なため、**追加テクスチャ不要**でこの改善が入る（既存の height/displacement マップを height 入力に繋ぐだけ）
   - 効果: 砂利がアスファルトの低い部分（ひび割れの溝）に自然に染み込むように見える → 「劣化した滑走路」の説得力が上がる

2. **non-weight-blended layer による単独マスクの使い分け** [01:38–01:56][07:16–07:24]
   - wetness / foliage mask の実例は、L_Stage01 での「油汚れシミ」「特定箇所だけの砂埃堆積」等、**独立して on/off したいマスク全般に転用できるパターン**
   - ドクトリンの「decal 3 種で汚す」路線と並行して、**Landscape Layer レベルでも同種のマスクを持てる**という選択肢が増える

3. **Landscape Grass Type + Foliage Mask の組み合わせ** [10:01–10:22][11:33–11:46]
   - 滑走路の亀裂・端部から雑草が侵食している表現をやるなら、grass layer に landscape grass type を紐付けて自動配置し、望まない箇所（本来舗装が生きている部分）は Foliage Mask で塗り消すワークフローがそのまま使える
   - Cull Distance の明言 [10:37–10:40] はパフォーマンス上も無視できない設定項目

4. **RVT は time 非依存という制約の再確認** [08:06–08:20]
   - もし L_Stage01 の地面材を RVT 経由にする場合、水たまりの波紋やパンニングノーマルは RVT 焼き付け前段では効かない。動く表現は RVT 読み戻し後（サンプル後）の段階でやる必要がある、という設計上の制約は覚えておく価値がある

5. **Opacity ピン転用による displacement 運搬** [04:42–05:10]
   - Tessellation/Displacement を使わないマテリアルでも height 情報だけは保持して blend 用途に流用する、という考え方自体が「使っていない入力ピンを別データの運搬に転用する」汎用パターンとして参考になる

## 確信度メモ（自己チェック）

- Sampler Source "Shared Wrap" というノード設定名 [04:09] は transcript 原文どおりの引用で、UE の実際の Landscape Material 設定項目としても存在が確認できる一般的な用語（自己知識と整合）
- Glancing Angle Specular Correction の具体的な数式・パラメータ名は transcript に一切含まれておらず、本ノートでも「depth fading と math」という抽象レベルの記述に留めた（数値の捏造なし）
- Cull Distance が「重要」という強調は話者の "importantly" という発言 [10:37] にそのまま基づく — 具体的な距離値は言及なし
