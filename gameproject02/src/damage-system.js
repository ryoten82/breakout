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
  PLAYER_DOWN_UP_FRAMES,
  PLAYER_DOWN_RAKKA_FRAMES, PLAYER_DOWN_BOUND_FRAMES,
  PLAYER_DOWN_SUPER_FRAMES, PLAYER_WALL_START_FRAMES,
  PLAYER_ROLL_START_FRAMES, PLAYER_ROLL_LOOP_FRAMES,
  PLAYER_KB_AIR_FRAMES, PLAYER_LAND_FRAMES, PLAYER_AIRBORNE_Y_THRESHOLD,
  DEFAULT_LAUNCH_VY,
  KB_LV05_VY, KB_LV05_VX_MULT, KB_LV05_BOUNCE_VY,
  KB_LV06_VY, KB_LV06_VX_MULT,
  ENEMY_WALL_BOUNCE_VY, ENEMY_WALL_BOUNCE_KB_VX, ENEMY_WALL_BOUNCE_KB_DECAY,
  ENEMY_ROLL_KB_VX, ENEMY_ROLL_KB_DECAY,
  applyRollHipPivot,
} from './states.js';
import { SP_CONFIG, GUARD_CONFIG, PHYSICS } from './config.js';
import { getActiveWallX } from './camera.js';

// ============================================================
//  依存注入（initDamageSystem で外部関数とグローバル参照をバインド）
// ============================================================
let _spawnHitParticles = null;
let _triggerHitstop    = null;
let _triggerShake      = null;
let _spawnDeathExplosion = null;  // 敵味方共用の死亡爆発（Phase 3-B）
let _combo             = null;  // { count, lastHitEnemy } のオブジェクト参照
let _comboEl           = null;  // DOM 要素
let _players           = null;  // 配列参照
let _resetCameraToPlayer = null;  // リスポーン時にカメラ追従値を即スナップする関数

export function initDamageSystem(deps) {
  _spawnHitParticles = deps.spawnHitParticles;
  _triggerHitstop    = deps.triggerHitstop;
  _triggerShake      = deps.triggerShake;
  _spawnDeathExplosion = deps.spawnDeathExplosion;
  _combo             = deps.combo;
  _comboEl           = deps.comboEl;
  _players           = deps.players;
  _resetCameraToPlayer = deps.resetCameraToPlayer || null;
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
  STATE.knockback_air01, STATE.fall_loop, STATE.land,
  STATE.down_front_start, STATE.down_front_loop,
  STATE.down_up_start, STATE.down_up_loop,
  STATE.down_rakka_start, STATE.down_rakka_loop, STATE.down_bound_start,
  STATE.down_super_start, STATE.down_super_loop, STATE.down_wall_start,
  STATE.down_roll_start, STATE.down_roll_loop,
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
  p.chargeLevel        = 0;
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
    if (pp.usedDerivativesThisCombo) pp.usedDerivativesThisCombo.clear();
    if (pp.attackHitCounts) pp.attackHitCounts.clear();  // 同技補正カウンタもリセット（2026-05-18）
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

  // (2) 被弾中は完全無敵（プレイヤー区別化）：吹き飛び中・ダウン中は一切ヒットを受けず
  //   コンボでハメられない。guard_crash はガード崩れの隙なので無敵にしない（反撃を受ける）。
  if (isHitstunState(p) && p.state !== STATE.guard_crash) return false;
  const incomingLv = attack.atk_lv ?? 1;

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
  // 倒れ向き：全 lv 共通で攻撃者と反対側に頭を倒す。
  //   down_up の横倒しランプ・ダウン姿勢 down_bas_* の横倒し方向（敵と統一）に使う。
  p.fallDir = facingFromAttacker;
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
    // lv6 超吹き飛ばし：敵側 down_super_* を移植（被弾 state 共用 第4段）。
    //   高速で吹き飛び → 壁ヒットで張り付き＋反作用バウンス、地面ヒットで転がり → down_bas。
    //   水平初速は敵 dispatch と同式（knockback × 0.4 × KB_LV06_VX_MULT）。
    p.state = STATE.down_super_start;
    p.stateTimer = PLAYER_DOWN_SUPER_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.4 * KB_LV06_VX_MULT);
    p.kbVy = KB_LV06_VY;
    p.wallHitCount = 0;   // 壁張り付きは 1 回まで（壁ピンポンの被弾ループ防止）
  } else if (lv === 5) {
    // lv5 叩きつけ：敵側 down_rakka_* を移植（第 3 段共用）。
    //   真下に高速落下（あおむけ姿勢）→ 着地で 1回バウンド → 再着地で down_bas へ。
    //   水平 KB はほぼ殺す（KB_LV05_VX_MULT）。地上ヒット時は即着地→バウンド。地雷被弾にも転用可。
    p.state = STATE.down_rakka_start;
    p.stateTimer = PLAYER_DOWN_RAKKA_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * KB_LV05_VX_MULT);
    p.kbVy = KB_LV05_VY;   // 下向き初速（真下に高速）
  } else if (lv === 4) {
    // lv4 打ち上げ：敵側 down_up_* を移植（第 1 段共用試作）。
    //   - tilt は 0→π/2 のランプ（updatePlayerHitstun で計算）
    //   - 着地で down_bas_start に合流
    //   - 打ち上げ高度は attack.launchVy 優先（敵側 hit-engine.js と同じ規約）。
    //     ボンベ爆発のように低く打ち上げたい場合は attack 側で launchVy 指定。
    p.state = STATE.down_up_start;
    p.stateTimer = PLAYER_DOWN_UP_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.3);
    p.kbVy = (attack.launchVy !== undefined) ? attack.launchVy : DEFAULT_LAUNCH_VY;
    p.launcherAirborne = !!attack.peakHang;
  } else if (lv === 3) {
    p.state = STATE.down_front_start;
    p.stateTimer = PLAYER_DOWN_FRONT_START_FRAMES;
    p.kbVx = facingFromAttacker * (knockback * 0.5);
    p.kbVy = 14;
  } else if (lv === 2) {
    if (p.y > PLAYER_AIRBORNE_Y_THRESHOLD) {
      // 空中 lv2 → knockback_air01（フリンチ → fall_loop → land）
      p.state = STATE.knockback_air01;
      p.stateTimer = PLAYER_KB_AIR_FRAMES;
      p.kbVx = facingFromAttacker * (knockback * 0.4);
      p.kbVy = 4;   // 軽く浮かせる
    } else {
      p.state = STATE.knockback02;
      p.stateTimer = PLAYER_KB02_FRAMES;
      p.kbVx = facingFromAttacker * (knockback * 0.4);
      p.kbVy = 0;
    }
  } else {
    if (p.y > PLAYER_AIRBORNE_Y_THRESHOLD) {
      // 空中 lv1 → knockback_air01
      p.state = STATE.knockback_air01;
      p.stateTimer = PLAYER_KB_AIR_FRAMES;
      p.kbVx = facingFromAttacker * (knockback * 0.3);
      p.kbVy = 2;
    } else {
      p.state = STATE.knockback01;
      p.stateTimer = PLAYER_KB01_FRAMES;
      p.kbVx = facingFromAttacker * (knockback * 0.3);
      p.kbVy = 0;
    }
  }

  // (9) 演出
  const hitColor = attack.hitColor ?? 0xff4444;
  _spawnHitParticles(p.x, p.y + 80, p.z, hitColor, 14);
  if (attack.hitstop) _triggerHitstop(attack.hitstop);
  if (attack.shake) _triggerShake(attack.shake, attack.shake * 2 + 4);

  // 連続ヒット防止の無敵F は撤去：被弾中は (2) の被弾 state ガードで完全無敵のため不要。
  // invincibleFrames は「起き上がり後の点滅グレース」専用に。吹き飛び中は点滅しない。
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

// 被弾中の毎フレーム物理ステップ：水平慣性（kbVx・指定減衰）+ 重力落下を進める。
// updatePlayerHitstun の各被弾ブランチ共通のプリアンブル。
function _applyKbStep(p, decay, gravMult = 1) {
  p.x += p.kbVx;
  p.kbVx *= decay;
  p.vy = p.kbVy;
  p.y += p.vy;
  p.kbVy -= PLAYER_KB_GRAV * gravMult;
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
      p.invincibleFrames = HP_CONFIG.HITSTUN_RECOVER_INVINCIBLE;  // 復帰後 3 秒の点滅無敵
    }
  } else if (s === STATE.knockback_air01) {
    // 空中フリンチ：軽く流されつつ落下、タイマー終了で fall_loop
    _applyKbStep(p, PLAYER_KB_VX_DECAY);
    p.stateTimer--;
    if (p.y <= 0) {
      p.y = 0; p.kbVy = 0; p.kbVx = 0; p.vy = 0;
      p.state = STATE.land;
      p.stateTimer = PLAYER_LAND_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 10);
    } else if (p.stateTimer <= 0) {
      p.state = STATE.fall_loop;
    }
  } else if (s === STATE.fall_loop) {
    // 自由落下：着地で land へ
    _applyKbStep(p, PLAYER_KB_VX_DECAY);
    if (p.y <= 0) {
      p.y = 0; p.kbVy = 0; p.kbVx = 0; p.vy = 0;
      p.state = STATE.land;
      p.stateTimer = PLAYER_LAND_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 10);
    }
  } else if (s === STATE.land) {
    // 着地モーション：タイマー終了で wait01
    p.stateTimer--;
    if (p.stateTimer <= 0) {
      p.state = STATE.wait01;
      p.invincibleFrames = HP_CONFIG.HITSTUN_RECOVER_INVINCIBLE;  // 復帰後 3 秒の点滅無敵
    }
  } else if (s === STATE.down_front_start) {
    _applyKbStep(p, 0.98);
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
    _applyKbStep(p, 0.96);
    if (p.y <= 0) {
      p.y = 0; p.kbVy = 0; p.kbVx = 0; p.vy = 0;
      p.state = STATE.down_bas_start;
      p.stateTimer = PLAYER_DOWN_BAS_START_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 14);
      _triggerShake(3, 6);
    }
  } else if (s === STATE.down_up_start || s === STATE.down_up_loop) {
    // lv4 打ち上げ：横倒し落下（敵 down_up_* 共用試作）。launcherAirborne で滞空延長。
    _applyKbStep(p, 0.98, p.launcherAirborne ? 0.6 : 1);
    if (s === STATE.down_up_start) {
      p.stateTimer--;
      if (p.stateTimer <= 0) p.state = STATE.down_up_loop;
    }
    if (p.y <= 0) {
      p.y = 0; p.kbVy = 0; p.kbVx = 0; p.vy = 0;
      p.launcherAirborne = false;
      p.state = STATE.down_bas_start;
      p.stateTimer = PLAYER_DOWN_BAS_START_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 14);
      _triggerShake(3, 6);
    }
  } else if (s === STATE.down_rakka_start || s === STATE.down_rakka_loop) {
    // lv5 叩きつけ：真下に高速落下（敵 down_rakka_* 共用）。あおむけ姿勢のまま落下し、
    //   着地で 1回バウンド（down_bound_start）へ。地上ヒット時は即着地 → バウンド。
    _applyKbStep(p, 0.98);
    if (s === STATE.down_rakka_start) {
      p.stateTimer--;
      if (p.stateTimer <= 0) p.state = STATE.down_rakka_loop;
    }
    if (p.y <= 0) {
      p.y = 0; p.kbVx = 0; p.vy = 0;
      p.state = STATE.down_bound_start;
      p.kbVy = KB_LV05_BOUNCE_VY;   // 上向き初速で 1回バウンド（下向き vy を上書き）
      p.stateTimer = PLAYER_DOWN_BOUND_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 16);
      _triggerShake(4, 8);
    }
  } else if (s === STATE.down_bound_start) {
    // バウンド上昇 → 落下。再着地で down_bas_loop へ（仕様 §4.1：bas_start イントロはスキップ。
    //   バウンド自体が「落ちて崩れる」演出を担うため）。敵 down_bound_start と同じ合流先。
    _applyKbStep(p, 0.96);
    p.stateTimer--;
    if (p.y <= 0) {
      p.y = 0; p.kbVy = 0; p.kbVx = 0; p.vy = 0;
      p.state = STATE.down_bas_loop;
      p.stateTimer = PLAYER_DOWN_BAS_LOOP_FRAMES;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 14);
      _triggerShake(3, 6);
    } else if (p.stateTimer <= 0) {
      // フォールバック：着地検知漏れ（万一）→ ダウン静止ループへ
      p.state = STATE.down_bas_loop;
      p.stateTimer = PLAYER_DOWN_BAS_LOOP_FRAMES;
    }
  } else if (s === STATE.down_super_start || s === STATE.down_super_loop) {
    // lv6 超吹き飛ばし：高速で吹き飛ぶ（敵 down_super_* 共用）。
    //   壁ヒット → down_wall_start（張り付き）／ 地面ヒット → down_roll_start（転がり）。
    _applyKbStep(p, 0.96);
    if (s === STATE.down_super_start) {
      p.stateTimer--;
      if (p.stateTimer <= 0) p.state = STATE.down_super_loop;
    }
    // 壁ヒット判定（getActiveWallX：画面端追従 or levelWalls）。strict 比較で
    //   バウンス直後（x == 壁）の即再ヒットを防ぐ。
    const wallL = Math.max(PHYSICS.STAGE_LEFT, getActiveWallX('left'));
    const wallR = Math.min(PHYSICS.STAGE_RIGHT, getActiveWallX('right'));
    if (p.y <= 0) {
      // 地面ヒット → 転がり開始
      p.y = 0; p.vy = 0; p.kbVy = 0;
      const rollDir = Math.sign(p.kbVx) || p.fallDir || 1;
      p.state = STATE.down_roll_start;
      p.stateTimer = PLAYER_ROLL_START_FRAMES;
      p.kbVx = rollDir * ENEMY_ROLL_KB_VX;
      p.rollAngle = 0;
      _spawnHitParticles(p.x, 10, p.z, 0xaaaaaa, 18);
      _triggerShake(4, 8);
    } else if (p.x < wallL || p.x > wallR) {
      // 壁ヒット
      p.x = (p.x < wallL) ? wallL : wallR;
      if ((p.wallHitCount ?? 0) < 1) {
        // 1 回目：張り付き（重力スキップ・静止）→ タイマー満了で反作用バウンス
        p.wallHitCount = (p.wallHitCount ?? 0) + 1;
        p.state = STATE.down_wall_start;
        p.stateTimer = PLAYER_WALL_START_FRAMES;
        p.kbVx = 0; p.kbVy = 0; p.vy = 0;
        _spawnHitParticles(p.x, p.y + 40, p.z, 0xaaaaaa, 14);
        _triggerShake(4, 8);
      } else {
        // 2 回目以降：張り付かず kbVx を殺し、壁づたいに落下 → 地面で転がりへ。
        //   壁ピンポン（壁→バウンス→反対の壁→…）の被弾ループを断つ。
        p.kbVx = 0;
        _spawnHitParticles(p.x, p.y + 40, p.z, 0xaaaaaa, 8);
      }
    }
  } else if (s === STATE.down_wall_start) {
    // 壁張り付き（重力スキップ・静止）。タイマー満了で反作用バウンス → down_super_loop へ。
    p.stateTimer--;
    if (p.stateTimer <= 0) {
      p.kbVy = ENEMY_WALL_BOUNCE_VY;
      p.kbVx = -(p.fallDir ?? 1) * ENEMY_WALL_BOUNCE_KB_VX;
      p.state = STATE.down_super_loop;
      _spawnHitParticles(p.x, p.y + 40, p.z, 0xffffff, 10);
      _triggerShake(3, 6);
    }
  } else if (s === STATE.down_roll_start || s === STATE.down_roll_loop) {
    // lv6 着地後の転がり（敵 down_roll_* 共用）。X 軸で後方ごろごろ回転。
    p.x += p.kbVx;
    p.kbVx *= ENEMY_ROLL_KB_DECAY;
    p.y = 0; p.vy = 0;
    p.rollAngle = (p.rollAngle ?? 0) - 0.35;   // ≒ 20°/F
    p.stateTimer--;
    if (s === STATE.down_roll_start) {
      if (p.stateTimer <= 0) {
        p.state = STATE.down_roll_loop;
        p.stateTimer = PLAYER_ROLL_LOOP_FRAMES;
      }
    } else if (p.stateTimer <= 0) {
      p.state = STATE.down_bas_loop;
      p.stateTimer = PLAYER_DOWN_BAS_LOOP_FRAMES;
      p.rollAngle = 0;
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
      // 起き上がり開始から 3 秒の点滅無敵（起き上がり〜復帰後をカバー）
      p.invincibleFrames = HP_CONFIG.HITSTUN_RECOVER_INVINCIBLE;
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
    _applyKbStep(p, 0.94);
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
      // Phase 3-B：プレイヤー死亡爆発 → 敵共用 spawnDeathExplosion（多層パーティクル+shake+hitstop）
      if (_spawnDeathExplosion) {
        _spawnDeathExplosion(p.x, p.y + 80, p.z);
      } else {
        _spawnHitParticles(p.x, p.y + 80, p.z, 0xff4422, 36, { type: 'omni' });
        _spawnHitParticles(p.x, p.y + 80, p.z, 0xffaa44, 24, { type: 'omni' });
        _triggerHitstop(10);
        _triggerShake(12, 20);
      }
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
    // rotation.z は down_up_* のときだけ tilt を反映、それ以外は 0
    if (s === STATE.down_up_start) {
      const tilt = (1 - p.stateTimer / PLAYER_DOWN_UP_FRAMES) * (Math.PI / 2);
      p.mesh.rotation.z = -(p.fallDir ?? 1) * tilt;
    } else if (s === STATE.down_up_loop ||
               s === STATE.down_bas_start || s === STATE.down_bas_loop) {
      // 横倒し姿勢（敵 STATE_TILT_TARGET の down_bas_* = π/2 と統一）
      p.mesh.rotation.z = -(p.fallDir ?? 1) * (Math.PI / 2);
    } else if (s === STATE.down_bas_end) {
      // 起き上がり：π/2 → 0 へランプ（敵 down_bas_end と同じ）
      const tilt = (p.stateTimer / PLAYER_DOWN_BAS_END_FRAMES) * (Math.PI / 2);
      p.mesh.rotation.z = -(p.fallDir ?? 1) * tilt;
    } else {
      p.mesh.rotation.z = 0;
    }
    if (s === STATE.knockback01 || s === STATE.knockback02) {
      p.mesh.rotation.x = -0.3 * Math.min(1, p.stateTimer / 12);
    } else if (s === STATE.knockback_air01) {
      p.mesh.rotation.x = -0.2;   // 軽く後傾
    } else if (s === STATE.fall_loop) {
      p.mesh.rotation.x = -0.1;   // 落下中はほぼ立て直し
    } else if (s === STATE.land) {
      p.mesh.rotation.x = 0.15;   // 着地で軽く前屈
    } else if (s === STATE.down_front_start || s === STATE.down_front_loop) {
      p.mesh.rotation.x = -0.6;
    } else if (s === STATE.down_up_start || s === STATE.down_up_loop) {
      p.mesh.rotation.x = 0;  // tilt（rotation.z）が姿勢を支配するので x はクリア
    } else if (s === STATE.down_rakka_start || s === STATE.down_rakka_loop || s === STATE.down_bound_start) {
      p.mesh.rotation.x = -Math.PI / 2;  // あおむけ姿勢（lv5 叩きつけ・敵 down_rakka_* と同じ）
    } else if (s === STATE.down_roll_start || s === STATE.down_roll_loop) {
      p.mesh.rotation.x = p.rollAngle ?? 0;  // lv6 転がり：X 軸ごろごろ回転（敵 down_roll_* と同じ）
    } else if (s === STATE.down_bas_start || s === STATE.down_bas_loop || s === STATE.down_bas_end) {
      p.mesh.rotation.x = 0;
    } else if (s === STATE.guard_crash) {
      p.mesh.rotation.x = 0.4;
    } else {
      p.mesh.rotation.x = 0;  // down_super_* / down_wall_start 等は直立で飛ぶ
    }
    // 転がり中は腰ピボット補正（敵・プレイヤー共用ヘルパ）。それ以外は素の座標。
    if (s === STATE.down_roll_start || s === STATE.down_roll_loop) {
      applyRollHipPivot(p.mesh, p.x, p.y, p.z, p.rollAngle ?? 0);
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
  p.state            = STATE.wait01;
  p.stateTimer       = 0;
  p.kbVx             = 0;
  p.kbVy             = 0;
  p.invincibleFrames = 0;
  p.launcherAirborne = false;
  p.peakHangTimer    = 0;
  // 2026-05-19 三度目の修正：fall_loop はプレイヤー側専用処理がなく着地遷移しない（攻撃不能化）。
  //   プレイヤー通常更新は state ではなく isGrounded で重力・着地を扱うため、
  //   state は wait01 のままにし、空中なら isGrounded=false で自然落下に委ねる。
  //   これで「空中歩き」（前回バグ）も「地面ワープ」（前々回バグ）も「着地後攻撃不能」も同時に防げる。
  //   空中判定はコードベース共通の PLAYER_AIRBORNE_Y_THRESHOLD で統一（着地ノイズ域は接地扱い）。
  if (p.y > PLAYER_AIRBORNE_Y_THRESHOLD) {
    p.vy          = 0;
    p.isGrounded  = false;
  } else {
    p.y           = 0;
    p.vy          = 0;
    p.isGrounded  = true;
  }
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
  // カメラ追従値をプレイヤーの新位置に即スナップ（追従ラグでデッドゾーンがズレるバグ修正）
  if (_resetCameraToPlayer) _resetCameraToPlayer(p);
  if (p.mesh) {
    p.mesh.visible = true;
    p.mesh.rotation.set(0, p.facing > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, 0);
    restoreBodyColor(p.mesh);
  }
  _spawnHitParticles(p.x, HP_CONFIG.RESPAWN_FALL_HEIGHT, p.z, 0x66ffaa, 24, { type: 'omni' });
}
