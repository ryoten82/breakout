# 学習ノート — UE5 Niagara Shadow Smoke VFX

- ソース: https://www.youtube.com/watch?v=l_V_ZAS_eqo （9:21）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ**（`--list-subs` で手動字幕は存在しないことを確認済み。ノード名・数値は音声認識ベースのため誤認識の可能性あり、該当箇所は「※推定」と明記）
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\l_V_ZAS_eqo.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: なし（本動画内で他動画への言及はあるが URL 未特定。マテリアル自体は「aura」「firecracker」等の過去動画の使い回しと説明されるのみ）

## 概要

キャラクターや静的メッシュに**アタッチする「影の煙（shadow smoke）」エフェクト**を、5 エミッタ構成の Niagara システムで作るチュートリアル。マテリアルは全て過去動画からの流用（新規マテリアル解説は無し）で、本編の主眼は**複数エミッタの役割分担**と**アタッチ方式の切り替え（Skeletal→Static→Shape）**、および**力（Force）モジュール群の組み合わせ**にある。

## 技術詳細

### マテリアル構成（既存動画からの流用、簡易確認のみ）

4 種のマテリアルを使い分ける：
- **aura**: Time + Dynamic Material Parameter で歪みアニメーションを駆動、マスクで形状を作り Emissive/Opacity/Refraction を設定
- **paper**: 過去の「firecracker」動画と同一マテリアルを流用
- **shadow swirls**: **フリップブック（Flipbook）テクスチャ**を使用し、alpha チャンネルで煙の拡散アニメーションをシミュレート
- **smoke**: 煙テクスチャ 1 枚のみのシンプル構成

（各マテリアルの内部ノード接続は本動画では詳細解説されず「過去動画と同じ」とスキップされる）

### エミッタ構成（5 エミッタの役割分担）

| エミッタ | マテリアル | 役割 |
|---|---|---|
| aura | aura | 歪みオーラ本体。Life Cycle = Self / Mode = Once |
| swirls | shadow swirls | 煙の渦・拡散表現。Spawn Rate 100、Scale 1→3（拡散を模す） |
| spark | デフォルトスプライト | 火花。Velocity Align、Vortex Force で渦運動 |
| dust | paper | spark と同一設定だがマテリアルのみ paper に差替え、より大きく暗い粒子 |
| smoke / big smoke | smoke | グロー煙 2 種。big smoke は smoke よりサイズ大 |

- **Life Cycle = Self + Mode = Once + User Parameter で持続時間制御**: パーティクルシステムの寿命自体をユーザーパラメータで外部制御することで、バフ/デバフのような「一定時間だけ発動する状態エフェクト」を表現。Loop Duration を 1 秒等に設定すればその時間で自動終了する
- **Spawn Rate をエミッタの Loop Duration に応じて漸減させる**: エフェクト終了間際に生成パーティクル数を自然に減らし、唐突に消えるのではなく「収束していく」見た目にする（spark エミッタで使用、と説明）
- **SubUV アニメーションの部分利用**: swirls エミッタのフリップブックは End Frame を **35**（※推定）に制限し、テクスチャ全体のうち「まだ拡散しきっていない前半部分」のみを使用。後半（既に十分拡散した部分）は絵として不要なため切り捨てる。一方 smoke エミッタは完全なループ（Start/End = 0〜63）を使用 — **同じ SubUV フリップブックでも「エフェクトの見た目に必要な区間だけを End Frame で切り出す」という使い分け**
- **Scale Sprite Size by Speed**: 速度に応じてスプライトサイズを動的スケール（Min/Max を Speed の低/高にそれぞれ割り当て）。spark エミッタで使用

### Force モジュール群の組み合わせ（spark/dust エミッタ）

- Acceleration Force：XY 軸は -10〜10、Z 軸は 500〜800（※推定）の範囲でランダム。これに**「時間経過で値が増加するカーブ」を乗算**し、パーティクル寿命に応じて力の強さを変化させる（＝寿命初期は弱く、後半で強く吹き上がる、といった時間依存の力の演出）
- Curl Noise Force / Random Force：同様にカーブ周波数 25（※推定）で乱流的な揺らぎを加える
- **Vortex Force**：ランダム値 100〜5000（※推定）＋ Random Axis で、粒子に渦状の回転運動を与える。既存ドクトリンの「稲妻=Curve Tension+Jitter」とは別系統の、力ベースの渦生成手法
- Aerodynamic Drag + Align Sprite to Mesh Orientation：デフォルト値のまま使用し、空気抵抗による自然な減速と、初期メッシュ方向へのスプライト整列を両立

### アタッチ方式の 3 段階切り替え（キャラ/静的メッシュ/任意形状への対応）

1. **Skeletal Mesh Location（表面サンプリング）**: Mesh Sampling Type を **Triangle** に設定して表面全体からスポーン。Bone/Socket サンプリングにすると特定のボーン位置からのスポーンに切り替わる、という使い分けが明言される。Preview Mesh を Set/Clear してエディタ内プレビューを切替可能
2. **Static Mesh Location への差し替え**: 静的メッシュにアタッチしたい場合は Skeletal Mesh Location モジュールを Static Mesh Location に置き換えるだけで同じ仕組みが機能する
3. **Shape Location（Cylinder 手動指定）**: メッシュそのものが無い/使いたくない場合の第三の選択肢として、Shape Location で円柱形状を手動指定し、Height を User Parameter で外部制御。武器（剣）にアタッチして「エンチャント効果」の演出例が実演される

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md`「キャラ付随」節には SkeletalMeshLocation の Spawn/Update 使い分けと全身グロー力技（Partitions+カプセル）が既に記載されている。本動画はそれを補完する形で以下が新規：

- **アタッチ手法を Skeletal→Static→Shape の 3 択として明示的に使い分ける設計**: 既存ドクトリンはキャラボーン追従の話に留まっていたが、本動画は「メッシュが無い場合は Shape Location で代替する」という**汎用アタッチ戦略の階層**を示している
- **Life Cycle Self+Once＋User Parameter Duration による時限エフェクト設計**: バフ/デバフの持続時間をパーティクルシステム自身のライフサイクルで表現するパターン。既存ドクトリンにはバフ/デバフの実装方法自体の記載がなかった
- **SubUV End Frame の部分利用**（フリップブックの「使える区間だけ切り出す」節約テクニック）は未収録
- **Spawn Rate を Loop Duration に連動させて漸減させる**「自然消滅」の演出パターンは未収録
- **Acceleration Force を時間カーブで乗算し寿命依存の力変化を作る**手法、および **Vortex Force モジュール**（ランダム強度+ランダム軸）は、既存ドクトリンの Force 関連記載（Solve Forces and Velocity の必要性のみ言及）より具体的な組み合わせ例として追記価値あり

## SCRAP BLITZ UEへの応用メモ

- **闇属性/影系の技演出への直接転用が可能**: 本動画のテーマそのものが「shadow smoke」であり、マテリアル構成（aura の歪み+shadow swirls のフリップブック拡散+smoke のグロー）は METEO の闇属性 SP 技や、敵の呪い/デバフ系エフェクトにそのまま応用できる構成。特に shadow swirls の「拡散する煙」表現は、闇属性攻撃の余韻や着弾後の残留エフェクトに向く
- **Shape Location（Cylinder）でのアタッチ**は、武器へのエンチャント演出としてそのまま METEO の武器強化バフ（SP 技発動時の武器発光等）に転用できる。メッシュ依存を避けられるため、武器メッシュの UV/ピボットを気にせず導入可能
- **Life Cycle Self+Once＋User Parameter Duration**のパターンは、本プロジェクトの GAS ベースのバフ/デバフ管理（GameplayEffect の Duration）と相性が良い。Niagara コンポーネント側の寿命を GE の Duration と同期させるだけで実装できるため、Detach/Destroy のタイミング管理コストを削減できる
- **5 エミッタでの役割分担（オーラ+渦+火花+ダスト+グロー煙×2）**は、ボス級の闇属性攻撃やフィールド全体を覆う大技の「見た目の情報量を積み増す」際の参考構成になる。ただし本プロジェクトは 2.5D 固定カメラのため、全エミッタをそのまま流用するのではなく画面に映える 2〜3 層程度への削減を検討すべき
- **Spawn Rate 漸減による自然消滅演出**は、既存の「ボス死亡 3 フェーズ演出」（freeze→explode→ring）のような時限系エフェクトの終わり方の参考になる可能性がある

## ソースの限界

- 手動字幕が存在せず英語自動字幕のみに依存。特に数値パラメータ（End Frame 35、Force 範囲 -10〜10/500〜800、Vortex 100〜5000、Curve Frequency 25、Height 用パラメータ等）は音声認識のブレを含む可能性があり、本文中で「※推定」と明記した箇所は実装時に UE 実機で再検証が必要
- 「これらのエミッタは基本的なものなのでゼロから作らない」と明言される通り、各モジュールの具体的なノード接続順序・パラメータの正確な意味は本動画だけでは完全に再現できない（過去動画依存の説明が多い）
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。マテリアルの内部構成（aura/paper/shadow swirls/smoke の各グラフ）は本動画内で詳細解説されないため、本ノートにも含まれていない
