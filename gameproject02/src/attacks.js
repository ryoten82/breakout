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
    duration:     60, hitFrame: 32, hitDuration: 10, cancelWindow: 10,
    // 2026-05-28 弱体化：MAGMA VENT OC 前提で本体は軽め。
    //   atk_lv 5→2（rakka_start バウンド廃止）/ damage 20→10 / knockback 32→14
    damage:       10,
    rangeX:       288, rangeZ: 224,
    rangeY:       50,
    rangeYDown:   20,
    knockback:    14,
    hitstop:      8, shake: 10,
    atk_lv:       3,
    atk_lv_air:   3,
    atk_lv_down:  7,                  // 2026-05-28: ダウン中は拾い（knockback03 + 小バウンド）
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
    // 2026-05-28 弱体化：本体軽量化。dive 中の hit は擦るだけで、本命は着地ゲイザー（c01_sp_03_land）。
    damage:       6,
    rangeX:       145, rangeZ: 130,
    rangeY:       60,
    rangeYDown:   300,
    knockback:    8,
    hitstop:      6,  shake: 6,
    diveVy:       -22,
    divePause:    16,
    atk_lv:       3,
    atk_lv_air:   3,
    atk_lv_down:  7,
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
    // 2026-05-28 弱体化：地上 SP3 と揃える。
    damage:       10,
    rangeX:       288, rangeZ: 224,
    rangeY:       50,
    rangeYDown:   20,
    knockback:    14,
    hitstop:      8, shake: 10,
    atk_lv:       3,
    atk_lv_air:   3,
    atk_lv_down:  7,
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
  // ── OC CHN-e01「飛び上がり SP3」（2026-05-28 新規）───────────────────
  // チェーン軸 SP3 完全置換 OC。SP3 を「自機 leap up + 多段ヒット + 最終段 launcher」に再設計し、
  // 空中コンボの起点 / 締めに使えるようにする。粉塵昇竜（c01_sp_02）の SP3 版イメージ。
  //   - 自機は plyrLiftVy で leap up
  //   - 3 ヒット（中間2 + launcher1）の multi-hit
  //   - 最終ヒットで打ち上げ（launcher / launchVy）
  // OC CHN-e01「飛び上がり SP3」(2026-05-28 ユーザー仕様確定)：
  //   フレーム構成（2 ヒット 2 フェーズ）：
  //     frame  1- 5  : 屈み（windup・無敵動作なし）
  //     frame  5     : plyrLiftVy/Vx 起動 → 前方ジャンプ離地
  //     frame  6     : hitFrame = 上り際に膝蹴り（1 ヒット）
  //     frame 14     : diveStartFrame → vy = 0 で divePause 開始（空中静止）
  //     frame 14-22  : 8F ホバー
  //     frame 22+    : diveVy = -28 で前方の地面に急降下
  //     着地瞬間     : autoLandGeyser → c01_sp_03_land 自動発火（腕叩きつけ + 衝撃波・既存資産再利用）
  c01_sp_03_leap: {
    label:        'c01_sp_03_leap (METEO CHN-e01・飛び上がり SP3・前ジャンプ + 膝 + 急降下)',
    // 2026-05-28: バースト対策：3 段（膝→body→着地衝撃波）を 1 技として括る → c01_sp_03 ベースに統合。
    //   これで連発時に同 base 重複ヒット扱いで burst トリガされる事故を防ぐ。
    baseSpecialId: 'c01_sp_03',
    duration:     120,                  // 2026-05-29: 60→120 高高度発動で attack 終了前に着地→autoLandGeyser 確実発火
    hitFrame: 6, hitDuration: 5,
    cancelWindowStart: 14,  // 頂上付近以降のみ別 SP キャンセル可（疑似空中ジャンプ用途）
    cancelWindow: 8,
    facingLockFrames: 30,               // 2026-05-29: duration+40=160F の振り向き lock が長すぎ → 30F に短縮（連射時の方向転換許可）
    damage:       8,
    rangeX:       140, rangeZ: 110, rangeY: 200,
    knockback:    40,   // 2026-05-28: 14→28→40（敵を後方に強く押す・通り抜け抑止）
    hitstop:      6, shake: 5,
    atk_lv:       3,                  // 膝蹴り：中フリンチ
    atk_lv_air:   3,
    // 2026-05-29: ダウン中の敵にも当たる（lv 7 拾い）= 連発時に「最初の打ち上げが downed 敵に当たらない」事故防止。
    //   ユーザー spec の "-" を再解釈：ダウン中無視ではなく、拾い直して chain 継続させる。
    atk_lv_down:  7,
    // === 軽打ち上げ + peakHang で敵を浮かせて 2 段目に繋ぐ（2026-05-28）===
    // launchVy 設定で hit-engine 側が atk_lv より優先して down_up_start 経路を取り、敵を浮かせる。
    // attrGroup: 'LAUNCH_COMBO' で peakHang フラグ立て → 頂点付近で ENEMY_PEAK_HANG_DEPTH まで重力減衰。
    launchVy:     18,                  // 2026-05-28: 10→18（高さアップ・滞空時間延長）
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    // === Phase 1：前方ジャンプ離地（自機高めに飛ばして 2 段目を追いつかせる）===
    plyrLiftVy:       30,              // 2026-05-28: 22→30（敵の上昇に追いつくため自機も高く）
    plyrLiftVyAir:    20,              // 2026-05-28: 空中発動時は控えめに（地面が遠くなって bound 接続が崩れるのを防ぐ）
    plyrLiftVyDelay:  5,
    plyrLiftVx:       7,
    // === Phase 2：頂点付近で空中静止 → 急降下（diveVx で前方推進あり：真下落下回避）===
    diveStartFrame:   14,
    divePause:        23,
    diveVy:           -42,
    diveVyAir:        -28,             // 2026-05-29: 空中発動時は急降下を控えめに（速すぎ対策）
    diveVx:           26,              // 地上版：bound 後の追い打ち距離確保
    diveVxAir:        18,              // 2026-05-29: 空中版は控えめ（追い抜き防止・敵 KB 減衰と同期）
    // === Phase 2.5：dive 中の自機本体に当たり判定（atk_lv 3/3/-）===
    bodyHitFrame:     38,              // diveStartFrame 14 + divePause 23 + 1F = 急降下開始直後
    bodyHitDuration:  60,              // 高高度発動時も着地までカバー（空中マルチヒット用に長め）
    bodyDamage:       8,
    bodyKnockback:    36,
    bodyRangeX:       140, bodyRangeY: 180, bodyRangeZ: 110,
    bodyAtkLv:        3,
    bodyAtkLvAir:     3,
    bodyHitColor:     0xff8822,
    bodyHitCount:     12,
    bodySingleTarget: true,
    // 地上発動：1 ヒットのみ / 空中発動：最大 3 ヒット連発で敵をロック（高高度発動 → 着地までの距離を埋める）
    bodyMaxHits:      1,
    bodyMaxHitsAir:   3,
    bodyHitInterval:  6,               // 6F おきに次ヒット判定（最大 18F 分連続）
    // === Phase 3：着地で衝撃波（leap 専用版・magmaVent 無し）===
    autoLandGeyser: true,
    autoLandGeyserId: 'c01_sp_03_leap_land',  // 標準の c01_sp_03_land ではなく専用版（magmaVentTrigger 無し）
    aerialHop:    false,
    cancelToAirJ: false,
    hitColor:     0xff8822,
    hitCount:     14,
    partsAnim:    'air_slam',          // 空中急降下と同系アニメ
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    // 膝蹴り部分は frontal 軸（前方突き出し的なヒット形）
    repulseAxis:  'frontal',
    repulseFrameStart: 1, repulseFrameEnd: 14,
    // パリィ判定は入力直後に広く（飛び込みを跳躍 frame5 前に捉えてキャンセル＝技が出ちゃう見た目を防ぐ）。
    repulseBox:   { offsetX: 120, offsetY: 250, w: 800, h: 800, d: 400 },
  },
  // c01_sp_03_leap_land: leap SP3 専用の着地衝撃波（c01_sp_03_land の派生・magmaVent 無し）
  //   ユーザー指定 atk_lv 5/5/7（叩きつけ + ダウン中拾い）
  c01_sp_03_leap_land: {
    label:        'c01_sp_03_leap_land (METEO CHN-e01 leap 専用着地衝撃波)',
    baseSpecialId: 'c01_sp_03',  // 2026-05-28: leap の 3 段目もまとめて c01_sp_03 base 扱い（バースト対策）
    duration:     30, hitFrame: 0, hitDuration: 14, cancelWindow: 8,
    damage:       12,
    // 2026-05-29: body hit の強 KB で敵が範囲外まで押し出される事故への対策で X 範囲拡張（173→240）。
    //   60% 縮小指示は維持しつつ、forceBoundDown 接続を優先。
    rangeX:       240, rangeZ: 160,
    rangeY:       180,                 // 浮いた敵も拾える上方向に拡張（旧 50）
    rangeYDown:   60,
    knockback:    20,
    hitstop:      8, shake: 10,
    atk_lv:       5,
    atk_lv_air:   5,
    atk_lv_down:  7,
    kbRadial:     true,
    omni:         true,
    launcher:     false,
    aerialHop:    false,
    hitColor:     0xff8822,
    hitCount:     28,
    shockwaveEffect: true,
    forceBoundDown: true,   // 2026-05-28: state を問わず必ず down_bound_start に統一（叩きつけ → バウンド演出）
    isSpecial:    true,
    flashOnStart: false,
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
  // ── OC CHN-e02「SP1 連打多段」（2026-05-29 新規）─────────────────────
  //   SP1 を「再入力で伸びるチェーン」に置換。最大 3 段（chn1→chn2→chn3）。
  //   1〜2 段目＝軽リアクション（atk_lv2 のけぞり）、3 段目＝重（atk_lv5・飛距離抑え→転がりダウン）。
  //   地上/空中ともに同 def（air も 3 段）。再入力はヒット時のみ伸びる（canStartSpecial の hitDelivered）。
  //   baseSpecialId: c01_sp_01 で出し切りを 1 SP1 として burst 括り。値は仮（playtest 調整前提）。
  c01_sp_01_chn1: {
    label:        'c01_sp_01_chn1 (METEO CHN-e02・連打 SP1・1段目 軽)',
    baseSpecialId: 'c01_sp_01',
    duration:     54, hitFrame: 24, hitDuration: 6, cancelWindow: 18,   // 1発目だけ発生 +17F（溜め感・段階追加）
    cancelWindowStart: 28,   // 判定(24)後 4F でキャンセル窓
    damage:       7,
    rangeX:       230, rangeZ: 170, rangeY: 110,
    knockback:    16, hitstop: 6, shake: 5,
    atk_lv:       2, atk_lv_air: 2,   // 軽リアクション（のけぞり・その場保持で追撃可）
    hitColor:     0x44ccff, hitCount: 16,
    launcher:     false, aerialHop: false,
    lungeVx:      18, lungeDecay: 0.85, lungeDelay: 9,
    windupBackVx: 7,    // 発生前に少しだけ後ろへ引く → lungeDelay で前へ踏み込み判定を出す（1発目の予備動作）
    targetOvershootGuard: true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    repulseAxis:  'frontal', repulseFrameStart: 1, repulseFrameEnd: 18,
    repulseBox:   { offsetX: 280, offsetY: 150, w: 560, h: 380, d: 200 },
  },
  c01_sp_01_chn2: {
    label:        'c01_sp_01_chn2 (METEO CHN-e02・連打 SP1・2段目 軽)',
    baseSpecialId: 'c01_sp_01',
    duration:     37, hitFrame: 7, hitDuration: 6, cancelWindow: 18,
    cancelWindowStart: 17,   // 判定(7)後 10F でキャンセル窓
    damage:       8,
    rangeX:       230, rangeZ: 170, rangeY: 110,
    knockback:    16, hitstop: 6, shake: 5,
    atk_lv:       2, atk_lv_air: 2,
    hitColor:     0x55ddff, hitCount: 16,
    launcher:     false, aerialHop: false,
    lungeVx:      18, lungeDecay: 0.85, lungeDelay: 8,
    targetOvershootGuard: true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    repulseAxis:  'frontal', repulseFrameStart: 1, repulseFrameEnd: 18,
    repulseBox:   { offsetX: 280, offsetY: 150, w: 560, h: 380, d: 200 },
  },
  c01_sp_01_chn3: {
    label:        'c01_sp_01_chn3 (METEO CHN-e02・連打 SP1・最終 重・atk_lv6 超吹っ飛ばしだが真後ろに飛ばず早々に転がりダウン)',
    baseSpecialId: 'c01_sp_01',
    duration:     46, hitFrame: 13, hitDuration: 7, cancelWindow: 14,   // 3発目だけ発生 +4F
    cancelWindowStart: 23,   // 判定(13)後 10F でキャンセル窓
    damage:       16,
    rangeX:       240, rangeZ: 170, rangeY: 120,
    knockback:    40, hitstop: 17, shake: 14,   // 重め：hitstop 増し（atk_lv6 で敵キャラシェイクも自動付与）
    atk_lv:       6, atk_lv_air: 6,   // 超吹っ飛ばし（down_super → 着地 down_roll）。atk_lv_down は無し（-）
    // lv6 軌道上書き：真後ろに大きく飛ばさず、低く弾いて早々に着地→転がりダウン。
    kb_vy_lv6:        5,      // 軽く浮く程度（高アーク禁止＝早く落ちて roll へ）
    kb_vx_mult_lv6:   0.4,    // 水平を抑える＝飛距離を出さない
    kb_vx_decay_lv6:  0.86,   // 早めに減速
    hitColor:     0x66ddff, hitCount: 34,
    launcher:     false, aerialHop: false,
    lungeVx:      26, lungeDecay: 0.84, lungeDelay: 6,   // ぐいぐい前へ押し込み追尾（自機も移動距離・selfRecoil 無し）
    partsAnim:    'strong_punch_r',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    repulseAxis:  'frontal', repulseFrameStart: 1, repulseFrameEnd: 20,
    repulseBox:   { offsetX: 300, offsetY: 150, w: 600, h: 400, d: 200 },
  },
  // ── CHN-e02 空中版（2026-05-29）：テンポ/手触りは地上と同じ。発動の度お互い少し上にホップ（空中Jコンボ感）。
  //   最終段だけ強め：敵=まっすぐ斜め下に超吹っ飛び（atk_lv6・下方向＋横）／自機=真上にふわっと浮上。
  c01_sp_01_chn1_air: {
    label:        'c01_sp_01_chn1_air (METEO CHN-e02 空中・1段目 軽・お互い小ホップ)',
    baseSpecialId: 'c01_sp_01',
    duration:     54, hitFrame: 24, hitDuration: 6, cancelWindow: 18,   // 地上版と同テンポ
    cancelWindowStart: 28,
    damage:       7,
    rangeX:       230, rangeZ: 170, rangeY: 120, rangeYDown: 280,
    knockback:    14, hitstop: 6, shake: 5,
    atk_lv:       2, atk_lv_air: 2,
    // ↑J（c01_add_02）方式：launchVy/launcher を使わず knockbackY で軽く浮かせる。
    //   launchVy 経路は spawnLaunchSmoke + 'launch' パーティクルを撒いてエフェクト過剰になるため不採用（2026-05-30）。
    //   knockbackY 経路なら敵は knockback02（軽フリンチ）のまま小ホップ。さらに launchVy 不在で
    //   AERIAL_Y_PULL（敵をプレイヤー Y へ引き寄せ）が有効化され、地上敵でも 2 段目以降が高度同期して繋がる。
    launcher:     false, knockbackY: 9,   // AERIAL_HOP_V(9) と同値＝お互い小ホップ
    hitColor:     0x44ccff, hitCount: 16,
    airGravFactor: 0.25,   // 空中チェーン中フワッと滞空（着地はしないが浮きすぎない）
    aerialHop:    true, aerialHopFrame: 18, aerialHopVy: 7, aerialHopVx: 0,   // プレイヤーも一緒に少し上へ
    lungeVx:      18, lungeDecay: 0.85, lungeDelay: 9,
    windupBackVx: 7,
    targetOvershootGuard: true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    repulseAxis:  'frontal', repulseFrameStart: 1, repulseFrameEnd: 18,
    repulseBox:   { offsetX: 280, offsetY: 150, w: 560, h: 380, d: 200 },
  },
  c01_sp_01_chn2_air: {
    label:        'c01_sp_01_chn2_air (METEO CHN-e02 空中・2段目 軽・お互い小ホップ)',
    baseSpecialId: 'c01_sp_01',
    duration:     37, hitFrame: 7, hitDuration: 6, cancelWindow: 18,
    cancelWindowStart: 17,
    damage:       8,
    rangeX:       230, rangeZ: 170, rangeY: 120, rangeYDown: 280,
    knockback:    14, hitstop: 6, shake: 5,
    atk_lv:       2, atk_lv_air: 2,
    // ↑J 方式（chn1_air と同じ）：launchVy/launcher を外し knockbackY 軽浮かせ＋AERIAL_Y_PULL 同期（2026-05-30）。
    launcher:     false, knockbackY: 9,
    hitColor:     0x55ddff, hitCount: 16,
    airGravFactor: 0.25,   // 空中チェーン中フワッと滞空（浮きすぎない）
    aerialHop:    true, aerialHopFrame: 7, aerialHopVy: 7, aerialHopVx: 0,   // プレイヤーも一緒に小ホップ
    lungeVx:      18, lungeDecay: 0.85, lungeDelay: 6,
    targetOvershootGuard: true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    repulseAxis:  'frontal', repulseFrameStart: 1, repulseFrameEnd: 18,
    repulseBox:   { offsetX: 280, offsetY: 150, w: 560, h: 380, d: 200 },
  },
  c01_sp_01_chn3_air: {
    label:        'c01_sp_01_chn3_air (METEO CHN-e02 空中・最終 強・敵=斜め下に超吹っ飛び/自機=真上ふわっと)',
    baseSpecialId: 'c01_sp_01',
    duration:     46, hitFrame: 13, hitDuration: 7, cancelWindow: 14,
    cancelWindowStart: 23,
    damage:       16,
    rangeX:       240, rangeZ: 170, rangeY: 130, rangeYDown: 300,
    knockback:    50, hitstop: 17, shake: 14,   // atk_lv6 で敵キャラシェイク自動
    atk_lv:       6, atk_lv_air: 6,   // 超吹っ飛ばし。atk_lv_down 無し（-）
    // lv6 軌道：まっすぐ斜め下へ叩き出す（スパイク）＝高アークにせず下方向＋横を強めに。
    kb_vy_lv6:        -18,   // 下方向初速（斜め下スパイク）
    kb_vx_mult_lv6:   1.2,   // 横も乗せて「斜め下に超吹っ飛び」
    kb_vx_decay_lv6:  0.9,
    hitColor:     0x66ddff, hitCount: 34,
    launcher:     false,
    airGravFactor: 0.25,   // 滞空（finisher の「ふわっと浮上」を持続・浮きすぎ抑え）
    aerialHop:    true, aerialHopFrame: 13, aerialHopVy: 9, aerialHopVx: 0,   // 自機は真上にふわっと浮上（控えめ）
    partsAnim:    'strong_punch_r',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    repulseAxis:  'frontal', repulseFrameStart: 1, repulseFrameEnd: 20,
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
    facingLockFrames: 25,   // 着地後すぐ振り返れるよう短縮（地上版と統一・既定 90 → 25）
    damage:       25,
    // X 軸前方判定を広げる（200）：plyrLiftVx を 0 にした分、当たり判定で前方の敵を拾う設計（2026-05-19）
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,     // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       2,
    atk_lv_air:   2,
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
    facingLockFrames: 25,   // 着地後すぐ振り返れるよう短縮（既定 duration+40=90 → 25）
    damage:       25,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,     // 2026-05-27 SP hitstop -30%（12→8）
    atk_lv:       2,
    atk_lv_air:   2,
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
  // === OC BRN-e11 FLAME UPPER（2026-05-30 再設計：2 段構成・最終段 2 ヒット・出がかり=通常 SP2・自動連結）===
  //   ↑K 一押しで「初段アッパー → トドメ飛び上がりアッパー(2 ヒット)」を自動連結。
  //   CHN-e03 DIVE と共存（↑K で FLAME 優先）。
  //     - 初段（_flame_mid）：自分だけ前進＋小ジャンプの軽アッパー。
  //       敵 knockback32 / knockbackY12（派生↑J 相当の軽浮かせ＋明確な後退）・atk_lv2・点火。
  //     - 最終段（_flame_final）：トドメ飛び上がりアッパー・isMultiHit×2。
  //       1 ヒット目=軽い当て(damagePerHit 10) → 6F 後 2 ヒット目=launcher(damageLastHit 20・atk_lv2 dispatch)。
  //       自分も敵も上昇（launchVy22 / plyrLiftVy24）。点火 + 赤火花。
  //   個性＝「各ヒット点火 + 毎ヒット赤い火花（fireSparks）」で火属性を明示。
  //   キュー：初回 ↑K で mid を MAX(=1) プリロード → mid → final を自動再生。
  //   final の発火タイミング：地上始動=自身着地まで待つ / 空中始動=1 段目から 20F 後に発動（着地待たず）。
  c01_sp_02_short_flame_mid: {
    label:        'c01_sp_02_short_flame_mid (METEO SP2・FLAME UPPER 中間 short upper)',
    duration:     26, hitFrame: 6, hitDuration: 5,
    cancelWindowStart: 14,
    cancelWindow: 22,
    damage:       6,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    32,            // 初段で敵を明確に後退させる（コンボ始動として手応えを出す）
    knockbackY:   12,            // 派生↑J(c01_add_02) と同等の上方向 KB（軽浮かせコンボ始動）
    hitstop:      4, shake: 4,
    atk_lv:       2,
    atk_lv_air:   2,
    plyrLiftVx:       8,    // 前進（facing 方向の airVx）— 昇竜烈破の出だし：自分だけ前へ
    plyrLiftVy:       8,    // 小ジャンプ（半分に：旧 15→8）。敵は打ち上げず自分だけ少し浮く
    hitColor:     0xff7733,
    hitCount:     14,
    aerialHop:    false,
    cancelToAirJ: false,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: false,
    showHitbox:   true,
    igniteTrigger: true,
    igniteAlways: true,
    fireSparks:   true,
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
    knockback:    32,            // 初段で敵を明確に後退させる（コンボ始動として手応えを出す）
    knockbackY:   12,            // 派生↑J(c01_add_02) と同等の上方向 KB（軽浮かせコンボ始動）
    hitstop:      4, shake: 4,
    atk_lv:       2,
    atk_lv_air:   2,
    plyrLiftVx:       8,    // 前進（facing 方向の airVx）— 昇竜烈破の出だし：自分だけ前へ
    plyrLiftVy:       8,    // 小ジャンプ（半分に：旧 15→8）。敵は打ち上げず自分だけ少し浮く
    hitColor:     0xff7733,
    hitCount:     14,
    aerialHop:    false,
    cancelToAirJ: false,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: false,
    showHitbox:   true,
    igniteTrigger: true,
    igniteAlways: true,
    fireSparks:   true,
    repulseAxis:  'aerial',
    repulseFrameStart: 1, repulseFrameEnd: 12,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  // FLAME UPPER 最終段（2026-05-30 再設計）：トドメ飛び上がりアッパー・2 ヒット。
  //   1 ヒット目=軽い当て（中間扱い・atk_lv2 のフリンチ）→ hitInterval(6F)後 2 ヒット目=launcher で打ち上げ。
  //   c01_sp_01 と同じ isMultiHit パターン（damagePerHit→damageLastHit／atk_lv は最終ヒットで適用）。
  c01_sp_02_short_flame_final: {
    label:        'c01_sp_02_short_flame_final (METEO SP2・FLAME UPPER 最終段・打ち上げ launcher 2hit)',
    duration:     50, hitFrame: 8, hitDuration: 14,   // hitInterval 6×2 をカバー
    cancelWindowStart: 30,
    cancelWindow: 45,
    facingLockFrames: 25,   // 着地後すぐ振り返れるよう短縮（既定 duration+40=90 → 25・leap SP3 と同方針）
    isMultiHit:     true,
    multiHitCount:  2,
    hitInterval:    6,
    damagePerHit:   10,    // 1 ヒット目：軽い当て
    damageLastHit:  20,    // 2 ヒット目：launcher（既存 damage 25 を 10+20=30 に再配分）
    damage:         30,    // 互換用（合計）
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,
    atk_lv:       2,
    atk_lv_air:   2,
    launchVy:     22,
    launchVyAirborne: 13,
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    plyrLiftVx:       5,
    plyrLiftVy:       24,
    plyrLiftVyDelay:  10,
    hitColor:     0xffcc44,
    hitCount:     22,
    aerialHop:    false,
    cancelToAirJ: true,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    igniteTrigger: true,
    igniteAlways: true,
    fireSparks:   true,
    repulseAxis:  'aerial',
    repulseFrameStart: 1, repulseFrameEnd: 16,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  // FLAME UPPER 最終段（空中始動）：トドメ飛び上がりアッパー・2 ヒット（地上版と同パターン）。
  c01_sp_02_air_flame_final: {
    label:        'c01_sp_02_air_flame_final (METEO SP2・FLAME UPPER 空中最終段・打ち上げ launcher 2hit)',
    duration:     50, hitFrame: 8, hitDuration: 14,
    cancelWindowStart: 20,
    cancelWindow: 45,
    facingLockFrames: 25,   // 着地後すぐ振り返れるよう短縮（空中始動も同値）
    isMultiHit:     true,
    multiHitCount:  2,
    hitInterval:    6,
    damagePerHit:   10,
    damageLastHit:  20,
    damage:         30,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 8, shake: 7,
    atk_lv:       2,
    atk_lv_air:   2,
    launchVy:     22,
    launchVyAirborne: 13,
    launcher:     true,
    attrGroup:    'LAUNCH_COMBO',
    plyrLiftVx:       5,
    plyrLiftVy:       8,
    plyrLiftVyDelay:  12,
    hitColor:     0xffcc44,
    hitCount:     22,
    aerialHop:    true,
    aerialHopVy:  8,
    postAirLockout: 45,
    landingLag:   0,        // 2026-05-30: 低空発動時の着地硬直撤廃（着地後すぐ動けるように・ユーザー指示）
    cancelToAirJ: true,
    partsAnim:    'upper_cut',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    igniteTrigger: true,
    igniteAlways: true,
    fireSparks:   true,
    repulseAxis:  'aerial',
    repulseFrameStart: 1, repulseFrameEnd: 16,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  // === CHN-e03 SP2 潜り込み連打アッパー（2026-05-30・スウェー方式に再設計）===
  //   入りスウェー（溜め・判定なし）→ スウェー中の ↑K 連打数で mid 段数が決まる → mid×N → final launcher。
  //   mid = 潜り込み（lungeVx 前進）+ 軽アッパー（atk_lv2・knockbackY で小浮かせ・launcher 無し・延焼無し）。
  //   final = 通常 SP2（c01_sp_02_short / _air）流用 → 連打なし＝溜め→launcher のみ＝下位互換。
  //   mid 間は hit-gated（空振りで打ち切り final へ）。baseSpecialId 共有でコンボ集約。
  // 入りスウェー：attacking 状態で歩行を止め、連打受付窓（cancelWindowStart まで）を作る。判定なし。
  c01_sp_02_dive_sway: {
    label:        'c01_sp_02_dive_sway (METEO CHN-e03 入りスウェー・溜め/連打受付)',
    baseSpecialId: 'c01_sp_02',
    duration:     20, hitFrame: 21, hitDuration: 1,   // hitFrame>duration＝判定が出ない（溜め専用）
    cancelWindowStart: 16, cancelWindow: 20,            // 16F の連打猶予 → 以降 mid/final へ
    damage:       0,
    rangeX:       0, rangeZ: 0, rangeY: 0,
    knockback:    0, hitstop: 0, shake: 0,
    atk_lv:       1,
    windupBackVx: 6,                  // わずかに後ろへ引く（スウェー感）
    airGravFactor: 0.25,              // 空中始動時はフワッと滞空
    partsAnim:    'sp2_dive_sway',    // 屈む溜めポーズ（仮）
    isSpecial:    true, flashOnStart: false, showHitbox: false,
    // RC は溜め中から受付（溜めで RC が遅れないよう repulseBox を active に）
    repulseAxis:  'aerial', repulseFrameStart: 1, repulseFrameEnd: 18,
    repulseBox:   { offsetX: 0, offsetY: 800, w: 600, h: 1600, d: 160 },
    singleTarget: true,
  },
  c01_sp_02_short_dive_mid: {
    label:        'c01_sp_02_short_dive_mid (METEO CHN-e03 潜り込みアッパー・地上 中間段)',
    baseSpecialId: 'c01_sp_02',
    duration:     24, hitFrame: 6, hitDuration: 5,
    cancelWindowStart: 14, cancelWindow: 20,
    damage:       6,
    rangeX:       180, rangeZ: 110, rangeY: 200,
    knockback:    12, knockbackY: 9,   // 軽フリンチ + 小浮かせ（前進と同調して敵を引き連れる）
    lungeVx:      22, lungeDecay: 0.85,   // 潜り込み（前進）
    hitstop:      4, shake: 4,
    atk_lv:       2, atk_lv_air: 2,
    hitColor:     0xffcc44, hitCount: 14,
    aerialHop:    false, cancelToAirJ: false,
    partsAnim:    'upper_cut',
    isSpecial:    true, flashOnStart: false, showHitbox: true,
    // RC は入りスウェーのみに集約（2026-05-30）：mid は RC 受付なし（dive 連打で常時パリィになるのを防ぐ）。
    singleTarget: true,
  },
  // dive 最終段（通常 SP2 のクローン）。dive 専用に調整：
  //   - cancelWindowStart を遅らせる（上昇終了→落下開始あたりでキャンセル可・要望3）
  //   - hitstop / shake を強化（締めの一撃の手応え・要望4）
  c01_sp_02_short_dive_final: {
    label:        'c01_sp_02_short_dive_final (METEO CHN-e03 最終段 launcher・地上)',
    baseSpecialId: 'c01_sp_02',
    duration:     50, hitFrame: 8, hitDuration: 6,
    cancelWindowStart: 40,   // 30→40：上昇が終わって落下し始める頃まで遅らせる
    cancelWindow: 45,
    damage:       25,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 14, shake: 12,   // 8→14 / 7→12：締めを重く
    atk_lv:       4, atk_lv_air: 4,
    launchVy:     22, launchVyAirborne: 13, launcher: true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44, hitCount: 26,
    plyrLiftVx:   5, plyrLiftVy: 24, plyrLiftVyDelay: 10,
    aerialHop:    false, cancelToAirJ: true,
    partsAnim:    'upper_cut',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    // RC は入りスウェーのみに集約（2026-05-30）：final も RC 受付なし。
    singleTarget: true,
  },
  c01_sp_02_air_dive_final: {
    label:        'c01_sp_02_air_dive_final (METEO CHN-e03 最終段 launcher・空中)',
    baseSpecialId: 'c01_sp_02',
    duration:     50, hitFrame: 8, hitDuration: 6,
    cancelWindowStart: 32,   // 20→32：上昇終了→落下開始あたりまで遅らせる
    cancelWindow: 45,
    damage:       25,
    rangeX:       200, rangeZ: 100, rangeY: 200,
    knockback:    45, hitstop: 14, shake: 12,
    atk_lv:       4, atk_lv_air: 4,
    launchVy:     22, launchVyAirborne: 13, launcher: true,
    attrGroup:    'LAUNCH_COMBO',
    hitColor:     0xffcc44, hitCount: 26,
    plyrLiftVx:   5, plyrLiftVy: 8, plyrLiftVyDelay: 12,
    aerialHop:    true, aerialHopVy: 8,
    postAirLockout: 45, landingLag: 30, cancelToAirJ: true,
    partsAnim:    'upper_cut',
    isSpecial:    true, flashOnStart: true, showHitbox: true,
    // RC は入りスウェーのみに集約（2026-05-30）：final も RC 受付なし。
    singleTarget: true,
  },
  c01_sp_02_air_dive_mid: {
    label:        'c01_sp_02_air_dive_mid (METEO CHN-e03 潜り込みアッパー・空中 中間段)',
    baseSpecialId: 'c01_sp_02',
    duration:     24, hitFrame: 6, hitDuration: 5,
    cancelWindowStart: 14, cancelWindow: 20,
    damage:       6,
    rangeX:       180, rangeZ: 110, rangeY: 200,
    knockback:    12, knockbackY: 9,
    lungeVx:      14, lungeDecay: 0.85,   // 空中は前進控えめ
    hitstop:      4, shake: 4,
    atk_lv:       2, atk_lv_air: 2,
    hitColor:     0xffcc44, hitCount: 14,
    airGravFactor: 0.25,   // 空中チェーン中フワッと滞空（空中 SP1 と同思想）
    aerialHop:    true, aerialHopVy: 7, aerialHopVx: 0,   // プレイヤーも小ホップ
    cancelToAirJ: false,
    partsAnim:    'upper_cut',
    isSpecial:    true, flashOnStart: false, showHitbox: true,
    // RC は入りスウェーのみに集約（2026-05-30）：mid は RC 受付なし。
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
    // 2026-05-29 SOLAR FLARE 化：判定縮小・atk_lv 2 軽フリンチ・超 KB → ノックバック先で 1.5 秒後に巨大ドーム発生（ヒット時のみ）
    duration:     48, hitFrame: 26, hitDuration: 7, cancelWindow: 16,
    facingLockFrames: 30,    // 2026-05-29: 旧 duration+40=88F の振り向き lock 短縮（技完了後即振り向き可）
    armor:        1,
    damage:       18,                       // 32→18：フィールドダメが本命なので軽量化
    rangeX:       240, rangeZ: 110,         // 2026-05-29: 120→240（リーチ 2 倍）
    rangeY:       150,
    rangeYDown:   30,
    knockback:    70, hitstop: 10, shake: 14,
    atk_lv:       2,
    atk_lv_air:   2,
    // atk_lv_down 未指定 = ダウン中の敵には当たらない
    kb_vy_lv2:        8,                    // 2026-05-29: 0→8（軽い上方ベクトル追加）
    kb_vx_mult_lv2:   2.0,
    hitColor:     0xff7733,                 // 火属性らしいオレンジに（旧青炎から変更）
    hitCount:     30,
    launcher:     false,
    aerialHop:    false,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    // OC BRN-l04 SOLAR FLARE：命中時に 1.5 秒遅延 → 敵の到達位置に巨大ドーム発生
    solarFlareTrigger: true,
    selfRecoilVx: 32,
    selfRecoilDecay: 0.82,
  },
  c01_sp_04_02_air: {
    label:        'c01_sp_04_02_air (METEO 溜めパンチ・stage2 MAX・空中版)',
    duration:     48, hitFrame: 26, hitDuration: 7, cancelWindow: 25,
    facingLockFrames: 30,    // 2026-05-29: 振り向き lock 短縮（地上版と同期）
    armor:        1,
    damage:       18,
    rangeX:       240, rangeZ: 110,         // 2026-05-29: 120→240（地上版と同期）
    rangeY:       150,
    rangeYDown:   30,
    knockback:    70, hitstop: 10, shake: 14,
    atk_lv:       2,
    atk_lv_air:   2,
    kb_vy_lv2:        8,                    // 2026-05-29: 軽い上方ベクトル
    kb_vx_mult_lv2:   2.0,
    hitColor:     0xff7733,
    hitCount:     30,
    launcher:     false,
    aerialHop:    true,
    partsAnim:    'strong_punch_r',
    isSpecial:    true,
    flashOnStart: true,
    showHitbox:   true,
    solarFlareTrigger: true,
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
