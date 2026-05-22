// Stage 2 後半 — 地面穴ギミック
// 仕様：stage-layout-room.md「Act 1 / Stage 2」地面穴ギミック小節（2026-05-23 昇格）
//
// 設計方針：
//   - 攻撃ギミック寄り (a)：穴は「敵を叩き込む武器」。プレイヤー落下は事故枠
//   - 敵の落とし導線＝中間案：敵 AI は穴を避けず・自分から落ちもしない。
//     被弾系 state（プレイヤーのノックバック/打ち上げで運ばれた敵）が穴ゾーンに
//     接地したときだけ落下排除する。wait01 / enemy_attacking の敵は落とさない
//   - 固定穴のみ（ひび割れ床は見送り）
//   - 穴底に Stage 3 D 段階の巨大発光装置と同種の抽象発光（青）を予兆として置く
//
// 実装メモ：
//   enemy-system.js は触らない。穴落ち敵は e.isAlive=false にすると updateEnemies が
//   完全スキップ（y の地面クランプも止まる）。その後の落下演出は本モジュールが mesh を
//   直接動かし、despawn 深度で e.removed=true → enemy-system の cleanup pass が配列除去。
//   ステージのウェーブ全滅判定は isAlive===false を「死」とみなすため、穴落ち＝撃破扱い。

import { STATE } from '../../states.js';

// 調整パラメータ（initFloorHazard で window.SB.STAGE2_HOLE に露出）
const HAZARD_CONFIG = {
  // 穴ゾーン（Stage 2 ワールド x=0..4000 の後半）
  holeXMin: 2900,
  holeXMax: 3300,
  // z 帯はベルスク帯 ±380 より内側に絞る → 奥/手前に「脇を通る」余地を残す
  holeZMin: -220,
  holeZMax: 220,
  // 敵：この y 以下を「接地」とみなす（空中通過中は落とさない）
  enemyGroundY: 14,
  // 敵の穴落ち演出
  enemyFallVy: -6,        // 落下初速
  enemyFallGrav: 0.55,    // 落下加速
  enemyDespawnY: -700,    // この深さで mesh 除去 + removed
  // プレイヤーの穴落ち（事故枠・即死させない）
  playerFallDamage: 12,
  playerInvincibleF: 70,  // 落下後の無敵F
  playerRespawnMargin: 160, // 穴左端からどれだけ手前に戻すか
};

let _scene = null;
let _THREE = null;
let _enemies = null;
let _players = null;
let _spawnHitParticles = null;  // deps にあれば演出に使う（無ければ省略）

let _holeGroup = null;
let _falling = [];   // 穴落下中の敵：{ e, vy }
let _built = false;

export function initFloorHazard(deps) {
  _scene = deps.scene;
  _THREE = deps.THREE;
  _enemies = deps.enemies;
  _players = deps.players;
  _spawnHitParticles = deps.spawnHitParticles || null;
  _falling = [];
  if (_scene && _THREE && !_built) {
    _buildHoleVisual();
    _built = true;
  }
  if (typeof window !== 'undefined' && window.SB) {
    window.SB.STAGE2_HOLE = HAZARD_CONFIG;
  }
}

// 穴の見た目：縁取り（黄）→ 黒穴 → 穴底の抽象発光（青）の 3 層を床のすぐ上に重ねる。
// 床は index.html の単一 plane なので物理的にはくり抜かない（2.5D の書割表現）。
function _buildHoleVisual() {
  const cfg = HAZARD_CONFIG;
  const cx = (cfg.holeXMin + cfg.holeXMax) / 2;
  const cz = (cfg.holeZMin + cfg.holeZMax) / 2;
  const w = cfg.holeXMax - cfg.holeXMin;
  const d = cfg.holeZMax - cfg.holeZMin;
  const g = new _THREE.Group();

  // 縁取り（警告色・一回り大きい黄平面）
  const rim = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w + 90, d + 90),
    new _THREE.MeshBasicMaterial({ color: 0xd9a521 })
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(cx, 2, cz);
  g.add(rim);

  // 穴本体（黒平面）
  const hole = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w, d),
    new _THREE.MeshBasicMaterial({ color: 0x05050a })
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(cx, 4, cz);
  g.add(hole);

  // 穴底の抽象発光（Stage 3 D 段階の巨大発光装置と同種の「何か分からない青い光」の予兆）
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

// 敵が「穴に落とされた」とみなせるか：被弾系 state で穴ゾーンに接地している
function _isEnemyDroppable(e) {
  if (!e || !e.isAlive || e.dying || e._inHole) return false;
  // wait01 / enemy_attacking は「自分の意思で立っている」→ 落とさない（中間案）
  if (e.state === STATE.wait01 || e.state === STATE.enemy_attacking) return false;
  if (e.y > HAZARD_CONFIG.enemyGroundY) return false;  // 空中通過中は対象外
  const cfg = HAZARD_CONFIG;
  return (e.x >= cfg.holeXMin && e.x <= cfg.holeXMax &&
          e.z >= cfg.holeZMin && e.z <= cfg.holeZMax);
}

function _dropEnemy(e) {
  e._inHole = true;
  e.isAlive = false;     // updateEnemies が以降スキップ → y クランプ無効化
  e.aiEnabled = false;
  e.knockbackVx = 0;
  e.knockbackVz = 0;
  // HP バーを隠す（updateEnemies が同期を止めるため宙に残らないように）
  const hb = e.mesh && e.mesh.userData && e.mesh.userData.hpBar;
  if (hb) {
    if (hb.bg) hb.bg.visible = false;
    if (hb.fill) hb.fill.visible = false;
  }
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
      e.removed = true;  // enemy-system の cleanup pass が enemies から splice
      continue;
    }
    rest.push(f);
  }
  _falling = rest;
}

function _isPlayerInHole(p) {
  if (!p) return false;
  const grounded = p.isGrounded || (p.y <= 12);
  if (!grounded) return false;  // ジャンプ中は穴の上を越えられる
  const cfg = HAZARD_CONFIG;
  return (p.x >= cfg.holeXMin && p.x <= cfg.holeXMax &&
          p.z >= cfg.holeZMin && p.z <= cfg.holeZMax);
}

function _dropPlayer(p) {
  const cfg = HAZARD_CONFIG;
  // ダメージ（事故枠・即死はさせない）
  p.hp = Math.max(1, p.hp - cfg.playerFallDamage);
  // 穴の手前（進行方向の手前＝左）へ戻す
  p.x = cfg.holeXMin - cfg.playerRespawnMargin;
  p.y = 0;
  p.vy = 0;
  if ('kbVx' in p) p.kbVx = 0;
  if ('kbVy' in p) p.kbVy = 0;
  p.state = STATE.wait01;
  p.stateTimer = 0;
  p.invincibleFrames = cfg.playerInvincibleF;
  if (p.mesh) p.mesh.position.set(p.x, p.y, p.z);
  if (_spawnHitParticles) {
    _spawnHitParticles(p.x, p.y + 60, p.z, 0xff7744, 16, { type: 'omni' });
  }
}

export function tickFloorHazard() {
  // window.SB はステージ init より後に構築されるため、tick 側でも露出を保証する
  if (typeof window !== 'undefined' && window.SB && !window.SB.STAGE2_HOLE) {
    window.SB.STAGE2_HOLE = HAZARD_CONFIG;
  }
  if (!_built) return;
  // 敵：穴ゾーンに被弾系で接地したものを落下開始
  if (_enemies) {
    for (const e of _enemies) {
      if (_isEnemyDroppable(e)) _dropEnemy(e);
    }
  }
  _updateFallingEnemies();
  // プレイヤー：穴ゾーンに接地で踏み込んだら落下処理
  const p = _players && _players[0];
  if (p && _isPlayerInHole(p)) _dropPlayer(p);
}
