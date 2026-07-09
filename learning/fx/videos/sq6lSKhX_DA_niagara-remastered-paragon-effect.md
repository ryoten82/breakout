# 学習ノート — UE5 Niagara Remastered Paragon Effect

- ソース: https://www.youtube.com/watch?v=sq6lSKhX_DA （4:07 / チャンネル: Alex Huang）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ**（`--list-subs` で確認済み・手動字幕は存在しない）。認識の怪しい箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\sq6lSKhX_DA.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: 同チャンネルの後編と思われる **"UE5 Niagara Remastered Paragon FX - Tutorial"**（動画ID `0qa5Hi2qU9w`、タイトルのみ確認・本ノート作成時点で内容未視聴）が存在する。本編は「Character Effect」1種類の変換のみを扱う短尺編、後編はおそらく他の Paragon FX 群を扱う続編と推測される（未確認）

## 概要

Paragon（Epic 公式の旧無料アセット群）の Character エフェクトを、Cascade から Niagara へコンバートし直す「リマスター」作業のスクリーンキャスト。UE 標準の Cascade→Niagara 自動コンバータを使った後に **必ず発生する変換エラーの直し方** に的を絞った内容。約 20 種類ある同種エフェクトのうち、パターンが被るため 1 つだけ詳しく直し、他は同じ修正の使い回しで済むと説明している。

## 技術詳細

### 1. コンバートの起点
- Cascade エフェクトを右クリック → **Convert to Niagara System**
- 変換直後は Niagara スタック上に多数の Warning/Error（Arrow アイコン）が出る、という前提から始まる

### 2. 色が出ない問題（Scale Color モジュール）
- Cascade 側の **Scale Color** モジュールは Niagara に変換されても正しく機能しない
- 対処: 各エミッタで Scale Color モジュールを削除し、**Particle Initial Color** に置き換える。これを **全エミッタに対して個別に**実施する必要がある（一括変換されないため手作業が要る、という点が強調されている）

### 3. サイズカーブが消える問題（Size By Life → Scale Size）
- Cascade の **Size By Life**（Life 全体で 1.0 → 0.1 に縮小するカーブ）が変換時に失われる
- 対処: 変換で生成された壊れたモジュールを削除し、**Scale Size** モジュールを新規追加。Cascade 側と同じカーブ（1 → 0.1）を手動で再現する

### 4. Dynamic Material Parameters の再配置
- Cascade からの変換で Dynamic Material Parameters が **Particle Spawn** 側に来てしまうケースがある（※推定：字幕から詳細な因果関係は不明瞭）
- 対処: Particle Spawn 側のモジュールを削除し、同じパラメータ値を **Particle Update** 側に設定し直す

### 5. ワークフロー全体の位置づけ
- 上記 3 種の修正（色/サイズ/Dynamic Material Parameters）を直せば「変換エラーの解消」は完了する、という区切りを明示
- ただし「完全なリマスター」（Cascade 時代の見た目をより良くする作業）は別レイヤーの追加作業であり、本動画はそこまで踏み込まない、と最後に明言している

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` は Niagara の新規構築パターン（Stateless 優先・マテリアル定型・トレイル手法等）を扱うが、**Cascade → Niagara 変換のトラブルシューティング**は未収録の領域。本ノートで得られる新規情報:

- **Cascade→Niagara 自動コンバータの既知の弱点 3 点**: (1) Scale Color が壊れる → Particle Initial Color で代替、(2) Size By Life カーブが失われる → Scale Size モジュールで手動再現、(3) Dynamic Material Parameters が Spawn 側に誤配置される → Update 側へ移し替え。いずれも「自動変換を過信せず、色・サイズ・DMP の 3 点は必ず手動チェックする」というレガシー資産移植時のチェックリストとして定型化できる
- **量産エフェクトの修正戦略**: 同種エフェクトが 20 種類あっても、パターンが 2〜3 種類に集約されるため「代表 1 つを直して残りは同じ手順を転用する」という効率化の考え方（doctrine の「システム階層=監督・バリアント量産は数行差し替え」とは逆方向＝*ゼロから作る量産* ではなく *壊れた資産の量産修復* の文脈）

## SCRAP BLITZ UEへの応用メモ

- SCRAP BLITZ UE は Niagara 新規構築が中心で Cascade レガシー資産の移植は現状想定していないが、**将来 Fab/Marketplace から Cascade ベースの無料/購入アセットを導入する場合**にこのチェックリストがそのまま使える: 変換後は必ず (1) 色 (2) サイズカーブ (3) Dynamic Material Parameters の 3 点を確認する
- 「一括変換に頼らず手動で当たりを付け直す」という姿勢は、Kurie VFX Shader Library 等の外部アセット導入時（`handoff_scrapblitz_2026-07-08_ocgem-kurie-vfx-round14-17.md` 参照）にも通じる教訓として流用可能

## ソースの限界

- 英語自動字幕のみで手動字幕なし。誤認識が多く（"paragan"="Paragon"、"nagra"="Niagara"、"charter"="Character" 等）、文脈から補って読み替えている
- 実際のノードグラフ画面は視聴しておらず、字幕テキストのみからの要約。特に「Dynamic Material Parameters が Spawn 側に来てしまう」件の技術的因果（なぜそうなるか）は字幕からは特定できず「※推定」扱い
- 動画自体が 4 分強と短く、実演の詳細な手順（クリック箇所・具体的なノード名の完全一致）まではカバーしきれていない可能性がある
- 後編と思われる `0qa5Hi2qU9w` は本ノート作成時点で未視聴。関連性の記述はタイトルからの推測に留まる
