# SOURCE: Gameplay Ability System for Unreal Engine
URL: https://dev.epicgames.com/documentation/unreal-engine/gameplay-ability-system-for-unreal-engine
取得方法: WebFetch（要約モード）
取得日: 2026-07-04

---

**Gameplay Ability System** は、アクターが所有・実行可能な属性、能力、相互作用を構築するためのフレームワーク。RPG、アクションアドベンチャー、MOBA など様々なゲームプロジェクトに対応できる。

## 主要コンポーネント

**Ability System Component**
アクターコンポーネント基盤の機能を実装し、Gameplay Ability System フレームワークのインターフェースを通じてアクセス・相互作用が可能。

**Gameplay Abilities**
アクティブまたはパッシブな能力として機能し、ゲームプレイメカニクス・ビジュアルエフェクト・アニメーション・サウンド等と連携する。

**Attributes と Attribute Sets**
ゲームプレイ関連値を保存・計算・修正する。

**Gameplay Effects**
属性値を直接修正する手段を提供し、設計目的に応じた変更を実現する。Gameplay Effect Components で動作を決定する。

**Ability Tasks**
Gameplay Ability 実行中に非同期処理を行う専用クラス（`UAbilityTask`）で、デリゲートやブループリント出力ピンを通じて実行フローに影響を与える。

このシステムにより、単純な攻撃から複雑な魔法まで、ユーザーとターゲットのデータに依存する多数の状態効果をトリガーする能力が実現可能。
