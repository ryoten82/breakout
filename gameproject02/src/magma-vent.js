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

const VENT_RADIUS         = 150;
const VENT_LIFE_BASE      = 120;
const VENT_LIFE_STACK     = 60;    // 同地点重ね掛けで追加される寿命
const VENT_STACK_RANGE    = 80;    // この距離以内なら同 vent として stack
const VENT_TICK_INTERVAL  = 4;     // 何 F ごとに敵へダメ／延焼を適用するか
const VENT_DAMAGE_PER_TICK = 1;
const VENT_KB_VX          = 6;     // 軽い吹き飛ばし（中心からの放射）
const VENT_BURN_DURATION  = 90;
const VENT_COLOR          = 0xff3300;
const VENT_OPACITY        = 0.45;
const VENT_BLINK_PERIOD   = 10;

const _vents = [];

let _enemies = null;
let _damageArea = null;
let _igniteEnemy = null;
let _isHitstunState = null;

export function initMagmaVent({ enemies, damageArea, igniteEnemy, isHitstunState }) {
  _enemies = enemies || null;
  _damageArea = damageArea || null;
  _igniteEnemy = igniteEnemy || null;
  _isHitstunState = isHitstunState || null;
}

function _dlog(label, extra) {
  if (typeof window !== 'undefined' && window.SB?.DEBUG_MAGMA_VENT) {
    console.log(`[MAGMA ${label}]`, extra ?? '');
  }
}

export function spawnMagmaVent(x, z, opts = {}) {
  if (!_damageArea?.addStaticArea) return null;
  const life = opts.life ?? VENT_LIFE_BASE;
  const radius = opts.radius ?? VENT_RADIUS;
  // 近接 vent への stack（同地点重ね掛け）：寿命延長 + radius 据置
  const existing = _vents.find(v => {
    const dx = v.x - x; const dz = v.z - z;
    return (dx * dx + dz * dz) <= VENT_STACK_RANGE * VENT_STACK_RANGE;
  });
  if (existing) {
    existing.life += VENT_LIFE_STACK;
    _dlog('STACK', { x, z, addedLife: VENT_LIFE_STACK, totalLife: existing.life });
    return existing.id;
  }
  const areaId = _damageArea.addStaticArea({
    x, y: 0, z,
    radius,
    color: VENT_COLOR,
    opacity: VENT_OPACITY,
    blink: true,
    blinkPeriodFn: () => VENT_BLINK_PERIOD,
  });
  const vent = {
    id: areaId,
    x, z,
    radius,
    life,
    tickAcc: 0,
  };
  _vents.push(vent);
  _dlog('SPAWN', { x, z, life, areaId, total: _vents.length });
  return areaId;
}

function _applyVentTickToEnemy(v, e) {
  if (!e || !e.isAlive || e.dying) return;
  // DoT
  e.hp -= VENT_DAMAGE_PER_TICK;
  // 延焼付与（既存 burnTimer は refresh される）
  if (_igniteEnemy) {
    _igniteEnemy(e, { duration: VENT_BURN_DURATION, sourceId: 'magma_vent' });
  }
  // 中心から放射方向に軽 KB
  const dx = e.x - v.x;
  const dz = e.z - v.z;
  const len = Math.max(1, Math.hypot(dx, dz));
  e.knockbackVx = (dx / len) * VENT_KB_VX;
  // z 方向は触らない（壁突き抜けや z 列乱れの事故防止）
}

export function updateMagmaVents() {
  if (!_vents.length) return;
  for (let i = _vents.length - 1; i >= 0; i--) {
    const v = _vents[i];
    v.life--;
    if (v.life <= 0) {
      if (_damageArea?.removeArea) _damageArea.removeArea(v.id);
      _vents.splice(i, 1);
      _dlog('EXPIRE', { id: v.id, remaining: _vents.length });
      continue;
    }
    // tick
    v.tickAcc++;
    if (v.tickAcc < VENT_TICK_INTERVAL) continue;
    v.tickAcc = 0;
    if (!_enemies) continue;
    const r2 = v.radius * v.radius;
    for (const e of _enemies) {
      if (!e || !e.isAlive || e.dying) continue;
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
  }
  _vents.length = 0;
}
