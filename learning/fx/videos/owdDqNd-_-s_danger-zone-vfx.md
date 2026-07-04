# 学習ノート — Create a Danger Zone VFX in Unreal Engine 5 Niagara! (Area Warning & Pulsing Ring Tutorial)

- 動画: https://www.youtube.com/watch?v=owdDqNd-_-s （CGHOW、13分42秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/owdDqNd-_-s.txt](../transcripts/owdDqNd-_-s.txt)

## エフェクト構築手順（工程順）

1. **[00:53]-[01:18]** Niagara System `danger zone` 作成。Emitter State=Once、Spawn=Burst1、Particle自然死判定オフ
2. **[01:28]-[02:53]** リングを地面向きに：Sprite Renderer→Custom Alignment→Custom Facing Vector→Align to Mesh OrientationでX軸→Z軸に変更
3. **[02:53]-[03:36]** フェイクグロー（レイヤー重ね）：同じリングを複製し、太さ違い・opacity違いの2枚を重ねる（実際の輝度は上げていない点に自覚的）
4. **[03:44]-[06:18]** 内部の浮遊シンボル：4x4 SubUVテクスチャ、Animation Mode=Random（Sequentialでない）、Shape Location Distribution=Direct+Execution Indexで円周上に等間隔配置
5. **[06:18]-[08:09]** 半円リング追加：Texture CoordinateでMultiplyしリングを半分にカット。**注意：このマスク乗算はSin（リング形状生成）ノードの後に配置する必要がある**
6. **[08:09]-[09:39]** ライフサイクル化：Life 1〜2秒ランダム、Burst→Spawn Rate（10/秒）、Loop Behavior Once→Infinite、Size/Colorカーブでフェードイン/アウト
7. **[09:56]-[10:54]** 全体スケール調整（System直接スケールでなく個別モジュール値を調整、1000→800）
8. **[11:40]-[13:23]** シンボルにVelocity+Curl Noiseで揺らぎ付与、Spring Forceで初期位置に引き戻す拘束、Rotation Rateランダム化

## 判断基準・コツ

- リングを地面（Z軸）向きにする：Danger Zoneは地面投影の警告円のため必須
- グローをマテリアルでなくレイヤー重ねで作る：制作・調整のしやすさ優先
- SubUVのAnimation ModeをRandomにする：連続アニメーションでなく静止したランダム記号として散らすため
- Shape LocationのDistributionをDirect+Execution Indexにする：Randomのままだと粒子が偏る、均等配置で整列した見た目に
- マスク乗算はSignノードの後に置く：リング形状を作る処理より前に乗算すると意図と異なる結果になる
- Spring Forceで記号を初期位置に戻す：Velocity/Curl Noiseだけだとエリア外に流出してしまうため

## 主要パラメータ

| パラメータ | 値 |
|---|---|
| Facing軸変更 | X→Z |
| SubUVテクスチャ分割 | 4x4 |
| シンボルパーティクル数 | 約8 |
| パーティクルLife | 1〜2秒程度 |
| System全体サイズ調整 | 1000→800 |

## 既存SBMine型AOEテレグラフシステムとの比較

**同じ部分**：地面投影の警告表現という目的は同一。段階的な進行で情報を積み重ねる発想も近い。

**違う部分**：SBMineは「進行→到達で攻撃発生」という時間軸に紐づいたテレグラフだが、この動画は**常時ループする装飾的な危険地帯エフェクト**（トラップの存在提示）であり、進行度パラメータやゲームロジックとの連携（到達判定・ダメージ発生タイミング）は扱っていない。目的のレイヤーが異なるため混同しないこと。形状もSBMineの単純な円/箱に対しこちらは多層構成で描画コストが高い。

**取り入れられそうな点**：
1. フェイクグロー（レイヤー重ね）手法：輝度を上げずに太い半透明レイヤーを重ねる、SBMineのDrawDebug仮実装をNiagara本実装化する際に流用可能
2. Direct Distribution + Execution Indexによる均等配置：AOEに装飾的な浮遊シンボルを追加する際の整った印象付け
3. Spring Force拘束による「エリア内滞留」：現状のSBMineには無い演出要素
4. Custom Facing Vectorでの地面投影：Niagara製の地面デカール系エフェクトを作る際の基本テクニック

**総評**：予告システムはSBMine型を維持しつつ、危険地帯の「見た目の説得力」を上げる装飾レイヤーとしてこの技法を追加検討する使い分けが妥当。

## 確信度が低い抽出

1. [05:55]-[06:03] シンボルサイズ数値「175→150」
2. [10:20]-[10:23] System全体サイズ「1000→800」の対象パラメータ
3. [13:14]-[13:23] Rotation Rate範囲「-50〜15」の符号・単位
