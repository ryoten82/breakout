// ダメージエリア可視化 — 共通モジュール
//
// AoE 攻撃・爆発・トラップなど「範囲ダメージ」を持つ要素の判定範囲を
// 視覚化する共通 API。breakables（canister 爆発）や将来のメガクラ範囲表示・
// 敵 AoE 警告などに転用する想定。
//
// API:
//   addStaticArea(opts) — 一定位置に半透明リングを置く（id を返す）
//     - position 追従が必要なら updateAreaPosition(id, x, y, z) で
//     - 不要になったら removeArea(id)
//   addRectArea(opts) — カメラ向き矩形エリアを置く（ボス攻撃 AOE 予兆など）
//     - opts: { x, y, z, width, height, color, opacity, blink, blinkPeriodFn }
//     - updateAreaPosition / removeArea で管理（addStaticArea と共通 id 空間）
//   spawnExpandPulse(opts) — 0→radius に拡張しながらフェードする一発演出
//     爆発の瞬間などに spawn
//   updateAreas() — 毎フレーム呼ぶ（寿命・アニメ進行）
//
// opts:
//   { x, y, z, radius, color, opacity, life (frame, optional for static), thickness }

const areas = [];      // 静的エリア（id 管理・寿命なし or life 指定）
const pulses = [];     // 拡張パルス（spawn 一発で消費）
let _nextId = 1;
let _scene = null;
let _THREE = null;

export function initDamageArea({ scene, THREE }) {
  _scene = scene;
  _THREE = THREE;
}

function _makeRingMesh({ radius, color, opacity, thickness }) {
  // RingGeometry は 床面に水平に置けるよう X-Z 平面に向ける（rotation.x = -π/2）
  const inner = radius - (thickness ?? Math.max(6, radius * 0.04));
  const outer = radius;
  const geom = new _THREE.RingGeometry(Math.max(0, inner), outer, 48);
  const mat = new _THREE.MeshBasicMaterial({
    color: color ?? 0xff3030,
    transparent: true,
    opacity: opacity ?? 0.4,
    side: _THREE.DoubleSide,
    depthWrite: false,
  });
  const m = new _THREE.Mesh(geom, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.5;  // 床に張り付かないよう少し浮かす（z-fighting 回避）
  return m;
}

// 静的エリア：fuse 中の canister など、位置に追従する常設リング
export function addStaticArea(opts) {
  if (!_scene || !_THREE) return null;
  const id = _nextId++;
  const mesh = _makeRingMesh(opts);
  mesh.position.set(opts.x, mesh.position.y, opts.z);
  _scene.add(mesh);
  areas.push({
    id, mesh,
    life: opts.life ?? -1,    // -1 = 寿命なし（明示 remove 待ち）
    baseOpacity: opts.opacity ?? 0.4,
    // 点滅指定（任意）：blink: true / blinkPeriodFn(frame) → period
    blink: !!opts.blink,
    blinkPeriodFn: opts.blinkPeriodFn || null,
    frame: 0,
  });
  return id;
}

// カメラ向き矩形エリア（ボス攻撃 AOE 予兆など）
// PlaneGeometry を XY 平面に置く（カメラは +Z から見ているため正面を向く）
export function addRectArea(opts) {
  if (!_scene || !_THREE) return null;
  const id = _nextId++;
  const {
    x = 0, y = 0, z = 0,
    width = 100, height = 100,
    color = 0xff4400, opacity = 0.3,
  } = opts;
  const geom = new _THREE.PlaneGeometry(width, height);
  const mat = new _THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: _THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new _THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  _scene.add(mesh);
  areas.push({
    id, mesh,
    life: opts.life ?? -1,
    baseOpacity: opacity,
    blink: !!opts.blink,
    blinkPeriodFn: opts.blinkPeriodFn || null,
    frame: 0,
  });
  return id;
}

export function updateAreaPosition(id, x, y, z) {
  const a = areas.find(a => a.id === id);
  if (!a) return;
  if (x !== undefined) a.mesh.position.x = x;
  if (y !== undefined) a.mesh.position.y = y;
  if (z !== undefined) a.mesh.position.z = z;
}

// 矩形エリアの scale を毎フレーム更新するために使う（カーソルバーの幅変更など）
export function updateAreaScale(id, sx, sy) {
  const a = areas.find(a => a.id === id);
  if (!a) return;
  if (sx !== undefined) a.mesh.scale.x = sx;
  if (sy !== undefined) a.mesh.scale.y = sy;
}

export function removeArea(id) {
  const idx = areas.findIndex(a => a.id === id);
  if (idx < 0) return;
  const a = areas[idx];
  _scene.remove(a.mesh);
  a.mesh.geometry.dispose?.();
  a.mesh.material.dispose?.();
  areas.splice(idx, 1);
}

// 拡張パルス：爆発時の「ボフッ」と広がるリング。spawn 後は自動寿命管理
export function spawnExpandPulse(opts) {
  if (!_scene || !_THREE) return;
  const life = opts.life ?? 14;
  const mesh = _makeRingMesh({
    ...opts,
    radius: 1,            // 最初は ≒ 0 で生成、frame で scale 拡大
    thickness: opts.thickness ?? Math.max(8, (opts.radius ?? 100) * 0.06),
  });
  mesh.position.set(opts.x, mesh.position.y, opts.z);
  _scene.add(mesh);
  pulses.push({
    mesh,
    radius: opts.radius ?? 100,
    life,
    lifeMax: life,
    baseOpacity: opts.opacity ?? 0.6,
  });
}

export function updateAreas() {
  // 静的：点滅処理（任意）
  for (const a of areas) {
    a.frame++;
    if (a.blink) {
      const period = a.blinkPeriodFn ? a.blinkPeriodFn(a.frame) : 12;
      const phase = Math.floor(a.frame / period) % 2;
      a.mesh.material.opacity = phase === 0 ? a.baseOpacity : a.baseOpacity * 0.25;
    }
    // 寿命管理（life >= 0 のときのみ）
    if (a.life > 0) {
      a.life--;
      if (a.life <= 0) {
        // 自動 remove は次フレームでまとめて
        a._toRemove = true;
      }
    }
  }
  for (let i = areas.length - 1; i >= 0; i--) {
    if (areas[i]._toRemove) removeArea(areas[i].id);
  }
  // パルス：scale を 0→1 に補完、opacity フェード
  for (let i = pulses.length - 1; i >= 0; i--) {
    const p = pulses[i];
    p.life--;
    const t = 1 - (p.life / p.lifeMax);  // 0→1
    p.mesh.scale.set(p.radius * t, p.radius * t, 1);
    p.mesh.material.opacity = p.baseOpacity * (1 - t);
    if (p.life <= 0) {
      _scene.remove(p.mesh);
      p.mesh.geometry.dispose?.();
      p.mesh.material.dispose?.();
      pulses.splice(i, 1);
    }
  }
}

export function getAreaCount()  { return areas.length; }
export function getPulseCount() { return pulses.length; }
