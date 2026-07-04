# 学習ノート — Unreal Engine 5 - Sci-Fi Barrier - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=omkwqdWMB_U （11分44秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/omkwqdWMB_U.txt](../transcripts/omkwqdWMB_U.txt)

## エフェクト構築手順（工程順）

1. **[00:31]-[01:25]** Empty System、Mesh Renderer、Spawn Burst Instantaneous（バリアは板/メッシュ1枚を常時表示、単発スポーンで十分）
2. **[01:44]-[04:06]** メインテクスチャ（ドット柄、Material Makerで自作：Pattern GenericをTiling16×16、Colorizeで黒背景除去）+ **Dynamic ParameterでUVタイリングを可変化（Parameter Index=1を必ず確認、重複競合注意）**
3. **[04:06]-[06:14]** ノイズテクスチャでパターンを崩す（FBM Noise、Main×Noiseの乗算で有機的な揺らぎ）、Speed X/YでUVスクロール
4. **[06:14]-[07:44]** 発光する縁取り：Border Tex×Border Colorを**まずSubtractで穴を開けてから、別のCenter Colorで加算し直す（「抜いて足す」の順序が必要）**
5. **[08:32]-[09:44]** メッシュのスケールアニメーション：Z軸カーブで**序盤オーバーシュート（1.2）→95%付近で1.0に安定**。X/Y軸に同じカーブをタイミングずらしてコピーし波打つような出現モーションに

## 判断基準・コツ

- Blend Mode=Additive：光るエネルギー系エフェクトは加算合成が発光感・重なりの明るさを自然に出せる
- ドット単体でなくノイズと乗算：単一パターンの反復は人工的・単調に見えるため、ノイズスクロールで揺らぎを足す
- Dynamic ParameterでTiling/Speedを外部化：マテリアルを固定値でハードコードせず、使い回し先に応じて微調整可能にする
- Borderだけ Subtract→別途Add：ボーダー部分に本体と異なる色を与えるための「マスク差し替え」的な発想
- Scale Mesh SizeをZ→X→Yで時間差オフセット：単一軸だけのスケーリングだと単調な出現になるため
- Parameter Indexの確認（=1を念押し）：Dynamic Parameterは複数使うとインデックス競合しやすい

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| Blend Mode | Additive |
| ドットパターンTiling | 16×16 |
| Main Tex Tiling（最終値） | X=1.6, Y=1.0 |
| Scale Mesh Size Zカーブ序盤オーバーシュート | 1.2 |
| Scale Mesh Size Zカーブ終盤安定キー | 1.0（95%付近） |

## SCRAP BLITZ UEのシールド/バリアへの応用可能性

- Niagara+Additiveマテリアルのレイヤー構成（Main Dot×Noise→Border加算）はボス用シールドの実装にそのまま流用しやすい。ボスのフェーズ切替時のシールド展開演出に、Scale Mesh SizeのZ→X→Y時間差オーバーシュートが説得力ある出現モーションとして使える
- 既存AOEテレグラフ演出文法（固定赤枠/円+橙塗り）とは異なり、本動画は「常時展開状態のシールド」であり用途が異なる点に注意
- Dynamic ParameterでTiling/Speedを外部化する手法は、ボスHPに応じてバリアの揺らぎ速度を変える等の動的制御に応用可能
- メッシュ本体は別動画（Blender作業）に依存しており、UE側ではプレーン/カプセル型メッシュで代用しUV展開だけ揃えれば同じマテリアルロジックが動作する

## 確信度が低い抽出

1. [06:55] Border Color RGB数値の小数点位置
2. System/Material/Emitterの命名（ASR誤認識の可能性が高い）
3. [09:07]-[09:19] Scale Mesh Size Zカーブのキー配置タイミング
