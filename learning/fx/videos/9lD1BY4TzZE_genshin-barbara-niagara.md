# SOURCE: 【UE5】#4完 原神バーバラのスキルエフェクトを作ろう～Niagara編～

- 動画: https://www.youtube.com/watch?v=9lD1BY4TzZE （作者: tobari VFX、29:30）
- 視聴日: 2026-07-06
- シリーズ構成（全4部）: #1 メッシュ編 → #2 テクスチャ編 → #3 マテリアル編 → **#4 Niagara編（本ノート、最終回）**。**#1〜#3 は別ノートで扱う**

> ⚠**情報源の性質に関する注記（重要）**：この動画には**音声ナレーションが実質無い**（BGMのみの画面録画）。シーンチェンジ検出でffmpeg抽出したフレーム画像**73枚（f0001〜f0073、1280x720、不等間隔）を目視で読み取ることが一次情報源**。720pのためNiagara EditorのSystem/Emitter名・モジュールスタック・パラメータパネルの文字は概ね判読可能。判読できない・自信がない箇所は「不明瞭」「推測」と明記する（捏造禁止）。本ノートは4体のSonnetサブエージェント（f0001-19 / f0020-37 / f0038-55 / f0056-73 の4分割）の読み取り結果をメインモデルが統合したもの。

## System構成

単一のNiagara System **`Nia_Skill_001_00_Lp`**（Lp=Looping）の中に、#3マテリアル編のロードマップに出てきた各要素名と対応するEmitterが順次追加されていく構成。確認できたEmitter一覧（登場順）：

| Emitter名 | 役割（キャプション/文脈から） | レンダラー |
|---|---|---|
| `Staff` | 五線譜（スタッフ）形状の武器エフェクト | Sprite Renderer（後にMesh Rendererテストも） |
| `EmissiveLevel02` / `Glow` | グロー系 | - |
| `Music` / `MarkGlow` | 音符・音符グロー | - |
| `Upper001` / `Upper002` | 「Buff triangle」（三角バフ） | Sprite Renderer |
| `EmissivePar01` / `EmissivePar01001` | 「Emissive Par」（発光パーティクル） | - |
| `WaterDrops` | 水滴 | Shape Location: Cylinder + Add Velocity: Linear |
| `MusicGlow001` | メインの複層リング状グロー | **Mesh Renderer**（`SM_Cylinder`系使用） |
| `FR_Glow01` | フレネルグロー | - |
| `FR_0kw01` / `FR_0kw01001` | フレネル系（OCR不明瞭、FR_Glow系の別名または続き番号の可能性） | - |

## 各Emitterで確認できた実装パターン

### Life Cycle / Emitter State（Staff, MusicGlow001など複数Emitterで共通確認）
- Life Cycle Mode: `System` または `Self`（Emitterにより異なる）
- Inactive Response: `Complete (Let Particles Finish then...)` — ツールチップ「INACTIVEとは新規パーティクルの生成・管理ができない休止状態」
- Loop Behavior: `Infinite`、Loop Duration調整（キャプション「Duration: 60 infinite」）
- Recalculate Duration Each Loop チェックあり
- Scalability Mode: `System`

### Initialize Particle（複数Emitterで共通確認、色は直接指定）
- Color Mode: `Direct Set`、RGB値を直接指定（例: Staffは`R0.1 G0.7 B1.0`の水色系、FR_Glow系は`0.63/0.31/1.0`の紫系）
- Lifetime: `Direct Set`、60.0前後の長寿命設定が多い（Loopingシステムのため常駐に近い扱いと推測）
- Position Mode: `Direct Set` または `Simulation Position`
- Sprite/Mesh Attributesは基本`Unset`（他モジュールで上書きする設計）

### Initial Mesh Orientation（Staff, MusicGlow001）
- Mesh Orientation Mode: `Random` または `None`
- Rotation: `Random Range Vector`（Min/Max指定）
- Rotation Coordinate Space: `Mesh`

### Transform モジュール（Upper001/002, EmissivePar系）
- Transform Order: Scale→Rotate→Offset
- Non Uniform Scale、Rotation Coordinate: Local
- Offset Mode: `Random Range Vector`、Shape Origin基準

### Add Velocity（WaterDrops, Upper001系）
- Velocity Mode: `Linear`、Min/Max指定（例: Z=200.0, Y=100.0）

### Scale Color 001（複数Emitter）
- Scale Mode: `RGB and Alpha Separately`
- Scale RGB例: (2.0, 2.0, 2.0)、Scale Alpha例: 0.3（発光を強調しつつ透明度は抑える設定）

### Dynamic Material Parameters（MusicGlow001、#3マテリアル編のDynamic Parameterノードと対応）
- 「Dynamic Parameter Index 0」に`Power02`を**Float from Curve**（NormalizeAge基準のカーブ）で接続
- キャプション：「このパラメータ移動をNiagaraで動的処理している感じです」
- **これはfx doctrineの「一度だけ=Spawn、継続=Update」原則の実例**——マテリアル側は静的パラメータを持つだけで、実際の経時変化はNiagara側のカーブで駆動する分業になっている

### Sprite Renderer設定（Upper系）
- Material User Param: None、Alignment: Unaligned、Facing Mode: **Face Camera**
- **Default Pivot in UV Space**（0.5）、**Pivot Coverage Blend**（1.0）— UV空間でのピボット位置制御パラメータが明示的に存在することを確認

### Mesh Renderer設定（MusicGlow001）
- Meshes: 1 Array elements、`SM_Cylinder_001_00`等#1メッシュ編の成果物を使用
- Explicit Mat: `ML_Skill_011_00`（Material、User Param Binding経由でNiagara→マテリアルの接続を実演）
- Mesh Scale Mode: Uniform（0.75）

## マテリアル接続（#3で作ったMMのMI適用を実演）

- `MI_Skill_004_00` / `MI_Skill_005_00`（Glow系）、`ML_Skill_011_00`（FresnelGlow、親`M_E_TR_FR_DF_001_00`）、`ML_Skil_000_00`、`M_Skill_001_00`、`ML_Skil_007_00`など多数のMIがEmitterのRendererから参照される。UVパラメータ（Offset/Scale/Speed/RotationAngle）・Power/Power02・Contrast/Contrast02・DepthFadeは#3で構築したパラメータ構成とそのまま対応。
- `M_E_TR_FR_DF_001_00`のMaterial Graphで「フレネルなのでTWOSideのチェックは外しておきます」という#3ノートと同一の訂正キャプションが再度確認された（シリーズを通した一貫性チェックの様子と推測）。

## 仕上げ・タイミング調整

- Timelineビュー（Sequencer）で各Emitterのトラック（Scale Color 001, Rainbow, Scale RGB, EmissiveLine01/02, Glow等）を並べ、発火タイミングをずらして重ね合わせる様子が確認できた（フレームレート表記は場面により60fpsまたは240fps）。
- ゲームプレイプレビュー（f0049, f0062, f0068, f0070）で、キャラクター周囲に**水色・ピンク・黄緑の多層リング状エフェクトが放射状に展開**する完成形を確認。「REFLECTION CAPTURES NEED TO BE REBUILT」という警告が持続的に表示されており、レベル側の反射キャプチャ未ビルド状態のまま作業していたことが分かる（本編の効果自体には影響しない想定内の警告と推測）。
- テクスチャのタイリング設定（Clamp）についての訂正キャプションが本編でも再度登場（#3で言及されたのと同じ注意点）。

## エンディング

f0070で「完成です！おつかれさまでした！！」のキャプション。その後、原神本編のバーバラ紹介シーンと思われるカットに切り替わり、「というわけでバーバラのスキル編は完結となります。最後までご視聴ありがとうございました！」のキャプションでシリーズ完結。

## 学習部屋の既存fx doctrine（`fx_technique_doctrine.md` v2.2）との比較・新規性

1. **Dynamic Material Parameterのカーブ駆動という実例が実写確認できた**: doctrine既存記述「Dynamic Material Parameterも同じ。侵食の経時進行はUpdate側必須」の具体的な実装（NormalizeAgeベースのFloat from Curve）として裏付けが取れた。ドクトリンの記述精度を上げる裏付け事例として有用。
2. **Sprite Rendererの`Default Pivot in UV Space`/`Pivot Coverage Blend`**: 既存doctrine（v2.2の「ビーム/光の筋」節等）には無いパラメータ名。以前ノート化した`CoFmCf4z3X0`（光の筋）の「UV空間のピボット移動」技法と関連が深く、**同じ原理を別の実装（Sprite RendererのDefault Pivot設定）で確認できたことになる**——doctrine反映時はこの2ノートを合わせて参照する価値がある。
3. **Mesh Rendererの`User Param Binding`経由でNiagara→マテリアルパラメータを接続する構成**: doctrineの「1粒3レンダラー」等の実測知見とは別に、**メッシュベースのエフェクトでNiagara側のUser Parameterをマテリアルインスタンスに直接バインドする**という接続方法の実例。
4. **複数Emitterのタイミングをsequencerでずらして重ねる「多層タイミング演出」**: doctrineの「層分け」はレンダラー/ブレンドモード観点が中心だったが、本動画は**発火タイミングのオフセットによる層の演出**という時間軸の切り口を示している。

## 判読不能・不明瞭だった箇所

- `FR_0kw01`/`FR_0kw01001`という Emitter名（OCR的に自信が低く、`FR_Glow01`の別表記または誤読の可能性が高い）
- 複数フレームで「不明瞭」とされたパラメータ数値（Position座標の一部、Curve個別キー値等）
- 240fpsという表示が実際の再生フレームレートかシーケンサー内部の解像度設定かは断定できない
- 動画終端の原神キャラクター紹介シーンの正確な文脈（エンディングクレジット的な演出か、別の意図があるかは不明）
