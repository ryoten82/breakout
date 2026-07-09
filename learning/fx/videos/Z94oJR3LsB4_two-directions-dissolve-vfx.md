# 学習ノート — UE5 Two Directions Dissolve VFX（9:21）

- ソース: https://www.youtube.com/watch?v=Z94oJR3LsB4
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\yt\transcript.txt`（ローカル一時ファイル、恒久パスではない。ロールキャプション形式の重複除去済み）
- 関連ノート: なし（マテリアルドメインのディゾルブ技法。既存 fx doctrine の Erosion 定型と対比する内容）

## 概要

マテリアルグラフのみでキャラクターの全身ディゾルブを作るチュートリアル。核となるのは「軸方向を入力パラメータ化した汎用ディゾルブ Material Function」を**同じキャラクターマテリアルに正負2方向で2回インスタンス化**し、頭と足など**2箇所から同時に中央へ向かって溶ける**演出を作る点。パラメータは Material Parameter Collection（MPC）に集約し、1つの「dissolve amount」で両方向を同期させる。

## 汎用ディゾルブ Material Function の構成

1. `Local Position` ノードでメッシュのローカル座標を取得
2. Scalar 入力 `MeshCenter`（デフォルト 90）をローカル座標から減算し、ディゾルブの基準点をずらす（UE4 マネキンで頭寄り/足寄りに調整する用途）
3. その結果と Vector3 入力 `Direction`（デフォルトプレビュー値 (0,0,-1)、つまり Z 軸）を **Dot** 積 → 軸方向に沿ったグラデーションマスクができる
4. Divide by 20 で値域を圧縮（白領域がおおよそ 0〜1 に収まるよう調整）
5. System 提供の Noise テクスチャを Pan → Multiply（ノイズ強度用 Scalar 入力、デフォルト 1、Tiling=2）で加算し、直線的なグラデーションを有機的な輪郭に崩す
6. Scalar 入力 `DissolveAmount`（アニメーション駆動用、デフォルト 0）を Subtract → Saturate → **Opacity Mask** 出力
7. エッジグロー: 同じ Subtract 前の値から `DissolveAmount + EdgeWidth`（Scalar 入力、デフォルト 0.5）をさらに Subtract → Saturate → Lerp の Alpha に使用（A=黒/0、B=Color 入力・デフォルト青）→ **Emissive** 出力

Opacity Mask の白領域より Emissive の白領域を意図的に小さく作る（EdgeWidth 分だけ狭い）のが後述の2方向合成のための伏線。

## 「2方向」制御の仕組み（本動画の核心・新規性）

- 上記 Function は Direction が Vector3 入力のため、**値を変えるだけで X/Y/Z 軸どれでも、あるいは斜め方向でもディゾルブ軸を切り替えられる**（関数を作り直す必要がない）
- キャラクターマテリアル側では、この**同一 Function を2回インスタンス化**し、一方に `Direction=(0,0,1)`、もう一方に `Direction=(0,0,-1)` を与える（Z軸プラス/マイナス）。これにより頭方向と足方向、両方から同時にディゾルブが進行する
- 2つのインスタンスの出力を **異なる演算で合成**する:
  - **Opacity Mask**: `1 - (maskA + maskB)`。各 Function の Opacity Mask の白領域は「まだ溶けていない領域」を表すため、両方向の「未溶解マスク」を足してから 1 マイナスすることで、頭・足それぞれから侵食するホールが中央に向かって拡大していく合成になる
  - **Emissive（エッジグロー）**: `emissiveA + emissiveB` の単純加算。Emissive 側の白領域を Opacity Mask よりあらかじめ狭く作ってあるため、2方向のエッジ帯が重なって白飛びすることなく、2本の輪郭線として独立に見える
- 全パラメータ（EdgeWidth・MeshCenter・DissolveAmount・Color、および2インスタンス分の Direction）は **Material Parameter Collection** に集約。`DissolveAmount` を1箇所（MPC 経由、Blueprint 等から）操作するだけで両方向の進行度が同期して動く
- 応用として、MeshCenter を変えるだけで「頭〜足の中央」「腰」「足元寄り」など収束点を移動でき、Direction の組を X/Y/Z 好きな軸に変えれば「両腕から中央へ」のような別軸の2方向ディゾルブも同じ Function 使い回しで作れる、と説明されている（※推定: 具体的な腕ディゾルブのノード変更手順は動画内で詳細実演されておらず概念説明のみ）

## 既存ドクトリンとの比較（新規性）

`fx/fx_technique_doctrine.md` の Erosion 定型「ノイズ→Power→Opacity(Mask)。パーティクルαを閾値流用、Dynamic Parameterで外部化」は **Niagara パーティクル文脈**の記述であり、本動画はそもそも Niagara を使わない **Skeletal Mesh 全身マテリアルのディゾルブ**という別レイヤーの技法。ノイズの使い方自体（Pan+Multiply で強度制御）は Erosion 定型と大枠同じだが、doctrine 未収録で新規性があるのは以下:

- **Direction を Vector3 入力化し Dot 積で軸を可変にする**汎用化パターン（1つの Function で任意軸ディゾルブに対応）
- **同一 Function を符号違いで2重インスタンス化し、Opacity Mask 側は加算後に 1 マイナス／Emissive 側は単純加算、という非対称合成**で「2方向から中央収束」を実現する組み方
- パーティクルの Dynamic Parameter ではなく **Material Parameter Collection でマテリアル横断的にパラメータを一元管理**し、1つの DissolveAmount で複数箇所（2方向×複数マテリアルスロット）を同期させる運用

## SCRAP BLITZ UEへの応用メモ

- **敵の死亡演出**: 現状ドクトリンの Erosion（ノイズ→Opacity Mask、Dynamic Parameter で外部化）はパーティクル/デカール向け。敵メッシュ本体を消す用途には本動画の「MeshCenter 基準の軸ディゾルブ」がそのまま使える。特に enem01/enem02/boss01/midboss01 のような直立キャラは Z 軸（頭/足)2方向ディゾルブで「頭と足から同時に溶けて胴体へ収束→消滅」という演出が proto の即死/撃破 VFX に足せる可能性がある。既存の死亡演出（爆散・パーティクル）と併用し、ディゾルブは「消え際の質感」を担当させる分業が考えられる
- **アイテム出現/消滅演出**: OC ジェム・Pickup の出現時に「上下2方向から中央へ実体化（逆再生）」、消滅時に「中央から上下2方向へ溶ける」という対称演出に応用できる。MeshCenter をジェムの中心 Z に固定すれば調整コストは低い。ただし OC ジェムは現状 Fresnel シェルの見た目調整で反復が続いている領域（`handoff_scrapblitz_2026-07-09_*` 参照）なので、ディゾルブ追加は現行の見た目収束後に着手すべき
- **差分ポイント**: 既存 Erosion 定型に対する追加パラメータは「Direction（軸ベクトル、2インスタンス分）」と「MeshCenter（収束点オフセット）」の2つ。この2つを UPROPERTY 化すれば、敵種別ごとに軸・収束点だけ変えて使い回せる（例: 横倒れ状態の敵なら軸を X/Y に切り替える）
- 実装時は Niagara ではなく **マテリアル側**（M_Enemy 等の Opacity Mask + Emissive）の改修になる点に注意。既存の DrawDebug 仮実装ポリシーとは別レイヤーの作業

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名の一部（特に「add one minus and dot nodes」の箇所）は音声認識のブレにより、実際の UE ノード名（Subtract 等）と字幕表記が一致しない可能性がある。本ノートでは文脈から Subtract の可能性が高いと解釈し、断定できない箇所は「※推定」と明記した
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のため接続順序・ノード名の細部は確認できていない
- 「両腕から中央へ」等の他軸への応用は動画内で概念的に言及されるのみで、具体的なノード変更手順は実演されていない
