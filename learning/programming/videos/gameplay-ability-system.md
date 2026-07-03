# 学習ノート — Gameplay Ability System (GAS)

- ソース: Epic 公式ドキュメント「Gameplay Ability System for Unreal Engine」
- URL: https://dev.epicgames.com/documentation/unreal-engine/gameplay-ability-system-for-unreal-engine
- 学習日: 2026-07-04 / 抽出: WebFetch(公式doc) → Sonnet単独要約（監査待ち）
- 原典 transcript: [../transcripts/gameplay-ability-system.md](../transcripts/gameplay-ability-system.md)

---

## GAS とは（RPG/アクション/MOBA向けフレームワーク）

Gameplay Ability System は、アクターが所有・実行可能な**属性・能力・相互作用**を構築するための UE5 フレームワーク。RPG、アクションアドベンチャー、MOBA など様々なゲームジャンルに対応できる汎用設計とされている。

原文は「単純な攻撃から複雑な魔法まで、ユーザーとターゲットのデータに依存する多数の状態効果をトリガーする能力が実現可能」と述べており、能力の実行結果が発動者・対象双方の状態に依存する設計を志向していることが読み取れる。

## 5大構成要素

原文が挙げる主要コンポーネントは以下の5つ。

1. **Ability System Component** — アクターコンポーネント基盤の機能を実装し、GAS フレームワークのインターフェースを通じたアクセス・相互作用の窓口となる。
2. **Gameplay Abilities** — アクティブまたはパッシブな能力として機能し、ゲームプレイメカニクス・ビジュアルエフェクト・アニメーション・サウンド等と連携する。
3. **Attributes と Attribute Sets** — ゲームプレイ関連の値（原文では種類は明示されていないが、数値データ全般と読める）を保存・計算・修正する。
4. **Gameplay Effects** — 属性値を直接修正する手段を提供し、設計目的に応じた変更を実現する。動作の詳細は「Gameplay Effect Components」というサブ要素で決定される、とだけ述べられている。
5. **Ability Tasks** — Gameplay Ability 実行中に非同期処理を行う専用クラス（`UAbilityTask`）。デリゲートやブループリント出力ピンを通じて実行フローに影響を与える。

## 各要素の役割分担

原文の記述をそのまま整理すると、役割分担は次のように読み取れる。

| 要素 | 役割 |
|---|---|
| Ability System Component | 能力システム全体への**アクセス窓口**（アクターコンポーネントとして実装） |
| Gameplay Abilities | 能力そのものの**実行単位**（アクティブ/パッシブ、演出との連携込み） |
| Attributes / Attribute Sets | 数値の**保存・計算・修正の場所**（データ層） |
| Gameplay Effects | 属性値への**変更手段**（Attribute Sets を変更するロジック層） |
| Ability Tasks | Ability 実行中の**非同期処理**（時間のかかる処理・待機・イベント待ちを扱う実行制御層） |

これは「データ層（Attribute）→ 変更ロジック層（Effect）→ 実行単位（Ability）→ 非同期制御（Task）→ 全体の窓口（ASC）」という階層関係の**仮説**として読める。ただし原文はこの階層関係を明示的な図や文章で説明しているわけではなく、5つの短い紹介文からの読み手側の整理であることに注意。

## SCRAP BLITZ に活かせる部分

SCRAP BLITZ には SP技（必殺技）・OC（オーバークロック）という自作の能力/強化システムが既に実装済み。以下は**GASの概念が既存システムのどの部分と対応しそうかという仮説**であり、置き換えを推奨するものではない。

- **Attribute Set ≒ HP/SP等の数値管理層** — GAS の Attribute Set は「ゲームプレイ関連値の保存・計算・修正」を担う層とされている。SCRAP BLITZ でも HP・SP ゲージ・拡張 stat 層（project_scrapblitz_stat_system.md 参照）が同種の役割を担っており、概念としての対応関係はありそうに見える。ただし GAS 側の実装粒度（レプリケーション方式、Modifier の適用順序等）は原文に記載が無く比較できない。
- **Gameplay Effect ≒ バフ/デバフ・延焼等の時限効果** — GAS の Gameplay Effect は「属性値を直接修正する手段」。SCRAP BLITZ には延焼（IGNITE 非依存化済み・project_scrapblitz_element_doctrine.md 参照）のような時限ダメージ/状態効果が存在し、概念上は Gameplay Effect が担う役割に近いと推測できる。ただし GAS の Effect が「瞬間適用」「持続適用」「無限適用」をどう区別しているか等の実装詳細は原文に無く、対応の粒度は未検証。
- **Ability Task ≒ SP技発動シーケンスの非同期処理** — GAS の Ability Task は「Ability 実行中の非同期処理」を扱う。SCRAP BLITZ の SP技（例: FLAME UPPER の2段構成・キャンセル猶予・振り返り猶予）は発動中に時間経過・入力待ち・キャンセル判定が絡む非同期的なシーケンスであり、概念としては Ability Task が担う役割と重なりそうに見える。ただし GAS 側がこれをどう実装しているか（デリゲート購読の仕組み、ブループリントとの連携方法等）は原文に記載が無い。

**※一般知識で補足**: GAS は Epic の Fortnite 等での実運用実績があり、マルチプレイ前提のレプリケーション機構を内包していることで知られる。SCRAP BLITZ が現状シングルプレイ想定であれば、この点は導入コストとメリットのトレードオフになり得る（ただしこれは原文には一切書かれておらず、あくまで一般知識としての注記）。

以上はすべて**概念対応の仮説**であり、既存の自作 SP/OC システムを GAS に置き換えるべきという結論は本ノートからは導けない。判断するには GAS 側の実装詳細（このソースには無い）と既存システムの実装コストを比較する必要がある。

## ソースの限界

このソースは Epic 公式ドキュメントのトップページ相当の概要のみであり、**各構成要素につき1〜2段落の紹介に留まっている**。具体的には以下が一切含まれていない。

- 実装手順（Ability System Component をアクターに追加する方法、Attribute Set を定義する手順など）
- API シグネチャ（`UAbilityTask` のメンバ関数、`UGameplayEffect` のプロパティ等）
- コード例（C++ / ブループリント問わず一切なし）
- Gameplay Effect Components の具体的な種類・設定方法（名前が挙がるのみ）
- Attribute の型・レプリケーション方式・Modifier の計算順序などの詳細仕様
- タグシステム（GAS で広く使われる GameplayTag との連携）への言及

したがって本ノートは GAS の**存在と大枠の役割分担を把握する第一歩**に過ぎず、実装を検討する場合は Epic の詳細ページ（Ability System Component ページ、Gameplay Effects ページ等の個別ドキュメント）を別途調査する必要がある。
