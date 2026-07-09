# 学習ノート — UE5 Niagara Magic Explosion Effect

- ソース: https://www.youtube.com/watch?v=gd-axfjbgp4 （13:12）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし・`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\gd-axfjbgp4.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [rEQKfQYUGDI_niagara-valorant-spike-explosion-effect.md](rEQKfQYUGDI_niagara-valorant-spike-explosion-effect.md)（同じ「爆発」系だが球体コア＋Sort Order Hint積層が主題）、[5XPRb87I63k_niagara-combine-burst-explosion-effect.md](5XPRb87I63k_niagara-combine-burst-explosion-effect.md)（既存エミッタ群を統合する工程が主題）。本動画は**前回動画で作ったマテリアルを流用した円柱（ピラー）状の爆発**で、球体コアでもエミッタ統合でもない、また別方向の構成

## 概要

前動画で作成済みのマテリアルを土台に、円柱メッシュを主役とした「魔法陣が立ち上るような柱状の爆発」を作る動画。核となるのは**ディゾルブ（消失）マテリアル**で、ストリーク状ノイズテクスチャ＋Dynamic Material Parameter で「じわっと消える」表現をマスク駆動で作り、それを円柱メッシュ・気流用の派生マテリアル・火花×2種（放射状／垂直ライン状）で積層する。球体コアでもエミッタ統合でもなく、**メッシュのディゾルブ＋WPO変位**が主軸という点で既存2本の爆発系ノートと構成が異なる。

## 技術詳細

### 1. ディゾルブ（消失）マテリアルの基本形

- Particle Color をベースに、Dynamic Material Parameter を追加して「色」と「消失の進行度」を外部制御できるようにする
- ストリーク状のライン（streak）テクスチャの **R チャンネルを Radial Gradient 系ノードに接続**し、そこに Dynamic Parameter で「マスクオフセット」の値を渡す（曲線 1→0（Z）、Base Reflect Fraction を負値（-0.3）に設定、マスク側も曲線 1→0（Z）——値の並びからは Radial Gradient Exponential 相当のノードを使っている可能性が高いが、ノード名自体は字幕から確定できず ※推定）
- Blend Mode = **Masked** に変更。テクスチャの見た目上の欠陥（消失パラメータ=1でも完全に消えない）に気づき、**マスク側に極小値（0.01）を加算するダミー定数**を挟んで補正するという「実演での失敗→即修正」の流れがそのまま示されている
- テクスチャに **Tiling=10** を設定し、消失パターンを細かくして見た目を改善

### 2. 円柱メッシュ「cylinder」エミッタ（爆発の主柱）

- Mesh Renderer + 円柱スタティックメッシュ + 上記マテリアル
- Spawn Burst、Mesh Scale Mode = Uniform、Uniform Scale = 5（メッシュを拡大）
- Dynamic Material Parameter を **Particle Update でカーブ駆動**し、上記マテリアルの exponent／base reflect fraction／mask offset を時間軸で変化させることで「柱が立ち上がってから消失していく」流れを作る。カーブのキーは 0.95 付近まで値を維持してから減衰させる設計で、**「消失が始まるまで一定時間ホールドする」**ための Key Data 調整が明示的に実演される
- System の **Loop Duration=7 秒**に設定。理由は「後で追加するエミッタの都合で、パーティクル自体の寿命（5 秒）より長く効果を持続させたいため」とはっきり説明されている
- Scale Color（Alpha）をカーブ 0→1、Scale Curve=5 で駆動
- Scale Mesh Size を Vector from Float 経由でカーブ制御し、X・Y チャンネル（幅方向）を「小さい値→大きい値」の曲線（Key Data=0.01 起点）で変化させ、柱が横方向にも膨らむ動きを追加

### 3. 「cylinderEdge」エミッタ（気流エフェクト・WPO 変位）

- cylinder エミッタを複製し、**新規マテリアル**を割り当てる別レイヤー
- 元のマテリアルから Step ノードを削除し、代わりに **World Position Offset（WPO）にノイズを直結**: Panner（Speed=1）でパンさせたノイズテクスチャを Dynamic Parameter で乗算し、そのままメッシュの WPO に接続 —— **UV やオパシティではなくメッシュ頂点座標そのものを揺らして「気流が渦を巻く」ような変位表現**を作る
- WPO に渡す強度は Random Range Float（200〜500）で個体差を持たせる
- Blend Mode = **Additive**、Shading Model = **Unlit** に変更
- Opacity は Particle Color の Alpha チャンネル × ノイズテクスチャで制御。Alpha 値は 0.01 程度の小さい値に調整し、Scale Color（Alpha）をカーブ（Key Data=0.5 前後）で駆動して「徐々に消えていく」気流を演出
- 混同防止のためエミッタ名を **「cylinder」「cylinderEdge」** にリネーム（命名整理の実演）

### 4. 「spark」エミッタ（放射状の火花）

- 新規エミッタ、Spawn Burst、Spawn Count=100
- Shape Location = **Cylinder**。**静的メッシュの実寸に合わせてシェイプの半径・高さを手動算出**する手順が明示的に実演される: メッシュの見た目サイズが 400×400×1,000 相当 → 5倍スケールしているため実効半径は約 1,000 → シェイプの Height=5,000 に設定。円柱の pivot が中心にあるため、**上方向に 2,500 オフセット**して底面基準に補正
- Surface Only を有効化（体積内ではなく表面からのみ放出）
- 色は **User Parameter** で全エミッタ共通化し、1箇所の変更で cylinder／cylinderEdge／spark 全ての色が連動して変わるようにする。ただしエミッタごとに透明度は異なるため、Alpha は各エミッタの Scale Color 側で個別調整（本エミッタは 0.03）
- Curl Noise Force と Random Range Float を組み合わせて、火花に有機的な乱流を与える（詳細パラメータは動画後半が早送りされ字幕からは確認できず）

### 5. 「sparkle」エミッタ（明滅する粒火花・spark からの複製）

- spark エミッタを複製し、**Scale Color をループするカーブ**（0→1 を周期的に繰り返す曲線、Scale Curve=100）で駆動して明滅させる
- Scale Sprite Size もカーブ駆動（0→1→0 の山型）、Sprite Size Mode = **Random Uniform（20〜100）**でサイズにばらつきを持たせる（当初大きすぎたため後で縮小調整）
- Lifetime を Random（0.5〜1.5 秒）に設定
- **Spawn Time=4.7 秒**に遅延させ、「円柱の寿命が尽きる末端付近で改めて火花が湧く」タイミングに合わせる。これは cylinder エミッタの Loop Duration=7 秒設定の意図（後続エフェクトのための余白）と直接連動する調整

### 6. 「line spark」エミッタ（垂直ライン状の火花・spark からの複製）

- spark エミッタをさらに複製し、Random Range Vector（Non-uniform）で **Y 成分だけ 1,000〜2,000 の範囲**にストレッチし、縦に伸びた線状の粒に変える
- デフォルトのスプライトは常にカメラ正対（ビルボード）になるため、意図せず線が回転して見える問題が発生。**Particle Spawn で Sprite Alignment を Custom 設定し、Facing Vector の対象チャンネルを 1 に指定**することで「常に垂直を保つ」向きに固定する
- 最終的にレベルに配置して結果を確認するところで動画終了

## 新規性のある技術情報（既存ドクトリンとの比較）

- **ノイズパンによる WPO（World Position Offset）変位で気流を表現**する手法は doctrine・既存爆発系ノートともに未収録。既存ノートのノイズ活用はいずれも Opacity/Emissive 側（マスク・グロー用途）に留まっており、**メッシュ頂点そのものを動かす**という使い方は本動画が初出。SB2.5D では固定カメラのためメッシュ変位が視認しやすく、応用価値が高い
- **静的メッシュの実寸（幅×奥行×高さ、スケール後の値）からシェイプロケーションの半径・高さ・pivot オフセットを逆算する**という手順は、既存ノートの「Shape Location=Torus」（Valorant Spike）のような抽象的な形状選択とは異なり、**特定メッシュのシルエットに火花放出源を一致させる**という実務的なノウハウとして新規性がある
- **エミッタ複製を使った「本体寿命の終端に合わせた火花の遅延スポーン」**（sparkle の Spawn Time=4.7 秒を cylinder の Loop Duration=7 秒に合わせて調整）は、[uatId-qRZlw_niagara-magic-sphere-vfx.md](uatId-qRZlw_niagara-magic-sphere-vfx.md) の「他 Emitter の継続時間から自 Emitter のスポーンタイミングを逆算する」パターンと同系統だが、本動画は**3フェーズの継ぎ目**ではなく**単一エフェクトの前半と後半で見た目の密度を切り替える**という、より単純な時間差利用の実例
- **Sprite Alignment=Custom + Facing Vector チャンネル指定で、デフォルトのカメラビルボードを無効化し特定方向に固定する**手法は、[rEQKfQYUGDI] のスパーク（デフォルトのビルボードのまま使用）と対照的な調整で、縦方向に伸びた線状スパークを作る際の実務 Tips として記録価値がある
- ディゾルブマテリアル自体（ストリークテクスチャ×Radial Gradient 系マスク×Dynamic Parameter 駆動）は、doctrine の「Erosion 定型」（ノイズ→Power→Opacity）と機能的に近いが、**Blend Mode=Masked を使い、消失値=1でも完全消失しない不具合をダミー定数（0.01）加算で補正する**という具体的な落とし穴と対処は未収録

## SCRAP BLITZ UEへの応用メモ

- **円柱状に立ち上がって消えるディゾルブ演出**は、SP技発動時の「地面から魔法陣/エネルギー柱が立ち上る」フィニッシュ演出、あるいはボス出現時の演出に直接応用できる形状パターン。既存の球体コア型爆発（[rEQKfQYUGDI]）とは異なるシルエットのバリエーションとして選択肢が増える
- **ノイズパン×WPO による気流変位**は、GasCanister/Crate 爆発やボス撃破 explode フェーズの「衝撃波で空気が歪む」表現に安価に転用できる。Niagara側だけで完結し追加の専用マテリアル構築コストが低い
- **静的メッシュ実寸からシェイプ半径・高さ・pivot オフセットを算出する手順**は、SP技のエフェクトを特定の武器/キャラクターメッシュに正確に沿わせたい場面（例: METEO の武器から火花が噴き出す）で再利用できる実務手順として記録
- **本体エフェクトの後半にタイミングをずらして追加の火花を湧かせる**設計は、SP技の「発動→余韻」の間に画面が単調にならないようにする軽量な調整として、既存の Loop Duration 運用に組み込みやすい

## ソースの限界

- 英語自動字幕のみで手動字幕なし。認識誤りが多く（例: 「Niagara」→「nagra」、「Dynamic」→「damic」、「Mesh」→「MH」/「meas」、「Sprite」→「spr」/「sprit」、「Force」→「fors」）、特にマテリアルグラフのノード名（Radial Gradient 系の具体名、Step ノードの正確な置き換え内容）は本文中で「※推定」と明記した通り確度が低い
- 動画中盤の Curl Noise Force のパラメータ設定部分は「let's fast forward」として実質的に早送り・詳細説明省略されており、本ノートにも数値を含められない
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。特にディゾルブマテリアルの正確なノード接続順序、および WPO 変位の具体的な係数は実装時に UE 実機での再現・調整が前提
