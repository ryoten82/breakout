// Stage 3 Section A — 下りエレベーター降下戦
// 仕様：stages/stage03/deep-design.md 設計論点 §7（2026-05-23 昇格）
//
// 設計方針：
//   - Stage 3 開始時点でプレイヤーはすでにエレベーターに乗っている
//   - Section A は X 進行を持たない閉所アリーナ（lockArena で右端を固定）
//   - 敵は上空から落下スポーン。同時 maxConcurrent 体・撃破ノルマ defeatQuota 体
//   - 1 体倒れる（dying 突入）ごとに上から 1 体補充する波状
//   - 壁面プロップが上方向スクロール＝「降りている」表現
//   - ノルマ達成 → 着床 → release で通常ウェーブ進行（B 段階）解禁
//
// 実装メモ：
//   enemy-system.js は触らない。落下スポーンは spawnDummy（y=0 地上生成）の直後に
//   e.y を高所・e.state を fall_loop に書き換えて実現する。updateEnemies の重力と
//   「fall_loop → 着地で land」遷移がそのまま落下〜着地〜AI 開始を処理してくれる。

import { STATE } from '../../states.js';
import { lockArena, release as releaseLock } from '../stage01/progress-lock.js';

// 調整パラメータ（initElevator で window.SB.STAGE3_ELEVATOR に露出）
const ELEVATOR_CONFIG = {
  defeatQuota: 10,        // 撃破ノルマ（テスト値・自由に変更可）
  maxConcurrent: 4,       // 同時存在上限
  arenaRightX: 720,       // エレベーター室の右端（lockArena）
  spawnXMin: 150,         // 落下スポーン x 範囲（室内）
  spawnXMax: 600,
  spawnZMin: -200,        // 落下スポーン z 範囲（閉所・ベルスク帯±380より内側）
  spawnZMax: 200,
  spawnYHigh: 760,        // 落下開始の高さ
  initialSpawnDelay: 24,  // 戦闘開始から最初の落下までのF
  spawnCooldownMin: 30,   // 補充間隔F（最小）
  spawnCooldownMax: 66,   // 補充間隔F（最大）
  enemyMaxHp: 40,         // 落下敵の HP（tier01 相当）
  wallScrollSpeed: 7,     // 壁面プロップの上スクロール速度
  wallLoopHeight: 360,    // 壁プロップ 1 セグメントの縦間隔
  landingFrames: 100,     // 着床演出の長さ
  // 金網フロア：Section A（x=0-800）の床。右端 800 で通常床へ切り替わり
  // 「エレベーターが終わった」ことを伝える。戦闘終了後も残す静的な床。
  floorXMin: -60,         // 左壁の裏まで覆って隙間を出さない
  floorXMax: 800,         // Section A/B 境界。ここで通常床へ
  floorZMin: -380,        // 奥（エレベーター奥壁付近）
  floorZMax: 720,         // 手前（カメラ側）
  floorGridCell: 64,      // 金網マス目の 1 辺
};

let _scene = null;
let _THREE = null;
let _spawnDummy = null;
let _enemies = null;
let _players = null;

let _phase = 'idle';        // 'idle' | 'running' | 'landing' | 'done'
let _elevatorEnemies = [];  // この戦闘でスポーンした敵 ref
let _spawnedCount = 0;
let _spawnCooldown = 0;
let _landingTimer = 0;

let _wallGroup = null;
let _wallProps = [];        // 上スクロールするプロップ mesh 群
let _hudEl = null;
let _built = false;

let _floorGroup = null;     // 金網フロア（戦闘終了後も残す静的な床）
let _floorBuilt = false;

function _rand(lo, hi) { return lo + Math.random() * (hi - lo); }

export function initElevator(deps) {
  _scene = deps.scene;
  _THREE = deps.THREE;
  _spawnDummy = deps.spawnDummy;
  _enemies = deps.enemies;
  _players = deps.players;

  _phase = 'running';
  _elevatorEnemies = [];
  _spawnedCount = 0;
  _spawnCooldown = ELEVATOR_CONFIG.initialSpawnDelay;
  _landingTimer = 0;

  // 閉所アリーナ：右端を Section A 内に固定（左端は Stage 3 の static 左壁 x=0）
  lockArena(ELEVATOR_CONFIG.arenaRightX);

  if (_scene && _THREE && !_built) {
    _buildElevatorWalls();
    _built = true;
  }
  if (_scene && _THREE && !_floorBuilt) {
    _buildElevatorFloor();
    _floorBuilt = true;
  }
  _showHud();

  if (typeof window !== 'undefined' && window.SB) {
    window.SB.STAGE3_ELEVATOR = ELEVATOR_CONFIG;
  }
}

// エレベーター戦中なら true（stage03 ランナーが通常ウェーブ進行を抑制する判定用）
export function isElevatorActive() {
  return _phase !== 'idle' && _phase !== 'done';
}

// 壁面プロップ：奥壁パネル＋縦配管＋警告灯。プロップ群を上スクロールさせて降下表現
function _buildElevatorWalls() {
  const cfg = ELEVATOR_CONFIG;
  const g = new _THREE.Group();
  const wallZ = -360;

  // 奥壁パネル（静止・暗い金属）
  const panel = new _THREE.Mesh(
    new _THREE.BoxGeometry(cfg.arenaRightX + 240, 1100, 20),
    new _THREE.MeshToonMaterial({ color: 0x283038 })
  );
  panel.position.set(cfg.arenaRightX / 2, 420, wallZ - 14);
  g.add(panel);

  // スクロールするプロップ（縦配管 + 警告灯）
  const props = [];
  const colCount = 5;
  for (let i = 0; i < colCount; i++) {
    const px = 70 + i * ((cfg.arenaRightX - 40) / (colCount - 1));
    // 縦配管 4 セグメント（縦に連なってループスクロール）
    for (let seg = 0; seg < 4; seg++) {
      const pipe = new _THREE.Mesh(
        new _THREE.BoxGeometry(16, cfg.wallLoopHeight * 0.55, 16),
        new _THREE.MeshToonMaterial({ color: 0x49545f })
      );
      pipe.position.set(px, seg * cfg.wallLoopHeight + 80, wallZ);
      g.add(pipe);
      props.push({ mesh: pipe });
    }
    // 警告灯（黄・unlit で発光感）
    const lamp = new _THREE.Mesh(
      new _THREE.BoxGeometry(24, 24, 24),
      new _THREE.MeshBasicMaterial({ color: 0xffcc33 })
    );
    lamp.position.set(px, i * 110 + 80, wallZ + 10);
    g.add(lamp);
    props.push({ mesh: lamp });
  }
  _scene.add(g);
  _wallGroup = g;
  _wallProps = props;
}

function _scrollWalls(speed) {
  const loopTop = 940;
  const loopH = ELEVATOR_CONFIG.wallLoopHeight * 4;
  for (const p of _wallProps) {
    p.mesh.position.y += speed;
    if (p.mesh.position.y > loopTop) p.mesh.position.y -= loopH;
  }
}

function _removeWalls() {
  if (_wallGroup && _wallGroup.parent) _scene.remove(_wallGroup);
  _wallGroup = null;
  _wallProps = [];
  _built = false;
}

// 金網フロア：Section A の床を industrial steel grating で覆う。
// 右端（floorXMax=800）で途切れ、その先は index.html の通常床が見える。
// → 金網から通常床へ踏み出すことで「エレベーターを出た」を伝える。
// 戦闘終了後も残す静的な床なので _removeWalls では消さない。
function _buildElevatorFloor() {
  const cfg = ELEVATOR_CONFIG;
  const g = new _THREE.Group();
  const x0 = cfg.floorXMin, x1 = cfg.floorXMax;
  const z0 = cfg.floorZMin, z1 = cfg.floorZMax;
  const w = x1 - x0, d = z1 - z0;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

  // 暗い基盤：金網の下の空隙（エレベーターシャフトの闇）
  const base = new _THREE.Mesh(
    new _THREE.PlaneGeometry(w, d),
    new _THREE.MeshBasicMaterial({ color: 0x12161c })
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(cx, 1, cz);
  g.add(base);

  // 金網グリッド：縦横の線分で steel grating のマス目を描く
  const cell = cfg.floorGridCell;
  const gy = 2.5;
  const verts = [];
  for (let x = x0; x <= x1 + 0.1; x += cell) {
    verts.push(x, gy, z0,  x, gy, z1);
  }
  for (let z = z0; z <= z1 + 0.1; z += cell) {
    verts.push(x0, gy, z,  x1, gy, z);
  }
  const geom = new _THREE.BufferGeometry();
  geom.setAttribute('position', new _THREE.BufferAttribute(new Float32Array(verts), 3));
  const grid = new _THREE.LineSegments(
    geom,
    new _THREE.LineBasicMaterial({ color: 0x8b97a4 })
  );
  g.add(grid);

  // 右端のしきい（エレベーター車の戸口の沓摺）：金網の終端をくっきり示す金属バー
  const sill = new _THREE.Mesh(
    new _THREE.BoxGeometry(16, 12, d),
    new _THREE.MeshToonMaterial({ color: 0x6b7884 })
  );
  sill.position.set(x1, 6, cz);
  g.add(sill);

  _scene.add(g);
  _floorGroup = g;
}

// 敵を 1 体、上空から落下スポーンする
function _spawnFallingEnemy() {
  const cfg = ELEVATOR_CONFIG;
  const x = _rand(cfg.spawnXMin, cfg.spawnXMax);
  const z = _rand(cfg.spawnZMin, cfg.spawnZMax);
  const e = _spawnDummy(x, z, {
    maxHp: cfg.enemyMaxHp,
    instantRespawn: false,
    _stageEnemyType: 'tier01',
  });
  // 上空へ：updateEnemies の重力が落とし、fall_loop は着地で land に遷移する
  e.y = cfg.spawnYHigh;
  e.vy = 0;
  e.state = STATE.fall_loop;
  if (e.mesh) e.mesh.position.y = e.y;  // 初フレームの地上チラ見え防止
  _elevatorEnemies.push(e);
  _spawnedCount++;
}

// 撃破カウント集計：dying 突入で「撃破」とみなす（補充を間延びさせない）
function _countEnemies() {
  let defeated = 0;
  let concurrent = 0;
  for (const e of _elevatorEnemies) {
    if (!e || e.removed || e.isAlive === false) {
      defeated++;
    } else if (e.dying) {
      defeated++;
      concurrent++;  // 爆散演出中はまだ画面にいる
    } else {
      concurrent++;
    }
  }
  return { defeated, concurrent };
}

function tickElevator() {
  // window.SB はステージ init より後に構築されるため、tick 側でも露出を保証する
  if (typeof window !== 'undefined' && window.SB && !window.SB.STAGE3_ELEVATOR) {
    window.SB.STAGE3_ELEVATOR = ELEVATOR_CONFIG;
  }
  if (_phase === 'idle' || _phase === 'done') return;
  const cfg = ELEVATOR_CONFIG;
  const { defeated, concurrent } = _countEnemies();

  if (_phase === 'running') {
    // 補充：同時数が上限未満かつノルマ分まだ湧かせていなければ落下スポーン
    if (_spawnedCount < cfg.defeatQuota && concurrent < cfg.maxConcurrent) {
      if (_spawnCooldown > 0) {
        _spawnCooldown--;
      } else {
        _spawnFallingEnemy();
        _spawnCooldown = Math.round(_rand(cfg.spawnCooldownMin, cfg.spawnCooldownMax));
      }
    }
    _updateHud(`ELEVATOR  ${Math.min(defeated, cfg.defeatQuota)} / ${cfg.defeatQuota}`);
    // ノルマ達成 → 着床フェーズ
    if (defeated >= cfg.defeatQuota) {
      _phase = 'landing';
      _landingTimer = cfg.landingFrames;
      _updateHud('LANDED');
    }
    _scrollWalls(cfg.wallScrollSpeed);
  } else if (_phase === 'landing') {
    // 着床：壁スクロールを減速させて停止
    const t = Math.max(0, _landingTimer / cfg.landingFrames);
    _scrollWalls(cfg.wallScrollSpeed * t);
    _landingTimer--;
    if (_landingTimer <= 0) {
      _phase = 'done';
      releaseLock();       // アリーナ解除 → B 段階へ進行可能に
      _hideHud();
      _removeWalls();
    }
  }
}

// ============================================================
//  撃破カウント HUD（画面上・中央）
// ============================================================
function _ensureHud() {
  if (_hudEl) return _hudEl;
  const el = document.createElement('div');
  el.id = 'elevator-hud';
  el.style.cssText = [
    'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)',
    'color:#fff', 'font-family:var(--font-pixel)', 'font-weight:bold',
    'font-size:18px', 'letter-spacing:0.15em', 'padding:6px 14px',
    'background:rgba(0,0,0,0.6)',
    'border:1px solid rgba(120,180,255,0.7)',
    'text-shadow:0 0 6px rgba(120,180,255,0.8)',
    'pointer-events:none', 'z-index:9000', 'display:none',
  ].join(';');
  document.body.appendChild(el);
  _hudEl = el;
  return el;
}

function _showHud() { _ensureHud().style.display = 'block'; }
function _hideHud() { _ensureHud().style.display = 'none'; }
function _updateHud(text) { _ensureHud().textContent = text; }

export function getElevatorDebugState() {
  const { defeated, concurrent } = _countEnemies();
  return {
    phase: _phase,
    spawnedCount: _spawnedCount,
    defeated,
    concurrent,
    quota: ELEVATOR_CONFIG.defeatQuota,
  };
}

export { tickElevator };
