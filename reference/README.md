# SCRAP BLITZ アート参考資料部屋

メカベルスク **SCRAP BLITZ** の制作にあたって、参考になるビジュアル資料を集めて整理する場所。

## 運用ルール

- 画像・動画ファイルは各サブフォルダに直接置く（命名は自由・連番でも内容を表す名前でもよい）
- URL の参考リンクは各 `INDEX.md` の「参考リスト」に追記
- 仕様書（`C:\Users\90g-r\.claude\plans\buzzing-juggling-sedgewick.md`）が source of truth。ここには**設計要件をコピーせず、章番号で参照**する
- 雑多に放り込んでよい。整理は溜まってから

## 構造

| カテゴリ | パス | 内容 |
|---------|------|------|
| トータルアートイメージ | [total-art/INDEX.md](total-art/INDEX.md) | 参考にしているゲームのスクショ・キービジュアル（全体トーン） |
| 技術ノート | [tech-notes/](tech-notes/) | 実装提案・技術検証メモ（部屋をまたいで参照する用） |
| 外部リサーチ | [research/](research/) | 参考作品の好評意見・レビュー記事の整理（外部出典付き） |
| キャラデザ | [characters/INDEX.md](characters/INDEX.md) | METEO / VIPER / BASTION / CANNON のシルエット・配色・ディテール |
| 敵デザイン | [enemies/INDEX.md](enemies/INDEX.md) | 雑魚／中ボス／大ボス（ランダム化候補ストック）の見た目アイデア |
| VFX・板野演出 | [vfx/INDEX.md](vfx/INDEX.md) | ミサイル軌跡・噴射・爆発・ヨースラスター |
| 背景・ステージ | [environment/INDEX.md](environment/INDEX.md) | 近未来都市・廃墟・工場のロケーション |
| UI / HUD | [ui/INDEX.md](ui/INDEX.md) | SPゲージ・コンボ表示・SCRAP THEM!!! タイポ |

## メモ

- このワークツリーは breakout repo の `claude/art-reference-room` ブランチ（旧 `claude/jovial-raman-2d0036`）。main にはマージしない想定
- 画像が大量に溜まったら `.gitignore` で除外するか、別 repo に切り出すかを再検討
