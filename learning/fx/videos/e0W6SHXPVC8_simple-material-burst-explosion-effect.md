# 学習ノート — UE5 Simple Material Burst/Explosion Effect

- ソース: https://www.youtube.com/watch?v=e0W6SHXPVC8 （8:50）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし、`--list-subs` で確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\e0W6SHXPVC8.txt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [BJjNWKNptKc_lava-magma-flow-vfx.md](BJjNWKNptKc_lava-magma-flow-vfx.md)（ノイズ2枚ブレンドでの歪み表現が共通）、[iDrsEp3AGWA_magic-orbs.md](iDrsEp3AGWA_magic-orbs.md)（1粒メッシュバースト+User Parameters色制御が共通）。タイトル通り**Niagara側は最小構成（Spawn Burst 1粒+Mesh Renderer）で、マテリアル1枚の作り込みが本編の主題**

## 概要

球メッシュ1個をバーストさせるだけの Niagara システムに、煙×水ノーマルマップの二重歪み+Fresnel+HDR発光+法線ベースの膨張 WPO を仕込んだマテリアルを組み合わせ、爆発の瞬間の「もわっと膨らむ発光球」を表現する動画。Niagara 側の複雑な仕組みではなく、**マテリアル単体の質感作り込みで爆発感を出す**アプローチが主題。

## マテリアルの構築

### ベース設定
- Translucent, Unlit, Two-Sided

### 歪みレイヤー（ノイズ2種のブレンド）
1. Smoke テクスチャ（テクスチャサンプル）をベースに、UV を歪ませる
2. **Texcoord → Panner → ノイズテクスチャ（エンジン付属）** で歪み用UVを作る。Panner の Speed は Y方向のみに設定（1程度）
3. U Tiling = 2 に変更
4. Power ノードで値の範囲を制御し、Lerp（A=0.1, B=0.8）で歪み量をクランプ
5. **2枚目のノイズとして、水のノーマルマップ（エンジン付属）を追加**しブレンド。Speed はやや違う値（0.1程度）、U Tiling = 4
6. ノーマルマップを R・Gチャンネルのみでマスクし、1枚目のノイズと乗算 → Smoke テクスチャの UV 座標に加算
7. プレビューで歪み効果を確認

### Smoke自体の動きとコントラスト強調
- Smoke テクスチャにも Panner で速度を追加（Y=0.5程度）、Tiling を 3×2 に調整
- Power（exponent=0.5）で暗部を持ち上げ、`1 - x` してGチャンネルマスクと乗算 → コントラストを整える

### Fresnel + エッジ処理
- 最終合成値に **Fresnel を乗算**してエッジのフェードを作る
- Fresnel の Exponent を Lerp で制御（Alpha=`1-x`の値、A=0.5, B=2）、Reflect Fraction にも `1-x` を利用
- エッジの変化が弱かったため追加で Power（exponent=5）をかけて強調
- 得られたマスクを Opacity として使用。**Particle Color の Alpha を乗算**、さらに **Depth Fade** を掛けて Opacity に接続

### Emissive（HDR発光）
- **Drive HDR from LDR** ノードを使用: LDR入力=Opacity値、HDR Tint=Opacity×Particle Color
- 出力を Emissive Color に接続

### 反射・法線系の質感付け（Index of Reflection）
- Details パネルから **Index of Reflection** を検索して有効化し、法線・反射強度に Lerp（A=1, B=1.2）を接続
- マテリアル自体に厚み・ガラス感のような反射情報を与える調整（Translucent マテリアルでの反射表現の一種、詳細な内部仕組みは字幕からは不明瞭※推定）

### World Position Offset（膨張変位）
- ノイズテクスチャ + Panner（Speed Y = 1）を World Position Offset に接続
- **World Vertex Normal（World Space）を乗算**してから WPO Scale（100程度）を掛ける
- 法線方向にノイズで頂点を押し出す、球メッシュの表面をボコボコと膨張させる効果

## Niagara システムの構築

- Emitter Spawn に **Spawn Burst Instantaneous** を追加（1粒バースト）
- Render は **Mesh Renderer**、メッシュはエンジン付属の Basic Shape（Sphere）
- マテリアルは上記で作成したものを割当
- **Particle Lifetime**: 0.3秒程度（短命=瞬間的な爆発感）
- **Particle Color**: 青系、HDR値で明るく（例: 0.2, 1, 100 のような高輝度値）
- **System の Loop Duration** を明示的に1に設定（デフォルトのままだと再生が正しくループしないことへの言及あり）
- **Mesh Scale** を大きめ（5〜10）に設定
- Particle Update に **Scale Color** と **Scale Mesh Size** を追加
  - Scale Color: Vector from Float + Curve（RGBは 0→1→0 のカーブでカーブスケールを大きく＝100程度、Alphaは 0→1→0 でスケール1程度）
  - Scale Mesh Size: 同様に Vector from Float + Curve（0→1→0）でサイズを時間変化させる
- 色は **User Parameters** 化してレベル側インスタンスごとに変更可能にし、Niagara System を複製して色違いバリアントを量産するデモも実施（青→赤/ピンクなど）

## 新規性のある技術情報（既存ドクトリンとの比較）

`fx_technique_doctrine.md` の「マテリアル定型」節と比較すると:

- **Drive HDR from LDR ノードでの Emissive 駆動**（LDR=Opacity値、HDR Tint=Opacity×Particle Color の組み合わせ）は既存 doctrine 未収録。HDR値をベタ書きせず Opacity と連動させる設計として、グロー勾配節に追記候補
- **Index of Reflection（反射率）を Translucent マテリアルに追加する調整**は既存ノートに前例なし。爆発球の「表面の質感」に反射情報を足す手法として新規（ただし本ノートでは内部の数理的な効き方までは字幕から特定できず※推定）
- **World Vertex Normal (WS) × ノイズ × 大スケール(100) の WPO**による球体膨張変位パターン自体は、既存の [G0WNZqhkgAU_fragmented-sphere-animation.md] の「Vertex Normal WS×Noise×100→WPO」と酷似（同一パターンの再現例）。差分は本ノートでは**Panner駆動の時間変化ノイズ**である点（フラグメント破片ノートは静的なUV1レイアウトサンプリング）
- **ノイズ2枚（煙UV歪み用+水ノーマルマップ）のマスク乗算合成で歪み量を作る**手法は、既存 doctrine のグロー勾配・Erosion定型とは異なる「二重ノイズ歪み」パターン。[BJjNWKNptKc_lava-magma-flow-vfx.md] と技術的に近いが、本ノートは煙×水ノーマルという組み合わせが差分

## SCRAP BLITZ UEへの応用メモ

- **Niagara不使用（Spawn Burst 1粒+Mesh Renderer）の軽量爆発表現**は、doctrine の「1粒バースト+カーブ駆動の器」原則そのもの。**多数同時発生する着弾/被弾エフェクト**（雑魚敵の被弾ヒットスパーク、Crate/GasCanister破壊時の小規模爆発、複数弾丸の着弾処理）でNiagara側のパーティクル数を増やさずに質感を出したい場面に直結
- マテリアル1枚+球メッシュ1個で完結するため、**GPU負荷を抑えたい多数同時発生シーン**（例: 範囲攻撃で複数の敵に同時ヒットする際の着弾エフェクト、雑魚敵の大量撃破時の爆発演出）への転用価値が高い。Niagara Emitterの数を増やさず、User Parameters経由でColorだけ差し替えたバリアントを量産できる構成は、既存の OCジェム/浮遊オーブ資産（`iDrsEp3AGWA_magic-orbs.md`）で確立済みの色バリアント量産パターンと同じ設計思想
- WPO による球体膨張演出は、ボス撃破時の3フェーズ演出（freeze→explode→ring、CLAUDE.md記載）の explode フェーズの**質感強化**（単なるパーティクル拡散でなく「膨らんでから弾ける」ニュアンス）に使える可能性がある。ただし既存実装は DrawDebug 仮実装段階のため、本番Niagara/マテリアル差替時の候補技法として記録
- Drive HDR from LDR での Emissive 駆動は、既存の「色はHDR値+User.Color一点制御」というdoctrineの方針とも親和性が高く、爆発系エフェクトのEmissive設計を整理する際の具体的なノード構成として使える

## ソースの限界

- 英語自動字幕のみで手動字幕なし。ノード名・数値（Power の exponent値、Lerp の A/B値、Tiling値、WPO Scale値等）は音声認識のブレを含む可能性があり、「※推定」と明記した箇所は実装時に UE 実機で再検証が必要
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。特に **Index of Reflection（反射）** の内部的な効き方や、**Fresnel の Reflect Fraction に `1-x` を接続する意図**の数理的根拠は、字幕の言葉のみからは機構が完全には特定できていない
- 8:50 の短い動画で操作テンポが速く、ノードの接続順序が字幕からは前後関係が曖昧な箇所がある（特にFresnel節とOpacity節の間の接続順）。実装時は本ノートの記述を叩き台としつつ、UE 実機での再現検証を推奨
