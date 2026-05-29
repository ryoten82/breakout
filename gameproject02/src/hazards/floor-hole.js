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
// 設計方針（2026-05-29 ブロック矩形方式へ単純化）：
//   - 攻撃ギミック寄り：穴は「敵を叩き込む武器」。プレイヤー落下は事故枠
//   - 穴より一回り大きい「ブロック矩形」（穴 rect + blockMargin）を用意し、落下対象でない
//     state（SAFE_FALL_STATES）の敵・プレイヤーは**接地中ブロック矩形に入れない**（縁手前で止まる）。
//     これで「平時に穴の上を歩く / 乗って停滞」を一掃する。
//   - 落下するのは「ダメージ判定が出る系」だけ：非平穏 state（攻撃/被弾/ダウン/よろけ等）で
//     穴 rect に入る、または吹き飛び（FLY_THROUGH_HOLE_STATES）で穴上に来た個体のみ。
//   - 穴上空をジャンプで飛び越えるのは自由（空中はブロックしない）。穴 rect 内に着地した時、
//     非平穏なら落下／平穏（calm landing）なら押し出し救済。
//   - 敵・プレイヤーで同一の _blockFromHoleZone を使う（enemy-system 側に AI 回避処理を持たない）。
//   - 敵を落とすと「落ちた穴の手前」へ CR コインをドロップ。
//   - CR コインが穴グラフィックに乗らないようバリア登録（cr-system 経由）。

import { STATE } from '../states.js';
import { registerCrBarrier } from '../cr-system.js';

// 平穏 state（落ちない）：能動行動/被弾系のみ落とすことで穴を「叩き込み武器」化する。
// knockback01（地上 lv01 軽フリンチ）は軽すぎるので除外。knockback02 以降は落ちる。
// knockback_air01（空中ヒット）は含まない（空中で被弾＝叩き落とし対象）。
const SAFE_FALL_STATES = new Set([
  STATE.wait01, STATE.walk_fwd, STATE.walk_back,
  STATE.dash,             // 走り中（タックル等の能動ダッシュ）も穴を素通り（2026-05-27：背後からの走り敵が落ちる事故防止）
  STATE.knockback01,
]);

// 吹き飛び中は y が上昇するが穴判定を通す（lv3/lv5/lv6 の弾き込み対象）。
// y > enemyGroundY チェックをこれらの state はバイパス。
const FLY_THROUGH_HOLE_STATES = new Set([
  STATE.down_front_start, STATE.down_front_loop,
  STATE.down_super_start, STATE.down_super_loop,
  STATE.down_wall_start,  STATE.down_wall_loop,
  STATE.down_roll_start,
]);

// 共通チューニング（穴 1 個ごとの矩形は addFloorHole で渡す）
export const FLOOR_HOLE_CONFIG = {
  enemyGroundY: 14,
  enemyFallVy: -6,
  enemyFallGrav: 0.55,
  enemyDespawnY: -700,
  crDropMargin: 140,        // CR ドロップ位置（穴 xMin より手前へのオフセット）
  blockMargin: 50,          // ブロック矩形 = 穴 rect を全方向にこの分広げた範囲（落下対象外を阻止）
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

// (x, z) が穴の上なら最寄りの縁の外へ押し出した座標を返す（_enforceHoleWall と同方針）。
//   穴上でなければそのまま。穴未登録ステージでは常にそのまま（no-op）。
//   用途：アイテムドロップが穴グラフィックに乗らないようにする（2026-05-29・A2）。
export function nudgePointOutOfHole(x, z, margin = 30) {
  const r = _holeAt(x, z);
  if (!r) return { x, z };
  const dXLeft = x - r.xMin, dXRight = r.xMax - x;
  const dZNear = z - r.zMin, dZFar = r.zMax - z;
  if (Math.min(dXLeft, dXRight) <= Math.min(dZNear, dZFar)) {
    return { x: (dXLeft <= dXRight ? r.xMin - margin : r.xMax + margin), z };
  }
  return { x, z: (dZNear <= dZFar ? r.zMin - margin : r.zMax + margin) };
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
  // 吹き飛び中（FLY_THROUGH_HOLE_STATES）は空中でも穴判定を通す。
  // それ以外は接地近傍のみ（歩行中の誤落下を防ぐ）。
  if (!FLY_THROUGH_HOLE_STATES.has(e.state) && e.y > FLOOR_HOLE_CONFIG.enemyGroundY) return null;
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

// 見えない段差（汎用）：ent（敵 or プレイヤー）が「ブロック矩形」（穴 rect + margin）に
// 入り込んだら、入ってきた方向（X か Z）の最寄り縁の外へ押し返す。敵・プレイヤー共通。
//   - margin で穴より一回り外に止まる＝体が穴グラフィックに乗らない。
//   - 穴未登録ステージや矩形外なら no-op（false）。
//   - 接地判定は呼び出し側で済ませる前提（空中はブロックしない）。
function _blockFromHoleZone(ent, margin) {
  if (!ent) return false;
  for (const h of _holes) {
    const r = h.rect;
    const xMin = r.xMin - margin, xMax = r.xMax + margin;
    const zMin = r.zMin - margin, zMax = r.zMax + margin;
    if (ent.x <= xMin || ent.x >= xMax || ent.z <= zMin || ent.z >= zMax) continue;
    const dL = ent.x - xMin, dR = xMax - ent.x;
    const dN = ent.z - zMin, dF = zMax - ent.z;
    if (Math.min(dL, dR) <= Math.min(dN, dF)) {
      ent.x = (dL <= dR) ? xMin : xMax;
      if (ent.mesh) ent.mesh.position.x = ent.x;
    } else {
      ent.z = (dN <= dF) ? zMin : zMax;
      if (ent.mesh) ent.mesh.position.z = ent.z;
    }
    return true;
  }
  return false;
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
    const cfgE = FLOOR_HOLE_CONFIG;
    for (const e of _enemies) {
      if (!e || !e.isAlive || e.dying || e._inHole) continue;
      const r = _enemyHole(e);
      if (r) {
        // 非平穏（被弾/攻撃/ダウン/吹き飛び）で穴 rect に入った → 落下＝叩き込み武器
        _dropEnemy(e, r);
        continue;
      }
      // 落下対象でない＝平穏 state or 穴外。平穏 state かつ接地なら穴ゾーンに入れない。
      if (SAFE_FALL_STATES.has(e.state) && e.y <= cfgE.enemyGroundY) {
        _blockFromHoleZone(e, cfgE.blockMargin);
      }
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
    // 吹き飛び中（lv3 KB 等）は穴上に居れば即落下（壁押し戻しをバイパス）
    const blownAway = FLY_THROUGH_HOLE_STATES.has(p.state);

    if (r && !grounded) _playerAirborneOverHole = true;
    if (!r && grounded) _playerAirborneOverHole = false;

    if (r && blownAway) {
      // 吹き飛ばされて穴に入った → そのまま落下
      _dropPlayer(p, r);
    } else if (_playerAirborneOverHole && grounded && r) {
      // ジャンプで穴に入って着地 → 落下。
      // SAFE_FALL_STATES（calm landing）なら救済。攻撃/被弾系で穴上着地のみ落とす。
      if (!SAFE_FALL_STATES.has(p.state)) _dropPlayer(p, r);
      _playerAirborneOverHole = false;
    }
    // 壁押し戻し（ブロック矩形）は吹き飛び中でない通常接地時のみ。空中はブロックしない
    // （ジャンプで穴を飛び越える挙動を維持。穴 rect 内着地時の落下判定は上の分岐で処理済み）。
    if (!_playerFallPending && !blownAway && grounded) {
      _blockFromHoleZone(p, FLOOR_HOLE_CONFIG.blockMargin);
    }
  }
}
