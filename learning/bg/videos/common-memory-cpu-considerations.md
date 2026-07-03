# 学習ノート — Common Memory and CPU Performance Considerations in Unreal Engine

- ソース: Epic公式ドキュメント https://dev.epicgames.com/documentation/en-us/unreal-engine/common-memory-and-cpu-performance-considerations-in-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch（公式doc） → Sonnet単独要約（監査待ち）
- 原典 transcript: [../../programming/transcripts/common-memory-cpu-considerations.md](../../../programming/transcripts/common-memory-cpu-considerations.md)

## GC設定・Object Pooling

**GC設定**: Project Settings > Engine > Garbage Collection にて GC間隔・最大オブジェクト数等が調整可能。手動GCはローディング画面等、スパイクが許容される場面でのみ推奨。具体的な推奨数値・閾値は原文に記載なし。

**Object Pooling**: 原文の要旨は次の通り。

> "instead of spawning a new projectile every time you need to fire one, your weapon would pre-spawn the maximum number of projectiles it could possibly have active"

毎回新規スポーンする代わりに、武器が持ちうる最大数を事前スポーンしておく設計。Actor生成コスト（スポーン/デスポーンの負荷）を削減する代わりにメモリ使用量が増える、というトレードオフとして説明されている。プールサイズの具体的な数値例は無い。

## Tickの代替設計

Tick内でのポーリングロジックの代わりに、コールバック・タイマー・カスタムセッター（値が変化した時だけ処理する仕組み）を使う設計を推奨。「毎フレーム確認する」のではなく「変化が起きた時にだけ反応する」方向への転換。

## 非同期スポーン分散（具体例: 30体を6フレームに分散=5体/フレーム）

原文に具体的な数値例あり。

> "spawn only up to 5 enemies per frame until it has reached the specified limit"
> "30 enemies spawning over the course of 6 frames"

1フレームあたり最大5体までという上限を設け、30体のスポーンを6フレーム（30÷5）に分散させる。1フレームに全部スポーンさせて処理落ちを起こす代わりに、複数フレームへ負荷を平準化する考え方。

また並列処理（Task System・FRunnable）の活用にも言及があるが、具体的な実装手順の記載は無い。

## PSO Precaching

シェーダーコンパイルに起因するヒッチ（初回描画時のカクつき）対策として言及。「自動生成可能」とあるが、具体的な設定手順は原文になく、詳細ドキュメントへの参照リンクのみが示されている。

## 既存ドクトリンとの関係（§9-13の「計測」の次の「対策」として位置づけ）

`bg_technique_doctrine.md` §9-13 は Medieval動画由来で「計測してから削る」思想（ms単位計測・見える範囲だけ品質・影の設計・draw call統合・開発/本番切替）を扱っており、いずれも**描画負荷（GPU/rendering寄り）**の対策が中心だった。

本ソースはタイトル通り「Memory and CPU」に焦点があり、既存ドクトリンが薄かった領域を補う：

- §9「msで計測」で問題箇所を特定した後、それがCPU/メモリ起因（大量Actor生成・Tickの積み上がり・GC スパイク）だった場合の**具体的な対策の引き出し**が本ソースの Object Pooling・Tick代替・非同期スポーン分散
- PSO Precachingは§9-13のどの項目にも無かった「初出現時のヒッチ」という別種の問題（GPU/CPUというより「未コンパイルシェーダー」起因）への対策であり、既存ドクトリンには無い新規カテゴリ

つまり位置づけとしては、既存の§9-13が「描画側の品質/負荷トレードオフ」なのに対し、本ソースは「Actor/オブジェクトのライフサイクル管理によるCPU/メモリ負荷」と「シェーダーコンパイルによるヒッチ」という、隣接するが別の負荷要因への対策集。

## SCRAP BLITZ に活かせる部分

SCRAP BLITZ はベルトスクロールアクションで敵の大量スポーン・弾幕処理が発生するジャンル特性があるため、以下3点が直接的に関係する。ただし現状の実装（既にプール化されているか等）は未確認のため、以下は「本ソースの手法が有効な可能性がある」という提案であり、現状分析ではない。

1. **敵湧き演出のフレーム分散スポーン化**: 波状に敵を出現させる演出時、原文の「5体/フレーム上限」の考え方がそのまま当てはまりうる。1ウェーブ分を一括スポーンすると該当フレームでスパイクが出る可能性があり、複数フレームに分割してスポーンする設計が有効な候補になる。

2. **SP技/OC発動時のFXプールのObject Pooling化**: SP技やOC発動時に生成されるエフェクトActor（Niagara含む）は発動頻度が高く、毎回生成/破棄していると原文の言う「Actor生成コスト」が積み上がる可能性がある。最大同時発動数を見積もってプリスポーンしておく設計が候補になる。

3. **新規エフェクト初出現時のヒッチ対策としてのPSO Precaching**: プレイ中に初めて使われるSP技/OCのエフェクトマテリアルが、その瞬間にシェーダーコンパイルでヒッチする可能性がある。PSO Precachingで事前コンパイルしておくことで、初出現時のカクつきを避けられる可能性がある。ただし原文に具体的な設定手順が無いため、詳細ドキュメント（原文中でリンクされているもの）を別途参照する必要がある。

## ソースの限界

- **GC推奨数値**: GC間隔・最大オブジェクト数について、原文には「調整可能」という記載のみで、具体的な推奨値・閾値の記載は無い。
- **Object Pooling最大数の具体値**: 「可能な限り最大数を事前スポーンする」という考え方は述べられているが、具体的なプールサイズの数値例・算出方法の記載は無い。
- **PSO Precachingの設定手順**: 「自動生成可能」という記述のみで、実際の設定手順（プロジェクト設定のどこを触るか、コマンドは何か等）は原文に無く、別ドキュメントへの参照リンクが示されているのみ。

原文自体がこのトピックの導入的な位置づけのドキュメントであり、各項目の深掘りは個別の詳細ドキュメント任せになっている点に注意。
