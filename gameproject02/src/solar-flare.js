// SOLAR FLARE — OC BRN-l04（SP4 stage2 解放 + 遅延ドーム炎フィールド）
//
// 仕様（2026-05-29 再設計）：
//   SP4 stage2 命中時に「敵を超 KB → 1.5 秒後に敵の到達位置に巨大ドーム + 炎フィールド」を予約。
//   - hit 時は敵参照を pending キューに登録（即発動しない）
//   - 90F 後に発動：敵が生存していれば敵の現在地、死亡してたら登録時座標に spawn
//   - ドーム視覚（半球メッシュ）+ 地面に炎フィールド（ground footprint）
//   - 炎は一定時間残留し、範囲内敵に毎秒 1 スタック延焼
//
// API:
//   initSolarFlare({ enemies, damageArea, igniteEnemy, STATE, getGameFrame })
//   attachSolarFlareScene({ scene, THREE })
//   schedulePendingFlare(target, x, z)     attack-engine から hit 時に呼ぶ
//   updateSolarFlares()                     毎フレーム：pending 解決 + active 更新
//   clearAllSolarFlares()

import {
  ENEMY_AIRBORNE_Y_THRESHOLD,
  ENEMY_KB02_FRAMES, ENEMY_KB_AIR_FRAMES, ENEMY_KB03_FRAMES,
  ENEMY_FALL_FRAMES,
  KB_LV07_HOP_VY,
} from './states.js';
import { MIDBOSS_SHIELD_CONFIG } from './config.js';
import { createDelayedQueue } from './delayed-queue.js';

const FLARE_DELAY_FRAMES   = 90;    // 1.5 秒（60fps）
const FLARE_RADIUS         = 350;   // 巨大ドーム
const FLARE_LIFE_BASE      = 300;   // 5 秒
const FLARE_TICK_INTERVAL  = 60;    // 1 秒に 1 回延焼
const FLARE_BURN_DURATION  = 150;
const FLARE_DAMAGE_PER_TICK = 2;
const FLARE_COLOR_RING     = 0xff4400;
const FLARE_COLOR_FILL_OUT = 0xff6611;
const FLARE_COLOR_FILL_IN  = 0xffaa33;
const FLARE_COLOR_DOME     = 0xff5522;
const FLARE_OPACITY        = 0.55;
const FLARE_DOME_OPACITY   = 0.30;
const FLARE_DOME_LIFE      = 60;    // ドーム視覚は 1 秒で消える（炎フィールドは別途残る）
const FLARE_BLINK_PERIOD   = 18;

const _pending = createDelayedQueue();   // 遅延ドーム発火（FLARE_DELAY_FRAMES 後に敵の現在位置で spawn）
const _flares = [];

let _enemies = null;
let _damageArea = null;
let _igniteEnemy = null;
let _STATE = null;
let _getGameFrame = null;
let _scene = null;
let _THREE = null;

export function initSolarFlare({ enemies, damageArea, igniteEnemy, STATE, getGameFrame }) {
  _enemies = enemies || null;
  _damageArea = damageArea || null;
  _igniteEnemy = igniteEnemy || null;
  _STATE = STATE || null;
  _getGameFrame = getGameFrame || null;
}

export function attachSolarFlareScene({ scene, THREE }) {
  _scene = scene;
  _THREE = THREE;
}

function _flog(label, extra) {
  if (typeof window !== 'undefined' && window.SB?.DEBUG_SOLAR_FLARE) {
    const f = _getGameFrame?.() ?? '-';
    console.log(`[SOLAR ${label}] f=${f}`, extra ?? '');
  }
}

function _makeFillDisk(radius, color, opacity) {
  if (!_scene || !_THREE) return null;
  const geom = new _THREE.CircleGeometry(radius, 64);
  const mat = new _THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: _THREE.DoubleSide, depthWrite: false,
  });
  const m = new _THREE.Mesh(geom, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.4;
  _scene.add(m);
  return m;
}

function _makeDomeMesh(radius, color, opacity) {
  if (!_scene || !_THREE) return null;
  // 半球：phi 0→π/2、theta 0→2π（上半分）
  const geom = new _THREE.SphereGeometry(radius, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new _THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: _THREE.DoubleSide, depthWrite: false,
  });
  const m = new _THREE.Mesh(geom, mat);
  _scene.add(m);
  return m;
}

function _disposeMesh(mesh) {
  if (!mesh) return;
  _scene?.remove(mesh);
  mesh.geometry?.dispose?.();
  mesh.material?.dispose?.();
}

function _isTargetable(e) {
  if (!e || !e.isAlive || e.dying || e.dyingInvincible) return false;
  if (_STATE) {
    if (e.state === _STATE.down_burst_start || e.state === _STATE.down_burst_loop) return false;
  }
  return true;
}

// === API：attack-engine の hit 時に呼ぶ。1.5 秒後に解決される予約。===
export function schedulePendingFlare(target, x, z) {
  // FLARE_DELAY_FRAMES 後に解決：敵が生存していれば現在位置、死亡時は登録時座標で spawn。
  _pending.schedule(() => {
    let sx = x, sz = z;
    if (target && target.isAlive && !target.dying) { sx = target.x; sz = target.z; }
    _spawnFlareAt(sx, sz);
    _flog('RESOLVE', { sx: sx.toFixed(0), sz: sz.toFixed(0), targetAlive: !!(target && target.isAlive) });
  }, FLARE_DELAY_FRAMES);
  _flog('SCHEDULE', { triggerIn: FLARE_DELAY_FRAMES, totalPending: _pending.size, targetAlive: !!(target && target.isAlive) });
}

function _spawnFlareAt(x, z) {
  if (!_damageArea?.addStaticArea) return null;
  const radius = FLARE_RADIUS;
  const life = FLARE_LIFE_BASE;
  // 外側リング
  const areaId = _damageArea.addStaticArea({
    x, y: 0, z,
    radius,
    color: FLARE_COLOR_RING,
    opacity: FLARE_OPACITY,
    blink: true,
    blinkPeriodFn: () => FLARE_BLINK_PERIOD,
  });
  // 内側塗り 2 層
  const fillOuter = _makeFillDisk(radius * 0.95, FLARE_COLOR_FILL_OUT, 0.28);
  const fillInner = _makeFillDisk(radius * 0.55, FLARE_COLOR_FILL_IN,  0.42);
  if (fillOuter) fillOuter.position.set(x, fillOuter.position.y, z);
  if (fillInner) fillInner.position.set(x, fillInner.position.y, z);
  // ドーム視覚（半球・短寿命）
  const dome = _makeDomeMesh(radius * 0.85, FLARE_COLOR_DOME, FLARE_DOME_OPACITY);
  if (dome) dome.position.set(x, 0, z);
  // spawn pulse
  _damageArea.spawnExpandPulse?.({
    x, y: 0, z,
    radius: radius * 1.3,
    color: FLARE_COLOR_FILL_OUT,
    opacity: 0.85,
    life: 22,
    thickness: 18,
  });
  const flare = {
    id: areaId, x, z, radius,
    life, lifeMax: life,
    tickAcc: 0,
    fillOuter, fillInner,
    dome, domeLife: FLARE_DOME_LIFE, domeLifeMax: FLARE_DOME_LIFE,
  };
  _flares.push(flare);
  _flog('SPAWN', { x: x.toFixed(0), z: z.toFixed(0), life, total: _flares.length });
  // spawn 瞬間の初回ヒット（ドーム爆発 atk_lv 2/2/7 リアクション + DoT 強化）
  if (_enemies) {
    const r2 = radius * radius;
    let n = 0;
    for (const e of _enemies) {
      if (!_isTargetable(e)) continue;
      const dx = e.x - x, dz = e.z - z;
      if (dx * dx + dz * dz <= r2) { _applyDomeBlastReactionToEnemy(flare, e); n++; }
    }
    _flog('SPAWN dome blast', { hitCount: n });
  }
  return areaId;
}

function _applyTickToEnemy(v, e) {
  if (!_isTargetable(e)) return;
  e.hp -= FLARE_DAMAGE_PER_TICK;
  if (_igniteEnemy) _igniteEnemy(e, { duration: FLARE_BURN_DURATION, sourceId: 'solar_flare' });
}

// ドーム爆発の atk_lv 4/4/7 リアクション（2026-05-29: 2/2/7 → 4/4/7・spawn 瞬間のみ）
//   lv 4 = 打ち上げ（down_up_start）。launchVy で軽く浮かせて juggle 状態へ。
//   ダウン中は lv 7 拾い（knockback03 + hop）で維持。
const DOME_LAUNCH_VY = 20;

// AoE 反応用 SA 吸収（2026-05-29・hit-engine の SA 吸収と同基準）：
//   SA を 1 枚消費できたら true（打ち上げリアクションを抑止）。DoT 自体は別途適用済み。
function _tryAbsorbSA(e) {
  if ((e.passiveSaHp ?? 0) > 0) {                       // midboss berserker 恒常 SA
    e.passiveSaHp = 0;
    e.passiveSaRecharge = MIDBOSS_SHIELD_CONFIG.PASSIVE_SA_RECHARGE;
    e.hitFlashTimer = Math.max(e.hitFlashTimer ?? 0, 6);
    return true;
  }
  const inWin = e.atkPhase === 'active' || (e.atkPhase === 'recover' && (e.recoverSaTimer ?? 0) > 0);
  if ((e.superArmor ?? 0) > 0 && inWin && (e.saHp ?? 0) > 0) {  // active フェーズ SA
    e.saHp--;
    e.hitFlashTimer = Math.max(e.hitFlashTimer ?? 0, 6);
    return true;
  }
  return false;
}

function _applyDomeBlastReactionToEnemy(v, e) {
  if (!_STATE) return;
  if (!_isTargetable(e)) return;
  e.hp -= FLARE_DAMAGE_PER_TICK * 2;
  if (_igniteEnemy) _igniteEnemy(e, { duration: FLARE_BURN_DURATION, sourceId: 'solar_flare_blast' });
  // 打ち上げリアクションの対象判定（2026-05-29・stun 方針に整合）：
  //   大ボスは juggle 免疫（DoT は updateEnemies のゲート安全網で尊重）／
  //   midboss は SA 有効なら 1 枚吸収して反応なし。DoT は上で適用済みなのでここで return しても削りは効く。
  if (e.isBoss) return;
  if (_tryAbsorbSA(e)) return;
  const dx = e.x - v.x, dz = e.z - v.z;
  const len = Math.max(1, Math.hypot(dx, dz));
  const kbDirX = dx / len;
  const isDown = (
    e.state === _STATE.down_bas_start   || e.state === _STATE.down_bas_loop   || e.state === _STATE.down_bas_end ||
    e.state === _STATE.down_bound_start || e.state === _STATE.down_bound_loop || e.state === _STATE.down_bound_end ||
    e.state === _STATE.down_super_start || e.state === _STATE.down_super_loop ||
    e.state === _STATE.down_front_start || e.state === _STATE.down_front_loop ||
    e.state === _STATE.down_rakka_start || e.state === _STATE.down_rakka_loop
  );
  if (isDown) {
    // lv 7 拾い
    e.state       = _STATE.knockback03;
    e.downTimer   = ENEMY_KB03_FRAMES;
    e.vy          = KB_LV07_HOP_VY;
    e.knockbackVx = 0;
  } else {
    // lv 4 打ち上げ（地上・空中ともに down_up_start で juggle）
    e.state       = _STATE.down_up_start;
    e.vy          = DOME_LAUNCH_VY;
    e.downTimer   = ENEMY_FALL_FRAMES;
    e.knockbackVx = kbDirX * 3;
    e.launcherAirborne = true;   // peakHang 有効化（頂点で重力スロー）
  }
}

export function updateSolarFlares() {
  // === Pending 解決：期限到来したものを敵の現在位置で spawn（schedulePendingFlare のクロージャ）===
  _pending.update();
  // === Active flares 更新 ===
  if (!_flares.length) return;
  for (let i = _flares.length - 1; i >= 0; i--) {
    const v = _flares[i];
    // ドーム視覚の寿命管理（炎フィールドより短い）
    if (v.dome) {
      v.domeLife--;
      if (v.domeLife <= 0) { _disposeMesh(v.dome); v.dome = null; }
      else {
        const t = v.domeLife / v.domeLifeMax;
        v.dome.material.opacity = FLARE_DOME_OPACITY * t;
        // 軽く拡大しながらフェードアウト
        const s = 1 + (1 - t) * 0.1;
        v.dome.scale.set(s, s, s);
      }
    }
    v.life--;
    if (v.life <= 0) {
      if (_damageArea?.removeArea) _damageArea.removeArea(v.id);
      _disposeMesh(v.fillOuter);
      _disposeMesh(v.fillInner);
      _disposeMesh(v.dome);
      _flares.splice(i, 1);
      _flog('EXPIRE', { remaining: _flares.length });
      continue;
    }
    const fadeT = Math.min(1, v.life / 30);
    if (v.fillOuter) v.fillOuter.material.opacity = 0.28 * fadeT;
    if (v.fillInner) v.fillInner.material.opacity = 0.42 * fadeT;
    v.tickAcc++;
    if (v.tickAcc < FLARE_TICK_INTERVAL) continue;
    v.tickAcc = 0;
    if (!_enemies) continue;
    const r2 = v.radius * v.radius;
    for (const e of _enemies) {
      if (!_isTargetable(e)) continue;
      const dx = e.x - v.x, dz = e.z - v.z;
      if (dx * dx + dz * dz <= r2) {
        _applyTickToEnemy(v, e);
      }
    }
  }
}

export function getActiveSolarFlareCount() { return _flares.length; }
export function getPendingSolarFlareCount() { return _pending.size; }

export function clearAllSolarFlares() {
  for (const v of _flares) {
    if (_damageArea?.removeArea) _damageArea.removeArea(v.id);
    _disposeMesh(v.fillOuter);
    _disposeMesh(v.fillInner);
    _disposeMesh(v.dome);
  }
  _flares.length = 0;
  _pending.clear();
}
