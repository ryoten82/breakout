// ============================================================
//  SCRAP BLITZ — 攻撃データテーブル (分離 Phase: Step A)
//
//  ES Module として index.html から import される：
//    import { ATTACKS, ATTACK_ATTRS, resolveAttackAttr,
//             getHitWindowEnd, Z_CHAIN, A_CHAIN } from './src/attacks.js';
//
//  純データ層：PHYSICS 等の他データへの依存は持たない（循環防止）。
//  PHYSICS.AERIAL_RANGE_Y 等の旧参照は数値リテラルへ展開済み（110/120/130）。
// ============================================================

// ============================================================
//  #section attacks-table — 攻撃データテーブル（最も触る場所）
//  Plan §2 戦闘システム §キャンセルシステム
//  値はランタイムで SB.ATTACKS.c01_atk_01.damage = ... のように調整可能
//
//  ▼ 主要フィールド早見
//    duration / hitFrame / hitDuration / cancelWindow : 攻撃のタイムライン
//    damage / knockback / knockbackY                  : 与ダメ・水平/垂直ノックバック
//    rangeX / rangeY / rangeZ / rangeYDown            : 当たり判定 AABB
//    atk_lv / atk_lv_air / atk_lv_down                : 被弾ステート振り分け（地上/空中/ダウン中）
//    launchVy / launcher / attrGroup                  : 打ち上げ系
//    plyrLiftVy / plyrLiftVx                          : プレイヤー自身が浮く
//    aerialHop / aerialHopVy / aerialHopVx            : 空中ヒット時のホップ
//    lungeVx / lungeDecay                             : 踏み込み（前進量）
//    lungeDelay / windupBackVx                        : 踏み込み開始 F の遅延 / 発生前の引き
//    kb_vy_lv5 / kb_vy_lv6 / kb_vx_mult_lv*           : 被弾ベクトル上書き（lv 別）
//    isSpecial / isStepAttack / showHitbox            : 系統フラグ
//    hitColor / hitCount / hitstop / shake / partsAnim : 演出
// ============================================================
export const ATTACKS = {
  c01_atk_01: {
    label:        'c01_atk_01 (METEO 左ジャブ)',
    duration:     22, hitFrame: 3, hitDuration: 4, cancelWindow: 18,  // dur:16→22 / cw:8→18（テンポ抑制）
    damage:       6,
    rangeX:       110, rangeZ: 110, rangeY: 80,   // 胸高さまで
    knockback:    9, hitstop: 3, shake: 2,         // 6→9（J コンボ全弾 1.5x：間合い詰まり対策・J 連打無限コンボ抑止）
    atk_lv:       1,
    partsAnim:    'punch_l',
  },
  c01_atk_02: {
    label:        'c01_atk_02 (METEO 右ストレート)',
    duration:     22, hitFrame: 4, hitDuration: 4, cancelWindow: 18,  // dur:16→22 / cw:9→18（テンポ抑制）
    damage:       7,
    rangeX:       115, rangeZ: 110, rangeY: 80,   // 胸高さまで
    knockback:    12, hitstop: 4, shake: 3,        // 8→12（1.5x）
    atk_lv:       1,
    partsAnim:    'punch_r',
  },
  c01_atk_03: {
    label:        'c01_atk_03 (METEO 回し蹴り)',
    duration:     30, hitFrame: 5, hitDuration: 5, cancelWindow: 25,  // dur:23→30 / cw:11→25（テンポ抑制）
    damage:       12,
    rangeX:       130, rangeZ: 120, rangeY: 110,  // 蹴りは少し高めまで
    knockback:    21, hitstop: 6, shake: 5,        // 14→21（1.5x）
    atk_lv:       1,
    partsAnim:    'kick',
  },
  c01_atk_04: {
    label:        'c01_atk_04 (METEO 旋回アッパー・フィニッシャー)',
    duration:     22, hitFrame: 8, hitDuration: 5, cancelWindow: 19,  // 16→19（テンポ抑制）
    damage:       14,
    rangeX:       135, rangeZ: 125, rangeY: 140,  // 旋回アッパー：頭上付近まで
    knockback:    60, hitstop: 7, shake: 6,        // 40→60（1.5x）
    atk_lv:       2,                      // フィニッシャー：地上は knockback02
    atk_lv_air:   3,                      // 空中敵には吹き飛び（down_front_*）
    partsAnim:    'spin_upper',
  },
  // === 空中弱攻撃（METEO） ===
  c01_atk_01_air: {
    label:        'c01_atk_01_air (METEO 空中ジャブ)',
    duration:     60, hitFrame: 3, hitDuration: 55, cancelWindow: 15,  // SF2 ジャンプキック型：active を着地まで保持（cancelOnLand で着地時自動終了）
    damage:       5,
    rangeX:       145, rangeZ: 120, rangeY: 110, rangeYDown: 260,   // PHYSICS.AERIAL_RANGE_Y=110 をリテラル化
    knockback:    5, hitstop: 3, shake: 2,         // 3→5（1.5x 切り上げ）
    aerialHop:    true,
    atk_lv:       1,
    homingLerpMult: 0.6,           // 空中 J 系はホーミングを弱め（吸い寄せの違和感対策・2026-05-15）
    cancelOnLand: true,            // 着地瞬間に wait01 へ降格（立ち J へすぐ移行）
    partsAnim:    'air_punch_l',
  },
  c01_atk_02_air: {
    label:        'c01_atk_02_air (METEO 空中蹴り)',
    duration:     18, hitFrame: 3, hitDuration: 3, cancelWindow: 15,  // dur:14→18 / cw:9→15（地上テンポ比率に同期）
    damage:       7,
    rangeX:       145, rangeZ: 120, rangeY: 120, rangeYDown: 270,   // PHYSICS.AERIAL_RANGE_Y(110)+10
    knockback:    8, hitstop: 4, shake: 3,         // 5→8（1.5x 切り上げ）
    aerialHop:    true,
    atk_lv:       1,
    homingLerpMult: 0.6,           // 空中 J 系はホーミングを弱め（2026-05-15）
    cancelOnLand: true,            // 着地瞬間に wait01 へ降格
    partsAnim:    'air_kick',
  },
  c01_atk_03_air: {
    label:        'c01_atk_03_air (METEO 空中Jコンボ3発目・フィニッシャー)',
    duration:     22, hitFrame: 6, hitDuration: 4, cancelWindow: 20,  // dur:16→22 / cw:14→20（地上テンポ比率に同期）
    damage:       10,
    rangeX:       145, rangeZ: 120, rangeY: 130, rangeYDown: 280,   // PHYSICS.AERIAL_RANGE_Y(110)+20
    knockback:    25,             // 80→25（2026-05-15）地上敵を遠くに飛ばさず、着地後の立ち J へ繋ぎやすく
    aerialHop:    true,           // 空中Jコンボ全体で同じ量のホップ（c01_atk_01_air / 02_air と統一）
    atk_lv:       1,              // 地上敵：軽フリンチ knockback01（2026-05-15 2→1 で更に繋ぎ優先）
    atk_lv_air:   2,              // 空中敵：軽フリンチで保持（コンボ繋ぎ優先・2026-05-15 3→2）
    hitstop:      7, shake: 6,
    hitColor:     0xffee44,       // Z チェーンと同じ黄色（払いと混同しないよう氷系シアンから戻し）
    hitCount:     32,             // フィニッシャー強調：通常の Z 弱攻撃より多めの粒数（旧 18 → 32）
    homingLerpMult: 0.6,          // 空中 J 系はホーミングを弱め（2026-05-15）
    cancelOnLand: true,           // 着地瞬間に wait01 へ降格
    partsAnim:    'air_slam',
    particleType: 'normal',       // 前方放射パーティクル
  },
  // === 派生技（c01_add_NN）===
  //   命名規則 §9.0：旧 c01_atk_l_* は廃止。K = 必殺技ボタン化に伴い、強攻撃概念そのものを撤去。
  //   ↑J = 打ち上げ（add_02）／→J = タックル（add_01）／↓J = 払い（add_03）。
  //   空中強攻撃 c01_atk_l_01_air も廃止（空中 K は c01_sp_01_air 等の SP に置き換え）。
  // 仕様: METEO 打ち上げ派生 — Jチェーン中 ↑+J で発動
  c01_add_02: {
    // ★旧称：打ち上げ K。lv02 軽フリンチ + knockbackY=12 で軽く浮かせるだけのコンボ始動技に変更（2026-05-14）
    //   強い打ち上げは sp_02 系へ移管済
    label:        'c01_add_02 (METEO ↑+K・軽浮かせコンボ始動)',
    duration:     26, hitFrame: 5, hitDuration: 4, cancelWindow: 11,
    damage:       18,
    rangeX:       115, rangeZ: 110, rangeY: 180,  // 上方向リーチは維持（浮いた敵にも届く）
    knockback:    14,               // 水平ノックバック（facing 方向）
    knockbackY:   12,               // 上昇ノックバック（軽浮かせ・lv02 状態 + vy）
    lungeVx:      18,               // 踏み込み初速（facing 方向）— 1 キャラ分前進（≒ 100wu）
    lungeDecay:   0.82,             // フレーム減衰（18*5.55 ≒ 100wu 総距離）
    hitstop:      8, shake: 6,
    hitColor:     0xffcc00,         // 黄金色（演出は据置）
    hitCount:     18,
    partsAnim:    'upper_cut',
    // 打ち上げ属性（強吹っ飛ばし）は撤去：launchVy / attrGroup: LAUNCH_COMBO は使わない。
    // 代わりに knockback (水平) + knockbackY (垂直) で斜め上の軽い浮きを表現し、
    // ヒット後に sp_02 等の本格打ち上げ技でキャンセルしてコンボを伸ばす想定。
    launcher:     false,
    atk_lv:       2,                // 地上敵：軽フリンチ（knockback02）+ 浮き
    atk_lv_air:   2,                // 空中敵：軽フリンチ（knockback_air01）+ 浮き
  },
  // === sp_03（↓K）地上版・空中版：急降下踏みつけ必殺 ===
  //   ↓↓K（or J）コマンド受付・地上版は 2026-05-25 に「パワーゲイザー」へ全面改修。
  //   腕を振り上げ → 振り下ろし → 地面衝撃波（放射状 KB / 広範囲 / その場起動）
  //   空中版（c01_sp_03_air）は従来の hover→dive 単発ヒットを維持。
  c01_sp_03: {
    label:        'c01_sp_03 (METEO パワーゲイザー・地上衝撃波・↓↓K 地上版)',
    // 振り上げ（windup）→ 叩きつけ → 衝撃波 → リカバリー
    duration:     60, hitFrame: 32, hitDuration: 10, cancelWindow: 10,  // hitFrame 24→32（出がかり延長）/ duration 52→60 / cw 22→10（連打無敵ループ防止）
    damage:       20,
    rangeX:       288, rangeZ: 224,   // 2026-05-25 360/280 → 80% = 288/224（広すぎ緩和）
    rangeY:       50,                 // 2026-05-25 90→50：上方向判定を弱める
    rangeYDown:   20,                 // 2026-05-25 30→20
    knockback:    32,
    hitstop:      8, shake: 10,        // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       5,
    atk_lv_air:   5,
    atk_lv_down:  4,                  // ダウン中の敵は軽め（爆発的な巻き込みより抑制）
    kb_vy_lv5:        -20,            // 若干浮き上がってから地面へ（lv5 既定の強叩きつけより緩め）
    kb_vx_mult_lv5:   1.2,            // 放射方向へ適度に飛ばす
    kbRadial:     true,               // 攻撃者中心から各敵への方向ベクトルでノックバック
    omni:         true,
    launcher:     false,
    aerialHop:    false,
    hitColor:     0xff8822,
    hitCount:     28,
    shockwaveEffect: true,            // hitFrame で地面衝撃波リング演出（attack-engine が発火）
    magmaVentTrigger: true,           // OC BRN-e08：命中地点にマグマ vent 設置
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    partsAnim:    'slam_down',
    repulseAxis:  'ground',
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（ground 軸：地面叩きつけ → ボス腰下〜足元を捉える）
    repulseBox:   { offsetX: 0, offsetY: 100, w: 700, h: 500, d: 200 },
  },
  // 空中版：急降下で敵を地面に引きずり → 着地瞬間に自動ゲイザー発火（2フェーズ）
  //   Phase1: 急降下ヒット（敵を下方に引きずる・横は抑える）
  //   Phase2: 着地瞬間に c01_sp_03_land が自動起動
  c01_sp_03_air: {
    label:        'c01_sp_03_air (METEO 急降下→着地ゲイザー・↓↓K 空中版)',
    duration:     80, hitFrame: 18, hitDuration: 40, cancelWindow: 8,
    damage:       12,
    rangeX:       145, rangeZ: 130,
    rangeY:       60,
    rangeYDown:   300,
    knockback:    14,
    hitstop:      6,  shake: 6,        // 2026-05-27 SP hitstop -30%（8→6）
    diveVy:       -22,
    divePause:    16,
    atk_lv:       5,
    atk_lv_air:   5,
    atk_lv_down:  4,
    kb_vy_lv5:        -50,          // 敵を強く下方に引きずる
    kb_vx_mult_lv5:   0.2,          // 横はほぼ飛ばさない（まとめて落とす）
    omni:         true,
    launcher:     false,
    aerialHop:    false,
    hitColor:     0xff4422,
    hitCount:     18,
    noHomingY:    true,             // dive 軌道を保つ
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    partsAnim:    'air_slam',
    autoLandGeyser: true,           // 着地瞬間に c01_sp_03_land を自動発火
    magmaVentTrigger: true,         // OC BRN-e08：命中地点にマグマ vent 設置
    repulseAxis:  'ground',
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（ground 軸・空中版：dive 軌跡上でボス頭〜胴体を捉える）
    repulseBox:   { offsetX: 0, offsetY: 100, w: 600, h: 800, d: 200 },
  },
  // 着地ゲイザー（c01_sp_03_air 着地時に内部自動発火・直接入力不可）
  //   hitFrame: 0 で 1 フレーム目から即発生。shockwaveEffect で視覚は即座に出る。
  c01_sp_03_land: {
    label:        'c01_sp_03_land (着地ゲイザー・内部自動発火)',
    duration:     30, hitFrame: 0, hitDuration: 14, cancelWindow: 8,
    damage:       20,
    rangeX:       288, rangeZ: 224,
    rangeY:       50,
    rangeYDown:   20,
    knockback:    32,
    hitstop:      8, shake: 10,        // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       5,
    atk_lv_air:   5,
    atk_lv_down:  4,
    kb_vy_lv5:        -20,
    kb_vx_mult_lv5:   1.2,
    kbRadial:     true,
    omni:         true,
    launcher:     false,
    aerialHop:    false,
    hitColor:     0xff8822,
    hitCount:     28,
    shockwaveEffect: true,
    magmaVentTrigger: true,         // OC BRN-e08：着地ゲイザーでも vent 設置
    isSpecial:    true,
    flashOnStart: false,            // 空中phase で既にフラッシュ済み
    showHitbox:   true,
    partsAnim:    'slam_down',
  },
  // ── 旧 c01_sp_03_air（急降下版）温存 ───────────────────────────────
  // 再利用候補：単発重ヒット・dive → 叩きつけの OC 強化版 or 別 SP 枠として。
  // 復帰手順：下のコメントブロックを c01_sp_03_air: { ... } に差し戻すだけ。
  //
  // c01_sp_03_air_LEGACY: {
  //   label:        'c01_sp_03_air (METEO 空中急降下・↓↓K 必殺・単発)',
  //   duration:     40, hitFrame: 14, hitDuration: 6, cancelWindow: 22,
  //   damage:       14,
  //   rangeX:       145, rangeZ: 135,
  //   rangeY:       60,
  //   rangeYDown:   300,
  //   knockback:    20,
  //   hitstop:      14, shake: 8,
  //   diveVy:       -22,
  //   divePause:    16,
  //   aerialHop:    false,
  //   atk_lv:       5,  atk_lv_air: 5,  atk_lv_down: 5,
  //   kb_vy_lv5:    -45,  kb_vx_mult_lv5: 2.0,
  //   omni:         true,  launcher: false,
  //   hitColor:     0xff4422,  hitCount: 22,
  //   homingLerpMult: 1.4,  noHomingY: true,  targetOvershootGuard: true,
  //   isSpecial:    true,  flashOnStart: true,  showHitbox: true,
  //   partsAnim:    'air_slam',
  // },
  // ─────────────────────────────────────────────────────────────────────
  // 仕様: METEO 払い攻撃 — ↓+K で発動（単体可・Jチェーンからも可）
  // 当たり判定：足元中心・全方向・地面スライスのみ（浮き敵には当たらない）
  c01_add_03: {
    label:        'c01_add_03 (METEO 払い・↓+K)',
    duration:     20, hitFrame: 4, hitDuration: 4, cancelWindow: 10,
    damage:       14,
    rangeX:       155, rangeZ: 150,
    // Y 軸非対称（2026-05-18 改修）：上方向を頭部高さ（≒110wu）まで拡張 / 下方向は薄め維持
    //   → 立ち敵 + 浮いた敵（knockback_air01 / launch 直後）まで届く
    rangeY:       110,
    rangeYDown:   35,
    knockback:    8,
    lungeVx:      18,              // 踏み込み初速（1 キャラ分前進・追加 2026-05-15）
    lungeDecay:   0.82,
    hitstop:      6, shake: 4,
    hitColor:     0xaaddff,
    hitCount:     12,
    launcher:     false,
    omni:         true,            // 前方限定を外す（全方向ヒット）
    // atk_lv 改修（2026-05-18）：地上 = lv2 軽フリンチ / 空中 = lv5 叩きつけ / ダウン中 = lv7 拾い
    atk_lv:       2,               // 地上敵：knockback02（大フリンチ）
    atk_lv_air:   5,               // 空中敵：叩きつけ（down_rakka_start で地面に叩き落とす）
    atk_lv_down:  7,               // ダウン中：knockback03 で小バウンド（拾い）
    partsAnim:    'sweep',
  },
  // === SP 系：メガクラッシュ（J+K / U / R1）===
  // 切り返しでもあるが、コンボを繋ぎに行く設計：
  //   atk_lv 2 → 軽フリンチで敵が起立復帰しやすい
  //   atk_lv_down 5 → ダウン中の敵を拾い直してコンボ継続
  // === SP 系：ULT01（J+K+L / I / R2 — SP 2 ストック）===
  // 地上限定・hit_confirm からキャンセル発動可・発動中完全無敵
  // 演出構成：決めポーズ 40F → ヒット判定 20F → 余韻 30F = 計 90F
  c01_sp_ult01: {
    label:        'c01_sp_ult01 (METEO ULT01)',
    duration:     70,            // 全体長（停止感を短く・ヒット後はフェードで滑らかに余韻）
    hitFrame:     25,            // 決めポーズ後にヒット発生（ズーム完了 12F + ポーズ 13F）
    hitDuration:  20,            // ヒット判定アクティブ時間
    cancelWindow: 0,             // ヒット後キャンセル不可
    damage:       80,
    // 全画面 AoE：rangeX/Y/Z を巨大値で omni 全方向
    rangeX:       5000, rangeZ: 5000, rangeY: 5000, rangeYDown: 5000,
    knockback:    60,
    hitstop:      12, shake: 16,       // ULT は SP 一括 -30% の対象外（演出尺維持）
    atk_lv:       3,             // 地上敵：吹き飛び
    atk_lv_air:   3,             // 空中敵：吹き飛び
    atk_lv_down:  7,             // ダウン中：knockback03（小バウンド・ダウン継続）
    kbTimeMult:   2.0,           // フリンチ時間 2 倍（追撃猶予）
    hitColor:     0xff4422,
    hitCount:     32,
    omni:         true,
    isUlt:        true,          // ULT 専用フラグ（演出トリガー）
    noCancelOnHit: true,
    noSpGain:     true,          // ULT ヒットでは SP 獲得しない（自己回復ループ防止）
    // ULT は最終 AoE 技：ヒットした敵を状態を問わず必ず down_burst_start（バーストダウン）に
    // 強制遷移。完全無敵スピンで遠くに飛んでいくので画面整理にもなる。
    // - down_burst_* 中の敵（通常は完全無敵）も hit 可能
    // - 既存吹き飛び中（down_front_loop / down_super_loop 等）の状態保護をバイパス
    // - combo break HUD は表示しない（ULT は意図的な発動・break ではない）
    // 2026-05-18: forceKnockdown → forceBurstDown に変更（より強い演出に統一）
    forceBurstDown: true,
    // 拡張性（将来 N 発判定するときの仕様）：
    //   hitCountTotal: 1   → 現状は単発
    //   hitInterval:   8   → 複数 hit 時の間隔フレーム
    hitCountTotal: 1,
    hitInterval:   8,
  },

  c01_sp_mega01: {
    label:        'c01_sp_mega01 (METEO メガクラッシュ)',
    damage:       30,
    knockback:    45,
    hitstop:      6, shake: 8,         // メガクラは SP 一括 -30% の対象外（リバーサル決め感維持）
    atk_lv:       2,    // 通常時：knockback02（軽フリンチ・コンボ繋ぎ）
    atk_lv_air:   2,    // 空中敵：knockback_air01
    atk_lv_down:  5,    // ダウン中：down_bound_start（拾い直し）
    kbTimeMult:   2.0,  // この技で発生したフリンチ/バウンド時間を 2 倍に（コンボ猶予を延ばす）
    hitColor:     0x66ddff,
    hitCount:     18,
    omni:         true, // 全方向ヒット（AoE）
    // 注：rangeX/Y/Z は使わない。triggerMegaCrash 側で距離ベース判定する
  },

  // === ステップ攻撃（ダッシュ中 J/K の派生）===
  // 共通: 地上限定・一発技（チェーンしない）・ダッシュ運動量を保持して前進
  // 共通属性 isStepAttack:true で start/end/movement/hit/visual の各ロジックが分岐する
  // momentumDecay: ダッシュ運動量の毎フレーム減衰率（1.0=不減衰）
  // tiltX: 擬似アニメ用 rotation.x 目標値（YXZ 順・+前傾 / -後傾）— 正式アニメ実装まで
  c01_atk_01_step: {
    label:        'c01_atk_01_step (METEO ステップJ・スライディング)',
    // 2026-05-19：発生前硬直 +8F（ダッシュ攻撃の差し合いリスク付与）
    duration:     22, hitFrame: 12, hitDuration: 4, cancelWindow: 14,
    damage:       8,
    rangeX:       150, rangeZ: 70, rangeY: 60,
    knockback:    18, hitstop: 5, shake: 4,
    atk_lv:       1,                 // 通常時：軽フリンチ knockback01（スライド軽打のイメージ）
    atk_lv_air:   1,                 // 空中敵も同じ（明示）
    atk_lv_down:  7,                 // ダウン中：down_bas_loop リフレッシュ（拾い）
    hitColor:     0x66ccff,
    hitCount:     14,
    launcher:     false,
    aerialHop:    false,
    partsAnim:    'slide',
    isStepAttack: true,
    momentumDecay: 0.98,             // 「ズザー」と滑り込む強い慣性（0.97→0.98：潜り込み距離を伸ばす）
    keepMomentumOnHit: true,         // ヒット後も慣性を切らず敵に潜り込む（次の J が間合いに入りやすい）
    tiltX:        -1.40,             // ≈ -80°（ほぼ水平・後ろ倒し）
  },
  c01_add_01: {
    label:        'c01_add_01 (METEO ステップK・ショルダータックル・単発)',
    duration:     28, hitFrame: 4, hitDuration: 5, cancelWindow: 0,
    // 2026-05-18：連続ヒット → 単発化。atk_lv 2/2/-（立ち K 相当）・KB 距離も立ち K と同等
    damage:       22,
    rangeX:       160, rangeZ: 90, rangeY: 180,
    knockback:    23,                // ★ 80→23（立ち K c01_atk_l_01 と同等・追い打ち容易化）
    hitstop:      10, shake: 9,
    atk_lv:       2,                 // 軽フリンチ（立ち K と同じ）
    atk_lv_air:   2,                 // 空中ヒットも knockback_air01（軽フリンチ）
    // atk_lv_down は未定義 → ダウン中の敵には空振り（拾えない）
    hitColor:     0xff8844,
    hitCount:     22,                // パーティクル数
    launcher:     false,
    aerialHop:    false,
    partsAnim:    'tackle',
    isStepAttack: true,
    momentumDecay: 0.96,
    tiltX:        +0.45,             // ≈ +26°（前傾タックル）
    noCancelOnHit: true,             // ヒットしても hit_confirm に入らず即 wait01
    // →K（非ダッシュ起動）時は初速半減。ダッシュ起動時は通常通り DASH_SPEED_MULT 全量
    nonDashStartMult: 0.5,
  },

  // ============================================================
  //  必殺技（コマンド技・溜め技）
  //  - 命名規約：c01_sp_01 = 波動コマンド系 / 02 = ↓↑系 / 03 = 溜め系
  //  - SP 消費なし・ヒットで通常 SP 獲得 / 1 コンボ中 1 回まで
  //  - isSpecial: true で processSpecialInput 側のフラグ管理対象に
  //  - showHitbox: true で赤い半透明 AABB を hitFrame 中に表示
  //  - flashOnStart: true でプレイヤーを発動瞬間に白く発光
  // ============================================================
  c01_sp_01: {
    label:        'c01_sp_01 (METEO 波動コマンド・弱ビーム・2段)',
    // 2026-05-19：発生前硬直 +10F（敵に対するリスク付与・発生に重み）
    // 2026-05-25：3段→2段に変更（ヒット感重視・OC IGNITE なし通常版）
    duration:     40, hitFrame: 24, hitDuration: 6, cancelWindow: 14,
    // === 連続ヒット：2 段（フレーム 24 / 29）===
    // 中間 1 発 + 最終 1 発。シンプルに当て切る感触
    isMultiHit:     true,
    multiHitCount:  2,
    hitInterval:    5,
    damagePerHit:   6,    // 中間 1 発：のけぞり + 6 ダメ
    damageLastHit:  14,   // 最終 1 発：14 ダメ + atk_lv 3 dispatch
    damage:         20,   // 互換用（6 + 14 = 20 総合）
    rangeX:       250, rangeZ: 80, rangeY: 100,
    knockback:    50, hitstop: 6, shake: 6,   // 2026-05-27 SP hitstop -30%（8→6）
    atk_lv:       3,    // 地上敵：吹き飛び（down_front_start）
    atk_lv_air:   3,    // 空中敵も吹き飛び
    hitColor:     0x44ccff,
    hitCount:     24,
    launcher:     false,
    partsAnim:    'strong_punch_r',  // 流用（将来 beam_thrust に分離）
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    lungeVx:      20,
    lungeDecay:   0.85,
    lungeDelay:   12,
    windupBackVx:  5,
    targetOvershootGuard: true,
    selfRecoilVx: 2.4,
    selfRecoilDecay: 0.85,
    repulseAxis:  'frontal',
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（frontal 軸：前方突き → 前方の敵を捉える・facing で反転）
    repulseBox:   { offsetX: 300, offsetY: 150, w: 600, h: 400, d: 200 },
  },
  // OC IGNITE 専用 SP1：3段ザラつき手触り・着火トリガー付き。ダメージは通常版より低い（後の伸びで逆転）
  c01_sp_01_ignite: {
    label:        'c01_sp_01_ignite (METEO 波動コマンド・OC IGNITE 版・3段着火)',
    duration:     40, hitFrame: 24, hitDuration: 11, cancelWindow: 14,
    isMultiHit:     true,
    multiHitCount:  3,
    hitInterval:    5,
    damagePerHit:   4,    // 中間 2 発：4 ダメ（通常版より低い）
    damageLastHit:  8,    // 最終 1 発：8 ダメ + 着火トリガー
    damage:         16,   // 互換用（4×2 + 8 = 16 総合）
    rangeX:       250, rangeZ: 80, rangeY: 100,
    knockback:    50, hitstop: 6, shake: 6,   // 2026-05-27 SP hitstop -30%（8→6）
    atk_lv:       3,
    atk_lv_air:   3,
    hitColor:     0xff4400,  // 赤み強め
    hitCount:     24,
    launcher:     false,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    lungeVx:      20,
    lungeDecay:   0.85,
    lungeDelay:   12,
    windupBackVx:  5,
    targetOvershootGuard: true,
    selfRecoilVx: 2.4,
    selfRecoilDecay: 0.85,
    igniteTrigger: true,    // OC IGNITE: 2 フェーズ起爆システムを有効化
    repulseAxis:  'frontal',
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（frontal 軸：前方突き → 前方の敵を捉える・facing で反転）
    repulseBox:   { offsetX: 300, offsetY: 150, w: 600, h: 400, d: 200 },
  },
  // 空中版：斜め下方向に発射。rangeY を絞って rangeYDown を大きく取る非対称 hitbox。
  // METEO 固有の挙動（VIPER 等は別の傾向にする予定）。pickSpecialAttackId で地上/空中を分岐
  c01_sp_01_air: {
    label:        'c01_sp_01_air (METEO 波動コマンド・空中版・パイルバンカー 2 段)',
    // 2026-05-27 修正：ヒット数 3→2、atk_lv 5/6→3。atklv6 はチェイン軸 OC へ移管予定。
    duration:     36, hitFrame: 20, hitDuration: 6, cancelWindow: 22,
    // === 連続ヒット：2 段（フレーム 20 / 26）===
    isMultiHit:     true,
    multiHitCount:  2,
    hitInterval:    6,    // 2 段になったので間隔を少し広めに
    multiHitVacuum: true,
    airStartVy:    3,
    airGravFactor: 0.2,
    damagePerHit:   4,
    damageLastHit:  10,   // 最終 1 発：火力を 8→10 に強化（2 段化補填）
    damage:         14,   // 互換用（4+10）
    rangeX:       220, rangeZ: 90,
    rangeY:       30,
    rangeYDown:   260,
    knockback:    35, hitstop: 6, shake: 6,   // 2026-05-27 SP hitstop -30%（8→6）
    atk_lv:       3,        // 2026-05-27 5→3：吹き飛び start（軽め）
    atk_lv_air:   3,        // 2026-05-27 6→3：超吹き飛ばし剥奪（チェイン軸 OC へ移管予定）
    // === lv 別ベクトル上書き（lv3 用は標準でカバー・lv5/lv6 用は将来 OC で再追加）===
    hitColor:     0x44ccff,
    hitCount:     22,
    launcher:     false,
    // 後方斜め上にホップ（パイルバンカー射出の反動表現）。空中コンボの締めとして
    //   「後方に下がって距離を取る」イメージ。aerialHopFrame で最終段(28F)の後に出す
    //   → 連続ヒット中に自分が後退して取りこぼすのを防ぐ。
    aerialHop:    true,
    aerialHopFrame: 30,
    aerialHopVy:  14,
    aerialHopVx:  -10,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    repulseAxis:  'frontal',
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（frontal 軸：前方突き → 前方の敵を捉える・facing で反転）
    repulseBox:   { offsetX: 300, offsetY: 150, w: 600, h: 400, d: 200 },
  },
  // OC IGNITE 空中版：c01_sp_01_air の着火トリガー付きコピー
  c01_sp_01_ignite_air: {
    label:        'c01_sp_01_ignite_air (METEO 波動コマンド・空中 OC IGNITE 版)',
    duration:     36, hitFrame: 20, hitDuration: 11, cancelWindow: 22,
    isMultiHit:     true,
    multiHitCount:  3,
    hitInterval:    4,
    multiHitVacuum: true,
    airStartVy:    3,
    airGravFactor: 0.2,
    damagePerHit:   4,
    damageLastHit:  8,
    damage:         16,
    rangeX:       220, rangeZ: 90,
    rangeY:       30,
    rangeYDown:   260,
    knockback:    45, hitstop: 6, shake: 6,   // 2026-05-27 SP hitstop -30%（8→6）
    // 2026-05-27 修正：最終段 atk_lv 5 統一 + やや下目軌道でバウンドダウンへ
    //   atk_lv_air 6 を撤廃（超吹き飛ばし→チェイン軸 OC 検討中）。地上/空中どちらも lv5 叩きつけ。
    //   kb_vy_lv5 -8→-14：下方向初速を強化（軌道がやや下目に）→ down_rakka_start → 着地 down_bound_start
    //   kb_vx_mult_lv5 0.5→0.3：水平を抑えて「落とす」感を強調
    atk_lv:       5,
    atk_lv_air:   5,
    kb_vy_lv5:        -14,
    kb_vx_mult_lv5:    0.3,
    hitColor:     0xff4400,
    hitCount:     22,
    launcher:     false,
    aerialHop:    true,
    aerialHopFrame: 30,
    aerialHopVy:  14,
    aerialHopVx:  -10,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    igniteTrigger: true,
    repulseAxis:  'frontal',
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（frontal 軸：前方突き → 前方の敵を捉える・facing で反転）
    repulseBox:   { offsetX: 300, offsetY: 150, w: 600, h: 400, d: 200 },
  },
  c01_sp_02: {
    label:        'c01_sp_02 (METEO 対空コマンド・粉塵昇竜・地上版)',
    // === 二段構造（SF6 ケン粉塵昇竜パターン）===
    //   frame 0-9 : 前進フェーズ（地上を lungeVx で走り、ヒット 1-3 発を稼ぐ）
    //   frame 10  : plyrLiftVyDelay 発動 → leap up 開始
    //   frame 13  : 最終 4 発目（昇竜・launcher で敵を上空へ）
    duration:     18, hitFrame: 4, hitDuration: 5, cancelWindow: 4,
    isMultiHit:     true,
    multiHitCount:  4,
    hitInterval:    3,                 // ラピッドな「粉塵」感
    damagePerHit:   3,                 // 中間 3 発 × 3 = 9
    damageLastHit:  16,                // 最終昇竜：9 + 16 = 25 トータル
    damage:         25,                // 互換用
    intermediateKnockbackVx: 12,       // 敵をプレイヤー前進と同調させて引き連れる（通過防止）
    intermediateKbDecay:     0.85,     // 中速減衰：refresh まで持続させる
    // === 前進フェーズ（地上 dash）===
    lungeVx:      14,                  // plyrLiftVx の代わりに地上ダッシュ
    lungeDecay:   0.92,                // 緩減衰で 10F 持続
    rangeX:       110, rangeZ: 100, rangeY: 200,
    knockback:    40, hitstop: 5, shake: 6,  // 2026-05-27 SP hitstop -30%（7→5）
    hitstopLastHit: 8,  // 2026-05-27 SP hitstop -30%（12→8・最終昇竜段のみ重め）
    atk_lv:       4,    // 最終ヒット：打ち上げ（down_up_start）
    atk_lv_air:   4,    // 空中敵も打ち上げ
    launchVy:     22,   // 最終ヒットで発動（中間はホールドのみ）
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44,
    hitCount:     22,
    // === 昇竜フェーズ：frame 10 で発動 ===
    plyrLiftVy:       24,
    plyrLiftVyDelay:  10,              // 最終ヒット直前に leap up（粉塵昇竜の核）
    plyrLiftVx:       14,              // 離地後の airVx 維持用（事前セット）
    // aerialHop は空中版（c01_sp_02_air）にのみ持たせる。地上 sp_02 はホップ無し（2026-05-15）
    aerialHop:    false,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    repulseAxis:  'aerial',   // リパルスカウンター：対空軸（e02_atk_02 などに合わせる）
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（パリィボックス・2026-05-26 → 2026-05-27 Y 上方向拡張）：
    //   頭上に大きく広く。攻撃の物理 hitbox とは独立。
    //   敵 e02_atk_02 aim 中ピーク Y ≈ 747wu に対し余裕を持って Y 上限 1600wu まで拾う。
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    // SP2 系は単体ターゲット化（2026-05-27）：RC の主役性保持・周辺巻き添え抑止
    singleTarget: true,
  },
  // 空中版：単発打ち上げ（多段は触感的に苦しかったため単発化・2026-05-14）
  //   ヒットストップは重め維持で必殺技コマンド入力余地を確保
  //   plyrLiftVy は遅延発動：ヒット時にはまだ上昇していないので低空で敵を捉えられる
  //   ヒット後（frame 12）に追加上昇 → 「単発で当てて、その後昇る」絵
  c01_sp_02_air: {
    label:        'c01_sp_02_air (METEO 対空コマンド・空中版・単発)',
    // フレーム構成（地上版 c01_sp_02_short と統一）：
    //   frame  1-7  : startup
    //   frame  8-13 : 攻撃判定 active（hitFrame=8 / hitDuration=6）
    //   frame 14-49 : 後隙
    //   frame 20-45 : キャンセル受付（cancelWindowStart=20 / cancelWindow=45）
    //   全体 50F / 着地後：landingLag=30F の地上硬直
    duration:     50, hitFrame: 8, hitDuration: 6,
    cancelWindowStart: 20,  // キャンセル受付開始（attacking 中のバッファ消化タイミング）
    cancelWindow: 45,       // hit_confirm 中の cancelTimer 初期値（終了タイミング）
    damage:       25,
    // X 軸前方判定を広げる（200）：plyrLiftVx を 0 にした分、当たり判定で前方の敵を拾う設計（2026-05-19）
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,     // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       4,
    atk_lv_air:   4,
    launchVy:     22,
    launchVyAirborne: 13,           // 空中の敵に当たった時の浮かせ：10だと降下/16だと上昇したので中間値（2026-05-20）
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44,
    hitCount:     22,
    // === 構造：空中版は前進を抑え、上昇も控えめに（地上版と運用を分離・2026-05-19）===
    plyrLiftVx:       5,              // 14→5：通過しない程度の前進ドリフト（6F で約 26 units 前進・rangeX 200 圏内に収まる）
    plyrLiftVy:       8,              // 16→8：上昇は半分（空中の足場確保程度）
    plyrLiftVyDelay:  12,             // ヒット後（frame 6-11 終了直後）に上昇開始
    aerialHop:    true,
    aerialHopVy:  8,                  // 16→8：ヒット時のホップも半分
    postAirLockout: 45,               // ホップ後に空中攻撃を一定F封鎖（SP2連打防止）
    landingLag:   30,                 // 着地後 30F の地上硬直（攻撃入力封鎖）
    cancelToAirJ: true,               // hit_confirm 中に J 入力で空中チェーン始動可（SP2 専用）
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    repulseAxis:  'aerial',           // 空中 SP2 も RC（aerial 軸）対応：地上版と揃える（2026-05-26）
    repulseFrameStart: 1, repulseFrameEnd: 20,
    // RC 受付ボックス（Y 上方向拡張・2026-05-27）：地上版と統一
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  // 地上短押し版（弱形態・単発アッパー・2026-05-26）：
  //   ↑+K を短押し（< SP2_HOLD_FRAMES）で地上発動した時の専用 ID。
  //   c01_sp_02_air をベースに、自機上昇のみ粉塵昇竜最終段と同等（plyrLiftVy=24 / delay=10）に強化。
  //   「単体アッパーでもしっかり飛び上がる絵」をユーザー指示で実現（2026-05-26）。
  //   空中短押し時は c01_sp_02_air をそのまま使うため、空中の手触り（コンボ降下しない控えめ上昇）は維持。
  c01_sp_02_short: {
    label:        'c01_sp_02_short (METEO 対空コマンド・地上短押し版・単発)',
    // フレーム構成：
    //   frame  1-7  : startup
    //   frame  8-13 : 攻撃判定 active（hitFrame=8 / hitDuration=6）
    //   frame 14-34 : 後隙
    //   frame 15-45 : キャンセル受付（cancelWindowStart=15 / cancelWindow=45）
    //   全体 50F / 着地硬直なし
    duration:     50, hitFrame: 8, hitDuration: 6,
    cancelWindowStart: 30,
    cancelWindow: 45,
    damage:       25,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,     // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       4,
    atk_lv_air:   4,
    launchVy:     22,
    launchVyAirborne: 13,
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44,
    hitCount:     22,
    // 自機上昇：粉塵昇竜最終段と同等（plyrLiftVy=24 / delay=10）
    // 前進量は通常 SP2 と同じ 5 を維持（普段使いの手触りを保つ・2026-05-26）。
    // すり抜けは RC 判定 box を横方向に十分広く取ることでカバーする方針へ
    plyrLiftVx:       5,
    plyrLiftVy:       24,
    plyrLiftVyDelay:  10,
    aerialHop:    false,
    cancelToAirJ: true,               // ヒット後・自機が浮いた状態で空中 J にキャンセル可
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    repulseAxis:  'aerial',
    // RC 受付ボックス（Y 上方向拡張・2026-05-27）：地上長押し版と統一
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
    // RC 判定 active 期間：押した瞬間から受け付ける（1-20F）。
    // SP の発動タイミングに関わらず、入力の意図を確実に拾う設計。
    repulseFrameStart: 1,
    repulseFrameEnd:   20,
  },
  // === OC BRN-e11 FLAME UPPER（2026-05-28 v4 思想再構築）===
  //   "押し放置 → 最終段 launcher が出し切りで出る / 連打 → 合間に short upper を混ぜ込む"
  //   player-system 側でキューを持ち、入力を蓄積：
  //     - 初回 ↑K：windup タイマー（18F idle）を仕込む
  //     - windup / mid 中の追加 ↑K：mid キューを +1（最大 3）
  //     - windup 終了 or mid 終了：キュー残量 > 0 なら _flame_mid、0 なら _flame_final 発火
  //   ここでは「mid 単発」と「final launcher」の 2 種（×地上/空中）だけ定義する。
  c01_sp_02_short_flame_mid: {
    label:        'c01_sp_02_short_flame_mid (METEO SP2・FLAME UPPER 中間 short upper)',
    duration:     26, hitFrame: 6, hitDuration: 5,
    cancelWindowStart: 14,
    cancelWindow: 22,
    damage:       6,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    14,
    knockbackY:   6,
    hitstop:      4, shake: 4,
    atk_lv:       2,
    atk_lv_air:   2,
    hitColor:     0xff7733,
    hitCount:     14,
    aerialHop:    false,
    cancelToAirJ: false,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: false,
    showHitbox:   true,
    igniteTrigger: true,
    repulseAxis:  'aerial',
    repulseFrameStart: 1, repulseFrameEnd: 12,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  c01_sp_02_air_flame_mid: {
    label:        'c01_sp_02_air_flame_mid (METEO SP2・FLAME UPPER 空中 中間 short upper)',
    duration:     26, hitFrame: 6, hitDuration: 5,
    cancelWindowStart: 14,
    cancelWindow: 22,
    damage:       6,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    14,
    knockbackY:   6,
    hitstop:      4, shake: 4,
    atk_lv:       2,
    atk_lv_air:   2,
    hitColor:     0xff7733,
    hitCount:     14,
    aerialHop:    false,
    cancelToAirJ: false,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: false,
    showHitbox:   true,
    igniteTrigger: true,
    repulseAxis:  'aerial',
    repulseFrameStart: 1, repulseFrameEnd: 12,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  // FLAME UPPER 最終段 = 通常 SP2 c01_sp_02_short 同等の launcher。自機も浮く。
  c01_sp_02_short_flame_final: {
    label:        'c01_sp_02_short_flame_final (METEO SP2・FLAME UPPER 最終段 launcher)',
    duration:     50, hitFrame: 8, hitDuration: 6,
    cancelWindowStart: 30,
    cancelWindow: 45,
    damage:       25,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,
    atk_lv:       4,
    atk_lv_air:   4,
    launchVy:     22,
    launchVyAirborne: 13,
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44,
    hitCount:     22,
    plyrLiftVx:       5,
    plyrLiftVy:       24,
    plyrLiftVyDelay:  10,
    aerialHop:    false,
    cancelToAirJ: true,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    igniteTrigger: true,
    repulseAxis:  'aerial',
    repulseFrameStart: 1, repulseFrameEnd: 16,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  c01_sp_02_air_flame_final: {
    label:        'c01_sp_02_air_flame_final (METEO SP2・FLAME UPPER 空中最終段 launcher)',
    duration:     50, hitFrame: 8, hitDuration: 6,
    cancelWindowStart: 20,
    cancelWindow: 45,
    damage:       25,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,
    atk_lv:       4,
    atk_lv_air:   4,
    launchVy:     22,
    launchVyAirborne: 13,
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44,
    hitCount:     22,
    plyrLiftVx:       5,
    plyrLiftVy:       8,
    plyrLiftVyDelay:  12,
    aerialHop:    true,
    aerialHopVy:  8,
    postAirLockout: 45,
    landingLag:   30,
    cancelToAirJ: true,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    igniteTrigger: true,
    repulseAxis:  'aerial',
    repulseFrameStart: 1, repulseFrameEnd: 16,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  // === sp_04 系：N 段階チャージ（stage1=50F / stage2=120F MAX / 将来 stage3+ は _03, _04...）===
  //   stage1 → c01_sp_04_01 / c01_sp_04_01_air：今までの判定そのまま・後方ノックバック付与（lv6）
  //   stage2 → c01_sp_04_02 / c01_sp_04_02_air：一回り大きく前方広がり・後方ノックバック超強化
  //   旧名 c01_sp_04 / c01_sp_04_max は 2026-05-20 リネーム（_NN 連番化で stage3+ 追加に備える）
  c01_sp_04_01: {
    label:        'c01_sp_04_01 (METEO 溜めパンチ・stage1・地上版)',
    // 2026-05-19：発生前硬直 +8F（溜め技は溜めで補えるがリスク付与）
    // 2026-05-28：armor 1（startup 中 SA 1）追加 — 攻撃発生まで 1 ヒット吸収
    duration:     44, hitFrame: 24, hitDuration: 6, cancelWindow: 16,
    armor:        1,
    damage:       28,
    rangeX:       220, rangeZ: 140,   // 2026-05-25 rangeX 160→220（狭すぎ緩和）/ rangeZ 140 維持
    rangeY:       130,
    rangeYDown:   30,
    knockback:    60, hitstop: 8, shake: 10,    // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       6,                       // 2026-05-15：3→6 で「超吹き飛ばし」に格上げ（後方奥まで飛ばす）
    atk_lv_air:   6,
    // atk_lv_down は無し
    kb_vy_lv6:        8,                   // lv6 既定（KB_LV06_VY=18）を上書き：若干浮き上がる軌道（2026-05-15 -6→8）
    kb_vx_mult_lv6:   1.4,                 // lv6 既定 2.5 を弱め（旧 3.0 → 1.8 → 1.4）
    kb_vx_decay_lv6:  0.92,                // ほぼ等速で減衰（直線軌道）
    hitColor:     0xff4422,
    hitCount:     30,
    launcher:     false,
    aerialHop:    false,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    // 攻撃発生時の自己ノックバック（少し反動・2026-05-18）
    selfRecoilVx: 10,
    selfRecoilDecay: 0.85,
  },
  // 空中版：地上版とほぼ同等の触感で、空中で J 長押し→離しでディスパッチされる
  c01_sp_04_01_air: {
    label:        'c01_sp_04_01_air (METEO 溜めパンチ・stage1・空中版)',
    // 2026-05-19：発生前硬直 +8F
    // 2026-05-28：armor 1（startup 中 SA 1）追加
    duration:     44, hitFrame: 24, hitDuration: 6, cancelWindow: 25,
    armor:        1,
    damage:       28,
    rangeX:       220, rangeZ: 140,   // 2026-05-25 rangeX 160→220：地上版に同期
    rangeY:       130,
    rangeYDown:   30,
    knockback:    60, hitstop: 8, shake: 10,    // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       6,                       // 2026-05-15：3→6
    atk_lv_air:   6,
    // atk_lv_down 無し
    kb_vy_lv6:        8,                   // 若干浮き上がる軌道（2026-05-15）
    kb_vx_mult_lv6:   1.8,                 // 60% 縮小（旧 3.0）
    kb_vx_decay_lv6:  0.92,
    hitColor:     0xff4422,
    hitCount:     30,
    launcher:     false,
    aerialHop:    true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    // 攻撃発生時の自己ノックバック（少し反動・地上版と同じ・2026-05-18）
    selfRecoilVx: 10,
    selfRecoilDecay: 0.85,
  },
  // === stage2 MAX：c01_sp_04_02 / c01_sp_04_02_air ===
  // 120F チャージで成立。一回り大きく前方に広がる判定 + 後方ノックバック超強化（空中 sp_01 並み）。
  // 将来 stage3+ を OC/チップで足す場合は c01_sp_04_03, c01_sp_04_04 ... と _NN を増やして対応。
  c01_sp_04_02: {
    label:        'c01_sp_04_02 (METEO 溜めパンチ・stage2 MAX・地上版)',
    // 2026-05-19：発生前硬直 +8F
    // 2026-05-28：armor 1（startup 中 SA 1）追加 — stage1 と同等の SA 強度
    duration:     48, hitFrame: 26, hitDuration: 7, cancelWindow: 16,
    armor:        1,
    damage:       32,                       // 2026-05-25 40→32：ULT 同等は強すぎたため stage1(28) と ULT(40) の中間に
    rangeX:       280, rangeZ: 160,         // 2026-05-25 rangeX 200→280（狭すぎ緩和）/ rangeZ 160 維持
    rangeY:       170,                      // 上方向もやや拡張
    rangeYDown:   50,
    knockback:    70, hitstop: 10, shake: 14,   // 2026-05-27 SP hitstop -30%（14→10）
    atk_lv:       6,
    atk_lv_air:   6,
    // atk_lv_down 無し
    // 後方ノックバック（lv6 ベクトル個別上書き）— 2026-05-25 再々調整
    kb_vy_lv6:        12,                   // 浮き上がる軌道へ（旧 -10 → +8 → +12）
    kb_vx_mult_lv6:   1.8,                  // 旧 5.0 → 2.5 → 1.8（追撃可能距離まで戻す）
    kb_vx_decay_lv6:  0.92,
    hitColor:     0x44aaff,                 // 高温の青炎（stage1 のオレンジから昇格）
    hitCount:     44,                       // 30 → 44：粒数増しで強さを可視化
    hitboxColor:  0x44aaff,                 // showHitbox の AABB も青に（既定の赤を上書き）
    launcher:     false,
    aerialHop:    false,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    // 攻撃発生時の自己ノックバック（大反動・ULT を除く METEO の最大技扱い・2026-05-18）
    selfRecoilVx: 32,
    selfRecoilDecay: 0.82,
  },
  c01_sp_04_02_air: {
    label:        'c01_sp_04_02_air (METEO 溜めパンチ・stage2 MAX・空中版)',
    // 2026-05-19：発生前硬直 +8F
    // 2026-05-28：armor 1（startup 中 SA 1）追加
    duration:     48, hitFrame: 26, hitDuration: 7, cancelWindow: 25,
    armor:        1,
    damage:       32,                       // 2026-05-25 40→32：地上版と同期
    rangeX:       280, rangeZ: 160,   // 2026-05-25 rangeX 200→280：地上版に同期
    rangeY:       170,
    rangeYDown:   50,
    knockback:    70, hitstop: 10, shake: 14,   // 2026-05-27 SP hitstop -30%（14→10）
    atk_lv:       6,
    atk_lv_air:   6,
    kb_vy_lv6:        12,                   // 浮き上がる軌道（2026-05-15・8→12）
    kb_vx_mult_lv6:   1.8,                  // 2026-05-25 2.5→1.8：地上版と同期
    kb_vx_decay_lv6:  0.92,
    hitColor:     0x44aaff,                 // 高温の青炎
    hitCount:     44,
    hitboxColor:  0x44aaff,                 // showHitbox の AABB も青に
    launcher:     false,
    aerialHop:    true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    // 攻撃発生時の自己ノックバック（大反動・地上版と同じ・2026-05-18）
    selfRecoilVx: 32,
    selfRecoilDecay: 0.82,
  },
};

// ============================================================
//  #section attack-attrs — 攻撃属性テーブル / Z_CHAIN / A_CHAIN
//  技の attrGroup フィールドで参照する。
//  個別フィールドが attrGroup と重複する場合は個別フィールドが優先。
// ============================================================
export const ATTACK_ATTRS = {
  // 打ち上げコンボ：敵を垂直に浮かせ→頂点でスロー→キャンセルジャンプで追撃
  LAUNCH_COMBO: {
    launcher:  true,   // プレイヤーのキャンセルジャンプ許可
    peakHang:  true,   // 敵が頂点付近でスロー（「今がチャンス」演出）
  },
  // ─── 将来の属性枠組み ──────────────────────────────────────
  // SLAM:        { slamWave: true },             // 叩きつけ → 地面衝撃波
  // GUARD_BREAK: { breakGuard: true },           // ガードブレイク
  // FIRE_DOT:    { dot: true, element: 'fire' }, // 燃焼DoT（METEO属性）
};

// attrGroup を解決して実効フラグを返す（個別フィールドが優先）
export function resolveAttackAttr(attack) {
  if (!attack.attrGroup) return attack;
  return Object.assign({}, ATTACK_ATTRS[attack.attrGroup] ?? {}, attack);
}

// 多段ヒット技の「ヒットウィンドウ終端フレーム」を返す（hitFrame からの相対）
//   単発：hitFrame + hitDuration
//   多段：hitFrame + (multiHitCount-1) × hitInterval + hitDuration
//   ビジュアル（パーツアニメ・赤ボックス）の表示期間に使う
export function getHitWindowEnd(atk) {
  if (atk.isMultiHit) {
    const count = atk.multiHitCount ?? 1;
    const interval = atk.hitInterval ?? 6;
    return atk.hitFrame + (count - 1) * interval + (atk.hitDuration ?? 4);
  }
  return atk.hitFrame + (atk.hitDuration ?? 4);
}

// 地上 J チェーン：c01_atk_01 → 02 → 03 → 04（K 系は単独・チェーン外）
export const Z_CHAIN = ['c01_atk_01', 'c01_atk_02', 'c01_atk_03', 'c01_atk_04'];
// 空中 J チェーン：c01_atk_01_air → 02_air → 03_air（ジャンプ中 or キャンセルジャンプ後）
export const A_CHAIN = ['c01_atk_01_air', 'c01_atk_02_air', 'c01_atk_03_air'];
