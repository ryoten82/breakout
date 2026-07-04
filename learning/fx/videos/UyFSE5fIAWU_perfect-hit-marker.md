# 学習ノート — Create a Perfect Hit Marker VFX in Unreal Engine 5 Niagara

- 動画: https://www.youtube.com/watch?v=UyFSE5fIAWU （CGHOW、12分46秒、UE5.5想定）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/UyFSE5fIAWU.txt](../transcripts/UyFSE5fIAWU.txt)

## エフェクト構築手順（工程順）

1. **[00:23]-[01:24]** リングマテリアル：Two Sided/Unlit/Translucent、Radial Gradient Exponential→Sine×2でリング形状（両側フェード）、太さはPower+Dynamic Parameter（"thickness"）
2. **[01:24]-[02:04]** Spawn Burst Instantaneous(Count=1)、Emitter State=Once、パーティクル寿命判定オフ（無限化）
3. **[02:04]-[03:34]** サイズ調整（200→400→600）。**カメラ正対解除→地面向き**：Custom Alignment/Custom Facing Vector、Align to Mesh Orientationで X→Z
4. **[03:34]-[06:21]** リングを**5レイヤー程度**複製：外側ほど大きく太く薄く、内側ほど小さく硬く明るく、色も変化（赤系含む）
5. **[06:24]-[09:06]** 放射状ストリーク：Sprite Rendererを削除しMesh Rendererに変更、Shape Location=Torus(Radius=0)、Distribution Random→Direct+Execution Indexで等間隔配置、Non-Uniform Scaleで一方向に伸ばしShape Vector/Normalで中心方向を向かせる
6. **[09:06]-[11:35]** ストリークのバリエーション：赤色化・Pure Red+2軸スケール（グロー化）・サイズランダム組み合わせ複製
7. **[11:35]-[12:41]** 仕上げの発光レイヤー：フェードリングをもう一度複製、Thickness増・Alpha減で馴染ませ

## 判断基準・タイミング設計のコツ

- 単一パーティクル・寿命無限・バースト1回の理由：「その場に張り付いて一瞬で完結」という表現。パーティクル自体を都度スポーンし直さず、Dynamic Parameterでフレームごとの形状変化をアニメーションさせやすくする
- 地面向きに寝かせる理由：衝撃が対象面に広がる印象を出すため、ビルボードではなく面に張り付く向きにする
- **リングの多重化**：中心に近いほど硬く明るく、外側ほど薄く広いという「衝撃の減衰」のグラデーションを、色・硬さ・スケールの3軸で階調をつけて視覚化
- Torus+Direct distribution+Execution Indexで等間隔配置する理由：ランダム配置だと線が偏り、均一な広がり感が出ない
- ストリークをShape Vector/Normalで中心方向に向ける理由：ランダム回転だと衝撃の指向性が崩れる
- 設計思想の核：「1つのリッチなマテリアル」ではなく「シンプルな1マテリアルを多層に重ねて豪華に見せる」アプローチ
- **タイミング面の限界**：この動画は静止した見た目の構築が中心で、フェードイン/アウトの具体的カーブ言及は乏しい

## 主要パラメータ

| 項目 | 値 |
|---|---|
| Material Shading | Two Sided/Unlit/Translucent |
| Ring生成ノード | Radial Gradient Exponential→Sine×2 |
| Ring1 Size | 200→400→600（試行） |
| Align to Mesh Orientation軸 | X→Z |
| リングレイヤー数 | 5前後 |
| Shape Location | Torus, Radius=0 |
| 分布方式 | Random→Direct+Execution Index |

## SCRAP BLITZ UE（METEOコンボヒット/ジャストブロック）への応用可能性

- 多層リング＋放射ストリークの構成はコンボヒット時の「命中痕」表現にそのまま応用できる。ヒット強弱（通常/クリティカル/フィニッシャー）でレイヤー数・色を変えるパラメータ化がしやすい
- ジャストブロック演出には「ハードエッジ化」テクニック（[03:19]-[03:31]）やストリークを短く鋭くする調整が相性が良い。通常ヒット=柔らかいフェード寄り、ジャストブロック=ハードリング+鋭いストリークで差別化する設計が考えられる
- **地面向き設定はSCRAP BLITZ UEの2.5D固定カメラには要検討**：3Dの地面/敵位置ではなく「敵の当たり判定面」に対して発生するため、カメラ正対（ビルボード）のままの方が画面上で視認しやすい可能性がある。座標系（X=奥行, Y=横スクロール, Z=高さ）に合わせた再検討が必要
- 単一シンプルマテリアルを多重複製する設計思想は、既存の「DrawDebug仮実装→本番Niagara/Decal差替」方針と親和性が高い

## 確信度が低い抽出

1. [00:19] "radial" → Radial Gradient Exponentialノードと推定
2. [07:10] "Taurus" → Torus Shape Locationモジュールと推定
3. [06:46] Sprite RendererからMesh Rendererへの切替の直接言及なし、文脈から推測
