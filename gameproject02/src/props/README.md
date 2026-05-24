# src/props/ — 再利用プロップライブラリ

ステージ間で共有する **背景プロップ・装飾ジオメトリ**の ES モジュール置き場。

## ディレクトリ構成（テーマ別サブディレクトリ）

```
src/props/
├── factory/                # 廃工場テーマ（Stage 1 メイン）
│   ├── back-wall.js       # 奥壁の柱組＋クロスブレース（buildBackWallPillars 移管先）
│   ├── floor-tile.js      # 45 度斜め平行線床（makeGridTexture 移管先）
│   ├── conveyor.js        # コンベア
│   ├── press.js           # プレス機
│   ├── crate.js           # 黄色コンテナ（壊れ物・即爆散）
│   └── gas-canister.js    # ガスボンベ（壊れ物・点火→爆発）
├── shared/                 # テーマ非依存（破壊エフェクト共通形状等）
└── ...
```

## 命名規約

- ファイル名：kebab-case（`back-wall.js`）
- export 関数名：`create<Name>(opts)` 形式（例：`createBackWall({ width, color })`）
- 戻り値：Three.js `Object3D`（多くは `Group` でラップ）

詳細は `spec-room/archive/prop-catalog-and-naming.md` 参照。

## 既存インライン装飾の移管計画

`gameproject02/index.html` 内に直書きされている以下を段階的に本ディレクトリへ移管：

| 既存関数 | 移管先 | ステータス |
|---|---|---|
| `buildBackWallPillars()` | `props/factory/back-wall.js` | 未着手 |
| `makeGridTexture()` | `props/factory/floor-tile.js` | 未着手 |

移管時は zealous-hertz worktree の編集状況を確認し、`index.html` の同時編集を避ける。
