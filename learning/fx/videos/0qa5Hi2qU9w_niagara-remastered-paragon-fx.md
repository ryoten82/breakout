# 学習ノート — UE5 Niagara Remastered Paragon FX（概論編・Exploder 変換）

- ソース: https://www.youtube.com/watch?v=0qa5Hi2qU9w （6:24）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\0qa5Hi2qU9w.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: 同一チャンネルによる姉妹動画 `sq6lSKhX_DA`（"remastered the character effect in Paragon"）が存在するが、本セッション時点で対応する学習ノートは未作成（`fx/videos/` に該当ファイルなし）。字幕を参考取得したところ、姉妹動画はキャラクター系エフェクト（黒い穴・meteor・cast 等 約20種）を次々変換しながら、Color→Particle Initial Color 変更・SizeByLife カーブの作り直し・Dynamic Material Parameters の Spawn/Update 分離といった**一般的な Cascade→Niagara 変換エラーの直し方チェックリスト**を示す内容。対して本ノートの動画は Epic 公式無料マーケットプレイス企画の紹介から入り、Exploder エフェクト1本に絞って変換〜個別調整までを追う**概論・導入編**という位置づけの違いがある

## 概要

Epic Games が Marketplace で無料公開している3プロジェクト（Paragon 関連アセット群）の紹介から始まり、その中の Paragon FX を題材に、Cascade で作られたビジュアルエフェクト（Exploder）を Niagara に変換する一連の作業を実演する動画。UE4 時代からある「Cascade to Niagara Converter」プラグインを使い、変換後に出る警告・エラーを1つずつ潰していく流れが主題。

## Cascade→Niagara 変換の基本ワークフロー

1. Plugins 検索で `niagara` と入力し、**Cascade to Niagara Converter** を有効化してプロジェクト再起動
2. Content Browser 上で対象の Cascade System を右クリック → Convert to Niagara System
3. 変換直後の Niagara System には複数のノードにエラー・警告の矢印アイコンが付く（プラグイン自体が UE4 時代から更新されておらず、変換ロジックに古さがあるためと動画内で言及）

## 本動画で実際に直したエラー・差分（Exploder エフェクト）

- **不要な Dynamic Material Parameters ノードの削除**: 変換で自動生成されるが今回のエフェクトでは不要なため、警告が出ていたこのノードごと削除して解消
- **Loop 設定を Infinite に変更**: 全 Emitter の Loop Cycle を Infinite に変更（Cascade 側の元の挙動に合わせるため。※推定：どのモジュールの Loop Cycle かは字幕上明示されず「all emitter to infinite」とのみ）
- **回転方向の符号ミス修正**: Cascade 側では回転していたはずが変換後に停止して見えた（"rotation is update"※推定＝rotation が更新されていない/挙動が違う、の意と解釈）問題を、該当パラメータの符号を **negative → positive** に反転して解消
- **スケールの Dynamic Material Parameter 化**: Cascade 側と見た目のスケールが違う問題を調査し、該当 Emitter で「Position of Site」というパラメータ（※推定：字幕の音声認識精度が低く正式なパラメータ名不明。文脈上おそらく DMP の特定チャンネルを指す）を Dynamic Material Parameter 経由で **0 に設定**することで Cascade と近い見た目に揃えた
- 上記の調整後、Cascade 版とほぼ同等の見た目に到達したと動画内で確認

## 新規性のある技術情報（既存ドクトリンとの比較）

- 既存ドクトリンには Cascade→Niagara 変換ワークフロー自体の記載がなく、本ノートが**変換プラグインの存在と基本手順（プラグイン有効化→右クリック変換→エラー矢印を個別に潰す）を扱う初のノート**
- 「変換直後は複数のエラー/警告ノードが自動生成され、それを1つずつ手動で直す」という運用パターンは、doctrine の「一度だけ=Spawn、継続=Update」等のスタック設計原則とは別軸の**移行作業（migration）特有のノウハウ**であり、既存記述と重複しない
- 姉妹動画（sq6lSKhX_DA）で判明している「Color を Particle Initial Color に、Size を SizeByLife カーブ再構築に、DMP を Spawn/Update 分離に直す」という定型パターンと合わせて読むと、Cascade→Niagara 変換エラーには**再現性のある定番の直し方セット**が存在することが伺える（本ノート単体では Loop/回転符号/DMP スケールの3点のみ確認）

## SCRAP BLITZ UE への応用メモ

- 本プロジェクトは新規 Niagara アセットとして構築しており、Cascade 資産の移植は現状の作業対象に含まれない。ただし Fab/Marketplace から Cascade ベースの無料 FX アセットを将来的に導入する場合（[[setup_scrapblitz_ue_worktree_fab_assets]] で導入実績のある外部アセット運用と同じ文脈）、変換直後に「Loop Cycle」「回転符号」「DMP のパラメータゼロ化」あたりを疑って確認するチェックリストとして流用できる
- 「Cascade to Niagara Converter」プラグイン自体が古く変換結果に手直しが要る、という前提を踏まえると、外部 Cascade 資産を導入する際は**変換後に必ず参照元（Cascade 版のプレビュー）と見比べる工程を挟む**運用が安全

## ソースの限界

- 英語自動字幕のみで、専門用語（パラメータ名・モジュール名）の音声認識誤りが多い動画。特に「rotation is update」「position of site」等、文法・単語とも不自然な箇所は正式名称を特定できず「※推定」止まりとした
- 動画内で実際に操作されているノードグラフの詳細な接続（どのモジュールのどの入力ピンか）は字幕からは追えず、操作の結果と大まかな手順のみをノート化した
- 姉妹動画（sq6lSKhX_DA）は本タスクの対象外のため字幕を参考程度に確認したのみで、詳細な技術情報の抽出・ノート化は行っていない（重複回避の判断材料として要旨のみ記載）
