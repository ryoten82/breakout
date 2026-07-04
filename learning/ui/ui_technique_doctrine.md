# UI（UMG）ドクトリン（蒸留版 v1）

Epic 公式スライド 1 本（ペア照合済）+ UI Design シリーズ 3 本 + 画像リファレンス DB 3 件からの横断抽出（2026-07-04 初版）。**日常はこのファイルだけ読む**（上限 3KB）。詳細は `videos/`・`reference/`（Sonnet 委譲）。

## パフォーマンス原則（Epic 公式・p 番号付きで照合済）

1. **負荷原理**: Slate は Fast Path（キャッシュ再利用）/ Slow Path（再生成）。Invalidation は親階層の Draw Element まで再生成 → **深い階層×頻繁な再描画が最悪**。だから階層は浅く・InvalidationBox/RetainerBox で伝播を遮断
2. **チェックリスト**: Canvas Panel 乱用禁止／ScrollBox→ListView（大量アイテム）／**非表示は Hidden でなく Collapsed**（レイアウト計算からも除外）／Tick 削減・非表示時の処理停止
3. **テクスチャ**: NoMipmaps・TextureGroup「UI」・2048²以下。**レベル切替まで残留**→ソフト参照で読み捨て
4. **計測**: Slate Insights（CPU）/ Widget Reflector（Tree・Visibility）/ memreport

## 機能選定（UE5 世代・対応バージョン照合済）

- **CommonUI**（4.27+・5.3〜Beta）= 入力方法の抽象化・レイヤー管理・パッド/KB アイコン自動切替。UMG 本格拡張時の第一候補
- **UMG ViewModel**（5.1+・Beta）= MVVM でデータと Widget 分離。現行 SBComboHUD の Canvas 直書きとは別アーキテクチャ、UMG 化時の比較材料
- UMG Preview（5.5+ Exp）= PIE なし確認 `UMG.EnablePreviewMode 1`／SlateIM（5.6+ Exp）= imgui 代替（デバッグ UI 向け）
- クラス選定: UserWidget=表示用 / CommonActivatableWidget=フルスクリーン・モーダル

## 構築定型（UE5.3 動画・現行 5.8 でも通用と判断）

- **テーマ管理**: 共通親 Widget + 構造体 + DataTable(RowHandle) で全 UI の色/テクスチャを一括差替
- ⚠**子の Pre Construct は親を自動で呼ばない** — Add Call to Parent Function 必須（親の変数が未初期化のまま参照される罠）
- ⚠Image は **Draw As=Image**（デフォルト Box は歪む）／⚠画像インポート直後は **Save All してから** Widget 保存（参照切れ・変更消失）
- レイアウト: **Size Box=実寸固定 / Scale Box=追従スケール**。スナップ基本 ON・辻褄が合わない箇所だけ OFF。z-fighting は片方を微拡大
- 状態別スタイル: Set Style + Make SlateBrush（Normal/Hovered/Pressed/Disabled）。バリエーションは Bool+Select ノードで出し分け（Widget を増やさない）
- ⚠スタイルを別 BP クラスの変数で持つ手法（動画流）より、現行は Widget Style Asset / DataAsset がモダン

## 見た目リファレンス（reference/ 実機観察の要点）

- BlazBlue（同ジャンル 2.5D）: 六角形 MP ゲージ・ボス戦時のみ HP バー・横方向バー選択肢／Ghostwire: 常時 HUD と一時通知の共存・ロック理由の数値明示／Concord: 名前+HP 一体型頭上ラベル・キー+CD 塗りつぶし
