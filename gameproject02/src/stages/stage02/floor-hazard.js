// Stage 2 後半 — 地面穴ギミック
// 仕様：stage-layout-room.md「Act 1 / Stage 2」地面穴ギミック小節（2026-05-23 昇格）
//
// 設計方針：
//   - 攻撃ギミック寄り (a)：穴は「敵を叩き込む武器」。プレイヤー落下は事故枠
//   - 穴の上空をジャンプで通過 → 着地で落下判定（_playerAirborneOverHole で追跡）
//   - 接地歩行は見えない段差（_enforceHoleWall）でブロック
//   - 固定穴のみ。穴底に青発光（Stage 3 D 段階の予兆）
//
// 実装メモ：
//   敵落下：e.isAlive=false で updateEnemies スキップ → mesh を直接落下演出。
//     穴の入口で死亡爆発バースト（通常撃破の spawnDeathExplosion 相当）を再現。
//     ※ コードベースに CR/スコア/ドロップの報酬システムは無い（2026-05-23 時点）。
//   プレイヤー落下：落ちた位置で凍結（テレポートしない＝ダッシュトレイルのストリーク防止）。
//     待機中は mesh.visible=false 強制。60F 後に穴手前へ移して wait01 で出現。

import { STATE } from '../../states.js';

const HAZARD_CONFIG = {
  holeXMin: 2900,
  holeXMax: 3300,
  holeZMin: -220,
  holeZMax: 220,
  enemyGroundY: 14,
  enemyFallVy: -6,
  enemyFallGrav: 0.55,
  enemyDespawnY: -700,
  playerFallDamage: 12,
  playerInvincibleF: 120,
  playerRespawnMargin: 160,
  playerRespawnDelay: 60,   // 地上リスポーンまでの待機F（約1秒）
  playerGroundY: 12,
};

let _scene = null;
let _THREE = null;
let _enemies = null;
let _players = null;

let _holeGroup = null;
let _falling = [];
let _built = false;

let _playerFallPending = false;
let _playerFallTimer = 0;
let _playerRespawnX = 0;
let _playerRespawnZ = 0;
let _playerFrozenX = 0;
let _playerFrozenY = 0;
let _playerFrozenZ = 0;
let _playerAirborneOverHole = false;

export function initFloorHazard(deps) {
  _scene = deps.scene;
  _THREE = deps.THREE;
  _enemies = deps.enemies;
  _players = deps.players;
  _falling = [];
  _playerFallPending = false;
  _playerFallTimer = 0;
  _playerAirborneOverHole = false;
  if (_scene && _THREE && !_built) {
    _buildHoleVisual();
    _built = true;
  }
  if (typeof window !== 'undefined' && window.SB) {
    window.SB.STAGE2_HOLE = HAZARD_CONFIG;
  }
}

function _buildHoleVisual() {
  const cfg = HAZARD_CONFIG;
  const cx = (cfg.holeXMin + cfg.holeXMax) / 2;
  const cz = (cfg.holeZMin + cfg.holeZMax) / 2;
  const w = cfg.holeXMax - cfg.holeXMin;
  const d = cfg.holeZMax - cfg.holeZMin;
  const g = new _THREE.Group();

  const rim = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w + 90, d + 90),
    new _THREE.MeshBasicMaterial({ color: 0xd9a521 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(cx, 2, cz);
  g.add(rim);

  const hole = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w, d),
    new _THREE.MeshBasicMaterial({ color: 0x05050a })
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(cx, 4, cz);
  g.add(hole);

  const glow = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w * 0.42, d * 0.42),
    new _THREE.MeshBasicMaterial({ color: 0x2f74ff, transparent: true, opacity: 0.85 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(cx, 5, cz);
  g.add(glow);

  _scene.add(g);
  _holeGroup = g;
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

function _isEnemyDroppable(e) {
  if (!e || !e.isAlive || e.dying || e._inHole) return false;
  if (e.y > HAZARD_CONFIG.enemyGroundY) return false;
  const cfg = HAZARD_CONFIG;
  return (e.x >= cfg.holeXMin && e.x <= cfg.holeXMax &&
          e.z >= cfg.holeZMin && e.z <= cfg.holeZMax);
}

function _dropEnemy(e) {
  e._inHole = true;
  e.isAlive = false;     // updateEnemies スキップ → y クランプ無効化
  e.aiEnabled = false;
  e.knockbackVx = 0;
  e.knockbackVz = 0;
  const hb = e.mesh && e.mesh.userData && e.mesh.userData.hpBar;
  if (hb) {
    if (hb.bg) hb.bg.visible = false;
    if (hb.fill) hb.fill.visible = false;
  }
  // 報酬演出：穴の入口で死亡爆発バースト（通常撃破と同じ見せ場）
  _spawnDeathBurst(e.x, e.y + 80, e.z);
  _falling.push({ e, vy: HAZARD_CONFIG.enemyFallVy });
}

function _updateFallingEnemies() {
  if (_falling.length === 0) return;
  const cfg = HAZARD_CONFIG;
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

// 見えない段差：接地中に穴ゾーンへ侵入したら入ってきた方向（X か Z）に押し返す
function _enforceHoleWall(p) {
  if (!p) return;
  const cfg = HAZARD_CONFIG;
  const grounded = p.isGrounded || (p.y <= cfg.playerGroundY);
  if (!grounded) return;
  const inX = p.x > cfg.holeXMin && p.x < cfg.holeXMax;
  const inZ = p.z > cfg.holeZMin && p.z < cfg.holeZMax;
  if (!inX || !inZ) return;

  const dXLeft  = p.x - cfg.holeXMin;
  const dXRight = cfg.holeXMax - p.x;
  const dZNear  = p.z - cfg.holeZMin;
  const dZFar   = cfg.holeZMax - p.z;
  const minX = Math.min(dXLeft, dXRight);
  const minZ = Math.min(dZNear, dZFar);

  if (minX <= minZ) {
    p.x = dXLeft <= dXRight ? cfg.holeXMin : cfg.holeXMax;
    if (p.mesh) p.mesh.position.x = p.x;
  } else {
    p.z = dZNear <= dZFar ? cfg.holeZMin : cfg.holeZMax;
    if (p.mesh) p.mesh.position.z = p.z;
  }
}

function _dropPlayer(p) {
  const cfg = HAZARD_CONFIG;
  p.hp = Math.max(1, p.hp - cfg.playerFallDamage);
  // テレポートしない：落ちた位置で凍結（ダッシュトレイルのストリーク防止）
  p.vy = 0;
  if ('vx' in p) p.vx = 0;
  if ('vz' in p) p.vz = 0;
  if ('kbVx' in p) p.kbVx = 0;
  if ('kbVy' in p) p.kbVy = 0;
  p.dashActive = false;   // トレイル active 条件を切る
  p.airWasDash = false;
  p.state = STATE.wait01;
  p.stateTimer = 0;
  p.invincibleFrames = cfg.playerInvincibleF;
  _playerFrozenX = p.x;
  _playerFrozenY = 0;
  _playerFrozenZ = p.z;
  _playerFallPending = true;
  _playerFallTimer = cfg.playerRespawnDelay;
  _playerRespawnX = cfg.holeXMin - cfg.playerRespawnMargin;
  _playerRespawnZ = p.z;
}

// 待機中は落下位置で凍結 + 非表示。60F 後に穴手前へ移して wait01 で出現。
function _tickPlayerRespawn() {
  if (!_playerFallPending) return;
  const p = _players && _players[0];
  if (p) {
    // 凍結：位置・速度を固定し、ダッシュフラグを切ってトレイルを止める
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
  // リスポーン：穴手前へ移動して出現（トレイル履歴はこの時点で消えている）
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

export function tickFloorHazard() {
  if (typeof window !== 'undefined' && window.SB && !window.SB.STAGE2_HOLE) {
    window.SB.STAGE2_HOLE = HAZARD_CONFIG;
  }
  if (!_built) return;

  // 敵
  if (_enemies) {
    for (const e of _enemies) {
      if (_isEnemyDroppable(e)) _dropEnemy(e);
    }
  }
  _updateFallingEnemies();

  // プレイヤー
  const p = _players && _players[0];
  _tickPlayerRespawn();

  if (p && !_playerFallPending) {
    const cfg = HAZARD_CONFIG;
    const grounded = p.isGrounded || (p.y <= cfg.playerGroundY);
    const inHoleXZ = (p.x > cfg.holeXMin && p.x < cfg.holeXMax &&
                      p.z > cfg.holeZMin && p.z < cfg.holeZMax);

    if (inHoleXZ && !grounded) _playerAirborneOverHole = true;
    if (!inHoleXZ && grounded) _playerAirborneOverHole = false;

    // ジャンプで穴に入って着地 → 落下（無敵中でも発火。再落下ループは
    // _playerAirborneOverHole が穴外リスポーンで false になるため起きない）
    if (_playerAirborneOverHole && grounded && inHoleXZ) {
      _dropPlayer(p);
      _playerAirborneOverHole = false;
    } else {
      _enforceHoleWall(p);
    }
  }
}
