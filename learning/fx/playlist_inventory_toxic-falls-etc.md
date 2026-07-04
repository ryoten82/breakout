# プレイリスト目録 — Unreal Engine 5 Niagara Tutorials（滝・攻撃VFX系プレイリスト）

取得日: 2026-07-04
URL: https://www.youtube.com/playlist?list=PLpPd_BKEUoYhyGZHSK1pUMOsy75iNE7_Z
全50本。先頭14本が本格チュートリアル（13〜25分、講師解説あり）、以降35本超はアセットパックの宣伝用ショーケース映像（大半1分未満・解説なし）のため学習価値低と判断しスキップ。
**2026-07-04 Fableスポット照合済**（14本のdoctrine行き核心主張をtranscript原文とペア照合・幻覚なし。数値の※推定マークは各ノートの自己申告どおり残存）。

## 処理済み14本

| # | 長さ | video ID | タイトル | ノート |
|---|---|---|---|---|
| 01 | 18:12 | wceVb5ftmxs | Toxic Waterfall | [videos/wceVb5ftmxs_toxic-waterfall.md](videos/wceVb5ftmxs_toxic-waterfall.md) |
| 02 | 19:37 | graozMcShMA | Anime Waterfall Splash | [videos/graozMcShMA_anime-waterfall-splash.md](videos/graozMcShMA_anime-waterfall-splash.md) |
| 03 | 22:09 | SGoNF1UTD3I | Muzzle Flash VFX | [videos/SGoNF1UTD3I_muzzle-flash-vfx.md](videos/SGoNF1UTD3I_muzzle-flash-vfx.md) |
| 04 | 16:27 | djlnnPvFR0Q | Sword Slash VFX | [videos/djlnnPvFR0Q_sword-slash-vfx.md](videos/djlnnPvFR0Q_sword-slash-vfx.md) |
| 05 | 20:41 | EXWwZ4F_reA | Ground Slash VFX | [videos/EXWwZ4F_reA_ground-slash-vfx.md](videos/EXWwZ4F_reA_ground-slash-vfx.md) |
| 06 | 15:30 | NbbFytz-JDk | Vertical Beam VFX | [videos/NbbFytz-JDk_vertical-beam-vfx.md](videos/NbbFytz-JDk_vertical-beam-vfx.md) |
| 07 | 11:44 | omkwqdWMB_U | Sci-Fi Barrier | [videos/omkwqdWMB_U_scifi-barrier.md](videos/omkwqdWMB_U_scifi-barrier.md) |
| 08 | 17:57 | meig8T9uWNc | Slash Attack VFX | [videos/meig8T9uWNc_slash-attack-vfx.md](videos/meig8T9uWNc_slash-attack-vfx.md) |
| 09 | 11:39 | HRagD5L-WF8 | Stylized Smoke VFX | [videos/HRagD5L-WF8_stylized-smoke-vfx.md](videos/HRagD5L-WF8_stylized-smoke-vfx.md) |
| 10 | 13:10 | OnxiEY3Khow | Stylized Fire VFX | [videos/OnxiEY3Khow_stylized-fire-vfx.md](videos/OnxiEY3Khow_stylized-fire-vfx.md) |
| 11 | 19:24 | kS4Y5DKqsAI | Ice Attack Effect | [videos/kS4Y5DKqsAI_ice-attack-effect.md](videos/kS4Y5DKqsAI_ice-attack-effect.md) |
| 12 | 17:26 | -Cdn0_98PXM | Meteor Rain VFX | [videos/-Cdn0_98PXM_meteor-rain-vfx.md](videos/-Cdn0_98PXM_meteor-rain-vfx.md) |
| 13 | 24:25 | iDrsEp3AGWA | Magic Orbs | [videos/iDrsEp3AGWA_magic-orbs.md](videos/iDrsEp3AGWA_magic-orbs.md) |
| 14 | 23:41 | R2-BsWb5Bqg | Sparks VFX (Engine Comparison) | [videos/R2-BsWb5Bqg_sparks-vfx-engine-comparison.md](videos/R2-BsWb5Bqg_sparks-vfx-engine-comparison.md) |

## スキップ（15〜50、ショーケース/アセット宣伝映像）

15 Stylized Explosion VFX Course(2:46) / 16-51 各種Vol.1〜4ショーケース（Kassadin/Ezreal Slashes, Stylized Orbs/Lightning/Lasers, Muzzle Flashes, Magic Abilities, AoE Beams, Sword Slashes, Sci-Fi Pack, Hits and Impacts, Earthbender, Explosions, Meteor Rain, Tornados, Ice Attack, Fire, Mega Pack, Loot Drops, Portals, Magic Orbs/Projectiles等）、50 Unity VFX Graph Meteor Effect（他エンジン）

## 全体総評（14本共通の横断的発見）

- **Dynamic Parameter設計**：ほぼ全チュートリアルでマテリアル側の値（Tiling/Speed/Erosion/Power）をDynamic Parameterで外部化し、Niagara側から複数バリエーションを量産する設計が一貫している
- **Generate/Receive Location・Death Event**：移動する本体（斬撃・隕石・棘）から付随エフェクト（火花・破片・地面痕）を発生させる疎結合パターンが複数動画で使われている（Slash Attack VFX、Meteor Rain VFX、Ice Attack Effect）
- **Additive+Translucent/Masked併用**：発光表現はAdditive、暗色・侵食表現には別ブレンドモードを使い分ける原則が一貫している
- **Sort Order Hint / Render Orderによる描画順制御**：多層構成のちらつき対策として頻出
- **Velocity Alignment**：飛翔物・火花のストレッチ表現で共通のテクニック

## 関連

- [../INDEX.md](../INDEX.md) — 学習部屋目次
- [playlist_inventory_cghow-niagara.md](playlist_inventory_cghow-niagara.md) — 別のFXプレイリスト目録（461本・パイロット5本処理済み）
