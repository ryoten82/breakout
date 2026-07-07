# 学習ノート — Epic公式コース「Introduction for Gameplay Animation」（配布スライドPDF）

- **ソース種別：Epic公式コースの配布スライドPDF（Lab Slides）**。動画のCC字幕ではなく、コースページから正式配布されているスライド資料そのものが一次情報源。コースページ自体はSPA構成でWebFetch不可のため長く「Chrome拡張復旧待ち」でスキップ扱いだったが、Chrome拡張導入によりコースページ経由でPDFへ到達し取得できた
- 元コースURL: https://dev.epicgames.com/community/learning/courses/AbW/unreal-engine-introduction-for-gameplay-animation/
- スライド内表記のエンジンバージョンは **5.5**（コース案内上は5.7表記だが、配布PDF自体の扉ページには5.5と記載。改版差の可能性があるが本ノートはPDF記載通りに扱う）
- 抽出方法: PDF → `pdftotext -layout` でテキスト化 → 全文Read → Sonnet単独要約（監査待ち）
- 学習日: 2026-07-07

---

## コースの実際の構成（スライド扉ページのOutlineベース）

配布PDFの冒頭Outlineは以下の4項目（ユーザー提示の9モジュール構成説明とは粒度が異なり、PDF自体はこの4本立てで進行する）：

1. Animation Editors and Features
2. Importing/Exporting Animation Assets
3. Skeleton, Mesh and Animation Sub Editors
4. Creating new animation assets（Sequencerでの実制作パート）

## アニメーションの3系統（Input / Linear / Live Link）

スライドはゲームエンジン内でのアニメーション制作を3つの入力経路に分類している。既存ノート（`animation-system-and-control-rig.md`）はこの分類に触れていないため新規情報。

- **Input Animation**: プレイヤー入力やコントローラ入力をコードでバインドし、Movement Componentを介してリアルタイムに駆動するアニメーション。キャラクター（Pawn）はController に possess され、二足・四足・車両などなんでもよい
- **Linear Animation**: FBX（キーフレームアニメーション）やAlembic（フレームごとの生キャッシュ）でベイク済みアニメーションを持ち込み、Sequencerに適用する経路。Control Rigでキーフレームを直接打つ手法も含む
- **Live Link**: モーションキャプチャスーツやMaya等の外部DCCからリアルタイムでアニメーションデータをストリーミングするプラグイン。Take Recorderと組み合わせ、マウス/キーボード操作を録画しながらSequencer内で既存アニメの上に重ね録りする「レイヤリング」ワークフローに言及がある

## Root Motion（新規：本コース特有の技術情報）

既存のanimationドメインノート3本にはRoot Motionの記述がなく、本コースで初めて言及される概念。

- **定義**: スケルトンのRootボーンが持つアニメーションデータでキャラクターの移動そのものを駆動する方式
- 通常はMovement Componentが移動を主導し、AnimBPは「その場でループする」アニメーション（in-place authored）を再生するだけ。Root Motionを有効にすると逆になり、アニメーションのRoot bone移動量に従ってキャラクターが動くようになる
- **注意点**: MixamoなどのアセットはRootボーンが無い、または想定と異なる位置にあることが多く、そのままではRoot Motionが機能しない
- **スケルトン設計ルール**（原文が明記する制約）:
  - スケルトンは Root bone を1本だけ持つべき
  - Rootは (0,0,0) から中心ボーン（例: Hip）へ伸びる構造にする。これがRoot Motionを成立させる前提になる
  - 浮遊ボーン（親から浮いた孤立ボーン）は「別スケルトン」扱いになってしまうため避ける
  - Twistボーンをinlineで作らず、手首等に別途parentする形にするのがベストプラクティス（leaf boneを増やさない）
  - 階層はHipボーンを起点に、Thigh/SpineをHipから、Spine先にClavicle/Neckを繋ぎ、顔ボーンはHeadボーンに付属させる（顔はモーフまたはボーン駆動）

## スタジオパイプライン比較（Premade vs In-Editor）

スライドは大規模スタジオの制作フローを2種類の図解で示している。

- **Premade Animation Pipeline**: 別DCCでモデリング/リギング/アニメーションを完了させ、完成アニメーションをUEにインポートする経路。Sequencer上ではベイク済みアセットからのブレンド/加重合成やAdditive合成を行う。仕上げ段階で「Edit with FK Control Rig」または「bake to control rig」でSequencer内修正が可能
- **In-Editor Animation (Control Rig & Procedural Rigging) Pipeline**: エンジン内でControl Rigを手動構築、または複数キャラへ使い回せる手続き型リグをテンプレートとして構築し、Level Sequence上でキーフレーミングする経路。Skeleton Mesh Editing Tools（プラグイン提供）でエンジンを離れずにリグ〜アニメまで完結できる、という位置づけ
- 実写/大規模制作向けの「Typical Animation Studio Pipeline」「Realtime Animation Studio Pipeline」の工程図も掲載されているが、これはEpic社内の大規模パイプライン例示であり、SCRAP BLITZ規模のプロジェクトへの直接適用は想定しにくい（参考情報として記載のみ）

## FBXエクスポート/インポート・パイプライン（新規性が高い技術情報）

既存animationノート3本はUE内部（Control Rig Asset作成・Editor操作）に閉じており、DCC側のエクスポート設定やUE側インポート設定は未収録。本コースが初めてこの領域を扱う。

**DCC側エクスポート設定の要点（Maya/3DS Max/Blender）**:
- Maya: メッシュとジョイントチェーンルートを選択し「export selected」→ .fbx形式。Animationsチェックボックス・Smooth/Deforms含める設定・複雑な変形はAlembicでベイクする選択肢がある。注意点として「Smooth Mesh」は無効化、「Smoothing Groups」は有効化しておく
- 3DS Max: Maya用エクスポータとの差はほぼ無いとされる
- Blender: 標準のFBXエクスポートに加え、Epic製の「Send to UE」プラグインでメッシュだけでなくリグごと書き出せる。Blender版設定はMaya/Maxと異なる点が多く、Forward軸が-Y（UEは+X）である座標系差異への注意、Armatureで「Add Leaf Bones」を無効化、Smoothing Groups相当が無いためAuto-Smooth/Edge Split/Apply Modifiersで代替、Baked Animationのチェックを外す、といった個別設定が挙げられている。スケール差（Blenderは1m/unit、UE5は1cm/unit）にも要注意との指摘あり

**UE側インポート**:
- 初回インポート時はメッシュとスケルトンを同時にインポートする必要がある。「Filter on Contents」でソースアセットに応じた選択肢に絞り込み、後続でImport Animationsのチェックを外す運用が説明されている
- アニメーションのみのインポートでは、対象Skeletonの指定、アニメーション長の決定方式（Source Timelineそのまま／Animated Timeで有効区間のみ／Set Rangeで手動範囲指定）、Sample Rate（デフォルト30fps）、Import Bone Tracksの設定がある
- Transform設定で誤った回転を補正できるが、原文は「DCC側で直すのがベスト」と明記
- 再インポートはContent Browser上の右クリックまたはSkeletal Mesh Editor内の右クリックから可能。Import Settingsの値がそのまま再インポートに引き継がれる
- 購入済みアニメーションアセットの追加時は、付属スケルトンがUE互換であっても大半はリターゲットが必要になる、という運用上の注意も含まれる

## Sub Editors 概観（既存ノートとの補完関係）

既存ノート（`animation-system-and-control-rig.md`）は7カテゴリの名称列挙のみで各カテゴリの中身に踏み込めていなかった。本コースはそのうち「Animation Editors」に相当する部分を、A〜Eのアイコンで具体的に補足している。

- A: **Skeleton Editor** — スケルトンの検証・編集、ソケット追加、ボーン挙動テスト
- B: **Mesh Editor** — LODインポート、デフォルトマテリアル割り当て、Morph Target管理
- C: **Animation Editor** — Animation Sequence / Blend Space / Montageの作成・編集。「Edit with FK Control Rig in Sequencer」機能やAnimation Notify追加もここに含まれる
- D: **AnimBP Editor** — Event Graph（ロジック・変数）とAnimGraph（ブレンド制御フロー）の2画面構成。ステートマシンや各種ブレンドをここで組む
- E: **Physics Editor** — Skeletal Mesh用のコリジョンボディの作成・編集

## Sequencerでのアニメーション制作（第4モジュール実践パート）

既存ノートにはSequencer実制作の記述が一切なく、これも新規領域。

- Sequencerは「Cinematic and Video creation tool」であり、ランタイム再生・動画書き出しの両対応。ゲームプレイ用アニメーションの制作（ベイクアウト）にも使え、イベントのトリガー送受信・Curve Editorも備える
- **Animation Mode**（ドロップダウンから切替）配下にPoses / Tweens / Snapper / Trails / Layers / Pivotといった編集支援ツールがあるという言及（各ツールの詳細な操作手順は原文になし）
- **Socket作成**: ボーンにアタッチする追加ポイント。ボーンと連動して動き、武器や帽子などのメッシュのアタッチ先として使える。Blueprintから選択可能という利用例も挙げられている
- Sequencer上でSkeletal Mesh用トラックを追加し、タイムライン上でキーフレームを打つ（Enterで新規キー作成）。ソケット付きアイテムをチャンネルとして追加し、ボーンへのバインドとデフォルト空間設定を行った上で、最終アニメーションをベイクアウトする、という一連の流れが示されている

## SCRAP BLITZ に活かせる部分

本プロジェクトはUE5.8で複数キャラクター（c01〜c04等）のアニメーション制作を進めており、motion-roomでControl Rigベースのモーション制作を実運用している。以下は本コースの内容から一般的に判断材料になりそうな点の整理であり、現行パイプラインの実際の設定値・使用有無を確認したものではない。

- **Root Motionのスケルトンルール**（Root boneは1本・(0,0,0)からHipへ・浮遊ボーン禁止・in-line twistボーン禁止）は、既存キャラクターのスケルトン構成がこの制約に沿っているか確認する価値がある。特に「AnimBPのスケルトン不一致でメッシュパーツが崩壊する」といった過去の不具合報告（`animation-system-and-control-rig.md`のSCRAP BLITZ節に記載）は、このルールからの逸脱が一因になっている可能性がある（推測。本ノートの範囲では確認していない）
- **FBXエクスポート時のBlender固有設定**（Forward軸-Y・Add Leaf Bones無効化・スケール単位差）は、モデル/モーション制作にBlenderを使う場合の座標系トラブルの予防チェックリストとして使える
- Sequencerの「Socket作成→メッシュアタッチ」の流れは、武器・装備の一時アタッチ演出の実装手順として参考になる可能性がある

## ソースの限界

- スライドPDFは箇条書き中心で、各操作の具体的な画面遷移・ボタン位置の情報は乏しい（見出しと要点列挙にとどまる箇所が多い）
- 「Under the hood: Animation Tools」以降のSub Editors説明は各エディタの機能名列挙が中心で、AnimBPのステートマシン組み方やAnimGraphの具体的なノード操作までは踏み込んでいない
- Animation Mode配下のPoses/Tweens/Snapper/Trails/Layers/Pivotは名称列挙のみで、各機能の挙動説明は原文に含まれていない
- スライド末尾に姉妹コース「Skeleton Creation and Body Rigging」への言及は無く、本ノートの対象はあくまで「Introduction for Gameplay Animation」1コース分
- 監査（Fable等によるスポットチェック）は未実施。本ノートは「Sonnet単独要約」段階であり、原文との突き合わせ精度は未検証
