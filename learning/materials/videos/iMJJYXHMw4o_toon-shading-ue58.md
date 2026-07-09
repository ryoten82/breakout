# 学習ノート — How To Use Toon Shading New In UE5.8 - Unreal Engine 5.8 Materials Tutorial

- 動画: https://www.youtube.com/watch?v=iMJJYXHMw4o （Pitchfork Academy、講師名 Velocity、31:15）
- 視聴日: 2026-07-07 / 抽出: 英語自動字幕（手動字幕なし・原音声英語のためASR、翻訳字幕ではない）→ Sonnet単独抽出（監査待ち）
- 原典 transcript: `../transcripts/`未整備（scratchpadの一時ファイルから直接抽出。将来の原文照合が必要な場合は動画URLから再取得）
- 既存ノートとの関係: [substrate-internal-structure-gcc2026.md](substrate-internal-structure-gcc2026.md)（GCC2026講演）が「UE5.8予定・未実装機能」として紹介していた**Toon BSDF / Toon Profile**の実践手順編。本ノートで実装済み機能としての具体的な作業フローを補完する
- チャプター: Intro(0-86s) / Project setup(86-180s) / Create material(180-422s) / Create custom Toon Profile(422-841s) / Add custom textures(841-1396s) / Emissive texture(1396-1512s) / Custom Pattern UVs(1512-1751s) / Anisotropy(1751-1832s) / Outro(1832-1875s)

## 前提（既存ノートの更新点）

- Toon BSDFは**Substrateのマテリアルルート「Front Material」から生えるBSDFノードの一種**（Slab BSDFの代替）。Front Materialの出力から検索して"toon"と入力すると"Substrate Toon BSDF"が出てくる
- **ポストプロセスマテリアルではない**。個別オブジェクトのマテリアルとして適用する方式で、シーン全体へ一括適用はできない。その代わりオブジェクト単位で見た目を作り分けられる
- Toon BSDFノードを接続すると、それまで見えていた入力ピン群が折り畳まれ、Base Color / Metallic / Specular / Roughness 等のトゥーン用ピンだけが残る（World Position Offset・Pixel Depth Offsetなど使用頻度の低いピンのみ別枠で残存）

## マテリアル作成の基本手順

1. Content Browserに `materials/toon` フォルダを作り、新規マテリアル（例 `m_toon`）を作成
2. Front Materialから "Substrate Toon BSDF" ノードを検索して接続
3. Base Color（既定0.5グレー）・Metallic（既定0）・Specular（既定0.5＝標準のスペキュラハイライト用値）・Roughness（既定0.5）を右クリックで Parameter 化
4. マテリアルを保存し、Material Instance を作成してキャラクターに適用すればすぐにセルシェーディング＋スペキュラハイライトが確認できる
5. Ctrl+L でサンライトの角度を動かし、光への反応を確認できる（この段階でトゥーンシェーディングが動的ライトに反応することがわかる）

### Material Instanceパラメータの調整目安（著者の経験則）

- **Metallic**: 1.0まで上げるとリアル寄りになりすぎる。0.8〜0.9あたりが妥当な上限という著者の見解
- **Roughness**: Metallicが高い状態でRoughnessを下げすぎる（0.35〜0.4未満目安）と反射がリアルでソフトになりすぎる。著者は「将来のアップデートで反射自体もバンド状になってほしい」とコメント（現状は反射はバンド化されず滑らかなまま）
- **Specular**: 0.5が既定でスペキュラハイライトの見え方を制御する。基本的に変更しない想定。グラフ側で右クリック→Convert to Constantにしてインスタンス側で誤って触れないようにする運用も紹介

## Toon Profileアセット（核心機能）

Toon BSDFノードの左側に "Toon Profile" という入力があり、ここに専用アセット（Toon Profile）を割り当てる。ドロップダウン→Create New Asset→Toon Profileで新規作成し保存（例 `TP_Toon`）。マテリアル側も保存して反映させる必要がある。

Toon Profileアセット内の主要パラメータ：

| パラメータ | 役割 |
|---|---|
| **Diffuse Ramp** | バンド（諧調）の開始位置・柔らかさ・明るさを制御するグラデーションカーブ。キーをドラッグ/削除して調整可能。キーを黒白2つだけに減らし中央（0.5）に寄せると鋭い2バンドのセル調（明暗2色くっきり）になる。右上のResetボタンで既定形状に戻せる |
| **Diffuse Ramp Offset Texture** | ランプにパターンテクスチャを重ねてバンドの境界を崩す。ノイズテクスチャ（例: Wind Noise）でペイント調・筆致調に、球状マスク（Sphere Render Mask）でハーフトーン（網点）風の表現が可能。Strength/Sizeで強度・スケール調整。**反転（白背景に黒円）にするとより効果的だろうと著者は推測**（本編では未反転のまま） |
| **Specular Ramp** | スペキュラハイライトの落ち方を制御。既定は滑らかなまま。同様にノイズテクスチャを足すとハイライトを歪ませられる（Strength目安0.1） |
| **Shadow Extinction** | 影の落ち方・明るさを制御（既定10）。著者はここにパターンテクスチャを足すのは試したが見た目が破綻したため非推奨としている |
| **Diffuse Indirect Scale** | Lumenのグローバルイルミネーションとの連動度。1でLumenの間接光に正しく反応する。0にすると裏面の間接光が消えるが、不自然な落ち方・縞が出る |
| **Diffuse Ramp Includes Shadow** | ONにすると影の中にもバンド分割が正しく適用される。著者はONを推奨 |
| **Specular Indirect Scale** | 裏面の輪郭に出る間接光由来の白いグローの強さ。0にすると消える（著者は好みで0寄りとコメントしつつ本編ではONのまま進行） |

## キャラクターテクスチャの組み込み

- 使用するテクスチャセット例: Diffuse（色情報）、MRA（Metallic=R / Roughness=G / AO=B、**チャンネル割り当てはアセットにより異なるため要確認**）、Normal
- Base Colorへの接続について、Diffuseテクスチャを別テクスチャとMultiplyしてBase Colorに接続する手順が語られているが、**Multiplyの相手側テクスチャの詳細はASRの音声起こしが不明瞭で断定できない**（後段でAOはトゥーンシェーディングに使わない方針が明言されているため、AO合成ではない可能性が高い）※推定・要現物確認
- Metallic: MRAのRチャンネル→Multiplyノード経由→Metallic入力。Metallicパラメータの既定値を**1に設定**（乗算なので1×テクスチャ値＝テクスチャそのままの値になる。そこからMI側で微調整する設計）
- Roughness: MRAのGチャンネル→Multiplyノード経由→Roughness入力（Metallicと同様の考え方）
- **Ambient Occlusionは使用しない**（AOは追加のグラデーション・フェードを生み、トゥーンシェーディングでは不要という判断）
- Normal: 直接つながず、**Flatten Normalノード**を挟んでFlatnessピンをParameter化（既定0＝ノーマル情報そのまま。値を上げるほどディテールが消え、負の値で強度が増す）

### Material Instanceの親子構造（テクスチャセット違いへの対応）

- キャラクターが複数のテクスチャセット（例: 上半身用/下半身用）を持つ場合、まず1枚目のMI（例 `MI_QuinnA`）を作り、色・Metallic・Roughness・Emissive等の共通パラメータをここで管理する「親」的な位置づけにする
- 2枚目は `MI_QuinnA` を親にした「MIから作るMI」（Create Material Instanceを既存インスタンス上で実行）として作成（例 `MI_QuinnB`）。共通パラメータは親から継承しつつ、テクスチャ3枚（Diffuse/MRA/Normal）だけを個別にオーバーライドする
- 前提として、**ベースマテリアル側でテクスチャサンプルをParameter化し忘れると子MI側でテクスチャを差し替えられない**（本編では一度作り忘れて後からConvert to Parameterで修正する場面あり。実装時は先にテクスチャ3種をParameter化しておくべき）
- 実例: キャラクター本来のテクスチャがMetallicの高い金属素材を含んでいたため、Metallicパラメータを1のままにすると見た目が破綻。0.3程度まで下げ、Roughnessは1程度まで上げて調整した（**Multiply既定値1という「素直な設計」でも、素材によっては個別チューニングが必要**という実践知）

## ライティング反応（Toon BSDFの強み）

- 太陽の角度を下げると空の色（アトモスフィア）に応じて自動的に暖色寄りになる。従来のセルシェーディング自作実装では別途仕込みが必要だった挙動が標準で効く
- Point Lightを追加すると光源色に応じてバンドが正しく色付く。複数の色付きライトを同時配置しても正しく反応する。夜間（サンライト無し）でもPoint Lightだけで正常に機能する
- 著者はこれを「他のセルシェーディング実装で苦労しがちな部分が自動で解決される」最大のメリットとして強調している

## Emissiveの応用例

- Quinnのマンネキンにはemissiveテクスチャが無いため、MRAテクスチャのMetallicチャンネル（R）を流用する即興例
- 細い黒線部分だけを光らせたかったため、**One Minusノードで反転**してから、Vector Parameter（emissive color、既定黒＝発光なし）とMultiplyしてEmissive Colorへ接続
- MI側でemissive colorに色を設定すると発光し、夜間でLumenにも正しく反映される（グローがLumen経由で周囲ににじむ）挙動を確認

## カスタムパターンUV（Pattern UVs）

- Toon Profileの「Diffuse Ramp Offset Texture」（パターンテクスチャ）は既定でメッシュ自身のUVを使って貼り付けられる（Pattern UVsピンが未接続の場合）
- **World Position（XYZ）をPattern UVsに接続する方法**: 縦方向の面で伸びる（ワールド位置はXY平面中心のため）・キャラクターがワールド空間を「通り抜けていく」ように見える副作用がある。狙って使えば独特の効果になるが通常は非推奨
- **UE5.7で追加されたTriplanar手法（"Coordinate Basis Triplanar Dithered"ノード）**: UV出力をPattern UVsに接続。Coordinate Spaceパラメータで投影方式を選択：
  - 0 = World Space（World Position直結と同じ「すり抜け」現象が起きる）
  - 1・2 = スキンメッシュ（アニメーションするメッシュ）では不要
  - **3 = Pre-skinned（バインドポーズ基準）**。キャラクターの動き・移動に追従してパターンが正しく固定される。定数ノード（1キー+クリック）で値3をCoordinate Spaceに接続する
- Pre-skinned方式の利点: **メッシュ自体のUVレイアウトやスケールに依存せず、常に同じテクセルスケールでパターンを貼れる**（UVが崩れているメッシュや、UVスケールがまちまちな複数メッシュへの適用に有効）
- Coordinate Spaceを0（World Space）に戻して比較すると、キャラが動くたびパターンが「泳ぐ」ような見た目になることを実演。ペインタリー調の演出として意図的に使う余地はあるが基本はPre-skinned（3）を推奨、というのが著者のスタンス

## Anisotropy

- Toon BSDFノードにはAnisotropy・Tangentの入力もある。Tangent側は方向を定義するテクスチャが必要で「やや複雑」なため本編では扱っていない
- AnisotropyピンはParameter化可能。有効化（0以外の値）すると追加コストがかかる旨のインジケータ（"aniso"）が表示される
- 正の値でスペキュラハイライトが水平方向に伸び、負の値で垂直方向に伸びる。著者はフライパン底面の光の散り方を例に挙げて説明している
- 著者の推奨: 特に必要なければAnisotropyパラメータ自体を使わず削除してよい（追加コストとのトレードオフ）

## materials_technique_doctrine.md との比較（新規性の判断）

既存doctrineのSubstrate節（Slab BSDF・F0/Diffuse Albedo・GBuffer選択・メモリ予算表）は**Slab BSDF前提の記述**で、Toon BSDFという別種のBSDFノード・Toon Profileアセット・Diffuse/Specular Rampという概念は doctrine に存在しない新規カテゴリ。以下は新規性が高いと判断できる要素：

1. **Toon Profileアセットという別ファイル型の設定単位**（マテリアルグラフ内でなくアセット参照で諧調・ランプを管理する設計）
2. **Diffuse Ramp Includes Shadow / Diffuse Indirect Scale**によるLumen連動の明示的なON/OFF制御（Slab BSDFの間接光挙動とは別の専用パラメータ系）
3. **Pre-skinned Triplanar（Coordinate Space=3）**によるスキンメッシュへのUV非依存パターン投影は、doctrineの「TexCoord→Multiply→Scalar tiling」節（Landscape等の広域面限定という既存知見）とは適用対象が異なる（キャラクターメッシュ・アニメーション追従が主眼）

doctrineへの追記要否は**Fable判断待ち**とする（本ノートは差分抽出のみ）。

## 活かせる部分（SCRAP BLITZ UEへの応用メモ）

- METEO等のキャラクター表現にセル調の見た目を検討する場合の具体的な導線が明確になった：Toon BSDF接続→Toon Profileでバンド形状決定→キャラのMRAテクスチャを流用してMetallic/Roughness/Emissiveを組む、という一連の手順が再現可能なレベルで判明した
- Pre-skinned Triplanar（Coordinate Space=3）は、スキンメッシュのUVレイアウトに依存せずパターンを一定スケールで貼れる点で、既存キャラの見た目差し替え・スタイライズ実験時に有用な可能性がある（未検証）
- ただし本プロジェクトは現状リアル頭身寄りのビジュアル方針であり、Toon Shading自体の採用可否は演出方針の決定が前提（本ノートは技術手順の記録に留める）

## ソースの限界

- **英語自動字幕（ASR）のみ**。専門用語・音声の聞き取り誤りは文脈から復元したが、Base Colorのマルチプライ相手テクスチャなど一部手順の細部は復元しきれず「※推定」または「不明瞭」と明記した
- 画面操作の逐一（マウスのドラッグ位置、ノードの正確な配線経路）は字幕からは再現できないため、実装時は動画本編での画面確認を推奨
- 独立照合（原文grep等の監査）は未実施。次回セッションでのFable監査待ち

## 確信度が低い抽出（自己申告・3件）

1. **Base ColorのMultiply相手テクスチャ**: Diffuseテクスチャと何を乗算しているかがASRから断定できない（AOではない可能性が高いが未確定）
2. **Diffuse Ramp Offset Texture / Specular Ramp Textureの既定値・厳密なUI名称**: 「Strength」「Size」という語はASRベースの復元で、UE5.8の実際のパラメータ名と完全一致するかは要確認
3. **MRAチャンネル順（R=Metallic/G=Roughness/B=AO）**: 著者本人が「アセットによって順序が異なる」と明言しており、本ノートの記載はQuinnマネキン固有の例。汎用ルールとして扱わないこと
