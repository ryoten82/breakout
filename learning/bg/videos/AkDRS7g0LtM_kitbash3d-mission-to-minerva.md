# 学習ノート — How to create a Sci-Fi Open World in Unreal Engine 5 with KitBash3D

- 動画: https://www.youtube.com/watch?v=AkDRS7g0LtM （UNF Games、全273分＝4時間33分のフルコース）
- 学習日: 2026-07-04 / 抽出: 自動生成字幕（英語 ASR、手動字幕なし）→ Sonnet×9並列（30分区切りでチャンク分割）→ Fable監査未実施（本ノートは監査待ち）
- 原典 transcript: [../transcripts/AkDRS7g0LtM.txt](../transcripts/AkDRS7g0LtM.txt)（`[MM:SS]` で原文照合可能。273分あるため分数表記は60を超える）
- 使用アセット: KitBash3D「Mission to Minerva」キット（購入制）

## 全体像（この動画で何が学べるか）

KitBash3D の汎用モジュラーキット1本から、Landscapeベースの大規模Sci-Fiオープンワールドを一人称視点でゼロから組み上げる実演。工程は概ね以下の順で進む：

1. アセット取得・整理・Jig（俯瞰用整理レベル）作成 [0:00–30:00]
2. プリセット化・キャラクター導入・新規Landscape作成・構図理論 [30:00–60:00]
3. World Partition調整・道路配置・建物配置・自然物（岩）導入 [60:00–90:00]
4. 岩場ディテール・Kitbashing・Modeling Toolsによるカスタムメッシュ変形 [90:00–120:00]
5. Landscapeマテリアル作成（レイヤーブレンド・高さブレンド・ノーマル調整） [120:00–150:00]
6. 岩マテリアルのSlope（傾斜）マスク・Material Parameter Collection・Landscapeとの統一 [150:00–180:00]
7. プレイヤーエリア造形・床/階段の当たり判定・セットドレッシング [180:00–210:00]
8. セットドレッシング仕上げ（大→中→小の密度・Packed Level Instance量産） [210:00–240:00]
9. 大気・ライティング・ポストプロセス・World Partition遠景表示・宇宙船統合 [240:00–273:17]

## SCRAP BLITZ UE への応用度が特に高いポイント（横断まとめ）

- **Packed Level Instance（Packed Level Actor）ワークフローが動画全体で繰り返し実演される**：個別配置 →「使い回せる」と判断した群を選択 → 右クリック → Level → Create Packed Level Actor（Pivot=Center or Minimum Z Axis）→ 命名保存。以後は複製・回転・非一様スケールだけでバリエーションを量産する。`docs/spec/port_background_decoration.md` のセットドレッシング未実装項目に直結する中心技術（[19:00][92:11][104:46][189:35][217:11]など多数）
- **World Partition の `Is Spatially Loaded` オフ設定**：距離ベースのアンロード対象から遠景メッシュを除外し、常時表示させる設定。SCRAP BLITZ UEでもWorld Partitionを使ったステージがあり、遠景の山・建造物が距離で消える不具合が出た場合、真っ先に疑う価値がある（[60:07][264:16]で2回言及）
- **Material Parameter Collection（MPC）による一括制御**：岩マテリアルのSlope表現などをMPCに集約し、1箇所の変更を全インスタンスへ伝播させる設計。SCRAP BLITZ UEの「敵Registry化」「ドロップテーブル共通化（SBLootCommon）」と同型の設計思想（[150:45][186:33]）
- **「大→中→小」の密度積み上げ順序**と**「見えない場所には手間をかけない」**という一貫したコスト意識（[216:16][231:09]ほか）は、そのままステージ美術の作業優先順位の指針になる
- Packed Level Instance の Pivot は**作成後に直接編集できない**という制約が実演内で発覚（[105:51]–[108:01]）。UE5バージョン依存の制約として実装時に留意

## 区間別詳細

### 0:00–30:00 — アセット取得・整理・Jig作成・Packed Level Actor基礎

#### 作業手順
- **[00:57]** kitbash3d.com で「Mission to Minerva」キットを購入・ダウンロード（Native形式、2K推奨）。ZIPにUE5プロジェクト一式が含まれる
- **[02:29]–[05:15]** UE5基本操作：右クリック+WASD/QEでナビゲーション、W/E/Rでギズモ切替、Fでフォーカス、スナップ間隔設定
- **[05:48]–[08:15]** `Ctrl+Space` でコンテンツドロワー、Geometriesフォルダに648種類のメッシュ（※推定値）。大量アセット管理のため **Collection** を作成してよく使う組み合わせをまとめる
- **[09:23]–[13:50]** **Jig（俯瞰整理レベル）**：床アセットを広く敷き、手持ちアセットをカテゴリ別（大型/中型/小型）に並べて一覧化。Text Render Actorでラベル付け
- **[14:10]–[18:38]** モジュラーアセットの組み合わせ遊び：複製・スナップ調整でパーツを繋げ、「どんな形が作れるか」を手を動かして探る
- **[19:00]–[21:40]** **Packed Level Actor化**：組み合わせたアクター群を選択 → 右クリック → Level → Create Packed Level Actor → External にチェック、Pivot Type = Minimum Z Axis → フォルダ・ブループリント名を指定して保存。以後1アセットとして扱える
- **[22:01]–[25:13]** シルエットの重要性：Buffer Visualization→Specularでシルエット確認。同じPacked Level Actorを回転させるだけで異なる面（シルエット）を見せられる
- **[26:09]–[27:33]** Packed Level Actorの編集：右クリック→Level→Edit→変更→Commit で全インスタンスに一括反映。スケール変更は1.3〜1.7倍程度に留める（それ以上はプロポーション崩壊）
- **[27:46]–[29:49]** 完成マップ紹介：Bridge/Floors/Stairs/Big Buildings/Mid/Big Props/Medium Props/Small Propsのカテゴリ分類例

#### 判断基準・コツ
- コレクション作成の理由：600以上のメッシュを都度フォルダツリーで探すのは非効率。よく使う組み合わせだけ絞る
- Jigを作る理由：見た目を実際に並べて俯瞰しないとテキストだけでは全体像を把握しづらい
- モジュラーアセットへの向き合い方：「何のためのパーツか」を先に考えず「組み合わせたらどんな形が生まれるか」を手探りで試す方が速い
- Pivotを最下端（Minimum Z）に置く理由（推定）：地面設置用アセットはZ=0に置くだけで自然に接地させるため
- シルエットを変える理由：同じアセットの複製だけだと使い回し感が露見するが、回転だけで見た目の第一印象を変えられる（追加モデリング不要の省力化）
- スケール変更を1.3〜1.7倍に留める理由：それ以上はプロポーションが破綻する経験則
- 回転角度を90度刻みに固定しない理由：規則的な角度はパターン化して見えやすい

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| キット内メッシュ総数（Geometries） | 648個※推定 |
| Jig用床スケール | 100×100※推定 |
| テキストラベルサイズ | 400〜800 |
| Packed Level Actor Pivot Type | Minimum Z Axis |
| Uniform Scale推奨範囲 | 1.3〜1.7倍 |

#### 確信度が低い抽出
- 「648 basis」＝648メッシュという数値（ASR誤認識の可能性）
- 「pivot time on the minimum Z axis」→Pivot Typeと復元（UI名称未確認）
- 「maybe like 100 and 100」のスケール値

---

### 30:00–60:00 — プリセット仕上げ・キャラ導入・新規Landscape・構図理論

#### 作業手順
- **[30:52]** Blueprint化してプリセット作成（「Create Pipe Level Actor」は聞き取り不確か、Blueprint化操作と推定）
- **[31:54]–[32:28]** Add Feature or Content Pack→Third Person追加、World Settings→GameMode Overrideで確認
- **[34:58]–[36:20]** File→New Level→Empty Open World、Environment Light Mixerでライト一式をワンクリック生成、SkylightのReal Time CaptureをON
- **[36:33]–[41:37]** Landscape作成（デフォルト8×8→127×127※推定に変更）、Sculpt（Brush Size 12000）、Rampツールでリーディングライン（Falloff 16000→24000→40000）、Smoothで馴染ませ
- **[42:57]–[45:32]** Flattenツールでメッシュ設置面を均す。**Flatten Target**で既存の高さをピックしてコピーする手法
- **[47:14]** Erosionツール（Threshold約22）、Smooth→Erosion→Smoothの反復で自然な岩肌に
- **[49:19]–[59:00]** 構図理論：Foreground/Middleground/Background、Focal Point（プレイヤーのObjectiveと一致することが多い）、リーディングライン、シルエットの独自性、コントラスト。**「プレイヤーがどこに移動しても常にフォーカルポイントが視界に入るように」**が最重要原則

#### 判断基準・コツ
- Landscapeは大きめに取る（動画は控えめにした、実制作では2×2以上推奨）
- Flattenは「配置したい場所を決める→Flattenで均す→メッシュを置く」の順。複数アセットの高さ統一はFlatten Targetで
- Smooth→Erosion→Smoothの反復：一発で決めようとせず弱め設定→ならし→再度、を繰り返す
- Foreground/Middleground/Background：ジャンル問わず普遍的な構図原則
- フォーカルポイントに全リーディングラインを収束させる：3Dワールドはプレイヤーの接近角度を制御できないため、複数方向から地形ラインを引く
- コントラスト：明暗差・シルエット差がある部分に視線が集まる。フォーカルポイント側に最大のコントラストを配置
- World Partitionのストリーミング挙動は今は深追いしない（後工程で扱う予告）

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| Landscapeセクション数（変更後） | 127×127※推定 |
| Sculpt Brush Size | 12,000 |
| Ramp Falloff | 16,000→24,000→40,000 |
| Erosion Threshold | 約22 |
| GameMode | ThirdPersonGameMode |

#### 確信度が低い抽出
- 「Create Pipe Level Actor」の正式操作名
- 「127×127」の数値精度
- 保存ファイル名「tutorial_openworld_minerva」

---

### 60:00–90:00 — World Partition調整・道路配置・建物・自然物導入

#### 作業手順
- **[60:07]** World Partition→Details→**`Is Spatially Loaded`オフ**でフォーカルポイントを常時表示
- **[61:55]–[67:xx]** Roadモジュラーパーツ配置：Set Pivot Offset、Rotation Snap（90/180/270°、5°刻みも）
- **[67:53]–[70:03]** Sculpt/Smooth/Flattenで道路周辺地形調整。「見た目が汚くても後でメッシュで隠すから気にしない」
- **[70:44]–[73:xx]** 複合構造をまるごと複製して時短
- **[74:00]–[79:00]** 建物を「階段状のシルエット」に意図的に配置し、遠景での好奇心を誘う視覚フック
- **[79:24]–[82:xx]** プレイヤースタート地点確定→Flatten→Playで距離感確認
- **[83:02]–[86:02]** 建物密度に緩急をつける（あえて空けるエリアを作る）
- **[86:04]–[89:56]** Quixel Bridgeから岩アセット追加。自然物はGrid/Rotation Snapを基本オフ、ローカル座標で不均一スケール

#### 判断基準・コツ
- 見えなくていい部分の負荷を切る（Spatially Loadedオフ）ことで構図確認を優先
- 遠景から作り、近づくにつれ詳細を足す（Foreground/Middleground/Background原則と直結）
- 地形の粗さは気にしない、メッシュで隠せば良い（地形=ベース、メッシュ=ディテールの役割分担）
- 好奇心を刺激するシルエット設計（階段状の建物群）
- 密度に緩急をつける、反復パターンを崩す
- 自然物はSnapを切りLocalスケールで不均一に（人工物とは逆の運用）
- 大きな塊のまま複製する（Packed Level Instance化の前段）
- 実プレイで確認する

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| Rotation Snap | 90/180/270°、細かい調整時は約5° |
| ロック用テクスチャ解像度 | 8K（デフォルト） |
| World Partition Loading | Is Spatially Loaded=オフ |

#### 確信度が低い抽出
- "lower partition"→Data Layers/Loadingプロパティへの変換
- Shiftキーでのスカルプト操作の意味
- "quick sale"→Quixelの復元

---

### 90:00–120:00 — 岩場ディテール・Kitbashing・カスタムメッシュ変形

#### 作業手順
- **[90:00]–[92:21]** Mega Scans岩メッシュを配置、X軸のみ-1倍ミラー（Y軸ミラーは形状破綻するため不可）、Packed Level Actor化（Pivot=Center、命名例`Mass_Rock_Peak_01`）
- **[93:08]–[97:59]** Flattenで地形処理、`H`/`Ctrl+H`でオブジェクト非表示切替
- **[100:06]–[104:46]** 2つ目の岩キット作成（Bridge経由）、Packed Level Actor化
- **[105:51]–[108:01]** **Packed Level ActorのPivotは事後変更不可**という制約発覚。代替：Edit→削除→Commit、またはSet Pivot Offset
- **[108:53]–[110:47]** 背景ディテール用に大スケール（5〜35倍）で遠景シルエット配置
- **[110:18]–[114:32]** Modeling Toolsでカスタム変形：Mesh Duplicate→Delete Inputs→Simplify（約25%）→スケール調整→**Bake Transform**（忘れると複製時に事故る）→Lattice（3×3×3、Cubic補間）で変形→Nanite再有効化
- **[119:29]** Warpツールでも変形可能（Latticeの方が制御しやすい）
- **[116:04]** フォーカルポイント最優先、プレイヤースタート地点周辺は後回し

#### 判断基準・コツ
- 大→小の順で配置（巨大な岩から）
- 反復感の回避：Xミラー＋スケール変化の組み合わせ
- Packed Level Actor化のタイミング＝「使い回すと決めた瞬間」（ボトムアップ的ワークフロー）
- 完璧主義にならない：「絵画を描くように」全体から徐々に詰める
- フォーカルポイント最優先、プレイヤースタート地点は後回し
- Bake Transformを忘れると複製先が意図しないスケールになる（変形ワークフローの重要な落とし穴）
- Nanite有効化は変形のたびに再確認が必要

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| メッシュ簡略化率 | 約25%※推定 |
| Lattice分割数 | 3×3×3、Cubic補間 |
| 背景用スケール | 5〜10倍（近距離）/15〜35倍（遠景） |
| Collision設定 | Complex as Simple→Project Default |

#### 確信度が低い抽出
- パック名「Sharpland」
- Simplify目標値（50→25%に言い直し）
- Mega scansフィルタ操作の対象アセット名

---

### 120:00–150:00 — Landscapeマテリアル作成（レイヤーブレンド〜ノーマル調整）

#### 作業手順
- **[120:04]–[122:27]** M_Landscape_MinervaマスターマテリアルとMI_Landscapeインスタンスを作成。Quixel Contentからテクスチャ追加（最初3種類、後から増やせる）
- **[123:02]–[123:19]** **Sampler SourceをShared: Wrapに変更**（テクスチャサンプラー上限16回避、必須設定）
- **[127:26]–[129:23]** Landscape Layer Blendノード構築：TexCoord→Multiply→Constant（Tiling≒0.03※推定）→Make Material Attributes→Layer Blend→Break Material Attributes
- **[132:47]–[133:17]** マテリアル適用直後は真っ黒（レイヤー情報なし）→保存してレベル再読込→Layer Info作成→Weight-Blended Layer登録
- **[135:34]–[138:14]** **Height Blend**導入：マスクのBlueチャンネル（ハイトマップ）をContrast経由で使用。HeightContrastを0〜5で調整（5程度採用※推定）
- **[138:32]–[140:20]** 8Kワールドテクスチャをオーバーレイ（Linear Interpolate、Alpha=Color≒0.5〜0.7※推定）
- **[141:08]–[143:31]** Normal Blendでノーマルマップ合成、R/Gチャンネル強度をNormalIntensity（0.3程度採用）で調整（Bチャンネルは保持）
- **[145:05]–[149:59]** 単調さ対策：KitBash3D付属Terrain Material選定、Megascansデフォルトマテリアルをプロジェクトにコピー→M_RockMasterとしてリネーム（プラグインコンテンツを直接汚さない）

#### 判断基準・コツ
- Shared Wrapは「後から効いてくる地雷」対策：レイヤー追加予定なら最初から設定
- 最初から全レイヤー・全ディテールを作り込まない（絵を描くように少しずつ）
- 真っ黒＝レイヤー情報未登録の定型パターン
- Height Blendは境界の説得力を上げる手段（単純Weight Blendはのっぺりする）
- 8Kオーバーレイは近づいた時の単調さ対策（強すぎると意味がない、0〜1の間で探る）
- ノーマル強度は近距離で破綻しないかで決める（B常時強、R/Gだけ弱める）
- マスターマテリアルはプロジェクトにコピーしてから編集（保守性）

#### 主要パラメータ
| パラメータ名 | 値 |
|---|---|
| Sampler Source | Shared: Wrap（必須） |
| Tiling（1層目） | 0.03※推定 |
| HeightContrast | 0〜5、5程度採用※推定 |
| Color（8Kオーバーレイ合成比） | 0.5〜0.7、0.5前後採用※推定 |
| NormalIntensity | 0.3採用 |

#### 確信度が低い抽出
- Tiling値「0.03」
- HeightContrast最終値「5」
- Color（8Kオーバーレイ）最終値（0.5/0.3/0.7/0.6の言及あり）

---

### 150:00–180:00 — 岩マテリアルSlopeマスク・MPC・Landscape統一・階段/床Collision

#### 作業手順
- **[150:14]–[152:53]** Slope Maskノード作成、**Material Parameter Collection（MPC_RockMaster※推定）**新規作成：Vector「Slope Angle」、Scalar「Slope Contrast」、Vector「Fall Off」
- **[155:49]–[156:44]** Material Blend Standardで Base Material（岩）とTop Material（Slope）をブレンド。完成マテリアルを既存Material InstanceのParent Materialに差し替え
- **[156:53]–[160:42]** MPC側の値変更で全岩に一括反映。**Bridge側で事前にMaster Material指定してからAdd**すると新規アセットに自動割当（都度手動置換不要）
- **[161:31]–[165:01]** Landscape側にも同じマテリアルをブレンド。ノーマル過剰光沢はClamp+Multiply（×2→×4）で抑制。新規レイヤー追加時はShared確認を忘れずに
- **[168:09]–[178:00]** プレイヤー開始エリア造形（Flatten）、床・階段配置、**Modeling Mode→Mesh to Collision**（Convex Hulls、Per Mesh Component）でCollision生成。干渉箇所はDuplicate→Triangle Selection→Delete
- **[174:56]** Collisionが実用に合わない場合はComplex Collision（Use Complex Collision as Simple）に切替

#### 判断基準・コツ
- MPCを使う理由：個別マテリアルに値を持たせると一括調整が地獄になる（SCRAP BLITZ UEの敵Registry化・SBLootCommonと同型の思想）
- Bridge側で先にMaster Material指定：「あとで直す」より「入口で決める」方が事故が少ない
- Slope Maskを軸（Vector）で持たせる理由：環境ごとに向きが違う表現を同じマテリアルで使い回せる
- Landscape側にも同レイヤー追加：アセットと地形のマテリアルが別系統だと継ぎ目が破綻する
- Mesh to CollisionをStatic Mesh Editor内蔵より優先：汎用アセットは要件最適化されたCollisionを持たないため
- Complex Collisionへのフォールバック：Convex Hullで不具合が出た場合のみの妥協策
- プレイテストを都度挟む（SCRAP BLITZ UEのautopilot検証と同じ思想）

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| MPC: Slope Contrast | デフォルト1（0/1/5で試行） |
| MPC: Fall Off | デフォルト1→最終≒0.5※推定 |
| ノーマル光沢抑制Multiply | ×2→×3→最終×4 |
| Mesh to Collision Policy | Per Mesh Component |
| Mesh to Collision Simplify | Convex Hulls |

#### 確信度が低い抽出
- MPC名称「MPC rock master」
- Fall Off最終値「zero five」→0.5と解釈
- "Slope Contrast"というパラメータ名（ASR"chip/cheap contrast"）

---

### 180:00–210:00 — Collision調整・見せたくない部分のブロッキング・PLI実演

#### 作業手順
- **[180:29]–[181:11]** Mesh to Collision（Max Hull Count約100※推定、Hull Precision約4※推定）
- **[182:39]** 「Landscapeのテクスチャだけでは環境は良く見えない。メッシュを置く必要がある」方針明言
- **[183:03]–[188:15]** Flattenでピンポイントに地形均し→岩配置。地形・メッシュ境界の不自然な直線はメッシュ回転・バリエーションで崩す
- **[186:33]** MPCのFalloffパラメータ調整（4→1、緑苔の出現量制御）
- **[189:35]–[190:26]** **Packed Level Actor化実演**：Pivot「center, minimum Z axis」、"Mass_around_small_01"として保存。以後複製・回転で量産
- **[191:12]** Virtual Textureへの言及（時間がかかるが有効、本チュートリアルでは省略）
- **[196:34]** 非一様スケール上限の経験則：1.75倍程度までは人間の目にスケール差が気づかれにくい（Epic社内研究への言及、出典未確認）
- **[199:54]** 大きめの岩を「不完全な部分を隠す蓋」として活用
- **[201:44]–[206:51]** Player Start配置→実プレイ確認→階段・Floor調整、Collisionはケースバイケース（Convex Hull基本、すり抜けはComplex Collisionへ）

#### 判断基準・コツ
- テクスチャだけでは環境は良く見えない：メッシュ物理配置で説得力を出す
- Flattenはピンポイントに（全体を均さない）
- 境界を隠す3手法：Landscapeペイント／Closed mesh／大きめの岩を蓋にする
- 反復使用のバレ防止：回転・複製・非一様スケール（1.75倍まで許容の経験則）
- Packed Level Actorの使いどころ：似た配置の繰り返しをグループ化して量産速度を上げる
- プレイテスト駆動：「プレイヤーが見ない場所を装飾する意味はない」という明確なコスト意識
- Collisionはケースバイケース：基本Convex Hull、不具合時のみComplex Collision
- MPCでの一括調整：環境全体のトーンはシーン内マテリアルでなくMPC経由が効率的

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| Mesh to Collision Max Hull Count | 約100※推定 |
| MPC Falloff | 4→1（最終1.0） |
| 非一様スケール上限経験則 | 1.75倍 |
| Packed Level Actor名 | "Mass_around_small_01" |
| Packed Level Actor Pivot | Center, Minimum Z axis |

#### 確信度が低い抽出
- Collision生成のMax Hull Count「100」/サイズ「4」
- 「1.75倍」の出典（UE3時代のEpic社内研究、一次資料未確認）
- Convex HullのTarget Max Countを50→10に変更した文脈

---

### 210:00–240:00 — セットドレッシング仕上げ（大→中→小・PLI量産・進行誘導）

#### 作業手順
- **[210:00]–[214:43]** カーゴ小物追加、中規模建物（コントロールステーション）配置でバリエーション
- **[216:16]** **「大→中→小」の順で密度を上げる**方針明言
- **[217:11]–[218:00]** ソーラーパネル群を**Packed Level Instance化**（`Level→Create Packed Level Instance`、`Mass_SolarPanel`※推定として保存）。「相対的に理解できる要素」でスケール感を演出
- **[220:56]–[221:22]** 大きい建物を90度回転させ「この先には進めない」を暗示する障害物として配置（進行方向誘導）
- **[222:32]–[223:22]** Megascans地面装飾を複製→UVマッピング解除→Packed Level Instance化（`Mass_Ground_Mole_02`※推定）
- **[224:59]–[225:38]** プレイテストで障害物が意図せずプレイヤーを塞いでいないか確認
- **[229:00]–[233:04]** 橋パーツをスケール-1倍（ミラー）+90度回転で配置。見えない奥エリアはLandscape精度を落とし岩でごまかす（「どうせ見えないから」が判断基準）
- **[233:04]–[239:59]** 「建設中」「岩に破壊された」という簡易ストーリーで統一感を省力化

#### 判断基準・コツ
- 大→中→小の順で密度を積む：小物を先に置くと大配置変更で無駄になる
- 小物はスケール感演出の道具：絶対サイズが人間に馴染みのある物（ソーラーパネル・衛星）で周囲の巨大さを逆算的に伝える
- プレイテストを配置の正誤判定に使う：「エディタで良い」と「歩いて自然」は別軸
- 障害物は進行方向の誘導に使う：無言のレベルデザイン言語
- 見えない場所には手間をかけない：視認範囲にリソース集中
- 繰り返し使う組み合わせはPacked Level Instanceにまとめる
- 「壊れている・建設中」の演出は説明コストが低い
- キットのパーツは本来の用途に縛られず流用してよい（プロトタイピング段階ではcomposition優先）

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| ソーラーパネルスケール | 15※推定（大）/5※推定（小〜中） |
| 障害物プロップ回転 | 90度 |
| 橋パーツスケール反転 | ×(-1) |
| PLI名称例 | `Mass_SolarPanel`※推定、`Mass_Ground_Mole_02`※推定 |

#### 確信度が低い抽出
- スケール数値「15」「5」の正確性
- PLI命名（"Mass polar panel"→solar panel、"around mole 0 2"）の実際の綴り
- 「remove the mapping」（UVマッピング解除）の具体的操作内容

---

### 240:00–273:17（最終区間） — 大気・ライティング・ポストプロセス・World Partition・宇宙船統合

#### 作業手順
- **[241:13]–[245:07]** Sky Atmosphere調整：**Volumetric Cloud除去**（地球っぽさを消す最初の一手）、Planet Radius≒12000※推定、Albedo紫系、Absorption Scale最小限
- **[245:09]–[247:53]** **Detail Lightingモード（Alt+5）**で作業：Directional LightのIndirect Lighting Intensity=0、Intensity=10〜100の極端値で影の形を確認→Ctrl+Lで太陽角度を決定→通常バランス（Skylight=1、Intensity=10）に戻す
- **[247:53]–[257:38]** Post Process Volume（**Infinite Extent/Unbound**）：Bloom（Convolution）、Depth of Field（Focal Distance約100〜120※推定）、White Balance暖色寄り、Contrast約0.93（1.2は過剰と判断）、Film Toe/Shoulder
- **[259:59]–[263:09]** Skylight Intensity Scale調整（紫〜ピンク寄りtint）、Directional Light Indirect Lighting Intensity=1維持（10だとGI過剰、0だと出ない）、Light Shafts（God Rays）
- **[263:09]–[264:16]** Exponential Height Fog：Volumetric Fog有効化、Extinction Scaleが最も影響大
- **[264:16]–[266:23]** **World Partition問題修正**：遠景メッシュが距離ストリーミングで消失→対象メッシュのDetailsパネルで**`Is Spatially Loaded`をOFF**にして常時ロード化
- **[267:57]–[271:34]** 別プロジェクトの宇宙船アセットを**Migrate**機能で統合。GameModeをGM_Minervaに変更。テクスチャストリーミング対策として`r.Streaming.PoolSize 8000`※推定を投入

#### 判断基準・コツ
- クラウド除去は「地球っぽさ」という既視感を取り除く引き算の判断（加算的な作業ではない）
- Detail Lightingモードで作業：テクスチャに引っ張られず陰影の形だけで判断する二段階プロセス
- Directional Lightを一時的に極端値にして角度決定→通常値に戻す：光量とアングルを同時調整すると判断がぶれる
- Emissiveが多いレベルでは直射光を弱めても成立する：発光アセットが多いなら太陽光依存度を下げられる
- Post ProcessのInfinite Extent：シーン全体で統一したい場合はUnbound、エリアごとに変えたい場合はボックス範囲
- Contrast/Saturationは「スタイライズ vs リアル」の軸で決める
- **World PartitionのIs Spatially Loadedオフ＝遠景の恒久表示**：2.5D横スクロールの遠景演出にも直接応用できる重要技法
- Migrateワークフロー：機能単位で分割開発し最後に統合する運用
- 大規模レベルでのpop-inは前提として個別チューニングする（完全解消を狙わない）

#### 主要パラメータ
| 項目 | 値 |
|---|---|
| Sky Atmosphere Planet Radius | 約12000※推定 |
| Directional Light Indirect Intensity（最終） | 1 |
| Post Process Depth of Field Focal Distance | 100〜120程度※推定 |
| Post Process Contrast | 約0.93 |
| r.Streaming.PoolSize | 約8000※推定 |
| World Partition Is Spatially Loaded | OFF（遠景固定表示メッシュに適用） |

#### 確信度が低い抽出
- Depth of Fieldのパラメータ名と最終値（Focal Distance vs Blur Size相当の対応関係）
- コンソールコマンド`r.Streaming.PoolSize`の正確なコマンド名・値
- Motion Blur除去とFilm Grain追加の順序・タイムスタンプ対応

---

## Fable監査ステータス

**2026-07-04 Fableスポット照合済（幻覚なし）**。doctrine行きの核心3主張を transcript 原文とペア照合：
1. Packed Level Actor作成手順 — [19:43]「create packed level actor」原文一致
2. `Is Spatially Loaded`オフ — ASR崩れ「not especially loaded / word partition / lower partition」[60:27-60:48] を正しく復元していることを確認。「it will not load the meshes based on the distance」[60:42-60:48] で機能説明も一致。[264:36-265:16] の遠景消失対処も原文一致
3. 非一様スケール1.75倍則 — [196:53]「I find that 1.75 it's a number that people won't be able to…」原文一致

各区間の「確信度が低い抽出」（数値の桁・単位系）は自己申告どおり※推定として残存。実装時に映像確認すること。
