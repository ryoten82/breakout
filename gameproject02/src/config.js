// ============================================================
//  SCRAP BLITZ — CONFIG 群（分離 Phase: Step C-1 中核 + C-2 周辺）
//
//  ES Module として index.html から import される：
//    import {
//      PHYSICS, SP_CONFIG, ULT_CONFIG, GRAB_CONFIG, MEGA_CONFIG,
//      SPECIAL_CONFIG, HOMING_CONFIG, GUARD_CONFIG,
//      ENEMY_AI, DUMMY_ATK_CONFIG,
//      CAM_CONFIG, PIXEL_SHADER, OUTLINE_CONFIG,
//      CHARGE_RING_CONFIG, CHARGE_PARTICLE_CONFIG,
//      COMBO_LEVELS, getComboLevel, SLOWMO, KEY_CONFIG,
//    } from './src/config.js';
//
//  純データ層：他データ（ATTACKS / STATE / 関数）への参照は持たない。
//  Three.js 依存を持つフィールドは数値（hex 等）で保持し、利用側で THREE.* 化する。
//    例：OUTLINE_CONFIG.COLOR は 0xffffff（数値）／使用側で new THREE.Color(...)
// ============================================================

// ============================================================
//  #section physics-config — PHYSICS / SP / ULT / GRAB / MEGA / SPECIAL / GUARD 設定
//  ランタイムで変更可能。コンソール: window.SB.PHYSICS.JUMP_V = 12   などで即反映
// ============================================================
export const PHYSICS = {
  SPEED:            5.5,    // 水平移動速度
  Z_SPEED_MULT:     1.8,    // Z軸移動の視覚補正倍率（パース圧縮で遅く見えるため）
  JUMP_V:           10,     // ジャンプ初速（小さめ＝重量感）
  THRUST_FORCE:     0.94,   // ブースター毎フレーム加速量（2026-05-18：1.14 → 0.94 → 最大ジャンプ高度 80% に再調整）
  THRUST_FRAMES:    12,     // ブースター持続フレーム数（最大）
  GRAVITY:          0.82,   // 重力加速度（2026-05-18：0.96 → 0.82 = ×0.85・操作難易度抑制・コンボ繋ぎ重視）
  YAW_BURST_FRAMES: 9,      // 方向転換時の肩スラスター噴射時間

  // === 攻撃・コンボ系 ===
  // キャンセルジャンプ時の噴射（板野的ケレン味）
  // 通常ジャンプ: JUMP_V=10, THRUST=1.20, FRAMES=12 → 最大vy=24.4
  // キャンセル時:                                  → 最大vy=30.2（24%増）
  // 視覚演出（bigBurstTimer）でケレン味を出し、物理は通常+α 程度に抑える
  // 物理ブーストは廃止：キャンセルジャンプの違いは初速 V=12（通常+2）のみ
  // 推力（force/frames）は通常ジャンプと共通。SPACE 押しっぱなしで上空に飛びすぎる不具合の構造修正
  CANCEL_JUMP_V:        12,    // キャンセル時のジャンプ初速（通常 10 +2）
  // CANCEL_JUMP_THRUST / CANCEL_JUMP_FRAMES は撤廃（通常ジャンプの THRUST_FORCE / THRUST_FRAMES を共用）

  // === 空中コンボ共通（全キャラ共有・キャラ固有値を持たせない） ===
  AERIAL_HOP_V:          9,    // ヒット時の両者ホップ速度（プレイヤー・敵 共通）
  AERIAL_RANGE_Y:      110,    // 空中攻撃の高さ方向当たり判定（チェーン内で段階加算）
  AERIAL_Y_PULL:      0.45,    // ヒット確定時に敵 Y をプレイヤー Y へ引き寄せる割合
  AERIAL_GRAV_FACTOR:        0.65,  // 空中コンボ中の重力倍率（1.0=通常・小さいほどふわっと）2026-05-20: 0.9→0.65
  AERIAL_GRACE_FRAMES:       30,    // コンボ終了後も重力軽減を維持する猶予フレーム（拾い直し余裕・2026-05-20）
  ENEMY_LAUNCHER_GRAV:       0.45,  // 打ち上げ後の敵落下倍率（旧ハードコード 0.6 → 0.45：拾い直し余裕拡大）
  ENEMY_PEAK_HANG_FRAMES:    30,    // 打ち上げ頂点での滞空 F（旧 36 → 48 → 30：ぬるっと感解消）
  ENEMY_PEAK_HANG_FADE:      12,    // 頂点滞空のフェードイン F
  ENEMY_PEAK_HANG_DEPTH:     0.2,   // 頂点滞空時の最低重力倍率（旧ハードコード 0.05 → 0.2：完全停止せず緩やかに落とす）
  ENEMY_WALL_BOUNCE_FALL:    true,  // 壁バウンス後の落下も launcher 扱いで軽減するか
  MAX_FALL_VY:       -18,     // 終端速度クランプ（2026-05-19 追加・空中コンボ長時の急降下抑制）

  // === ステージ横バウンド（最外殻ガードレール）===
  // 2026-05-18：壁判定は画面端追従（getActiveWallX）に移行。STAGE_LEFT/RIGHT は
  // 「カメラが暴走しても player/enemy が無限遠まで行かないための最終フォールバック」。
  // 通常プレイで触れない値（±10000）に設定。レベルデータが壁オブジェクトを持つようになっても、
  // このガードレールは残しておく（NaN 等の異常時の安全網）。
  STAGE_LEFT:   -10000,
  STAGE_RIGHT:   10000,

  // === ダッシュ（ローラーダッシュ式：2回タップ＋押しっぱなしで無制限持続） ===
  DASH_SPEED_MULT:  2.0,  // 通常速度の倍率
  GROUND_ACCEL:     0.20, // 地上方向転換の慣性係数（小さいほど重い・膨らむ）
  DASH_COOLDOWN:    24,   // ダッシュ終了後の再発動クールダウン（フレーム）
  DASH_TAP_WINDOW:  18,   // 同方向2回タップの受付ウィンドウ（フレーム）
  DASH_HOLD_FRAMES: 75,   // 移動入力（方向問わず）の継続フレーム数でダッシュ移行（1.25 秒・方向転換でリセットしない）
  DASH_SPARK_ANGLE: Math.PI / 6, // 足元火花を出す方向変化の閾値（30°）

  // === 空中慣性 ===
  AIR_FRICTION:  0.95,  // 空中の水平速度減衰率（毎フレーム）0.90→0.95：慣性をより長く残す
  AIR_CONTROL:   0.6,   // 空中での方向修正力 1.2→0.6：制動を弱めて「らしい」挙動に
};

// ============================================================
//  受け身（ukemi）設定 — 被弾着地時のジャンプ受け身
// ============================================================
//  被弾で吹き飛ばされ着地する瞬間にジャンプ入力すると、吹き飛び方向へ
//  ジャンプ受け身。上昇中は無敵、頂点で無敵終了。値は仮置き（要・触り調整）。
export const UKEMI_CONFIG = {
  BUFFER_FRAMES: 8,    // ジャンプ入力の受付猶予（着地のこのF前までに押せば成立）
  JUMP_VY:       15,   // 受け身ジャンプの上昇初速（ブースター無しの固定アーク）
  HORIZ_VX:      18,   // 吹き飛び方向への水平初速（大きく飛ぶ）
  FLASH_FRAMES:  14,   // 成立時の白フラッシュ持続F
};

// ============================================================
//  SP ゲージ設定
// ============================================================
export const SP_CONFIG = {
  // ストック性（5 段階・各 STOCK_SIZE pt）：MAX = STOCK_SIZE * MAX_STOCKS = 100
  MAX:              100,
  STOCK_SIZE:       20,    // 1 ストックあたりの SP 量
  MAX_STOCKS:       5,     // 最大ストック数（Marvel vs Capcom 方式の LEVEL）
  INITIAL_STOCKS:   3,     // 戦闘開始時のストック数
  REGEN_RATE:       0.01,  // フレームごとの自然回復量（攻撃優先設計：逃げ回りだけでは遅い）
  GAIN_ON_HIT:      3,     // ヒット1発あたりの獲得量（Phase 2.4 で 8→3 にトーンダウン）
  GAIN_ON_TAKEN:    3,     // 被弾1発あたりの獲得量
  GAIN_ON_GUARDED:  2,     // ガード成立1発あたりの獲得量
  MEGA_CRASH_COST:  20,    // メガクラッシュ消費（= 1 ストック）
  ULT_COST:         40,    // ULT消費（= 2 ストック）
};

// ============================================================
//  MEGA CRASH（J+K / U / R1 — SP 1 ストック消費）
// ============================================================
// ============================================================
//  ULT（J+K+L / I / R2 — SP 2 ストック消費）
//  - 地上限定（一部キャラ将来例外可）／hit_confirm からキャンセル発動可
//  - 発動中完全無敵（p.invincible）／画面全体に攻撃判定
//  - 戦闘データは ATTACKS.c01_sp_ult01。ULT_CONFIG は演出・タイミング系のみ
// ============================================================
export const ULT_CONFIG = {
  DARKEN_ALPHA:      0.55,   // 暗転濃度（メガクラ 0.45 より少し濃く）
  DARKEN_FADE_OUT:   30,     // 解除フェードアウト長
  SLOW_DIVISOR:      4,      // ピーク時のスロー（1/4 速・メガクラ 1/3 より深く）
  SLOW_FADE_FRAMES:  60,     // ヒット後のスロー→通常速度フェード長（≒1秒）
  CAM_ZOOM_RATIO:    0.78,   // カメラズーム倍率（小さいほど寄る）
  CAM_ZOOM_FRAMES:   12,     // ズームに掛けるフレーム数
  DOME_COLOR:        0xff4422, // 赤ドーム
  DOME_MAX_RADIUS:   1500,   // ドーム最大半径（仮：画面相当）
  DOME_EXPAND_FRAMES: 25,    // ドーム拡大フレーム数
  DOME_MAX_OPACITY:  0.40,   // ドーム最大不透明度
};

// ============================================================
//  GRAB（くにおくん方式・密着自動発動）
//  - 相手 wait01 / 自分 wait01・地上で密着 → 即発動
//  - 攻撃中・のけぞり中の敵は対象外
//  - 発動中はお互い停止／攻撃ボタンで殴り／方向+攻撃で投げ
//  - 2 秒（120F）経過 or 4 発命中で時間切れ → 互いに knockback02 で離れる
// ============================================================
export const GRAB_CONFIG = {
  RANGE_X:          60,    // 密着判定（前方）
  RANGE_Z:          40,    // 軸ズレ許容
  DURATION:         120,   // タイマー初期値（2 秒）
  HIT_MAX:          4,     // 最大ヒット数
  HIT_TIME_COST:    24,    // 1 発あたり消費するタイマー（ゲージ進行 20%＝120×0.20）
  PUNCH_ACTION_FRAMES: 20, // つかみ攻撃のアクション持続(この間はタイマー停止・入力スキップ)
  PUNCH_DAMAGE:     6,
  THROW_DAMAGE:     15,
  THROW_KB_VX:      50,    // 投げ時の水平ノックバック速度
  THROW_INITIAL_VY: 22,    // 投げ初速 Y（上に持ち上げてから飛ばす・打ち上げ気味）
  THROW_KB_DECAY:   0.88,  // 投げの水平減衰（既定 0.78 より緩めて飛距離 1.5 倍に）
  HOLD_OFFSET_X:    110,   // プレイヤー〜被害者の中心間距離（重なり回避のためやや広め）
  RELEASE_KB_VX:    6,     // 時間切れ時の互いの押し合い速度
  ACTIVATE_PARTICLE_COLOR: 0x66ff44, // 発動時パーティクル色（仮：将来は属性ベース）
  ACTIVATE_PARTICLE_COUNT: 12,       // 1 キャラあたりのパーティクル数
  ACTIVATE_PARTICLE_Y:     60,       // スポーン Y オフセット（腰辺り）
};

// 戦闘データ（damage / knockback / atk_lv 等）は ATTACKS.c01_sp_mega01 に集約。
// MEGA_CONFIG は演出・タイミング系のみを保持
export const MEGA_CONFIG = {
  RADIUS:           300,   // AoE 半径（wu・キャラ約3体分）
  EXPAND_FRAMES:    20,    // リングが半径 0→RADIUS まで広がるフレーム数
  SLOW_FRAMES:      30,    // スロー継続フレーム（≒0.5秒 at 60fps）
  SLOW_DIVISOR:     3,     // スロー中の更新間隔（3 = 1/3 速）
  DARKEN_ALPHA:     0.45,  // 暗転オーバーレイ最大不透明度
  DARKEN_FADE_OUT:  30,    // 暗転がフェードアウトする長さ（フレーム）
  RING_COLOR:       0x66ddff,  // 球体シェルの色
};

// ============================================================
//  SPECIAL（必殺技：コマンド技・溜め技）
//  - ↓↘→+J / ↓↑+J / J長押し0.8秒 で発動
//  - SP 消費なし。ヒットで通常通り SP 獲得
//  - 1 コンボ中 1 回まで（メガクラ・ULT 発動でフラグリセット）
//  - 入力バッファ 30F・最長一致優先
//  - 戦闘データは ATTACKS.c01_sp_01 / _02 / _03。本 CONFIG は検出・演出系のみ
// ============================================================
export const SPECIAL_CONFIG = {
  DIR_BUFFER_FRAMES: 30,    // 方向入力履歴の保持長（広め・dirMatch 全般で使用）
  // 旧 CMD_TAP_TO_BUTTON_FRAMES / CMD_TAP_CANCEL_MULT は廃止（2026-05-20）。
  //   タップコマンド廃止 + K=SP ボタン化に伴い未参照となった。必殺技は方向 + ボタン直接 dispatch。
  CHARGE_FRAMES_STAGE1: 50,  // sp_04 第1段階成立（≈0.83秒）→ c01_sp_04_01 発動（旧 c01_sp_04 / 2026-05-20 _NN 連番化）
  CHARGE_FRAMES_STAGE2: 120, // sp_04 第2段階成立（2.0秒）→ c01_sp_04_02 発動（旧 c01_sp_04_max）。OC/チップで stage3+ を _03, _04... と追加可能
  FLASH_FRAMES:      12,    // 発動時の白フラッシュ長
  FLASH_COLOR:       0xffffff,
  SHOW_HITBOX:       true,  // 必殺技ヒットボックス可視化（本番では false）
  HITBOX_COLOR:      0xff2222,
  HITBOX_OPACITY:    0.35,
};

// ============================================================
//  同技補正（同じ攻撃 ID を連発したときの威力・KB 減衰）
//  - 2026-05-18 追加。攻撃 ID 単位で p.attackHitCounts に回数を記録し、
//    閾値以上で SAME_ATTACK_SCALE 配列から倍率を引いて damage / knockback に乗算
//  - メガクラで一定量回復するが、永久回復はしない（コンボ break / resetCombo で 0 にリセット）
//  - 既存の specialUsedIds（同コンボ 1 回制限）は別系統。同技補正は通常技も含む全攻撃が対象
// ============================================================
export const SAME_ATK_CONFIG = {
  // ヒット回数に対する倍率（index 0 = 1 回目 / index 1 = 2 回目 / ...）
  // 配列範囲外（=長く連発）は最終要素を据え置く（フロア）
  SCALE_DAMAGE:    [1.0, 1.0, 1.0, 0.7, 0.45, 0.25],
  SCALE_KNOCKBACK: [1.0, 1.0, 1.0, 0.7, 0.45, 0.25],
  // メガクラで各 ID のカウントから引き算する量（部分回復・floor 0）
  MEGA_REDUCE_BY:  2,
  // 同技補正の最低保証：これより下がらない（極端なゼロ化を防ぐ）
  MIN_DAMAGE:      1,
  MIN_KB_RATIO:    0.15,
};

// ============================================================
//  クリティカル攻撃（2026-05-20）
//  - カウンターヒット（敵の攻撃発生中 = enemy_attacking の wind/active に殴り返す）は
//    確定クリティカル。決定論的・読み重視で「ノイズ最小」ドクトリンに適合。
//  - それとは別に基礎確率クリティカルを残す：アクション苦手な層にも「出てうれしい」
//    瞬間を届けるための初心者救済枠（運の気持ちよさ）。
//  - 効果：ダメージ倍率 + 数値の橙強調（hud-system）+ ヒットストップ/シェイク上乗せ。
//  - 値はランタイム調整可：window.SB.CRIT_CONFIG.DAMAGE_MULT = 2 など
// ============================================================
export const CRIT_CONFIG = {
  BASE_CHANCE:   0.05,  // 通常ヒットの基礎クリティカル率（カウンターは確率を介さず確定 100%）
  DAMAGE_MULT:   1.5,   // クリティカルダメージ倍率（仮値・実プレイで詰める）
  HITSTOP_BONUS: 4,     // クリティカル時の追加ヒットストップF
  SHAKE_BONUS:   3,     // クリティカル時の追加シェイク強度
};

// ============================================================
//  HOMING（コンボ追尾）— 最初に殴った敵に対する自動接近
//  - 全攻撃で windup 中に target 方向へ補間移動
//  - 反対方向入力 0.3 秒（連打 or 持続）でロック解除
//  - 距離が遠すぎる or target が無敵化（down_burst）でも自動解除
// ============================================================
export const HOMING_CONFIG = {
  MAX_DISTANCE:        400,   // XZ 合算距離での解除（フェイルセーフ）
  MAX_DISTANCE_X:      300,   // X 軸単独での解除（200→300：mega RADIUS と揃え、AoE 後の追撃ロックを維持しやすく）
  // 補間係数（距離スケーリングで実効値は減算される）
  WINDUP_LERP_X:       0.22,  // 水平 X：標準（個別調整は ATTACKS[id].homingLerpMult で）
  WINDUP_LERP_Y:       0.10,  // 空中 Y：抑制（旧 0.18 → 0.10：拾い直し時の急上昇感を低減 2026-05-20）
  WINDUP_LERP_Z:       0.32,  // 奥行き Z：強め（2.5D 圧縮で最もズレやすい軸・コマンド ↓ 入力で誤って動きやすい）
  // 目標位置のオフセット
  AIM_OFFSET_X_RATIO:  0.55,  // hitFrame 時の理想 X 距離 = rangeX × この係数
  AIM_Y_OFFSET:        60,    // 空中追尾時、target の Y より少し上を狙う
  // デッドゾーン：既に圏内なら動かさない（さりげなさのため）
  DEADZONE_X_MARGIN:   40,    // |gapX| < (rangeX × AIM_OFFSET_X_RATIO + これ) なら X 動かない
  DEADZONE_Y_MARGIN:   60,    // |gapY| < これ なら Y 動かない（旧 30 → 60：Y 軸ホーミング更に抑制 2026-05-20）
  DEADZONE_Z_MARGIN:   15,    // |gapZ| < これ なら Z 動かない（小さめ＝Z は積極補正）
  // 距離スケーリング：遠いほど効きを弱める（ワープ感の軽減）
  FALLOFF_NEAR:        100,   // この距離までは LERP 100% 適用
  FALLOFF_FAR:         350,   // この距離で LERP の 30% まで減衰（線形補間）
  FALLOFF_FAR_RATIO:   0.30,  // FALLOFF_FAR 地点での残存比率
  // 当たり判定の内部拡張（C 案）：comboTarget だけ rangeX をこの分上乗せ
  HIT_RANGE_BONUS_X:   40,    // ぎりぎり外れる攻撃を「届いた」扱いに（locked target のみ）
  HIT_RANGE_BONUS_Z:   30,    // Z も同様（圧縮軸の救済）
  // facing 自動反転：閾値を上げて「遠くから振り向く」感を回避
  FACING_FLIP_DIST:    70,    // dist > これ なら facing を target 方向に強制反転
  // 解除入力
  BREAK_INPUT_FRAMES:  18,    // 反対方向入力で解除されるまでの累積 F（0.3 秒）
  OPPOSITE_DECAY:      0.5,   // 反対入力していないフレームでのカウンタ減衰
  // デバッグ
  SHOW_DEBUG_ARROW:    true,  // 対象敵に矢印表示（旧称 debug。ターゲットの重要性上昇で本番採用候補・2026-05-16）
};

// ============================================================
//  GUARD（METEO L キー前方ガード）
//  - 長押し中 SP 持続消費 / 移動可・攻撃不可
//  - L 離す or SP 切れ で即解除 → 短いフェードアウト
//  - 被ダメ軽減・クラッシュ・SP 不足点滅は Phase 2.4 で実装
// ============================================================
export const GUARD_CONFIG = {
  SP_DRAIN:         0.075, // 毎F SP消費（100 → 約22秒持続・Phase 2.4 で半減→さらに60%）
  MIN_SP_TO_START:  5,     // 開始に必要な最低SP（切れ直後の連打防止）
  FADE_IN_LERP:     0.70,  // 発動時の不透明度ライズ係数（大きいほど速くフェードイン）
  FADE_OUT_FRAMES:  5,     // 解除時のフェードアウト長（フレーム）
  SHIELD_RADIUS:    90,    // 半円シールドの半径（wu）
  SHIELD_COLOR:     0x66ccff,
  SHIELD_Y_OFFSET:  100,   // プレイヤー Y からシールド中心までのオフセット（みぞおち位置）
  SHIELD_MAX_OPACITY: 0.35,// 最大不透明度（透けてプレイヤーが見える）
  MOVE_SPEED_MULT:  0.5,   // ガード中の移動速度倍率（仕様：半分）
  DRAIN_PAUSE_FRAMES: 24,  // ガード成功で SP_DRAIN がぴたっと止まるフレーム数（手応え演出・約0.4秒）
  // ガード成功時の演出（Phase 2.4）
  HIT_KNOCKBACK_VX: 5,     // ガード成功で受ける軽い後退（攻撃側から離れる方向）
  HIT_KB_DECAY:     0.82,  // ノックバックの減衰係数
  HIT_HITSTOP:      4,     // ガード成功で発生する軽いヒットストップF
  FLASH_FRAMES:     14,    // ガード成功で「カッ」と発光する持続F
  FLASH_OPACITY:    0.95,  // 発光ピーク時の opacity（通常 SHIELD_MAX_OPACITY 0.35 を上書き）
  FLASH_COLOR:      0xffffff, // 発光時の色（白）
  // SP 不足でガードボタンを押した時の点滅フィードバック
  FAIL_FLASH_FRAMES: 30,   // 点滅持続F（2回の山＝30Fで2周期）
  FAIL_FLASH_OPACITY: 0.20,// 点滅ピーク時の薄い opacity（フル発動より弱め）
  FAIL_FLASH_COLOR:  0xff8866, // 点滅色（赤味のオレンジ＝エネルギー不足サイン）
  // --- 被ダメ軽減（Phase 2.4）---
  DAMAGE_MULT:           0.3,  // 受けるダメージ倍率
  HIT_KB_MULT:           0.4,  // 受けるノックバック倍率
  HIT_SP_COST:           8,    // 被弾1回あたり追加 SP 削り
  CRASH_THRESHOLD:       0,    // この SP 以下になったらクラッシュ
  CRASH_RECOVER_FRAMES:  60,   // ガードクラッシュ硬直
  FRONT_ONLY:            true, // 前方からの攻撃のみガード成立
};

// ============================================================
//  #section enemy-ai-dummy — ダミー敵ミニマム攻撃（Phase 2.4・テスト用 AI）
//  - SB.ENEMY_AI.enabled で全敵 AI をトグル（数字キー 4 で切替）
//  - 接近 → wind(180F = 3秒カウントダウン) → active(8F) → recover(30F) → cooldown(45F) → 接近...
//  - wind 中もプレイヤー追跡 / approachRange 超過でキャンセル
//  - active 中だけ赤 AABB のヒットボックスを可視化（enemyHitboxMesh）
// ============================================================
export const ENEMY_AI = { enabled: true };
export const DUMMY_ATK_CONFIG = {
  approachRange:    400,   // この距離以下で接近開始
  attackRange:      130,   // この距離以下で攻撃発動
  approachSpeed:    1.4,   // 接近移動速度（wu/F）
  windupFrames:     180,   // カウントダウン 3,2,1（60F/秒 × 3秒）
  activeFrames:     8,     // 当たり判定アクティブ
  recoverFrames:    30,    // 振り終わり硬直
  cooldownFrames:   45,    // 攻撃終了 → 次の攻撃までのインターバル
  hitboxRangeX:     110,
  hitboxRangeY:     90,
  hitboxRangeZ:     80,
  damage:           10,
  atk_lv:           1,
  knockback:        12,
  hitstop:          5,
  shake:            4,
  hitColor:         0xff8844,
  // Phase 3 AI ステート明示化（aiPhase）: retreat フェーズ用
  retreatFrames:        40,   // 攻撃 recover 後の強制後退時間
  retreatSpeed:         1.0,  // 後退時の移動速度（wu/F・approachSpeed より控えめ）
  postHitRetreatFrames: 30,   // 被弾→wait01 復帰後の後退時間（被弾後の間合い取り）
};

// ============================================================
//  #section status-stun — ステータス：スタン（Phase 3・将来 freeze/poison 等と並ぶ）
//  - applyStatusStun(e, frames?) で付与（地上の敵のみ・空中は無視）
//  - duration 経過で wait01 に自動復帰
//  - 通常の被弾を受けると knockback / down_* に上書きされる（被弾優先）
// ============================================================
export const STATUS_STUN_CONFIG = {
  defaultDuration: 90,  // 既定 1.5 秒（60F/秒）。付与時の引数で上書き可
};

// ============================================================
//  #section gore-scrap — 敵死亡演出（Phase 3-A：黒フェード骨格のみ）
//  仕様：spec-room/discussions/gore-scrap-mob-prototype.md
//   - HP 0 + instantRespawn=false で enemy_dying state に遷移
//   - 黒シルエット化（全 part の material.color を 0 へ lerp）→ 完全消滅
//   - Phase 3-B 以降：フェード中のヒットでパーツ飛散・バーストダウン即爆散
// ============================================================
export const GORE_CONFIG = {
  // 並列タイマー（2026-05-20 同時スタート方式）
  //   FADE：origColor → 黒 lerp（色変化の速度）
  //   HOLD：dying 状態の総寿命（fade と独立・敵サイズで将来変動させる予定）
  //   両者は enterEnemyDying() 時に同時起動。dying 完了 = HOLD 満了。
  FADE_DURATION:  24,    // 黒くなるまで 0.4 秒（60F × 0.4）
  HOLD_DURATION:  150,   // 真っ黒のまま 2.5 秒保持（60F × 2.5）→ その後消滅
  TARGET_COLOR:   0x000000,

  // === Phase 3-B：パーツ逐次分離（2026-05-20 改修：1 ヒット = 1 パーツ抽選）===
  // dying 中に攻撃を当てると：
  //   1) 必ず黒オイルパーティクル発火（ヒット感）
  //   2) 確率判定（PART_BREAK_PROB）→ 当選で残存パーツから 1 つ抽選して分離
  //   3) 残りは本体に付いたまま、fade/hold タイマーは進行
  //   4) 攻撃を続けるとさらに 1 つずつ分離していく
  //   5) hold 満了で本体 mesh 除去、飛翔中パーツは独立してバウンド・フェード継続
  PART_BREAK_PROB:    0.5,    // 1 ヒットで 1 パーツ分離する確率（0.0–1.0・2026-05-20 ユーザー指定 50%）
  PART_VX_RANGE:      [3, 8], // 水平速度（プレイヤー逆方向に飛ばす）
  PART_VY_INITIAL:    [10, 16], // 上向き初速
  PART_VZ_RANGE:      [-3, 3],  // Z 方向の散らばり
  PART_GRAVITY:       0.7,
  PART_BOUNCE_DAMP:   0.45,   // バウンド時の vy 反転減衰係数
  PART_FADE_AFTER_BOUNCE: 18, // バウンド後 N フレームで消滅
  // 黒オイルパーティクル（既存 spawnHitParticles 流用・色だけ override）
  //   2026-05-20：0x111111 では暗すぎて廃工場ステージの背景に埋もれて見えない問題
  //   → 0x3a3a55 へ引き上げ（dark navy・「オイル感」を保ちつつ可視性確保）。完全黒は Unreal 移行時に再検討
  OIL_PARTICLE_COLOR: 0x3a3a55,
  OIL_PARTICLE_COUNT: 24,

  // === 最終フェーズ（hold 満了 → 後方吹き飛び → 爆散）2026-05-20 ===
  // 1) hold 満了で down_front_start に強制遷移、後方へ knockback
  // 2) この間は dyingInvincible で完全無敵（hit-engine が skip）
  // 3) FINAL_EXPLODE_DELAY フレーム後に全パーツ爆散・本体 mesh 除去
  FINAL_BACKWARD_VX:   18,    // 後方ノックバック水平初速（プレイヤー逆方向）
  FINAL_BACKWARD_VY:   14,    // 上向き初速
  FINAL_EXPLODE_DELAY: 30,    // 後方吹き飛び開始 → 爆散までのF（0.5s）

  // === Phase 3-C：lv06 バーストダウン即爆散（黒フェード経由しない直行ルート）===
  //   lv06 攻撃で HP 0 になった瞬間に発動。fading/hold 飛ばして burst（きりもみ）→ 爆散
  //   既存 down_burst_* state（重複特殊技時の演出）を物理流用、トレイルでオイルを撒く
  BURST_SPIN_DURATION:    50,   // きりもみ滞空時間 → 爆散まで（約 0.83s）
  OIL_TRAIL_INTERVAL:     4,    // トレイル発生間隔（F・小さいほど密）
  OIL_TRAIL_PER_FRAME:    4,    // 1 回あたりのオイル粒子数

  // === 死亡 stun フェーズ（2026-05-20 ユーザー指示）===
  // wait01 到達時に reacting → stunned へ遷移、直立操作不能の時間
  // 経過後 → final（後方吹き飛び）
  STUN_DURATION:          120,  // 約 2 秒（60F × 2）

  // === 爆発直前の白フラッシュ（2026-05-20 ユーザー指示）===
  // final / burst フェーズの最後 N フレーム、残存 attached パーツを白く発光
  // 直後に _triggerFinalExplosion で本体除去 + 爆発
  PREEXPLODE_FLASH_FRAMES: 6,   // 約 0.1 秒（60F × 0.1）
};

// ============================================================
//  #section gore-critical — 必殺技/キャラ固有のフィニッシャー演出（2026-05-18 導入）
//  仕様：spec-room/discussions/gore-critical.md
//   - dying フロー突入時に 1 回だけ抽選（PROBABILITY）
//   - キャラ profile の goreCriticalParts が残存 + canArmGoreCritical(e, ctx) が true で発火
//   - 発火時は黒 fade/hold を bypass：強画ぶれ＋ヒットストップ → 赤発光 → 白光 → 爆散
//   - キャラ拡張で爆散方向・追加 FX を上書き可能（criticalExplosionVariant）
// ============================================================
export const GORE_CRITICAL_CONFIG = {
  PROBABILITY:             0.20,         // 通常運用値。テスト時は SB.GORE_CRITICAL_CONFIG.PROBABILITY = 1.0 で常時発火に
  FREEZE_FRAMES:           18,           // 発火直後の hitstop（0.3 秒）
  SHAKE_MAG:               22,           // 強画ぶれ振幅
  SHAKE_FRAMES:            34,           // 画ぶれ持続
  RED_COLOR:               [1.0, 0.05, 0.05],   // 真っ赤発光ターゲット
  RED_LERP_FRAMES:         8,            // crit_freeze 終了後 N フレームで赤完了
  RED_HOLD_FRAMES:         18,           // 赤維持時間（0.3 秒）— gc_03 等で使用
  PREEXPLODE_WHITE_FRAMES: 6,            // 爆散直前の白フラッシュ
  // キャラ拡張（toward_player バリアント）が参照する数値
  TOWARD_PLAYER_VX:        32,           // パーツのプレイヤー方向 base 水平速度（オーバーシュート抑制）
  TOWARD_PLAYER_VY:        18,           // 上向き初速（弧を描く）
  TOWARD_PLAYER_JITTER:    8,            // パーツごとの ± ばらつき
  TOWARD_PLAYER_GRAV_MULT: 1.0,          // クリ爆散パーツの重力倍率（1.0 = 通常 PART_GRAVITY 0.7 のまま）
  TOWARD_PLAYER_AIR_DECAY: 0.97,         // 飛行中の水平減衰（毎フレーム）→ プレイヤー位置近くで失速
  EXTRA_PARTICLE_COUNT:    28,           // プレイヤー方向の指向性パーティクル数
  EXTRA_PARTICLE_COLOR:    0xff5522,     // 赤橙
  // wall_blast_toward_player バリアント（METEO SP4/空中SP1 第一弾）
  //   armed 当選時：通常 lv6 dispatch と同等の knockback で吹き飛ばす（ATTACKS テーブル参照）。
  //   下の WALL_BLAST_* は未使用（廃止候補・互換のため残置）。
  WALL_BLAST_KB_VX:        35,           // legacy 未使用
  WALL_BLAST_KB_VY:        8,            // legacy 未使用
  WALL_BLAST_KB_DECAY:     0.995,        // legacy 未使用
  WALL_STICK_FRAMES:       60,           // 壁張り付き 1 秒 → 爆散
  // 滞空延長：armed crit_fly 中の重力倍率（通常 PHYSICS.GRAVITY 0.7 × この値）
  // 0.5 = 半減 → 斜め下叩きつけ（SP1_air vy=-10）でも見栄え滞空を確保
  CRIT_FLY_GRAV_MULT:      0.5,
  // head_launch_delayed バリアント（gc_04：上半身打ち上げ → 0.7 秒後爆発）
  //   2026-05-19 改修：胴体から上（body+head+nose バンドル）が泣き別れて縦回転で上昇する方式に。
  //   下半身（stand）は地面にそのまま残り、爆発時に消える。トレイルは廃止。
  UPPER_LAUNCH_VY:         22,     // 上半身バンドルの上方初速（やや上に飛ぶ程度・以前 head 単体 45 だった所を抑制）
  UPPER_LAUNCH_VX_JITTER:  3,      // バンドル水平ばらつき（±）
  UPPER_LAUNCH_ANG_X:      0.45,   // X 軸まわりの縦回転速度（fallDir 方向に乗算）。プレイヤーから見て後ろに倒れ込むバク転
  UPPER_LAUNCH_GRAV_MULT:  0.4,    // 重力 0.4 倍：vy=22 でもしばらく滞空、頂点が見える
  LOWER_LAUNCH_VY:         14,     // 下半身（stand）の上方初速：上半身より控えめでゆっくり浮く
  LOWER_LAUNCH_VX_JITTER:  2,
  LOWER_LAUNCH_ANG_X:      0.18,   // 下半身の縦回転：控えめなふらつき程度
  LOWER_LAUNCH_GRAV_MULT:  0.5,    // 上半身よりはやや早く落ちる
  HEAD_LAUNCH_DELAY:       42,     // 約 0.7 秒（60fps × 0.7）後に爆発
  HEAD_LAUNCH_BODY_KB_X:   80,     // 胴体（残った stand 含む e.mesh）を fallDir 方向に瞬間ノックバック（SP2 踏み込み重なり対策）
  HEAD_LAUNCH_CAM_LIFT:    150,    // armed crit_head_fly 中のカメラ持ち上げ量（地面べた付き感の解消）
  // slam_radial_split バリアント（gc_05：叩きつけ → 上半身放射分散 + 下半身突き刺し → 0.7 秒後爆発）
  SLAM_DELAY:              42,     // 爆発までの待機（0.7 秒）
  SLAM_RADIAL_SPEED:       16,     // 上半身パーツの放射速度（base）
  SLAM_RADIAL_SPEED_JITTER: 4,     // 放射速度のばらつき（±）
  SLAM_UP_SPREAD_DEG:      60,     // 上半身放射の上方扇形半角（垂直から ±60°）
  SLAM_BODY_HORIZ_DEG:     30,     // body は上下幅広め（水平 ±30°）／head はより上向き
  SLAM_STAND_STICK_Y:     -10,     // 下半身が地面にめり込む y 位置
  SLAM_STAND_ROT_X:        Math.PI,  // 下半身を逆さま（rotation.x = π）にする
};

// ============================================================
//  #section player-profile — プレイヤーキャラごとの拡張プロファイル
//   - ゴア・クリティカルの発火条件・爆散バリアントなど、キャラ毎の挙動を集約
//   - 敵側は e.lastHitter.profileKey でこの dict を引いて使う
//   - 将来：チップ・OC で profile を mutate して挙動を変える運用も想定
// ============================================================
export const PLAYER_PROFILE = {
  METEO: {
    gore: {
      // ゴア・クリティカル登録：ID（c01_gc_NN）ごとに定義
      //   NN は被弾側の atk_lv に対応：03=後方吹き飛ばし / 04=打ち上げ / 05=叩きつけ / 06=超吹き飛ばし
      //   1 ヒットの lv に応じて自動的に対応する variant が抽選対象になる
      variants: {
        'c01_gc_06': {
          label:           '超吹き飛ばし（lv06）→ 壁/床 stick → プレイヤー方向爆散',
          atk_lv:          6,            // この lv のヒットだけ抽選対象（atk_lv_air を含む実効 lv）
          // killing hit 側のホワイトリスト（attackId）。指定 attackId 以外は不発
          triggers:        (attackId) =>
            attackId?.startsWith('c01_sp_04_') || attackId === 'c01_sp_01_air',
          requiredParts:   ['body', 'head'],  // 上半身（胴体+頭）両方残存が条件（every）
          explosionVariant:'wall_blast_toward_player',  // enemy-system 内ディスパッチキー
        },
        'c01_gc_03': {
          label:           '後方吹き飛ばし（lv03）→ 赤発光 → 胴体/下半身が逆回転きりもみで後方へ',
          atk_lv:          3,
          // 必殺技限定（c01_sp_*）：通常 J コンボの c01_atk_04 が atk_lv_air=3 を持つため、
          //   triggers 未指定だと J 連打中に発火していた（2026-05-19 修正）
          //   ULT（c01_sp_ult01）は atk_lv=3 だが演出が衝突するため除外（2026-05-19 ユーザー指示）
          triggers:        (attackId) =>
            attackId?.startsWith('c01_sp_') && attackId !== 'c01_sp_ult01',
          requiredParts:   ['body'],          // 胴体残存のみが条件（地上/空中 問わず発火）
          explosionVariant:'split_back_blast',
          freezeFrames:    8,                  // hitstop 抑制（標準 18F → 8F）
        },
        'c01_gc_04': {
          label:           '上半身打ち上げ（lv04）→ 胴体から上がまとめて縦回転で上昇 → 0.7 秒後爆発',
          atk_lv:          4,
          triggers:        undefined,         // ホワイトリストなし（lv4 ヒットなら attackId 問わず）
          requiredParts:   ['body'],          // 胴体残存が条件（バンドル分離するため body が必須）
          requireGrounded: true,              // 地上敵のみ（空中敵は除外）
          explosionVariant:'head_launch_delayed',
        },
        'c01_gc_05': {
          label:           '叩きつけ（lv05）→ 上半身放射分散 + 下半身突き刺し → 0.7 秒後爆発',
          atk_lv:          5,
          // 必殺技限定（c01_sp_*）：派生技 c01_add_03（↓J 払い）が atk_lv_air=5 を持つため、
          //   triggers 未指定だと空中ヒットで gc_05 が誤発火していた（2026-05-19 修正）
          triggers:        (attackId) => attackId?.startsWith('c01_sp_'),
          requiredParts:   ['body'],          // 胴体残存が必須
          // requireGrounded なし：地上/空中問わず発火（実装側で y=0 に強制 slam）
          explosionVariant:'slam_radial_split',
        },
      },
    },
  },
};

// ============================================================
//  #section周辺 CONFIG（Step C-2 分離分）
//  - CAM_CONFIG / PIXEL_SHADER / OUTLINE_CONFIG / CHARGE_*_CONFIG
//  - COMBO_LEVELS / getComboLevel / SLOWMO / KEY_CONFIG
// ============================================================

// ============================================================
//  カメラ設定（デュアルカメラ：メイン Ortho + 背景 Perspective）
// ============================================================
export const CAM_CONFIG = {
  // メインカメラ（正投影・キャラ用）
  ORTHO_H: 700,  // 正投影フラスタム高さ（小さいほど拡大）
  CAM_Y:   400,  // カメラ基準高さ
  CAM_Z:   1000, // カメラZ（傾きに影響）
  LOOK_Y:  0,    // 注視点Y（床面）
  // 背景カメラ（Perspective・俯瞰パース用）
  BG_FOV:   5,    // 背景FOV（超望遠・透視収束を最小化）
  BG_CAM_Y: 500,  // 背景カメラ高さ
  BG_CAM_Z: 6000, // 背景カメラZ（遠くに引いてOrthoに近づける）
  BG_LOOK_Y: 0,  // 背景注視点Y
};

// ============================================================
//  ピクセルシェーダー設定（P キーで ENABLED トグル）
// ============================================================
export const PIXEL_SHADER = {
  ENABLED: true,
  RT_W: 640,  // 1920/3 — 細かめのドット感（480より1段上）
  RT_H: 360,  // 1080/3 — 16:9 比率を維持
};

// ============================================================
//  アウトライン（ポストエフェクト方式）
//  - 別 RT に「対象オブジェクトだけ白マスク」を描き、最終ブリット時に
//    マスクの隣接ピクセル比較でシルエット外側 1〜2 px に色を載せる方式
//  - TARGETS には playerMesh をプレイヤー初期化後に push する（後段で実行）
//  - COLOR は hex 数値（純データ）。利用側で new THREE.Color(...) 化
// ============================================================
export const OUTLINE_CONFIG = {
  ENABLED:        true,
  COLOR:          0xffffff,  // 数値：利用側で new THREE.Color() に変換
  THICKNESS_PX:   2,         // 検出窓（マスク RT 上の px 単位）
  MASK_W:         960,       // マスク RT 解像度（半解像度で十分にクリア）
  MASK_H:         540,
  TARGETS:        [],
};

// ============================================================
//  チャージリング設定（必殺技チャージ成立時の収束リング）
// ============================================================
export const CHARGE_RING_CONFIG = {
  FRAMES:        20,   // 拡散に掛けるフレーム数
  START_RADIUS:  40,   // 体内側スタート（小）
  END_RADIUS:    280,  // 外へ広がる終端（大）
  Y_OFFSET:      100,  // プレイヤー Y からの中心オフセット（みぞおち位置）
};

// ============================================================
//  チャージ収束粒子設定（ロックマン式チャージ中の吸い込み粒子）
// ============================================================
export const CHARGE_PARTICLE_CONFIG = {
  SPAWN_PER_FRAME:  2,      // 毎フレームのスポーン数
  SPAWN_RADIUS:     180,    // スポーン距離
  LERP:             0.18,   // プレイヤーへの引き寄せ係数
  ARRIVE_DIST:      30,     // 到達判定距離
  COLOR:            0xffee44,
  SIZE:             5,
};

// ============================================================
//  コンボレベル定義（ヒット数 → 演出強度）
//  - 将来: glowColor / shakeScale 等の追加で各 lv の演出を増やす想定
// ============================================================
export const COMBO_LEVELS = [
  { threshold:  1, barColor: '#ffaa44', numColor: '#ffffff' },  // lv1: 白
  { threshold: 10, barColor: '#ffdd00', numColor: '#ffff44' },  // lv2: 黄
  { threshold: 20, barColor: '#ff8800', numColor: '#ff8800' },  // lv3: オレンジ
  { threshold: 30, barColor: '#cc44ff', numColor: '#ff44ff' },  // lv4: 紫（フレンジー）
];

// ヒット数からレベルを引く（最後にしきい値を超えたレベルを返す）
export function getComboLevel(count) {
  let lv = COMBO_LEVELS[0];
  for (const l of COMBO_LEVELS) { if (count >= l.threshold) lv = l; }
  return lv;
}

// ============================================================
//  スロー再生（デバッグ用・数字キー 3 でサイクル）
//    divisor: 1=通常 / 2=半速 / 4=1/4速 / 8=1/8速
//    counter < divisor の間は update をスキップし render のみ → スロー感
// ============================================================
export const SLOWMO = {
  LEVELS:   [1, 2, 4, 8],
  levelIdx: 0,
  divisor:  1,
  counter:  0,
};

// ============================================================
//  キーコンフィグ（将来オプション画面でリバインド可能な設計）
//  PAD_BUTTON_MAP の kb 値と対応させることで pad も自動追従する
// ============================================================
export const KEY_CONFIG = {
  moveLeft:     { kb: 'ArrowLeft',  kb2: 'KeyA'  },
  moveRight:    { kb: 'ArrowRight', kb2: 'KeyD'  },
  moveUp:       { kb: 'ArrowUp',    kb2: 'KeyW'  },
  moveDown:     { kb: 'ArrowDown',  kb2: 'KeyS'  },
  jump:         { kb: 'Space'                     },
  weakAttack:   { kb: 'KeyJ'                      },
  strongAttack: { kb: 'KeyK'                      },
  secondary:    { kb: 'KeyL'                      },
  megaCrash:    { kb: 'KeyU'                      }, // U / R1（J+K同時も発動）
  ult:          { kb: 'KeyI'                      }, // I / R2（J+K+L同時も発動）
};
