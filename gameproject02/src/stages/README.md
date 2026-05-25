# src/stages/ — ステージ実装

各ステージのギミック・敵配置・進行制御の **ES モジュール実装**を置くディレクトリ。

## ディレクトリ構成（想定）

```
src/stages/
├── index.js               # 全ステージのレジストリ（エントリ）
├── stage01/
│   ├── index.js          # ステージ初期化エントリ
│   ├── decor.js          # 背景プロップ配置（props/ から組み立て）
│   ├── gimmicks.js       # プレス機・コンベア等のギミック
│   └── waves.js          # ウェーブ進行ロジック
├── stage02/
└── stage03/
```

## index.html との関係

`index.html` 本体は touch しない（zealous-hertz との衝突回避）。
読み込みは以下の最小エントリのみ追加：

```html
<script type="module" src="src/stages/index.js"></script>
```

## データ層との対応

`stage-room/stages/stageNN/` のデータ（layout.md / waves.js 等）を本実装が参照する。
**データと実装は同じ stageNN 番号で 1:1 対応**。

## props/ との分担

- `props/<theme>/<name>.js`：**再利用可能な見た目部品**（背景柱・床タイル・コンベア等のジオメトリ生成）
- `stages/stageNN/`：**そのステージ固有の配置・進行・組み合わせ**

props はステージ間で共有する想定。
