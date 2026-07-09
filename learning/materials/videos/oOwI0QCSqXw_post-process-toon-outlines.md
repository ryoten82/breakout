# 学習ノート — How To Create Post Process Toon Outlines - Unreal Engine 5 Materials Tutorial（Pitchfork Academy）

- ソース: https://www.youtube.com/watch?v=oOwI0QCSqXw （36:22）
- 視聴日: 2026-07-07 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\oOwI0QCSqXw.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [iMJJYXHMw4o_toon-shading-ue58.md](iMJJYXHMw4o_toon-shading-ue58.md)（同チャンネル Pitchfork Academy の姉妹チュートリアル「How To Use Toon Shading New In UE5.8」）。本動画内でも cel-shading 用ポストプロセスマテリアルを別動画からマイグレーションして併用するデモがあり、両者は組み合わせて使う想定。本ノート作成着手時点では未存在を確認していたが、並行セッションで追加されたためリンクを張った

## 概要（章立て対応）

動画は「環境全体に自動でアウトラインを付けるポストプロセスマテリアル」の構築が主題。チャプターは Intro → Project debrief → Outline post process material（本編、258–1484s と長い）→ Adjust parameters → Add cel-shading → Separate character outline → Flip outline logic → Outro の構成。

## エッジ検出の仕組み（法線バッファ + Post Process ドメイン）

- マテリアルの **Material Domain を Surface → Post Process** に変更し、Blendable Location は Scene Color Before DOF（DOF 未使用なら After DOF でも可、と説明あり）
- 手法の核は「4方向オフセットサンプリングした World Normal の差分」:
  1. Scalar Parameter `OutlineSize` を作成（デフォルト値 1）
  2. Vector2 の4方向オフセット（(-1,1) / (1,-1) / (1,1) / (-1,1) の4象限、動画内表記ゆらぎあり※推定）を `OutlineSize` に乗算
  3. **View Size ノードで除算**し、画面解像度に依存しないオフセット量にする（解像度が変わってもアウトライン太さが一定に保たれる）
  4. その結果を ViewportUV に加算し、4方向にずらした UV で **Scene Texture（World Normal）** を4回サンプリング
  5. 各サンプルを `×0.5 +0.5` して正規化（法線バッファの [-1,1] 域を [0,1] にリマップする定型処理）
  6. 上下2方向・左右2方向でそれぞれ Subtract → Abs（絶対値）を取り、隣接ピクセル間の法線差分を求める
  7. 差分を Add で合成し、これがエッジ強度の元になる

つまり「隣接オフセット位置の法線をサンプルして差が大きい場所＝エッジ」という、ポストプロセスでの一般的な法線ベースエッジ検出パターン。動画中盤で実装ミス（View Size を Divide の A に繋いでしまい、正しくは B に繋ぐ）が発生し、修正シーンが含まれる（**A/B の入れ替えを Ctrl+ドラッグで行う操作**として紹介）。

## パラメータ調整（太さ・角度反応の閾値）

- `OutlineSize`（Scalar）: アウトラインの太さ。**0.5 が実用上の下限**（0.49 以下では機能しなくなる、と明言）。デフォルト運用は 1 前後、キャラクター単体を目立たせたい用途では 2〜3 まで上げる例も紹介
- エッジ強度を Split Components（RGB/XYZ）した後、2つの Max ノードと Smooth Step で「面の内側にどこまでアウトラインを侵食させるか」を制御する2値パラメータを作成（動画内では変数名を明言していないため名称は推定だが、役割は **min/max のペアで角度反応の閾値を作る**もの）
  - デフォルト目安: 0.25 と 0.5（強すぎる場合は樹木等で顕著に出ると説明）
  - 実運用のチューニング例: **max=2, min=1** 付近で「輪郭のみ」に寄る挙動が得られたと紹介
  - **min は max を超えられない**。min > max にするとアウトラインが反転して破綻する、との注意あり
- `Opacity`（Scalar, デフォルト 1）: アウトライン全体の不透明度。下げると背景が透けて見える
- `Color`（Vector, デフォルト黒）: アウトラインの色そのもの

## 背景との境界を安定させる補正（Scene Depth 併用）

- World Normal ベースの差分だけだと、キャラクターが空のような「背景がない」場所に立つとアウトラインが薄くなる問題がある、との説明
- 対策として **Scene Depth を同じ4方向オフセットでサンプリング**し、深度差分（Subtract → Abs → Add → Saturate）を計算、さらに4つの深度サンプルを Max で連鎖比較。これを法線差分の Max 系ロジックに合流させ、背景の有無に関わらずアウトラインの太さが安定するよう補正する
- 深度側の Smooth Step には固定値 0.1（パラメータ化せず定数のまま、と明言）を Min 側に使用

## Cel-shading（諧調表現）の追加

- 本動画では cel-shading 自体の作り方は扱わず、**別動画で作成済みのポストプロセスマテリアルをマイグレーションして重ね掛け**するデモのみ
- Post Process Volume の `Post Process Materials` 配列に複数マテリアルを追加できる。**配列内の順序が描画順に影響**し、アウトライン用マテリアルを cel-shading 用より後ろ（配列上でアウトラインが上に来るよう）に並べ替えることで、アウトラインが cel-shading の上から正しく重なる、と説明
- cel-shading と組み合わせた際に発生するアーティファクト対策（本題のアウトライン手法ではなく周辺セットアップ）:
  - Global Illumination を Lumen → None に変更するとアーティファクトが軽減
  - Skylight の Mobility を Static にすると室内の不安定な陰影が改善
  - 完全にカートゥーン調にしたい場合は各マテリアルの Roughness を 1（フルラフ）に統一し、映り込みをなくす

## キャラクターアウトラインを環境から分離する手法（Custom Depth / Custom Stencil）

- 「特定メッシュだけアウトラインの対象から除外する」または「特定メッシュだけに限定する」ためのロジック:
  1. Scene Texture ノードを2つ追加し、それぞれ ID を **Post Process Input 0**（通常のシーン）と **Custom Depth** に設定
  2. 両者を If ノードの A/B に接続。「A（Scene Depth）と B（Custom Depth）」の比較で分岐（この If の A/B に何を渡すかで動作が反転する。動画内表現は多少崩れているため機構の解釈は文脈からの補完※推定）
  3. メッシュ側で **Render Custom Depth Pass** をオンにすると、そのメッシュだけ If の判定結果が変わり、アウトライン対象から除外（デフォルト設定）またはアウトライン対象に限定（後述の Flip）される
- 別アプローチとして、キャラクター専用の「Overlay マテリアル」（動画内で "outline boil" と呼ばれる、輪郭が揺らぐアニメーション付きのライン表現。別チュートリアル由来でこの動画では移植利用のみ）をキャラクターメッシュの **Overlay Material** スロットに設定する方法も紹介。ただし、この Overlay 方式は**ジオメトリに依存するため、ブロッキーなメッシュでは綺麗に出ないことがある**という制約が語られている。一方、ポストプロセスのシルエットベースのアウトラインはメッシュ形状に依存しにくいという比較がされている

## アウトラインロジックの反転（Flip outline logic）

- 動画終盤、上記 Custom Depth 分岐の **If ノードの2つの入力（Scene / アウトライン適用結果）を入れ替える**ことで、デフォルト動作を反転できる、と説明
- 反転前（デフォルト）: 環境全体にアウトラインが付き、Custom Depth を有効にしたメッシュだけ除外される
- 反転後: 何もアウトラインが付かない状態がデフォルトになり、**Custom Depth を有効にしたメッシュだけにアウトラインが付く**（＝「キャラクターだけに輪郭を付けたい」ような用途向け）
- 反転後は元のアウトラインより細く見えるケースがあるため、`OutlineSize` を 2〜3 程度に個別調整する運用が提案されている

## 新規性のある技術情報（既存ドクトリンとの比較）

`materials_technique_doctrine.md` には Post Process Volume / Substrate に関する記述はあるが、**ポストプロセスマテリアルでの法線バッファ・深度バッファベースのエッジ検出手法そのものは未収録**。`fx_technique_doctrine.md` の「画面全体演出は Niagara と分離、MPC+マテリアルインスタンス1枚で実装可」という既存知見と方向性は一致するが、本動画は MPC（Material Parameter Collection）ではなく **Material Instance のパラメータ調整**でチューニングしている点が異なる（Post Process Volume の配列に MI を直接アサインする構成）。

以下の点は doctrine への追記候補になりうるが、**doctrine 本体への追記要否は Fable 判断待ち**とする:
- View Size によるオフセット正規化（解像度非依存化）という定型パターン
- Custom Depth Pass を使った「特定メッシュだけポストプロセス効果から除外/限定する」汎用テクニック（アウトライン以外の画面全体エフェクトにも応用可能な汎用パターンの可能性）
- Post Process Materials 配列の**順序が描画順に影響する**という UE の挙動

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名・パラメータ名の一部（特に閾値パラメータの正式名称、If ノードの A/B 判定方向の言い回し）は音声認識の崩れにより文脈から復元しており、**断定できない箇所は本文中に「※推定」と明記**した
- 実際のノードグラフ画面は視聴していない（transcript ベースの要約のため、接続の視覚的な確認はできていない）。特に「Separate character outline」章と「Flip outline logic」章の境界は、チャプターメタデータの秒数と字幕内容を突き合わせて推定したものであり、動画側の章区切りと本ノートの節区切りが完全に一致しない可能性がある
- Cel-shading の具体的なノード構成は「別動画（本ノート未確認）」に依存しており、本ノートには含まれていない
