# FX（Niagara）ドクトリン（蒸留版）

動画 1 本 + 公式 doc 4 ページからの横断抽出。**日常作業ではこのファイルだけ読む**（上限 3KB）。
出典・詳細は `videos/` の個別ノート（読むときは Sonnet 委譲）。

## 構造の原則

1. **階層は System（器）> Emitter > Module > Parameter** — 実行スタックは {System/Emitter/Particle}×{Spawn/Update} の 2 軸マトリクス + Event Handler + Render
2. **一度だけ=Spawn、継続=Update** — 同じモジュールでも置くステージで意味が変わる（Add Velocity: Spawn=初速 / Update=毎フレーム加算）。モジュール追加のたびにこの区分けを考える
3. **「値の設定」と「評価するモジュール」は分離** — Lifetime を設定しただけでは消えない。**Particle State を Particle Update に置いて初めて寿命が効く**。値を変えても挙動が変わらない時は評価側モジュールの有無を疑う
4. **Module（編集可能アセット）と Item（ビルトイン要素）は別物** — MCP 操作時に混同しない

## 定型テクニック

- **ばらつきで安っぽさ回避**: 速度=Random Range Vector／サイズ=Random Uniform／色=2 色間 Random Range（炎の赤〜橙）／指向性=Velocity Mode Cone
- **依存エラーは Fix Issue** でワンクリック補完
- **Execution State**（Active/Inactive/InactiveClear/Complete）= エミッター/システム全体の寿命制御。InactiveClear は「キャンセル時に既存粒子破棄+再スポーン停止」候補。⚠遷移 API は原文に無し、実装時に SetPaused/Deactivate 系を要確認
- **Inheritance で FX 量産**: 親エミッターの値を子がオーバーライド → 爆発の火/氷/粉塵差分を子の上書きだけで量産。攻撃ロジック量産（derived_attack_pattern）とは層が別、後から組み合わせる

## Niagara Fluids（プラグイン・要有効化）

- **気体=グリッド**（セルに密度・温度・速度。スモーク=密度可視化、炎=温度が色+浮力）／**液体=FLIP ハイブリッド**（速度はグリッド解算→パーティクルへ反映）
- 5 種の使い分け: **2D Gas**=軽量・カメラ正対・常時ループ向き（延焼候補）／**3D Gas**=ヒーロー級・高コスト（FLAME UPPER 候補、テクスチャ焼き込みで緩和可）／2D FLIP=スプラッシュ／Shallow Water=水面プール／3D FLIP=最重量
- 圧力解法は反復計算（Num Iterations ↑=正確・重い）。⚠加えた力を減衰させる副作用あり
- ⚠数値目安（推奨 Iterations・フレームコスト）は公式に無し。導入は必ずプロトタイプ計測から

## 運用

- 単発の見せ場=高コスト許容 / 常時表示=軽量方式、の住み分けを最初に決めてから方式を選ぶ
