# 学習ノート — UE5 Niagara Trail VFX

- ソース: https://www.youtube.com/watch?v=mE5lmlGNaYA （5:38）
- 視聴日: 2026-07-09 / 字幕種別: **英語手動字幕**（`en.vtt`、標準WEBVTT形式）
- 関連ノート: [CoFmCf4z3X0_light-streak-niagara.md](CoFmCf4z3X0_light-streak-niagara.md)（Sprite Renderer + Pivotオフセットによる軽量ストリーク代替）。本ノートは対照的に**Ribbon Renderer本流の作り方**を扱う。ドクトリン既存記述「トレイル/光の筋: SpawnPerUnit+RibbonWidth直指定+Screen facingが最小形」は骨組みのみで、マテリアル構築の中身までは書かれていない。本動画はその**マテリアル側の作り込み**を補完する内容

## 概要

汎用トレイルエフェクトの作り方を、マテリアル構築 → Niagara System構築 → 応用例（キャラ/動くメッシュへの適用、Component Rendererでのデモ）の3段構成で解説。テクスチャは水の法線マップ（Water Normal Texture）を流用し、単純な形状マスクだけでなく歪み・屈折・時間経過での色変化まで作り込む。素材はNiagara公式サンプルにもあるEpic提供の水テクスチャ。

## 技術詳細

### 1. マテリアル基本設定

- Blend Mode: **Translucent**、Shading Model: **Unlit**、**Two Sided** にチェック（通常のトレイル/半透明マテリアルの定型）

### 2. 歪み（Distortion）— 水法線テクスチャ2枚のブレンド

- トレイル用テクスチャを2枚用意（本編では水の法線テクスチャを流用、"trail one"/"trail two"と呼称）
- 歪み生成には**別途、水の法線テクスチャをもう1系統**使用。速度・方向を変えた2枚をPannerで流し、それぞれのRGチャンネル値をBlendして合成（ノイズテクスチャでも代替可、と言及）
- 合成結果を**係数倍で歪み強度を制御**: ×0.2で標準、×1.0にすると形状が完全に崩れるほど強すぎる、最終的に×0.1程度に調整（弱めが実用値という判断過程を明示）
- この歪み値をトレイルテクスチャのUVオフセットとして加算 → 2枚それぞれ別速度でPannerし「trail one」「trail two」の2レイヤーを得る

### 3. Opacity（不透明度）

- trail one + trail two をAdd、それぞれ別の強度係数を設定
- **Dynamic Material Parameter**でPower値（指数）を外部化し、Niagara側から不透明度の「表示範囲（display area range）」を制御可能にする設計（＝カーブでトレイルの残り方・フェード形状を時間軸操作）
- 結果に**シンプルな形状マスク**（テクスチャの各チャンネルを使い分けて構成）を乗算
- さらに**Particle Colorのα**と**Depth Fade**を乗算して最終Opacityとする

### 4. 屈折（Refraction）— Opacity流用

- Refraction入力に、**Opacity部分の値をLerpのAlphaチャンネルとして使う**構成: Lerp(A=1, B=1.16, Alpha=Opacity)
- B値を1.16程度に上げることで屈折効果がより明確になる、と実演（値が1に近いほど無屈折、B値を離すほど歪んで見える屈折表現になる原理）

### 5. Emissive Color — Hue Shift + ライフタイム駆動の色変化

- trail one色 = Particle Color × trail one形状マスク、trail two色も同様に算出
- **Hue Shift**ノードの入力に**Particle Relative Time**（0=誕生時、1=消滅時に正規化されたライフタイム値）を接続し、寿命経過に伴って色相が自動変化する仕組み（例: 青→赤）
- trail two側の色を×0.5してtrail oneより弱める（2レイヤーのブレンドに「層」を持たせる意図、と明言）
- trail one色 + trail two色 をAddしてEmissive Colorとする

### 6. Niagara System構築

- **Ribbon Renderer**を使用、上記マテリアルを適用
- **Life Cycle Mode = Self**
- Particle Spawn: **Spawn Rate**（連続生成）または**Spawn Per Unit**（移動距離ベース生成）のどちらも使えるが、**トレイル効果では通常Spawn Per Unitを使う**、と明言
- Initialize Particle: Lifetime = 2
- **Ribbon Width Mode = Direct Set**、値100
- Particle Update:
  - **Color**モジュール（Scale Colorではなく）を追加し**Curve選択**モードに → 時間経過で色が変化するベースカーブを設定（例: 青→赤）
  - 続けて**Scale Color**モジュールも追加し明るさ倍率5倍に設定（Colorモジュールとは別に輝度だけ底上げする2段構成）
  - Scale Alphaはデフォルトのテンプレートカーブのまま
  - **Dynamic Material Parameter**を追加し、マテリアル側で仕込んだPower値をカーブで0.5→1.5に駆動（上記「Opacityの表示範囲制御」を寿命内でアニメーションさせる）

### 7. 応用デモ（Component Renderer）

- 別の動画（本チャンネルの前作、URL未特定）と同じ手順として、**Component Renderer**でNiagara Systemを選択し、動くメッシュ/キャラに追従させる構成を簡易実演
- デモ用に Spawn Rate=10、**Curl Noise Force**（1000〜2000）を追加してコンポーネントをランダムに動かし、トレイルの見え方を確認
- 注意点: **Lifetime設定が必須、またはKill Particlesを無効化する**必要がある（移動中にパーティクルが寿命で消えるとリボンが途切れるため）

## 新規性のある技術情報（既存ドクトリンとの比較）

- ドクトリンの「トレイル/光の筋」項は骨組み（SpawnPerUnit+RibbonWidth直指定+Screen facing）のみで、マテリアル構築の詳細は未収録。本動画は以下の**マテリアル側パターン**を補完:
  - 法線テクスチャ2系統（速度・方向違いPanner）のRGチャンネルブレンドによる歪み生成 → 係数で強度制御（×0.2が標準、×1.0は崩壊レベルという実測基準値）
  - **Opacityの値をそのままRefraction用Lerpのアルファに再利用**する省ノード設計（新規マテリアルグラフを作らず既存計算を転用する設計判断。h-gp4l1oIbUノートの「エッジ効果を複製してインテリアを作る」設計思想と同系統の転用パターン）
  - **Particle Relative TimeをHue Shiftに直結**し、追加ロジックなしで寿命に応じた色相変化を実現する最小構成（Scale Colorのカーブでの色変化とは別に、Hue Shiftという専用ノードでのアプローチ）
  - **Dynamic Material ParameterでPower(指数)値を外部化し、Niagara側のカーブでOpacityの減衰形状を時間駆動**する設計（ドクトリンの「Dynamic Material Parameterも同じ（一度だけ=Spawn、継続=Update）」原則の具体例として、Particle UpdateでのDMPカーブ駆動という実例を追加）
- Spawn Rate vs Spawn Per Unitの使い分けが「トレイルでは基本Spawn Per Unit」と明言されている点は、ドクトリンの一行記述を補強する一次情報

## SCRAP BLITZ UEへの応用メモ

- **武器軌跡（メレー攻撃の斬撃跡・薙ぎ払い）**: Ribbon Renderer + Spawn Per Unit + Color/Scale Color 2段構成 + Hue Shift(Particle Relative Time) の組み合わせは、METEO等の攻撃モーションに追従する武器軌跡として直接転用可能。攻撃の始点で明るく、終点にかけて色相が変化しつつフェードする挙動は「一撃の余韻」表現に向く
- **移動トレイル（ダッシュ・ノックバック・被弾後の高速移動）**: Component Renderer + Curl Noise Force のデモ手法自体は装飾目的だが、「動くアクターにNiagara Systemをアタッチしてリボンを引かせる」構成はキャラの高速移動演出（ダッシュ攻撃・吹き飛び軌跡）にそのまま流用できる。Kill Particles無効化 or 十分なLifetime確保、という罠は移動トレイル実装時に必ず踏むポイントなので流用時に注意
- **屈折の省ノード技（Opacity値をRefraction用Lerpに再利用）**は、OCジェムやエネルギー系VFXの「歪みつつ光る」表現に低コストで応用できる可能性がある。新規ノードを増やさず既存Opacity計算を転用する設計思想は、他のSB VFX（Pickupマグネット演出等）でもノード数削減の参考になる
- Dynamic Material ParameterでPower値をNiagara側カーブ駆動する構成は、SBのテレグラフ演出（AOE円の不透明度アニメーション）にも応用余地がある既存パターンの具体例として参照可能

## ソースの限界

- 英語手動字幕ではあるが、話者の説明が簡潔で「なぜその数値か」の理由付けが薄い箇所が多い（例: Refractionの1.16という値、Curl Noise Forceの1000〜2000という範囲は「見栄えのため」程度の説明にとどまる）
- 実際のノードグラフ画面は視聴しておらず、字幕ベースの要約のみ。特に「形状マスクの具体的なチャンネル構成」「Blendノードの具体的な演算方法（Overlay/Screen等）」は字幕からは判別不可能で、実装時はUE実機での再現検証が必要
- 「前作（Component Rendererの基本的な使い方）」への参照があるが、そのURLは字幕からは特定できず、本ノートの対象外
