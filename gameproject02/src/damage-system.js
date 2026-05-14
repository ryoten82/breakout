// ============================================================
//  SCRAP BLITZ — damage-system（分離 Phase: Step D-1）
//
//  プレイヤー被ダメ・危機状態・無敵点滅・body color tint の関数群。
//  Phase 2.4 で追加された独立性の高いセットを 1 モジュールに集約。
//
//  ES Module として index.html から import される：
//    import {
//      initDamageSystem,
//      isHitstunState, damagePlayer, tryHitPlayer,
//      updatePlayerHitstun, updateInvincibleBlink, updateCrisisEffect,
//      revivePlayer, _cancelHitstunForReversal, resetCombo,
//      cacheBodyColors, tintBody, restoreBodyColor,
//    } from './src/damage-system.js';
//
//  外部依存（spawnHitParticles / triggerHitstop / triggerShake / combo / comboEl / players）は
//  initDamageSystem(deps) で初期化時にバインドする：
//    initDamageSystem({
//      spawnHitParticles, triggerHitstop, triggerShake,
//      combo, comboEl, players,
//    });
//
//  data → engine の単方向 import 原則：
//    - states.js / config.js から定数 import（純データ層）
//    - 外部関数（演出系）は deps 渡し（engine 同士の循環回避）
// ============================================================

import {
  STATE,
  HP_CONFIG,
  PLAYER_KB_GRAV, PLAYER_KB_VX_DECAY,
  PLAYER_KB01_FRAMES, PLAYER_KB02_FRAMES,
  PLAYER_DOWN_FRONT_START_FRAMES,
  PLAYER_DOWN_BAS_START_FRAMES, PLAYER_DOWN_BAS_LOOP_FRAMES, PLAYER_DOWN_BAS_END_FRAMES,
} from './states.js';
import { SP_CONFIG, GUARD_CONFIG } from './config.js';

// ============================================================
//  依存注入（initDamageSystem で外部関数とグローバル参照をバインド）
// ============================================================
let _spawnHitParticles = null;
let _triggerHitstop    = null;
let _triggerShake      = null;
let _combo             = null;  // { count, lastHitEnemy } のオブジェクト参照
let _comboEl           = null;  // DOM 要素
let _players           = null;  // 配列参照

export function initDamageSystem(deps) {
  _spawnHitParticles = deps.spawnHitParticles;
  _triggerHitstop    = deps.triggerHitstop;
  _triggerShake      = deps.triggerShake;
  _combo             = deps.combo;
  _comboEl           = deps.comboEl;
  _players           = deps.players;
}

// ============================================================
//  mesh body color の原色キャッシュ & tint 操作
//  死亡時の「黒くなる」「黒↔赤点滅」の表現用
// ============================================================
const _bodyColorCache = new WeakMap();   // material → 原色 {r,g,b}

export function cacheBodyColors(playerMesh) {
  playerMesh.traverse(obj => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (!mat || !mat.color) return;
    if (_bodyColorCache.has(mat)) return;
    _bodyColorCache.set(mat, { r: mat.color.r, g: mat.color.g, b: mat.color.b });
  });
}

export function tintBody(playerMesh, targetR, targetG, targetB, mix) {
  const m = Math.max(0, Math.min(1, mix));
  const visited = new Set();
  playerMesh.traverse(obj => {
    if (!obj.isMesh) return;
    const mat = obj.material;
    if (!mat || !mat.color) return;
    if (visited.has(mat)) return;
    visited.add(mat);
    const orig = _bodyColorCache.get(mat);
    if (!orig) return;
    mat.color.setRGB(
      orig.r * (1 - m) + targetR * m,
      orig.g * (1 - m) + targetG * m,
      orig.b * (1 - m) + targetB * m,
    );
  });
}

export function restoreBodyColor(playerMesh) {
  tintBody(playerMesh, 0, 0, 0, 0);   // mix=0 で完全に原色
}

// ============================================================
//  hitstun（入力ロック対象 state）判定 & 攻撃中断ヘルパ
// ============================================================
const _HITSTUN_STATES = new Set([
  STATE.knockback01, STATE.knockback02,
  STATE.down_front_start, STATE.down_front_loop,
  STATE.down_bas_start, STATE.down_bas_loop, STATE.down_bas_end,
  STATE.guard_crash, STATE.dying, STATE.dead, STATE.respawning,
]);

export function isHitstunState(p) {
  return _HITSTUN_STATES.has(p.state);
}

// 攻撃系フィールドの一括クリーンアップ（被弾で攻撃中断する時に呼ぶ）
export function _cancelPlayerAction(p) {
  p.attackId           = null;
  p.attackChainIdx     = -1;
  p.attackChainArr     = null;
  p.hitDelivered       = false;
  p.cancelTimer        = 0;
  p.bigBurstTimer      = 0;
  p.lungeMomentum      = 0;
  p.homingTarget       = null;
  p.homingFrames       = 0;
  p.multiHitNextHit.clear();
  p.specialFlashTimer  = 0;
  p.chargeJFrames      = 0;
  p.chargeReady        = false;
  p.jHeldDuringCharge  = false;
  p.attackBuffered     = false;
  p.kBuffered          = false;
}

// コンボ強制リセット（プレイヤー被弾時。checkComboBreak は敵 wait01 条件のため別途必要）
export function resetCombo() {
  if (_combo.count > 0) {
    _combo.count = 0;
    _combo.lastHitEnemy = null;
    _comboEl.style.opacity = '0';
  }
  for (const pp of _players) {
    pp.specialUsedIds.clear();
    pp.comboTarget = null;
    pp.oppositeInputFrames = 0;
  }
}

// 被弾 state の lv 順位（lv 比較用：高いほど強い被弾）
function _hitLv(state) {
  switch (state) {
    case STATE.knockback01: return 1;
    case STATE.knockback02: return 2;
    case STATE.down_front_start:
    case STATE.down_front_loop: return 3;
    default: return 0;
  }
}

// ============================================================
//  damagePlayer / tryHitPlayer 本体
// ============================================================
export function damagePlayer(p, attack, source) {
  // (1) 無敵チェック
  if (!p || !p.mesh) return false;
  if (p.invincible) return false;
  if (p.invincibleFrames > 0) return false;
  if (p.state === STATE.dying || p.state === STATE.dead) return false;

  // (2) 被弾 state 中の lv 比較（同等以上で refresh、下なら無視）
  const incomingLv = attack.atk_lv ?? 1;
  const currentLv  = _hitLv(p.state);
  if (currentLv > 0 && incomingLv < currentLv) return false;

  // (3) ガード判定（前方からのみ）
  const srcFromRight = (source && (source.x - p.x) > 0) ? 1 : -1;
  const facingFromAttacker = -srcFromRight;  // KB は攻撃側の逆方向
  let damage    = attack.damage ?? 0;
  let knockback = attack.knockback ?? 0;
  if (p.guarding) {
    // 前方ガードのみ成立：プレイヤーが攻撃側を向いていればガード成功
    const front = (Math.sign(source.x - p.x) === p.facing);
    if (front || !GUARD_CONFIG.FRONT_ONLY) {
      damage    *= GUARD_CONFIG.DAMAGE_MULT;
      knockback *= GUARD_CONFIG.HIT_KB_MULT;
      p.guardDrainPauseTimer = GUARD_CONFIG.DRAIN_PAUSE_FRAMES;
      p.guardKbVx       = -srcFromRight * GUARD_CONFIG.HIT_KNOCKBACK_VX;
      p.guardFlashTimer = GUARD_CONFIG.FLASH_FRAMES;
      p.guardOpacity    = 1.0;
      // ガードヒット演出（青パーティクル）
      _spawnHitParticles(p.x + p.facing * 60, p.y + 80, p.z, 0x66ccff, 14);
      _triggerHitstop(GUARD_CONFIG.HIT_HITSTOP);
      if (attack.shake) _triggerShake(Math.max(1, attack.shake - 2), 4);
      // (4) ガードクラッシュ判定（SP 枯渇）
      if (p.sp <= GUARD_CONFIG.CRASH_THRESHOLD) {
        p.guarding = false;
        p.guardFadeTimer = GUARD_CONFIG.FADE_OUT_FRAMES;
        _cancelPlayerAction(p);
        p.state = STATE.guard_crash;
        p.stateTimer = GUARD_CONFIG.CRASH_RECOVER_FRAMES;
        _spawnHitParticles(p.x, p.y + 80, p.z, 0xffdd44, 20);
        resetCombo();
        return true;
      }
      // ガード成功：HP も減らないし state も遷移しない（その場で耐える）
      return true;
    }
    // 背面被弾：ガード貫通して通常被弾扱いに
  }

  // (5) HP 減算 & 被弾時 SP 微増
  const finalDamage = Math.max(0, damage);
  p.hp = Math.max(0, p.hp - finalDamage);
  p.sp = Math.min(SP_CONFIG.MAX, p.sp + SP_CONFIG.GAIN_ON_TAKEN);

  // (6) 攻撃中断 & グラブ強制解除 & ガード解除 & コンボリセット
  if (p.state === STATE.grabbing && p.grabTarget) {
    const tgt = p.grabTarget;
    if (tgt && tgt.isAlive) {
      tgt.state         = STATE.wait01;
      tgt.grabbedBy     = null;
      tgt.knockbackVx   = 0;
      tgt.vy            = 0;
      tgt.pitchAngle    = 0;
      tgt.tiltAngle     = 0;
      if (tgt.mesh) {
        tgt.mesh.rotation.x = 0;
        tgt.mesh.rotation.z = 0;
      }
    }
    p.grabTarget       = null;
    p.grabTimer        = 0;
    p.grabHitCount     = 0;
    p.grabPunchActive  = 0;
  }
  _cancelPlayerAction(p);
  if (p.guarding) {
    p.guarding = false;
    p.guardFadeTimer = GUARD_CONFIG.FADE_OUT_FRAMES;
  }
  resetCombo();

  // (6.5) 向き強制：攻撃側を向く＝カメラから見て必ず横向きにする
  p.facing = (source && source.x > p.x) ? 1 : -1;
  if (p.mesh) {
    p.mesh.rotation.y = (p.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
  }

  // (7) HP 0 → dying 直行（黒化 → 黒↔赤点滅 → 爆散 → dead）
  if (p.hp <= 0) {
    const totalF = HP_CONFIG.DEATH_FADE_FRAMES + HP_CONFIG.DEATH_BLINK_FRAMES;
    p.state = STATE.dying;
    p.stateTimer = totalF;
    p.deathPhaseTimer = totalF;
    p.deathBlinkTimer = HP_CONFIG.DEATH_BLINK_START_PERIOD;
    p.deathBlinkOn = false;
    p.kbVx = facingFromAttacker * Math.min(knockback * 0.4, 12);
    p.kbVy = 8;
    _spawnHitParticles(p.x, p.y + 80, p.z, 0xff2222, 24);
    if (attack.hitstop) _triggerHitstop(attack.hitstop);
    if (attack.shake) _triggerShake(attack.shake + 2, attack.shake * 2 + 6);
    return true;
  }

  // (8) lv → state dispatch（lv 1-7 全対応）
  const lv = incomingLv;
  const isPlayerDowned = (
    p.state === STATE.down_bas_start ||
    p.state === STATE.down_bas_loop ||
    p.state === STATE.down_bas_end
  );
  if (lv === 7) {
    if (isPlayerDowned) {
      p.state = STATE.down_bas_loop;
      p.stateTimer = PLAYER_DOWN_BAS_LOOP_FRAMES;
      p.kbVy = 8;
    } else {
      p.state = STATE.knockback01;
      p.stateTimer = PLAYER_KB01_FRAMES;
      p.kbVx = facingFromAttacker * (knockback * 0.3);
      p.kbVy = 0;
    }
  } else if (lv === 6) {
    p.state = STATE.down_front_start;
    p.stateTimer = PLAYER_DOWN_FRONT_START_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 1.2);
    p.kbVy = 16;
  } else if (lv === 5) {
    p.state = STATE.down_front_start;
    p.stateTimer = PLAYER_DOWN_FRONT_START_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.8);
    p.kbVy = 6;
  } else if (lv === 4) {
    p.state = STATE.down_front_start;
    p.stateTimer = PLAYER_DOWN_FRONT_START_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.3);
    p.kbVy = 22;
  } else if (lv === 3) {
    p.state = STATE.down_front_start;
    p.stateTimer = PLAYER_DOWN_FRONT_START_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.5);
    p.kbVy = 14;
  } else if (lv === 2) {
    p.state = STATE.knockback02;
    p.stateTimer = PLAYER_KB02_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.4);
    p.kbVy = 0;
  } else {
    p.state = STATE.knockback01;
    p.stateTimer = PLAYER_KB01_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.3);
    p.kbVy = 0;
  }

  // (9) 演出
  const hitColor = attack.hitColor ?? 0xff4444;
  _spawnHitParticles(p.x, p.y + 80, p.z, hitColor, 14);
  if (attack.hitstop) _triggerHitstop(attack.hitstop);
  if (attack.shake) _triggerShake(attack.shake, attack.shake * 2 + 4);

  // (10) 連続ヒット防止の無敵F
  p.invincibleFrames = HP_CONFIG.INVINCIBLE_FRAMES;
  return true;
}

// 敵 → プレイヤーへの当たり判定（AABB）
export function tryHitPlayer(e, attack) {
  const p = _players[0];
  if (!p) return false;
  if (p.state === STATE.dying || p.state === STATE.dead) return false;
  if (p.invincible || p.invincibleFrames > 0) return false;
  const rangeX = attack.hitboxRangeX ?? 100;
  const rangeY = attack.hitboxRangeY ?? 90;
  const rangeZ = attack.hitboxRangeZ ?? 80;
  const efacing = e.facing ?? (p.x > e.x ? 1 : -1);
  const dx = p.x - e.x;
  if (Math.sign(dx) === -efacing && dx !== 0) return false;
  if (Math.abs(dx) > rangeX) return false;
  if (Math.abs(p.y - e.y) > rangeY) return false;
  if (Math.abs(p.z - e.z) > rangeZ) return false;
  return damagePlayer(p, attack, { x: e.x, y: e.y, z: e.z, facing: efacing });
}

// ============================================================
//  被弾 state の自動進行（updatePlayer 末尾で呼ぶ）
// ============================================================
export function updatePlayerHitstun(p) {
  if (p.invincibleFrames > 0) p.invincibleFrames--;
  const s = p.state;
  if (s === STATE.knockback01 || s === STATE.knockback02) {
    p.x += p.kbVx;
    p.kbVx *= PLAYER_KB_VX_DECAY;
    p.stateTimer--;
    if (p.stateTimer <= 0) {
      p.state = STATE.wait01;
      p.kbVx = 0;
    }
  } else if (s === STATE.down_front_start) {
    p.x += p.kbVx;
    p.kbVx *= 0.98;
    p.vy = p.kbVy;
    p.y += p.vy;
    p.kbVy -= PLAYER_KB_GRAV;
    p.stateTimer--;
    if (p.stateTimer <= 0 && p.y > 0) {
      p.state = STATE.down_front_loop;
    } else if (p.y <= 0) {
      p.y = 0; p.kbVy = 0; p.kbVx = 0; p.vy = 0;
      p.state = STATE.down_bas_start;
      p.stateTimer = PLAYER_DOWN_BAS_START_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 14);
      _triggerShake(3, 6);
    }
  } else if (s === STATE.down_front_loop) {
    p.x += p.kbVx;
    p.kbVx *= 0.96;
    p.vy = p.kbVy;
    p.y += p.vy;
    p.kbVy -= PLAYER_KB_GRAV;
    if (p.y <= 0) {
      p.y = 0; p.kbVy = 0; p.kbVx = 0; p.vy = 0;
      p.state = STATE.down_bas_start;
      p.stateTimer = PLAYER_DOWN_BAS_START_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 14);
      _triggerShake(3, 6);
    }
  } else if (s === STATE.down_bas_start) {
    p.stateTimer--;
    if (p.stateTimer <= 0) {
      p.state = STATE.down_bas_loop;
      p.stateTimer = PLAYER_DOWN_BAS_LOOP_FRAMES;
    }
  } else if (s === STATE.down_bas_loop) {
    p.stateTimer--;
    if (p.stateTimer <= 0) {
      p.state = STATE.down_bas_end;
      p.stateTimer = PLAYER_DOWN_BAS_END_FRAMES;
    }
  } else if (s === STATE.down_bas_end) {
    p.stateTimer--;
    if (p.stateTimer <= 0) {
      p.state = STATE.wait01;
    }
  } else if (s === STATE.guard_crash) {
    p.stateTimer--;
    if (p.stateTimer <= 0) {
      p.state = STATE.wait01;
    }
  } else if (s === STATE.dying) {
    // 死亡演出：黒化フェーズ A → 黒↔赤点滅フェーズ B → 爆散 → dead
    const fadeF  = HP_CONFIG.DEATH_FADE_FRAMES;
    const blinkF = HP_CONFIG.DEATH_BLINK_FRAMES;
    const totalF = fadeF + blinkF;
    const elapsed = totalF - p.deathPhaseTimer;
    p.x += p.kbVx;
    p.kbVx *= 0.94;
    p.vy = p.kbVy;
    p.y += p.vy;
    p.kbVy -= PLAYER_KB_GRAV;
    if (p.y <= 0) { p.y = 0; p.kbVy = 0; p.vy = 0; }
    if (elapsed < fadeF) {
      const mix = elapsed / fadeF;
      if (p.mesh) tintBody(p.mesh, 0, 0, 0, mix);
    } else {
      const phaseT = Math.min(1, (elapsed - fadeF) / blinkF);
      const startP = HP_CONFIG.DEATH_BLINK_START_PERIOD;
      const endP   = HP_CONFIG.DEATH_BLINK_END_PERIOD;
      const curPeriod = Math.max(1, Math.round(startP + (endP - startP) * phaseT));
      p.deathBlinkTimer--;
      if (p.deathBlinkTimer <= 0) {
        p.deathBlinkOn = !p.deathBlinkOn;
        p.deathBlinkTimer = curPeriod;
      }
      if (p.mesh) {
        if (p.deathBlinkOn) tintBody(p.mesh, 1.0, 0.15, 0.15, 1);
        else                 tintBody(p.mesh, 0, 0, 0, 1);
      }
    }
    p.deathPhaseTimer--;
    if (p.deathPhaseTimer <= 0) {
      _spawnHitParticles(p.x, p.y + 80, p.z, 0xff4422, 36, { type: 'omni' });
      _spawnHitParticles(p.x, p.y + 80, p.z, 0xffaa44, 24, { type: 'omni' });
      _triggerHitstop(10);
      _triggerShake(12, 20);
      if (p.mesh) p.mesh.visible = false;
      p.state = STATE.dead;
      p.deadTimer = HP_CONFIG.DEAD_FRAMES;
    }
  } else if (s === STATE.dead) {
    p.deadTimer--;
    if (p.deadTimer <= 0) {
      revivePlayer(p);
    }
  } else if (s === STATE.respawning) {
    p.respawnFallTimer--;
    const fallTotal = HP_CONFIG.RESPAWN_FALL_FRAMES;
    const t = 1 - (p.respawnFallTimer / fallTotal);
    p.y = HP_CONFIG.RESPAWN_FALL_HEIGHT * (1 - t);
    if (p.respawnFallTimer <= 0 || p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.state = STATE.wait01;
      _spawnHitParticles(p.x, 10, p.z, 0xaaccff, 24, { type: 'omni' });
      _triggerShake(5, 10);
    }
  }
  // mesh 反映
  if (p.mesh) {
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.rotation.z = 0;
    if (s === STATE.knockback01 || s === STATE.knockback02) {
      p.mesh.rotation.x = -0.3 * Math.min(1, p.stateTimer / 12);
    } else if (s === STATE.down_front_start || s === STATE.down_front_loop) {
      p.mesh.rotation.x = -0.6;
    } else if (s === STATE.down_bas_start || s === STATE.down_bas_loop || s === STATE.down_bas_end) {
      p.mesh.rotation.x = 0;
    } else if (s === STATE.guard_crash) {
      p.mesh.rotation.x = 0.4;
    } else {
      p.mesh.rotation.x = 0;
    }
  }
  // 無敵中の透明点滅（dying/dead/respawning は別演出が visibility を制御するので除外）
  updateInvincibleBlink(p);
}

// ============================================================
//  無敵中の透明点滅（リスポーン後・カウンター被弾防止無敵）
// ============================================================
export function updateInvincibleBlink(p) {
  if (!p || !p.mesh) return;
  if (p.state === STATE.dying || p.state === STATE.dead) return;
  if (p.state === STATE.respawning) { p.mesh.visible = true; return; }
  if (p.invincibleFrames > 0) {
    p.respawnBlinkTimer--;
    if (p.respawnBlinkTimer <= 0) {
      p.mesh.visible = !p.mesh.visible;
      p.respawnBlinkTimer = HP_CONFIG.RESPAWN_BLINK_PERIOD;
    }
  } else if (!p.mesh.visible) {
    p.mesh.visible = true;
  }
}

// ============================================================
//  危機状態の更新と火花スポーン（HP CRISIS_THRESHOLD 以下で発動）
// ============================================================
const CRISIS_BODY_RANGE_X = 50;
const CRISIS_BODY_Y_MIN   = 20;
const CRISIS_BODY_Y_MAX   = 170;
const CRISIS_BODY_RANGE_Z = 25;
const CRISIS_SPARK_COLORS = [0xff4422, 0xffaa44, 0xffee44];

export function updateCrisisEffect(p) {
  if (!p || !p.mesh) return;
  p.inCrisis = (p.hp > 0) && (p.hp / p.maxHp <= HP_CONFIG.CRISIS_THRESHOLD);
  if (!p.inCrisis) {
    p.crisisSparkTimer = 0;
    p.crisisDashSparkTimer = 0;
    return;
  }
  if (p.crisisSparkTimer <= 0) {
    const ox = (Math.random() - 0.5) * (CRISIS_BODY_RANGE_X * 2);
    const oy = CRISIS_BODY_Y_MIN + Math.random() * (CRISIS_BODY_Y_MAX - CRISIS_BODY_Y_MIN);
    const oz = (Math.random() - 0.5) * (CRISIS_BODY_RANGE_Z * 2);
    const col = CRISIS_SPARK_COLORS[Math.floor(Math.random() * CRISIS_SPARK_COLORS.length)];
    _spawnHitParticles(p.x + ox, p.y + oy, p.z + oz, col, 4, { type: 'omni' });
    const range = HP_CONFIG.CRISIS_SPARK_MAX - HP_CONFIG.CRISIS_SPARK_MIN;
    p.crisisSparkTimer = HP_CONFIG.CRISIS_SPARK_MIN + Math.floor(Math.random() * range);
  } else {
    p.crisisSparkTimer--;
  }
  if (p.dashActive && p.isGrounded) {
    if (p.crisisDashSparkTimer <= 0) {
      _spawnHitParticles(p.x, p.y + 10, p.z, 0xff6622, 6, { type: 'omni' });
      p.crisisDashSparkTimer = HP_CONFIG.CRISIS_DASH_SPARK;
    } else {
      p.crisisDashSparkTimer--;
    }
  }
}

// ============================================================
//  リバーサル用 hitstun 強制解除 & リスポーン
// ============================================================
export function _cancelHitstunForReversal(p) {
  p.state           = STATE.wait01;
  p.stateTimer      = 0;
  p.kbVx            = 0;
  p.kbVy            = 0;
  p.invincibleFrames = 0;
}

export function revivePlayer(p) {
  p.hp = p.maxHp;
  p.state = STATE.respawning;
  p.stateTimer = 0;
  p.kbVx = 0; p.kbVy = 0; p.vy = 0;
  p.deadTimer = 0;
  p.deathPhaseTimer = 0;
  p.deathBlinkTimer = 0;
  p.deathBlinkOn = false;
  p.respawnFallTimer = HP_CONFIG.RESPAWN_FALL_FRAMES;
  p.respawnBlinkTimer = 0;
  p.y = HP_CONFIG.RESPAWN_FALL_HEIGHT;
  p.invincibleFrames = HP_CONFIG.REVIVE_INVINCIBLE;
  if (p.mesh) {
    p.mesh.visible = true;
    p.mesh.rotation.set(0, p.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 0);
    restoreBodyColor(p.mesh);
  }
  _spawnHitParticles(p.x, HP_CONFIG.RESPAWN_FALL_HEIGHT, p.z, 0x66ffaa, 24, { type: 'omni' });
}
