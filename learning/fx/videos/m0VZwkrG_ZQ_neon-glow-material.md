# 学習ノート — Unreal Engine 5: How to Create Glowing Materials and Beautiful Neon Light Effects Step by Step

- 動画: https://www.youtube.com/watch?v=m0VZwkrG_ZQ （4分10秒、AI Cinematic）
- 学習日: 2026-07-07 / 抽出: **英語手動字幕**（最優先ソース種別。ASRでなく作者投稿字幕）
- チャプター: Intro(0-5s) / Creating the main material(5-55s) / Creating a glow material(55-154s) / Creating the neon effect(154-195s) / Neon effect example(195-250s)

## 前提・スコープ

- 短尺・技術的にシンプルな動画。**Emissive Colorを持つマテリアル + Bloom（Post Process Volume）**という定番構成を、マテリアルグラフのノード単位から手順化している
- ノードの詳細な接続座標やパラメータ数値までは字幕からは追えないが（音声のみの言及）、構成要素と手順の順序は明確

## マテリアルグラフ構成（Step 1: メインマテリアル）[00:03]-[00:53]

1. Content Drawer で新規 **Material** を作成、命名
2. マテリアルエディタを開き、右クリックメニューから以下3ノードを追加：
   - **Vector Parameter**（色を表す）
   - **Scalar Parameter**（強度を表す）
   - **Multiply**
3. [00:40] Vector Parameter × Scalar Parameter → **Multiply** → **Emissive Color** に接続（動画では「私の例の通りに繋ぐだけ」としか言及されておらず、Multiplyの2入力がVector×Scalarであることは文脈上ほぼ確実だが、Emissive Color以外の出力先を持つかは字幕からは断定不可）
4. 保存してマテリアルエディタを閉じる

## Material Instance による色違い量産（Step 2: グローマテリアル）[00:54]-[02:30]

- [00:58] メインマテリアルを右クリック → **Create Material Instance**
- Material Instance には親マテリアルの2パラメータが露出：
  - **色パラメータ**（Vector Parameter）例: 赤・青
  - **強度パラメータ**（Scalar Parameter）：0で無発光、10でかなり強く発光（[01:19]-[01:23]、値域の実測は動画内の目視スライダー基準で正確な数値保証はなし）
- 命名は色に合わせる（例: `M_Glow_Red`, `M_Glow_Blue` 相当）。**同じ親マテリアルから Material Instance を複製するだけで色違いバリエーションを量産できる**のがこの構成の要点
- [01:37]-[01:47] 検証：Sphere にマテリアルを適用 → 発光は確認できるが、**シーンのベースライティング（Base Lighting/Sky等の既存光源）が干渉して弱く見える**ため、検証時はベースライティングを除去して確認するのが実践的（本番シーンでは光源設計とのバランス調整が必要という含意）
- [01:49]-[01:57] 光源の Power パラメータ言及：20000で「シーン全体が明るくなりすぎる」、25 が「このシーンに最適」と判断。**具体的な数値は当該シーン・ライト種別に依存する参考値であり、汎用の推奨値として断定はできない**（動画内の一回限りの調整結果）

## Post Process Volume によるネオン化（Step 3）[02:34]-[03:12]

1. **Visual Effects → Post Process Volume** をレベルに配置
2. 詳細パネルで **Infinite Extent (Unbound)** を有効化（リスト下部にある項目、と言及。ボリューム範囲を無限化してレベル全体に効果を適用する標準的な使い方）
3. **Bloom** セクションで **Method** と **Intensity** を設定 → これでグロー（滲み）効果が完成
4. [02:58]-[03:04] Bloom の Intensity は**シーン内の全発光光源に同時に影響する**（複数の色付きグローがあっても一括で強さが変わる）。**個別の色ごとの発光強度**を変えたい場合は、Bloom側ではなく**各 Material Instance の Scalar Parameter（強度パラメータ）** を個別に変更する、という役割分担が明示されている

## 判断基準・コツ

- **技術の核**は「Emissiveを持つ基本マテリアル1つ → Material Instance で色を量産 → Bloom（Post Process Volume）で画面全体のグロー感を後処理として付与」という**マテリアル内部（発光そのもの）とポストプロセス（滲み表現）の役割分離**
- Bloom Intensity（全体一括）とMaterial InstanceのScalar Parameter（色ごと個別）という**2段階の強度コントロール**を使い分ける設計は、量産・調整のしやすさの点で理にかなっている
- ベースライティングとEmissiveの干渉は実装時のハマりどころとして明示的に言及されている（暗いシーンでないと発光が霞むという一般的な注意点の実演）

## 確信度が低い抽出（自己申告）

1. Multiply ノードの2入力が厳密に Vector Parameter と Scalar Parameter のどちらがどちらに繋がるか（順序）は字幕上「例の通りに繋ぐ」としか説明されておらず、標準的な Color×Intensity→Emissive の定型と推測されるが画面を直接確認したわけではない
2. Light Power の 20000 / 25 という数値は動画内の特定シーン・特定ライトでの調整結果であり、汎用的な推奨値として扱うべきではない
3. Vector Parameter がベースカラーではなく直接Emissiveに乗るのか、Multiply結果が他のマテリアル出力（Base Color等）にも分岐しているかは未確認（字幕からは Emissive Color への接続のみ言及）

## SCRAP BLITZ UEへの応用可能性

- 既存 doctrine の「グロー勾配」節（[[fx_technique_doctrine.md]] v2.3）は Divide(小値)・Depth Fade・HDR値+User.Color 一点制御など**マテリアルグラフ内部**のグロー生成テクニックが中心。本動画の Material Instance 量産パターン自体は既存の「RGB白1px差し替えで色分離」「Fresnel系マテリアル」と近い発想で、OCジェムやアイテムグロー等の**色違いバリエーション量産**（例: レアリティ別の発光色）にそのまま適用できる
- SCRAP BLITZ UEのシーンには既に Post Process 設定が存在する可能性が高いため、新規追加ではなく**既存 Post Process Volume の Bloom 設定を確認した上での調整**が現実的な適用パス

## doctrineとの比較（新規性チェック）

- fx_technique_doctrine v2.3 の「グロー勾配」節は Divide(小値)・Depth Fade・HDR値+User.Color 制御など**マテリアルグラフ内テクニック**が中心で、**Post Process Volume 側の Bloom 設定（Method / Intensity / Infinite Extent）**への言及は無い。本動画はグロー表現を「マテリアル側のEmissive」と「ポストプロセス側のBloom」の**2工程に明確に分離**した最小構成を示しており、**doctrineに欠けていた「マテリアル外」のグロー要素（Post Process Volumeの設定手順）を補完する新規情報**
- Material Instance による色違い量産という考え方自体は目新しくないが、**「Bloom Intensity＝全体一括の強さ」「Material Instance の Scalar Parameter＝個体ごとの強さ」という2段階コントロールの役割分担**は既存21本超のfxノートに明示的な言及が見当たらず、記録に値する
