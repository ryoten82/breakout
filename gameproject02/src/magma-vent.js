import {
  ENEMY_KB02_FRAMES, ENEMY_KB_AIR_FRAMES, ENEMY_KB03_FRAMES,
  ENEMY_AIRBORNE_Y_THRESHOLD, KB_LV07_HOP_VY,
} from './states.js';

// MAGMA VENT — OC BRN-e08（マグマ噴出ゾーンコントロール）
//
// 仕様：SP3 系（magmaVentTrigger 持ち）命中時、命中地点の地面にマグマ vent を設置。
//   - 残留時間：120F（重ね掛けで延長：1枚=120F / 2枚=180F / 3枚=240F …）
//   - vent 内の敵に：4F に 1 回 DoT + ignite + 軽 KB
//   - 視覚：damage-area.addStaticArea で赤系点滅リング
//
// API:
//   initMagmaVent({ enemies, damageArea, igniteEnemy, isHitstunState })
//   spawnMagmaVent(x, z, opts)   命中地点に vent 設置（既存近接 vent には寿命 stack）
//   updateMagmaVents()           毎フレーム：寿命減算・敵への tick 適用
//   getActiveMagmaVentCount()    debug 用

const VENT_RADIUS         = 200;
const VENT_LIFE_BASE      = 300;   // 5 秒（60fps × 5）
const VENT_TICK_INTERVAL  = 48;    // ~0.8 秒に 1 回（"踏み続けてジリジリ" の感覚）
const VENT_DAMAGE_PER_TICK = 3;
const VENT_BURN_DURATION  = 90;
const VENT_COLOR          = 0xff2200;
const VENT_OPACITY        = 0.75;
const VENT_BLINK_PERIOD   = 14;
// ATK_LV：地上 2 / 空中 2 / ダウン 7（user spec 2026-05-28）
const VENT_ATK_LV         = 2;
const VENT_ATK_LV_AIR     = 2;
const VENT_ATK_LV_DOWN    = 7;
// 1 個のみ存在（重複無し）。再発動で旧 vent を削除して新規スポーン。

const _vents = [];

let _enemies = null;
let _damageArea = null;
let _igniteEnemy = null;
let _isHitstunState = null;
let _spawnDamageNumber = null;
let _spawnHitParticles = null;
let _STATE = null;
let _getGameFrame = null;

export function initMagmaVent({ enemies, damageArea, igniteEnemy, isHitstunState, spawnDamageNumber, spawnHitParticles, STATE, getGameFrame }) {
  _enemies = enemies || null;
  _damageArea = damageArea || null;
  _igniteEnemy = igniteEnemy || null;
  _isHitstunState = isHitstunState || null;
  _spawnDamageNumber = spawnDamageNumber || null;
  _spawnHitParticles = spawnHitParticles || null;
  _STATE = STATE || null;
  _getGameFrame = getGameFrame || null;
}

// === 内側塗り（filled disk）===
//   damage-area の addStaticArea は中空リングしか作れないので塗りは別 mesh で持つ。
//   光ってる感を出すため透明度高めの 2 層（外側薄・内側中央）。
let _scene = null;
let _THREE = null;
export function attachMagmaVentScene({ scene, THREE }) {
  _scene = scene;
  _THREE = THREE;
}
function _makeFillDisk(radius, color, opacity) {
  if (!_scene || !_THREE) return null;
  const geom = new _THREE.CircleGeometry(radius, 64);
  const mat = new _THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: _THREE.DoubleSide, depthWrite: false,
  });
  const m = new _THREE.Mesh(geom, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.3;
  _scene.add(m);
  return m;
}

function _dlog(label, extra) {
  if (typeof window !== 'undefined' && window.SB?.DEBUG_MAGMA_VENT) {
    const f = _getGameFrame?.() ?? '-';
    console.log(`[MAGMA ${label}] f=${f}`, extra ?? '');
  }
}

export function spawnMagmaVent(x, z, opts = {}) {
  if (!_damageArea?.addStaticArea) return null;
  const life = opts.life ?? VENT_LIFE_BASE;
  const radius = opts.radius ?? VENT_RADIUS;
  // 重複無し（2026-05-28 修正）：既存 vent があれば必ず削除して新規スポーン。
  //   再発動 = 「その場に掛け直し」体験。stack/延長 は廃止。
  if (_vents.length > 0) {
    for (const old of _vents) {
      if (_damageArea?.removeArea) _damageArea.removeArea(old.id);
      _disposeFill(old.fillOuter);
      _disposeFill(old.fillInner);
    }
    _dlog('REPLACE old', { removed: _vents.length });
    _vents.length = 0;
  }
  // 外側リング（既存）
  const areaId = _damageArea.addStaticArea({
    x, y: 0, z,
    radius,
    color: VENT_COLOR,
    opacity: VENT_OPACITY,
    blink: true,
    blinkPeriodFn: () => VENT_BLINK_PERIOD,
  });
  // 内側塗り 2 層：床に「赤い面」を作って視認性確保
  const fillOuter = _makeFillDisk(radius * 0.95, 0xff4400, 0.30);
  const fillInner = _makeFillDisk(radius * 0.55, 0xffaa00, 0.50);
  if (fillOuter) fillOuter.position.set(x, fillOuter.position.y, z);
  if (fillInner) fillInner.position.set(x, fillInner.position.y, z);
  // spawn 瞬間の拡張パルス（damage-area 既存 API）でドンと見せる
  _damageArea.spawnExpandPulse?.({
    x, y: 0, z,
    radius: radius * 1.3,
    color: 0xff6600,
    opacity: 0.8,
    life: 18,
    thickness: 14,
  });
  const vent = {
    id: areaId,
    x, z,
    radius,
    life,
    lifeMax: life,
    tickAcc: 0,
    fillOuter,
    fillInner,
  };
  _vents.push(vent);
  _dlog('SPAWN', { x, z, life, areaId, total: _vents.length });
  // === Spawn 時の即時 tick ===
  // SP3 hitFrame → vent SPAWN まで同フレーム、最初の通常 tick は 48F 後 → その 1 秒間は
  // SP3 由来の down_bound が残って「バウンドダウンのまま」に見える問題の対策。
  // SPAWN と同フレームで範囲内全敵に knockback02 化を適用する（2026-05-28）。
  if (_enemies) {
    const r2 = radius * radius;
    let hitCount = 0;
    for (const e of _enemies) {
      if (!_isVentTargetable(e)) continue;
      const ex = e.x - x, ez = e.z - z;
      if (ex * ex + ez * ez <= r2) {
        _applyVentTickToEnemy(vent, e);
        hitCount++;
      }
    }
    _dlog('SPAWN initial tick', { hitCount });
  }
  return areaId;
}

// 内部：ヒット可否判定
//   - 死亡 / dyingInvincible はスキップ
//   - down_burst_* （完全無敵スピン中）はスキップ
//   - down_bas_* （地面ダウン静止）はヒット対象（user spec: atk_lv_down: 7 相当）
//   - 通常 wait01 / knockback / enemy_attacking 等もヒット対象
function _isVentTargetable(e) {
  if (!e || !e.isAlive || e.dying || e.dyingInvincible) return false;
  if (_STATE) {
    if (e.state === _STATE.down_burst_start || e.state === _STATE.down_burst_loop) return false;
  }
  return true;
}

// 「ダウン系」state の集合（lv7 を含めた拾い対象になる state 全部）
function _isAnyDownState(e) {
  if (!_STATE) return false;
  return (
    e.state === _STATE.down_bas_start   || e.state === _STATE.down_bas_loop   || e.state === _STATE.down_bas_end ||
    e.state === _STATE.down_bound_start || e.state === _STATE.down_bound_loop || e.state === _STATE.down_bound_end ||
    e.state === _STATE.down_super_start || e.state === _STATE.down_super_loop ||
    e.state === _STATE.down_front_start || e.state === _STATE.down_front_loop ||
    e.state === _STATE.down_rakka_start || e.state === _STATE.down_rakka_loop
  );
}

function _applyVentTickToEnemy(v, e) {
  if (!_isVentTargetable(e)) {
    _dlog('TICK SKIP', { reason: 'untargetable', state: e?.state, isAlive: e?.isAlive, dying: e?.dying, dyingInv: e?.dyingInvincible });
    return;
  }
  const stateBefore = e.state;
  const yBefore = e.y;
  const vyBefore = e.vy;
  // DoT（直接 hp 減算）
  e.hp -= VENT_DAMAGE_PER_TICK;
  if (_spawnDamageNumber) _spawnDamageNumber(e.x, e.y + 80, e.z, VENT_DAMAGE_PER_TICK, {});
  if (_spawnHitParticles) _spawnHitParticles(e.x, e.y + 60, e.z, 0xff4400, 10, { type: 'omni', speedMul: 0.7, sizeScale: 1.0 });
  if (_igniteEnemy) _igniteEnemy(e, { duration: VENT_BURN_DURATION, sourceId: 'magma_vent' });
  // === ATK_LV ベースのフリンチ反応（2026-05-28・spec: 2/2/7 → 全て knockback02 で起こす運用）===
  if (!_STATE) return;
  // KB 方向は vent 中心から放射
  const dx = e.x - v.x;
  const dz = e.z - v.z;
  const len = Math.max(1, Math.hypot(dx, dz));
  const kbDirX = dx / len;
  const inAir = e.y > ENEMY_AIRBORNE_Y_THRESHOLD;
  const isDown = _isAnyDownState(e);
  if (inAir && !isDown) {
    _dlog('TICK air-fall (no state change)', { state: stateBefore, y: yBefore.toFixed(1), vy: vyBefore.toFixed(2), hp: e.hp });
    return;
  }
  // 地上 or down 系 → knockback02 強制（bounce/vy を完全清算）
  e.state       = _STATE.knockback02;
  e.downTimer   = ENEMY_KB02_FRAMES;
  e.knockbackVx = kbDirX * 3;
  e.vy          = 0;
  e.y           = 0;
  e.kbFromMega  = false;
  _dlog('TICK → knockback02', {
    stateBefore, stateAfter: e.state,
    yBefore: yBefore.toFixed(1), vyBefore: vyBefore.toFixed(2),
    isDown, inAir, hp: e.hp,
    enemyId: e.id ?? e.enemyType ?? '?',
  });
}

function _disposeFill(mesh) {
  if (!mesh) return;
  _scene?.remove(mesh);
  mesh.geometry?.dispose?.();
  mesh.material?.dispose?.();
}

export function updateMagmaVents() {
  if (!_vents.length) return;
  for (let i = _vents.length - 1; i >= 0; i--) {
    const v = _vents[i];
    v.life--;
    if (v.life <= 0) {
      if (_damageArea?.removeArea) _damageArea.removeArea(v.id);
      _disposeFill(v.fillOuter);
      _disposeFill(v.fillInner);
      _vents.splice(i, 1);
      _dlog('EXPIRE', { id: v.id, remaining: _vents.length });
      continue;
    }
    // 残寿命が短くなったら塗りも薄れさせる（最後 30F でフェード）
    const fadeT = Math.min(1, v.life / 30);
    if (v.fillOuter) v.fillOuter.material.opacity = 0.30 * fadeT;
    if (v.fillInner) v.fillInner.material.opacity = 0.50 * fadeT;
    // tick
    v.tickAcc++;
    if (v.tickAcc < VENT_TICK_INTERVAL) continue;
    v.tickAcc = 0;
    if (!_enemies) continue;
    const r2 = v.radius * v.radius;
    for (const e of _enemies) {
      if (!_isVentTargetable(e)) continue;
      const dx = e.x - v.x;
      const dz = e.z - v.z;
      if (dx * dx + dz * dz <= r2) {
        _applyVentTickToEnemy(v, e);
      }
    }
  }
}

export function getActiveMagmaVentCount() { return _vents.length; }

// stage 切替などで全 vent を畳む
export function clearAllMagmaVents() {
  for (const v of _vents) {
    if (_damageArea?.removeArea) _damageArea.removeArea(v.id);
    _disposeFill(v.fillOuter);
    _disposeFill(v.fillInner);
  }
  _vents.length = 0;
}
