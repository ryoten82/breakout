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
  // === SP2 ホールド分岐（2026-05-26）===
  // ↑+K 押下時にチャージ開始。リリースまでの経過 F で「単発（弱形態）」/「粉塵昇竜（強形態）」を分岐。
  // 短押し（< SP2_HOLD_FRAMES）→ c01_sp_02_air（単発打ち上げ・空中地上共通）
  // 長押し（≥ SP2_HOLD_FRAMES）→ 地上：c01_sp_02 粉塵昇竜 / 空中：c01_sp_02_air（空中昇竜なし）
  // 最大 F に達したらリリース待たず自動発動（昇竜版）
  SP2_HOLD_FRAMES:     12,   // 約 0.2 秒（粉塵昇竜分岐の閾値）
  SP2_HOLD_FRAMES_MAX: 30,   // 約 0.5 秒（強制発動）
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
  CRASH_THRESHOLD:       0,    // この SP 以下になったらクラッシュ（SP 枯渇クラッシュ）
  CRASH_RECOVER_FRAMES:  60,   // ガードクラッシュ硬直
  FRONT_ONLY:            true, // 前方からの攻撃のみガード成立
  // --- ガード強度システム（14-E）---
  //  クリーンガードの反動 KB（atk_lv 別・vx。HIT_KB_DECAY 0.82 → 距離 ≒ vx × 5.6）：
  //  lv1/lv7 弱反動 / lv2 中反動（半キャラ） / lv3 大反動（1キャラ）
  RECOIL_KB_BY_LV:  { 1: 5, 2: 9, 3: 18, 7: 5 },
  CRASH_KB_VX:      12,   // ガードクラッシュの大反動（knockback02・約1.5キャラ）
  CRASH_SP_COST:    10,   // クラッシュ時の SP 消費（0.5 ストック ＝ STOCK_SIZE 20 × 0.5）
  CRASH_SHIELD_FADE: 16,  // クラッシュ砕け散りアニメのフレーム数（元位置で拡大→消滅）
};

// ============================================================
//  #section enemy-ai-dummy — 雑魚敵 AI の移動・間合いパラメータ（Phase 2.4〜3）
//  - SB.ENEMY_AI.enabled で全敵 AI をトグル（数字キー 4 で切替）
//  - 接近 → 攻撃（ENEMY_ATTACKS）→ recover → cooldown → retreat → 接近...
//  - 攻撃モーション・ヒット値は ENEMY_ATTACKS 側（本テーブルは移動・間合いのみ）
// ============================================================
export const ENEMY_AI = { enabled: true };
export const DUMMY_ATK_CONFIG = {
  approachRange:    400,   // この距離以下で接近開始（aiPhase=chase）。遭遇判定／ダッシュ追跡境界も兼ねる
  attackRange:      130,   // この距離以下で基本振り（e01_atk_01）発動
  dashTackleRange:  350,   // attackRange 〜本値の中距離帯で突進タックル（e01_atk_02）発動
  atkSelectOverlap: 24,    // 近/中の境界に設ける重なり帯の幅（ここだけ性格 weight で抽選）
  approachSpeed:    1.4,   // 接近移動速度（wu/F）
  zChaseFactor:     0.6,   // Z 追従速度のプレイヤー比（SPEED×Z_SPEED_MULT に対する倍率）
  // ダッシュ追跡（14-D-4）：遭遇後、自機が approachRange 外へ離れたら発動
  dashChaseBeat:    28,    // ダッシュ開始前の「ワンテンポ」待機F
  dashChaseSpeed:   5.5,   // ダッシュ追跡の移動速度（wu/F・通常接近 1.4 より速い）
  dashChaseStop:    300,   // ダッシュはこの距離まで詰めたら終了 → 通常追跡へ戻る
  minTackleRange:   200,   // 突進タックルを出す最小距離（これ未満は基本振りのみ・至近距離での誤タックル防止）
  // Phase 3 AI ステート明示化（aiPhase）: retreat フェーズ用
  retreatFrames:        40,   // 攻撃 recover 後の強制後退時間
  retreatSpeed:         1.0,  // 後退時の移動速度（wu/F・approachSpeed より控えめ）
  postHitRetreatFrames: 30,   // 被弾→wait01 復帰後の後退時間（被弾後の間合い取り）
};

// ============================================================
//  #section enemy-attacks — 雑魚敵の攻撃テーブル（14-D・enem01.md §攻撃カタログ）
//  - 攻撃ごとに wind/active/recover/cooldown とヒット値（tryHitPlayer 互換）を定義
//  - e.curAtkId で現在の攻撃を参照。新規攻撃はここに 1 エントリ追加する
//  - pitchWind/pitchActive：rotation.x で振りの予兆と踏み込みを表現（読みやすさの担保）
//  - 値はランタイム調整可：window.SB.ENEMY_ATTACKS.e01_atk_01.damage = 12 など
// ============================================================
export const ENEMY_ATTACKS = {
  // enem01（スクラッパー）基本振り：短リーチ・速い・読みやすい牽制
  e01_atk_01: {
    name:           '基本振り',
    kind:           'swing',  // 攻撃の種類（swing=その場振り / dash=突進タックル）
    attackCategory: 'melee',
    windFrames:     18,    // 溜め（予兆モーション）
    activeFrames:   8,     // 当たり判定アクティブ
    recoverFrames:  25,    // 振り終わり硬直
    cooldownFrames: 45,    // 次の攻撃までのインターバル（連打抑止）
    lungeVx:        8,     // active 突入時の踏み込み量（wu）
    hitboxRangeX:   110,
    hitboxRangeY:   90,
    hitboxRangeZ:   80,
    damage:         5,     // 一旦半減（旧 10・敵攻撃力 暫定調整）
    atk_lv:         1,
    knockback:      12,
    hitstop:        5,
    shake:          4,
    hitColor:       0xff8844,
    pitchWind:     -0.20,  // 溜め：のけぞって予兆（プレイヤーに読ませる）
    pitchActive:   +0.32,  // 振り：前傾の踏み込み
  },
  // enem01 突進タックル：中距離から dash で詰める。外すと recover が長く＝攻めどころ
  //   active は固定フレームではなく「ヒット / 壁 / dashMaxDist」のいずれかで終了する
  e01_atk_02: {
    name:           '突進タックル',
    kind:           'dash',
    attackCategory: 'melee',
    windFrames:     32,    // 溜め（突進の予兆・読みやすさ重視で長め）
    activeFrames:   60,    // 突進の最大持続F（通常は dashMaxDist 到達で早期終了）
    recoverFrames:  35,    // 突進終了後の硬直（外し時の攻めどころ）
    cooldownFrames: 90,    // 次の攻撃までのインターバル（基本振りの 2 倍・連発しない）
    dashSpeed:      9,     // 突進速度（wu/F・仕様 3.5 は遅すぎたため引き上げ・SB で調整可）
    dashMaxDist:    420,   // 突進の最大移動距離（wu・これか壁で停止）
    hitboxRangeX:   140,
    hitboxRangeY:   90,
    hitboxRangeZ:   100,
    damage:         9,     // 一旦半減（旧 18・敵攻撃力 暫定調整）
    atk_lv:         3,
    knockback:      22,
    hitstop:        7,
    shake:          6,
    hitColor:       0xff4422,
    pitchWind:     -0.30,  // 溜め：深くのけぞる（基本振りより大きい予兆）
    pitchActive:   +0.42,  // 突進：大きく前傾
  },

  // -------------------------------------------------------
  // enem02（ジャンパー）攻撃
  // -------------------------------------------------------
  // 小ジャンプ攻撃：短いホップで前進→空中でぶつかる。外すと recover が短め
  e02_atk_01: {
    name:           '小ジャンプ攻撃',
    kind:           'hop_strike',
    attackCategory: 'melee',
    windFrames:     12,   // 短い溜め（素早い）
    activeFrames:   45,   // ホップ中の最大持続（着地で打ち切り）
    recoverFrames:  18,
    cooldownFrames: 50,
    hopVy:          10,   // 上昇初速（軽いホップ）
    dashSpeed:      9,    // 水平移動速度（wu/F）
    dashMaxDist:    200,  // 水平距離上限（wu）
    hitboxRangeX:   100,
    hitboxRangeY:   90,   // 空中ヒット用にやや高め
    hitboxRangeZ:   80,
    damage:         7,
    atk_lv:         2,
    knockback:      16,
    hitstop:        5,
    shake:          4,
    hitColor:       0x44ccff,
    pitchWind:     -0.20,
    pitchActive:   +0.35,
  },
  // ジャンプ急降下（3段階予兆付き）
  //   Phase 1：wind で~2s しゃがみ溜め（第1予兆）
  //   Phase 2：高速上昇→頂点で照準フェーズ（第2予兆：AOE + 収束リング）
  //   Phase 3：リング収束完了で超高速急降下（atklv 5/5/-）
  //   リパルスカウンター対象：自機 atklv4（SP1/↑J）で迎撃すると成立
  e02_atk_02: {
    name:            'ジャンプ急降下',
    kind:            'jump_dive',
    attackCategory:  'aerial',
    windFrames:      120,   // ~2s しゃがみ溜め（第1予兆）
    activeFrames:    360,   // 上昇＋照準＋降下の最大持続F（フォールバック）
    recoverFrames:   40,
    cooldownFrames:  110,
    jumpVy:          35,    // 上昇初速（頂点≈747wu ≈ キャラ7体分・要調整）
    aimFrames:       80,    // 照準フェーズ：二次リングが収束するまでの F
    aoeRadius:       120,   // 一次 AOE サークル半径（wu・要調整）
    ringStartRadius: 360,   // 二次リング開始半径（wu）
    diveSpeed:       45,    // 急降下速度（wu/F・物理を無視した直接移動）2026-05-26：80→56→45（更に 80% 削減）
    hitboxRangeX:    110,
    hitboxRangeY:    150,   // 縦長（叩きつけ）
    hitboxRangeZ:    110,
    damage:          14,
    atk_lv:          5,     // atklv 5/5/-（溜め・ヒット共に5・recover は無し）
    knockback:       28,
    hitstop:         10,    // 中程度のヒットストップ
    shake:           8,
    hitColor:        0xff3300,
    pitchWind:      -0.30,
    pitchActive:     0,     // 空中飛翔中は傾けない
    repulseAxis:    'aerial',  // リパルスカウンター軸（対空 = sp_02 昇竜で迎撃）
    // RC 受付ボックス（敵側・パリィボックス・2026-05-26）：
    //   ジャンパー飛び降りの「先端」＝足元前方に広めの受付窓。
    //   敵基点（敵の x,y,z）+ facing 反転で配置。アクティブな期間は repulseWindow=true（aim フェーズ中）。
    repulseTargetBox: { offsetX: 0, offsetY: -40, w: 240, h: 160, d: 140 },
  },

  // -------------------------------------------------------
  // midboss01（シールドガーダー）攻撃 — 中ボス相当・守勢型
  // -------------------------------------------------------
  // 盾叩き：盾を大きく構えてから前方を突き押す。リーチ広め・ガード崩し感あり
  mb01_atk_01: {
    name:           'シールドバッシュ',
    kind:           'swing',
    attackCategory: 'melee',
    windFrames:     18,
    activeFrames:   8,
    recoverFrames:  22,
    cooldownFrames: 60,
    lungeVx:        10,
    hitboxRangeX:   80,
    hitboxRangeY:   90,
    hitboxRangeZ:   70,
    damage:         8,
    atk_lv:         2,
    knockback:      10,
    hitstop:        5,
    shake:          4,
    hitColor:       0xaaaacc,
    pitchWind:     -0.25,
    pitchActive:   +0.38,
  },
  // 怒り狂い連打：盾破壊後。近〜中距離の 2 段連打。
  mb01_atk_02: {
    name:           '怒り狂い連打',
    kind:           'swing',
    attackCategory: 'melee',
    windFrames:     8,
    activeFrames:   12,
    recoverFrames:  25,
    cooldownFrames: 75,
    lungeVx:        10,
    hitboxRangeX:   100,
    hitboxRangeY:   90,
    hitboxRangeZ:   80,
    damage:         6,
    atk_lv:         2,
    knockback:      8,
    hitstop:        5,
    shake:          5,
    hitColor:       0xccaa44,
    pitchWind:     -0.22,
    pitchActive:   +0.42,
  },
  // ガードカウンター：盾で受け続けた直後に放つ素早い盾バッシュ。wind が極端に短い。
  mb01_atk_gc: {
    name:           'ガードカウンター',
    kind:           'swing',
    attackCategory: 'melee',
    windFrames:     8,     // 極短（即反撃感）
    activeFrames:   8,
    recoverFrames:  28,
    cooldownFrames: 55,
    lungeVx:        18,    // 前に強く踏み込む
    hitboxRangeX:   130,
    hitboxRangeY:   110,
    hitboxRangeZ:   90,
    damage:         10,
    atk_lv:         2,
    knockback:      22,
    hitstop:        7,
    shake:          6,
    hitColor:       0xaaccff,
    pitchWind:     -0.12,
    pitchActive:   +0.50,
  },
  // マチェットラッシュ：enraged 時のみ。突進しながら 3 連続斬撃（atk_lv 2/2/3）。
  //   突進自体は無攻撃。hitSlots の各 frame で当たり判定を出す（slash_rush kind）。
  mb01_atk_03: {
    name:           'マチェットラッシュ',
    kind:           'slash_rush',
    attackCategory: 'melee',
    windFrames:     14,
    activeFrames:   36,
    recoverFrames:  120,  // 疲れ硬直 約2秒（この間 SA 無効・攻撃の隙）
    cooldownFrames: 90,
    dashSpeed:      5.0,
    dashMaxDist:    550,
    hitboxRangeX:   150,
    hitboxRangeY:   110,
    hitboxRangeZ:   90,
    multiHit:       true,  // hitstun 中プレイヤーにも 2・3 発目が着弾
    // 3 スロット当たり判定（elapsed フレームで順次発火）
    hitSlots: [
      { frame:  8, damage:  7, atk_lv: 2, knockback: 12 },
      { frame: 20, damage:  7, atk_lv: 2, knockback: 12 },
      { frame: 32, damage: 11, atk_lv: 3, knockback: 20 },
    ],
    hitstop:        5,
    shake:          4,
    hitColor:       0xddaa22,
    pitchWind:     -0.20,
    pitchActive:   +0.35,
  },

  // -------------------------------------------------------
  // boss01（CRUSHER 暫定）攻撃 — Stage1 本ボス・完全 SA・AOE 多彩
  // -------------------------------------------------------
  // 全攻撃 stub（命中ロジックは未実装 / wind・recover の予兆だけでも動作確認用）
  // 仕様：chars/boss01.md §攻撃カタログ
  //
  // boss1_atk_01〜03：Phase 1 AOE 3 種
  // boss1_atk_04    ：Phase 2 派生（二段薙ぎ払い）
  // boss1_atk_05    ：Phase 3 必殺技（CRUSHER STOMP / RC 対象）
  // boss1_atk_06    ：Phase 3 大技（DOUBLE RUSH TACKLE / RC 対象外・SA 崩しトリガー）
  boss1_atk_01: {
    name:           'クラッシャー振り下ろし',
    kind:           'swing',
    attackCategory: 'melee',
    windFrames:     40,
    activeFrames:   12,
    recoverFrames:  30,
    cooldownFrames: 90,
    lungeVx:        4,
    hitboxRangeX:   200,
    hitboxRangeY:   180,
    hitboxRangeZ:   140,
    damage:         14,
    atk_lv:         4,
    knockback:      28,
    hitstop:        7,
    shake:          8,
    hitColor:       0xffaa33,
    pitchWind:     -0.32,
    pitchActive:   +0.48,
  },
  boss1_atk_02: {
    name:           '横薙ぎなぎ払い',
    kind:           'swing',
    attackCategory: 'melee',
    windFrames:     35,
    activeFrames:   18,
    recoverFrames:  35,
    cooldownFrames: 100,
    lungeVx:        2,
    hitboxRangeX:   320,
    hitboxRangeY:   140,
    hitboxRangeZ:   140,
    damage:         14,
    atk_lv:         4,
    knockback:      32,
    hitstop:        7,
    shake:          10,
    hitColor:       0xffaa33,
    pitchWind:     -0.28,
    pitchActive:   +0.18,
  },
  boss1_atk_03: {
    name:           '地響き衝撃波',
    kind:           'swing',  // TODO: 専用 kind='shockwave_aoe' を別セッションで設計
    attackCategory: 'melee',
    windFrames:     45,
    activeFrames:   20,
    recoverFrames:  40,
    cooldownFrames: 110,
    lungeVx:        0,
    hitboxRangeX:   260,
    hitboxRangeY:   80,
    hitboxRangeZ:   260,
    damage:         16,
    atk_lv:         5,
    knockback:      36,
    hitstop:        8,
    shake:          12,
    hitColor:       0xff8822,
    pitchWind:     -0.42,
    pitchActive:   +0.55,
  },
  boss1_atk_04: {
    name:           '二段薙ぎ払い',
    kind:           'swing',
    attackCategory: 'melee',
    windFrames:     28,
    activeFrames:   22,
    recoverFrames:  40,
    cooldownFrames: 130,
    lungeVx:        3,
    hitboxRangeX:   360,
    hitboxRangeY:   140,
    hitboxRangeZ:   140,
    damage:         15,
    atk_lv:         4,
    knockback:      30,
    hitstop:        7,
    shake:          11,
    hitColor:       0xffaa33,
    pitchWind:     -0.30,
    pitchActive:   +0.20,
  },
  // CRUSHER STOMP（Phase 3 必殺技・リパルスカウンター対象）
  // 大ジャンプ → 落下叩きつけ → 全画面衝撃波
  boss1_atk_05: {
    name:           'CRUSHER STOMP',
    kind:           'swing',  // TODO: 専用 kind='boss_smash_aoe' で大ジャンプ → 落下 → 衝撃波
    attackCategory: 'melee',
    windFrames:     55,
    activeFrames:   25,
    recoverFrames:  60,
    cooldownFrames: 480,  // 約 8 秒（Phase 3 で控えめに発動）
    lungeVx:        0,
    hitboxRangeX:   500,  // 全画面想定
    hitboxRangeY:   200,
    hitboxRangeZ:   320,
    damage:         28,
    atk_lv:         6,
    knockback:      50,
    hitstop:        12,
    shake:          18,
    hitColor:       0xff4422,
    pitchWind:     -0.50,
    pitchActive:   +0.65,
    repulseAxis:   'ground',  // リパルスカウンター対象（弾き = 確定クリ + 100% gc）
  },
  // DOUBLE RUSH TACKLE（Phase 3 大技・RC 対象外・SA 崩しトリガー）
  // 溜め → 反対画面端タックル → 振り返り → 反対端タックル（計 2 往復）→ 大 recover 硬直
  boss1_atk_06: {
    name:           'DOUBLE RUSH TACKLE',
    kind:           'slash_rush',  // TODO: 専用 kind='boss_double_tackle' を別セッションで設計
    attackCategory: 'melee',
    windFrames:     60,           // 溜め動作（大きく予兆）
    activeFrames:   80,           // 暫定：active 中に画面端往復処理（実装は別途）
    recoverFrames:  90,           // 大きな recover 硬直（SA 崩しトリガー対象）
    cooldownFrames: 480,          // 約 8 秒
    dashSpeed:      8.0,
    dashMaxDist:    1600,         // 画面端到達想定
    hitboxRangeX:   220,
    hitboxRangeY:   180,
    hitboxRangeZ:   140,
    multiHit:       true,
    hitSlots: [
      { frame: 10, damage: 18, atk_lv: 5, knockback: 36 },  // 往復1 開始
      { frame: 50, damage: 18, atk_lv: 5, knockback: 36 },  // 往復2 開始（暫定値）
    ],
    hitstop:        9,
    shake:          12,
    hitColor:       0xff8833,
    pitchWind:     -0.25,
    pitchActive:   +0.40,
    saBreakOnRecover: true,  // recover 中は SA 解除（プレイヤーが反撃可能）
  },
};

// ============================================================
//  #section enemy-attack-relay — 敵同士の攻撃テンポ（14-D-5）
//  - ある敵の攻撃が終わってから、次の敵が攻撃を始められるまでの待ち時間。
//  - 「敵同士が見合う」間（ま）を作る。VARIANCE で毎回ばらつかせテンポを一定にしない。
//  - 実際の待ち ＝ BASE ×（1 ± VARIANCE のランダム）。
// ============================================================
export const ENEMY_ATTACK_RELAY = {
  BASE:     45,   // 攻撃終了 → 次の攻撃可能までの基準F
  VARIANCE: 0.5,  // 振れ幅（±50%）。実待ち ＝ BASE × [0.5, 1.5]
};

// ============================================================
//  #section enemy-personality — 雑魚敵の性格別 行動傾向（#14・enem01.md §性格軸）
//  - spawnDummy で e.personality に応じて guardTendency 等を引く
//  - brave：攻撃的。ガード/回避は控えめ・打たれ強い（stagger しにくい＝閾値高め）
//  - cunning：狡猾。ガード/回避を多用・やや stagger しやすい（閾値低め）
//  - coward は通常雑魚には付かない（leader 死亡降格 / キャリア型のみ・将来実装）
//  - 値はランタイム調整可：window.SB.ENEMY_PERSONALITY.cunning.dodgeTendency = 0.6 など
// ============================================================
//  - enragedHp：HP がこの割合以下で興奮（enraged）。brave は早発（高 HP で発火）
//  - 攻撃頻度（14-D-2・enem01.md §性格軸 レイヤー1-3）：
//    - atk02Weight：近/中の重なり帯で突進タックルを選ぶ確率（残りが基本振り）
//    - cooldownMult：攻撃クールダウン倍率（brave 0.7＝短い＝追ってくる）
//    - retreatMult：攻撃後 retreat の長さ倍率（brave ≈0＝退却拒否で前のめり）
//    - punishesHitstun：true なら「プレイヤー被弾中」でも攻撃可（brave の追撃確定）
export const ENEMY_PERSONALITY = {
  brave:    { guardTendency: 0.12, dodgeTendency: 0.08, staggerThreshold: 6, enragedHp: 0.50,
              atk02Weight: 0.60, cooldownMult: 0.7, retreatMult: 0.15, punishesHitstun: true },
  cunning:  { guardTendency: 0.40, dodgeTendency: 0.45, staggerThreshold: 4, enragedHp: 0.38,
              atk02Weight: 0.50, cooldownMult: 1.0, retreatMult: 1.0,  punishesHitstun: false },
  // guardian：盾特化。頻繁にガード姿勢を取り、隙を見て攻撃。dodge はほぼしない
  guardian: { guardTendency: 0.65, dodgeTendency: 0.05, staggerThreshold: 5, enragedHp: 0.30,
              atk02Weight: 0.50, cooldownMult: 1.0, retreatMult: 0.5,  punishesHitstun: false },
  // berserker：中ボス専用。読み合い・回避・退却をしない前のめりの攻め。
  //   guard/dodgeTendency 0＝防御抽選が常に不成立。retreatMult 0＝攻撃後に退かない。
  //   enragedHp 0＝HP% 興奮は発火せず、enraged 化は盾破壊でのみ起こる（midboss01）。
  //   staggerThreshold 80＝雑魚スケール（4〜6）に対し桁違いに打たれ強い。
  berserker:{ guardTendency: 0.0,  dodgeTendency: 0.0,  staggerThreshold: 80, enragedHp: 0.0,
              atk02Weight: 0.50, cooldownMult: 1.0, retreatMult: 0.0,  punishesHitstun: true },
};

// ============================================================
//  #section enemy-enrage — 雑魚敵の興奮（#14-C：HP 低下で攻撃頻度上昇）
//  - HP が personality.enragedHp 以下で 1 度だけ enraged 化（enraged_intro モーション → 継続）
//  - 興奮中は攻撃クールダウン短縮 + 接近速度上昇。フィニッシュ局面の盛り上げ
// ============================================================
export const ENEMY_ENRAGE_CONFIG = {
  INTRO_FRAMES:  40,    // enraged_intro モーションの長さ
  COOLDOWN_MULT: 0.5,   // 興奮中の攻撃クールダウン倍率（攻撃頻度↑）
  APPROACH_MULT: 1.25,  // 興奮中の接近速度倍率
  // HP% 興奮トリガーのグローバル ON/OFF
  // false にすると enem01/enem02 の低 HP 興奮が無効化。
  // midboss01 の盾破壊 enraged 化は別経路（triggerShieldBreak）なのでこのフラグの影響を受けない。
  ENABLE_HP_ENRAGE: false,
};

// ============================================================
//  #section midboss-shield — midboss01 シールドガーダーの盾システム
//  - 盾は本体 HP と独立した「盾 HP」を持つ。前面攻撃は本体完全防御だが盾 HP は削れる。
//    背面/上からの攻撃は本体に通り、盾 HP もより大きく削れる。
//  - 盾 HP 0 で盾破壊 → SHIELD BREAK 演出 → enraged_intro → berserker 化。
//  - 叩き台値。window.SB.MIDBOSS_SHIELD_CONFIG で実機調整して決める。
// ============================================================
export const MIDBOSS_SHIELD_CONFIG = {
  SHIELD_MAX_HP:          102,   // 盾 HP（60 × 1.7 倍・前面のみで割るには数コンボ要する程度）
  GUARD_COUNTER_THRESHOLD:  3,   // 連続ブロック数でガードカウンター発動
  BERSERKER_SA:             2,   // berserker 化時に付与するスーパーアーマー値（hits）
  CHIP_FRONT_MULT: 1.0,   // 前面ヒット時の盾削り倍率（攻撃素ダメージ基準）
  CHIP_BACK_MULT:  2.5,   // 背面/上ヒット時の盾削り倍率（前面より大きい）
  BREAK_HITSTOP:   14,    // 盾破壊の強ヒットストップ F
  BREAK_SHAKE:     12,    // 盾破壊のシェイク強度
  BANNER_FRAMES:   60,    // "SHIELD BREAK!" バナー表示 F（約 1 秒）
};

// ============================================================
//  #section boss01-config — boss01（CRUSHER）本ボス設定（仕様：chars/boss01.md）
//  - 完全 SA・3 段フェーズ・HP ゲートで境界停止 + メガクラ流用移行演出
//  - 仮値（要実 DPS 計測）。実装は別セッション（フェーズ移行ロジック等）
//  - window.SB.BOSS01_CONFIG で実機調整
// ============================================================
export const BOSS01_CONFIG = {
  // HP（仮値・midboss01=300 × 6 = 1800）
  MAX_HP:                 1800,
  // フェーズ境界 HP（HP ゲートで必ず 1 残して停止 → メガクラ移行発火）
  PHASE_1_TO_2_GATE_HP:   1080,  // Phase 1 → 2 境界（40% 削った地点）
  PHASE_2_TO_3_GATE_HP:    360,  // Phase 2 → 3 境界（80% 削った地点）
  // Phase 3 逆境スイッチ
  PHASE_3_WIND_MULT:      0.90,  // wind を -10%
  PHASE_3_COOLDOWN_MULT:  0.80,  // 攻撃間隔 -20%
  PHASE_3_MOVE_MULT:      1.20,  // 移動速度 +20%
  // Phase 2 高速化（Phase 1 同攻撃を高速化）
  PHASE_2_WIND_MULT:      0.80,  // wind を -20%
  PHASE_2_COOLDOWN_MULT:  0.75,  // cooldown を -25%
  // メガクラ移行演出（プレイヤーメガクラ流用・色変更）
  PHASE_TRANSITION_COLOR: 0xff3322,  // 赤系
  PHASE_TRANSITION_FRAMES: 90,        // メガクラ duration 流用想定
  // SA 崩しトリガー
  SA_BREAK_ON_RC:         true,   // リパルスカウンター成功で完全 SA 崩し
  SA_BREAK_ON_ULT:        true,   // ULT 命中で SA 崩し（試験的）
  SA_BREAK_STUN_FRAMES:   45,     // SA 崩し時のスタン F
  // サイズ（メッシュスケール）
  MESH_SCALE:             4.0,   // midboss01 比 4 倍（80m 相当）
};

// ============================================================
//  #section item-pickup — HP/SP タンク pickup インフラ（仕様書 §18）
//  - container（crate / canister）破壊時に「CR は常時ドロップ＋確率テーブルで追加抽選」。
//  - lootOverride（ステージ配置 props 側に loot:'hp_tank' 等）を指定すると確率を無視し
//    100% その item を確定ドロップ（ボス前に体力タンク確定など、設計者意図）。
//  - マグネット挙動は CR と統一手触り：cr-system.js の CR_CONFIG.MAGNET_* を流用するため、
//    item-system.js 側ではマグネット定数を持たない（流用元を変えれば連動する）。
// ============================================================
// HP 回復は 3 種（apple < burger < meat）にサイズと回復量で「嬉しさ」を表現。
//   見た目はメカ世界観と合わないが分かりやすさ優先（ユーザー方針 2026-05-25）。
// SP は 1 種のみ（エメラルドグリーンで SP バーと色同期）。
// チップは 5 レアリティ（white / green / blue / purple / orange）。
//   pickup 物理は他アイテムと共通。装飾は派手目で「最重要アイテム」感を出す。
//   Legendary のみ「茶柱（上空への光の柱）」演出 + 取得時専用 SE 鳴らし枠。
export const ITEM_KIND = {
  HP_APPLE:        'hp_apple',     // 小：リンゴ
  HP_BURGER:       'hp_burger',    // 中：ハンバーガー
  HP_MEAT:         'hp_meat',      // 大：骨付き肉（完全回復・最大サイズ・最大の嬉しさ）
  SP_TANK:         'sp_tank',      // SP：エメラルドグリーン
  CHIP_COMMON:     'chip_common',    // 白
  CHIP_UNCOMMON:   'chip_uncommon',  // 緑
  CHIP_RARE:       'chip_rare',      // 青
  CHIP_EPIC:       'chip_epic',      // 紫
  CHIP_LEGENDARY:  'chip_legendary', // オレンジ（+ 茶柱 + 専用 SE）
};

// チップレアリティの正本（2026-05-25 ユーザー指示・仕様書 §10/§1211 と同期）
//   旧仕様の「Legendary=金」は **オレンジ** へ変更。
export const CHIP_RARITY = {
  common:    { color: 0xffffff, glow: 0xffffff, label: 'Common',    mesh: 44 },
  uncommon:  { color: 0x44dd55, glow: 0x88ff99, label: 'Uncommon',  mesh: 48 },
  rare:      { color: 0x3388ff, glow: 0x77bbff, label: 'Rare',      mesh: 52 },
  epic:      { color: 0xaa55ff, glow: 0xcc99ff, label: 'Epic',      mesh: 58 },
  legendary: { color: 0xff8a22, glow: 0xffcc66, label: 'Legendary', mesh: 64 },
};

// chip kind → rarity key の対応
export const CHIP_KIND_RARITY = {
  chip_common:    'common',
  chip_uncommon:  'uncommon',
  chip_rare:      'rare',
  chip_epic:      'epic',
  chip_legendary: 'legendary',
};

// 通常 chip 抽選テーブル（コンテナの将来追加・ドロップ拡張で使う基準値・現状未使用）
//   common 主体・上に行くほど稀。合計 100。
export const CHIP_DROP_TABLE_NORMAL = [
  { kind: 'chip_common',    w: 60 },
  { kind: 'chip_uncommon',  w: 25 },
  { kind: 'chip_rare',      w: 12 },
  { kind: 'chip_epic',      w:  2.5 },
  { kind: 'chip_legendary', w:  0.5 },
];

// 「レア以上確定」抽選テーブル（ボス確定 1 個に使う）
//   rare 主体・epic 中、legendary 低確率（仕様 §10 「Stage 3 ボス Legendary 低確率」と整合）
export const CHIP_DROP_TABLE_RARE_PLUS = [
  { kind: 'chip_rare',      w: 70 },
  { kind: 'chip_epic',      w: 25 },
  { kind: 'chip_legendary', w:  5 },
];

// ボス共通ドロップ仕様（2026-05-25 ユーザー指示）：
//   - 確定で最低 BASE_COUNT 個（3）
//   - うち 1 個は CHIP_DROP_TABLE_RARE_PLUS で抽選（レア以上確定）
//   - 残りは CHIP_DROP_TABLE_NORMAL で抽選
//   - 上振れ：BONUS_CHANCE で +1、その後さらに HALF で +1 …と逓減（最大 BONUS_MAX 個）
//   仕様書 §10 の「Stage1=2-4 / Stage2=3-5 / Stage3=4-6」表は本ルールで統一上書き済み。
export const BOSS_CHIP_DROP_CONFIG = {
  BASE_COUNT:     3,    // 確定ドロップ個数
  GUARANTEED_RARE_PLUS: 1, // うちレア以上確定 個数
  BONUS_CHANCE:   0.35, // 1 個目の追加確率
  BONUS_HALF:     0.5,  // 2 個目以降は前回確率 × 本値 で逓減
  BONUS_MAX:      3,    // 追加最大個数
};

// バーの色（index.html CSS）と同期：HP=#ff4444 / SP=#22cc88（エメラルド）
export const HP_BAR_COLOR = 0xff4444;
export const SP_BAR_COLOR = 0x22cc88;

export const ITEM_CONFIG = {
  // HP 3 種：A<B<C でサイズと回復量がスケール
  HP_APPLE:  { HEAL_RATIO: 0.20, COLOR: HP_BAR_COLOR, MESH_SIZE: 32 },  // 20% 回復
  HP_BURGER: { HEAL_RATIO: 0.40, COLOR: HP_BAR_COLOR, MESH_SIZE: 44 },  // 40% 回復
  HP_MEAT:   { HEAL_RATIO: 1.00, COLOR: HP_BAR_COLOR, MESH_SIZE: 64 },  // 完全回復・最大サイズ
  SP_TANK:   { GAIN_STOCKS: 1,   COLOR: SP_BAR_COLOR, MESH_SIZE: 44 },  // 旧 22→44（2x）

  USE_CR_MAGNET:       true,   // CR_CONFIG.MAGNET_* を流用（true 固定運用・将来独立調整窓口）
  LIFE_PERSIST_FRAMES: 600,    // 10s @60FPS：完全永続表示
  LIFE_BLINK_FRAMES:   300,    //  5s：点滅して消滅予告
  BLINK_PERIOD_FRAMES:  10,    // 点滅 1 サイクルのフレーム数
  COLLECT_RANGE:        55,    // XZ 接触距離（CR と同じ）
  // 散らばり物理（CR と同等の手触り）
  SCATTER_VX:       4.0,
  SCATTER_VY:       9.0,
  GRAVITY:          0.5,
  GROUND_FRICTION:  0.78,
  BOUNCE_COEF:      0.42,
  MAX_BOUNCES:      2,
  BOUNCE_MIN_VY:    1.5,
  // 取得演出：CR コイン取得時の拡張リングを色変えで再現
  PICKUP_RING_FRAMES:     18,  // リング寿命 F
  PICKUP_RING_R_INNER:    18,  // リング内径
  PICKUP_RING_R_OUTER:    52,  // リング外径
  PICKUP_PARTICLE_COUNT:  14,  // sparkle 粒数
  // 吸引中の y ターゲット：プレイヤー胴体高（足元 y=0 ベース）
  //   pickup が床から目標 y へ ease 上昇し「胴体に吸われる」見た目を作る
  ABSORB_TARGET_Y:        60,  // wu（プレイヤー高さ 100wu のおおよそ中段）
  ABSORB_Y_LERP:          0.12, // 1F あたりの目標 y へ寄せる比率（0.12 ≒ 8F で 63% 到達）
  // 拾い不可猶予（2026-05-25 ユーザー指示）：
  //   spawn 直後にプレイヤー密着でも即吸引されないようにし、必ず広がる挙動を見せる。
  //   `landed === true` または `spawnFrames >= ARM_FRAMES_AFTER_SPAWN` のどちらか早い方で armed。
  //   CR_CONFIG.ARM_FRAMES_AFTER_SPAWN と同期して運用（CR も同じ仕様）。
  ARM_FRAMES_AFTER_SPAWN: 60,  // 1s @60FPS
};

// container 種別ごとの「追加ロール」抽選テーブル（CR は別途必ずドロップする前提）。
//   各エントリ { kind, w } の w（重み）を合計 100 で読む。kind:'miss' は空振り（何も出ない）。
//   仕様 §18：回復 15% / バフ 15%（→今回バフ未実装で miss）/ 空振り 10% → 計 70 miss
//   HP は 3 段階に分割（apple 10 / burger 4 / meat 1 = 計 15）：肉ほど稀＝レアリティ感
//   SP は単一（15）
//   将来 buff 追加時は { kind:'buff', w:15 } に分割して miss を w:55 に減らす。
export const CONTAINER_LOOT_TABLE = {
  crate:    [
    { kind: 'hp_apple',  w: 10 }, { kind: 'hp_burger', w: 4 }, { kind: 'hp_meat', w: 1 },
    { kind: 'sp_tank',   w: 15 },
    { kind: 'miss',      w: 70 },
  ],
  canister: [
    { kind: 'hp_apple',  w: 10 }, { kind: 'hp_burger', w: 4 }, { kind: 'hp_meat', w: 1 },
    { kind: 'sp_tank',   w: 15 },
    { kind: 'miss',      w: 70 },
  ],
  // ボス前専用：HP が確定で出る回復セット（miss / sp なし）
  //   ステージ配置 props に `lootTable: 'pre_boss_hp'` を書くと有効化。
  //   burger 主体・apple 小当たり・meat 当たりの「ボス前ご褒美」分布（2026-05-25 ユーザー指示）。
  pre_boss_hp: [
    { kind: 'hp_apple',  w: 20 },
    { kind: 'hp_burger', w: 75 },
    { kind: 'hp_meat',   w:  5 },
  ],
};

// 敵ドロップの指針（実装は midboss01 分岐実装時に反映）：
//   - 敵を倒して出る HP 系は **リンゴまで**（burger / meat は出さない）
//   - midboss01 ドロップ分岐（案 S）では shieldBroken 状態でも HP 単発は hp_apple 限定
//   - HP 中・大は「コンテナ・ボス前のご褒美」枠で温存し、敵を倒すだけで完全回復しないルートを保つ
//   詳細：~/.claude/plans/chars/midboss01.md / 仕様書 §18

// ============================================================
//  #section repulse-counter — リパルスカウンター設定
//  - 敵の特定大技に「相反する軸」の SP を合わせると確定クリ＋即死＋gc 発動
//  - 軸：aerial（対空）/ ground（対地）/ frontal（対正面）
//  - 現在は e02_atk_02（jump_dive）+ c01_sp_02（昇竜）= aerial 軸のみ実装
// ============================================================
export const REPULSE_CONFIG = {
  // 「危」UI の表示期間（aim フェーズ中は常時表示なので寿命は不要）
  BANNER_FRAMES:   50,    // 成功時バナー表示 F
  FLASH_COLOR:     0xcc88ff,  // 成功時ヒットパーティクル色
  FLASH_COUNT:     24,
  // 軸ラベルとアイコン文字（HUD 表示用）
  AXIS_ICON:       { aerial: '↑', ground: '↓', frontal: '→' },
  // === パリィボックス方式（2026-05-26）===
  // 旧「攻撃 hit 時の軸照合」を撤去し、専用の repulseBox / repulseTargetBox の AABB 重なり判定で成立させる。
  // 成立すると両者を「お膳立て位置」へワープし、軽い演出後に RC 発動（確定クリ + 100% gc）。
  MAX_WARP_DISTANCE: 200,   // この距離を超えるとワープせず成立しない
  WARP_FRONT_OFFSET: 80,    // ワープ後の敵 X：プレイヤー facing 前方への距離
  WARP_Y_OFFSET:     120,   // ワープ後の敵 Y：プレイヤー頭上（attack hit 想定位置）
  CAM_ZOOM_BOOST:    0.15,  // 一時的なカメラズーム加算
  CAM_ZOOM_FRAMES:   14,    // ズーム持続 F
  SHAKE_AMOUNT:      6,
  SHAKE_FRAMES:      8,
};

// ============================================================
//  #section enemy-react — 雑魚敵の防御リアクション（#14-B：dodge / guard）
//  - プレイヤー攻撃の windup を検知し、性格の dodgeTendency / guardTendency で抽選
//  - 被弾時 RNG ではなく「攻撃を読んで先に防御行動へ入る」確率（先出し＝読ませる演出）
//  - 値はランタイム調整可：window.SB.ENEMY_REACT_CONFIG.DODGE_VX = 12 など
// ============================================================
export const ENEMY_REACT_CONFIG = {
  DETECT_RANGE_X:    300,   // プレイヤー攻撃を「自分への脅威」と見なす X 距離
  DETECT_RANGE_Z:    130,   // 同 Z 距離
  REACT_COOLDOWN:    50,    // dodge/guard 発動後、次の防御判定までのクールダウンF
  DODGE_VX:          9.5,   // バックステップの水平初速（facing 逆方向）
  DODGE_DECAY:       0.86,  // バックステップ減衰
  GUARD_DAMAGE_MULT: 0.25,  // ガード成立時のダメージ倍率
  GUARD_KB_VX:       6,     // enemy_block_hit の軽ノックバック水平速度
  // cunning レイヤー3（14-D-3）：cunning の dodge をこの確率で「punish-dodge」にする。
  // punish-dodge は回避完了直後に突進タックル（e01_atk_02）へ連携して隙を突く。
  // dodgeTendency 0.45 × 0.7 ≒ windup 検知の 30%（enem01.md §性格軸 レイヤー3 と一致）。
  DODGE_PUNISH_CHANCE: 0.7,
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
    // ガード強度（14-E）：atk_lv がこの値以下ならクリーンガード、超過でガードクラッシュ。
    //   lv7（追い打ち）は強度に関わらずクリーン（例外）。
    guardStrength: 3,
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

// ============================================================
//  #section overclock-cards — OVERCLOCK カード定義（試験実装）
//  - wave 2 クリア後に 4 枚から 2 枚をランダムで提示 → 1 枚選択で効果発動
//  - 効果は ATTACKS / SP_CONFIG などのランタイム値を直接書き換え
//  - id で applyOCEffect が分岐。color は選択 UI のアクセントカラー
// ============================================================
export const OVERCLOCK_CARDS = [
  { id: 'POWER_UP',  label: 'POWER UP',  desc: '攻撃力 ×1.3',     color: '#ff5533' },
  { id: 'SP_RUSH',   label: 'SP RUSH',   desc: 'SP 獲得 ×2',      color: '#22aaff' },
  { id: 'REGEN_UP',  label: 'REGEN UP',  desc: 'SP 回復 ×3',      color: '#44dd88' },
  { id: 'SP_FULL',   label: 'SP FULL',   desc: 'SP ゲージ即時満タン', color: '#ffcc22' },
];
