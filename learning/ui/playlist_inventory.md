# プレイリスト目録 — Unreal Engine UI Design Series

取得日: 2026-07-04
URL: https://www.youtube.com/playlist?list=PLOZ8jGta4Ld_GIVSKWoPIBAg7OYMvZ_FM
全13本・計約4時間22分。UE5.3頃収録のためやや古い可能性あり（ユーザー指摘）。手動字幕なし、全て自動生成英語字幕のみ。

パイロット方針（2026-07-04ユーザー判断）：まず3本（Part01/06/12）を処理し、現行UE5.8での通用度を確認してから残りの処理要否を判断する。

| # | 長さ | video ID | タイトル | 学習状況 |
|---|---|---|---|---|
| 01 | 19:02 | bnJ3wDK1f04 | Part 01 Setup | ✅ 学習済（2026-07-04・パイロット・Fable監査未実施） |
| 02 | 28:46 | Ruk05CHtC1Y | Part 02 Input Field | ⬜ 未着手 |
| 03 | 25:42 | MR32oQNYcv4 | Part 03 slot icon | ⬜ 未着手 |
| 04 | 09:45 | bvi1qhqDekA | Part 04 Input with icon | ⬜ 未着手 |
| 05 | 15:41 | Czrz4Y9Chj0 | Part 05 checkbox | ⬜ 未着手 |
| 06 | 18:35 | PwAUEKNOuCA | Part 06 button | ✅ 学習済（2026-07-04・パイロット・Fable監査未実施） |
| 07 | 20:43 | eACuZykTjMI | Part 07 Combobox part 01 | ⬜ 未着手 |
| 08 | 23:37 | apcs_EC70d0 | Part 08 Combobox Final | ⬜ 未着手 |
| 09 | 23:24 | N4geZ-VaWyI | Part 09 Window part01 | ⬜ 未着手 |
| 10 | 21:30 | ae1M6Pz0aIM | Part 10 Window part02 | ⬜ 未着手 |
| 11 | 11:20 | Ky4J7FWy6Wo | Part 11 Window final | ⬜ 未着手 |
| 12 | 22:45 | EkEUU7j3x4w | Part 12 List Item Part 01 | ✅ 学習済（2026-07-04・パイロット・Fable監査未実施） |
| 13 | 21:04 | zP2i0u8SrTQ | Part 13 List Item final | ⬜ 未着手 |

## パイロット3本の所感まとめ

いずれも「UMGの基本操作・設計思想（共通親Widget継承／構造体+Data Tableでのテーマ管理／Set Style によるステート別ブラシ／Scale Box vs Size Boxの使い分け／Event Dispatcherでの疎結合設計）は現行UE5.8でもそのまま通用する」という一致した所感。エディタUIの細部（メニュー階層・パネルレイアウト）はUE5.3→5.8間で変わっている可能性があるが、機能自体の廃止・非推奨は確認されなかった。

唯一の設計上の注意点：Part06で見られた「スタイル定義用の別Blueprintクラスにテクスチャ変数を持たせる」手法は、現行UE5系では**Widget Style Asset**や**Data Assetベースのテーマ管理**の方がモダンとされることが多く、そのまま採用するのではなく比較検討が必要。

## 関連

- [../INDEX.md](../INDEX.md) — 学習部屋目次
- [videos/bnJ3wDK1f04_part01-setup.md](videos/bnJ3wDK1f04_part01-setup.md)
- [videos/PwAUEKNOuCA_part06-button.md](videos/PwAUEKNOuCA_part06-button.md)
- [videos/EkEUU7j3x4w_part12-list-item.md](videos/EkEUU7j3x4w_part12-list-item.md)
- [videos/epic-ue5-ui-design-optimization.md](videos/epic-ue5-ui-design-optimization.md) — Epic公式スライド（同ドメイン内・別ソース）
