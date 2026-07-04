# 学習ノート — Unreal Engine 5 - Magic Orbs - Niagara Tutorial

- 動画: https://www.youtube.com/watch?v=iDrsEp3AGWA （24分25秒）
- 学習日: 2026-07-04 / 抽出: 自動字幕（英語ASR）→ Sonnet抽出 → Fable監査未実施
- 原典 transcript: [../transcripts/iDrsEp3AGWA.txt](../transcripts/iDrsEp3AGWA.txt)

## エフェクト構築手順（工程順）

1. **[00:45]-[04:47]** Emitter/System親子関係の理解：**共通で直したい変更は親（Emitter）で、個別調整は子（System内）で行う**。Niagara4大セクション（Emitter Update/Particle Spawn/Particle Update/Render）
2. **[07:03]-[09:47]** ParticlesFloating：Loop Behavior=Infinite、Spawn Rate=50、**Color RGB値が1超で発光表現になる**という原則
3. **[10:44]-[14:30]** マテリアル：Surface/Translucent/Unlit/Two Sided、**Usage セクションでNiagara系フラグを必ず有効化**、Texture×Particle Color→Emissive/Opacity
4. **[14:40]-[19:00]** 多層構成（FlareDark→Circle→FlareBright→Star）を**Sort Order Hintで前後関係制御**（中心の光=Star は最前面+1、後光=Darkは最背面-1）
5. **[19:00]-[21:xx]** フリップブック（Sub UV）：Sprite RendererのSub UVタイル数とテクスチャグリッド数を一致させる、Sub UV Animationモジュールで対象Sprite Rendererを手動アサイン（自動検出失敗の実践知）
6. **[21:xx]-[22:xx]** **Actor側のプロパティ上書きがNiagara System内部値より優先される**という実践知（見た目が想定と違う時のデバッグポイント）

## 判断基準・コツ

- Emitterと System を別フォルダで管理：親子関係を把握しやすくするため
- Drag/Add Velocityを使うときは必ずSolve Forces and Velocityを追加：力学系モジュールの計算依存
- 複数のパーティクル層をSort Order Hintで前後関係を制御：Spriteは同一平面的に描かれるためちらつき対策
- 中心の光（Star）はSort Order Hintを一番高く：「一番目立たせたい要素は最前面」という初心者向け原則
- User Parameter（Linear Color等）を公開：レベルエディタ側からアセットを開かずに調整できるようになりイテレーションが速くなる

## 主要パラメータ

| Emitter | Sort Order Hint | Sprite Size |
|---|---|---|
| FlareDark（後光） | -2 | 1800〜2000 |
| Circle（同心円） | -1 | 900（Uniform） |
| FlareBright（中心光核） | 0 | 500〜700 |
| Star（最前面の輝き） | +1 | 350〜400 |
| Smoke（煙・フリップブック） | -1 | 1300〜1600 |

## SCRAP BLITZ UEのOCジェム/浮遊オーブ系への応用可能性

- OCジェム（`ASBOcGem`）が浮遊しつつ発光する演出に、多層構成（FlareDark→Circle→FlareBright→Star）+Sort Order Hintによる重ね順制御がそのまま応用できる。「後光→本体の光→中心の核」という三層構造はジェムの浮遊光跡演出のテンプレートになる
- ParticlesFloatingのSphere Location+Add Velocity+Drag+Curl Noiseは、ジェム周囲を漂う微粒子（マグネット吸着前のアイドル状態）の演出に応用できる。Pickupマグネット挙動（common01 §13）と組み合わせ、マグネット発動時にSpawn Rate/Curl Noise強度を変化させる拡張も考えられる
- User Parameter化（Linear Color）は、OCジェムのレアリティ別色差分をBlueprint/C++から動的に切り替える設計と相性が良い
- Actor側オーバーライドがNiagara内部値より優先されるという指摘は、ボス個体差での色変え等の実装時の一般的な落とし穴として記録に値する

## 確信度が低い抽出

1. Emitter/Spawn Rateの具体的数値（複製後の個別変更の有無）
2. 各パーティクルのColor RGB値（桁数・小数点位置）
3. `NE_ParticleBurst`作成時のテンプレート名
