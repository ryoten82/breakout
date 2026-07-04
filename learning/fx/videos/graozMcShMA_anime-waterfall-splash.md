# 学習ノート — Unreal Engine 5 - Anime Waterfall Splash Tutorial

- 動画: https://www.youtube.com/watch?v=graozMcShMA （19分37秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/graozMcShMA.txt](../transcripts/graozMcShMA.txt)

## エフェクト構築手順（工程順）

1. **[00:34]-[01:28]** Niagara System準備、Mesh Renderer使用（水柱本体はメッシュ表現）
2. **[01:34]-[02:49]** 水柱メッシュ「Cylinder01」自作（Cap Fill Type=None、ピボットを底に配置）
3. **[03:00]-[03:24]** **Scale=Non-uniform**（X,Y=0.5、Z=5）で細長い柱状に
4. **[03:24]-[04:37]** ベースカラーマテリアル：Translucent+Unlit（アニメ的な塗り表現）、Particle Colorノードで色制御
5. **[04:37]-[07:12]** **Erosionマテリアル（本チュートリアルの核心）**：Blend Mode=Masked、Voronoiテクスチャ、2つのDynamic Parameterで4系統float値（Tiling X/Y、Speed X/Y、Erosion、Power）を外部制御
6. **[08:56]-[10:20]** Niagara側：Scale(0.55,0.55)、Tiling(3,1)、Erosion=1.3、**Speed Y=-1.5（上方向スクロール＝水が上に向かって流れる見た目）**
7. **[10:20]-[11:58]** 波紋メッシュ「Circle01」自作：**シリンダーから作ると放射状UVになりVoronoiスクロールで自然な波紋になる（"a great trick"）**
8. **[11:58]-[15:11]** 波紋エミッター：Random Rotation Z、Color×12ブースト（Unlitでも発光的な見た目）、**Dynamic Material ParameterをParticle Update側に置くと経時変化する（Spawn側だと初期値固定）**
9. **[15:56]-[18:14]** 滝根本の泡「RingBase01」：ドーナツ形状メッシュ自作、Erosion Scale Curveを「大→小」に

## 判断基準・コツ

- Mesh Rendererを使う理由：非均一スケールで滝・波紋の指向性のある伸び・潰れを表現するため
- マテリアルをUnlit+Translucent/Masked：シーンライトに依存しない「アニメ的な塗り」を保つ。侵食用はMaskedで「切れて消える」水しぶきのシルエットを作る
- Dynamic Parameterでtiling/speed/erosion/powerを外出し：1マテリアルを複数エミッター（水柱・波紋・リング）で使い回す
- シリンダーから波紋用ディスクを作る理由：円盤メッシュを一から作るよりUVが自然に放射状になる
- **Dynamic Material Parameter：Spawn vs Updateの使い分け**：「侵食が時間とともに進行する」演出はUpdate側でないと成立しない
- Colorを1〜12倍にブースト：Unlitマテリアルでも明るい発光感を出す（HDRの疑似表現）

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| 水柱Scale (Non-uniform) | X=0.5, Y=0.5, Z=5 |
| Erosion（水柱2層目） | 3（曲線的な筋だけ残す用） |
| Ripple Speed Y | 0（波紋は流れない） |
| Ripple Color倍率 | 12 |
| RingBase Erosion Scale Curve | 4（大→小） |

## SCRAP BLITZ UEの背景水表現への応用可能性

- Dynamic Parameter（Tiling/Speed/Erosion/Power）でVoronoiマスクを外部制御する構造は、背景の滝・水しぶき演出の量産システムとして使える
- Unlit+Maskedのアニメ的塗り表現は、既存演出ポリシー（色・エフェクトの統一感）と相性が良い
- Blenderで放射状UVのシリンダー/ディスクを自作する手法は専用リップルテクスチャ不要で実用的
- あくまで背景演出（滝そのもの）であり、ゲームプレイに直接絡む攻撃エフェクトではない点に注意。環境アートとしての利用が主眼

## 確信度が低い抽出

1. [03:24付近] Base ColorのG値「Z4」（0.4前後と推定）
2. [13:00]-[13:05] Ripple01のTiling Y値「Zot 5」
3. [18:00]-[18:08] RingBase01のScale Min/Max各軸の対応関係
