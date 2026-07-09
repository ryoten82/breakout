# 学習ノート — UE5 Material Magic Explosion Effect

- ソース: https://www.youtube.com/watch?v=M9dPLByRMTs （4:50）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ**（`--list-subs` で確認済み、手動字幕なし）→ 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\M9dPLByRMTs.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [e0W6SHXPVC8_simple-material-burst-explosion-effect.md](e0W6SHXPVC8_simple-material-burst-explosion-effect.md)（同じ「マテリアル単体で爆発質感」路線だが、メッシュ形状・歪み手法・Niagara有無が異なる）。本動画は**マテリアル制作のみで完結する Part 1**（動画末尾で「次の動画で Niagara に組み込む」と言及、字幕上は "network" と誤認識されているが文脈上 Niagara を指すと推定）

## 概要

両端キャップを削除した**円柱（チューブ状）メッシュ**に、Fresnel エッジマスク＋ノイズ歪みのみのシンプルなマテリアルを適用し、リング状に光る「魔法陣的な爆発エフェクト」の素材を作る動画。Niagara システムは本編に登場せず、**マテリアルエディタの操作のみ**で完結する短尺チュートリアル。

## マテリアルの構築

### メッシュ準備
- Static Mesh の**円柱（Cylinder）から両端キャップを削除**したチューブ形状を使用（球でも平面でもない点が Simple Explosion ノートと明確に異なる）

### Fresnel エッジマスク
- Fresnel ノードを追加。**サーフェス法線とカメラ方向の内積**で計算され、法線がカメラを直視＝0（効果なし）、法線がカメラに垂直＝1（フル効果）という基本原理を字幕内で明示的に解説
- Exponent（幅の制御）・Base Reflect Fraction 相当のパラメータ（字幕上 "Corner" ※推定、恐らく Base Reflect Fraction の誤認識）を **Parameter 化**し、後段でインスタンスから調整可能に

### ノイズ歪み
1. ノイズテクスチャ（`T_Noise_ZeroOne` ※推定）を追加
2. **Panner で Speed Y=2** の流れるアニメーションを付与
3. **Texcoord → Panner → 別のノイズテクスチャ**を用意し、これを最初のノイズの UV 歪み源として使用（2枚のノイズ・Panner を使う点は Simple Explosion ノートの「歪みレイヤー」と同系統だが、本動画は**煙+水ノーマルマップの複雑な合成ではなく、ノイズ×ノイズのシンプルな UV オフセット歪みのみ**）
4. Multiply で歪み強度を制御 → 初期値だと強すぎたため **0.1 に減衰**
5. U Tiling を **5**、歪み側の Tiling U は **0.2 → 0.5 に調整**（0.2 は "not good" と字幕上明言、試行錯誤の過程がそのまま残っている）

### 発光色とエッジ強調
- 3-Vector Color を追加、**HDR 値（R=1, G=0.5, B=20 ※推定）**でノイズマスクに Multiply
- これを Fresnel 結果に Multiply → プレビューで基本の発光揺らめきを確認
- **エッジをさらに明るくする**ため、Fresnel を別の色（同系色を再利用）に Multiply したものを**元の結果に Add**して合成 → 円柱の縁が中心部より明るく光るリング状の見た目に
- 最終結果を **Emissive Color** に接続してマテリアル完成

### Material Instance 化
- マテリアルを保存 → Material Instance を作成 → 円柱メッシュに適用
- MI 側で Exponent・Base 相当パラメータ・色を調整するデモ（Exponent=1 等の具体値に言及）

## 新規性のある技術情報（既存ドクトリンとの比較）

- `fx_technique_doctrine.md` の「マテリアル定型」節にある基本形（Fresnel=TwoSided外す）と一致するが、本動画は**Fresnel の原理（法線・カメラ方向内積）を最も基礎的なレベルで解説**しており、ドクトリンの Fresnel Tips 項の理解を補強する一次資料として価値がある
- **チューブ状メッシュ（両端キャップ削除の円柱）+ Fresnel エッジ発光**という組み合わせは、既存ノート群（球・破片・トレイル）に前例がなく本ノートが初出。ドクトリンの「1粒バースト+カーブ駆動の器」原則における「柱メッシュ」の具体例として追記候補（リング/シェルウェーブ系エフェクトの素材形状として）
- ノイズ2枚の歪み合成自体は Simple Explosion ノートと同系統だが、**「テクスチャ＋ノーマルマップ」ではなく「ノイズ×ノイズのシンプルな Panner オフセット」**であり、より軽量な実装。既存ドクトリンのErosion定型（ノイズ→Power→Opacity）とも異なり、**歪みそのものにノイズを使う（UV座標へのオフセット注入）**用途としてグロー勾配節の類例に追加できる
- 本動画はマテリアル単体で完結しており、Niagara 側の構成（Spawn Burst・カーブ駆動等）への言及が一切ない。**「次回動画で Niagara に組み込む」という制作フローの分割自体**が、ドクトリンの「System > Emitter > Module > Parameter」原則における「まずマテリアルを単体で作り込んでから器に組み込む」という開発順序の実例として参考になる

## SCRAP BLITZ UEへの応用メモ

- **円柱メッシュ+Fresnel エッジ発光**は、CLAUDE.md 記載のボス撃破 3 フェーズ演出（freeze→explode→**ring**）の ring フェーズにそのまま転用できる形状・技法。現状 DrawDebug 仮実装（円形描画）だが、本動画の技法（開放円柱+Fresnel+ノイズ歪み+Emissive）に差し替えれば「輪が広がりながら発光で揺らめく」質感を Niagara Scale Mesh Size と組み合わせて実現できる
- Exponent・Base（Fresnel パラメータ）・色を Material Instance の Parameter として公開する構成は、既存の OCジェム/浮遊オーブ資産で確立済みの「1マテリアル+User Parameters でバリアント量産」パターン（[iDrsEp3AGWA_magic-orbs.md]・Simple Explosionノート双方と共通）と同じ設計思想。ring エフェクト用マテリアルもこのパターンに乗せれば色/幅違いバリアントを量産しやすい
- ノイズ×ノイズのシンプルな UV 歪み（テクスチャ+ノーマルマップの複雑な合成より軽量）は、**多数同時発生させたいエフェクト**（雑魚敵撃破時のミニリング演出など、Simple Explosionノートで既に指摘した GPU 負荷抑制の用途）に対してさらに軽量な選択肢として使える

## ソースの限界

- 英語自動字幕のみ。ノード名・数値（Tiling値、HDR色の RGB 値、Fresnel Exponent/Base 値等）は音声認識のブレを含む可能性が高く、「※推定」と明記した箇所は実装時に UE 実機で再検証が必要
- 4:50 の短尺で操作テンポが速く、実際のノードグラフ画面は視聴しておらず transcript ベースの要約のみ。特に "Corner" と字幕化された Fresnel パラメータ名、および HDR カラー値（B=20 など桁の大きい数値）は誤認識の疑いが強い
- 最終的な「Add」で合成する2系統の Fresnel×色の詳しい接続順序・意図（なぜ2回 Fresnel を使うのか）は字幕からは機構が完全には特定できていない
- 次回動画（Niagara 組み込み編）は本ノートの対象外。字幕内「network」は Niagara の誤認識と推定するが未確認
