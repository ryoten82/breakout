# design-mockups/

Claude Design で作った UI モックを格納するディレクトリ。  
UE 移行時の **UMG 実装仕様書** として使う想定。Three.js 本体実装には組み込まない。

## ディレクトリ構成

| フォルダ | 想定内容 | 関連タスク |
|---|---|---|
| `main-menu/`       | メインメニュー（PLAY / OPTIONS / GALLERY 等） | Task #3 |
| `char-select/`     | キャラセレクト（METEO / 雪華 / CANNON / BASTION） | Task #3 |
| `result-screen/`   | ボス撃破後リザルト画面（獲得 CR/チップ/コンボ） | Task #4 |
| `chip-management/` | チップ管理画面（永続強化・付け外し） | Task #2 |

## 運用ルール

1. Claude Design で **HTML エクスポート** したものをそのまま該当フォルダに展開
2. ファイル名は `index.html` を起点に、複数案は `index-v2.html` 等で並列管理
3. 各フォルダに `notes.md` でも追加可：方針・参考画像・没案メモなど
4. UE 移行時：このディレクトリを丸ごと UMG 担当者に渡せば仕様書として機能

## 注意

- Three.js 実装の `index.html`（ゲーム本体）からは参照しない
- design-mockups の HTML はあくまで **静的モック**。動的挙動は UE 側で再現
- 数値（damage / HP / SP 等）は仕様書 `~/.claude/plans/buzzing-juggling-sedgewick.md` を一次情報源とし、モックはそれを反映するだけ
