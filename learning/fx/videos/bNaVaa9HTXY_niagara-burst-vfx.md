# 学習ノート — UE5 Niagara Burst VFX（花火・手榴弾破裂編）

- ソース: https://www.youtube.com/watch?v=bNaVaa9HTXY （14:14）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\scratch_tmp\bNaVaa9HTXY.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [h5pTEnXjZuo_spark-burst-vfx.md](h5pTEnXjZuo_spark-burst-vfx.md)（同じ「バースト」系だが、あちらは**AttributeReader（SpawnParticlesFromOtherEmitter系）でvelocityを継承する新方式**が主題。本動画は**メッシュ死亡イベント（Death Event）から複数エミッタを連鎖スポーンする旧来型カスケード構成**が主題で、手法として対照的）

## 概要

花火・手榴弾（firecracker/grenade）を想定した「メッシュが弾け飛んで着地する」バースト演出の作り方。中心となるのは**メッシュ粒子（円柱=firecracker代用）をSpawn Burstで100個飛ばし、各粒子の死亡（Death Event）をトリガーに flare / fireball flipbook / glow / spark / spark_long / confetti という6種のダウンストリームエミッタを連鎖スポーンする**というカスケード構成。マテリアルは前動画（言及のみ、URL不明）と共通の使い回しで、noise texture の offset/power 制御によるマスクで形状バリエーションを作る点が特徴。

## 技術詳細

### Step 1: メッシュバースト本体（firecracker代用の円柱）

- Mesh Renderer を使うエミッタ。ソースを円柱メッシュにリネームし、Loop Behavior = Once
- Spawn Burst: count=100、Lifetime = ランダム 0.3〜0.9
- 色は変更せず、メッシュデフォルト色のまま
- Scale Mesh Size: X/Y=0.1〜0.2、Z=0.5（円柱を縦に伸ばして見た目を整える）
- Shape Location = **Sphere**、radius=30（発生源を球状に散らす）
- Initial Mesh Orientation = ランダム回転
- **Velocity in Cone**: angle=120°、speed=500〜1500（doctrineの「Velocity from Point」とは別モジュール。円錐状に指向性を持たせつつ拡散させる）
- Particle Update: Mesh Rotation（Random Vector）、Scale Mesh Size（任意で拡大縮小）
- Gravity Force: デフォルト値だと落下がほぼ見えないため **-2000〜-1000 まで強める**必要があった（※動画内で2回言及される再現性のあるハマりどころ）

### Step 2: Death Event による連鎖スポーン（本動画の核心構造）

各ダウンストリームエミッタは共通して以下の手順で作る:
1. Emitter を新規作成 or 複製
2. Event Handler を追加、Execution Mode = **Spawn Particle for [Source] Death Event**
3. Source Emitter = Step1 のメッシュバーストエミッタを指定、Receive = Death Event
4. Spawn Number（1粒 or 数粒）を設定

これは doctrine「親子連鎖」節が言う **旧来型の Death Event + IDs 方式**そのもの。同じ「親子連鎖」でも [h5pTEnXjZuo] が示した AttributeReader（Spawn/SampleParticlesFromOtherEmitter）とは異なり、**本動画では velocity 等のソース属性は継承せず、単に「死亡位置に新規パーティクルを1個生む」というトリガー用途に限定**している。doctrineには「新推奨形」しか書かれていないため、**旧方式の具体的な組み方（Execution Mode選択・Source Emitter/Receive設定）**を補完する情報として価値がある。

### Step 3: Flare（閃光、1粒・極短命）

- Spawn Number = 1、Lifetime = 0.1〜0.15（バースト瞬間の閃光なので極短命）
- User Color（デフォルトは赤寄り、バースト感に合わせた色）
- Scale Color: テンプレートカーブ、ピーク値を **5** にして明るく
- Scale Sprite Size: テンプレートカーブ流用だが**開始値を0にしてはいけない**（0だと最初のフレームで見えなくなる）、ピークは5程度
- 回転はランダム

### Step 4: Fireball（フリップブック爆発、6x6）

- マテリアルは flipbook（fireball）、SubUV = 6行6列（36フレーム）
- Sub UV Animation で Start/End Range = 0〜35
- Lifetime = 0.1〜0.2（アニメーション再生速度に直結、短いほど速い展開）
- Sprite Size = 50〜100、Scale Color/Scale Sprite Size は同様のテンプレートカーブ（ピーク5、開始0.5→終了1）
- 回転ランダム

### Step 5: Glow（同フリップブックの複製、smoke 8x8）

- Step4を複製し、マテリアルを smoke（8x8 SubUV）に差し替え、Sub UV Animation の End を 63 に修正
- サイズを2に、Alpha を **0.05 → 0.1** に弱めて「淡いグロー/煙の層」として重ねる（単体では暗すぎたため調整）
- これは doctrine「Additive2系統並列」に近いが、**同一形状のフリップブックを2枚（メイン爆発+弱いグロー/煙）重ねる**という具体パターンとして新規

### Step 6: Spark（火花、5粒）

- マテリアルをフレア系グローマテリアルに戻す
- Spawn Number = 5、Lifetime はランダムでやや長め、色はより強く（Scale Color ピーク 100）
- Velocity from Point: speed 1000〜2000
- Size = 1〜2
- Scale Sprite Size は **X/Y非対称カーブ**: Y軸は開始5→終了0（急減衰で細く消える）、X軸は開始1→終了0
- Gravity Force -2000〜-1000、**Aerodynamic Drag** 追加、Initial Mesh Orientation 追加
- **Sprite Alignment = Velocity にすると Facing Mode がデフォルトのままだと全粒がカメラを向かなくなり見た目が破綻する → 明示的に Facing Mode = Face Camera に設定する必要がある**（doctrine未収録のハマりどころ。Alignment=VelocityとFacing Modeの組み合わせ依存関係）

### Step 7: Spark Long（尾を引く火花）

- Step6を複製、Lifetime を短く、Velocity speed を 1500〜3000 に強化
- Scale Sprite Size: Y軸をキー0.5時点で0.1まで落とし、最終的にY軸スケールを2に（＝発生直後は太く、すぐ細く長く伸びる形状変化）
- Gravity を弱め（-1000〜-500）、Aerodynamic Drag は不要
- **Curl Noise Force** 追加: 強度100〜200、frequency=25、pan noise field=(0.5, 0.5, 1)
- Facing Mode = Face Camera（Step6と同じ理由）

### Step 8: Confetti（紙吹雪/破片）

- マテリアル差し替え、Spawn Number=5、Lifetime=0.8〜1.5
- User Color、Sprite Size=5〜25、ランダム回転
- Velocity from Point: speed 1000〜2000
- Particle Update では色は変えず、Scale Sprite Size のみ 1→0、Rotation と Aerodynamic Drag を追加（自然な落下・回転）
- Gravity -2000〜-1000
- **Dynamic Material Parameter を2つ追加（Offset と Power）**: confetti マテリアルの noise mask をこの2値で駆動し、**ランダム値を入れることで1枚のマスクマテリアルから異なる紙吹雪形状を量産**（[h5pTEnXjZuo]のSpark Burstノートには無い、doctrine「Erosion定型」のnoise→power→opacity構造を**パーティクルごとのランダム形状バリエーション**に応用した具体例）

### 補足: 大規模爆発への拡張

動画終盤で「より大きな爆発が必要なら異なるフリップブックマテリアルに差し替えるだけで、原理は同じ」と言及（詳細な手順説明なし）。

## 新規性のある技術情報（既存ドクトリンとの比較）

- **Death Event ベースの旧来型カスケード（Execution Mode = Spawn Particle for [Source] Death Event）の具体的な組み方**: doctrineの「親子連鎖」節はAttributeReaderを新推奨形として言及するのみで、旧方式のUI操作手順が欠けていた。本動画がそれを補完する
- **Alignment=Velocity と Facing Mode=Face Camera の依存関係**（未設定だと粒子がカメラを向かず見た目が破綻する）は doctrine 未収録のハマりどころ
- **メッシュパーティクル（Mesh Renderer）を弾（firecracker代用）として使い、その死亡位置から複数のスプライト/フリップブックエミッタを連鎖スポーンする**構成は、doctrineの「1粒バースト+カーブ駆動の器」原則と近いが、**"物理的に飛ぶメッシュ" 自体をトリガー源にする**点で [h5pTEnXjZuo] の「不可視の方向供給源」パターンとも異なる第三の設計
- **フリップブック2層重ね（メイン爆発6x6 + 弱いグロー/煙8x8）**は doctrine「Additive2系統並列」の概念を具体的なフリップブック演出に適用した実例として新規
- **Dynamic Material Parameter（Offset+Power）でパーティクルごとに noise mask をランダム駆動し、1マテリアルから形状バリエーションを作る**手法は doctrine「Erosion定型」の応用パターンとして新規
- Curl Noise Force + Drag の組み合わせは [h5pTEnXjZuo] と同一パターンの再確認（新規性なし、既知パターンの裏付け）

## SCRAP BLITZ UEへの応用メモ

- SP技のヒットエフェクトやオブジェクト破壊演出で「弾け飛ぶ破片メッシュ（Mesh Renderer）を死亡イベント源として、着地・破裂位置に火花/煙/紙吹雪的なスプライト演出を追加スポーンする」という構成は、**ブロック破壊やGasCanister爆発の演出強化**に転用できる。既存の DrawDebug 仮実装から Niagara 本実装へ移行する際、この「メッシュ+Death Eventカスケード」パターンは実装難度が低く着手しやすい
- Alignment=Velocity のハマりどころ（Facing Mode要明示設定）は、既存の光の筋・ストレッチ系エフェクト実装時に事前確認事項として記録しておく価値がある
- Dynamic Material Parameter によるランダム形状バリエーションは、OCジェムのようなインスタンス量産系エフェクトで「同じマテリアル1枚から見た目の単調さを避ける」用途に応用可能（現状のOCジェムFresnelシェルの改善検討時に候補として検討価値あり）
- Gravity Force の値がデフォルトだと視覚的に不十分で-1000〜-2000程度まで強める必要がある、という実測値は、今後の落下物演出（破片・紙吹雪系）のパラメータ初期値の参考になる

## ソースの限界

- 英語自動字幕のみで手動字幕なし。数値パラメータ（Velocity in Cone角度「120°」、speed「500〜1500」、Gravity「-2000〜-1000」、Curl Noise「100〜200」「frequency 25」等）は音声認識のブレを含む可能性があり、実装時は UE 実機での再検証が必要
- 実際のノードグラフ・モジュールスタックの画面は視聴しておらず、transcript ベースの要約のみ。特に「Dynamic Material Parameter の Offset/Power がマテリアルグラフのどのノードに接続されるか」は具体的な配線が不明
- 動画冒頭で言及される「前動画（同じマテリアル・テクスチャを使う動画）」自体は本ノートの対象外で、テクスチャ/マテリアル作成の詳細な手順は含まれていない
- 「Glow」エミッタと呼ばれるステップが実質的には smoke フリップブックの弱いレイヤーであり、doctrineでいう典型的な「グロー勾配（Divide小値・Fresnel）」とは異なる意味で使われている点に注意（字幕上「glow」という単語がそのまま使われているが、実装は別物）
