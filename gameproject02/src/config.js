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
  THRUST_FORCE:     1.20,   // ブースター毎フレーム加速量
  THRUST_FRAMES:    12,     // ブースター持続フレーム数（最大）
  GRAVITY:          0.96,   // 重力加速度
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
  AERIAL_GRAV_FACTOR: 0.9,    // 空中コンボ中の重力倍率（1.0=通常・小さいほどふわっと）

  // === ステージ横バウンド ===
  // プレイヤーがこの範囲外に出られないようにクランプ。
  // 横に無限に広がらないための制約（仕様書 §技術 / §7 ステージ構成）。
  // 値はランタイムで SB.PHYSICS.STAGE_LEFT = -2000 等で即変更可。
  STAGE_LEFT:   -1500,
  STAGE_RIGHT:   1500,

  // === ダッシュ（ローラーダッシュ式：2回タップ＋押しっぱなしで無制限持続） ===
  DASH_SPEED_MULT:  2.0,  // 通常速度の倍率
  GROUND_ACCEL:     0.20, // 地上方向転換の慣性係数（小さいほど重い・膨らむ）
  DASH_COOLDOWN:    24,   // ダッシュ終了後の再発動クールダウン（フレーム）
  DASH_TAP_WINDOW:  18,   // 同方向2回タップの受付ウィンドウ（フレーム）
  DASH_SPARK_ANGLE: Math.PI / 6, // 足元火花を出す方向変化の閾値（30°）

  // === 空中慣性 ===
  AIR_FRICTION:  0.95,  // 空中の水平速度減衰率（毎フレーム）0.90→0.95：慣性をより長く残す
  AIR_CONTROL:   0.6,   // 空中での方向修正力 1.2→0.6：制動を弱めて「らしい」挙動に
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
  // 必殺技コマンド成立の最終条件：閉じタップ（→→ なら 2 つ目の →）から J/K 押下までの猶予F
  // これを短くすることでダッシュ攻撃との誤爆を抑止する（2026-05-18）。
  // 8F ≒ 130ms。「タップ → タップ → 即ボタン」の意図的入力にのみ反応する。
  // 将来：必殺技ごとに別パラメータに切り分け可能（SP1=→→ は使用頻度高で緩め、
  //   ↑↑/↓↓ は誤爆懸念低・厳しめ等。当面は全 SP 共通でこの 1 値）。
  CMD_TAP_TO_BUTTON_FRAMES: 8,
  // 攻撃 / hit_confirm からのキャンセル発動時は上記猶予を CANCEL_MULT 倍に緩和。
  // コンボ繋ぎで指がさばききれない問題を回避（2026-05-18）。
  // 8F × 1.5 = 12F ≒ 200ms。通常時は厳しい / キャンセル中は緩い、の二段運用。
  CMD_TAP_CANCEL_MULT: 1.5,
  CHARGE_FRAMES:     50,     // [legacy] sp_03 stage1 成立 F（後方互換用）
  CHARGE_FRAMES_STAGE1: 50,  // sp_04 第1段階成立（≈0.83秒）→ c01_sp_04 発動（旧 sp_03 from 2026-05-16 rename）
  CHARGE_FRAMES_STAGE2: 120, // sp_04 第2段階成立（2.0秒）→ c01_sp_04_max 発動。OC/チップで延長可能
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
  WINDUP_LERP_Y:       0.18,  // 空中 Y：標準
  WINDUP_LERP_Z:       0.32,  // 奥行き Z：強め（2.5D 圧縮で最もズレやすい軸・コマンド ↓ 入力で誤って動きやすい）
  // 目標位置のオフセット
  AIM_OFFSET_X_RATIO:  0.55,  // hitFrame 時の理想 X 距離 = rangeX × この係数
  AIM_Y_OFFSET:        60,    // 空中追尾時、target の Y より少し上を狙う
  // デッドゾーン：既に圏内なら動かさない（さりげなさのため）
  DEADZONE_X_MARGIN:   40,    // |gapX| < (rangeX × AIM_OFFSET_X_RATIO + これ) なら X 動かない
  DEADZONE_Y_MARGIN:   30,    // |gapY| < これ なら Y 動かない
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
