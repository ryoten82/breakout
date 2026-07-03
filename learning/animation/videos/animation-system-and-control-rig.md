# 学習ノート — UE5 アニメーションシステム概観 + Control Rig Asset作成手順

- ソース1: Skeletal Mesh Animation System in Unreal Engine（目次的ハブページ）
  https://dev.epicgames.com/documentation/en-us/unreal-engine/skeletal-mesh-animation-system-in-unreal-engine
- ソース2: Rigging with Control Rig in Unreal Engine（Control Rig Asset作成の実操作ページ）
  https://dev.epicgames.com/documentation/en-us/unreal-engine/rigging-with-control-rig-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript:
  - [../transcripts/skeletal-mesh-animation-system.md](../transcripts/skeletal-mesh-animation-system.md)
  - [../transcripts/rigging-with-control-rig.md](../transcripts/rigging-with-control-rig.md)

## UE5 アニメーションシステムの全体マップ

Unreal Engineのキャラクターアニメーションは **Skeletal Mesh**（リグ付きメッシュ。操作してアニメーションを作れる）を土台にしている。**Animation Blueprint** を Skeletal Mesh に付加することで、アニメーション挙動やレベル内での相互作用を制御するロジックを適用できる。

公式ドキュメントは、この領域を以下の7カテゴリに整理している（原文はカテゴリ名の列挙のみで、各カテゴリの詳細内容には踏み込んでいない）。

1. **Animation Editors** — Skeleton Editor / Animation Sequence Editor / Skeletal Mesh Editor
2. **Animation Blueprints** — アニメーション挙動をビジュアルスクリプトできるシステム。animation blending・スクリプトによる相互作用・procedural behaviorの制御が可能
3. **Animation Assets and Features** — 各種アニメーションアセットとその機能（種類の詳細はソースになし）
4. **Live Link** — 外部DCC（Digital Content Creation）環境からリアルタイムでアニメーションデータをストリーミングするツール
5. **Debugging and Optimization** — パフォーマンス・トラブルシューティング用リソース
6. **Workflow Guides and Examples** — アニメーションツールキットのチュートリアル・実例
7. **Animation Shortcuts and Tips** — 効率化ワークフロー・ショートカット・コンソールコマンド

## Control Rig Asset の作成手順（2通りの方法・使い分け）

Control Rig Editorは、Content BrowserからControl Rig Assetを開くと表示される。Assetの作成方法は2通り。

**方法1: Skeletal Mesh Assetから右クリックで作成**
Skeletal Mesh Assetを右クリック →「Create > Control Rig」を選択。同じディレクトリに「_CtrlRig」サフィックス付きでControl Rig Assetが自動生成される。Assetをダブルクリックして開く。

**方法2: Content Browserから手動作成**
Content Browserで「Animation > Control Rig」を選択して手動でControl Rigを作成。ポップアップウィンドウで「ControlRig」を選択し「Create」をクリック。Assetをダブルクリックして開く。

この方法の場合、開いた後に **Skeletal Meshを手動で割り当てる追加作業が必要**。「Rig Hierarchy」タブの「Import Hierarchy」をクリックし、対象のSkeletal Meshを指定する。

両者の違いをまとめると、方法1は対象のSkeletal Meshが最初から決まっている場合の直結ルート（自動命名・自動割り当て）、方法2はSkeletal Mesh未確定の状態からAssetだけ先に作る、または既存のControl Rig Assetを別のSkeletal Meshに向け直す場合に使う手順、と読める（この解釈自体はソースの記述からの整理であり、原文がこの使い分けを明言しているわけではない）。

なお、原文はこの後「リギング機能」の見出しに続き機能一覧を挙げようとしているが、取得できたソースはその手前で途切れている（詳細は下記「ソースの限界」参照）。

## SCRAP BLITZ に活かせる部分

本プロジェクトはUE5.8でキャラクターアニメーションを制作中で、Control Rigベースのモーション制作パイプラインを実運用している（motion-roomという専用部屋があり、公式MCP経由でキー打ちモーション制作を行っている実績あり）。既存パイプラインが2方式のどちらの作成経路を採用しているかは本調査では確認していないため、以下は一般的な判断材料として整理する（実際の運用がどちらかは断定しない）。

- 新規キャラを追加する際、対象のSkeletal Meshが最初から確定しているなら方法1（右クリック作成）の方が手数が少ない。自動命名（`_CtrlRig`サフィックス）と自動割り当てが一度に済むため。
- 既存のControl Rig Assetを別のSkeletal Meshで使い回したい場合（例: 同一骨格を共有する複数キャラ、あるいはリターゲット検証用に一時的に別メッシュへ差し替えたい場合）は、方法2の「Import Hierarchy」による手動割り当てが該当する操作になる。過去に経験した「rest poseが+Y統一でないとリターゲット時に破綻する」「AnimBlueprintのスケルトン不一致でメッシュパーツが崩壊する」といったトラブル（詳細未読・断定しない）は、いずれもSkeletal MeshとControl Rig/AnimBPの紐付けが前提とする骨格情報のズレに起因する類の不具合であるため、方法2の「Import Hierarchy」で骨格を指定し直す操作は、こうした不整合を意図的に検証・修正する手段になり得る（※一般知識で補足: Import Hierarchyは指定したSkeletal Meshの骨格構造をControl Rigの階層に取り込む操作であるため、骨格が変わればRig Hierarchy側も再構築される、という一般的な理解に基づく推測）。
- 既存パイプラインの実際の作成経路（右クリック起点か手動作成起点か）を確認する場合は、motion-room側の運用記録またはScrapBlitz UE内の実アセット（`*_CtrlRig`命名の有無）を見るのが早い。

## ソースの限界

- **Skeletal Mesh Animation System側**: 7カテゴリの名称列挙で止まっており、各カテゴリの詳細（Animation Blueprintsの具体的な使い方、Animation Assets and Featuresの内訳、Live Linkの対応DCCソフトなど）はソースに含まれていない。目次的ページとして取得したための限界であり、詳細は個別ページ側にある。
- **Rigging with Control Rig側**: Control Rig Asset作成の2手順までは具体的に取得できたが、原文はその直後の「リギング機能」一覧の手前でWebFetch取得範囲が途切れている。Control Rigが実際にどのようなリギング機能（コントロール作成、階層編集、IK/FK切り替えなど）を提供するかについては、本ノートには一切含まれていない。
- 両ソースとも監査（Fable等によるスポットチェック）は未実施。冒頭メタ情報の通り「Sonnet単独要約」段階であり、原文との突き合わせ精度は未検証。
