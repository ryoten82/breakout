# stages/ — ステージ確定データ

議論層（`stage-layout-room.md`）で固まったステージの**確定版データ**を置くディレクトリ。

## ディレクトリ構成

```
stages/
├── stage01/                # CRUSHER（廃工場）
│   ├── layout.md          # マップレイアウト確定版（セクション分割・地形）
│   ├── waves.js           # 敵配置・ウェーブ構成データ（将来）
│   └── gimmicks.md        # ギミック仕様確定版（将来）
├── stage02/                # SNIPER（距離戦）
└── stage03/                # OVERLORD（最終）
```

## 議論層との関係

- `stage-layout-room.md`：**叩き台・案出し・楽しさ言語化**（議論の継続記録・揺れてよい）
- `stages/stageNN/`：**確定版**（実装が参照する唯一の真実）

議論が固まったら本ディレクトリへ昇格。データはコードから参照可能な形式（md または js）にする。

## 実装層との関係

`gameproject02/src/stages/stageNN/` の実コードは、本ディレクトリのデータを参照する関係。
データと実装は同じ stageNN 番号で対応。
