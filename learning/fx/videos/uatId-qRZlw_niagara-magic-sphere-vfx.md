# 学習ノート — UE5 Niagara Magic Sphere VFX

- ソース: https://www.youtube.com/watch?v=uatId-qRZlw （14:25）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（`--list-subs` で手動字幕なしを確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\uatId-qRZlw.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [iDrsEp3AGWA_magic-orbs.md](iDrsEp3AGWA_magic-orbs.md)（浮遊オーブ・OCジェム直結、Sort Order Hint多層構成）、[h-gp4l1oIbU_portal-vfx.md](h-gp4l1oIbU_portal-vfx.md)（本ノートと同じ「出現→常駐→消滅」3フェーズ構成思想だがマテリアルのみで完結する対照例）、[xzFfZhxkpx4_shield-vfx.md](xzFfZhxkpx4_shield-vfx.md)（他Emitterの継続時間から自Emitterのスポーンタイミングを逆算する設計は本動画と同系統）

## 概要

メッシュベースの「魔法球」エフェクトを、**出現(Spawn)→常駐ループ(Loop)→消滅(End)の3フェーズ**で構成する制作動画。素体となる球体メッシュに加え、発光エッジ(Glow)・周回リボン(Spline)・火花(Spark)を積層し、最後に「キャラクター周りを公転する複数体のオーラ」として再利用するところまでを扱う。アセット（メッシュ/マテリアル/テクスチャ）はUnreal Engine公式配布素材の流用のため、本ノートはNiagara側のロジック構築が主題。

## System構成（全8Emitter）

| Emitter | Renderer | Life Cycle | 役割 |
|---|---|---|---|
| Sphere Spawn | Mesh | Self, Loop=Once, Burst=1 | 球体の出現アニメ |
| Sphere Loop | Mesh | Self, Loop Duration=User Duration | 球体の常駐（ランダム回転） |
| Sphere End | Mesh | Self, Loop=Once, Burst=1 | 球体の消滅アニメ |
| Glow Spawn/Loop/End | Mesh (Facing=Camera Position) | 上記3系統と同型を複製 | エッジ発光の3フェーズ |
| Spline | Mesh, Spawn Rate | Loop Duration=User Duration | 球体を巻くリボン状粒子 |
| Spark | Sprite, Spawn Rate=300 | Loop Duration長め | 火花・残留エフェクト |

## Spawn/Loop/End 3フェーズの継ぎ目設計（本ノートの核心1）

- **同一Emitterを複製して3フェーズを量産**: Sphere Spawnを複製してSphere Loop/Endを作る（Scale/Colorカーブだけ差し替え、共通ロジックは使い回し）
- **タイミング同期はUser Parameter（float）のDurationを基準に手計算**:
  - Sphere Loopの`Loop Duration` = User Duration（デフォルト値の例として2、と字幕にあり※推定）
  - Sphere Loopの`Spawn Time` = 0.25（Spawnフェーズの長さ0.3と重ならないようやや早めにオフセット、と実演される）
  - Sphere Endの`Loop Duration` = User Duration + 0.3×2（開始・終了の2回分を加算、字幕で「0.6」と明言）
  - Sphere Endの`Spawn Time` = User Duration + 0.1（Loopフェーズの後に来るよう設定）
  - この「他フェーズの所要時間を定数として加算・減算してSpawn Time/Loop Durationを算出する」設計は、[xzFfZhxkpx4_shield-vfx.md](xzFfZhxkpx4_shield-vfx.md)で既出の「スポーンタイミングを他Emitterの継続時間から逆算する」パターンと同系統。今回はShieldの4フェーズよりシンプルな3フェーズ版として再確認できた
- **Scale Mesh Size**は Vector from Float + Curve from 0→1 の組み合わせで、キーフレームを中間(0.5)でオーバーシュートさせて「張り詰めた」動きを作る（doctrine既知の「カーブは全キーAuto、出現はオーバーシュート」を実例で裏付け）

## Particle Attribute Reader による姿勢（回転）の引き継ぎ（本ノートの核心2・新規性あり）

- Sphere Loopでは`Update Mesh Orientation`（Random Axis, Rotation Rate）を使い球体をランダム回転させ続ける
- 問題: Sphere Endに切り替わった瞬間、Endは独自の初期回転を持つため**Loop終了時の向きと不連続**になり、見た目が「カクッ」とズレる
- 解決策: Sphere End側にカスタムモジュールを追加し、
  1. `Particle Attribute Reader`でSphere Loop Emitter（名前をコピーして指定）を参照
  2. `Get Quaternion by Index`で該当パーティクルの現在の姿勢を取得（**Burst=1粒のみなのでIndexは常に0**、という前提を利用）
  3. 取得したQuaternionをそのまま`Particle Mesh Orientation`に接続
- これにより「Endフェーズ開始時点の回転をLoopフェーズの最終回転から連続的に引き継ぐ」ことができる
- **既存doctrine（AttributeReader節）との違い**: doctrineに既出のAttributeReader活用は「親→子の一次スポーン/破裂連鎖」（SpawnParticlesFromOtherEmitter等、当選フラグの伝達）が主眼だが、本動画は**同一System内の兄弟Emitter間で「状態（姿勢）そのものを1フレームだけコピーして引き継ぐ」**という異なる用途。イベントや親子関係を使わず、**フェーズ切り替えの継ぎ目にある不連続性をAttributeReaderで橋渡しする**手法は未収録で新規性あり

## Vortex Velocityモジュールのバージョン依存（実務上の注意・新規性あり）

- キャラクター周りを公転させる際、字幕では`Vortex Velocity`モジュールを使用しているが、**「このモジュールはUE5.3以下でのみ利用可能。UE5.4/5.5では自作の同等モジュールが必要」**と明言される
- 具体的な代替実装手順は動画内で示されず（言及のみ）。SCRAP BLITZ UEはUE5.8のため、このモジュールは存在しない前提で設計する必要がある

## System再利用パターン：Component Rendererによるシステム内包（新規性あり）

- 完成した「魔法球System」をそのまま**別Systemの部品として使い回す**ために、新規Niagara System「Around」を作成
- Emitterの`Renderer`に**Component Renderer**を追加し、コンポーネント種別に「Niagara」を選択 → 先に作った魔法球Systemをそのまま指定
- `Spawn Count=3`（Burst=Once）でスポーンし、`Shape Location`で球面上に配置、`Vortex Velocity`で公転させることで「3個の魔法球が周回するオーラ」を構成
- **既存doctrineとの違い**: doctrineの親子連鎖節は「AttributeReaderでパーティクル属性を子に伝える」パターンだが、本動画は**Component Rendererで完成品System自体を別Systemの1パーティクルとして複数体インスタンス化する**、より粗粒度な再利用パターン。「1個の複雑なSystemを丸ごと部品化し、上位Systemで数量・配置だけ制御する」設計は未収録で新規性あり

## Local Spaceの罠（実務Tips）

- Systemをキャラクターに追従させて動かした際、「Sphere/GlowはSpawn Burst方式のため、位置が発生時点で固定されてSystem移動に追従しない」現象が発生（Spline/Sparkは`Spawn Rate`方式のため追従する）
- 対処: Sphere/Glow系のEmitter設定を**Local Space**にする、とだけ説明される（詳細な理屈への言及は薄い）
- doctrineには類似の記述なし。「Burst方式のEmitterはSystem自体が動く用途ではLocal Space化が必須」という実務Tipsとして記録に値する

## 新規性のある技術情報（既存ドクトリンとの比較・まとめ）

`fx_technique_doctrine.md` 未収録として:

1. **Particle Attribute Reader + Get Quaternion by Indexで、兄弟Emitter間のフェーズ切り替え時に姿勢（回転）を連続的に引き継ぐ**手法（親子連鎖でなく「状態の橋渡し」用途）
2. **Vortex Velocityモジュールのバージョン制約**（UE5.3以下限定、5.4以降は自作代替が必要）という実務上の互換性情報
3. **Component Rendererで完成Systemを丸ごと部品化し、上位Systemから複数体インスタンス化する**粗粒度な再利用パターン
4. **Burst方式Emitterのみ発生位置がSystem移動に追従しない → Local Space化が必須**という実務Tips

既出の再確認（新規ではないが実例として有用）:
- 「他Emitterの継続時間から自Emitterのスポーンタイミングを逆算する」設計（xzFfZhxkpx4と同系統）
- カーブのオーバーシュート出現、Dynamic Material Parameterでのランダムオフセット外部化

## SCRAP BLITZ UEへの応用メモ

- **SP技/チャージ攻撃の魔法球演出**への転用は構造的に相性が良い: 「出現→ホールド（チャージ演出）→消滅（発射/爆発）」の3フェーズはそのまま「チャージ開始→SPゲージ溜め中→技発動」のタイミングに1:1で対応させやすい。Loop DurationをSP溜め時間（可変）に、EndのSpawn TimeをSP消費・技発動タイミングに紐付ければ、既存のSP経済（common01 §6/§11）と時間軸を同期させたVFXが作れる
- **Attribute Readerによる姿勢引き継ぎ**は、METEOのチャージ中→発動時に球体エフェクトが回転を続けたまま滑らかに変化させたい場合に直接使える。ただしUE5.8ではVortex Velocity相当を自作する必要がある点に注意
- **Component Rendererでのシステム部品化**は、OCジェムの光エフェクトや複数のPickupアイテムが同時に周回するような演出（例: ボス撃破時のドロップ演出でオーブが複数飛び出す）に応用できる。既存の[iDrsEp3AGWA_magic-orbs.md](iDrsEp3AGWA_magic-orbs.md)の浮遊オーブ構成と組み合わせ、「魔法球System」を1個の再利用可能な部品として設計しておくことで、SP技演出とアイテム演出の両方から流用できる可能性がある
- **Burst EmitterのLocal Space罠**は、プレイヤー追従型のオーラ/バフエフェクト実装時に直接関わる実務上の注意点として記録価値が高い

## ソースの限界

- 英語自動字幕のみ（`yt-dlp --list-subs`で手動字幕の非存在を確認済み）。特に数値パラメータ（Duration=2、Ribbon Width曲線の値、Vortex速度等）は音声認識のブレを含む可能性があり「※推定」箇所は実装時にUE実機で再検証が必要
- 実際のノードグラフ画面は視聴しておらず、transcriptベースの要約のみ。「Sphere End用カスタムモジュールの内部配線」「Vortex Velocity自作代替の具体実装」など、画面操作でしか確認できない詳細は本ノートに含まれない
- 使用アセット（メッシュ/マテリアル/テクスチャ）はUE公式配布素材の流用と説明されており、マテリアルグラフ自体の構築手順は動画に含まれない（Niagara側のロジックのみが主題）
