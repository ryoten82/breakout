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
//  値はランタイムで SB.ATTACKS.c01_atk_s_01.damage = ... のように調整可能
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
//    kb_vy_lv5 / kb_vy_lv6 / kb_vx_mult_lv*           : 被弾ベクトル上書き（lv 別）
//    isSpecial / isStepAttack / showHitbox            : 系統フラグ
//    hitColor / hitCount / hitstop / shake / partsAnim : 演出
// ============================================================
export const ATTACKS = {
  c01_atk_s_01: {
    label:        'c01_atk_s_01 (METEO 左ジャブ)',
    duration:     16, hitFrame: 6, hitDuration: 4, cancelWindow: 14,
    damage:       6,
    rangeX:       110, rangeZ: 110, rangeY: 80,   // 胸高さまで
    knockback:    9, hitstop: 3, shake: 2,         // 6→9（J コンボ全弾 1.5x：間合い詰まり対策・J 連打無限コンボ抑止）
    atk_lv:       1,
    partsAnim:    'punch_l',
  },
  c01_atk_s_02: {
    label:        'c01_atk_s_02 (METEO 右ストレート)',
    duration:     16, hitFrame: 6, hitDuration: 4, cancelWindow: 14,
    damage:       7,
    rangeX:       115, rangeZ: 110, rangeY: 80,   // 胸高さまで
    knockback:    12, hitstop: 4, shake: 3,        // 8→12（1.5x）
    atk_lv:       1,
    partsAnim:    'punch_r',
  },
  c01_atk_s_03: {
    label:        'c01_atk_s_03 (METEO 回し蹴り)',
    duration:     22, hitFrame: 9, hitDuration: 5, cancelWindow: 16,
    damage:       12,
    rangeX:       130, rangeZ: 120, rangeY: 110,  // 蹴りは少し高めまで
    knockback:    21, hitstop: 6, shake: 5,        // 14→21（1.5x）
    atk_lv:       1,
    partsAnim:    'kick',
  },
  c01_atk_s_04: {
    label:        'c01_atk_s_04 (METEO 旋回アッパー・フィニッシャー)',
    duration:     24, hitFrame: 10, hitDuration: 5, cancelWindow: 16,
    damage:       14,
    rangeX:       135, rangeZ: 125, rangeY: 140,  // 旋回アッパー：頭上付近まで
    knockback:    60, hitstop: 7, shake: 6,        // 40→60（1.5x）
    atk_lv:       2,                      // フィニッシャー：地上は knockback02
    atk_lv_air:   3,                      // 空中敵には吹き飛び（down_front_*）
    partsAnim:    'spin_upper',
  },
  // === 空中弱攻撃（METEO） ===
  c01_atk_s_01_air: {
    label:        'c01_atk_s_01_air (METEO 空中ジャブ)',
    duration:     14, hitFrame: 5, hitDuration: 3, cancelWindow: 12,
    damage:       5,
    rangeX:       145, rangeZ: 120, rangeY: 110, rangeYDown: 260,   // PHYSICS.AERIAL_RANGE_Y=110 をリテラル化
    knockback:    5, hitstop: 3, shake: 2,         // 3→5（1.5x 切り上げ）
    aerialHop:    true,
    atk_lv:       1,
    partsAnim:    'air_punch_l',
  },
  c01_atk_s_02_air: {
    label:        'c01_atk_s_02_air (METEO 空中蹴り)',
    duration:     16, hitFrame: 6, hitDuration: 3, cancelWindow: 13,
    damage:       7,
    rangeX:       145, rangeZ: 120, rangeY: 120, rangeYDown: 270,   // PHYSICS.AERIAL_RANGE_Y(110)+10
    knockback:    8, hitstop: 4, shake: 3,         // 5→8（1.5x 切り上げ）
    aerialHop:    true,
    atk_lv:       1,
    partsAnim:    'air_kick',
  },
  c01_atk_s_03_air: {
    label:        'c01_atk_s_03_air (METEO 空中Jコンボ3発目・フィニッシャー)',
    duration:     18, hitFrame: 7, hitDuration: 4, cancelWindow: 14,
    damage:       10,
    rangeX:       145, rangeZ: 120, rangeY: 130, rangeYDown: 280,   // PHYSICS.AERIAL_RANGE_Y(110)+20
    knockback:    80,             // 26 → 32 → 48 → 80（空中フィニッシャー：地上 J へ吸い込み防止）
    aerialHop:    true,           // 空中Jコンボ全体で同じ量のホップ（c01_atk_s_01_air / 02_air と統一）
    atk_lv:       2,              // 地上敵：強攻撃フリンチ（knockback02）
    atk_lv_air:   3,              // 空中敵：吹き飛び（down_front_start）
    hitstop:      7, shake: 6,
    hitColor:     0xffee44,       // Z チェーンと同じ黄色（払いと混同しないよう氷系シアンから戻し）
    hitCount:     32,             // フィニッシャー強調：通常の Z 弱攻撃より多めの粒数（旧 18 → 32）
    partsAnim:    'air_slam',
    particleType: 'normal',       // 前方放射パーティクル
  },
  // === 強攻撃 K（キャラ別）===
  // 仕様: METEO の強攻撃 — ダウンなし・キャラ約1体分のノックバック
  c01_atk_l_01: {
    label:        'c01_atk_l_01 (METEO 強攻撃)',
    duration:     28, hitFrame: 12, hitDuration: 5, cancelWindow: 18,
    damage:       20,
    rangeX:       145, rangeZ: 120, rangeY: 130,  // 上半身高さまで
    knockback:    75,  // ★ キャラ約1体分の距離（c01_atk_s_03=14 の約2倍）
    hitstop:      9, shake: 7,
    hitColor:     0xff6622,
    hitCount:     22,
    atk_lv:       2,
    partsAnim:    'strong_punch_r',
    launcher:     false,
  },
  // 仕様: METEO 打ち上げ攻撃 — Jチェーン中 ↑+K で発動・launcher:true → キャンセルジャンプ可
  c01_atk_l_01_up: {
    // ★旧称：打ち上げ K。lv02 軽フリンチ + knockbackY=12 で軽く浮かせるだけのコンボ始動技に変更（2026-05-14）
    //   強い打ち上げは sp_02 系へ移管済
    label:        'c01_atk_l_01_up (METEO ↑+K・軽浮かせコンボ始動)',
    duration:     26, hitFrame: 10, hitDuration: 4, cancelWindow: 16,
    damage:       18,
    rangeX:       115, rangeZ: 110, rangeY: 180,  // 上方向リーチは維持（浮いた敵にも届く）
    knockback:    14,               // 水平ノックバック（facing 方向）
    knockbackY:   12,               // 上昇ノックバック（軽浮かせ・lv02 状態 + vy）
    lungeVx:      9,                // 踏み込み初速（facing 方向）— 当てに行く前進
    lungeDecay:   0.82,             // フレーム減衰（9 → 約 0.05 まで 23F・総距離 ≒ 50wu）
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
  // 仕様: METEO 空中強攻撃 — 空中で K を押すと発動（地上Kと別の独立技）
  // 下方向の当たり判定を大きく取り、地上敵を空中から殴れる
  c01_atk_l_01_air: {
    label:        'c01_atk_l_01_air (METEO 空中強攻撃)',
    duration:     24, hitFrame: 10, hitDuration: 5, cancelWindow: 16,
    damage:       18,
    rangeX:       145, rangeZ: 135, rangeY: 110, rangeYDown: 260,
    knockback:    42,                // 24 → 42（中程度追加・吹き飛ばし感UP）
    hitstop:      9, shake: 7,
    aerialHop:    true,              // 空中Jと同じ量のホップ（AERIAL_HOP_V）
    atk_lv:       3,                 // 地上敵：吹き飛び（down_front_start）
    atk_lv_air:   3,                 // 空中敵も吹き飛び（超吹き飛ばしは sp_01_air に移管）
    // ※ lv06 用 kb_vy / kb_vx_mult / kb_vx_decay は撤去（移管元の sp_01_air が
    //    自身の kb_vy_lv6 / kb_vx_mult_lv6 / kb_vx_decay_lv6 で持つようになったため）
    hitColor:     0xff9944,          // 地上K(0xff6622)より明るいオレンジ（差別化）
    hitCount:     22,
    partsAnim:    'strong_punch_r',  // 当面は地上Kと共用（将来 air_strong_punch に分離）
    launcher:     false,
  },
  // 仕様: METEO 空中急降下踏みつけ — 空中で ↓+K 発動。発動瞬間に真下へ急降下
  c01_atk_l_01_air_down: {
    label:        'c01_atk_l_01_air_down (METEO 空中急降下・↓+K・連続ヒット)',
    // === 連続ヒット化:ドリル踏みつけ → 最終で叩きつけ ===
    // 旧来は単発で頭に当たって即バウンドする見栄えだった
    // 3 段：frame 8 / 12 / 16（hitInterval=4）。最終ヒットで atk_lv 5 → down_rakka_start
    // 中間 2 発は knockback01 軽フリンチ（位置維持）、最終で kb_vy=-45 の強叩きつけ発動
    duration:     24, hitFrame: 8, hitDuration: 6, cancelWindow: 16,
    isMultiHit:     true,
    multiHitCount:  3,
    hitInterval:    4,
    damagePerHit:   4,
    damageLastHit:  8,
    damage:         16,            // 互換用：4+4+8 = 16（旧と同じ総ダメージ）
    intermediateKnockbackVx: 0,    // ドリル特性：水平移動させず真下で複数ヒット
    intermediateKbDecay:     0.78,
    rangeX:       145, rangeZ: 135,
    rangeY:       60,              // 上方向は小さめ（踏みつけ想定）
    rangeYDown:   300,             // 下方向は大きく（急降下からの踏みつけ）
    knockback:    20,
    hitstop:      8, shake: 6,
    diveVy:       -22,             // ホバー後に適用する急降下速度
    divePause:    12,              // 急降下前の空中停止フレーム数（≈0.2秒）
    aerialHop:    false,
    atk_lv:       5,               // 叩きつけ
    atk_lv_air:   5,               // 空中敵も同じ（明示・down_rakka_start に飛ばす）
    atk_lv_down:  5,               // ダウン中の敵も同じ（明示・down_bound_start に飛ばして拾い直し可能）
    // === lv05 ベクトル個別上書き：すごい勢いで地面にたたきつける（最終ヒットでのみ発動）===
    // 既定 KB_LV05_VY=-18 / KB_LV05_VX_MULT=0.1 を 2.5 倍に強化
    kb_vy_lv5:        -45,         // 下向き初速 2.5 倍（KB_LV05_VY * 2.5）
    kb_vx_mult_lv5:   0.1,         // 水平は据え置き（真下落下を維持）
    omni:         true,            // 全方向ヒット（踏みつけ性質）
    launcher:     false,
    hitColor:     0xff4422,
    hitCount:     18,
    partsAnim:    'air_slam',
  },
  // 仕様: METEO 払い攻撃 — ↓+K で発動（単体可・Jチェーンからも可）
  // 当たり判定：足元中心・全方向・地面スライスのみ（浮き敵には当たらない）
  c01_atk_l_01_down: {
    label:        'c01_atk_l_01_down (METEO 払い・↓+K)',
    duration:     20, hitFrame: 8, hitDuration: 4, cancelWindow: 14,
    damage:       14,
    rangeX:       155, rangeZ: 150,
    rangeY:       35,              // 足元の薄いスライス（地面の敵だけ拾う）
    knockback:    8,
    hitstop:      6, shake: 4,
    hitColor:     0xaaddff,
    hitCount:     12,
    launcher:     false,
    omni:         true,            // 前方限定を外す（全方向ヒット）
    atk_lv:       1,               // 通常時：軽フリンチ knockback01
    atk_lv_air:   1,               // 空中敵も同じ（明示）
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
    hitstop:      12, shake: 16,
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
    hitstop:      6, shake: 8,
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
  c01_atk_s_01_step: {
    label:        'c01_atk_s_01_step (METEO ステップJ・スライディング)',
    duration:     20, hitFrame: 7, hitDuration: 4, cancelWindow: 14,
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
    momentumDecay: 0.97,             // 「ズザー」と滑り込む強い慣性
    tiltX:        -1.40,             // ≈ -80°（ほぼ水平・後ろ倒し）
  },
  c01_atk_l_01_step: {
    label:        'c01_atk_l_01_step (METEO ステップK・ショルダータックル・連続ヒット)',
    duration:     28, hitFrame: 8, hitDuration: 5, cancelWindow: 0,
    // === 連続ヒット技：軌道上の敵を多段ヒット（巻き込み）===
    // hits at frame 8 / 13 / 18（hitInterval=5 × multiHitCount=3）
    // 中間 2 発：damagePerHit / 最終 1 発：damageLastHit + atk_lv 3 で吹き飛ばし
    isMultiHit:     true,
    multiHitCount:  3,
    hitInterval:    5,
    damagePerHit:   5,
    damageLastHit:  12,
    damage:         22,             // 互換用（最終ヒットが上書きするので参照されない）
    rangeX:       160, rangeZ: 90, rangeY: 180,
    knockback:    80, hitstop: 10, shake: 9,
    atk_lv:       3,
    atk_lv_air:   3,
    hitColor:     0xff8844,
    hitCount:     22,                // パーティクル数（多段時は中間 1 ヒットあたり半量）
    launcher:     false,
    aerialHop:    false,
    partsAnim:    'tackle',
    isStepAttack: true,
    momentumDecay: 0.96,
    tiltX:        +0.45,             // ≈ +26°（前傾タックル）
    noCancelOnHit: true,             // ヒットしても hit_confirm に入らず即 wait01
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
    label:        'c01_sp_01 (METEO 波動コマンド・弱ビーム・連続ヒット)',
    duration:     30, hitFrame: 14, hitDuration: 6, cancelWindow: 14,
    // === 連続ヒット：3 段（フレーム 14 / 19 / 24）===
    // ビームの「ジリジリ」感を多段で表現。最終ヒットで吹き飛び（atk_lv 3）
    isMultiHit:     true,
    multiHitCount:  3,
    hitInterval:    5,
    damagePerHit:   4,    // 中間 2 発：軽フリンチ + 4 ダメ
    damageLastHit:  10,   // 最終 1 発：10 ダメ + atk_lv 3 dispatch
    damage:         18,   // 互換用（4×2 + 10 = 18 総合・旧 16 から微増）
    rangeX:       250, rangeZ: 80, rangeY: 100,
    knockback:    50, hitstop: 8, shake: 6,
    atk_lv:       3,    // 地上敵：吹き飛び（down_front_start）
    atk_lv_air:   3,    // 空中敵も吹き飛び
    // atk_lv_down は撤去（ダウン中ヒットは標準の空振り扱いに戻す）
    hitColor:     0x44ccff,
    hitCount:     24,
    launcher:     false,
    partsAnim:    'strong_punch_r',  // 流用（将来 beam_thrust に分離）
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
  },
  // 空中版：斜め下方向に発射。rangeY を絞って rangeYDown を大きく取る非対称 hitbox。
  // METEO 固有の挙動（VIPER 等は別の傾向にする予定）。pickSpecialAttackId で地上/空中を分岐
  c01_sp_01_air: {
    label:        'c01_sp_01_air (METEO 波動コマンド・空中版・パイルバンカー連続ヒット)',
    duration:     26, hitFrame: 10, hitDuration: 6, cancelWindow: 14,
    // === 連続ヒット：3 段（フレーム 10 / 14 / 18）===
    // パイルバンカーの「ドリル」感を多段で表現。最終ヒットで叩きつけ or 超吹き飛ばし
    isMultiHit:     true,
    multiHitCount:  3,
    hitInterval:    4,    // ドリル感のためインターバル短め
    damagePerHit:   4,
    damageLastHit:  8,    // 最終 1 発：8 ダメ + atk_lv 5/6 dispatch
    damage:         16,   // 互換用（4×2 + 8 = 16 総合・旧 14 から微増）
    rangeX:       220, rangeZ: 90,
    rangeY:       30,       // 上方向は薄く
    rangeYDown:   260,      // 下方向は大きく（斜め下射撃の表現）
    knockback:    45, hitstop: 8, shake: 6,
    atk_lv:       5,        // 地上敵：叩きつけ → バウンド（距離は開くがフレーバー優先・カッコよさ重視）
    atk_lv_air:   6,        // 空中敵：超吹き飛ばし（c01_atk_l_01_air から移管）
    // atk_lv_down は撤去
    // === lv 別ベクトル上書き（dispatcher で kb_*_lv5 / kb_*_lv6 を個別参照）===
    // lv6（空中敵 → 超吹き飛ばし）：後方斜め下に叩きつけ・ほぼ一直線軌道
    kb_vy_lv6:        -10,
    kb_vx_mult_lv6:   5.0,
    kb_vx_decay_lv6:  0.92,
    // lv5（地上敵 → 叩きつけ）：少し前に落とすくらい・距離は開くがフレーバー
    kb_vy_lv5:        -8,    // 軽い下向き（既定 -18 より弱め）
    kb_vx_mult_lv5:   0.5,   // 水平を抑える（既定 0.1 よりは前進・既定 2.5 よりは抑制）
    hitColor:     0x44ccff,
    hitCount:     22,
    launcher:     false,
    // 攻撃発生フレームで後方斜め上にホップ（パイルバンカー射出の反動表現）
    // 空中コンボの締めとして「後方に下がって距離を取る」イメージ
    aerialHop:    true,
    aerialHopVy:  14,       // 上昇成分（通常 AERIAL_HOP_V=9 より少し強め）
    aerialHopVx:  -10,      // 後方成分（負値 = facing と逆方向へ反動）
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
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
    knockback:    10, hitstop: 7, shake: 6,
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
    aerialHop:    true,
    aerialHopVy:  16,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
  },
  // 空中版：単発打ち上げ（多段は触感的に苦しかったため単発化・2026-05-14）
  //   ヒットストップは重め維持で必殺技コマンド入力余地を確保
  //   plyrLiftVy は遅延発動：ヒット時にはまだ上昇していないので低空で敵を捉えられる
  //   ヒット後（frame 12）に追加上昇 → 「単発で当てて、その後昇る」絵
  c01_sp_02_air: {
    label:        'c01_sp_02_air (METEO 対空コマンド・空中版・単発)',
    duration:     14, hitFrame: 6, hitDuration: 6, cancelWindow: 4,
    damage:       25,
    rangeX:       110, rangeZ: 100, rangeY: 200,
    knockback:    10, hitstop: 12, shake: 7,    // hitstop 重め（コマンド入力余地）
    atk_lv:       4,
    atk_lv_air:   4,
    launchVy:     22,
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44,
    hitCount:     22,
    // === 構造：plyrLiftVx 即時 / plyrLiftVy 遅延 ===
    plyrLiftVx:       14,             // 即時 airVx で前進ドリフト
    plyrLiftVy:       16,             // 24→16：空中追加上昇は控えめに（既に空中スタートのため）
    plyrLiftVyDelay:  12,             // ヒット後（frame 6-11 終了直後）に上昇開始
    aerialHop:    true,
    aerialHopVy:  16,                 // 24→16：ヒット時のホップも控えめ
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
  },
  c01_sp_03: {
    label:        'c01_sp_03 (METEO 溜め・チャージパンチ・地上版)',
    duration:     36, hitFrame: 16, hitDuration: 6, cancelWindow: 16,
    damage:       28,
    rangeX:       360, rangeZ: 130,    // 180→360：単発・中距離まで届く重い 1 撃（多段ばかりにしないバランス役）
    rangeY:       130,    // 上方向：頭上〜浮いた敵まで
    rangeYDown:   30,     // 下方向は足元のみ（旧 viz の見た目に合わせて下判定を絞る）
    knockback:    60, hitstop: 12, shake: 10,
    atk_lv:       3,
    atk_lv_air:   3,
    // atk_lv_down は撤去
    hitColor:     0xff4422,
    hitCount:     30,
    launcher:     false,
    aerialHop:    true,  // 空中で発動・ヒット時は通常空中技と同じホップ（AERIAL_HOP_V）
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
  },
  // 空中版：地上版とほぼ同等の触感で、空中で J 長押し→離しでディスパッチされる
  c01_sp_03_air: {
    label:        'c01_sp_03_air (METEO 溜め・チャージパンチ・空中版)',
    duration:     36, hitFrame: 16, hitDuration: 6, cancelWindow: 16,
    damage:       28,
    rangeX:       360, rangeZ: 130,    // 180→360：空中版も中距離まで（地上版と同調）
    rangeY:       130,
    rangeYDown:   30,     // 空中版も下判定は絞る（地上版に合わせる）
    knockback:    60, hitstop: 12, shake: 10,
    atk_lv:       3,
    atk_lv_air:   3,
    // atk_lv_down 無し
    hitColor:     0xff4422,
    hitCount:     30,
    launcher:     false,
    aerialHop:    true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
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

// 地上 J チェーン：c01_atk_s_01 → 02 → 03 → 04（K 系は単独・チェーン外）
export const Z_CHAIN = ['c01_atk_s_01', 'c01_atk_s_02', 'c01_atk_s_03', 'c01_atk_s_04'];
// 空中 J チェーン：c01_atk_s_01_air → 02_air → 03_air（ジャンプ中 or キャンセルジャンプ後）
export const A_CHAIN = ['c01_atk_s_01_air', 'c01_atk_s_02_air', 'c01_atk_s_03_air'];
