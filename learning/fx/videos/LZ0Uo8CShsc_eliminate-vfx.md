# 学習ノート — UE5 Eliminate VFX（敵撃破コインエフェクト）

- ソース: https://www.youtube.com/watch?v=LZ0Uo8CShsc （8:31）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\LZ0Uo8CShsc.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: なし（本チャンネルの他動画への言及は本編になし）

## 概要

敵キャラクターを倒した際に発生する「コイン爆散→床に散乱」エフェクトの作成手順。タイトルの Eliminate は「撃破・退場」を指し、キャラクター本体を非表示にする処理とセットで実演される。メッシュはコインだが、他メッシュへの差し替えも前提とした汎用構成として説明される。

## 技術詳細

### 1. 基本セットアップ
- Mesh Renderer にコインメッシュを設定。Base Color 変更で色替え可能なマテリアル
- **エミッタを GPU Simulation に変更**（後段の Collision 計算をしやすくするためと明言）
- Life Cycle は Self / Once（バースト一発物）
- Spawn Burst Instantaneous = **1000**
- Initialize Particle: Size を **0.02** に縮小（デフォルトのコインメッシュは巨大すぎる）、Lifetime を **9〜10**（※推定）に設定 — エフェクトが完全に表示しきるまで寿命を長めに取る意図

### 2. カラーバリアント（金貨/銀貨）
- プリセット色を black/white の2種類用意し、**Random Integer** で選択 → 金貨と銀貨がランダム混在する結果になる、という実装

### 3. キャラクターへの付着とバースト方向
- **Skeletal Mesh Location** モジュールで **Sample Random Triangles**（キャラクターメッシュの三角形からランダムサンプリング）
- **Initial Mesh Orientation** でコイン初期回転をランダム化
- **Velocity From Point**: Speed はランダム 100〜500（※推定）。Velocity Origin は「単一ポイントだと不自然になる（Single position is bad）」という理由で、**Skeletal Mesh Location でサンプルした各三角形の位置**を Origin に使う設計 — 発生源を分散させることで「一点から爆発した」ように見えるのを避ける

### 4. 力学モジュールと「落ち葉」演出のためのカーブ設計
Particle Update に **Wind Force / Aerodynamic Drag / Align Sprite to Mesh Orientation** の3モジュールを追加し、これらの組み合わせで「木の葉が舞い落ちる」ような挙動を模倣、と明言される。

- **Aerodynamic Drag は Curve で制御**: NormalizeAge 序盤は小さい値 → 0.1 で 1（ドラッグ最大＝Velocity From Point のバースト力を急速に減衰）→ 0.3 でまた 0 に戻る（以降ドラッグ不要、重力のみ支配）
- **Gravity Force も Curve で制御**（Drag と対称形）: 0.3 までは効かず、0.3〜1.0 で 0 → 1 に増加。値はランダム -4000 〜 -3500（※推定）
- つまり **「バースト直後（0〜0.1）→ ドラッグ支配のふわつき期間（0.1〜0.3）→ 重力支配の落下期間（0.3〜1.0）」という3フェーズを、相補的な2本のカーブだけで単一エミッタ内に構成**している

### 5. 床衝突と姿勢補正
- Collision モジュールに **GPU Distance Field** を使用
- デフォルトの Particle Radius は小さすぎてメッシュが床にめり込むため、**Radius を 13（※推定）まで拡大**して補正。Bounce / Friction もコインらしい跳ね方になるよう調整
- 衝突後、メッシュの向きが斜めになってしまう問題に対し、**Align Particles with Collision Plane** モジュールを追加。Initial Mesh State を基準に **Z-axis alignment** を選択し、コインが床に対して正しく「表を上にして」着地するよう補正

### 6. Blueprint 側の呼び出しと Eliminate 演出
- **Spawn System Attached** で Niagara システムをキャラクターにアタッチ
- 変数型 **Skeletal Mesh Actor** を用意し、レベル上で対象キャラクターを選択できるようにする（Public 変数）
- Get Skeletal Mesh Component → Mesh にアタッチしてエフェクトを再生
- 直後に対象キャラクターの **Visibility を false** に設定 — 「キャラクターが消える → その位置からコインが弾ける」という Eliminate 演出をこの2アクションだけで構成

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` には Niagara の親子連鎖・キャラ付随サンプリングの記載はあるが、以下は未収録で新規:

- **相補的な2本のカーブで力学フェーズを3段階に分ける設計**（Drag カーブと Gravity カーブを NormalizeAge 上で逆位相にして「バースト→浮遊→落下」を単一エミッタで表現）。ドクトリンの「Execution State/Inheritance」節は寿命制御の話であり、フォース遷移カーブの設計パターンとしては新規
- **GPU Distance Field Collision の Particle Radius 実務 Tips**: デフォルト半径だとメッシュが床にめり込む問題と、その対処（半径を手動拡大）。ドクトリンにコリジョン関連の記載自体が無く新規
- **Align Particles with Collision Plane（Initial Mesh State 基準の Z-axis alignment）**: 衝突後のメッシュ姿勢を初期メッシュ状態基準で補正するモジュール。新規
- **Skeletal Mesh Location の Sample Random Triangles + Velocity From Point の Origin をその三角形位置に紐付ける分散発生源設計**: ドクトリンの「キャラ付随: SkeletalMeshLocationをSpawn(表面)/Update(ボーン追従)で使い分け」には該当するが、「単一ポイント方式は不自然（Single position is bad）」という明示的な設計判断とセットでの言及は新規
- **Wind + Aerodynamic Drag + Align Sprite to Mesh Orientation の3点セットで「落ち葉」挙動を模倣**という組み合わせパターン自体が新規（Wind Force 系の言及がドクトリンに無い）

## SCRAP BLITZ UEへの応用メモ

- タイトル通り **敵撃破/デス演出（Eliminate）に直結する構成**。コインメッシュを本プロジェクトのテーマに合わせて「ネジ・ボルト・ガラクタパーツ」等のメッシュに差し替えれば、雑魚敵撃破時の「バラバラに解体して散らばる」演出として転用しやすい
- **Spawn System Attached → SetVisibility(false)** という Blueprint 2 手順の Eliminate パターンは、既存の敵死亡フロー（`SBEnemy` 系）に組み込みやすい最小構成。現状 DrawDebug 仮実装のデブリ演出を Niagara 本番実装に差し替える際のテンプレとして使える
- **段階的フォースカーブ（バースト→浮遊→落下）** は `emitBarDebris()`（ライブスバー破裂）やボス死亡時のデブリ演出（explode フェーズ）にも応用余地がある。現状は物理シミュレーションベースのデブリだが、Niagara 側で同様の「弾け方」を作る際の具体的カーブ設計として参照可能
- **GPU Distance Field Collision + Radius 調整 + Align Particles with Collision Plane** は、床に散らばるパーツが埋まったり向きが崩れたりする問題への直接的な解決策として、今後 UE 側で地面散乱エフェクトを実装する際にそのまま適用できる
- 金貨/銀貨の Random Integer カラーバリアント選択は、OC ジェムのようなドロップアイテムのバリエーション演出にも小技として転用可能

## ソースの限界

- 英語自動字幕のみで手動字幕なし。数値パラメータ（Speed 100〜500、Lifetime 9〜10、Radius 13、Gravity -4000〜-3500 等）は音声認識のブレを含む可能性があり、本文中で「※推定」と明記した箇所は実装時に UE 実機で再検証が必要
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。カーブの正確な補間形状（Linear/Ease 等）やモジュールの並び順の細部は字幕だけでは特定できていない
- 動画中「[Music]」と表記される箇所は音声が BGM に埋もれて字幕が欠落している区間で、文脈から意味の欠落は小さいと判断したが完全性は保証できない
