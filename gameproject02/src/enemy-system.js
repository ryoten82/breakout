// ============================================================
//  SCRAP BLITZ — enemy-system（分離 Phase: Step E-3）
//
//  ダミー敵の構築・スポーン・更新（state machine / AI / 物理）を集約：
//    - buildDummyMesh()                敵メッシュ（胴体・頭・脚・ノーズ）構築
//    - spawnDummy(x, z, opts)          enemies[] にダミー敵を 1 体追加
//    - updateEnemies(ctx)              毎フレーム：ノックバック / 重力 / 状態遷移 /
//                                       敵 AI（wind→active→recover）/ tilt/pitch 計算 /
//                                       hitFlashTimer
//
//  ES Module として index.html から import される：
//    import {
//      initEnemySystem, buildDummyMesh, spawnDummy, updateEnemies,
//    } from './src/enemy-system.js';
//
//  initEnemySystem(deps) で依存を一括注入：
//    - THREE: Three.js モジュール
//    - scene: THREE.Scene
//    - players: プレイヤー配列
//    - enemies: 敵配列（モジュール内で push する）
//
//  updateEnemies(ctx) は呼び出し毎に hitCtx を受け取る：
//    - ctx.enemyAttackToken.get/set: 敵 AI ローテーション用トークン
//    - tryThrownChainHit へそのまま受け渡す
// ============================================================

import {
  STATE,
  STATE_TILT_TARGET, STATE_TILT_LERP,
  STATE_PITCH_TARGET, STATE_PITCH_LERP,
  ENEMY_FALL_FRAMES, ENEMY_RISE_FRAMES,
  ENEMY_DOWN_BAS_START_FRAMES, ENEMY_DOWN_BAS_LOOP_FRAMES,
  ENEMY_LAND_FRAMES, ENEMY_DOWN_FRONT_FRAMES,
  ENEMY_WALL_START_FRAMES, ENEMY_ROLL_START_FRAMES, ENEMY_ROLL_LOOP_FRAMES,
  ENEMY_WALL_BOUNCE_VY, ENEMY_WALL_BOUNCE_KB_VX, ENEMY_WALL_BOUNCE_KB_DECAY,
  ENEMY_ROLL_KB_VX, ENEMY_ROLL_KB_DECAY,
  ENEMY_DOWN_BURST_START_FRAMES, ENEMY_DOWN_BURST_LOOP_FRAMES, ENEMY_DOWN_BOUND_FRAMES,
  KB_BURST_VX, KB_BURST_VY, KB_BURST_SPIN_RATE, KB_BURST_GRAV_MULT,
  ENEMY_AIRBORNE_Y_THRESHOLD,
  KB_LV05_BOUNCE_VY,
} from './states.js';
import { PHYSICS, ENEMY_AI, DUMMY_ATK_CONFIG, SPECIAL_CONFIG, STATUS_STUN_CONFIG, GORE_CONFIG } from './config.js';
import { spawnHitParticles, triggerShake, tryThrownChainHit, triggerBurstState, combo, spawnDeathExplosion } from './hit-engine.js';
import { isHitstunState, tryHitPlayer } from './damage-system.js';
import { getActiveWallX } from './camera.js';

let _THREE = null;
let _scene = null;
let _players = null;
let _enemies = null;

export function initEnemySystem(deps) {
  _THREE = deps.THREE;
  _scene = deps.scene;
  _players = deps.players;
  _enemies = deps.enemies;
}

// ============================================================
//  メッシュ構築：胴体 + 頭 + 脚 + 向き確認ノーズ
// ============================================================
export function buildDummyMesh() {
  const group = new _THREE.Group();
  // rotation.y（向き）と rotation.z（傾き）を同時に使うため ZYX 順序が必要。
  // XYZ のままだと R_y * R_z で tilt がカメラ奥行き方向に出る。
  // ZYX では R_z * R_y となりスクリーン左右方向に正しく傾く。
  group.rotation.order = 'ZYX';
  // 敵仮モデル：濃い緑系統（2026-05-20 METEO 赤との視認性確保）
  const baseMat = new _THREE.MeshToonMaterial({ color: 0x2d4a22 });    // ダーク オリーブグリーン
  const accentMat = new _THREE.MeshToonMaterial({ color: 0x77aa55 });  // 差し色：ミディアムグリーン

  // 胴体（やや大きめ）
  const body = new _THREE.Mesh(new _THREE.BoxGeometry(70, 130, 60), baseMat);
  body.position.y = 80;
  body.castShadow = true;
  group.add(body);

  // 頭
  const head = new _THREE.Mesh(new _THREE.BoxGeometry(45, 40, 40), accentMat);
  head.position.y = 165;
  head.castShadow = true;
  group.add(head);

  // 脚（一体化した台座風）
  const stand = new _THREE.Mesh(new _THREE.BoxGeometry(60, 30, 60), accentMat);
  stand.position.y = 15;
  stand.castShadow = true;
  group.add(stand);

  // 向き確認用ノーズ（頭前面 +Z にコーン）：赤は METEO と被るので黄に変更（2026-05-20）
  //   2026-05-20：head の子に配置（dying 抽選で「鼻だけ単独で飛ぶ」を防止）
  //   local 座標：head の local 原点 (0, 165, 0) からの差分 → (0, 0, 30)
  const noseMat = new _THREE.MeshToonMaterial({ color: 0xffdd22 });
  const nose = new _THREE.Mesh(new _THREE.ConeGeometry(6, 20, 8), noseMat);
  nose.rotation.x = -Math.PI / 2; // コーン先端を +Z（前方）に向ける
  nose.position.set(0, 0, 30);
  head.add(nose);

  // parts dict は body / head / stand のみ（nose は head のサブ）
  // → detachOnePart の抽選で nose 単独になることを排除
  // → head が detach されると Three.js 親子で nose も付いてくる
  group.userData.parts = { body, head, stand };
  group.userData.subParts = { nose };  // 参考用に残す（material 操作などで参照）
  return group;
}

// ============================================================
//  ダミー敵を 1 体生成して enemies に追加する共通ヘルパ
//  Phase 2.4：複数体スポーンに対応。位置 (x, z) を指定して呼ぶ
// ============================================================
export function spawnDummy(x, z, opts = {}) {
  const mesh = buildDummyMesh();
  mesh.position.set(x, 0, z);
  // rotation.order='ZYX'：rotation.z（横倒し）と rotation.x（前後傾）両方を正しく見せる
  // YXZ/XYZ だと ry=±π/2 と rz の組み合わせで head が +Z 方向（カメラ手前）に倒れて見える
  // ZYX なら rz は player から見て横方向（±X 軸）に倒れる正しい挙動になる
  mesh.rotation.order = 'ZYX';
  mesh.rotation.y = -Math.PI / 2; // 初期向き：左向き（プレイヤー方向）
  _scene.add(mesh);
  const _maxHp = (typeof opts.maxHp === 'number' && opts.maxHp > 0) ? opts.maxHp : 100;
  const e = {
    mesh,
    x: x, y: 0, z: z,
    // Phase 3-B：リスポーン用に初期位置と opts を保存（mortal 自動リスポーン時に再利用）
    _spawnX: x,
    _spawnZ: z,
    _spawnOpts: { ...opts },
    hp:             _maxHp,
    maxHp:          _maxHp,
    hitFlashTimer:  0,
    knockbackVx:    0,
    knockbackVz:    0,
    vy:               0,
    prevVy:           0,
    peakHangTimer:    0,
    peakHangTotal:    0,
    launcherAirborne: false,
    kbFromMega:       false,
    pitchAngle:       0,
    frozenByUlt:      false,
    ultBurstInvincible: false,  // ULT 由来の burst-down 中フラグ：起き上がる（wait01 復帰）まで完全無敵・メガクラも受け付けない
    // 飛行系状態の再突入カウンタ（コンボ中累積・wait01 復帰でリセット・2026-05-18）
    superFlightCount:      0,    // down_super_* 突入回数
    wallHitCount:          0,    // down_wall_* 突入回数
    lateralCombatInvincible: false,  // 2 回目以降の飛行系突入で立つフラグ：wait01 まで完全無敵
    skipWallCollision:     false,  // 2 回目以降の down_super で壁ヒット遷移をスキップ → 地面で down_roll_start
    burstSpinRate:    0,
    burstGravMult:    0,
    burstRollAngle:   0,
    rollDebugAngle:   0,  // down_roll_start 中のデバッグ可視化用ロール角（2026-05-18）
    rollDir:          0,  // 転がり方向（±1・現在の knockbackVx 符号で決定・2026-05-18）
    isWallBounce:    false, // 壁バウンス中フラグ：被弾時に通常 knockback への遷移を許可（2026-05-18）
    grabbedBy:        null,
    state:            STATE.wait01,
    tiltAngle:        0,
    fallDir:          1,
    downTimer:        0,
    isAlive:          true,
    facing:           -1,
    // === ミニマム AI（Phase 2.4）===
    aiEnabled:        opts.aiEnabled ?? true,
    atkPhase:         null,
    atkTimer:         0,
    atkCooldown:      opts.atkCooldown ?? 90,  // 初期は少し溜め（同時カウントを避けるため敵ごとに変える）
    hitDelivered:     false,
    // === Phase 3 AI ステート明示化 ===
    // aiPhase: 'idle' / 'chase' / 'attack' / 'retreat' / 'hitstun'
    //   - e.state とは独立軸。物理・見た目は state、AI 意思決定は aiPhase。
    //   - hitstun は state が被弾系/grabbed/dying/status_stun 等のときに自動同期（読み取り専用ラベル）。
    aiPhase:          'idle',
    aiRetreatTimer:   0,    // retreat 残F
    // === Phase 3 ステータス系（status_stun）===
    statusStunTimer:  0,    // status_stun 残F
    // === Phase 3-A/3-B 敵死亡（gore-scrap・2026-05-20 フラグ方式へリファクタ）===
    // instantRespawn=true：従来の練習用「HP 0 で即復活」モード（既存スポーン互換）
    // instantRespawn=false：HP 0 → e.dying=true。state は変えず、被弾系/AI 抑制は dying フラグで判定
    instantRespawn:   opts.instantRespawn ?? true,
    dying:            false,    // dying プロセス進行中フラグ（state とは独立）
    dyingPhase:       null,     // 'reacting' | 'stunned' | 'burst' | 'final' | 'exploded'
    dyingFadeTimer:   0,        // 色フェード残F
    dyingHoldTimer:   0,        // フォールバック分解タイマー（reacting/stunned 中に並列消費・満了で強制 final）
    dyingStunnedTimer: 0,       // stunned フェーズ残F（約 2 秒・直立操作不能）
    dyingFinalTimer:  0,        // final フェーズ（後方吹き飛び→爆散）残F
    dyingInvincible:  false,    // final 中の完全無敵フラグ（hit-engine が skip）
    removed:          false,    // 最終消滅 → cleanup pass で配列除去
    // === Phase 3-B 爆散（パーツ飛散・逐次分離型 2026-05-20）===
    flyingParts:      null,    // Array<{ mesh, name, x/y/z, vx/vy/vz, bounced, fadeTimer, angV* }>
    // === 投擲弾（グラブ投げ → 他敵衝突連鎖）===
    thrownProjectile: false,  // 飛行中フラグ（true なら他敵との衝突判定が走る）
    thrownByPlayer:   null,   // ダメージ帰属（コンボ・SP 加算用）
    thrownDir:        0,      // 飛行方向（+1=右 / -1=左）
  };
  _enemies.push(e);
  return e;
}

// ============================================================
//  ステータス：スタン付与（Phase 3・将来 freeze / poison 等と同形）
//   - 地上の敵のみ（e.y > 5 なら無視・空中個体には付与しない）
//   - state===wait01 または enemy_attacking 以外（被弾系/status_stun中）は付与スキップ
//   - 付与時は進行中の攻撃を中断（atkPhase/Timer リセット・トークン解放）
//   - 返り値：付与した true / 無視した false（テスト/デバッグ用）
// ============================================================
export function applyStatusStun(e, frames, ctx) {
  if (!e || !e.isAlive) return false;
  if (e.y > 5) return false;                          // 空中無視
  if (e.state !== STATE.wait01 && e.state !== STATE.enemy_attacking) return false;
  // 進行中の攻撃を中断（トークン解放）
  if (e.state === STATE.enemy_attacking) {
    e.atkPhase = null;
    e.atkTimer = 0;
    e.hitDelivered = false;
    if (ctx && ctx.enemyAttackToken && ctx.enemyAttackToken.get() === e) {
      ctx.enemyAttackToken.set(null);
    }
  }
  e.state           = STATE.status_stun;
  e.statusStunTimer = (typeof frames === 'number' && frames > 0) ? frames : STATUS_STUN_CONFIG.defaultDuration;
  return true;
}

// ============================================================
//  敵死亡フロー開始（Phase 3-A/B/C・gore-scrap-mob-prototype.md 仕様）
//   - 2026-05-20 フラグ方式：state は変更せず、e.dying=true を立てて並列にフェーズ管理
//   - 被弾モーション（knockback/down_* 等）はそのまま再生継続
//   - AI のみ抑制（aiEnabled=false）、token 解放
//   - 色は _applyDyingColorOverride() で毎フレーム lerp(current→black) を適用
//   - 既に dying なら何もしない
//   - 返り値：開始した true / 既に dying または無効なら false
// ============================================================
export function enterEnemyDying(e, ctx) {
  if (!e || e.dying) return false;
  e.dying            = true;
  e.dyingPhase       = 'reacting';   // 通常被弾モーション再生中（hold タイマー並列消費・wait01 到達待ち）
  e.dyingFadeTimer   = GORE_CONFIG.FADE_DURATION;
  e.dyingHoldTimer   = GORE_CONFIG.HOLD_DURATION;  // フォールバック：3.5s で強制 final
  e.dyingStunnedTimer = 0;
  e.dyingFinalTimer  = 0;
  e.dyingInvincible  = false;
  e.aiEnabled        = false;
  e.atkPhase         = null;
  e.hitDelivered     = false;
  if (ctx && ctx.enemyAttackToken && ctx.enemyAttackToken.get() === e) {
    ctx.enemyAttackToken.set(null);
  }
  return true;
}

// ============================================================
//  Phase 3-C：lv06 ヒット時のバーストダウン即爆散ルート（黒フェード経由しない直行）
//   - HP 0 を lv06 攻撃で達成した瞬間に呼ばれる
//   - 即座に色を黒に（fade=0）、hold=0、phase='burst' でカウントダウン開始
//   - 既存 down_burst_* state の物理を流用（きりもみ吹っ飛び）
//   - 完全無敵（dyingInvincible=true）
//   - BURST_SPIN_DURATION 経過 → _triggerFinalExplosion（爆散・パーツ全飛散）
//   - 進行中は _updateDyingTimers でオイルトレイル発生
// ============================================================
export function enterEnemyDyingBurst(e, ctx, hitFacing) {
  if (!e || e.dying) return false;
  e.dying           = true;
  e.dyingPhase      = 'burst';
  e.dyingFadeTimer  = 0;   // フェード省略：即完全黒（色は _applyDyingColorOverride が t=1 で固定）
  e.dyingHoldTimer  = 0;
  e.dyingFinalTimer = GORE_CONFIG.BURST_SPIN_DURATION;
  e.dyingInvincible = true;
  e.aiEnabled       = false;
  e.atkPhase        = null;
  e.hitDelivered    = false;
  if (ctx && ctx.enemyAttackToken && ctx.enemyAttackToken.get() === e) {
    ctx.enemyAttackToken.set(null);
  }
  // 速度は触らない：直前の hit-engine lv6 dispatch が attack 由来の値を既に設定済
  //   （knockbackVx = facing * attack.knockback * 0.4 * sameScale * kb_vx_mult_lv6）
  //   （vy = attack.kb_vy_lv6 or KB_LV06_VY、kbDecay = attack.kb_vx_decay_lv6 等）
  //   → SP4 の慣性などがそのままきりもみ飛行に反映される
  // フォールバック：コンソール手動発火で velocity 未設定の場合は KB_BURST_* を流し込む
  if (!e.knockbackVx && !e.vy) {
    const p0 = _players && _players[0];
    const backDir = (p0 && p0.x > e.x) ? -1 : (p0 ? 1 : ((typeof hitFacing === 'number') ? hitFacing : 1));
    e.knockbackVx = backDir * KB_BURST_VX;
    e.vy = KB_BURST_VY;
    e.fallDir = backDir;
  } else {
    // dispatch 由来の knockbackVx の符号で fallDir 決定（吹き飛び方向 = fallDir）
    e.fallDir = (e.knockbackVx >= 0) ? 1 : -1;
  }
  // スピン用パラメータ（既存 down_burst_* state 機械が rotation に使う）
  e.burstSpinRate = KB_BURST_SPIN_RATE;
  e.burstGravMult = KB_BURST_GRAV_MULT;
  e.burstRollAngle = 0;
  // state を down_burst_start にスワップ（lv6 dispatch が down_super_start にしていてもオーバーライド）
  e.state = STATE.down_burst_start;
  e.downTimer = ENEMY_DOWN_BURST_START_FRAMES;
  e.hitFlashTimer = 0;
  e.burstFlashTimer = 0;
  return true;
}

// ============================================================
//  コンソール用：敵を強制的に死亡フローへ（テスト・デバッグ用）
//   SB.killEnemy(SB.enemies[0])
//   - instantRespawn フラグを無視して強制的に enemy_dying へ
// ============================================================
export function killEnemy(e, ctx) {
  if (!e || !e.isAlive || e.dying) return false;
  e.hp = 0;
  return enterEnemyDying(e, ctx);
}

// 黒色（フェード目標）— モジュールスコープで使い回し
let _BLACK = null;
let _THREE_REF = null;  // パーツ独立化時の mesh 親付け替えで Vector3 等に使う
export function initEnemyGoreBlack(THREE) {
  _BLACK = new THREE.Color(GORE_CONFIG.TARGET_COLOR);
  _THREE_REF = THREE;
}

// ============================================================
//  Phase 3-B：パーツ 1 つを抽選で分離（2026-05-20 逐次分離型）
//   - 本体 mesh から残存パーツのうち 1 つをランダムに抽選 → scene 直下へ独立化
//   - 残りは本体に付いたまま、fade/hold タイマーは継続
//   - 戻り値：分離した part 名 / 残パーツ無しなら null
//   - 共有 material は clone して個別化（detach 後の opacity 操作が本体に波及しないように）
// ============================================================
export function detachOnePart(e, hitFacing) {
  if (!e || !e.mesh || !e.mesh.userData || !e.mesh.userData.parts) return null;
  const parts = e.mesh.userData.parts;
  // 本体にまだ付いている part の名前リスト
  const attachedNames = Object.keys(parts).filter(name => {
    const m = parts[name];
    return m && m.parent === e.mesh;
  });
  if (attachedNames.length === 0) return null;
  const pickedName = attachedNames[Math.floor(Math.random() * attachedNames.length)];

  // Phase 3-B（2026-05-20）：胴体抽選 → 上半身（body + head + nose）を
  //   **connected silhouette のまま** 1 つのバンドルとして分離（親子関係保持）
  //   仕様（ユーザー指示・画像参照）：上半身の各パーツは保持したまま、まとまった輪郭で飛ぶ
  //   実装：head + nose を body の子に reparent（world 座標保持）→ body 全体を flying part として scene 直下化
  if (pickedName === 'body') {
    return _detachBodyBundle(e, hitFacing);
  }

  // 通常：単一パーツのランダム分離
  return _detachOneNamed(e, pickedName, null);
}

// 内部ヘルパ：胴体バンドル（body + head + nose の親子構造を保持）として分離
//   - 全 part の material を MeshBasicMaterial(0x000000) に置換
//   - head + nose を body の子に reparent（Object3D.attach で world 座標保持）
//   - body 自体を scene 直下に attach（同じく world 座標保持）
//   - flyingParts に 1 つだけエントリ追加（mesh=body, _materials=[3 つ]）
//   - 残り（stand）は _triggerFinalExplosion で別途分離 + 即爆散
function _detachBodyBundle(e, hitFacing) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts || !parts.body || parts.body.parent !== e.mesh) return null;
  const body = parts.body;
  const head = (parts.head && parts.head.parent === e.mesh) ? parts.head : null;
  // nose は head の子（subParts.nose）として保持されている：head に付随して飛ぶ
  const nose = e.mesh.userData.subParts && e.mesh.userData.subParts.nose;
  // 全 part の material を unlit 黒へ
  const bundleMaterials = [];
  if (_THREE_REF) {
    body.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
    bundleMaterials.push(body.material);
    if (head) {
      head.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(head.material);
    }
    if (nose && nose.material) {
      nose.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(nose.material);
    }
  }
  // head を body の子に reparent（world 座標保持）— nose は head の子なので自動追従
  if (head) body.attach(head);
  // body 自体を scene 直下に attach（world 座標保持・head + nose は body の子のまま）
  const worldPos = new _THREE_REF.Vector3();
  body.getWorldPosition(worldPos);
  _scene.attach(body);
  // velocity：ランダム単発（後続パーツに合わせて散らかし）
  const rand = ([lo, hi]) => lo + Math.random() * (hi - lo);
  const sign = (hitFacing !== undefined) ? -Math.sign(hitFacing) : (Math.random() < 0.5 ? -1 : 1);
  if (!e.flyingParts) e.flyingParts = [];
  e.flyingParts.push({
    mesh: body, name: 'body+upper',
    x: worldPos.x, y: worldPos.y, z: worldPos.z,
    vx: sign * rand(GORE_CONFIG.PART_VX_RANGE),
    vy: rand(GORE_CONFIG.PART_VY_INITIAL),
    vz: rand(GORE_CONFIG.PART_VZ_RANGE),
    bounced: false, fadeTimer: 0,
    angVx: (Math.random() - 0.5) * 0.3,
    angVy: (Math.random() - 0.5) * 0.3,
    angVz: (Math.random() - 0.5) * 0.3,
    _materials: bundleMaterials,    // フェード時にまとめて opacity 操作
  });
  // 残り（stand）を爆散 + 本体 mesh 除去 + 共用爆発
  _triggerFinalExplosion(e);
  return 'body+upper';
}

// 内部ヘルパ：1 パーツを「指定 velocity（null ならランダム）」で分離
function _detachOneNamed(e, name, sharedVelocity) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts) return null;
  const partMesh = parts[name];
  if (!partMesh || partMesh.parent !== e.mesh) return null;
  // MeshBasicMaterial（unlit）で完全黒シルエットを保証
  const bundleMaterials = [];
  if (partMesh.material && _THREE_REF) {
    partMesh.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
    bundleMaterials.push(partMesh.material);
  }
  // head detach: nose は head の子なので Three.js 親子で自動追従
  //   nose の material も unlit 黒へ swap し、bundle 内に含めてフェード時にまとめて消す
  if (name === 'head') {
    const nose = e.mesh.userData.subParts && e.mesh.userData.subParts.nose;
    if (nose && nose.material && _THREE_REF) {
      nose.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(nose.material);
    }
  }
  // world 座標を保持して scene 直下へ
  const worldPos = new _THREE_REF.Vector3();
  partMesh.getWorldPosition(worldPos);
  const worldQuat = new _THREE_REF.Quaternion();
  partMesh.getWorldQuaternion(worldQuat);
  partMesh.parent.remove(partMesh);
  _scene.add(partMesh);
  partMesh.position.copy(worldPos);
  partMesh.quaternion.copy(worldQuat);
  // velocity 決定（shared なら共有・null ならランダム）
  let vx, vy, vz;
  if (sharedVelocity) {
    vx = sharedVelocity.vx;
    vy = sharedVelocity.vy;
    vz = sharedVelocity.vz;
  } else {
    const rand = ([lo, hi]) => lo + Math.random() * (hi - lo);
    const sign = (Math.random() < 0.5 ? -1 : 1);
    vx = sign * rand(GORE_CONFIG.PART_VX_RANGE);
    vy = rand(GORE_CONFIG.PART_VY_INITIAL);
    vz = rand(GORE_CONFIG.PART_VZ_RANGE);
  }
  if (!e.flyingParts) e.flyingParts = [];
  e.flyingParts.push({
    mesh: partMesh, name,
    x: worldPos.x, y: worldPos.y, z: worldPos.z,
    vx, vy, vz,
    bounced: false, fadeTimer: 0,
    angVx: (Math.random() - 0.5) * 0.3,
    angVy: (Math.random() - 0.5) * 0.3,
    angVz: (Math.random() - 0.5) * 0.3,
    _materials: bundleMaterials,    // 単一 part でも配列：head 時は nose も含む
  });
  return name;
}

// 後方互換：旧 enterEnemyExplode は「残り全パーツを一気に分離 + 共用爆発」として残す（テスト用）
// 非 dying でも強制的に dying 化してから爆散させ、flyingParts の cleanup が回るようにする
export function enterEnemyExplode(e, hitFacing) {
  if (!e) return false;
  if (!e.dying) enterEnemyDying(e, null);
  _triggerFinalExplosion(e);
  return true;
}

// 飛翔中パーツの毎フレーム更新（重力 + 1 回バウンド + フェード消滅）
// 注：empty/null でも何もしないだけ。消滅判定は _updateEnemyDying 側に集約
function _updateFlyingParts(e) {
  if (!e.flyingParts || e.flyingParts.length === 0) return;
  const alive = [];
  for (const p of e.flyingParts) {
    // 物理進行
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    p.vy -= GORE_CONFIG.PART_GRAVITY;
    // 着地判定：1 回バウンド → 第二着地で settled（フェード開始）
    if (p.y <= 0 && p.vy < 0) {
      if (!p.bounced) {
        p.y = 0;
        p.vy = -p.vy * GORE_CONFIG.PART_BOUNCE_DAMP;
        p.vx *= 0.7;
        p.vz *= 0.7;
        p.bounced = true;
        // fadeTimer は設定しない（バウンド中は full opacity を維持）
      } else if (!p.settled) {
        // 第二着地：完全静止 + フェード開始（0.3s = PART_FADE_AFTER_BOUNCE）
        p.y = 0;
        p.vy = 0;
        p.vx *= 0.7;
        p.vz *= 0.7;
        p.settled = true;
        p.fadeTimer = GORE_CONFIG.PART_FADE_AFTER_BOUNCE;
      }
    }
    // mesh 位置反映
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.x += p.angVx;
    p.mesh.rotation.y += p.angVy;
    p.mesh.rotation.z += p.angVz;
    // 第二着地（settled）後フェードタイマー：バウンド中はフルオパシティ、settled で 0.3s フェード
    if (p.settled) {
      p.fadeTimer--;
      const opacity = Math.max(0, p.fadeTimer / GORE_CONFIG.PART_FADE_AFTER_BOUNCE);
      // 透過フェード（バンドル時は複数 material をまとめて、単発時は mesh.material のみ）
      if (p._materials) {
        for (const mat of p._materials) {
          if (!mat) continue;
          mat.transparent = true;
          mat.opacity = opacity;
        }
      } else if (p.mesh.material) {
        p.mesh.material.transparent = true;
        p.mesh.material.opacity = opacity;
      }
      if (p.fadeTimer <= 0) {
        // 消滅：scene から外す + material dispose（メモリリーク防止）
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        if (p._materials) {
          for (const mat of p._materials) if (mat && mat.dispose) mat.dispose();
        } else if (p.mesh.material && p.mesh.material.dispose) {
          p.mesh.material.dispose();
        }
        continue;  // alive に加えない
      }
    }
    alive.push(p);
  }
  e.flyingParts = alive;
  if (alive.length === 0) {
    e.removed = true;
    e.isAlive = false;
  }
}

// ============================================================
//  Phase 3-B：dying 中ヒットのハンドラ（hit-engine から divert・2026-05-20 逐次分離型）
//   - 必ず黒オイルパーティクルを発火（ヒット感）
//   - 確率判定 → 当選なら detachOnePart で残存パーツから 1 つ抽選分離
//   - 残パーツ無し時は何もしない（hold 満了まで本体は黒シルエットのまま）
// ============================================================
export function handleEnemyDyingHit(e, hitX, hitY, hitZ, hitFacing) {
  if (!e || !e.dying) return false;
  // stunned 中に殴られたら reacting に戻す（被弾モーション再生のため）
  //   → 通常被弾 dispatch（hit-engine 後段）で state が knockback などに変わる
  //   → wait01 復帰でまた stunned に入る
  if (e.dyingPhase === 'stunned') {
    e.dyingPhase = 'reacting';
    e.dyingStunnedTimer = 0;
  }
  // reacting 中のみ受け付け（final/burst/exploded は無敵 or 既爆散）
  if (e.dyingPhase !== 'reacting') return false;
  // 黒オイルパーティクル（命中位置・常時）
  spawnHitParticles(hitX, hitY, hitZ, GORE_CONFIG.OIL_PARTICLE_COLOR, GORE_CONFIG.OIL_PARTICLE_COUNT);
  // 確率判定 → 抽選で 1 パーツ分離
  if (Math.random() < GORE_CONFIG.PART_BREAK_PROB) {
    const detached = detachOnePart(e, hitFacing);
    if (detached) {
      triggerShake(4, 8);  // 1 パーツ単位なので軽め
      return true;
    }
  }
  return false;
}

// ============================================================
//  Phase 3 dying タイマー進行（フェード/ホールド/最終フェーズ）
//   - 'fading'：fade と hold を並列で消費。hold 満了 → 'final' へ
//   - 'final'：state=down_front_start で後方吹き飛び＋無敵。FINAL_EXPLODE_DELAY 後 → 'exploded'
//   - 'exploded'：全パーツ分離・本体 mesh 除去済。flyingParts 消滅で removed=true
//   毎フレーム updateEnemies の冒頭で e.dying のときに呼ばれる（normal state machine は維持）
// ============================================================
function _updateDyingTimers(e, ctx) {
  if (e.dyingPhase === 'reacting') {
    // 通常被弾モーション中・color フェード進行・wait01 到達待ち
    // 分解タイマー（hold = 3.5s）が最優先：先に切れたらその時点で強制 final
    if (e.dyingFadeTimer > 0) e.dyingFadeTimer--;
    if (e.dyingHoldTimer > 0) e.dyingHoldTimer--;
    if (e.dyingHoldTimer <= 0) {
      // hold 優先：reacting 中でも分解タイマー切れで即 final
      _enterDyingFinal(e, ctx);
    } else if (e.state === STATE.wait01) {
      // wait01 到達 → stunned へ（直立操作不能・残留速度ゼロ化で完全静止）
      e.dyingPhase = 'stunned';
      e.dyingStunnedTimer = GORE_CONFIG.STUN_DURATION;
      e.knockbackVx = 0;
      e.knockbackVz = 0;
      if (e.y <= 0) e.vy = 0;
    }
  } else if (e.dyingPhase === 'stunned') {
    // 直立操作不能。hold 最優先（先に切れたら stun 残量関わらず final）／ 通常は stun 約 2 秒で final
    if (e.dyingFadeTimer > 0) e.dyingFadeTimer--;
    if (e.dyingHoldTimer > 0) e.dyingHoldTimer--;
    if (e.dyingStunnedTimer > 0) e.dyingStunnedTimer--;
    if (e.dyingHoldTimer <= 0 || e.dyingStunnedTimer <= 0) {
      _enterDyingFinal(e, ctx);
    }
  } else if (e.dyingPhase === 'final') {
    if (e.dyingFinalTimer > 0) e.dyingFinalTimer--;
    if (e.dyingFinalTimer <= 0) _triggerFinalExplosion(e);
  } else if (e.dyingPhase === 'burst') {
    // Phase 3-C：lv06 即きりもみ。BURST_SPIN_DURATION 経過で爆散へ
    if (e.dyingFinalTimer > 0) e.dyingFinalTimer--;
    // オイルトレイル：一定間隔で黒粒子を撒く（速度低めで漂う）
    if (e.dyingFinalTimer % GORE_CONFIG.OIL_TRAIL_INTERVAL === 0) {
      spawnHitParticles(e.x, e.y + 60, e.z,
        GORE_CONFIG.OIL_PARTICLE_COLOR,
        GORE_CONFIG.OIL_TRAIL_PER_FRAME,
        { type: 'omni', sizeScale: 0.9, speedMul: 0.45, lifeMul: 1.2 });
    }
    if (e.dyingFinalTimer <= 0) _triggerFinalExplosion(e);
  }
  // exploded フェーズは flying parts の自然消滅を待つだけ
  _updateFlyingParts(e);
  // 最終消滅判定
  if (e.dyingPhase === 'exploded' && (!e.flyingParts || e.flyingParts.length === 0)) {
    e.removed = true;
    e.isAlive = false;
  }
}

// final フェーズ突入：後方へ強制 knockback + 完全無敵
function _enterDyingFinal(e, ctx) {
  e.dyingPhase = 'final';
  e.dyingFinalTimer = GORE_CONFIG.FINAL_EXPLODE_DELAY;
  e.dyingInvincible = true;
  // プレイヤー方向の逆を「後方」と定義
  const p0 = _players && _players[0];
  const backDir = (p0 && p0.x > e.x) ? -1 : (p0 ? 1 : (Math.random() < 0.5 ? -1 : 1));
  e.knockbackVx = backDir * GORE_CONFIG.FINAL_BACKWARD_VX;
  e.knockbackVz = 0;
  e.vy = GORE_CONFIG.FINAL_BACKWARD_VY;
  e.fallDir = backDir;
  // 既存の down_front_start 物理を流用（24F のランプで横倒し → down_front_loop へ自動遷移）
  e.state = STATE.down_front_start;
  e.downTimer = ENEMY_DOWN_FRONT_FRAMES;
  // hitFlash 解除（フラッシュが残ると色が浮く）
  e.hitFlashTimer = 0;
  e.burstFlashTimer = 0;
}

// 最終爆散：保持パーツ＋本体 mesh を瞬間消去 + 共用爆発エフェクト（2026-05-20 改修）
//   - ユーザー指示：「爆発時、保持しているパーツと下半身は瞬間的に消してください」
//   - つまり爆散時に残ってる attached parts（body/head/stand/nose）は飛ばさずに消す
//   - 既に飛翔中の flyingParts（hit で抽選分離済）はそのまま継続（自然にバウンド・フェード）
//   - 爆発感は spawnDeathExplosion に集約
function _triggerFinalExplosion(e) {
  e.dyingPhase = 'exploded';
  e.dyingInvincible = true;  // 念のため維持
  // 本体 mesh ごと scene から除去 → 子の attached parts も全て一括消去
  if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
  // 共用死亡爆発（プレイヤー dying と同じ・多層パーティクル+shake+hitstop）
  spawnDeathExplosion(e.x, e.y + 80, e.z);
}

// ============================================================
//  Phase 3 dying 色オーバーレイ（毎フレーム最後に適用）
//   - hitFlash/burstFlash 等が設定した「現在の色」を起点に黒へ lerp
//   - fade 進行とともに t が 0→1。t=1 で完全黒
//   - 共有 material（accentMat 等）は同じ mat を 2 回 lerp しないようユニーク化
// ============================================================
function _applyDyingColorOverride(e) {
  if (!e.mesh || !e.mesh.userData || !e.mesh.userData.parts) return;
  if (!_BLACK) return;
  const total = GORE_CONFIG.FADE_DURATION;
  const t = Math.min(1, Math.max(0, 1 - Math.max(0, e.dyingFadeTimer) / total));
  if (t <= 0) return;
  const parts = e.mesh.userData.parts;
  const seenMats = new Set();
  for (const m of Object.values(parts)) {
    if (!m || m.parent !== e.mesh || !m.material || !m.material.color) continue;
    if (seenMats.has(m.material)) continue;
    seenMats.add(m.material);
    m.material.color.lerp(_BLACK, t);
  }
  // subParts（nose 等・head の子）も同様に lerp（fade 中も nose の黄色が黒へ）
  const subParts = e.mesh.userData.subParts;
  if (subParts) {
    for (const m of Object.values(subParts)) {
      if (!m || !m.material || !m.material.color) continue;
      if (seenMats.has(m.material)) continue;
      seenMats.add(m.material);
      m.material.color.lerp(_BLACK, t);
    }
  }
}

// ============================================================
//  Phase 3 爆発直前の白フラッシュ（2026-05-20 ユーザー指示）
//   - final / burst フェーズの dyingFinalTimer が PREEXPLODE_FLASH_FRAMES 以下のとき発火
//   - 残存 attached パーツ + subParts の material.color を白（1,1,1）に上書き
//   - _applyDyingColorOverride の後に呼ばれるので、黒 lerp 結果を白で上書きする形
//   - 直後に _triggerFinalExplosion で本体 mesh 除去 + 爆発 → 視覚的に「光って → 爆発」
// ============================================================
function _applyPreExplodeFlash(e) {
  if (!e.mesh || !e.mesh.userData) return;
  const parts = e.mesh.userData.parts || {};
  const subParts = e.mesh.userData.subParts || {};
  const seenMats = new Set();
  for (const m of [...Object.values(parts), ...Object.values(subParts)]) {
    if (!m || !m.material || !m.material.color) continue;
    if (seenMats.has(m.material)) continue;
    seenMats.add(m.material);
    m.material.color.setRGB(1, 1, 1);
  }
}

// ============================================================
//  毎フレーム更新：state machine の遷移はここに集約（down_* / knockback* / bound 等）
//
//  ctx = { enemies, enemyAttackToken: { get, set }, getFrame }
//   - enemyAttackToken: 敵 AI ローテーション用トークン
//   - tryThrownChainHit へ ctx をそのまま渡す
// ============================================================
export function updateEnemies(ctx) {
  for (const e of _enemies) {
    if (!e.isAlive) continue;
    // Phase 3：dying タイマー進行（state machine は維持・色フェード/最終フェーズ遷移を回す）
    //   exploded フェーズに入ると mesh が無いので、その時点で本フレームの残処理は skip
    if (e.dying) {
      _updateDyingTimers(e, ctx);
      if (e.dyingPhase === 'exploded') continue;
    }
    // ULT 発動中の時間停止：最初のヒットを受けるまで凍結（state / vy / downTimer すべて維持）
    if (e.frozenByUlt) continue;
    // グラブ被害中：position・state は処理側（processGrabInput）で固定維持
    if (e.state === STATE.grabbed) { e.aiPhase = 'hitstun'; continue; }
    // Phase 3 AI ステート明示化：state が wait01 / enemy_attacking 以外なら hitstun ラベル
    // 注：status_stun もここで hitstun ラベルになる（被弾意味の汎用 AI 非介入ラベル）
    if (e.state !== STATE.wait01 && e.state !== STATE.enemy_attacking) {
      e.aiPhase = 'hitstun';
    }
    // wait01 復帰時：必殺技ヒット履歴 + コンボルートをクリア（敵単位の各種ループ制限のリセット）
    if (e.state === STATE.wait01) {
      if (e.specialHitBy && e.specialHitBy.size > 0) e.specialHitBy.clear();
      if (e.comboRoute && e.comboRoute.length > 0) e.comboRoute.length = 0;
      if (e.ultBurstInvincible) e.ultBurstInvincible = false;  // 起き上がり完了で ULT-burst 無敵解除
      // 飛行系状態カウンタ・関連フラグもリセット（2026-05-18）
      if (e.superFlightCount > 0) e.superFlightCount = 0;
      if (e.wallHitCount > 0) e.wallHitCount = 0;
      if (e.lateralCombatInvincible) e.lateralCombatInvincible = false;
      if (e.skipWallCollision) e.skipWallCollision = false;
      if (e.isWallBounce) e.isWallBounce = false;  // 壁バウンス中フラグもクリア
      // Phase 3：被弾→wait01 復帰検出（aiPhase が hitstun のまま wait01 に来た瞬間）→ retreat 発火
      if (e.aiPhase === 'hitstun') {
        e.aiPhase = 'retreat';
        e.aiRetreatTimer = DUMMY_ATK_CONFIG.postHitRetreatFrames;
        // 攻撃中に被弾していた場合のトークン解放（保険）
        if (ctx.enemyAttackToken.get() === e) ctx.enemyAttackToken.set(null);
        e.atkPhase = null;
        e.hitDelivered = false;
        if (e.atkCooldown < 30) e.atkCooldown = 30;
      }
    }
    // 死亡判定（Phase 3-A/B：instantRespawn フラグで分岐 / 2026-05-20 e.dying へ）
    if (e.hp <= 0) {
      if (e.instantRespawn) {
        // 練習用：即復活で無限ループ（既存挙動・3 体スポーンの互換）
        // ★ステートは上書きしない：ダウン誘発技で hp 0 にした場合も
        //   そのフレームに dispatch された down_front_start 等のステートを残し、
        //   ダウン animation を最後まで見せる。
        //   各 down ステートは自分でタイマー満了して wait01 に戻るので
        //   ダミーは「ダウン演出 → 立ち直り」の自然なサイクルでループ復活する
        e.hp = e.maxHp;
        spawnHitParticles(e.x, e.y + 100, e.z, 0xff8844, 24);
        triggerShake(8, 14);
      } else if (!e.dying) {
        // 本実装：死亡フロー開始（フラグだけ立てる・state は維持）
        // → 被弾モーション (knockback/down_*) は普通に再生されつつ、並列でフェード/分解進行
        spawnHitParticles(e.x, e.y + 100, e.z, 0xff8844, 24);
        triggerShake(8, 14);
        enterEnemyDying(e, ctx);
      }
    }
    // ノックバック減衰（水平）— 攻撃側で e.kbDecay 上書き可（lv06 c01_atk_l_01_air は 0.92 で直線軌道）
    e.x += e.knockbackVx;
    e.knockbackVx *= (e.kbDecay ?? 0.78);
    if (Math.abs(e.knockbackVx) < 0.1) {
      e.knockbackVx = 0;
      e.kbDecay = 0.78;  // ノックバック終了で減衰率を既定値に戻す
    }
    // === 投擲弾の衝突判定（Final Fight 風・グラブ投げ → 他敵連鎖）===
    // 飛行中（thrownProjectile=true）の敵が他敵に当たると両者吹き飛び
    if (e.thrownProjectile) {
      tryThrownChainHit(e, ctx);
      // 着地で投擲フラグ自動解除
      if (e.y <= 0) {
        e.thrownProjectile = false;
        e.thrownByPlayer   = null;
      }
    }
    // ステージバウンド壁ヒット
    // 超吹き飛ばし中（down_super_start/loop）に壁に到達 → 強制 down_wall_start
    //   ※ skipWallCollision フラグ（同コンボ 2 回目以降の super 飛行）は壁張り付きをスキップして
    //     ステージ端の x クランプも無視 → そのまま地面到達で down_roll_start に流す（2026-05-18）
    //   壁の x は getActiveWallX：画面端追従 or levelWalls 優先（2026-05-18 改修）
    const wallL = Math.max(PHYSICS.STAGE_LEFT,  getActiveWallX('left'));
    const wallR = Math.min(PHYSICS.STAGE_RIGHT, getActiveWallX('right'));
    const hitLeft  = e.x < wallL;
    const hitRight = e.x > wallR;
    if ((hitLeft || hitRight) && !e.skipWallCollision) {
      e.x = hitLeft ? wallL : wallR;
      if (e.state === STATE.down_super_start || e.state === STATE.down_super_loop) {
        // 壁突入カウンタ（2026-05-20）：3 回目到達でバーストダウン化（仕様統一）。
        //   旧：2 回目で lateralCombatInvincible（state 温存）。
        //   新：3 回目で burst へ遷移し、wallHit/superFlight の制限挙動を統一。
        e.wallHitCount = (e.wallHitCount ?? 0) + 1;
        if (e.wallHitCount >= 3) {
          // burst 方向：壁から離れる側＝-fallDir（プレイヤー方向）。
          // 通常 burst は「プレイヤーから遠ざかる」だが、壁突入瞬間にそれを使うと壁に戻ってループする。
          triggerBurstState(e, -e.fallDir);
          combo.burstHudFrames = Infinity;
          combo.burstHudRoute  = combo.aggregateRoute.slice();
          combo.burstHudReason = 'wall_limit';
          combo.burstHudSpBaseId = null;
          combo.burstHudLoopLen = 0;
        } else {
          // 通常：壁張り付き → タイマー満了で反作用バウンス（既存ロジック）
          e.state       = STATE.down_wall_start;
          e.downTimer   = ENEMY_WALL_START_FRAMES;
          e.vy          = 0;          // 壁にべたっと張り付き（一旦停止）
          e.knockbackVx = 0;
        }
        // tiltAngle は STATE_TILT_TARGET 経由で自動補間
      } else {
        e.knockbackVx = 0;
      }
    }
    // === 敵同士の分離（重なり回避）===
    //   攻撃中：強く押し合う（攻撃判定の重なりを防ぐ）
    //   wait01：中程度（自然に散らばる）
    //   被弾中：弱く（コンボ密着は許容・完全重なりだけ防ぐ）
    //   ダウン中・grabbed：ゼロ（位置は別ロジック管理）
    {
      let myStrength = 0;
      const s = e.state;
      if (s === STATE.enemy_attacking) myStrength = 2.5;
      else if (s === STATE.wait01)     myStrength = 1.5;
      else if (s === STATE.knockback01 || s === STATE.knockback02 ||
               s === STATE.knockback_air01 || s === STATE.knockback03 ||
               s === STATE.down_front_start || s === STATE.down_front_loop ||
               s === STATE.fall_loop || s === STATE.land) {
        myStrength = 0.7;
      }
      if (myStrength > 0 && !e.frozenByUlt) {
        for (let _j = 0; _j < _enemies.length; _j++) {
          const other = _enemies[_j];
          if (other === e || !other.isAlive || other.frozenByUlt) continue;
          if (other.state === STATE.grabbed) continue;
          const dx = e.x - other.x;
          const dz = e.z - other.z;
          const adx = Math.abs(dx);
          const adz = Math.abs(dz);
          // 攻撃中の敵がいたら最小距離を広め・それ以外は最小限（完全密着回避）
          const eitherAttacking = (e.state === STATE.enemy_attacking || other.state === STATE.enemy_attacking);
          const minDx = eitherAttacking ? 110 : 70;
          const minDz = 50;
          if (adx < minDx && adz < minDz) {
            // X 方向に押す。dx≈0 の場合はランダムで左右どちらかに
            const dxSign = (adx < 0.5) ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(dx);
            e.x += myStrength * dxSign;
            // Z 方向にも押す（2.5D 圧縮考慮で X の 0.7 倍）
            const dzSign = (adz < 0.5) ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(dz);
            e.z += myStrength * 0.7 * dzSign;
          }
        }
      }
    }
    e.mesh.position.x = e.x;
    e.mesh.position.z = e.z;
    // 打ち上げ（垂直）
    // down_wall_start は壁張り付きで重力スキップ（vy/yは保持・タイマー満了で wall_loop が落下開始）
    if ((e.vy !== 0 || e.y > 0 || e.peakHangTimer > 0) && e.state !== STATE.down_wall_start) {
      // 頂点到達検出：LAUNCH_COMBO属性で打ち上げ中かつ上昇→下降に切り替わった瞬間
      if (e.launcherAirborne && e.prevVy > 0 && e.vy <= 0 && e.y > 0 && e.peakHangTimer === 0) {
        const hangF = PHYSICS.ENEMY_PEAK_HANG_FRAMES ?? 36;
        e.peakHangTimer = hangF;
        e.peakHangTotal = hangF;
        spawnHitParticles(e.x, e.y + 100, e.z, 0xffffff, 8);
      }
      e.prevVy = e.vy;

      let gravFactor;
      if (e.peakHangTimer > 0) {
        // フェードイン：最初の FADE F かけて重力を base→DEPTH へ滑らかに落とす
        // DEPTH を 0.05 → 0.2 に上げて peakHang 中も微速度で降下、終了時の段差を小さくする（2026-05-20）
        const elapsed  = e.peakHangTotal - e.peakHangTimer;
        const fadeF    = PHYSICS.ENEMY_PEAK_HANG_FADE ?? 12;
        const depth    = PHYSICS.ENEMY_PEAK_HANG_DEPTH ?? 0.05;
        const fadeT    = Math.min(1, elapsed / fadeF);
        const baseFactor = (e.vy < 0) ? (PHYSICS.ENEMY_LAUNCHER_GRAV ?? 0.6) : 1.0;
        gravFactor = baseFactor + (depth - baseFactor) * fadeT;
        e.peakHangTimer--;
      } else if (e.y > 0 && e.vy < 0) {
        // 打ち上げ直後は重い減速・壁バウンス後も同等扱い（ENEMY_WALL_BOUNCE_FALL）
        const wallBounceAsLauncher = PHYSICS.ENEMY_WALL_BOUNCE_FALL && e.isWallBounce;
        if (e.launcherAirborne || wallBounceAsLauncher) {
          gravFactor = PHYSICS.ENEMY_LAUNCHER_GRAV ?? 0.6;
        } else {
          gravFactor = PHYSICS.AERIAL_GRAV_FACTOR;
        }
      } else {
        gravFactor = 1.0;
      }
      // メガクラ被弾の knockback_air01 中は重力を半減（コンボ猶予を延ばす）
      if (e.kbFromMega && e.state === STATE.knockback_air01) {
        gravFactor *= 0.5;
      }
      // バースト離脱中は重力軽減で滞空延長（攻撃側で e.burstGravMult が立つ）
      if (e.burstGravMult !== undefined && e.burstGravMult > 0 &&
          (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop)) {
        gravFactor *= e.burstGravMult;
      }
      e.vy -= PHYSICS.GRAVITY * gravFactor;
      e.y  += e.vy;
      if (e.y <= 0) {
        e.y = 0; e.vy = 0; e.prevVy = 0;
        e.peakHangTimer = 0; e.peakHangTotal = 0;
        e.launcherAirborne = false;
        // === 地面到達時のステート分岐（挙動途中からでも次へ） ===
        // tiltAngle は STATE_TILT_TARGET 経由で自動補間（明示設定なし）
        if (e.state === STATE.down_up_start || e.state === STATE.down_up_loop) {
          // 打ち上げ → 着地で静止フェーズへ
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        } else if (e.state === STATE.knockback_air01) {
          // 空中フリンチ途中で着地 → land に直行
          e.state     = STATE.land;
          e.downTimer = ENEMY_LAND_FRAMES;
          e.kbFromMega = false;  // 着地で重力半減フラグ解除
        } else if (e.state === STATE.fall_loop) {
          // 自由落下 → 着地 land
          e.state     = STATE.land;
          e.downTimer = ENEMY_LAND_FRAMES;
        } else if (e.state === STATE.down_front_start) {
          // 吹き飛び立ち上がり途中で着地 → 静止フェーズへ（down_bas_start）
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        } else if (e.state === STATE.down_front_loop) {
          // 吹き飛び完走着地 → ダウン静止ループへ（bas_start イントロはスキップ）
          e.state     = STATE.down_bas_loop;
          e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
        } else if (e.state === STATE.down_super_start || e.state === STATE.down_super_loop) {
          // 超吹き飛ばし途中で地面に当たった → 強制 down_roll_start
          e.state     = STATE.down_roll_start;
          e.downTimer = ENEMY_ROLL_START_FRAMES;
          e.rollDebugAngle = 0;  // 転がり可視化用：角度リセット（2026-05-18）
          // 慣性引き継ぎ：現在の水平速度の符号で転がり方向を決定（2026-05-18 修正）。
          //   通常の super 飛行：knockbackVx は fallDir 方向 → 転がりも fallDir
          //   壁バウンス後の super 飛行：knockbackVx は -fallDir 方向 → 転がりも -fallDir（壁から離れる方向）
          const rollDir = Math.sign(e.knockbackVx) || e.fallDir;
          e.knockbackVx = rollDir * ENEMY_ROLL_KB_VX;
          e.kbDecay     = ENEMY_ROLL_KB_DECAY;
          e.rollDir     = rollDir;  // 回転方向（rotation.x 反映用）
          // バウンス由来の super 飛行はここで終了 → フラグクリア
          e.isWallBounce = false;
        } else if (e.state === STATE.down_wall_loop) {
          // うつ伏せ落下着地 → down_bas_start（静止フェーズへ）
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        } else if (e.state === STATE.down_rakka_start || e.state === STATE.down_rakka_loop) {
          // 叩きつけ落下着地 → 1回バウンド開始
          e.state     = STATE.down_bound_start;
          e.vy        = KB_LV05_BOUNCE_VY;  // 上向き初速で離地（e.vy=0 を上書き）
          e.downTimer = ENEMY_DOWN_BOUND_FRAMES;  // バウンド効果時間
        } else if (e.state === STATE.down_bound_start) {
          // バウンド再着地 → ダウン静止ループへ
          e.state     = STATE.down_bas_loop;
          e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
        } else if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) {
          // バースト離脱着地 → ダウン静止イントロへ合流
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
          e.burstSpinRate = 0;
          e.burstGravMult = 0;
          e.burstRollAngle = 0;
          // 累積した rotation.x/z をクリア（クォータニオン経由で設定していたものを Euler に戻す）
          e.mesh.rotation.x = 0;
          e.mesh.rotation.z = 0;
          e.tiltAngle = 0;
        }
      }
      e.mesh.position.y = e.y;
    }

    // === Phase 3 AI: aiPhase 明示化（idle / chase / attack / retreat / stun）===
    // - e.state（物理・見た目）と e.aiPhase（AI 意思決定）を独立軸で運用
    // - state===wait01 のときに aiPhase で idle / chase / retreat を切り替え
    // - state===enemy_attacking のとき aiPhase='attack'（atkPhase が細部を制御）
    // - 被弾系 state（stun ラベル）は上部の同期で自動設定済
    // ローテーション攻撃：enemyAttackToken を取得した敵だけが attacking に遷移可能。
    // 被弾中追撃禁止：プレイヤーが isHitstunState の間は新規 attacking 遷移しない。
    if (ENEMY_AI.enabled && e.aiEnabled && !e.dying && _players[0] &&
        _players[0].state !== STATE.dying && _players[0].state !== STATE.dead) {
      const p0 = _players[0];
      const playerInHitstun = isHitstunState(p0);
      if (e.atkCooldown > 0) e.atkCooldown--;
      if (e.state === STATE.wait01) {
        const dx = p0.x - e.x;
        const dz = p0.z - e.z;
        const adx = Math.abs(dx);
        const adz = Math.abs(dz);
        // 向きはプレイヤー方向に揃える（retreat 中も含めて常に対面）
        if (dx !== 0) {
          e.facing = dx >= 0 ? 1 : -1;
          e.mesh.rotation.y = e.facing * Math.PI / 2;
        }

        if (e.aiPhase === 'retreat') {
          // === retreat: プレイヤーから離れる方向に一定F 後退 ===
          if (e.aiRetreatTimer > 0) {
            e.aiRetreatTimer--;
            // 後退方向 = -sign(dx)（プレイヤー逆側）
            if (adx > 0) {
              e.x -= Math.sign(dx) * DUMMY_ATK_CONFIG.retreatSpeed;
            }
            // Z 軸はそのまま（前後ジリジリ感を保つ）
          } else {
            // タイマー満了 → 距離で再判定（次フレームで chase / idle へ）
            e.aiPhase = (adx < DUMMY_ATK_CONFIG.approachRange && adz < DUMMY_ATK_CONFIG.approachRange)
              ? 'chase' : 'idle';
          }
        } else {
          // === idle / chase 判定 + 接近・攻撃発動 ===
          const inRange = (adx < DUMMY_ATK_CONFIG.approachRange && adz < DUMMY_ATK_CONFIG.approachRange);
          if (!inRange) {
            e.aiPhase = 'idle';
          } else {
            e.aiPhase = 'chase';
            // 攻撃発動条件：距離 + cooldown + 接地 + 「トークン取得可」+ 「プレイヤー被弾中でない」
            const inAttackRange = (adx <= DUMMY_ATK_CONFIG.attackRange && adz < 100 && e.atkCooldown <= 0 && e.y <= ENEMY_AIRBORNE_Y_THRESHOLD);
            const curToken = ctx.enemyAttackToken.get();
            const tokenAvailable = (curToken === null || curToken === e);
            if (inAttackRange && tokenAvailable && !playerInHitstun) {
              // 攻撃発動：トークン取得 + 攻撃 state へ遷移
              ctx.enemyAttackToken.set(e);
              e.state         = STATE.enemy_attacking;
              e.atkPhase      = 'wind';
              e.atkTimer      = DUMMY_ATK_CONFIG.windupFrames;
              e.hitDelivered  = false;
              e.aiPhase       = 'attack';
            } else {
              // 接近移動（X / Z 両軸・Z は 2.5D 圧縮考慮で 0.7 倍）
              // トークン不所持でも接近は OK（位置取り）
              if (adx > DUMMY_ATK_CONFIG.attackRange) {
                e.x += Math.sign(dx) * DUMMY_ATK_CONFIG.approachSpeed;
              }
              if (adz > 80) {  // active ヒットの rangeZ 圏内まで詰める
                e.z += Math.sign(dz) * DUMMY_ATK_CONFIG.approachSpeed * 0.7;
              }
              // attackRange 内だが token 不可 / player 被弾中 → その場で待機（ジリジリ感）
            }
          }
        }
      } else if (e.state === STATE.enemy_attacking) {
        e.aiPhase = 'attack';
        e.atkTimer--;
        if (e.atkPhase === 'wind') {
          // カウントダウン中もプレイヤーに追従（向き合わせ + X/Z 両軸で詰める）
          const dx = p0.x - e.x;
          const dz = p0.z - e.z;
          const adx = Math.abs(dx);
          const adz = Math.abs(dz);
          if (dx !== 0) {
            e.facing = dx > 0 ? 1 : -1;
            e.mesh.rotation.y = e.facing * Math.PI / 2;
          }
          // 距離が attackRange より外なら少しずつ追う（カウントダウン中の追跡速度は控えめ）
          if (adx > DUMMY_ATK_CONFIG.attackRange * 0.75) {
            e.x += Math.sign(dx) * DUMMY_ATK_CONFIG.approachSpeed * 0.6;
          }
          if (adz > 80) {  // Z 軸も詰める（active 判定の rangeZ 圏内に）
            e.z += Math.sign(dz) * DUMMY_ATK_CONFIG.approachSpeed * 0.6 * 0.7;
          }
          // approachRange を完全に超えたらキャンセルして wait01 復帰（X / Z 共通）
          if (adx > DUMMY_ATK_CONFIG.approachRange || adz > DUMMY_ATK_CONFIG.approachRange) {
            e.state         = STATE.wait01;
            e.atkPhase      = null;
            e.atkCooldown   = 30;
            e.hitDelivered  = false;
            e.aiPhase       = 'idle';  // wind キャンセル → 次F に距離再判定
            if (ctx.enemyAttackToken.get() === e) ctx.enemyAttackToken.set(null);  // トークン解放
          } else if (e.atkTimer <= 0) {
            e.atkPhase = 'active';
            e.atkTimer = DUMMY_ATK_CONFIG.activeFrames;
            // カウントダウン終了 → アクティブ：踏み込み
            e.x += e.facing * 8;
          }
        } else if (e.atkPhase === 'active') {
          if (!e.hitDelivered) {
            if (tryHitPlayer(e, DUMMY_ATK_CONFIG)) {
              e.hitDelivered = true;
            }
          }
          if (e.atkTimer <= 0) {
            e.atkPhase = 'recover';
            e.atkTimer = DUMMY_ATK_CONFIG.recoverFrames;
          }
        } else if (e.atkPhase === 'recover') {
          if (e.atkTimer <= 0) {
            e.state         = STATE.wait01;
            e.atkPhase      = null;
            e.atkCooldown   = DUMMY_ATK_CONFIG.cooldownFrames;
            e.hitDelivered  = false;
            // Phase 3：recover 完了 → retreat フェーズへ
            e.aiPhase       = 'retreat';
            e.aiRetreatTimer = DUMMY_ATK_CONFIG.retreatFrames;
            if (ctx.enemyAttackToken.get() === e) ctx.enemyAttackToken.set(null);  // トークン解放
          }
        }
      }
    }

    // ステータス系：status_stun のタイマー駆動（duration 経過で wait01）
    if (e.state === STATE.status_stun) {
      if (--e.statusStunTimer <= 0) {
        e.state = STATE.wait01;
        e.statusStunTimer = 0;
      }
    }
    // ダウン・被弾ステート機械（タイマー駆動の遷移のみ・tiltAngle は後段で一括計算）
    if (e.state === STATE.down_up_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_up_loop;
    } else if (e.state === STATE.down_up_loop) {
      // 横倒しのまま落下（着地は y<=0 ブロックで処理）
    } else if (e.state === STATE.down_bas_start) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_bas_loop) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_bas_end;
        e.downTimer = ENEMY_RISE_FRAMES;
      }
    } else if (e.state === STATE.down_bas_end) {
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.knockback01 || e.state === STATE.knockback02) {
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.knockback03) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    } else if (e.state === STATE.knockback_air01) {
      if (--e.downTimer <= 0) {
        e.state = STATE.fall_loop;
        e.kbFromMega = false;  // 通常フリンチ終了で重力半減フラグ解除
      }
    } else if (e.state === STATE.fall_loop) {
      // 自由落下中（着地は y<=0 ブロック）
    } else if (e.state === STATE.land) {
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.down_front_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_front_loop;
    } else if (e.state === STATE.down_front_loop) {
      // 吹き飛び中（着地は y<=0 ブロック）
    } else if (e.state === STATE.down_super_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_super_loop;
    } else if (e.state === STATE.down_super_loop) {
      // 吹き飛び中（壁/地面は前段ブロックで処理）
    } else if (e.state === STATE.down_wall_start) {
      // 壁張り付き 30F 経過 → 反作用バウンス：プレイヤー方向（-fallDir）に大きく飛び上がる（2026-05-18）
      //   既存の down_super_loop に再突入。地面到達で既存の down_roll_start 遷移が走る。
      //   ※ superFlightCount は lv 6 攻撃 hit 時のみ増加するため、ここでは増えない
      //     → 2 回目発動による無敵化ロジックには干渉しない
      if (--e.downTimer <= 0) {
        e.vy           = ENEMY_WALL_BOUNCE_VY;
        // 距離認識バウンス（2026-05-20 改）：プレイヤーまでの距離から到達飛距離を逆算し、
        //   「プレイヤー手前 80wu」で停止するように KB_VX を決める。
        //   累積飛距離 ≈ KB_VX / (1 - DECAY)。手前マージン 80wu でちょい届かない位置に着地。
        //   distToPlayer が極端に近い/遠い場合に備えて KB_VX を [6, 25] でクランプ。
        const p = _players[0];
        const distToPlayer = p ? Math.abs(p.x - e.x) : 200;
        const stopMargin = 80;  // プレイヤー手前で止めるマージン
        const targetDist = Math.max(0, distToPlayer - stopMargin);
        const kbVxFromDist = targetDist * (1 - ENEMY_WALL_BOUNCE_KB_DECAY);
        // 近距離は 0 まで許容（過剰バウンス防止）／遠距離は max でクランプ
        const kbVx = Math.min(ENEMY_WALL_BOUNCE_KB_VX, kbVxFromDist);
        e.knockbackVx  = -e.fallDir * kbVx;
        e.kbDecay      = ENEMY_WALL_BOUNCE_KB_DECAY;
        e.state        = STATE.down_super_loop;
        e.downTimer    = 999;  // 地面 / 壁 / カウンタ更新で次状態へ遷移するため大きな値で OK
        // 壁側を向いたまま飛ぶ：rotation.y を +fallDir 基準で設定（2026-05-18）
        //   ※ 通常の被弾 facing は -fallDir*π/2（プレイヤー側）。壁バウンスはそれの逆向き。
        //   rotation.y はその後の super 飛行 / down_roll_* / down_bas_loop に
        //   そのまま引き継がれる（mesh.rotation は明示再設定が無ければ持続）。
        e.mesh.rotation.y = e.fallDir * Math.PI / 2;
        // バウンス中フラグ：被弾時に通常 knockback 状態へ遷移可能にする（trajectory protect 解除）
        e.isWallBounce = true;
      }
    } else if (e.state === STATE.down_wall_loop) {
      // うつ伏せ落下中（着地は y<=0 ブロックで処理）
      // 保険：地上 (y=0) で壁ヒットして wall_loop に来た場合、落下するべき距離がないので
      // 着地ブロックが走らずハングする。ここで直接 down_bas_start へ抜ける（2026-05-16）
      if (e.y <= 0) {
        e.y         = 0;
        e.state     = STATE.down_bas_start;
        e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
      }
    } else if (e.state === STATE.down_roll_start) {
      if (--e.downTimer <= 0) {
        e.state     = STATE.down_roll_loop;
        e.downTimer = ENEMY_ROLL_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_roll_loop) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_rakka_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_rakka_loop;
    } else if (e.state === STATE.down_rakka_loop) {
      // 真下落下中（着地は y<=0 ブロックで down_bound_start に遷移）
    } else if (e.state === STATE.down_burst_start) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_burst_loop;
        e.downTimer = ENEMY_DOWN_BURST_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_burst_loop) {
      // 空中スピン中（着地で down_bas_start に合流・y<=0 ブロックで処理）
      // 滞空が長引いた場合のフォールバック（万一着地検知が抜けたら強制終了）
      if (--e.downTimer <= 0) {
        e.state     = STATE.down_bas_start;
        e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        e.burstSpinRate = 0;
        e.burstGravMult = 0;
        e.burstRollAngle = 0;
        e.mesh.rotation.x = 0;
        e.mesh.rotation.z = 0;
        e.tiltAngle = 0;
      }
    } else if (e.state === STATE.down_bound_start) {
      // バウンド中：通常は再着地（y<=0）で down_bas_loop に遷移
      // 万一着地が発火しなかった場合のフォールバック
      if (--e.downTimer <= 0) {
        e.state     = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    }

    // === tiltAngle 一括計算（データテーブル + ランプ系特殊処理） ===
    if (e.state === STATE.down_up_start) {
      // 0 → π/2 ランプ（downTimer: ENEMY_FALL_FRAMES → 0）
      e.tiltAngle = (1 - e.downTimer / ENEMY_FALL_FRAMES) * (Math.PI / 2);
    } else if (e.state === STATE.down_front_start) {
      // 0 → π/2 後方ランプ（down_up_start と同じ仕組み・downTimer: ENEMY_DOWN_FRONT_FRAMES → 0）
      e.tiltAngle = (1 - e.downTimer / ENEMY_DOWN_FRONT_FRAMES) * (Math.PI / 2);
    } else if (e.state === STATE.down_bas_end) {
      // π/2 → 0 ランプ（downTimer: ENEMY_RISE_FRAMES → 0）
      e.tiltAngle = (e.downTimer / ENEMY_RISE_FRAMES) * (Math.PI / 2);
    } else if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) {
      // バースト離脱：きりもみ回転（鉄拳系の長軸ロール）
      //   Three.js Euler 順 'ZYX' では Rx が内側 → 単純な rotation.x 加算では
      //   「水平に倒した上で長軸まわりに回す」が表現できない。
      //   ここで直接クォータニオン合成： q = qX(roll) * qZ(tilt) * qY(face)
      //   これで Rx が一番外側になり、tilt 後の世界 X 軸（≒長軸）まわりに回せる
      e.burstRollAngle += e.fallDir * (e.burstSpinRate || 0);
      const _faceY = -e.fallDir * Math.PI / 2;  // 既存の wait01 facing と一致
      const _tiltZ = -e.fallDir * Math.PI / 2;  // 水平倒し（head が +fallDir 方向へ）
      const _rollX = e.burstRollAngle;
      const _qY = new _THREE.Quaternion().setFromAxisAngle(new _THREE.Vector3(0, 1, 0), _faceY);
      const _qZ = new _THREE.Quaternion().setFromAxisAngle(new _THREE.Vector3(0, 0, 1), _tiltZ);
      const _qX = new _THREE.Quaternion().setFromAxisAngle(new _THREE.Vector3(1, 0, 0), _rollX);
      e.mesh.quaternion.copy(_qX).multiply(_qZ).multiply(_qY);
      // tiltAngle は同期しておく（参考用・他系統が触らないようにするため）
      e.tiltAngle = Math.PI / 2;
    } else if (e.state === STATE.down_roll_start || e.state === STATE.down_roll_loop) {
      // 転がり中：直立姿勢のまま X 軸（前後方向）でごろごろ回転（2026-05-18 修正）
      //   tilt（rotation.z）は 0 のまま。rotation.x を連続加算で後転（back-flip）。
      //   θ は常に -0.35 単位で減少。rotation.y で世界座標への解釈が自動反転されるため、
      //   通常被弾（rotY=-π/2）も壁バウンス（rotY=+π/2）も θ 減少だけで自然な
      //   ローリング（頭が motion 方向に先行）になる。rollDir は kbVx 方向で別途管理。
      e.rollDebugAngle -= 0.35;  // ≒ 20°/F
      e.tiltAngle = 0;  // 同期（後段の rotation.z 反映で 0 になる）
    } else {
      const tiltTarget = STATE_TILT_TARGET[e.state] ?? 0;
      e.tiltAngle += (tiltTarget - e.tiltAngle) * STATE_TILT_LERP;
    }
    // rotation.z = -fallDir * tiltAngle で水平倒し方向を反映
    //   burst 中はクォータニオン直接合成しているのでスキップ（Euler を上書きすると壊れる）
    if (e.state !== STATE.down_burst_start &&
        e.state !== STATE.down_burst_loop) {
      e.mesh.rotation.z = -e.fallDir * e.tiltAngle;
    }
    // === rotation.x の用途分岐（優先順位：寝姿勢 > バースト累積 > pitch system > リセット）===
    // ZYX 順なので rx と rz が独立に作用する（YXZ/XYZ だと両方非ゼロで奇妙な傾きになる）
    // pitch system の対象外ステートでは rx を 0 に固定して z-tilt の純粋な見た目を維持
    if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) {
      // バースト離脱中：rotation.x は上の累積回転を保持（リセットしない）
      // pitchAngle は同期しない（次の状態でリセットされる）
    } else if (e.state === STATE.down_roll_start || e.state === STATE.down_roll_loop) {
      // 転がり中：rotation.x を rollDebugAngle で直接駆動（後方ごろごろ・2026-05-18）
      e.mesh.rotation.x = e.rollDebugAngle;
      e.pitchAngle = 0;
    } else if (e.state === STATE.down_rakka_start ||
        e.state === STATE.down_rakka_loop ||
        e.state === STATE.down_bound_start) {
      // あおむけ姿勢（lv05 系）：X 軸で背中を下に向ける
      e.mesh.rotation.x = -Math.PI / 2;
      e.pitchAngle = 0;
    } else if (STATE_PITCH_TARGET[e.state] !== undefined) {
      // pitch system 対象ステート（knockback01/02/_air01）：rx 駆動の前後傾
      const pitchTarget = STATE_PITCH_TARGET[e.state];
      e.pitchAngle += (pitchTarget - e.pitchAngle) * STATE_PITCH_LERP;
      e.mesh.rotation.x = e.pitchAngle;
    } else {
      // それ以外（down_front_* / down_up_* / wait01 など）：rx は即 0 にして
      // rotation.z の傾きを純粋に見せる
      e.pitchAngle = 0;
      e.mesh.rotation.x = 0;
    }

    // === 転がり中の腰ピボット補正（2026-05-18・rotation.y 対応版）===
    //   rotation.x をメッシュ原点（足元）周りでなく、腰相当（y=ROLL_HIP_PIVOT）周りに見せる。
    //   ZYX 適用順なので hip local (0, h, 0) は Rx → Ry の順で変換される：
    //     after Rx(θ): (0, h*cos θ, h*sin θ)
    //     after Ry(φ): (h*sin θ * sin φ, h*cos θ, h*sin θ * cos φ)
    //   world hip = pos + 上記。これを (e.x, e.y + h, e.z) に固定したいので：
    //     pos.x = e.x - h*sin θ * sin φ
    //     pos.y = e.y + h*(1 - cos θ)
    //     pos.z = e.z - h*sin θ * cos φ
    if (e.state === STATE.down_roll_start || e.state === STATE.down_roll_loop) {
      const ROLL_HIP_PIVOT = 70;  // 腰高さ（body 中心 80・脚台座 15-30 の間）
      const θ = e.rollDebugAngle;
      const φ = e.mesh.rotation.y;
      const sinT = Math.sin(θ), cosT = Math.cos(θ);
      const sinP = Math.sin(φ), cosP = Math.cos(φ);
      e.mesh.position.x = e.x - ROLL_HIP_PIVOT * sinT * sinP;
      e.mesh.position.y = e.y + ROLL_HIP_PIVOT * (1 - cosT);
      e.mesh.position.z = e.z - ROLL_HIP_PIVOT * sinT * cosP;
    } else {
      // 転がり以外の状態：オフセット解除（前フレームの補正値が残らないよう毎フレーム正規化）
      e.mesh.position.x = e.x;
      e.mesh.position.y = e.y;
      e.mesh.position.z = e.z;
    }

    // ヒットフラッシュ（2026-05-20 緑配色対応：元色 0x2d4a22 / 0x77aa55）
    //   2026-05-20：detach 済（parent !== e.mesh）の part には書き込まない
    //   → MeshBasicMaterial(0x000000) で上書き済の飛翔中パーツが緑に戻ってしまうバグ対策
    const _body = e.mesh.userData.parts.body;
    const _head = e.mesh.userData.parts.head;
    const _bodyAtt = _body && _body.parent === e.mesh;
    const _headAtt = _head && _head.parent === e.mesh;
    if (e.hitFlashTimer > 0) {
      e.hitFlashTimer--;
      const t = e.hitFlashTimer / 7;
      // body: 0x2d4a22 (0.176, 0.290, 0.133) → flash bright green (0.6, 1.0, 0.4)
      if (_bodyAtt) _body.material.color.setRGB(
        0.176 + t * 0.424, 0.290 + t * 0.710, 0.133 + t * 0.267
      );
      // head: 0x77aa55 (0.467, 0.667, 0.333) → flash brighter (0.85, 1.0, 0.55)
      if (_headAtt) _head.material.color.setRGB(
        0.467 + t * 0.383, 0.667 + t * 0.333, 0.333 + t * 0.217
      );
    } else {
      if (_bodyAtt) _body.material.color.setHex(0x2d4a22);
      if (_headAtt) _head.material.color.setHex(0x77aa55);
    }

    // きりもみやられ突入フラッシュ：紫を「乗算」で body/head 色に被せる
    //   元色 (0x2d4a22 / 0x77aa55) × 紫 (0x6622ff) を t=1 とし、t=0 で元色へフェード復帰
    //   持続は ENEMY_BURST_FLASH_FRAMES = SPECIAL_CONFIG.FLASH_FRAMES * 1.5（紫の余韻を強調）
    //   トリガは hit-engine.js の down_burst_start 遷移時に burstFlashTimer をセット
    if (e.burstFlashTimer > 0) {
      e.burstFlashTimer--;
      const t = e.burstFlashTimer / ENEMY_BURST_FLASH_FRAMES;
      // 元色（2026-05-20 緑配色）
      const bR = 0x2d/255, bG = 0x4a/255, bB = 0x22/255;
      const hR = 0x77/255, hG = 0xaa/255, hB = 0x55/255;
      // 紫乗算後
      const bMr = bR * PURPLE_R, bMg = bG * PURPLE_G, bMb = bB * PURPLE_B;
      const hMr = hR * PURPLE_R, hMg = hG * PURPLE_G, hMb = hB * PURPLE_B;
      // lerp: t=1 紫乗算 / t=0 元色 — detach 済パーツには書き込まない
      if (_bodyAtt) _body.material.color.setRGB(
        bR + (bMr - bR) * t, bG + (bMg - bG) * t, bB + (bMb - bB) * t,
      );
      if (_headAtt) _head.material.color.setRGB(
        hR + (hMr - hR) * t, hG + (hMg - hG) * t, hB + (hMb - hB) * t,
      );
      e._burstFlashWasOn = true;
    } else if (e._burstFlashWasOn) {
      // 直後の元色復帰は上の hitFlash else 分岐が毎フレーム行うので追加リセット不要
      e._burstFlashWasOn = false;
    }
    // Phase 3：dying 色オーバーライ（毎フレーム最後・hitFlash/burstFlash 結果を黒へ lerp）
    if (e.dying && e.dyingPhase !== 'exploded') _applyDyingColorOverride(e);
    // Phase 3：爆発直前の白フラッシュ（final/burst の最後 N フレーム）
    if (e.dying
        && (e.dyingPhase === 'final' || e.dyingPhase === 'burst')
        && e.dyingFinalTimer > 0
        && e.dyingFinalTimer <= GORE_CONFIG.PREEXPLODE_FLASH_FRAMES) {
      _applyPreExplodeFlash(e);
    }
  }
  // Phase 3-A：cleanup pass — フェード完了で removed=true の敵を scene + 配列から除去
  //   Phase 3-B（2026-05-20）：mortal モードなら同じ位置に即リスポーン
  const _respawnQueue = [];
  for (let i = _enemies.length - 1; i >= 0; i--) {
    if (_enemies[i].removed) {
      const dead = _enemies[i];
      if (dead.mesh) _scene.remove(dead.mesh);
      // mortal モード時：元の spawn 位置に同条件で復活させる（HP は _spawnOpts.maxHp に従う）
      if (window.SB && window.SB.MORTAL_MODE && dead._spawnX !== undefined) {
        _respawnQueue.push({ x: dead._spawnX, z: dead._spawnZ, opts: dead._spawnOpts });
      }
      _enemies.splice(i, 1);
    }
  }
  for (const r of _respawnQueue) {
    spawnDummy(r.x, r.z, r.opts);
  }
}

// 紫乗算定数：0x6622ff の RGB ノーマライズ値
const PURPLE_R = 0x66 / 255;  // ≈ 0.40
const PURPLE_G = 0x22 / 255;  // ≈ 0.13
const PURPLE_B = 0xff / 255;  // 1.00
// きりもみフラッシュ持続：プレイヤー必殺技のフラッシュ（12F）の 1.5 倍
const ENEMY_BURST_FLASH_FRAMES = Math.round(SPECIAL_CONFIG.FLASH_FRAMES * 1.5);
