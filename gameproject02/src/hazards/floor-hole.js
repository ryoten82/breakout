// 地面穴ギミック — 汎用ステージハザード（2026-05-24 汎用化）
// 旧 src/stages/stage02/floor-hazard.js を分離・任意ステージから複数穴を気軽に追加できる形に。
//
// 使い方（ステージ側）：
//   import { initFloorHoleSystem, addFloorHole, tickFloorHoleSystem } from '../../hazards/floor-hole.js';
//   initStage(deps) {
//     initFloorHoleSystem(deps);       // 1回だけ：scene/THREE/enemies/players 参照を受け取る
//     addFloorHole({ xMin: 1640, xMax: 1980, zMin: -220, zMax: 220 });
//     addFloorHole({ xMin: 3120, xMax: 3460, zMin: -220, zMax: 220 });
//   }
//   tickStage() { tickFloorHoleSystem(); }   // 毎フレーム
//
// 設計方針：
//   - 攻撃ギミック寄り：穴は「敵を叩き込む武器」。プレイヤー落下は事故枠
//   - 穴上空をジャンプで通過 → 着地で落下判定（_playerAirborneOverHole）
//   - 接地歩行は見えない段差（_enforceHoleWall）でブロック
//   - SAFE_FALL_STATES（平穏 state）の個体は落ちない。叩き込まれた個体のみ落ちる
//   - 敵を落とすと「落ちた穴の手前」へ CR コインをドロップ
//   - CR コインが穴グラフィックに乗らないようバリア登録（cr-system 経由）

import { STATE } from '../states.js';
import { registerCrBarrier } from '../cr-system.js';

// 平穏 state（落ちない）：能動行動/被弾系のみ落とすことで穴を「叩き込み武器」化する。
// knockback01（地上 lv01 軽フリンチ）は軽すぎるので除外。knockback02 以降は落ちる。
// knockback_air01（空中ヒット）は含まない（空中で被弾＝叩き落とし対象）。
const SAFE_FALL_STATES = new Set([
  STATE.wait01, STATE.walk_fwd, STATE.walk_back,
  STATE.knockback01,
]);

// 共通チューニング（穴 1 個ごとの矩形は addFloorHole で渡す）
export const FLOOR_HOLE_CONFIG = {
  enemyGroundY: 14,
  enemyFallVy: -6,
  enemyFallGrav: 0.55,
  enemyDespawnY: -700,
  crDropMargin: 140,        // CR ドロップ位置（穴 xMin より手前へのオフセット）
  playerFallDamage: 12,
  playerInvincibleF: 120,
  playerRespawnMargin: 160,
  playerRespawnDelay: 60,   // 地上リスポーンまでの待機F
  playerGroundY: 12,
  // 視覚（穴ごと override 可：addFloorHole(rect, { rimColor, holeColor, glowColor }) で上書き）
  rimColor:   0xd9a521,
  holeColor:  0x05050a,
  glowColor:  0x2f74ff,
};

let _scene = null;
let _THREE = null;
let _enemies = null;
let _players = null;

// 登録された穴：{ rect:{xMin,xMax,zMin,zMax}, group }
const _holes = [];

let _falling = [];
let _initialized = false;

let _playerFallPending = false;
let _playerFallTimer = 0;
let _playerRespawnX = 0;
let _playerRespawnZ = 0;
let _playerFrozenX = 0;
let _playerFrozenY = 0;
let _playerFrozenZ = 0;
let _playerAirborneOverHole = false;

export function initFloorHoleSystem(deps) {
  _scene = deps.scene;
  _THREE = deps.THREE;
  _enemies = deps.enemies;
  _players = deps.players;
  // 状態リセット（ステージ再 init 時の二重登録防止：scene 上の旧穴 mesh は reload で消えている前提）
  _holes.length = 0;
  _falling = [];
  _playerFallPending = false;
  _playerFallTimer = 0;
  _playerAirborneOverHole = false;
  _initialized = true;
  if (typeof window !== 'undefined' && window.SB) {
    window.SB.FLOOR_HOLES = _holes;
    window.SB.FLOOR_HOLE_CONFIG = FLOOR_HOLE_CONFIG;
  }
}

// 任意の XZ 矩形に穴を 1 個追加。複数回呼べる。
// rect: { xMin, xMax, zMin, zMax }
// opts（任意）: { rimColor, holeColor, glowColor } で視覚色を上書き
export function addFloorHole(rect, opts = {}) {
  if (!_initialized || !_scene || !_THREE) return null;
  const group = _buildHoleVisual(rect, opts);
  _scene.add(group);
  const entry = { rect, group };
  _holes.push(entry);
  // CR コインが穴グラフィックに乗らないよう汎用矩形バリアを登録
  registerCrBarrier({ xMin: rect.xMin, xMax: rect.xMax, zMin: rect.zMin, zMax: rect.zMax });
  return entry;
}

function _buildHoleVisual(rect, opts) {
  const cfg = FLOOR_HOLE_CONFIG;
  const cx = (rect.xMin + rect.xMax) / 2;
  const cz = (rect.zMin + rect.zMax) / 2;
  const w = rect.xMax - rect.xMin;
  const d = rect.zMax - rect.zMin;
  const rimColor  = opts.rimColor  ?? cfg.rimColor;
  const holeColor = opts.holeColor ?? cfg.holeColor;
  const glowColor = opts.glowColor ?? cfg.glowColor;
  const g = new _THREE.Group();

  const rim = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w + 90, d + 90),
    new _THREE.MeshBasicMaterial({ color: rimColor })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(cx, 2, cz);
  g.add(rim);

  const hole = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w, d),
    new _THREE.MeshBasicMaterial({ color: holeColor })
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(cx, 4, cz);
  g.add(hole);

  const glow = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w * 0.42, d * 0.42),
    new _THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.85 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(cx, 5, cz);
  g.add(glow);

  return g;
}

// (x, z) を含む穴の rect を返す（開口部判定・端は除く）。なければ null。
function _holeAt(x, z) {
  for (const h of _holes) {
    const r = h.rect;
    if (x > r.xMin && x < r.xMax && z > r.zMin && z < r.zMax) return r;
  }
  return null;
}

// 死亡爆発バースト（hit-engine の spawnDeathExplosion を window.SB 経由で再現）
function _spawnDeathBurst(x, y, z) {
  const SB = (typeof window !== 'undefined') ? window.SB : null;
  if (!SB || !SB.spawnHitParticles) return;
  const sp = SB.spawnHitParticles;
  const main = { type: 'omni', sizeScale: 1.5, speedMul: 1.35, lifeMul: 1.0 };
  sp(x, y, z, 0xffffff, 14, main);
  sp(x, y, z, 0xffee44, 24, main);
  sp(x, y, z, 0xff8822, 32, main);
  sp(x, y, z, 0xff3322, 38, main);
  sp(x, y, z, 0x222222, 18, { type: 'omni', sizeScale: 1.2, speedMul: 1.6, lifeMul: 1.0 });
  const linger = { type: 'omni', sizeScale: 2.0, speedMul: 0.45, lifeMul: 50 / 22 };
  sp(x, y, z, 0xff7733, 10, linger);
  sp(x, y, z, 0x553311, 8, linger);
  if (SB.triggerHitstop) SB.triggerHitstop(10);
  if (SB.triggerShake) SB.triggerShake(16, 26);
}

// ============================================================
//  敵
// ============================================================

// 敵が落下対象ならその穴 rect を返す（接地・生存・落下中でない条件込み）。
// SAFE_FALL_STATES の平穏個体は素通り（叩き込み武器化）。
function _enemyHole(e) {
  if (!e || !e.isAlive || e.dying || e._inHole) return null;
  if (e.y > FLOOR_HOLE_CONFIG.enemyGroundY) return null;
  if (SAFE_FALL_STATES.has(e.state)) return null;
  for (const h of _holes) {
    const r = h.rect;
    if (e.x >= r.xMin && e.x <= r.xMax && e.z >= r.zMin && e.z <= r.zMax) return r;
  }
  return null;
}

function _dropEnemy(e, holeRect) {
  e._inHole = true;
  // 攻撃トークンを先に解放してから isAlive=false に。順序が逆だと
  //   debug-invariants が「token が dead enemy を参照」を毎 F 警告し続ける（St2 で頻発）。
  const SB = (typeof window !== 'undefined') ? window.SB : null;
  if (SB && SB.releaseEnemyTokens) SB.releaseEnemyTokens(e);
  e.isAlive = false;     // updateEnemies スキップ → y クランプ無効化
  e.aiEnabled = false;
  e.knockbackVx = 0;
  e.knockbackVz = 0;
  const hb = e.mesh && e.mesh.userData && e.mesh.userData.hpBar;
  if (hb) {
    if (hb.bg) hb.bg.visible = false;
    if (hb.fill) hb.fill.visible = false;
  }
  // 報酬：穴入口の死亡爆発バースト + CR コインを穴手前へドロップ
  _spawnDeathBurst(e.x, e.y + 80, e.z);
  _dropHoleReward(e.z, holeRect);
  _falling.push({ e, vy: FLOOR_HOLE_CONFIG.enemyFallVy });
}

// 穴に落とした敵の報酬：CR コインを「落ちた穴の手前（プレイヤー側）」にドロップ。
function _dropHoleReward(z, holeRect) {
  const SB = (typeof window !== 'undefined') ? window.SB : null;
  if (!SB || !SB.dropCR) return;
  SB.dropCR(holeRect.xMin - FLOOR_HOLE_CONFIG.crDropMargin, z, 90);
}

function _updateFallingEnemies() {
  if (_falling.length === 0) return;
  const cfg = FLOOR_HOLE_CONFIG;
  const rest = [];
  for (const f of _falling) {
    const e = f.e;
    f.vy -= cfg.enemyFallGrav;
    e.y += f.vy;
    if (e.mesh) e.mesh.position.y = e.y;
    if (e.y <= cfg.enemyDespawnY) {
      if (e.mesh && e.mesh.parent) _scene.remove(e.mesh);
      e.removed = true;
      continue;
    }
    rest.push(f);
  }
  _falling = rest;
}

// ============================================================
//  プレイヤー
// ============================================================

// 見えない段差：接地中に穴ゾーンへ侵入したら入ってきた方向（X か Z）に押し返す。
function _enforceHoleWall(p) {
  if (!p) return;
  const cfg = FLOOR_HOLE_CONFIG;
  const grounded = p.isGrounded || (p.y <= cfg.playerGroundY);
  if (!grounded) return;
  const r = _holeAt(p.x, p.z);
  if (!r) return;

  const dXLeft  = p.x - r.xMin;
  const dXRight = r.xMax - p.x;
  const dZNear  = p.z - r.zMin;
  const dZFar   = r.zMax - p.z;

  if (Math.min(dXLeft, dXRight) <= Math.min(dZNear, dZFar)) {
    p.x = dXLeft <= dXRight ? r.xMin : r.xMax;
    if (p.mesh) p.mesh.position.x = p.x;
  } else {
    p.z = dZNear <= dZFar ? r.zMin : r.zMax;
    if (p.mesh) p.mesh.position.z = p.z;
  }
}

function _dropPlayer(p, holeRect) {
  const cfg = FLOOR_HOLE_CONFIG;
  p.hp = Math.max(1, p.hp - cfg.playerFallDamage);
  // テレポートしない：落ちた位置で凍結（ダッシュトレイルのストリーク防止）
  p.vy = 0;
  if ('vx' in p) p.vx = 0;
  if ('vz' in p) p.vz = 0;
  if ('kbVx' in p) p.kbVx = 0;
  if ('kbVy' in p) p.kbVy = 0;
  p.dashActive = false;
  p.airWasDash = false;
  p.state = STATE.wait01;
  p.stateTimer = 0;
  p.invincibleFrames = cfg.playerInvincibleF;
  _playerFrozenX = p.x;
  _playerFrozenY = 0;
  _playerFrozenZ = p.z;
  _playerFallPending = true;
  _playerFallTimer = cfg.playerRespawnDelay;
  _playerRespawnX = holeRect.xMin - cfg.playerRespawnMargin;
  _playerRespawnZ = p.z;
}

// 待機中は落下位置で凍結 + 非表示。60F 後に穴手前へ移して wait01 で出現。
function _tickPlayerRespawn() {
  if (!_playerFallPending) return;
  const p = _players && _players[0];
  if (p) {
    p.x = _playerFrozenX;
    p.y = _playerFrozenY;
    p.z = _playerFrozenZ;
    p.vy = 0;
    if ('vx' in p) p.vx = 0;
    if ('vz' in p) p.vz = 0;
    p.dashActive = false;
    p.airWasDash = false;
    if (p.mesh) {
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.visible = false;
    }
  }
  _playerFallTimer--;
  if (_playerFallTimer > 0) return;
  _playerFallPending = false;
  if (!p) return;
  p.x = _playerRespawnX;
  p.z = _playerRespawnZ;
  p.y = 0;
  p.vy = 0;
  p.state = STATE.wait01;
  p.stateTimer = 0;
  p.invincibleFrames = Math.max(p.invincibleFrames, 90);
  if (p.mesh) {
    p.mesh.position.set(p.x, p.y, p.z);
    p.mesh.visible = true;
  }
}

export function tickFloorHoleSystem() {
  if (!_initialized) return;
  // window.SB 露出（init 後に SB が構築されたケースの保険）
  if (typeof window !== 'undefined' && window.SB && !window.SB.FLOOR_HOLES) {
    window.SB.FLOOR_HOLES = _holes;
    window.SB.FLOOR_HOLE_CONFIG = FLOOR_HOLE_CONFIG;
  }

  // 敵
  if (_enemies) {
    for (const e of _enemies) {
      const r = _enemyHole(e);
      if (r) _dropEnemy(e, r);
    }
  }
  _updateFallingEnemies();

  // プレイヤー
  const p = _players && _players[0];
  _tickPlayerRespawn();

  if (p && !_playerFallPending) {
    const cfg = FLOOR_HOLE_CONFIG;
    const grounded = p.isGrounded || (p.y <= cfg.playerGroundY);
    const r = _holeAt(p.x, p.z);

    if (r && !grounded) _playerAirborneOverHole = true;
    if (!r && grounded) _playerAirborneOverHole = false;

    // ジャンプで穴に入って着地 → 落下。
    // SAFE_FALL_STATES（calm landing）なら救済。攻撃/被弾系で穴上着地のみ落とす。
    if (_playerAirborneOverHole && grounded && r) {
      if (!SAFE_FALL_STATES.has(p.state)) _dropPlayer(p, r);
      _playerAirborneOverHole = false;
    }
    // 壁押し戻しは drop が発生していない時のみ
    if (!_playerFallPending) _enforceHoleWall(p);
  }
}
