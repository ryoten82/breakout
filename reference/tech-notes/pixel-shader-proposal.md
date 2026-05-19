# ピクセルシェーダー導入提案（Three.js 現プロト向け）

**作成日：** 2026-05-12
**対象：** `G:\claude_code_local\gameproject02\index.html`（Three.js r168 + WebGLRenderer + 1920×1080 16:9固定）
**動機：** メタルブリンガー（Last Idea, 2024）のピクセルシェーダー表現が SCRAP BLITZ の目指す絵に最も近いとユーザーが評価。参考フォルダ `reference/total-art/metal-bringer/INDEX.md` 参照。

---

## アプローチ案（軽量→本格の3段階）

### 案A：低解像度レンダリング + NEAREST 拡大（最軽量・1〜2時間）

**仕組み：**
1. `WebGLRenderTarget` を低解像度（例：480×270）で作成
2. シーンをそこに描画
3. その RenderTarget を `magFilter: NEAREST` で 1920×1080 に拡大表示

**コア実装イメージ：**
```js
const RT_W = 480, RT_H = 270;
const pixelRT = new THREE.WebGLRenderTarget(RT_W, RT_H, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
});

// メインループ内
renderer.setRenderTarget(pixelRT);
renderer.render(scene, camera);
renderer.setRenderTarget(null);
// pixelRT を画面に NEAREST で拡大表示（フルスクリーンクアッド or CSS）
```

**メリット：** 既存コードへの変更が最小。30行程度の追加で済む
**デメリット：** ピクセル化はできるが、**メタブリのような「現代的な配色」までは出ない**
**見た目：** PS1〜SS世代のローポリ感（古臭めに振れる）

---

### 案B：案A + カラーパレット縮減（中量・半日）

**追加要素：**
- ポストプロセスシェーダーで色数を制限（例：32色パレット）
- ディザリング処理を追加して中間色を再現（Bayer 4×4 dithering 等）

**実装の鍵：**
- `EffectComposer` + 自作 `ShaderPass` でフラグメントシェーダーを追加
- パレットLUTテクスチャを用意して色をスナップ

**メリット：** メタブリに**かなり近い見た目**になる。Powered Gear のドット感にも近づく
**デメリット：** パレット設計が必要（センスが問われる工程・色数とトーンの調整が肝）

---

### 案C：案B + アウトライン + シェーディング階調化（本格・1〜2日）

**追加要素：**
- エッジ検出シェーダーでメカの輪郭線を描画（Sobel / Depth-Normal ベース）
- ライティングを2〜3階調にステップ化（セルシェーダー）

**メリット：** **pixelstay のスマートさ × メタブリのピクセル感**を両立できる
**デメリット：** 既存の板野演出（噴射パーティクル）と相性調整が必要

---

## 現プロトでの注意点

| 項目 | 影響 | 対応 |
|------|------|------|
| **HUD レイヤー** | ピクセル化対象外にする必要あり（テキストが読めなくなる） | `#hud-layer` は DOM 側なのでそのまま対象外でOK |
| **パーティクル** | 噴射の細かい粒が消える可能性 | サイズアップ or 別レイヤー描画で対応 |
| **16:9 レターボックス** | 低解像度RTも 16:9 比率で作成する必要あり | 480×270 等の比率を維持 |
| **ヒットエフェクト** | 板野演出の軌跡がピクセル化でどう見えるか要検証 | 実装後に視覚確認、必要に応じて軌跡の太さ調整 |

---

## 推奨進行

**Step 1：案A を 10分で実装してトグル切替できるようにする**
- キー（例：P）でオン・オフ切替
- 「絵の方向性が合うか」「逆に違和感が出るか」を最速で判断
- 戻すのも一瞬なので試行コスト低

**Step 2：方向性が合えば案B → C へ段階的に積む**

**Step 3：Phase 3（Unreal 移行）時の本実装はポストプロセスマテリアルで再実装**
- Three.js での実験結果をパラメータ仕様として持ち越し
- Unreal の Pixel Shader（HLSL）で同等の表現を再構築

---

## ランタイム調整ポイント（案A実装時）

`window.SB.PIXEL_SHADER` 等で公開推奨：
- `RT_W` / `RT_H`：レンダーターゲットの解像度（小さくするほどドット感強い）
- `ENABLED`：オンオフトグル
- パレット LUT（案B以降）

既存の `window.SB.PHYSICS` / `window.SB.ATTACKS` 等と同じくランタイム調整可能にしておけば、プレイ中にチューニングできる。

---

## 関連参考

- メタルブリンガー（`reference/total-art/metal-bringer/INDEX.md`）— ピクセルシェーダーの目標形
- Powered Gear（`reference/total-art/powered-gear/INDEX.md`）— ドット絵感の祖先
- pixelstay（`reference/total-art/misc/INDEX.md`）— 少ない情報量で立たせるスマートさ

---

## メモ：実装場所の注意

- 提案・参考資料はこのフォルダ（`gameproject01` worktree 内 reference）
- 実装は別部屋（`gameproject02/index.html`）で行う予定
- 実装側のセッションを開いたら、まずこのファイルへのフルパスを示してから着手するとスムーズ：
  `G:\claude_code_local\gameproject01\.claude\worktrees\jovial-raman-2d0036\reference\tech-notes\pixel-shader-proposal.md`
