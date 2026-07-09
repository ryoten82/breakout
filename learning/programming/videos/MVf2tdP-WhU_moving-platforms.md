# 学習ノート — The Ultimate Intro To Moving Platforms - Unreal Engine 5 Tutorial（Pitchfork Academy）

- ソース: https://www.youtube.com/watch?v=MVf2tdP-WhU （25:41、UE5.7 実演・作者は「5系なら概ねどのバージョンでも通用する」と明言）
- 視聴日: 2026-07-08 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\programming\transcripts\MVf2tdP-WhU.txt`
- 関連ノート: [materials/videos/iMJJYXHMw4o_toon-shading-ue58.md](../../materials/videos/iMJJYXHMw4o_toon-shading-ue58.md) / [materials/videos/oOwI0QCSqXw_post-process-toon-outlines.md](../../materials/videos/oOwI0QCSqXw_post-process-toon-outlines.md)（同チャンネル Pitchfork Academy）。programming ドメイン初の Blueprint 実装チュートリアル（既存ノートは全て Epic 公式 C++ documentation）

## 概要

Interp To Movement コンポーネント（Unreal Engine 標準搭載）1つで「移動する足場」を実装する動画。ゼロから Blueprint 1本（`BP_MovingPlatform`）を組み、①ワンショット/往復移動 ②プレイヤーが乗ったら動き出し端で止まる ③スイッチで on/off するエレベーター、の3パターンを同じコンポーネントの設定変更だけで実現する構成。C++ を一切使わない Blueprint 完結のワークフローで、既存 programming ノート群（Epic 公式ドキュメント）とは異なる実践寄りの内容。

## Interp To Movement コンポーネントの基本

- `BP_MovingPlatform`（Actor 派生）に Cube メッシュを追加し、**Add → Interp（で検索）** すると出てくる `Interp To Movement` コンポーネントを追加するだけで移動機能が付く
- Details パネルの **Control** セクション:
  - `Duration`（移動にかける秒数）
  - `Control Points` 配列。各要素は `Position`（デフォルトで **Relative** 座標）
  - Relative なので Control Point の1つ目を `(0,0,0)` にしておくと「アクターをレベルに置いた場所」がそのまま始点になる、という運用が推奨されている
- `Behaviour Type`（動作モード、4種）:
  - `OneShot`: 始点→終点へ1回移動して停止
  - `OneShot Reverse`: 始点→終点→始点と往復して1回で停止
  - `LoopReset`: 終点まで行ったら瞬間的に始点へ戻り、また繰り返す
  - `PingPong`: 始点⇄終点を永久往復。動画作者は**カスタム挙動を作りたい場合でも PingPong を推奨**。理由は OneShot 系がコンポーネントを内部的に非アクティブ化してしまい、**リセットする方法を見つけられなかった**と明言している（※推定要素は薄いが、作者の自己申告としてこの制約は明記しておく）

## Construction Script + 3D Widget によるレベル配置ワークフロー（この動画の核心）

- 2点目の Control Point を配列から削除し、代わりに **Construction Script** で `Interp To Movement` の `Add Control Point Position` を呼ぶ
- その `Position` 入力ピンを **Promote to Variable** し、変数名を `MoveToPause`（動画内呼称）とする。この変数を **Instance Editable** にし、さらに **Show 3D Widget** をチェックする
- 効果: コンパイル後、レベル上でこのアクターを選択すると **ギズモ（3D ウィジェット）がワールド上に表示**され、ドラッグで終点位置を視覚的に配置できる。座標入力ではなく「実際に見ながら動かして決める」ワークフローになる
- 同様に `Duration` も Instance Editable にすると、同じ Blueprint を複製配置しつつ、個体ごとに移動速度（例: 2秒 vs 5秒）を変えられる
- 結果として **1つの Blueprint をレベルに何度も配置し、それぞれ 3D ギズモで終点をドラッグ調整するだけ**で多数の足場を量産できる、という運用が成立する

## 乗ると動く／降りると止まる（Auto Activate / Start With Tick Enabled のトグル運用）

- デフォルトでは `Interp To Movement` の `Auto Activate` が有効で、Play 開始と同時に勝手に動き出す。カスタム制御したい場合は **Auto Activate を無効化**し、加えて **Start With Tick Enabled も無効化**する
- 起動/停止を Custom Event 2つ（`EnableMovement` / `DisableMovement`）で管理する定型パターン:
  - `EnableMovement`: `Is Active` で分岐 → 非アクティブなら `Activate(Reset=true)` → `Set Component Tick Enabled = true`
  - `DisableMovement`: 同様に `Set Component Tick Enabled = false`（Activate 側は動画内で対称処理として複製、と説明。`Reset` チェックは**外すと正しく動作しない**と明言）
- `BoxCollision` を足場メッシュに沿わせて追加し、`OnComponentBeginOverlap` / `OnComponentEndOverlap` で `Other Actor == Get Player Character` を判定 → `EnableMovement` / `DisableMovement` を呼ぶだけでプレイヤーが乗ったら動く足場が完成する
- 実装上の注意（動画内トラブルシュート）: Box Collision を足場表面ギリギリに配置すると、乗ってもプレイヤーが「乗っている」と判定されず反応しないケースがあった。**多少浮かせて余裕を持たせる**ことで解消

## 端で自動停止するエレベーター動作（Event Dispatcher 活用）

- `Interp To Movement` には組み込みの Event Dispatcher（`Assign` で検索して一覧表示）があり、その中の **`InterpToReverse`** が「制御点の端に到達して進行方向が反転するタイミング」で発火する
- `BeginPlay` でこのイベントを Bind し、発火時に `DisableMovement` を呼ぶだけで「乗ったら動き出し、端に着いたら自動で止まる」動作になる。これは実質 OneShot 相当だが **PingPong ベースなので再アクティブ化して何度でも使い回せる**点が利点
- 応用: Dispatcher が渡す `Time`（0.0〜1.0 の正規化された移動進捗、始点=0・終点=1）を使い、`Time != 1.0` の分岐で終点側だけ `DisableMovement` を通す（始点側はスルー）ことで「行ったきり戻ってこない・往復1回で止まる」ような非対称挙動も組める

## スイッチ連動エレベーター（Blueprint Interface 経由の疎結合設計）

- `BPI_Interact` という Blueprint Interface を新規作成し、関数 `BPI_FlipSwitch` と `BPI_ActivateActor` の2つを定義（実装は書かない、シグネチャのみ）
- `BP_MovingPlatform` 側: Class Settings でこのインターフェースを実装追加 → `ActivateActor` 実装内で `EnableMovement` を呼ぶだけ
- `BP_Interactable`（スイッチ用の新規 Actor Blueprint、Cube+BoxCollision）側: 同インターフェースを実装 → `FlipSwitch` 実装内で、**Instance Editable な `Actor Object Reference` 変数（`ActorToActivate`）** 経由で対象プラットフォームを取得し `ActivateActor` を呼ぶ
  - この参照はレベル上でスポイトツール（Eyedropper）を使い、配置済みの `BP_MovingPlatform` インスタンスを直接選択して割り当てる、という運用
- プレイヤー側（`BP_ThirdPersonCharacter`）: `E` キー入力イベントで `Get Overlapping Actors`（フィルタ: `BP_Interactable`）→ 先頭要素を取得 → `Overlapping Actor` チェックの分岐を通して `FlipSwitch` メッセージを送る
- この設計により「スイッチ→プラットフォーム」の結線は Blueprint Interface 経由の疎結合になり、スイッチ側は具体的なプラットフォームクラスを知らなくてよい。動画作者は「本物のプロジェクトでは Interactable の親クラスから Switch/Lever のサブクラスを派生させる想定」と補足（本動画ではデモのため単一クラスで簡略化）

## 新規性のある技術情報（既存ドクトリンとの比較）

programming ドメインは doctrine 未作成（Epic 公式 C++ ドキュメント8本の個別ノートのみ）。本ノートは以下の点で**doctrine 未収録の新規領域**:

- `Interp To Movement` コンポーネント自体（他ドメインの doctrine にも記述なし）。C++ を書かずに標準コンポーネント1つで往復移動アクターが作れるという事実そのものが新規情報
- **Construction Script + Promote to Variable + Show 3D Widget** による「エディタ上でギズモをドラッグして終点を決める」レベルデザイナー向けワークフロー。この 3D Widget 公開パターンは他ドメインのノートにも記述がなく、Moving Platform に限らず「エディタ上で視覚的に配置したいベクトル/位置パラメータ」全般に転用できる汎用テクニックの可能性がある
- `Auto Activate` / `Start With Tick Enabled` を両方無効化してから Custom Event で `Activate(Reset=true)` する「非アクティブ状態から手動起動する」定型パターン。GAS 由来の StartupState 制御などとは別系統の、Actor Component レベルでの活性化制御手法
- Blueprint Interface を使った「スイッチ→プラットフォーム」の疎結合設計。既存の programming ノート（gameplay-classes 等）には Interface の概念記述はあるが、実プロジェクトでの具体的な結線パターン（Instance Editable Actor Reference + Eyedropper でレベル上インスタンスを直接紐付け）は本ノートが初出

## SCRAP BLITZ UE への応用メモ

- SCRAP BLITZ UE は proto（Three.js、毎フレーム位置直書き）由来のため、既存のノックバック/敵移動は CharacterMovementComponent（加速度ベース）で吸収する設計方針が CLAUDE.md に明記されている。**足場アクター自体はキャラクターではない**ため、`Interp To Movement` は CMC と競合せず、独立コンポーネントとして安全に導入できる候補
- エレベーター/移動足場を実装する場合、この動画のパターンをそのまま踏襲するなら:
  1. `SBActor` 系の足場 Blueprint（or C++ 基底）に `Interp To Movement` を追加し `PingPong` ベースで統一（OneShot 系は再アクティブ化不可という制約があるため、SP技の Pierce/Combo のような「何度も再利用される」システムとの相性を考えると PingPong 一択が妥当）
  2. Construction Script + 3D Widget 公開は、SCRAP BLITZ UE のような 2.5D スクロール制アクションでも有効なはず。ただし proto の座標変換規約（X→Y, Y→Z, Z→X）を踏まえると、Control Point の相対座標をレベルデザイナーに渡す際は「proto 側の wu 単位ではなく UE の uu（1:1変換後）」で見せる必要がある点に注意
  3. プレイヤーが乗ったら動く／降りたら止まる方式は BoxCollision の Overlap で判定しており、SCRAP BLITZ UE のプレイヤーキャラ（CMC ベース）でも `Other Actor == プレイヤーキャラ` 判定はそのまま使える。ただし本動画は Overlap ベースの静的判定であり、**足場に乗っている間キャラクターを追従させる処理（親子化 or Base Component 的な仕組み）は本動画では扱われていない**。移動する足場に乗った状態でキャラが足場と一緒に動くかどうかは別途検証が必要（CMC の `MovementBase` 機構の利用を要調査、本ノートはその出発点情報の位置づけ）
  4. エレベーターのスイッチ連動パターン（Blueprint Interface + Instance Editable Actor Reference）は、SCRAP BLITZ UE の Pickup/ギミック系実装（`docs/spec/common01.md` §13 Pickup マグネット等）とは独立した仕組みだが、「エディタでスポイトツールを使い配置済みインスタンス同士を直接紐付ける」という運用パターン自体はレベル制作全般で流用できる
  5. `InterpToReverse` Event Dispatcher の `Time`（0〜1 正規化進捗）を使った非対称制御は、足場の「片道だけ止める」「往路と復路で異なる挙動をさせる」といった演出的な作り込みに転用できそう

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名・変数名の一部（`MoveToPause` 変数名や UI 操作の細部）は音声認識と文脈から復元しており、断定できない箇所には「※推定」を付けた
- 実際のノードグラフ画面は視聴しておらず（transcript ベースの要約）、ノード同士の正確な接続順序・ピン名の完全な綴りは保証できない。特に `EnableMovement` / `DisableMovement` 内の分岐ロジックの正確なノード構成は、動画の説明文からの再構成であり実際のグラフと細部が異なる可能性がある
- **CMC との相互作用（足場に乗った際のキャラクター追従処理）は本動画のスコープ外**。SCRAP BLITZ UE 側でエレベーター実装を進める際は、この部分（`MovementBase` 等）を別途調査する必要がある
- 動画作者はプロ級の作り込みではなく「イントロ（入門）」と自称しており、耐久性の高い量産システムというよりはミニマルな実装デモである点に留意
