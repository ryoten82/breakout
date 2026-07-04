# 学習ノート — Create a Dynamic Sci-Fi Dome Material in UE5! (Full Tutorial)

- 動画: https://www.youtube.com/watch?v=_1tmjPro1JM （CGHOW、16分56秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/_1tmjPro1JM.txt](../transcripts/_1tmjPro1JM.txt)

## マテリアル構築手順（工程順）

1. **[00:20]-[01:25]** Sphereにマテリアル作成、Unlitシェーディング採用
2. **[01:43]-[03:34]** ノイズテクスチャにPower（コントラスト強化、目安3〜4）→Tiling違いの2系統をMultiply→縦横入れ替えた版とAddでクリスクロス（格子）パターン完成
3. **[03:42]-[04:39]** 同じ手順をオフセット違いでもう一系統作成（模様に複雑さを追加）
4. **[04:49]-[05:36]** LerpでCyan/Magentaの2色に割り当て、背景側にも別ノイズをMultiplyして両方に模様を持たせる
5. **[05:57]-[06:26]** TexCoord→Multiply→Floor→Divide（同じ値、目安50）でピクセル化グリッド化
6. **[06:48]-[07:03]** 各ノイズ系統に個別Pannerでパンニング（**同一ノード共有だと両方に影響するため複製が必須**）
7. **[07:18]-[07:50]** Fresnel（Exponent目安2）→Power→Multiply(目安100)→Addでエッジ発光
8. **[08:02]-[08:58]** Material Instance化、Fresnel Power（デフォルト5）・Brightness Multiply（デフォルト100）をパラメータ公開
9. **[09:04]-[10:03]** 走査ライン（Scan Lines）：縦Tiling(50,1)+Panner(速度6)でライン化、既存ノイズとMultiplyして切り抜き、明るさMultiply(目安20)
10. **[10:14]-[11:47]** Translucent化。マスク要素を先にAddで合成してからOpacityへ（Opacityデフォルト1）。全体が「塊」に見える問題への対処として Add Opacity（デフォルト0）で底上げ
11. **[12:20]-[13:26]** Depth Fade（Distance目安100）で他オブジェクトとの交差部分を光らせる。Invert(1-x)してOpacityにAdd、色もMultiply（Fraction Edge Valueデフォルト1）
12. **[14:02]-[16:16]** **重要Tips**：単純なInvertでなくDivide（非常に小さい値）を使うと、エッジ付近が急激に明るくそこから減衰する「かっこいいグラデーション」になる。最終的に低い係数(0.1)で全体を抑える

## 判断基準・コツ

- ノイズにPowerをかける理由：白飛び気味のテクスチャのコントラストを非線形に強める
- Tilingだけ変えた複製×Multiplyで縦横交差パターンを安価に作る（テクスチャ制作コスト不要）
- オフセット違いの2系統目：単純反復でなくズレを作ることで模様に複雑さ・有機性を出す
- Panner用にノードを複製する理由：同一UV系統を共有すると影響が全体に及ぶため
- 「マスクを作る→カラーと掛ける→足し戻す」というエミッシブ強調の定型パターン
- Opacityはマスクを先に合成してからカラーを掛ける設計（色成分混入前に白黒マスクを確定させる）
- **Divide（小さい値）でグラデーション化**：単純な1-xは線形フェードにしかならないが、小さい値で割ると疑似べき乗カーブになり"cool glow"に見える

## 主要パラメータ

| パラメータ | 値/目安 |
|---|---|
| ベーステクスチャPower | 3〜4 |
| クリスクロスTiling | 4×4程度 |
| ピクセル化Multiply/Divide | 50 |
| Panner速度（Cyan/Magenta） | 2 / 0.3 |
| Fresnel Exponent（初期） | 2 |
| Fresnel Powerパラメータ | デフォルト5 |
| Brightness Multiply | デフォルト100 |
| Depth Fade Distance | 100 |
| 最終Multiplier | 0.1 |

## SCRAP BLITZ UEへの応用可能性

対象：`docs/spec/port_background_decoration.md` — Stage 3 巨大発光球体（emissive Sphere + ワイヤ外殻 + ケーブル4本）・SF backdrop（青LEDストリップ柱）

**巨大発光球体への適合性は高い**。この動画自体が「Sphereに Sci-Fi発光マテリアルを貼る」チュートリアルであり、以下が直接転用可能：
- **Depth Fade（[12:20]）による接触部分の発光**：ワイヤ外殻・ケーブルが球体表面に接触する箇所を検出して光らせる演出にそのまま使える（「接続部が光る」SF感）
- クリスクロスパターンは「発光球体表面のパネルライン」的質感になる
- Unlitシェーディング採用はパフォーマンス面でも有利（背景装飾オブジェクトとして妥当）
- Pannerによる常時アニメーションは静止した背景オブジェクトへの生命感付与に有効

**SF backdrop（青LEDストリップ柱）は部分適合**：縦ライン限定パターンやScan Lines技法はLEDストリップの「流れる光」表現に転用できる。ただし柱状ジオメトリ（円柱UV）の場合、Tiling方向・スケール感はSphere UVとは異なるため要調整。

**留意点**：具体的なTiling/Power/Divide数値は「テクスチャ依存」と動画内で繰り返し明言されており、そのまま移植せずSCRAP BLITZ UE側のテクスチャ・スケール感に合わせた再調整が必須。

## 確信度が低い抽出

1. [07:03] Panner速度「4倍速」という発言と実数値（2と0.3、約6.7倍）の不整合
2. [03:52] オフセット数値「25、6」（ASR誤認識で256の可能性も）
3. [14:42][14:52] Divide/Powerパラメータのデフォルト具体数値（言及なし）
