# 学習ノート — Sparks VFX in Unreal Engine, Unity and Godot - Game Engine Comparison（UEパート抜粋）

- 動画: https://www.youtube.com/watch?v=R2-BsWb5Bqg （23分41秒、3エンジン比較動画）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/R2-BsWb5Bqg.txt](../transcripts/R2-BsWb5Bqg.txt)
- 本ノートはUE（Niagara）パート[06:29]-[10:53]+補足[13:20]-[13:37]のみ抽出。Unity/Godot部分は対象外

## Niagaraの構造（Emitter と System の関係）

- **Niagara Emitter**：単体の挙動定義。「prefab」（親）に近い
- **Niagara System**：Emitterを子として束ねたもの。実際にシーンに配置するのはSystemの方
- Emitter単体で作った変更は基本Systemに自動反映されるが、**Render関連の設定は反映漏れが起きることがあるため、System側でも目視確認・再設定するのが安全**（実務上の注意点）

## Sparks Emitter構築手順

1. **[08:26]-[08:39]** Loop Behavior=Infinite、Burstモジュール削除→Spawn Rate追加（100）
2. **[08:39]-[09:13]** Sizeモード=Random Non-Uniform（X:1〜10, Y:5〜50）でstretch表現の土台
3. **[09:18]-[09:56]** Add Velocity（Linear/Cone）、Random Range 250〜1000（要検証）
4. **[10:03]-[10:16]** **Sprite Renderer Alignment = Velocity Aligned**（velocityベクトルに整列）
5. **[10:19]-[10:28]** Gravity Force追加（UEでは「毎フレーム継続的に適用される力」として扱う必要がある、との説明）

## Flare（閃光）Emitter構築手順

- Loop Behavior=Infinite、Spawn Rate=10、Sprite Size=Random Uniform 50〜100、Scale Color（Color over Lifetime相当）、Lifetime Random 0.1〜0.3に短縮

## パラメータの公開（User Parameters）

- **Niagara特有の実務上重要な工程**として強調：User ParametersパネルでLinear Color型を追加→パーティクルColorにバインド→レベル配置後Detailsパネルから直接色変更可能
- **判断基準（なぜ重要か）**：Niagaraはデフォルトで全プロパティがレベル側に公開されているわけではない。「何が起きているか」ではなく「どのモジュールを使うべきか」を知っている必要がある（Unity Particle Systemとの対比で強調）

## 主要パラメータ

| モジュール | パラメータ | 値 |
|---|---|---|
| Emitter State | Loop Behavior | Once→Infinite |
| Initialize Particle（Sparks） | Sizeモード | Uniform→Random Non-Uniform |
| Add Velocity | Speed Random Range | 250〜1000（要検証） |
| Sprite Renderer | Alignment | Velocity Aligned |
| User Parameters | 型 | Linear Color |

## SCRAP BLITZ UEの汎用スパークエフェクトへの応用可能性

- Emitter/System分離構造は、METEOの攻撃・敵撃破・SP技など複数箇所で使い回す汎用スパークFXに、共通Emitterをベースにシステム側でパラメータだけ差し替える構成として合致する
- User Parameters（色の公開）は、属性・キャラごとにエフェクト色を変えたいケースで、`SparkColor`のようなLinear Color型User Parameterを1つ用意しBlueprint/GA側から動的に色を渡す設計に有用
- Velocity Alignedの活用は、ノックバック方向・攻撃方向に応じて火花が伸びる向きを合わせたい場合にそのまま使える
- 「サイズを伸ばす→velocity方向に整列」の2段階アプローチは、弾/破片系の汎用エフェクトのテンプレとして別途整備する価値がある

## 確信度が低い抽出

1. [09:56]-[10:00] Add Velocityの数値（1000 vs 500の言い直し）
2. [09:07]-[09:10] Size X/Yの単位
3. [10:22]-[10:31] Gravity Forceモジュールの具体的な設定値
