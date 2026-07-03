# 学習ノート — Control Rig Editor in Unreal Engine（Epic 公式ドキュメント）

- ソース: https://dev.epicgames.com/documentation/unreal-engine/control-rig-editor-in-unreal-engine?lang=en-US
- 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 学習日: 2026-07-04
- 原典 transcript: [../transcripts/control-rig-editor.md](../transcripts/control-rig-editor.md)

---

## Control Rig Editor の主要パネル（ツールバー/Rig Hierarchy/Details）

**ツールバー**:
- **Compile** ボタン — 「リグの変更を保存し実行開始」する操作。Rig Hierarchy 内での変更時に必須と明記されている
- **Solve Direction** — 異なるソルバーイベントチェーンをプレビューできる機能（原文はこの一行の説明のみで、ソルバーイベントチェーンの具体的な種類や切り替え手順には踏み込んでいない）

**Rig Hierarchy パネル**: Controls・Bones・Nulls を作成・管理するエリア。右クリックメニューから新規作成・削除・複製・リネーム・ミラー処理が可能。

**Details パネル**: 選択要素（Control・Bone・グラフノード）のプロパティ編集を行う場所。

## Rig Graph でのノード操作（Hierarchy参照・ノード作成・Function化）

Rig Graph 上でのノード操作は以下の3種類が原文に挙げられている:

- **Hierarchyパネルからのドラッグドロップ**: Rig Hierarchy の要素をグラフにドラッグすることで、その要素への参照としてノードを追加できる
- **ノード作成**: グラフ上で右クリックし、検索またはコンテキストメニューのナビゲーションでノードを作成する
- **Function化**: 複数ノードを選択して右クリックし、「Collapse Nodes」または「Collapse to Function」を選ぶことで、選択したノード群を1つにグループ化できる

Function化して作られた Function は、「My Blueprint」パネルの Functions カテゴリからアクセスできる。原文では、これが大規模グラフの整理や論理（ロジック）の再利用に活用できると述べられている。

## 既存ノート（Asset作成）との接続（作成→編集の流れ）

既存ノート [animation-system-and-control-rig.md](animation-system-and-control-rig.md) は、Control Rig **Asset の作成**（Skeletal Mesh から右クリック作成する方法1、または Content Browser から手動作成して Import Hierarchy で骨格を割り当てる方法2）までを扱っていた。

本ノートが扱う Control Rig Editor は、その作成後の Asset をダブルクリックで開いた**先の編集画面**にあたる。既存ノートが「どちらの方法でAssetを作るか」の分岐点だったのに対し、本ノートは「開いた Editor 内で実際にリグをどう組むか」（Rig Hierarchy での要素管理、Rig Graph でのノード配線、Function 化による整理）という一段階先の作業に対応する。

なお、既存ノートの「ソースの限界」で触れられていた「原文はリギング機能一覧の手前で取得範囲が途切れている」という欠落部分について、本ソースがその欠落を埋めているかは検証していない。本ソースは Control Rig Editor という別ページからの抽出であり、両者が同一の欠落箇所を指しているとは限らない点に注意（この点は本ノートの範囲では確認不能）。

## SCRAP BLITZ に活かせる部分

本プロジェクトは motion-room で Control Rig ベースのモーション制作を実運用しており、公式MCP経由でのキー打ちモーション制作実績がある。ただし実際の運用で Rig Graph のノード操作やFunction化をどこまで使っているかは本調査では読んでいないため、以下は一般的な判断材料としてまとめるにとどめ、断定はしない。

- **Function化（Collapse to Function）による再利用**: 原文にある通り、複数ノードをグループ化した Function は「My Blueprint」パネルから呼び出せる。SCRAP BLITZ は複数キャラクター（c01〜c04等）を抱える構成のため、キャラクター間で共通するリグロジック（例: 特定の骨をミラーして反対側に反映する処理など、あくまで一般的にありそうな処理の例示であり、実際に本プロジェクトがそうした処理を持つかは未確認）があれば、Function化して複数キャラのControl Rig間で再利用できる可能性がある。ただし、Function が単一の Control Rig Asset内で閉じるものか、Asset をまたいで共有可能なものかは、本ソースの記述だけでは判断できない（原文に asset間共有の可否についての言及がないため）
- **Solve Direction の使いどころ**: 原文は「異なるソルバーイベントチェーンをプレビュー可能」とだけ述べており、これが具体的にどのような場面で必要になるか（IK/FK切り替えの確認、複数ソルバーの実行順序検証など）は記載がない。したがって「使いどころ」を具体的に断定することはできず、リグの挙動を複数パターンで確認したい場面がある場合の選択肢の一つ、という程度の一般的理解にとどめる
- Rig Hierarchy パネルでの右クリックメニュー（複製・ミラー処理）は、左右対称のキャラクターリグを組む際の定型操作として有用と一般的には考えられるが、これも原文はメニュー項目の存在を述べるのみで、実際のミラー処理の挙動や制約には触れていない

## ソースの限界

- 取得できた原文全体が非常に短く、各機能（Compile・Solve Direction・Rig Hierarchyの右クリックメニュー各項目・Function化）は名称と一行程度の説明にとどまっている。具体的な操作手順（クリック順序、UI上の位置、スクリーンショット相当の情報）は含まれていない
- Solve Direction が切り替える「異なるソルバーイベントチェーン」の具体的な種類・意味は原文に記載がない
- Function化の「Collapse Nodes」と「Collapse to Function」の違い（両者は原文で並記されているが、使い分けの説明はない）は不明
- 作成した Function が Asset内限定か、他の Control Rig Asset とも共有可能かについての言及はない
- Rig Hierarchy の右クリックメニューにある「ミラー処理」の具体的な仕様（何を基準にミラーするか等）は原文に記載がない
- 監査（Fable等によるスポットチェック）は未実施。冒頭メタ情報の通り「Sonnet単独要約」段階であり、原文との突き合わせ精度は未検証。
