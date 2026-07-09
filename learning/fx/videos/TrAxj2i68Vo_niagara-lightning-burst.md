# 学習ノート — UE5 Niagara Lightning Burst（6:17）

- ソース: https://www.youtube.com/watch?v=TrAxj2i68Vo
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（`--list-subs` で手動字幕0件を確認）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\fx\transcripts_tmp\TrAxj2i68Vo.en.vtt`（rolling caption形式、重複行をデデュープしてから抽出）
- 関連ノート: [4QF8sHC6HWo_lightning-crack-vfx.md](4QF8sHC6HWo_lightning-crack-vfx.md)（着弾クラック+グロー）／[GMeRJudxcbw_lightning-vfx.md](GMeRJudxcbw_lightning-vfx.md)（Mesh+WPOで1本の雷ボルトを造形、冒頭で「前回動画のバースト（radial系）に続く後編」と明言）／[NSM_hHHfprI_niagara-lightning-mesh-vfx.md](NSM_hHHfprI_niagara-lightning-mesh-vfx.md)（GMeRJudxcbwと同系統の差分ノート）／[BSSAZDT7CJQ_electric-burst-vfx.md](BSSAZDT7CJQ_electric-burst-vfx.md)（同じ「空間中の瞬間バースト」カテゴリだが手法は別系統）。本動画は GMeRJudxcbw が言及する「前回のバースト動画」の**候補**だが、GMeRJudxcbw側の実測値（Burst Count=3, Spawn Rate=5）と本動画の値（Spawn Count=25/75）が一致しないため断定はできない（同チャンネル・同シリーズの前段階である可能性が高いが未確定）

## 概要

6分17秒の短編チュートリアル。**空間中の1点から放射状に飛び散る、細長い個々の雷閃光スプライトの群れ**（爆発的なライトニングバースト）を作る。素材はEpic提供のフリップブックテクスチャ1枚（4種の雷形状を格納）のみ。マテリアル1枚+Niagara Systemエミッタ1つ（複製1つでサイズバリエーション追加）という最小構成。

## 技術詳細

### マテリアル
- フリップブックテクスチャは4種の雷形状を持つが、**アニメーション用途ではなく「Particle Random Value（0〜1）をFlip Book関数の入力に直結し、パーティクルごとにランダムな1形状を選ぶ」用途**に転用（アニメ再生ではなく静的ランダム抽選）
- ディストート効果（形状に揺らぎを加える処理、詳細な配線は語られず「distortに似た効果」とのみ言及）
- フリッカー（明滅）: **Random Time ノード（Sign, Constant, Bias, Scale の組み合わせ）で出力を0〜1にサイクルさせ、明滅のON/OFFを1つの値（0=明滅なし固定、1=明滅する）で切り替える**設計
- マスク: Step で作るコンポーネントマスクで雷の見える範囲を制御
- Lightning texture × Mask × Flicker → Particle Color の Alpha チャンネルへ
- Depth Fade を追加してOpacityに反映（環境との交差をソフトに）
- Emissive Color は Derive HDR from LDR 経由（既存ノート群と共通の定型）

### Niagara System
- Life Cycle = Self Infinite（プレビュー用、実運用時は Once + Loop Duration=1 に切替と明言）
- Spawn Burst: Spawn Count = 25
- Initialize Particle: Lifetime = Random 0.1〜0.7、Color = User Parameter（色をレベル側から一括制御可能にする定番パターン）
- Sprite Size: Random **Non-uniform**、Min値 X=100/Y=800、Max値=4600（X方向を絞ることで「細長い雷閃光」の見た目を作る）
- **Shape Location = Sphere（半径10という小さい値）** を追加
- **Velocity in Cone（Speed=1）を「実際の移動速度としてではなく、パーティクルごとの向き（Direction）を決めるためだけに」使用**——動画内で「速度そのものは要らない、方向の制御だけに使う」と明言
- Sprite Renderer: **Alignment = Velocity Aligned**（速度方向にスプライトを整列）、Facing Mode = **Face Camera**
- Cone の Axis を Top（Z軸）、値を **-1** にして上半球のみに発生させる
- **Pivot Offset（Sprite Renderer）の Y を 0 に変更** — デフォルトのままだと雷形状の中心から広がって見え「かなり奇妙」になるため、**雷形状の端（エッジ）を基準に広がるよう補正**。Angle=180
- Particle Update: Scale Color（Curveで大きめのスケール、明るさ強調）、Alphaも同カーブを流用、Scale Sprite Size（Curve、0〜1の間でも key=0.1の時点で既に値1に達する急勾配）、Sprite Rotation（Curveで-100〜100の範囲、「捻れ」演出）
- Dynamic Material Parameter 2つ: 1つ目=マスク（0→1のデフォルトカーブ）、2つ目=フリッカーON/OFF（1 or 0）
- **バリエーション量産**: エミッタを複製し、Scale Sprite Size のカーブ値をランダム0.5〜0.8に縮小、Spawn Count を25→75に増量するだけで「小粒で数の多い副次的な雷閃光」レイヤーが完成

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の電撃系記述、および [4QF8sHC6HWo](4QF8sHC6HWo_lightning-crack-vfx.md)（クラック）・[GMeRJudxcbw](GMeRJudxcbw_lightning-vfx.md)/[NSM_hHHfprI](NSM_hHHfprI_niagara-lightning-mesh-vfx.md)（Mesh+WPOの単一ボルト）・[BSSAZDT7CJQ](BSSAZDT7CJQ_electric-burst-vfx.md)（RGBAマスク選択+Diamond Gradient拡散のバースト）は既収録。本動画は**同じ「瞬間バースト」カテゴリだが、BSSAZDT7CJQとは全く異なる方式**で以下が新規:

- **Shape Location Sphere（極小半径）+ Velocity in Cone（Speed=1だが実速度として使わず方向決定専用）+ Sprite Renderer Alignment=Velocity Aligned の三点セットで、多数の平面スプライトを「発生源から放射方向を向く個々の閃光」として整列させる**手法。既存ドクトリンの「トレイル/光の筋」節や BSSAZDT7CJQ のバーストは、スプライトの向き自体は制御せず等方的に散らばるか、Face Camera のまま拡大するだけだった。本動画は**Velocityを移動でなく向き決定の道具として転用する**発想が新規（doctrineに未収録のVelocity活用パターン）
- **Pivot Offset（Sprite Renderer）を0にずらし「テクスチャ形状の中心でなく端を基準に広がらせる」**Tips。既存の [CoFmCf4z3X0_light-streak-niagara.md](CoFmCf4z3X0_light-streak-niagara.md) の「Pivot in UV Space を先端にずらす」技法と発想は同系統（軽量ストリーク代替）だが、あちらは単一スプライトの長さ方向の起点をずらすのに対し、本動画は**多数の velocity-aligned スプライトを同時に「エッジ起点で放射状に広がる」よう補正する**応用で、対象パーティクル数・用途（単発ストリーク vs 多数バースト）が異なる
- **Flip Book 関数を「アニメーション再生」ではなく「Particle Random Value駆動の静的ランダム形状選択」に転用する**パターン。既存ドクトリンにこの用途の明記はなく、BSSAZDT7CJQの「手法A（SubUV Flipbook+Particle Random Value→Animation Phase入力）」と近いが、本動画は Flip Book 関数（SubUVではない）を使っている点で実装ノードが異なる（※どちらも「ランダム形状選択」という設計意図は共通で、既存ドクトリンにはこの意図自体は明記されていなかった点が新規）
- **Random Time（Sign, Constant, Bias, Scale）で0〜1サイクルの出力を作り、1つの値でフリッカーのON/OFF切替を制御する**という具体的な明滅制御パターン。既存ドクトリンのフリッカー系記述には未収録
- Sprite Size を Non-uniform Random で Min(X=100, Y=800)・Max=4600 にする「細長い1本の閃光」の作り方は、既存の Mesh+WPO 系（GMeRJudxcbw/NSM）が static mesh の形状変形で同じ「細長いボルト」を作るのに対し、**スプライトのサイズ比だけで疑似的に同じ見た目を軽量に再現する**代替アプローチとして対比的な情報価値がある

## SCRAP BLITZ UEへの応用メモ

- METEO の SP 技や電撃属性ボスの「発生源から複数方向へ瞬間的に閃光が飛び散る」演出（着弾の瞬間や技発動の予兆フラッシュ）に、Shape Location Sphere + Velocity Cone（方向専用）+ Velocity Aligned Sprite の組み合わせはそのまま転用できる。Mesh+WPO 系（GMeRJudxcbw/NSM）より実装が軽量なため、多数同時発生させたい被弾フラッシュ・コンボ演出向き
- Pivot Offset で「エッジ起点の放射」を作るTipsは、既存の光の筋ノート（CoFmCf4z3X0）と合わせて「Sprite 1枚+Pivotずらし」系の軽量代替パターン群として整理でき、稲妻に限らず爆散パーツ・スパーク演出全般に応用可能
- Flip Book を静的ランダム抽選に転用する発想は、METEO の攻撃エフェクトで複数バリエーションのテクスチャを1枚に集約してドローコール/アセット数を節約したい場合に使える
- Random Time によるフリッカー制御は、被弾中の敵やダウン中キャラの明滅演出（既存のヒットフラッシュ表現）に流用できる可能性があるが、現状 SCRAP BLITZ UE のヒットフラッシュはマテリアル/ポストプロセス側の別実装のため、直接置き換えではなく参考手法として記録に留める

## ソースの限界

- 英語自動字幕のみで手動字幕なし。"distort" 効果の具体的なノード構成、フリップブック関数の入出力ピン名等は詳細に語られておらず、聞き取れた範囲の要約に留まる
- Sprite Size の Min/Max 値（X=100/Y=800、Max=4600）や Sprite Rotation のカーブ範囲（-100〜100 ※「-00 to 100」という字幕表記からの復元、-100の誤認識の可能性あり）は音声からの聞き取りで、UI上の実際の値と誤差がある可能性がある
- 実際のノードグラフ画面は視聴しておらず transcript ベースの要約のため、Dynamic Material Parameter のスロット番号対応やカーブの正確な形状は推定を含む
- GMeRJudxcbw が言及する「前回動画（バースト系）」が本動画と同一かどうかは、パラメータ数値の不一致（Burst Count 3/5 vs 25/75）により確証が持てず、本ノートでは「候補」止まりとして記録した
