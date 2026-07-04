# 学習ノート — Unreal Engine 5 - Ice Attack Effect - Niagara Tutorial（棘スパイク攻撃）

- 動画: https://www.youtube.com/watch?v=kS4Y5DKqsAI （19分24秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/kS4Y5DKqsAI.txt](../transcripts/kS4Y5DKqsAI.txt)

## エフェクト構築手順（工程順）

### Spike Emitter（氷の棘本体）
1. **[00:19]-[04:08]** Mesh Renderer、Fresnelベースマテリアル、Shape Location=Torus（円環スポーン）、Initial Mesh Orientationでランダム傾き
2. **[04:37]-[06:32]** Scale Mesh Sizeで「オーバーシュート」カーブ（0.2で1→0.8で1.1一瞬伸びる→0.85で1に落ち着く、地面から突き出る勢いの表現）
3. **[06:32]-[07:12]** **Generate Location Event**追加（Requires Persistent IDs必須）、Event Send Rate=10/秒

### Ground Ice Emitter（地面のメッシュ演出）
4. **[08:30]-[08:48]** **重要**：Loop Duration=0.1（Spike側の10イベント/秒と同期させ1イベントだけ確実に拾う）
5. **[09:19]-[09:44]** **発見**：Scale Mesh Sizeはイベント経由スポーンと相性が悪い→**Set Particle Scaleを回避策として使用**

### Ground Particle Emitter（地面の光るSprite）
6. **[12:29]-[12:57]** Custom Alignment/Custom Facing Vector（Z=1）で地面と平行に固定。代替でDecalも使用可

### カスケード（多段ウェーブ）演出
7. **[14:12]-[18:07]** 3エミッター一式を複製、Event Handler Sourceを新Spikeに張り替え、**Loop Behavior=Multiple+Loop Count=2+Loop Delay同期**で遅延Spikeのイベント取りこぼしを防ぐ。波ごとにスケール・半径・スポーン数を増加

## 判断基準・コツ

- モーションと構成要素にフォーカス、マテリアルは簡易に済ませる（明言）
- Shape LocationをSphere→Torusに変更：円環状均等配置で放射状の棘攻撃の形
- Loop BehaviorをOnceにする：イベント連携時、無限ループだと同期が崩れる
- Ground系のLoop DurationをイベントSend Rateと揃える：ループが長いと複数イベントを拾い多重スポーンしてしまう
- Set Particle ScaleをScale Mesh Sizeの代替に：イベント経由スポーンのバグ的挙動への回避策
- カスケード（多段ウェーブ）は複製+イベントソース張り替えが最速（明言）

## 主要パラメータ

| Emitter | パラメータ | 値 |
|---|---|---|
| Spike | Spawn Burst count | 3（1波目）→4→5 |
| Spike | Generate Location Event Send Rate | 10/秒 |
| Ground Ice | Loop Duration | 0.1（単波）/0.05（多段） |
| 2波目 | Position X | 800 |
| 3波目 | Position X | 1800 |

## SCRAP BLITZ UEの属性攻撃エフェクトへの応用可能性

- Spike（Mesh）+Ground Ice（Mesh）+Ground Particle（Sprite）の3層構成は、既存AOEテレグラフ（時間軸に紐づく攻撃予告）とは異なる「事後発生型」の攻撃演出。属性攻撃を実装する場合、発生予告は既存文法を流用しつつ着弾後の演出にこの連鎖パターンを応用できる
- Generate Location Event→Receive Location Eventによる同期手法は、DrawDebug仮実装→本番Niagara差替の本番実装フェーズでそのまま使える設計パターン
- カスケード（多段ウェーブ）の複製+Delay+Loop Delay同期テクニックは、範囲攻撃の「連続着弾」演出に直接転用できる
- Set Particle Scale回避策はUEバージョン依存の可能性があり要検証

## 確信度が低い抽出

1. [12:20]-[12:26] Sprite Size Modeの値
2. [14:47]-[14:53] 波の遅延秒数
3. [12:13]-[12:17] Ground Particle Lifetime「2.4」（範囲値の可能性）
