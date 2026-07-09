# 学習ノート — UE5 Material Portal Effect

- ソース: https://www.youtube.com/watch?v=FHM6EOmOZkw （7:04）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（手動字幕なし）** → `--list-subs` で "has no subtitles"（手動字幕なし）を確認済み。誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `C:\Users\90g-r\AppData\Local\Temp\claude\...\scratchpad\FHM6EOmOZkw.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [h-gp4l1oIbU_portal-vfx.md](h-gp4l1oIbU_portal-vfx.md)（エッジ回転+内向き渦の歪み+Bump Offset疑似視差が主題）、[58RyWzN8O84_magic-portal-vfx.md](58RyWzN8O84_magic-portal-vfx.md)（ピクセル化マスク+DMP開閉+Cube Map内部表現が主題）。**本ノートの違い**: 短尺（7分）でごく短くまとめた実装で、内部テクスチャは Cube Map でなく **Triplanar** サンプリング、開閉アニメーションはマスクの Step/Alpha 制御ではなく **World Position Offset（WPO）による幾何学的な収縮**という、既存2本とは異なる第三の開閉手法が核心

## 概要

円形ポータルを 1 本の動画内でマテリアル〜Niagara まで一気通貫で作る短尺チュートリアル。エッジのリング + 内部の Triplanar テクスチャ + 明滅エミッシブ + 歪み(distortion) + WPO による開閉、という一通りの要素を最小構成で詰め込んでいる。既存2本と比べて個々の技術の掘り下げは浅いが、**WPO ベースの開閉**という手法だけは他2本に存在しない新パターン。

## 技術詳細（章立て）

### マスク・エッジ（既存パターンの再利用と字幕内で明言）
- Blend Mode = Translucent, Shading = Unlit, Two Sided
- Sphere Mask で円の内側を塗り、そこから **2回の減算（subtraction）** でエッジのリングだけを抽出（大小2マスクの差分でエッジを作るという、58RyWzN8O84 と同型のロジック。動画内でも「これは以前の動画で作った」と明言）
- 大きい円マスク → Opacity（Alpha として乗算）、リングマスク → RGB（色）に乗算、という Opacity/Emissive の役割分担

### 内部テクスチャ（Triplanar）— 本ノートの新規要素
- 内部の「S(ky?)テクスチャ」を **Triplanar ノードで Texture Object に変換して接続**（UV を使わずワールド座標ベースでテクスチャを貼る手法）
- Triplanar のパラメータを調整: Tiling を `0.5`、もう一方（Offset 相当）を `1.5`、テクスチャ間のブレンドを最初 `100` → 見え方が強すぎたため `4` に変更（※推定、数値の対応関係は字幕から完全には特定できず）
- 既存ドクトリンに Triplanar の言及はなし。UV マッピング不要でメッシュに依存しないテクスチャ表現という点で、doctrine の「メッシュ UV 非依存」志向（h-gp4l1oIbU の Panner+Time 歪み）と目的は近いが手段が異なる

### 明滅エミッシブ
- 内部テクスチャに Time を乗算 → 明滅の頻度を Time×`0.3` で遅く調整
- Sine ノード（字幕上「sign constant」）で明滅を作り、周期パラメータ（字幕「bell scale」※推定、恐らく Period）を `2` に設定
- Time 由来の値と Sine 由来の値を乗算して Emissive Color に接続。既存ドクトリンの「グロー勾配」節にある HDR+Multiply 系の延長線だが、Sine による周期明滅という具体形は初出

### エッジの歪み（distortion）— 既存ドクトリンと同一パターン
- 2D Vector でスフィアの UV 位置を制御 → 煙(smoke)テクスチャを歪みソースとして使用 → Rotate + Panner で歪みを動かす → 同じノード群をコピーしパラメータを変えてブレンドし歪みの質を上げる
- これは doctrine の「Additive2系統並列（Offset違いのUV制御関数をMultiply合成）で多層パン」節と完全に同型の手法。**新規性なし、既存パターンの再確認**

### World Position Offset による開閉 — 本ノートの核心・新規パターン
- World Position - Object Position で「オブジェクト中心からの相対位置」を算出
- これを **Lerp で `A=1, B=0` として、パラメータ（動画内で "world position offset" とリネーム）で補間** — パラメータが 0 のとき、頂点がオブジェクト中心に収縮した「閉じた」状態になる
- この Lerp 結果に Sphere Mask を乗算してから WPO 出力に接続（マスク済みの範囲だけ収縮させる）
- **既存2本はいずれもマテリアルの Opacity/Alpha マスクか、Niagara 側の Scale カーブで「開閉」を表現していたのに対し、本動画は WPO で頂点そのものを動かして幾何学的に収縮させる**という第三のアプローチ。マスクや不透明度でなく「メッシュが実際に縮む」ため、ポータルの縁が波打つような視覚効果が期待できる

### Niagara セットアップ
- Mesh Renderer、円形の Static Mesh + 上記マテリアルを使用
- Spawn Burst、Particle Lifetime = 10 秒
- **System の Loop Time を 12 秒に設定**（Lifetime より長くすることで、5 秒おきに再スポーンして見た目がガタつく問題を回避）。既存ドクトリン・既存ノートに未収録の実務 Tips
- Particle Color は内部テクスチャに合わせて紫
- Initial Mesh Orientation で Rotation Mode を None にし、X 軸回転を `0.25` に設定してメッシュを立たせる — **これは 58RyWzN8O84 の「Initial Mesh Orientation で X=0.25」と全く同じ値・同じ目的**（別チャンネルでの技法収束。信頼度の高い定石として扱ってよい）
- Particle Update で Scale（メッシュサイズ）と Color をカーブ制御。加えて Dynamic Material Parameter を追加し、上記 WPO 用パラメータ（"R position of sight"※字幕表記ゆれ、恐らく world position offset パラメータ）もカーブで駆動して開閉アニメーションを作る

## 新規性のある技術情報（既存ドクトリンとの比較）

- **Triplanar ノードによる UV 非依存の内部テクスチャ表現**（`Texture Object` へ変換して接続）: doctrine 未収録。h-gp4l1oIbU の「メッシュ UV 非依存」志向とは別の実現手段として追記候補
- **World Position Offset + Lerp によるメッシュの幾何学的収縮を使った開閉アニメーション**: 既存2本（Opacity/Alpha マスクの Step 制御、Niagara Scale カーブ）とは異なる第三の開閉パターン。**本ノート最大の新規性**。「マスクで隠す」でも「スケールを変える」でもなく「頂点を中心に寄せる」ことで開閉を表現する発想は doctrine のどの節にも該当がなく、独立項目として追記価値あり
- **System Loop Time をパーティクル Lifetime より長く設定して再スポーンのガタつきを避ける** Tips は doctrine 未収録の実務的な調整項目
- **Sine ノードによる Time ベースの周期的明滅**は具体的な組み方（Time×係数 → Sine(Period) → Emissive 乗算）まで doctrine に記載はなく、軽量な追加パターンとして記録
- 一方でエッジの歪み手法（Rotate+Panner+ノード複製ブレンド）は doctrine「Additive2系統並列」と同一のため重複、大小マスク差分によるリング抽出は 58RyWzN8O84 と同一のため重複、Initial Mesh Orientation X=0.25 も 58RyWzN8O84 と同一のため重複（ただし別チャンネルでの再現という点で定石としての信頼度は上がる）

## SCRAP BLITZ UEへの応用メモ

- **WPO 収縮による開閉**は、既存2本の「マスクで隠す/スケールで縮める」よりも視覚的に派手な「メッシュそのものが渦に吸い込まれて消える」表現が可能。ボス撃破後のリスポーンポータルや、ステージクリア時の「足場が中心に収縮して消える」演出など、**マテリアルだけで完結する軽量な崩壊/収束エフェクト**として OC ジェム以外の場面（ステージギミック、床の消滅演出）にも転用余地がある
- **Triplanar での内部テクスチャ表現**は Cube Map（58RyWzN8O84）より軽量かつ専用アセット不要（既存の任意テクスチャをそのままワールド座標で貼れる）なため、簡易版のポータル/ワープ演出で「とりあえず内部に何か表示したい」場合の最速の選択肢になる
- **System Loop Time > Particle Lifetime** の Tips はポータル以外の全ての Burst 系 Niagara システム（既存の OC ジェム・出現ギミック含む）に横展開可能な一般的注意点。今後 Burst 1回ものを組む際にチェックリスト化する価値あり

## ソースの限界

- 英語自動字幕のみで手動字幕なし。特に Triplanar パラメータの数値（Tiling 0.5 / Offset 1.5 / ブレンド 100→4）、Sine の Period 値（2）、WPO パラメータの正確なノード名（"world position offset" とリネームされたと解釈したが字幕上は "road position of site" 等の誤認識が混在）は音声認識のブレを含み、「※推定」と明記した箇所は実装時に UE 実機での再検証が必須
- 実際のノードグラフ画面は視聴しておらず、transcript ベースの要約のみ。特に WPO 節の Lerp の A/B がどちらが「開」でどちらが「閉」かは文脈から妥当と判断した推定であり、確実ではない
- 動画が短尺（7分）のため各技術の解説密度が既存2本より薄く、細部のロジック（Triplanar のどの入力が何を意味するか等）は動画自体からも十分な情報が得られていない可能性がある
