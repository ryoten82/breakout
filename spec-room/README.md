# SCRAP BLITZ 仕様相談部屋

仕様書本体（`~/.claude/plans/buzzing-juggling-sedgewick.md`）に書くにはまだ早い、
**未確定アイデア・トレードオフ検討・代替案比較**などの議論メモを置く中間置き場。

## 役割

- 確定前の議論をここに溜める（本体に直書きしない＝「確定」と誤読されないように）
- 確定したら本体仕様書へ昇格させる（このフォルダ側は `archive/` に移動）
- 廃案も `archive/` に残す（何を捨てたかの履歴も資産）

## 書くもの / 書かないもの

**書く**
- 仕様の選択肢・トレードオフ・案A/B/C 比較
- 未解決の疑問・気になっている点
- 「これどう思いますか？」レベルのラフ案
- セッションをまたいで検討したい論点

**書かない**
- 確定した仕様（→ 仕様書本体へ）
- 実装の進捗・バグ修正履歴（→ memory / git log）
- アートの肌感・参考ゲーム感想（→ reference 部屋）

## 運用フロー

1. 新トピックは `discussions/_template.md` をコピーして `discussions/<topic-name>.md` に作る
2. `INDEX.md` に行を追加（status: 検討中）
3. 検討が進んだら本体に昇格 or 廃案にする
4. 昇格/廃案したら：
   - ファイルを `archive/` へ移動
   - `INDEX.md` の status を更新（昇格済 / 廃案）
   - 昇格時は本体仕様書のどのセクションに入ったかを記録

## 関連リソース

- 仕様書本体: `~/.claude/plans/buzzing-juggling-sedgewick.md`
- アート参考部屋: `G:\claude_code_local\gameproject01\.claude\worktrees\jovial-raman-2d0036\reference\`
- 実装本体: `G:\claude_code_local\gameproject02\index.html`
- プロジェクト memory: `~/.claude/projects/G--claude-code-local/memory/project_scrapblitz.md`
