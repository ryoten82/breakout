# 学習ノート 02 — MetaSounds Quick Start（Epic 公式ドキュメント）

- ソース: https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-quick-start
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/metasounds-quick-start.md](../transcripts/metasounds-quick-start.md)
- 前提バージョン: Unreal Engine 5.8 / First Person Template + Starter Content

## MetaSounds とは（Sound Cueとの違い・DSPグラフという性質）

原文は MetaSound を「高性能な DSP（Digital Signal Processing）グラフベースのオーディオシステム」と定義し、「オーディオデザイナーが音生成のための DSP グラフをコントロールできる」ことを Overview の要点として挙げている。

既存ノート（[KG0uD64AG1Y_sound-course.md](KG0uD64AG1Y_sound-course.md)）が扱う Sound Cue は、SoundWave（完成済み波形アセット）を素材として Random / Concatenator / Mixer / Looping / Delay / Modulator といったノードで**再生の組み合わせ方**を制御する仕組みだった。対して MetaSounds は Wave Player・Mixer・Filter・LFO などの DSP ノードでグラフを組み、**音そのものの生成・変調過程**を扱う点で階層が異なる（※一般知識で補足: Sound Cue は「既存の波形をどう鳴らすか」の制御層、MetaSounds はその一段下、波形処理そのものを含むグラフを組めるシステムという位置づけ。この整理は一般的な UE5 オーディオシステムの理解に基づく補足であり、原文が明示的にこの対比を述べているわけではない）。

原文が明示している技術要素はこの2点のみ:
- Wave Player・Mixer・Filter・パラメータコントロールノードを使った MetaSound グラフ構築
- Blueprint 連携によるリアルタイムのサウンドトリガー・float パラメータ更新

## 実例1: Bomb Sound Effect（3D空間化・Wave Player・Mono Mixer・ランダム選択・Blueprint連携）

原文の記述:
- 3D 空間化のための sound attenuation を持つ **MetaSound Source** を作成
- **Wave Player** ノード・**Mono Mixer**・**ランダムサウンド選択**を使用
- projectile Blueprint と連携し、**衝突時に爆発音をトリガー**

構成要素の役割分担（原文に明記された範囲）: Wave Player で波形を読み込み、複数候補からランダムに1つを選択し、Mono Mixer で合成した上で、sound attenuation により距離に応じた3D空間化を行う。この MetaSound Source を projectile（発射物）Blueprint に接続し、衝突イベントをトリガーとして再生する。

## 実例2: Ambient Wind Sound（ステレオ非空間化・Noise/LowPassFilter/LFO・速度連動パラメータ）

原文の記述:
- ステレオ・**非空間化**のアンビエントオーディオを作成
- **Noise generator・Low Pass Filter・LFO** ノードで動的なバリエーションを実現
- **Level Blueprint** と接続し、**プレイヤーの移動速度に応じて音の強度を変調**

Bomb Sound Effect が「3D空間化された単発トリガー音」であるのに対し、Ambient Wind Sound は「非空間化の常時再生アンビエント」という対照的なユースケースになっている。Noise generator で基礎ノイズを生成し、Low Pass Filter と LFO（Low Frequency Oscillator）で時間変化を加えて単調さを避け、Level Blueprint からプレイヤーの移動速度という float パラメータをリアルタイムに渡すことで音の強度が変化する仕組み。

## SCRAP BLITZ に活かせる部分

- **Bomb Sound Effect パターンは爆発・ヒット SE に直接応用できる**: 「3D 空間化 + ランダムサウンド選択 + Blueprint 衝突トリガー」という構成は、SCRAP BLITZ の被弾音・爆発音・OC 発動音の実装要求とほぼそのまま重なる。既存ノート（Sound Course）では Sound Cue の Random ノード + Weights + Randomize without Replacement で同種の「ランダム選択によるバリエーション化」を実現していたが、MetaSounds ではこれを DSP グラフレベルで Wave Player + Mono Mixer + ランダム選択ノードとして組める。Sound Cue とどちらを使うかは今後の検討課題だが、少なくとも「ランダム選択で単調さを回避しつつ3D空間化する」という設計目標自体は両システムで共通しており、既存の pickup SE / ヒット音の設計方針とも合致する。
- **Ambient Wind Sound の「移動速度連動パラメータ変調」はベルトスクロールアクションのエンジン音・移動音に転用できる考え方**: 自機の移動速度を Blueprint から float パラメータとして MetaSound グラフに渡し、Low Pass Filter や LFO でリアルタイムに音の強度・質感を変えるアプローチは、原文では「風の音」への適用例だが、自機のブースト音・移動 SE・エンジン音等にも同じ仕組み（速度→パラメータ→フィルタ変調）を流用できる可能性がある。ただし原文はあくまで環境音（ambient wind）への適用例のみを述べており、自機エンジン音への適用は本ノートの推測（※一般知識で補足ではなく、あくまで構造的類推であることを明記）。
- 既存ノートで指摘されていた「Sound Class / Sound Mix / Concurrency（同時再生数制御）が Sound Course では扱われていない」という欠落は、本ソースでも同様に埋まっていない。MetaSounds Quick Start にもミキシング階層・同時再生数制御についての記述は無い。

## ソースの限界

- 取得方法が WebFetch による要約モードのため、原文は概要レベルの記述に留まり、実際のノード接続手順・具体的なパラメータ値（Low Pass Filter のカットオフ周波数、LFO の周波数・波形種別、Mono Mixer のチャンネル設定など）は一切含まれていない。
- 「MetaSounds in Unreal Engine」というハブページも確認したが、本文がほぼ空のスタブだったため採用を見送り、この Quick Start を採用した経緯がある（transcript 冒頭に記載）。MetaSounds の全体像（Interface・Preset・Source 間の関係、Patch との違いなど）を扱う一次情報は今回のソースには含まれていない。
- Sound Cue との使い分け基準（どちらを新規プロジェクトで採用すべきか、移行パスがあるか）について原文は一切言及していない。
- Blueprint 連携の具体的なノード名・関数名（Set Float Parameter に相当する MetaSound 版 API など）は原文に記載が無く、本ノートでも触れていない。
- Concurrency・Sound Class・Sound Mix といったミキシング階層の情報は本ソースにも存在せず、SCRAP BLITZ の「戦闘中の多重再生時ミキシング」という要求への回答は依然として別ソースでの補完が必要。

---

内容サマリ:
1. MetaSounds は DSP グラフベースの次世代オーディオシステムで、既存ノート（Sound Cue 中心）が扱う「波形の組み合わせ方の制御」とは異なる層（音生成・変調過程そのもの）を扱う。
2. Bomb Sound Effect 実例は「3D空間化 + Wave Player + Mono Mixer + ランダム選択 + Blueprint衝突トリガー」、Ambient Wind Sound 実例は「非空間化 + Noise/LowPassFilter/LFO + 移動速度連動パラメータ」という対照的な2構成。
3. SCRAP BLITZ には爆発・ヒット音のランダム化+3D空間化（Bomb Sound Effect 型）と、自機速度連動の音変調（Ambient Wind 型からの構造的類推）の2点が応用候補になる。
4. 本ソースは WebFetch 要約のため情報が概要レベルに留まり、具体的なパラメータ値・ノード接続手順・Sound Cue との使い分け基準・ミキシング階層（Concurrency等）は依然として不明。

原文に無いのに書いてしまった可能性がある箇所:
1. 「SCRAP BLITZ に活かせる部分」内の Sound Cue と MetaSounds の階層関係の整理（「Sound Cue は再生の組み合わせ制御層、MetaSounds は音生成・変調過程を扱う層」という対比）は、原文が明示的に述べているものではなく、原文の2つの実例の記述内容から私が構造的に推測したもの。本文中では「※一般知識で補足」と明記して区別した。
2. Ambient Wind Sound の仕組みを自機エンジン音・移動音へ転用するアイデアは、原文が言及しているのはあくまで「風の音」のみであり、自機音声への適用は本ノートの類推。本文中で「本ノートの推測」と明記して区別した。
