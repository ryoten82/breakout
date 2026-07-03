# SOURCE: Rigging with Control Rig in Unreal Engine
URL: https://dev.epicgames.com/documentation/en-us/unreal-engine/rigging-with-control-rig-in-unreal-engine
取得方法: WebFetch（全文再現プロンプト・日本語訳で返ってきた。詳細な操作手順まで取得できた良質ソース）
取得日: 2026-07-04

---

Unreal Engineでキャラクターをアニメーションさせるには、まずそれに対するコントロールを作成する必要がある。Control Rigには、あらゆる形や大きさのキャラクター向けのユニークなリグを作成するための様々な機能とツールが含まれている。

## Control Rig Assetの作成

Control Rig Editorは、Content BrowserからControl Rig Assetを開くときに表示される。このAssetは次の方法で作成できる。

**方法1:** Skeletal Mesh Assetを右クリックして「Create > Control Rig」を選択する。これにより、同じディレクトリに「_CtrlRig」というサフィックス付きでControl Rig Assetが作成される。Assetをダブルクリックして開く。

**方法2:** Content Browserで「Animation > Control Rig」を選択して手動でControl Rigを作成する。ポップアップウィンドウで「ControlRig」を選択し、「Create」をクリックする。Assetをダブルクリックして開く。

この方法で作成した場合、開いた後、Control Rig AssetにSkeletalMeshを手動で割り当てる必要がある。これは「Rig Hierarchy」タブの「Import Hierarchy」をクリックし、Skeletal Meshを指定することで行われる。

## リギング機能

Control Rigのリギングを支援するために、以下の機能が利用可能（原文はこの先で機能一覧に続くが、WebFetch取得範囲はここまで）。
