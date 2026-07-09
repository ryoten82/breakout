# 学習ノート — UE5 Spark Burst VFX（多方向スパークバースト編）

- ソース: https://www.youtube.com/watch?v=h5pTEnXjZuo （5:29）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\scratch_tmp\h5pTEnXjZuo.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [R2-BsWb5Bqg_sparks-vfx-engine-comparison.md](R2-BsWb5Bqg_sparks-vfx-engine-comparison.md)（同じスパーク系だが単一 Emitter の velocity/stretch 構築が主題）。本動画は前作（1方向1粒バースト動画、URL 未特定・本編内で言及のみ）の発展編で、**2つの Emitter を親子連携させる多方向バースト**が主題

## 概要

前作で作った「各方向に1粒だけ飛ばすシンプルなバースト」を土台に、**Spawn Particles from Other Emitter + Sample Particle Attributes from Other Emitter** を使って、その方向情報を継承しつつ大量のパーティクルを飛ばす「多方向スパークバースト」を作る動画。最終的に2つのバースト（1粒版と大量版）を重ねて完全な爆発表現にする、という構成。

## 技術詳細

### Step 1: ベースとなる単方向1粒バースト（テンプレートから複製）

- Burst テンプレートを複製し、Gravity Force を削除
- Velocity を Point 方向、値レンジ **100〜1500**
- Sprite Alignment = **Velocity**（velocity ベクトルに整列）
- Scale Sprite Size で X/Y を別々に設定：Y を大きく（5〜10）、X を小さめ（約2）→ ストレッチ形状の下地
- **Scale Sprite Size の X 軸カーブを「開始から増加→その後減少」の山型カーブに設定**（時間経過での伸縮アニメーション。Doctrine の「ストレッチ = Size Non-uniform + Velocity Alignment」は静的比率の話だが、本動画は**カーブで動的に伸縮させる**点が異なる）
- Particle Lifetime: 0.15〜0.25（短命）
- Particle Color + Intensity 100（明るく）でユーザー任意色

### Step 2: 新規 Emitter で「Spawn Particles from Other Emitter」

1. 新しい Emitter を作成し、**Spawn Particles from Other Emitter** モジュールを追加、Source Emitter に Step1 のバーストを指定
2. Fix Issue クリックで必要モジュール一式を自動追加
3. Sprite Renderer 追加、Initialize Particle で Lifetime 0.2〜0.5、Color は User Parameter 経由（レベル側から一括変更可能にする設計、Doctrine の User Param Binding パターンと合致）
4. Sprite Size は Random Range で設定

### Step 3: Sample Particle Attributes from Other Emitter — velocity 継承の仕組み（本動画の核心）

- 同モジュールで **velocity sampling はデフォルト無効**：無効のままだと新パーティクルは「ソース Emitter の粒の移動」に追従するだけで、ソース側の**velocity 値そのもの**は引き継がれない
- **Velocity Sampling を有効化**し、**Velocity Scale を 0〜1 のランダムレンジ**に設定 → ソース Emitter が「方向と速度の供給源」として機能し、そこから飛ぶ大量パーティクルが同方向に飛びつつ速度がランダムにばらける、という仕組み
- Spawn Count を 100 に増加 → 一部の粒がソース粒の動きに追従し、一部が追従しない、という中間状態を経て調整
- ソース Emitter 由来の Particle Color と Sprite Size もコピー（ただし Sprite Size は小さめに、Scale Alpha は 1 に調整）

### Step 4: 空力表現（Curl Noise Force + Drag）

- **Curl Noise Force** を追加し、バースト粒が全方向へランダムに漂う「空気抵抗」的な乱れを演出
- Curl Noise の強度を **Curve（0→1）+ Scale 1000〜2000** で時間変化させる
- 仕上げに **Drag（強度5）** を追加して減速させる
- Doctrine には Curl Noise / Drag の言及がなく、**バースト系パーティクルに事後的な乱流を足す**新規パターン

### Step 5: 仕上げの調整

- ソース Emitter（1粒バースト）自体の描画は非表示にし、2つ目の Emitter（多数粒バースト）のみ表示 → **1粒バーストを「見えない方向・速度供給源」として使い、視覚的には多数粒バーストだけを見せる**設計判断
- Random Position Offset（-10〜10）を追加し、発生源座標を散らして分布をより自然にする
- パーティクルサイズを少し拡大、Spawn Count を 200 に増量して最終形

## 新規性のある技術情報（既存ドクトリンとの比較）

Doctrine の「親子連鎖」節には AttributeReader（SpawnParticlesFromOtherEmitter/SampleParticlesFromOtherEmitter）が「ID 不要の新推奨形」として概念のみ記載されているが、本動画は**その具体的な使い方**を初めて厚く提供する：

- **Velocity Sampling を有効化 + Velocity Scale を 0〜1 のランダムレンジにする**ことで、「方向はソースから継承・速度はランダム化」という中間的な継承パターンを作れる（Doctrine には Sampling の on/off や Scale レンジの具体的な意味づけが未記載）
- **ソース Emitter を非表示にして「データ供給源としてのみ使う」**という設計判断（Doctrine の親子連鎖節は「二次破裂」の例のみで、本動画のような「不可視の方向フィールド」用途は未収録）
- **Scale Sprite Size の X 軸カーブを山型にして時間経過でストレッチを動的変化させる**手法（Doctrine の Stretch 定型は静的な Size Non-uniform 比率のみ）
- **Curl Noise Force + Drag の組み合わせでバースト粒に事後的な乱流を加える**パターン（Doctrine 未収録）
- **1粒バースト版と多数粒バースト版を"重ねる"ことで完全な爆発表現にする**という合成方針自体（Doctrine の「1粒バースト+カーブ駆動の器」原則とは別の、複数バーストのレイヤー合成という構成）

## SCRAP BLITZ UEへの応用メモ

- METEO の攻撃ヒットエフェクトやブロック破壊、剣戟系の火花は「小規模な打撃には1粒バースト、大ダメージ/クリティカルには多数粒バーストを追加」という**強度による表現の段階分け**にそのまま使える。Spawn Count や Velocity Scale レンジを UPROPERTY 化しておけば、通常ヒット/クリティカル/SP 技ヒットで同じ Niagara System の User Parameter だけ差し替えるバリアント量産が可能（Doctrine 「System 階層=監督」原則と合致）
- 「ソース Emitter を非表示にして方向供給源としてのみ使う」設計は、**ノックバック方向に沿った火花の飛散方向を1つの軽量 Emitter で決め、実際に見せる火花は別 Emitter で量産する**という構成に転用できる。既存の `R2-BsWb5Bqg_sparks-vfx-engine-comparison.md` の Velocity Aligned 手法と組み合わせれば、金属接触・剣戟の「方向性を持った火花の束」を安価に作れる
- ブロック破壊時の破片・火花演出では、Curl Noise + Drag による事後乱流が「砕けた破片が空気抵抗でバラける」表現に合う。ただし常時多数のヒットが発生する場面（連続コンボ等）では Curl Noise のコストに注意が必要（Doctrine「ボトルネックは大抵レンダリング側」の言明はあるが Curl Noise 自体のコストは未検証）
- 山型カーブによる動的ストレッチは、剣戟の斬撃火花や着弾スパークで「発生直後に伸びて、すぐ縮む」という一瞬の鋭さを演出するのに使えそうで、`djlnnPvFR0Q_sword-slash-vfx.md` 系の既存ノートと合わせて検討価値がある

## ソースの限界

- 英語自動字幕のみで手動字幕なし。数値パラメータ（Velocity レンジ「100〜1500」「250〜1000」、Curl Noise スケール「1000〜2000」、Position Offset「-10〜10」等）は音声認識のブレを含む可能性があり、実装時は UE 実機で再検証が必要
- 実際のノードグラフ・モジュールスタックの画面は視聴しておらず、transcript ベースの要約のみ。「Sample Particle Attributes from Other Emitter」内の具体的なモジュール項目名・UI 配置は字幕の言葉だけからは完全には特定できていない
- 前作（1方向1粒バーストの基本動画）自体は本ノートの対象外。Step1 の詳細な作り方が必要な場合は前作の別途学習が必要
- 動画中「[music]」表記区間は音声が BGM に埋もれて字幕が欠落しており、数値の言い直し等が発生している箇所（例: 04:03 付近の「Tweak the frequency and [music] other parameters」）は完全性が保証できない
