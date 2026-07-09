# 学習ノート — UE5 Niagara Combine Burst/Explosion Effect（複数エフェクト統合編）

- ソース: https://www.youtube.com/watch?v=5XPRb87I63k （9:27）
- 視聴日: 2026-07-09 / 字幕種別: **英語自動字幕のみ（`--list-subs` で手動字幕なしを確認済み）** → 誤認識の可能性がある箇所は「※推定」と明記
- 原典 transcript: `G:\claude_code_local\learning\scratch_tmp\5XPRb87I63k.en.vtt`（ローカル一時ファイル、恒久パスではない）
- 関連ノート: [bNaVaa9HTXY_niagara-burst-vfx.md](bNaVaa9HTXY_niagara-burst-vfx.md)・[h5pTEnXjZuo_spark-burst-vfx.md](h5pTEnXjZuo_spark-burst-vfx.md)（同じ「バースト」系だが、あちらは**個別エミッタの作り方（メッシュ死亡連鎖／velocity継承）**が主題。本動画は**個別に作った既存エミッタ群をまとめて1つの完全な爆発Systemへ統合する手順**が主題で、新規モジュール構築はほぼ登場しない

## 概要

作者いわく「以前作ったエフェクトを組み合わせて完全な爆発エフェクトを作る」動画。Shock Wave / Burst / Beam / Smoke（2種）/ Fire（メッシュベース3種）/ Confetti Burst（実質スパーク）/ Directional Burst（実質スパーク）/ Glow（3種）という**別々の動画で個別制作済みのエミッタ群を1つの Niagara System にまとめて配置し、パラメータはほぼ変更せず、色だけ User Parameter で一元化する**という構成。新規のモジュール追加やロジック構築はほとんどなく、**「単体では地味な個別エフェクトを重ねると爆発になる」という統合方針そのもの**が動画の主題。

## 技術詳細

### 統合対象エミッタ一覧（System内の構成）

1. **Shock Wave**（衝撃波） — 過去動画で作成、パラメータ変更なし、色のみ User Parameter 化
2. **Burst** — 過去動画のバースト効果、変更なし
3. **Beam** — 過去動画のビーム、変更なし
4. **Smoke**（通常） — Spawn Burst=200、Initial Particle：Color/Sprite Size/Shape Location=Cylinder/Velocity from Point。Particle Update：Sprite Rotation Rate、Scale Sprite Size、Dynamic Material Parameter、Scale Color。Render=Mesh、Material参照
5. **Smoke（大）** — 同じ Smoke を複製し Spawn count を増やして「内側でより大きく」表示する変種（パラメータ微調整のみ）
6. **Fire 1〜3**（3種） — 前述の Shock Wave と近い構成だが Mesh Render を使用。Fire1 で Scale Mesh Size の X 軸を5に変更（メッシュを引き伸ばす）。Fire2/Fire3 はほぼ同じ設定の複製（※字幕が音楽区間で欠落し詳細不明）
7. **Confetti Burst**（実質スパーク） — Shock Wave 由来のマテリアルを使った火花見た目のエミッタ
8. **Directional Burst**（実質スパーク） — Confetti Burst 同様 Shock Wave 由来、指向性を持たせたスパーク
9. **Glow / Glow001 / Glow004**（3種のグロー） — いずれも Shock Wave 由来で構築。**Mesh Render に Plane 形状 + 専用マテリアル**を使用。3つとも**Z軸スポーン位置に+100のオフセット**を加えているだけで他のパラメータはほぼ変更なし

### 核心技術1: 色の一元制御（User Parameter Color）

すべてのエミッタの色が **User Parameter** として公開されており、レベル側（System インスタンスの Details パネル）から**1箇所の色変更で全エミッタの色が連動して変わる**ように設計されている。個々のエミッタ内では Particle Update の Scale Color モジュールがこの User Parameter を参照する形。

### 核心技術2: グロー3種のZ軸オフセットによる中心配置

Glow / Glow001 / Glow004 の3エミッタは**スポーン位置のZ軸に+100を加算**しているだけで、他は共通のロジックを使い回している。これは「爆発の中心（見た目の焦点）にグローを持ち上げて配置し、地面レベルのバーストと視覚的な重心をずらす」ための最小限の調整（※動画内で明示的に「爆発の中心に表示されるように」と言及）。

## 新規性のある技術情報（既存ドクトリンとの比較）

- **System = 個別エミッタの寄せ集めではなく「統合セッション」という制作フロー自体**が新規情報。doctrine「System 階層=監督」は Spawn/Update の共通値一元化に触れているが、本動画は**それ以前の段階＝「別々の動画で作った完成済みエミッタをそのままコピー＆配置するだけで爆発が完成する」というワークフロー**を示す。バースト2本（[bNaVaa9HTXY]・[h5pTEnXjZuo]）が「1エミッタ/1カスケードの内部構造」を扱うのに対し、本動画は**その一段上・System全体の「組み立て方」**を扱う点で対照的
- **色の一元制御を全エミッタ横断で行う具体例**: doctrine の User Param Binding は「Meshベース→マテリアル接続」の文脈で触れられているが、本動画は**8〜10個の異種エミッタ（Shock Wave/Smoke/Fire/Spark/Glow）すべてが同一の色 User Parameter を参照する**という規模の大きい実例。1色を変えるだけで爆発全体の色調（例：赤爆発→青爆発）を切り替えられる設計として新規性がある
- **同一ロジックのエミッタをZ軸オフセットのみで複製し、視覚的な重心をずらす**手法（Glow×3）は doctrine 未収録。Sort Order Hint や RendererVisibility タグによる層分けとは異なり、**「同じロジックのコピーを空間的にずらして配置する」という最も単純な多層化手法**として記録価値がある
- 内容の大半（Shock Wave/Smoke/Fire個別の作り方の詳細）は「以前の動画で作成済み」として省略されており、本動画単体からは個々のモジュール構成を再現できない（次項参照）

## SCRAP BLITZ UEへの応用メモ

- SP技の必殺演出やボス撃破演出など「複数のエフェクトを重ねて派手にする」場面では、本動画のように**個々のエフェクト（衝撃波・煙・火花・グロー）を先に単体で完成させてから、最後に1つの System にまとめて配置する**という工程分割が有効。いきなり1つの巨大 System を作るより、個別に検証してから合成する方が調整しやすい
- **色の一元 User Parameter 化**は、SCRAP BLITZ UE のヒットエフェクト/クリティカルエフェクトで「同じ System をキャラ別・属性別に色だけ差し替えて使い回す」用途にそのまま使える。現状 OCジェムの Fresnel シェルや爆発演出を個別に色調整している箇所があれば、共通 User Parameter に統合できないか検討価値がある
- Glow のZ軸オフセットによる重心ずらしは、GasCanister 爆発や敵撃破エフェクトで「地面付近のバーストと、少し上に浮いたグロー」を組み合わせて画面の見栄えを底上げする安価な手法として転用できる（新規モジュール不要でコピー＋座標オフセットのみ）

## ソースの限界

- 英語自動字幕のみで手動字幕なし。前半（0:00〜4:41 付近）は比較的明瞭だが、**中盤〜後半（Fire3以降、Glow各種の設定説明部分）は「settings」「okay let's say」等の短い発話のみが認識され、実際の数値・モジュール名の大半が字幕上に現れていない**（動画内で画面を見せながら無言〜短い相槌で進行しているため、音声認識できる発話量自体が少ない）
- Fire1〜3・Glow/Glow001/Glow004 の個別パラメータ差分は、字幕からはほぼ再現不能（「ほぼ同じ」「Z軸に100加算」以外の詳細は不明）
- 動画がそもそも「以前の動画」で作った個別エミッタの再利用を前提としており、Shock Wave・Smoke・Fire・Beam の内部モジュール構成そのものは本動画の対象外（前提動画群は本ノートの調査範囲外）
- User Parameter による色一元化の具体的な配線（各エミッタの Scale Color モジュールが User Parameter をどう参照しているか）は画面を視聴しておらず、transcript の言及のみに基づく推定
