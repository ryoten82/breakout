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
  ENEMY_WALL_START_FRAMES, ENEMY_ROLL_FRAMES,
  ENEMY_DOWN_BURST_LOOP_FRAMES, ENEMY_DOWN_BOUND_FRAMES,
  ENEMY_AIRBORNE_Y_THRESHOLD,
  KB_LV05_BOUNCE_VY,
} from './states.js';
import { PHYSICS, ENEMY_AI, DUMMY_ATK_CONFIG, SPECIAL_CONFIG } from './config.js';
import { spawnHitParticles, triggerShake, tryThrownChainHit } from './hit-engine.js';
import { isHitstunState, tryHitPlayer } from './damage-system.js';

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
  const baseMat = new _THREE.MeshToonMaterial({ color: 0x884444 });
  const accentMat = new _THREE.MeshToonMaterial({ color: 0xddaa44 });

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

  // 向き確認用ノーズ（頭前面 +Z に赤コーン）
  const noseMat = new _THREE.MeshToonMaterial({ color: 0xff2222 });
  const nose = new _THREE.Mesh(new _THREE.ConeGeometry(6, 20, 8), noseMat);
  nose.rotation.x = -Math.PI / 2; // コーン先端を +Z（前方）に向ける
  nose.position.set(0, 165, 30);
  group.add(nose);

  group.userData.parts = { body, head, stand, nose };
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
  const e = {
    mesh,
    x: x, y: 0, z: z,
    hp:             100,
    maxHp:          100,
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
    burstSpinRate:    0,
    burstGravMult:    0,
    burstRollAngle:   0,
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
    // === 投擲弾（グラブ投げ → 他敵衝突連鎖）===
    thrownProjectile: false,  // 飛行中フラグ（true なら他敵との衝突判定が走る）
    thrownByPlayer:   null,   // ダメージ帰属（コンボ・SP 加算用）
    thrownDir:        0,      // 飛行方向（+1=右 / -1=左）
  };
  _enemies.push(e);
  return e;
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
    // ULT 発動中の時間停止：最初のヒットを受けるまで凍結（state / vy / downTimer すべて維持）
    if (e.frozenByUlt) continue;
    // グラブ被害中：position・state は処理側（processGrabInput）で固定維持
    if (e.state === STATE.grabbed) continue;
    // wait01 復帰時：必殺技ヒット履歴 + コンボルートをクリア（敵単位の各種ループ制限のリセット）
    if (e.state === STATE.wait01) {
      if (e.specialHitBy && e.specialHitBy.size > 0) e.specialHitBy.clear();
      if (e.comboRoute && e.comboRoute.length > 0) e.comboRoute.length = 0;
      if (e.ultBurstInvincible) e.ultBurstInvincible = false;  // 起き上がり完了で ULT-burst 無敵解除
    }
    // 死亡判定（ダミーは即復活で無限練習用）
    if (e.hp <= 0) {
      e.hp = e.maxHp;
      // ★ステートは上書きしない：ダウン誘発技で hp 0 にした場合も
      //   そのフレームに dispatch された down_front_start 等のステートを残し、
      //   ダウン animation を最後まで見せる。
      //   各 down ステートは自分でタイマー満了して wait01 に戻るので
      //   ダミーは「ダウン演出 → 立ち直り」の自然なサイクルでループ復活する
      spawnHitParticles(e.x, e.y + 100, e.z, 0xff8844, 24);
      triggerShake(8, 14);
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
    const hitLeft  = e.x < PHYSICS.STAGE_LEFT;
    const hitRight = e.x > PHYSICS.STAGE_RIGHT;
    if (hitLeft || hitRight) {
      e.x = hitLeft ? PHYSICS.STAGE_LEFT : PHYSICS.STAGE_RIGHT;
      if (e.state === STATE.down_super_start || e.state === STATE.down_super_loop) {
        e.state       = STATE.down_wall_start;
        e.downTimer   = ENEMY_WALL_START_FRAMES;
        e.vy          = 0;          // 壁にべたっと張り付き（一旦停止）
        e.knockbackVx = 0;
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
        e.peakHangTimer = 36;
        e.peakHangTotal = 36;
        spawnHitParticles(e.x, e.y + 100, e.z, 0xffffff, 8);
      }
      e.prevVy = e.vy;

      let gravFactor;
      if (e.peakHangTimer > 0) {
        // フェードイン：最初の12Fかけて重力を1.0→0.05へ滑らかに落とす
        const elapsed  = e.peakHangTotal - e.peakHangTimer;
        const fadeT    = Math.min(1, elapsed / 12);
        const baseFactor = (e.vy < 0) ? 0.6 : 1.0;
        gravFactor = baseFactor + (0.05 - baseFactor) * fadeT;
        e.peakHangTimer--;
      } else if (e.y > 0 && e.vy < 0) {
        // 打ち上げ直後は重い減速・その後（地上技含む）はふわっと重力で統一
        if (e.launcherAirborne)  gravFactor = 0.6;
        else                     gravFactor = PHYSICS.AERIAL_GRAV_FACTOR;
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
          e.downTimer = ENEMY_ROLL_FRAMES;
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

    // === ミニマム AI（Phase 2.4 ダミー敵）===
    // wait01 ⇄ enemy_attacking の小ループ。被弾系 state では発動しない。
    // ローテーション攻撃：enemyAttackToken を取得した敵だけが attacking に遷移可能。
    // 被弾中追撃禁止：プレイヤーが isHitstunState の間は新規 attacking 遷移しない。
    if (ENEMY_AI.enabled && e.aiEnabled && _players[0] &&
        _players[0].state !== STATE.dying && _players[0].state !== STATE.dead) {
      const p0 = _players[0];
      const playerInHitstun = isHitstunState(p0);
      if (e.atkCooldown > 0) e.atkCooldown--;
      if (e.state === STATE.wait01) {
        const dx = p0.x - e.x;
        const dz = p0.z - e.z;
        const adx = Math.abs(dx);
        const adz = Math.abs(dz);
        // 向きをプレイヤーに合わせる（接近/攻撃時のみ）
        // 追跡範囲は X / Z ともに approachRange（Z 軸を離しても追う・以前は adz<200 で打ち切られていた）
        if (adx < DUMMY_ATK_CONFIG.approachRange && adz < DUMMY_ATK_CONFIG.approachRange) {
          e.facing = dx >= 0 ? 1 : -1;
          e.mesh.rotation.y = e.facing * Math.PI / 2;
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
          } else {
            // 接近移動（X / Z 両軸・Z は 2.5D 圧縮考慮で 0.7 倍）
            // トークン不所持でも接近は OK（位置取り）
            if (adx > DUMMY_ATK_CONFIG.attackRange) {
              e.x += Math.sign(dx) * DUMMY_ATK_CONFIG.approachSpeed;
            }
            if (adz > 80) {  // active ヒットの rangeZ 圏内まで詰める
              e.z += Math.sign(dz) * DUMMY_ATK_CONFIG.approachSpeed * 0.7;
            }
          }
          // attackRange 内だが token 不可 / player 被弾中 → その場で待機（ジリジリ感）
        }
      } else if (e.state === STATE.enemy_attacking) {
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
            if (ctx.enemyAttackToken.get() === e) ctx.enemyAttackToken.set(null);  // トークン解放
          }
        }
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
      if (--e.downTimer <= 0) e.state = STATE.down_wall_loop;
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
    } else {
      const tiltTarget = STATE_TILT_TARGET[e.state] ?? 0;
      e.tiltAngle += (tiltTarget - e.tiltAngle) * STATE_TILT_LERP;
    }
    // rotation.z = -fallDir * tiltAngle で水平倒し方向を反映
    //   burst 中は上でクォータニオン直接合成しているのでスキップ（Euler を上書きすると壊れる）
    if (e.state !== STATE.down_burst_start && e.state !== STATE.down_burst_loop) {
      e.mesh.rotation.z = -e.fallDir * e.tiltAngle;
    }
    // === rotation.x の用途分岐（優先順位：寝姿勢 > バースト累積 > pitch system > リセット）===
    // ZYX 順なので rx と rz が独立に作用する（YXZ/XYZ だと両方非ゼロで奇妙な傾きになる）
    // pitch system の対象外ステートでは rx を 0 に固定して z-tilt の純粋な見た目を維持
    if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) {
      // バースト離脱中：rotation.x は上の累積回転を保持（リセットしない）
      // pitchAngle は同期しない（次の状態でリセットされる）
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

    // ヒットフラッシュ
    if (e.hitFlashTimer > 0) {
      e.hitFlashTimer--;
      const t = e.hitFlashTimer / 7;
      e.mesh.userData.parts.body.material.color.setRGB(
        0.53 + t * 0.47, 0.27, 0.27
      );
      e.mesh.userData.parts.head.material.color.setRGB(
        0.87 + t * 0.13, 0.67, 0.27
      );
    } else {
      e.mesh.userData.parts.body.material.color.setHex(0x884444);
      e.mesh.userData.parts.head.material.color.setHex(0xddaa44);
    }

    // きりもみやられ突入フラッシュ：紫を「乗算」で body/head 色に被せる
    //   元色 (0x884444 / 0xddaa44) × 紫 (0x6622ff) を t=1 とし、t=0 で元色へフェード復帰
    //   持続は ENEMY_BURST_FLASH_FRAMES = SPECIAL_CONFIG.FLASH_FRAMES * 1.5（紫の余韻を強調）
    //   トリガは hit-engine.js の down_burst_start 遷移時に burstFlashTimer をセット
    if (e.burstFlashTimer > 0) {
      e.burstFlashTimer--;
      const t = e.burstFlashTimer / ENEMY_BURST_FLASH_FRAMES;
      // 元色
      const bR = 0x88/255, bG = 0x44/255, bB = 0x44/255;
      const hR = 0xdd/255, hG = 0xaa/255, hB = 0x44/255;
      // 紫乗算後
      const bMr = bR * PURPLE_R, bMg = bG * PURPLE_G, bMb = bB * PURPLE_B;
      const hMr = hR * PURPLE_R, hMg = hG * PURPLE_G, hMb = hB * PURPLE_B;
      // lerp: t=1 紫乗算 / t=0 元色
      e.mesh.userData.parts.body.material.color.setRGB(
        bR + (bMr - bR) * t, bG + (bMg - bG) * t, bB + (bMb - bB) * t,
      );
      e.mesh.userData.parts.head.material.color.setRGB(
        hR + (hMr - hR) * t, hG + (hMg - hG) * t, hB + (hMb - hB) * t,
      );
      e._burstFlashWasOn = true;
    } else if (e._burstFlashWasOn) {
      // 直後の元色復帰は上の hitFlash else 分岐が毎フレーム行うので追加リセット不要
      e._burstFlashWasOn = false;
    }
  }
}

// 紫乗算定数：0x6622ff の RGB ノーマライズ値
const PURPLE_R = 0x66 / 255;  // ≈ 0.40
const PURPLE_G = 0x22 / 255;  // ≈ 0.13
const PURPLE_B = 0xff / 255;  // 1.00
// きりもみフラッシュ持続：プレイヤー必殺技のフラッシュ（12F）の 1.5 倍
const ENEMY_BURST_FLASH_FRAMES = Math.round(SPECIAL_CONFIG.FLASH_FRAMES * 1.5);
