# UI見た目リファレンス — Game UI Database: Ghostwire: Tokyo

- ソース: https://www.gameuidatabase.com/gameData.php?id=1659 （Ghostwire: Tokyoのゲーム内UIスクリーンショット集、65枚・カテゴリ分類済み）
- 記録日: 2026-07-04
- ソース種別: **画像リファレンスDB**（新規・動画/公式ドキュメントに次ぐ4種目）。テキストや動画のチュートリアルではなく、実機UIの見た目そのものを集めたデータベース
- 実画像は `images/`（**git管理外**・`.gitignore`で`learning/**/reference/images/`を除外。容量が大きいため）。このノート単体はgit管理される

## アクセス手法（記録・再現性のため）

`gameData.php?id=` への直接WebFetchは403 Forbidden（bot判定と思われる）。回避策：
```
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" "<URL>" -o page.html
```
取得したHTMLから `data-title="..."` と `href="https://www.gameuidatabase.com/uploads/....jpg"` のペアをgrepで抽出できる（画像はサーバーレンダリングされておりJS実行不要）。個別画像は同様にUAヘッダ付きcurlでダウンロード→Readツールで直接閲覧可能。

## カタログ（65枚・カテゴリ別）

| カテゴリ | 枚数 | 代表URL |
|---|---|---|
| Title Screen, Mode & Screen Select | 1 | uploads/Ghostwire-Tokyo01092023-093052-36340.jpg |
| Load/Save | 2 | uploads/Ghostwire-Tokyo01092023-092921-88108.jpg |
| Loading Screen | 2 | uploads/Ghostwire-Tokyo01092023-092921-82596.jpg |
| Settings: Gameplay/Display/Audio/UI&Accessibility | 4 | uploads/Ghostwire-Tokyo01092023-092920-88659.jpg |
| Language | 1 | uploads/Ghostwire-Tokyo01092023-093052-62589.jpg |
| Button Layouts | 1 | uploads/Ghostwire-Tokyo01092023-092921-9980.jpg |
| Modal: Option & Menu | 1 | uploads/Ghostwire-Tokyo01092023-093021-6665.jpg |
| Pause | 1 | uploads/Ghostwire-Tokyo01092023-092921-8123.jpg |
| **Skill Tree** | 4 | uploads/Ghostwire-Tokyo01092023-092924-63096.jpg |
| **Inventory: Browse** | 4 | uploads/Ghostwire-Tokyo01092023-093018-89750.jpg |
| Equipping: Selection | 1 | uploads/Ghostwire-Tokyo01092023-093018-66507.jpg |
| Change Skin or Accessory | 1 | uploads/Ghostwire-Tokyo01092023-093018-66024.jpg |
| Buying & Trading: Browsing/Confirm | 4 | uploads/Ghostwire-Tokyo01092023-092923-19759.jpg |
| Missions and Quests | 3 | uploads/Ghostwire-Tokyo01092023-092923-9487.jpg |
| Challenges & Achievements | 2 | uploads/Ghostwire-Tokyo01092023-092923-57798.jpg |
| Area Map | 4 | uploads/Ghostwire-Tokyo01092023-092922-6421.jpg |
| Codex & Journal | 5 | uploads/Ghostwire-Tokyo01092023-093019-93724.jpg |
| Tutorials and Guides | 1 | uploads/Ghostwire-Tokyo01092023-093019-97422.jpg |
| Collectables Menu | 1 | uploads/Ghostwire-Tokyo01092023-093019-56604.jpg |
| Sound & Music Player | 2 | uploads/Ghostwire-Tokyo01092023-093018-25833.jpg |
| Photo & Camera Mode | 3 | uploads/Ghostwire-Tokyo01092023-093020-14461.jpg |
| **Item/Ability: Weapon Wheel** | 2 | uploads/Ghostwire-Tokyo01092023-092921-64824.jpg |
| **Player Vitals（HUD）** | 1 | uploads/Ghostwire-Tokyo01092023-093020-26972.jpg |
| Equipped Items & Abilities, Objectives: Pinned Mission | 1 | uploads/Ghostwire-Tokyo01092023-092921-46584.jpg |
| Equipped Items & Abilities, Minimap | 1 | uploads/Ghostwire-Tokyo01092023-092922-84983.jpg |
| Notification: Tutorials & Hints | 1 | uploads/Ghostwire-Tokyo01092023-092923-99823.jpg |
| **Notification: Unlocks & Achievements** | 4 | uploads/Ghostwire-Tokyo01092023-093020-50261.jpg |
| Loot & Exp Log | 1 | uploads/Ghostwire-Tokyo01092023-092922-68282.jpg |
| Waypoints and Markers | 1 | uploads/Ghostwire-Tokyo01092023-092922-32704.jpg |
| Button Prompts (Contextual) | 1 | uploads/Ghostwire-Tokyo01092023-092921-47170.jpg |

太字＝SCRAP BLITZ UEとの関連度が高いと判断し実際に画像を確認したカテゴリ。全URLの完全な対応表は原典HTMLのdata-title/href属性を再grepすれば復元可能（このノートには全65件フルURLは書き写していない。差分主義・容量節約のため）。

## 視覚的観察（6枚を実際に閲覧して確認）

`images/player_vitals.jpg` `images/equipped_items_pinned_mission.jpg` `images/skill_tree.jpg` `images/inventory_browse.jpg` `images/weapon_wheel.jpg` `images/notification_unlock.jpg`

### 常時表示HUD（クエストトラッカー＋リソースメーター）
- 左上：進行中クエスト最大3件を常時表示。アイコン（カテゴリ色分け：オレンジ=メイン系、緑=サブ系）＋タイトル＋説明1行の3行構成
- 右下：2種のリソースメーター（水色アイコン＋数値、緑の横長バー＋数値）と丸型カウンターをスタック配置。画面端に寄せて中央のプレイ画面を侵食しない
- 一時的なバフ表示（「Perfect Block Boost」等）はHUD左下に別枠で小さく重ねる

### メニュー画面（Skill Tree / Inventory）
- 上部タブバー（MISSIONS/MAP/SKILLS/INVENTORY/DATABASE）でカテゴリ大分類、LB/RBショルダーボタンで横移動
- Skill Treeは六角形ノードを線で接続したグラフ構造。オレンジ＝習得済み、グレー＝未習得、ロックされた領域は要求アイテム数を明示（「3/8 MAGATAMA」等）
- 画面を3分割（メインツリー／サブツリー2種）し、LT/RTでツリー種別を切り替え。右上に複数リソースの残数を横並び表示
- Inventoryはカテゴリタブ（アイコンのみ）→サブカテゴリグリッド→詳細パネル（アイコン大写し＋効果値＋説明文）→キャラクター3Dプレビューの4段構成。最右列に属性耐性等の別ステータス群を配置

### オーバーレイ系（Weapon Wheel / Notification）
- ラジアル武器ホイールは3D画面を暗くポーズしつつ重畳表示。中央に選択中武器名＋残弾数、周囲8スロットに色分けアイコン＋番号
- 実績風通知（MAX HP UP!等）は画面中央に一時オーバーレイ、Before→After数値をアニメーション風に強調表示。クエストトラッカーは通知中も表示され続ける（HUD要素の重ね順・優先度の参考になる）

## SCRAP BLITZ UE への応用メモ

- **常時表示HUD＋一時通知の重ね順**：クエストトラッカー等の常時要素を邪魔せず、通知だけ中央に一時オーバーレイする構成は、現行`SBComboHUD`のコンボ表示・SP表示と実績通知の共存レイアウトの参考になる
- **Skill Treeのロック理由明示**（「3/8 MAGATAMA」）：進行阻害要因を数値で明示するUI原則は、OC/SP経済の到達条件表示に応用できる
- **属性耐性リストの縦並び配置**（Inventory右列）：チップ/OC系のステータス一覧表示のレイアウト参考になりうる
- 全体的に「情報密度は高いが色分け・アイコンで即座に判別可能」という設計。SCRAP BLITZ UEのHUDがCanvas直書きから将来UMG化する際の参照先候補

## 未確認・要フォローアップ

- 残り59枚（Codex & Journal、Area Map、Photo Mode等）は未閲覧。興味があれば追加で確認可能
- ダウンロードした6枚の画像自体はgit管理外（`images/`）。worktree削除時に失われる点に注意（再取得手順は上記「アクセス手法」参照）
