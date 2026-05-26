// ============================================================
//  SCRAP BLITZ — ステート定数・被弾持続F・KB ベクトル定数（分離 Phase: Step B）
//
//  ES Module として index.html から import される：
//    import {
//      STATE, STATE_TILT_TARGET, STATE_PITCH_TARGET, STATE_PITCH_INITIAL,
//      STATE_TILT_LERP, STATE_PITCH_LERP, applyHitInitialPitch,
//      HP_CONFIG,
//      PLAYER_KB01_FRAMES, ..., PLAYER_KB_GRAV, PLAYER_KB_VX_DECAY,
//      ENEMY_FALL_FRAMES, ..., ENEMY_DOWN_BOUND_FRAMES,
//      KB_BURST_VY, ..., KB_BURST_GRAV_MULT,
//      KB_LV03_VY, KB_LV05_VY, KB_LV06_VY, KB_LV07_HOP_VY, ...,
//      ENEMY_AIRBORNE_Y_THRESHOLD,
//    } from './src/states.js';
//
//  純データ層：他データ（PHYSICS / ATTACKS / 各種 CONFIG）への参照は持たない。
// ============================================================

// ============================================================
//  HP / 被ダメージシステム（Phase 2.4）
//  - damagePlayer / revivePlayer から参照されるベース定数
//  - 被弾 state（knockback01/02/down_front_*/down_bas_*/dying/dead）の持続Fは
//    PLAYER_*_FRAMES で管理（敵側 ENEMY_*_FRAMES と独立）
// ============================================================
export const HP_CONFIG = {
  MAX:                 100,
  HITSTUN_RECOVER_INVINCIBLE: 180,  // 被弾→起き上がり開始からの無敵F（3秒・透明点滅・コンボ拒否）
  DEAD_FRAMES:         60,   // dying 演出終了後 dead で待機する長さ（演出時間とは別）
  REVIVE_INVINCIBLE:   240,  // リバイブ後の無敵F（4秒・透明点滅）
  // 死亡演出（dying state の中で時系列に切り替わる）
  DEATH_FADE_FRAMES:   30,   // 体が黒くなる時間（0.5 秒）
  DEATH_BLINK_FRAMES:  72,   // 黒↔赤の点滅時間（1.2 秒・周期は加速）
  DEATH_BLINK_START_PERIOD: 12,  // 点滅開始時の周期F
  DEATH_BLINK_END_PERIOD:   3,   // 点滅終了直前の周期F（加速ピーク）
  // リスポーン演出
  RESPAWN_FALL_HEIGHT: 600,  // 復活時の落下開始 Y（画面上部）
  RESPAWN_FALL_FRAMES: 30,   // 落下時間（0.5 秒で着地）
  RESPAWN_BLINK_PERIOD: 6,   // 無敵中の透明点滅周期F
  // 危機状態（HP 30% 以下・p.inCrisis フラグで一元管理）
  //   - HP HUD のバー点滅（赤橙↔赤）
  //   - 機体本体から火花パーティクル
  //   - ダッシュ中の追加火花（駆動限界の演出）
  //   - 将来：BGM 切替・カメラ揺れ・ULT 強化など、危機状態に紐づく演出はここ起点
  CRISIS_THRESHOLD:    0.3,  // hp/maxHp がこの値以下で危機状態に
  CRISIS_SPARK_MIN:    14,   // 火花スポーン間隔の最小F
  CRISIS_SPARK_MAX:    30,   // 火花スポーン間隔の最大F
  CRISIS_DASH_SPARK:   6,    // ダッシュ中の追加火花スポーン間隔（短め）
};
// プレイヤー被弾 state 持続F（敵側 ENEMY_*_FRAMES と独立。メカは重め）
export const PLAYER_KB01_FRAMES       = 28;
export const PLAYER_KB02_FRAMES       = 40;
export const PLAYER_DOWN_FRONT_START_FRAMES = 28;
export const PLAYER_DOWN_BAS_START_FRAMES   = 22;
export const PLAYER_DOWN_BAS_LOOP_FRAMES    = 50;
export const PLAYER_DOWN_BAS_END_FRAMES     = 32;
export const PLAYER_DOWN_UP_FRAMES          = 36;  // lv4 打ち上げ（敵 ENEMY_FALL_FRAMES と同値）
export const PLAYER_DOWN_RAKKA_FRAMES       = 12;  // lv5 叩きつけ・真下落下イントロ（敵 ENEMY_DOWN_RAKKA_FRAMES と同値）
export const PLAYER_DOWN_BOUND_FRAMES       = 90;  // lv5 着地後バウンドのフォールバック上限（実 airtime ≈73F より長め・通常は着地で早期終了）
export const PLAYER_DOWN_SUPER_FRAMES       = 12;  // lv6 超吹き飛ばし・離陸イントロ（敵 ENEMY_DOWN_SUPER_FRAMES と同値）
export const PLAYER_WALL_START_FRAMES       = 30;  // lv6 壁張り付き持続F → 反作用バウンス（敵 ENEMY_WALL_START_FRAMES と同値）
export const PLAYER_ROLL_START_FRAMES       = 15;  // lv6 地面転がり開始イントロ（敵 ENEMY_ROLL_START_FRAMES と同値）
export const PLAYER_ROLL_LOOP_FRAMES        = 30;  // lv6 地面転がりループ（敵 ENEMY_ROLL_LOOP_FRAMES と同値）
export const PLAYER_KB_AIR_FRAMES           = 28;  // 空中 lv1/lv2 フリンチ持続F → fall_loop へ
export const PLAYER_LAND_FRAMES             = 14;  // 着地モーション → wait01
export const PLAYER_AIRBORNE_Y_THRESHOLD    = 10;  // この値以上で空中扱い（敵側と同じ思想）
export const PLAYER_JUMP_START_FRAMES       = 4;   // 通常ジャンプ離陸 → jump_loop へ
export const PLAYER_JUMP_D_START_FRAMES     = 6;   // ダッシュジャンプ離陸 → jump_d_loop へ
export const PLAYER_JUMP_END_FRAMES         = 5;   // 通常ジャンプ着地（短・cancel 可）
export const PLAYER_JUMP_D_END_FRAMES       = 14;  // ダッシュジャンプ着地（やや長・cancel 可）
export const PLAYER_DYING_FRAMES      = 60;
export const PLAYER_KB_GRAV           = 0.55;  // 被弾中の落下重力
export const PLAYER_KB_VX_DECAY       = 0.92;  // 被弾中の水平減衰
// 打ち上げ launchVy のフォールバック値（attack 個別指定が無い時に使う共通値）
export const DEFAULT_LAUNCH_VY        = 22;  // lv4 打ち上げで attack.launchVy 未指定時のフォールバック
export const EXPLOSION_LAUNCH_VY      = 18;  // ボンベ/地雷の爆発による打ち上げ初速

// ============================================================
//  #section state-table — ステート定数 / tilt / pitch テーブル
//   プレイヤーは p.state、敵は e.state に文字列を入れる。
//   ロジック（state machine の遷移）は updatePlayer / updateEnemies 内に別途持つ。
// ============================================================
export const STATE = {
  // ── 通常 ───────────────────────────────────────────────────
  wait01:           'wait01',            // 立ち・通常待機
  // 移動系（プレイヤー / 敵共通・2026-05-19 追加）
  // wait01 のまま移動していると見た目が固まる問題への対策。アニメーション切替の起点。
  walk_fwd:         'walk_fwd',          // 前歩き（facing 方向への低速移動）
  walk_back:        'walk_back',         // 後ろ歩き（後ずさり・facing は固定）
  dash:             'dash',              // ダッシュ走行（プレイヤー dashActive と並走・敵は距離大時に使用）
  // ── プレイヤー行動（敵が攻撃するようになったら共用予定）─────────
  attacking:        'attacking',         // 攻撃モーション中
  hit_confirm:      'hit_confirm',       // ヒット確認後のキャンセル受付中
  grabbing:         'grabbing',          // グラブ実行側（敵を掴んでいる）
  grabbed:          'grabbed',           // グラブ被害側（掴まれている）
  // ── 被弾フリンチ（atk_lv 駆動）─────────────────────────────
  knockback01:      'knockback01',       // lv01 地上ヒット・小フリンチ → wait01
  knockback02:      'knockback02',       // lv02 地上ヒット・大フリンチ → wait01
  knockback_air01:  'knockback_air01',   // lv01/lv02 空中ヒット → fall_loop
  knockback03:      'knockback03',       // ダウン中ヒット用フリンチ（45F → down_bas_loop）
  fall_loop:        'fall_loop',         // 自由落下 → 着地で land
  land:             'land',              // 空中被弾系の着地モーション（長め・cancel 不可）→ wait01
  // 通常ジャンプ state（2026-05-19 追加）：state machine の見える化と着地演出フック用。
  // すべて攻撃/ジャンプ入力で即 cancel 可能。hitstun 扱いではない。
  jump_start:       'jump_start',        // 通常ジャンプ離陸（数F）→ jump_loop
  jump_loop:        'jump_loop',         // 空中（上昇・滞空・落下）→ 着地で jump_end
  jump_end:         'jump_end',          // 通常ジャンプ着地（短・cancel 可）→ wait01
  jump_d_start:     'jump_d_start',      // ダッシュジャンプ離陸 → jump_d_loop
  jump_d_loop:      'jump_d_loop',       // ダッシュジャンプ空中 → 着地で jump_d_end
  jump_d_end:       'jump_d_end',        // ダッシュジャンプ着地（やや長・cancel 可）→ wait01
  // ── 吹き飛び（lv03）────────────────────────────────────────
  down_front_start: 'down_front_start',  // 後方へ吹き飛び開始 → down_front_loop
  down_front_loop:  'down_front_loop',   // 吹き飛び中 → 着地で down_bas_end
  // ── 打ち上げ（lv04・既存）─────────────────────────────────
  down_up_start:    'down_up_start',     // 打ち上げ後・傾き開始（tiltAngle 0→π/2）
  down_up_loop:     'down_up_loop',      // 横倒し姿勢のまま落下継続
  // ── 超吹き飛ばし（lv06）─────────────────────────────────
  down_super_start:  'down_super_start',   // 高速で吹っ飛び開始（地上/空中共用）→ down_super_loop ／ 壁: down_wall_start ／ 地面: down_roll_start
  down_super_loop:   'down_super_loop',    // 吹き飛び中ループ ／ 壁: down_wall_start ／ 地面: down_roll_start
  down_wall_start:  'down_wall_start',   // 壁に張り付き → down_wall_loop
  down_wall_loop:   'down_wall_loop',    // うつ伏せ落下 → 着地で down_bas_start
  down_roll_start:  'down_roll_start',   // 転がり開始（12F イントロ）→ down_roll_loop
  down_roll_loop:   'down_roll_loop',    // 転がりループ（X 軸後方ごろごろ）→ down_bas_loop
  // ── 叩きつけ（lv05）─────────────────────────────────
  down_rakka_start: 'down_rakka_start',  // 真下に高速落下開始（地上/空中共用）→ down_rakka_loop ／ 地面: down_bound_start
  down_rakka_loop:  'down_rakka_loop',   // 真下落下ループ ／ 地面: down_bound_start
  down_bound_start: 'down_bound_start',  // 着地後の1回バウンド → 再着地で down_bas_loop
  // ── バースト離脱（重複必殺技ヒット時の完全無敵スピン）─────────────
  // ダメージは通常通り入るが、敵は無敵で派手にぐるぐる回りながら後方へ吹き飛ぶ。
  // 着地で down_bas_start に合流。コンボは +1 してから自然消滅。
  // 重複検出は p.specialIsDuplicate フラグ経由（startSpecial で立つ）。
  down_burst_start: 'down_burst_start',  // 12F イントロ → down_burst_loop
  down_burst_loop:  'down_burst_loop',   // 空中スピン中（完全無敵）→ 着地で down_bas_start
  // ── ダウン静止・起き上がり ─────────────────────────────────
  down_bas_start:   'down_bas_start',    // 着地直後（イントロ） → down_bas_loop
  down_bas_loop:    'down_bas_loop',     // ダウン静止ループ → down_bas_end
  down_bas_end:     'down_bas_end',      // 起き上がり
  // ── プレイヤー被ダメ専用（Phase 2.4）─────────────────────────
  // 注：updatePlayer / updateEnemies は配列が分離されているため、
  //     同名 STATE をプレイヤー/敵で共有しても誤動作しない。
  //     将来「全 entity ループ」を作る場合は要再設計。
  guard_crash:      'guard_crash',       // ガードクラッシュ硬直（SP枯渇）
  // 連続用 RC 成功時：屈みながら後方へ少しスライド。次スロットの RC も受付可
  combo_rc_slide:   'combo_rc_slide',
  dying:            'dying',             // 死亡演出（黒化→点滅→爆散）
  dead:             'dead',              // 完全消滅 → DEAD_FRAMES 後に respawning
  respawning:       'respawning',        // 復活演出（落下→着地→無敵点滅）
  // ── 敵 AI 攻撃 state（Phase 2.4 ダミー敵ミニマム攻撃）────────
  enemy_attacking:  'enemy_attacking',   // 接近 → wind / active / recover の3段
  // ── ステータス系（Phase 3・将来 freeze/poison/paralyze 等と並ぶ命名）────
  // status_stun：操作不能（移動/攻撃/AI 介入なし）。STATUS_STUN_CONFIG.duration 経過で wait01
  // - 地上のみサポート（applyStatusStun() で空中個体は付与スキップ）
  // - 通常の被弾を受けると knockback / down_* に上書きされる（状態優先度は被弾が上）
  status_stun:      'status_stun',
  // ── 敵死亡（Phase 3-A・ゴア・スクラップシステム骨格）────────
  // enemy_dying：HP 0 で発火。GORE_CONFIG.FADE_DURATION 経過で黒シルエット化 → 消滅。
  //   - プレイヤーの dying state とは独立（プレイヤーは死亡演出が異なる）
  //   - 仕様：spec-room/discussions/gore-scrap-mob-prototype.md
  //   - Phase 3-A はフェードのみ。3-B でパーツ飛散・3-C でバーストダウン即爆散
  enemy_dying:      'enemy_dying',
  // ── 基本雑魚の能動行動 state（2026-05-19 枠だけ予約・実装は後段）─────
  // 各 state は「物理・見た目」軸で、AI 意思決定（aiPhase）と独立に発火される。
  // 仕様：chars/enem01.md §基本雑魚の行動カテゴリ
  enemy_dodge:      'enemy_dodge',      // 回避モーション（バックステップ / サイドステップ・無敵 F あり）
  enemy_guard:      'enemy_guard',      // ガード姿勢（前面被弾を低 lv に降格）
  enemy_stagger:    'enemy_stagger',    // 連続被弾で蓄積する怯み（accumStaggerVal が閾値超で発火）
  enemy_taunt:      'enemy_taunt',      // 挑発（無防備に何もしない数秒間・性格 brave 専用）
  enemy_block_hit:  'enemy_block_hit',  // ガード成立直後の硬直（kb 軽め・1F 遅れて attack 可能に）
  // 興奮発生モーション（aiPhase='enraged' とは別軸・専用モーションの起点）
  // 発生時のみ短時間（推奨 30-60F）この state を取り、終了後は wait01 に戻る。
  // aiPhase は 'enraged' のまま継続して攻撃頻度等の挙動変化を持続。
  enraged_intro:    'enraged_intro',
};

// プレイヤーのジャンプ系 state 集合（離陸/空中/着地の演出フック）。
// 攻撃・SP・チャージの受付は wait01 と同等に扱うため、入力ゲートで一括判定する。
// 新しいジャンプ派生 state を STATE に足したら、ここにも必ず追加すること。
export const PLAYER_JUMP_STATES = new Set([
  STATE.jump_start, STATE.jump_loop, STATE.jump_end,
  STATE.jump_d_start, STATE.jump_d_loop, STATE.jump_d_end,
]);

// ============================================================
//  AI_PHASE — 敵の意思決定 phase（e.aiPhase 用の文字列定数）
//  e.state（物理・見た目）と独立軸。被弾中は 'hitstun' に自動同期される。
//  仕様：chars/enem01.md §AI ステート設計
// ============================================================
export const AI_PHASE = {
  idle:      'idle',       // approachRange 外で待機
  chase:     'chase',      // プレイヤーへ接近
  attack:    'attack',     // 攻撃モーション中（atkPhase: wind→active→recover）
  retreat:   'retreat',    // 攻撃後/被弾復帰後の強制後退
  hitstun:   'hitstun',    // 被弾中・読取専用
  // 2026-05-19 追加（基本雑魚行動の枠）
  strafe:    'strafe',     // プレイヤー側面に回り込み（cunning 性格寄り）
  dodge:     'dodge',      // プレイヤー攻撃モーション検知時の回避（cunning / coward）
  guard:     'guard',      // ガード姿勢で被弾を軽減（受け身寄り個体）
  enraged:   'enraged',    // HP 低下時の攻撃頻度上昇モード
  flee:      'flee',       // 統率喪失時の逃走（coward / leaderless escort）
  taunt:     'taunt',      // 挑発（brave 性格・連勝時のみ）
};

// 敵のジャンプ系 state 持続F（プレイヤー PLAYER_JUMP_*_FRAMES と同値・将来キャラ別に調整可）
export const ENEMY_JUMP_START_FRAMES   = 4;   // 通常ジャンプ離陸 → jump_loop
export const ENEMY_JUMP_D_START_FRAMES = 6;   // ダッシュジャンプ離陸 → jump_d_loop
export const ENEMY_JUMP_END_FRAMES     = 5;   // 通常ジャンプ着地 → wait01
export const ENEMY_JUMP_D_END_FRAMES   = 14;  // ダッシュジャンプ着地 → wait01

// 雑魚行動（#14-B）の state 持続F
export const ENEMY_STAGGER_FRAMES   = 38;  // 連続被弾よろめき（enemy_stagger）
export const ENEMY_DODGE_FRAMES     = 22;  // バックステップ回避（enemy_dodge）
export const ENEMY_DODGE_INVULN     = 15;  // dodge 前半の無敵F
export const ENEMY_GUARD_FRAMES     = 34;  // ガード姿勢の保持（enemy_guard）
export const ENEMY_BLOCK_HIT_FRAMES = 14;  // ガード成立硬直（enemy_block_hit）

// 敵側の被弾・ダウン持続F
export const ENEMY_FALL_FRAMES = 36; // 0.6s：倒れ終わるまで（down_up_start）
export const ENEMY_RISE_FRAMES = 30; // 0.5s：起き上がり（down_bas_end）
// ダウン静止（down_bas_start イントロ + down_bas_loop ループ）
export const ENEMY_DOWN_BAS_START_FRAMES = 20;  // 着地直後イントロ
export const ENEMY_DOWN_BAS_LOOP_FRAMES  = 40;  // ダウン静止ループ
// 新規ステートの持続F
export const ENEMY_KB01_FRAMES         = 24;  // knockback01（2026-05-13 12→24）
export const ENEMY_KB02_FRAMES         = 35;  // knockback02（01 より長く・35F に統一）
export const ENEMY_KB_AIR_FRAMES       = 24;  // knockback_air01（2026-05-13 12→24）
export const ENEMY_KB03_FRAMES         = 45;  // knockback03（ダウン中ヒット用フリンチ）
export const ENEMY_LAND_FRAMES         = 12;  // land
export const ENEMY_DOWN_FRONT_FRAMES   = 24;  // down_front_start（吹き飛び傾き）
// 超吹き飛ばし系（lv06）
export const ENEMY_DOWN_SUPER_FRAMES    = 12;  // down_super_start イントロ
export const ENEMY_WALL_START_FRAMES   = 30;  // down_wall_start（壁張り付き 0.5 秒 → 反作用バウンス・2026-05-18 15→30）
// 壁張り付き終了時のバウンス（前方＝プレイヤー方向へ大きく飛び上がる・2026-05-18 追加）
export const ENEMY_WALL_BOUNCE_VY      = 18;   // 上向き初速（強めに飛び上がる）
export const ENEMY_WALL_BOUNCE_KB_VX   = 30;   // プレイヤー方向への最大水平速度（距離認識クランプ上限・2026-05-20 20→30）
export const ENEMY_WALL_BOUNCE_KB_DECAY = 0.97; // 緩減衰（max 距離 ≈ KB_VX/0.03 ≈ 1000wu・2026-05-20 0.96→0.97）
export const ENEMY_ROLL_START_FRAMES   = 15;  // down_roll_start（転がり開始イントロ・X 軸スピン・2026-05-18 12→15）
export const ENEMY_ROLL_LOOP_FRAMES    = 30;  // down_roll_loop（転がり継続・ここを変えると総転がり時間調整・2026-05-18 18→30）
// 転がり中の水平慣性：以前の super 飛行のキメ部分を引き継ぐイメージで仕込む（2026-05-18）
export const ENEMY_ROLL_KB_VX          = 15;  // 転がり開始時の水平速度（fallDir 方向）
export const ENEMY_ROLL_KB_DECAY       = 0.96; // 減衰率（0.96^45F ≒ 0.16 = 16% 残）
// 後方互換：旧 ENEMY_ROLL_FRAMES を参照しているコードのためエイリアス維持
export const ENEMY_ROLL_FRAMES         = ENEMY_ROLL_START_FRAMES;
// バースト離脱（重複必殺技）
export const ENEMY_DOWN_BURST_START_FRAMES = 12;  // down_burst_start イントロ
export const ENEMY_DOWN_BURST_LOOP_FRAMES  = 60;  // down_burst_loop 空中スピン持続
export const KB_BURST_VY        = 18;     // 上向き初速（軽め）
export const KB_BURST_VX        = 15;     // 後方水平初速
export const KB_BURST_VX_DECAY  = 0.95;   // 緩い減衰（遠くまで飛ぶ）
export const KB_BURST_SPIN_RATE = 0.40;   // 毎フレーム rotation.z 増分（≒ 23°/F・ぐるぐる）
export const KB_BURST_GRAV_MULT = 0.6;    // gravFactor（既存 launcherAirborne と同じ・滞空延長）
// 叩きつけ系（lv05）
export const ENEMY_DOWN_RAKKA_FRAMES   = 12;  // down_rakka_start（落下開始イントロ）
export const ENEMY_DOWN_BOUND_FRAMES   = 60;  // down_bound_start（バウンド効果時間・着地で早期終了可）

// ============================================================
//  ステート別の傾き（tiltAngle）目標テーブル
//  ステート機械からは tiltAngle 設定を撤去し、ここを単一の真とする。
//  rotation.z = -fallDir * tiltAngle で実反映。
//  ランプ系（down_up_start / down_bas_end）は別途タイマー駆動で計算（後段で特殊処理）。
// ============================================================
export const STATE_TILT_TARGET = {
  // 立ち姿勢（0）
  wait01:           0,
  attacking:        0,
  hit_confirm:      0,
  knockback01:      0,
  knockback02:      0,
  knockback_air01:  0,
  knockback03:      Math.PI / 2,    // 横倒し（ダウン中フリンチ）
  fall_loop:        0,
  land:             0,
  jump_start:       0,
  jump_loop:        0,
  jump_end:         0,
  jump_d_start:     0,
  jump_d_loop:      0,
  jump_d_end:       0,
  // down_front_start はランプ系（0→π/2）— STATE_TILT_TARGET 経由ではなく後段で個別計算
  down_super_start:  0,
  down_super_loop:   0,
  down_wall_start:  0,                // 壁張り付き（うつ伏せ姿勢は将来 rotation.x で）
  // 横倒し姿勢（π/2）
  down_front_loop:  Math.PI / 2,      // 吹き飛び落下中は横倒し
  down_wall_loop:   Math.PI / 2,      // うつ伏せ落下（暫定的に横倒し）
  // 転がりは直立姿勢のまま X 軸（前後方向）スピン → tilt 不要（2026-05-18 修正・旧 π/2 から 0 へ）
  down_roll_start:  0,
  down_roll_loop:   0,
  down_up_loop:     Math.PI / 2,
  down_bas_start:   Math.PI / 2,
  down_bas_loop:    Math.PI / 2,
  // 叩きつけ（lv05）— Z tilt は使わず X 軸であおむけ姿勢にする（後段で別途処理）
  down_rakka_start: 0,
  down_rakka_loop:  0,
  down_bound_start: 0,
  // バースト離脱（重複必殺技）— tilt 補間は使わず updateEnemies で直接 rotation.z を回す
  down_burst_start: 0,
  down_burst_loop:  0,
  // ステータス系（直立姿勢のまま操作不能）
  status_stun:      0,
  // 敵死亡フェード（直立姿勢のまま黒く消える）
  enemy_dying:      0,
  // 基本雑魚の能動行動（2026-05-19 枠予約・全て立ち姿勢 0）
  enemy_dodge:      0,
  enemy_guard:      0,
  enemy_stagger:    0,
  enemy_taunt:      0,
  enemy_block_hit:  0,
  enraged_intro:    0,
  // 移動系（プレイヤー/敵共通・全て立ち姿勢 0）
  walk_fwd:         0,
  walk_back:        0,
  dash:             0,
};
export const STATE_TILT_LERP = 0.25;          // 補間係数（0.25 で約12F でほぼ目標到達）

// ============================================================
//  ステート別の前後傾（rotation.x ピッチ）
//  rotation.order='ZYX' により rx の符号で「敵から見た前/後傾」を表現できる：
//    +rx → プレイヤー方向（手前・前傾）／ -rx → 反対側（後傾・のけぞり）
//  TARGET = フレーム毎の lerp 目標値
//  INITIAL = ヒット遷移瞬間に強制セットする値（未定義なら lerp に任せる）
// ============================================================
export const STATE_PITCH_TARGET = {
  knockback01:     +0.175,   // ≈ +10°（おなか抑えうずくまり・継続）
  knockback02:     -0.524,   // ≈ -30°（のけぞり・継続）
  knockback_air01: 0,        // 立ち直り（INITIAL から 0 へ徐々に lerp）
  guard_crash:     -0.524,   // ガードクラッシュ：knockback02 と同じ のけぞり（14-E）
  grabbing:        +0.175,   // ≈ +10°（敵を掴んで前傾・kb01 と同じ見た目）
  grabbed:         +0.175,   // ≈ +10°（掴まれて前傾・kb01 と同じ見た目）
  // 雑魚行動（#14-B）
  enemy_stagger:   -0.40,    // 連続被弾よろめき：大きくのけぞる
  enemy_block_hit: -0.30,    // ガード成立：軽くのけぞる
  enemy_guard:     +0.22,    // ガード構え：前傾の防御姿勢
  enemy_dodge:     -0.15,    // バックステップ：後ろ重心
};
export const STATE_PITCH_INITIAL = {
  knockback01:     +0.175,   // 即座に前傾の姿勢へ
  knockback02:     -0.524,   // 即座にのけぞる姿勢へ
  knockback_air01: +0.262,   // ≈ +15° 開始（徐々に立ち直る）
  grabbing:        +0.175,
  grabbed:         +0.175,
  // 雑魚行動（#14-B）：被弾系は即スナップで衝撃を出す
  enemy_stagger:   -0.40,
  enemy_block_hit: -0.30,
};
// 被弾ステート遷移時に呼ぶ：状態に応じた pitch 初期値をセット
export function applyHitInitialPitch(e) {
  const v = STATE_PITCH_INITIAL[e.state];
  if (v !== undefined) e.pitchAngle = v;
}
export const STATE_PITCH_LERP = 0.18;

// ============================================================
//  転がり（down_roll_*）の腰ピボット補正 — 敵・プレイヤー共用
// ============================================================
// rotation.x の回転をメッシュ原点（足元）でなく腰高さ ROLL_HIP_PIVOT 周りに見せる。
// ZYX 適用順なので hip local (0, h, 0) は Rx→Ry の順で変換される：
//   after Rx(θ): (0, h·cosθ, h·sinθ) → after Ry(φ): (h·sinθ·sinφ, h·cosθ, h·sinθ·cosφ)
// world hip を (x, y+h, z) に固定したいので mesh.position を逆オフセットする。
export const ROLL_HIP_PIVOT = 70;  // 腰高さ（body 中心 80・脚台座 15-30 の間）
// pivot は腰高さの上書き用（既定 ROLL_HIP_PIVOT）。敵・プレイヤーで転がり感を
// 変えたくなった時に呼び出し側から個別指定できる。
export function applyRollHipPivot(mesh, x, y, z, rollAngle, pivot = ROLL_HIP_PIVOT) {
  const sinT = Math.sin(rollAngle), cosT = Math.cos(rollAngle);
  const sinP = Math.sin(mesh.rotation.y), cosP = Math.cos(mesh.rotation.y);
  mesh.position.x = x - pivot * sinT * sinP;
  mesh.position.y = y + pivot * (1 - cosT);
  mesh.position.z = z - pivot * sinT * cosP;
}

// ============================================================
//  #section state-constants — KB_LV* / しきい値定数
// ============================================================
// atk_lv_air 判定のしきい値：これ以下の y は接地扱い（バウンド瞬間や落下直前の微小値で
// 誤って空中ルートに入るのを防ぐ。c01_atk_l_01_air を地上敵に当てた時の挙動安定化）
export const ENEMY_AIRBORNE_Y_THRESHOLD = 10;

// lv03（吹き飛び）打ち上げパラメータ
export const KB_LV03_VY      = 12;
export const KB_LV03_VX_MULT = 1.5;
// lv05（叩きつけ）パラメータ — 真下に高速落下 + 着地後 1回バウンド
export const KB_LV05_VY        = -18;  // 下向き初速（高速で真下）
export const KB_LV05_VX_MULT   = 0.1;  // 水平ノックバックはほぼ殺す（真下落下）
export const KB_LV05_BOUNCE_VY = 20;   // 着地後の 1回バウンド上向き初速（14 × 1.4 ≒ 拾い直しが狙える高さ）
export const KB_LV07_HOP_VY    = 8;    // ダウン中ヒット時の小バウンド（knockback03 開始時 vy）
// lv06（超吹き飛ばし）打ち上げパラメータ — down_front_* を共用し倍率だけ強化
export const KB_LV06_VY      = 18;
export const KB_LV06_VX_MULT = 2.5;
