# 議論トピック目次

| トピック | status | 起票日 | 関連仕様書セクション | メモ |
|---|---|---|---|---|
| [傭兵モード（CPU 操作の味方機）](archive/mercenary-mode.md) | 昇格済 | 2026-05-14 | §25 マルチプレイ設計 | 案B 採用：Unreal 移行後に実装 |
| [ターミナル「歩ける拠点」化案](archive/terminal-walkable-hub.md) | 昇格済 | 2026-05-14 | §5 / §13.0（新設） / Phase 4 | 案D 採用：段階実装 C→B→A、メカで歩く、NPC 低優先 |
| [背景・ステージ構築ワークフロー](discussions/stage-construction-workflow.md) | 検討中（保留） | 2026-05-14 | §26 / §11 Phase 6 | 実プロトで触ってから判断。先行してカタログ着手 |
| [プロップ種類カタログ + 命名規則](archive/prop-catalog-and-naming.md) | 昇格済（再相談前提） | 2026-05-14 | §26.5（新設） | 7カテゴリ・日本語呼び名・`dest_crate_wood_01` 形式 |
| [メニューの決定・キャンセルボタン設計](archive/menu-decide-cancel-buttons.md) | 昇格済 | 2026-05-14 | §22.5（新設） | 案B+ 採用：下ボタン=決定 / 右=キャンセル / KEY_CONFIG 系統分離 |
| [ヒット数表示のメリハリ設計（雑魚 / ボス / SCRAP THEM）](discussions/hit-count-tiering.md) | 検討中 | 2026-05-14 | §22 / §9 / §11 | 雑魚 40-100hits の派手さ vs SCRAP THEM の肩透かしリスク。案A〜C 比較済・ユーザー思案中 |
| [HP ゲージの拡張表現 & 本番レイアウト](discussions/hp-bar-expansion.md) | 検討中（案B 合意済）| 2026-05-14 | §22 / §12 | HP_MAX 成長時の表現（複数ゲージ案B 採用）+ 本番は左上 HP / 左下 SP 配置 |
| [マルチプレイ救助システム](discussions/multiplayer-rescue-system.md) | 検討中（案C：Unreal 移行後実装）| 2026-05-14 | §25 / §11 | 黒化中の救助受付→10% HP 復帰 or タイムアウトで爆散。Phase 2.4 で dead state 枠は確保済 |
| [セーブシステム設計](discussions/save-system-design.md) | 検討中 | 2026-05-15 | §13 / §15 / §14 | 利確・不正取得対策。案A/B/C 比較済・案C 推奨叩き台 |
| [簡易必殺技ボタン（；キー）](discussions/simple-special-button.md) | アイデア記録 | 2026-05-15 | §9.7 / §22.5 | スマブラ式・方向+；で必殺技。技数不足が懸念 |

## status 凡例
- **検討中**: discussions/ に存在・議論進行中
- **昇格済**: 本体仕様書へ反映済み・ファイルは archive/ へ
- **廃案**: 採用しないと決定・ファイルは archive/ へ
- **保留**: 一時的に止めている（後で再開）
