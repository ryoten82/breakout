# 学習ノート — GCC2026 UE5の新標準マテリアルシステムSubstrateの内部構造とパフォーマンス

- 資料: https://www.docswell.com/s/EpicGamesJapan/K8N2G7-2026-04-03-230956 （Epic Games Japan公式、Game Creator Conference 2026講演、発表者 鈴木崇史・Epic Games Japan Senior Software Engineer, Developer Relations、全73ページ、2026-04-03公開）
- 学習日: 2026-07-07 / 抽出: Chrome拡張（docswell.comはWebFetch可だが今回はSPA突破ついでにChrome拡張経由で取得）でページ全文を直接閲覧、要約はパラフレーズ
- ソース種別: 公式スライド資料（docswell.com、ページ番号付きで内容照合可能）
- 既存ノートとの関係: [substrate-unreal-fest-bali-2025.md](substrate-unreal-fest-bali-2025.md)（ノード・パラメータ・応用事例中心）を補完する、**GBuffer内部実装とパフォーマンス実測**に踏み込んだ資料。BSDF/ノードの説明は既存ノートと重複するため割愛し、新規部分のみ記載

## Substrate移行ロードマップ（既存ノートの更新）

UE5.7でProduction Ready & デフォルト化。既存ノートの「UE5.7（目標）」は本資料で確定情報として裏付けられた。さらに新情報として：**UE5.6までは旧マテリアル→Substrate変換が破壊的（後戻り不可）だったが、UE5.7でシェーダーコンパイラ側が変換を吸収するようになり、非破壊的に行き来できるようになった**（既存ノートには無い重要な運用上の変化）。

## 新旧マテリアルの計算式対応（既存ノートに無い新規情報）

旧マテリアルのMetallic合成とSubstrateのDiffuseAlbedo/F0の対応関係が、実際のシェーダーコード（`ComputeF0` / `ComputeDiffuseAlbedo`）付きで説明されている：
- 旧: `BaseColor × (1-Metallic)` = Diffuse、`Specular(0〜0.08) × (1-Metallic) + BaseColor × Metallic` = Specular
- Substrate: DiffuseAlbedo = Diffuse、F0 = Specular
- ヘルパーノード `SubstrateMetalnessToDiffuseAlbedo-F0` で慣れ親しんだMetallicワークフローのまま移行可能

## マテリアルルートノードの新旧両対応（既存ノートに無い新規情報）

- 新規作成マテリアルのルートノードは**旧パラメータ（ShadingModel等）と新パラメータを両方備える「全部入り」構成**
- 旧来のインターフェイスだけに接続すれば互換マテリアルとしてそのまま利用可能（Substrateへの完全移行を強制されない）
- 「Substrateの書き方」で接続すると、MaterialDomain/ShadingModelがグレーアウトし新方式に切り替わる。どちらの書き方も許容される

## GBufferの2方式（本資料の核心・既存ノートに無い新規情報）

Substrateは**AdaptiveGBuffer**と**BlendableGBuffer**という2つの格納方式を切り替えられる。

| | LegacyMaterial | BlendableGBuffer | AdaptiveGBuffer |
|---|---|---|---|
| データ保存先 | 固定 | 固定 | 可変（テクスチャアレイ） |
| クロージャ(BSDF)数 | 1 | 1 | 1〜4 |
| ハードウェアブレンディング | 可 | 可 | 不可 |
| デカール方式 | Blendable/DBuffer | Blendable/DBuffer | DBuffer |
| 高度なライティング機能（F90/Glint/Fuzz/SecondRoughness等） | × | × | ○ |
| 対応プラットフォーム | 全プラットフォーム | 全プラットフォーム | SM6世代のみ |

- **AdaptiveGBuffer**: 複雑度に応じて可変サイズで書き出す。MaterialBuffer 3枚(12Byte)+TopLayer(4/8Byte)が基本、複雑なマテリアルは追加テクスチャアレイに自動拡張。複雑度は Simple(4Byte)/Single/Complex/ComplexSpecial の段階があり、ノードヘッダやSubstrateタブで確認可能
- **BlendableGBuffer**: 従来同等の固定20Byte+レンダーターゲット、ClosureCount常に1、F90/Glint/Fuzz/SecondRoughness等のオプトイン機能は使用不可。コンソール60fpsターゲット向け
- GPUパス面では、Substrateは深度プレパスを強制し、ライティング前に**タイル分類パス**が追加される（タイル内ピクセルの複雑度を見てタイルごとに最適なライティングシェーダーを選択）

## 複雑度の確認方法（既存ノートに無い新規情報）

ビューポート上で4種類のビューモードが使える：
- **MaterialProperties**: カーソル下のパラメータを確認
- **Material Bytes Count**: 出力Byte数（≒描画負荷）
- **Substrate Info**: GBuffer使用量・設定を表示
- **Material Classification**: タイルごとの分類を表示

## コンソール変数（既存ノートの`r.Substrate.BytesPerPixel`を補完）

| 変数 | 用途 |
|---|---|
| `r.Substrate.ClosuresPerPixel` | クロージャの最大数 |
| `r.Substrate.ShadingQuality` | シェーディング精度（0=近似ライティング、1=正確なライティング。デフォルト0=60fps想定） |
| `r.Substrate.BytesPerPixel` | GBufferの最大サイズ（既存ノートに記載のデフォルト80バイトと対応） |
| `r.Substrate.RoughDiffuse` | 1=ラフ拡散モデル、0=ランバート |
| `r.Substrate.Glints` | Glints有効化 |
| `r.Substrate.OpaqueMaterialRoughRefraction` | 不透明サーフェスでの荒い屈折表現の有効化 |

⚠デスクトップは大半の設定がiniで有効化済みだが、**コンソールプラットフォームはデフォルトで無効になっているものが多い**ため注意（本資料で明記）。AdaptiveとBlendableの切り替えは`Engine.ini`の`r.Substrate.ProjectGBufferFormat`（0=Blendable、1=Adaptive）で行うが、**マテリアルエディタ上で両方式を切り替えて確認するワークフローには対応していない**。

## パフォーマンス実測（CitySample、既存ノートに無い新規情報）

PS5上のCitySampleデモ（冒頭600フレーム）でSubstrate+Adaptive／Substrate+Blendable／旧マテリアルの3構成を比較：
- **Material Byte Countはすべて16Byte以下**（Material Classificationでは DefaultLit=緑、ClearCoat含む=オレンジの分布を確認）
- **フレームタイムは概ね同等**（Dynamic Resolutionが差を吸収しているため）
- **動的解像度スケール**: BlendableとSubstrateOffはほぼ同等。**Adaptiveは2〜4%程度の解像度低下が見られるフレームがある**
- パス別内訳: **AdaptiveはBasePass・LumenReflectionの負荷が有意に削減される一方、ライティングパスの負荷が増加**するトレードオフ構造

### 採用判断の指針（本資料の結論、実務的に重要）
- パフォーマンス面ではBlendableGBufferが旧マテリアルとほぼ同等の性能
- 現世代コンソール（SM6世代）以降かつ画面の大半がレガシー/シンプルBSDFならAdaptiveGBufferでもほぼ同等のフレームレートが出せるが、高度な機能使用時のシェーダーサイズ増加・GBuffer拡張によるメモリ消費には注意
- **複層スラブ（クロージャ）や高度な表現を気軽に盛り込めるのは次世代コンソール以降と考えるのが妥当**という現実的な見解が示されている

## おまけ：Toon BSDF（UE5.8で追加）

UE5.8でエンジン組み込みのトゥーンBSDFとToon Profileアセット（諧調・ディザ/ハッチングパターン対応）が追加された。**✅ 実装済み（2026-07-07確認）。実践手順は [iMJJYXHMw4o_toon-shading-ue58.md](iMJJYXHMw4o_toon-shading-ue58.md) 参照**（Toon Profileアセットの作り方・Diffuse/Specular Ramp・Lumen連動パラメータ・Pre-skinned Triplanarパターン投影等）。

## SCRAP BLITZ UE への応用メモ

- `materials_technique_doctrine.md`に既存記録のある「本プロジェクトSubstrate有効(Adaptive GBuffer)・実害なし確認済み」について、本資料はAdaptiveGBufferの性能特性（BasePass/LumenReflection削減 vs ライティングパス増加、解像度2〜4%低下の可能性）を裏付ける一次情報として使える
- コンソール展開を将来検討する場合、`r.Substrate.ProjectGBufferFormat`のプラットフォーム別切り替えと、コンソールでのiniデフォルト無効化の注意点は事前に確認しておく価値がある
- OCジェム等の高度なマテリアル表現（Glint/SecondRoughness/Fuzz）を作り込む際は、AdaptiveGBuffer専用機能であることを踏まえ、対応プラットフォーム（SM6世代）を意識する
