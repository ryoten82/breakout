// ボステスト部屋（id: bossTest）
// boss01（CRUSHER）の挙動確認専用ステージ。stage3 ボス戦想定の広さ。
//   - 床 + 固定壁（±ARENA_HALF_X）でカメラ追従壁を上書き
//   - プレイヤーとボスのみ配置。コンテナ・地雷なし
//   - 死亡時は即リスポーン（ボステスト目的のため演出は途中まで）
//
// 仕様：chars/boss01.md / 議論：discussions/boss01-stage1-design.md

import { levelWalls } from '../../camera.js';

// アリーナ幅：stage3 ボス区画（section E ≒ 1000wu）を想定しつつ、
// DOUBLE RUSH TACKLE（dashMaxDist=1600wu）で画面端往復が見える広さに。
const ARENA_HALF_X = 1000;   // 半幅・全幅 2000wu
const BOSS_SPAWN_X = 600;    // ボス初期位置（プレイヤー初期 ≒ -500 を想定）
const BOSS_SPAWN_Z = 150;    // 中央〜やや奥
const BOSS_MAX_HP  = 1800;   // BOSS01_CONFIG.MAX_HP 想定（仮値）

let _built = false;
let _spawnDummy = null;
let _enemies = null;

function _spawnBoss() {
  if (!_spawnDummy) return;
  _spawnDummy(BOSS_SPAWN_X, BOSS_SPAWN_Z, {
    enemyType:    'boss01',
    maxHp:        BOSS_MAX_HP,
    personality:  'berserker',
    atkCooldown:  120,
    instantRespawn: false,  // ボスは死亡演出を最後まで見せる
  });
}

function _buildRoom(scene, THREE) {
  // 仮床（やや暗めの工業色・action-test と差別化）
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2 + 400, 2600),
    new THREE.MeshLambertMaterial({ color: 0x3a2d2a }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.5, 100);
  floor.receiveShadow = true;
  scene.add(floor);

  // 仮の奥壁
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF_X * 2 + 400, 1800),
    new THREE.MeshLambertMaterial({ color: 0x251c1a }),
  );
  wall.position.set(0, 900, -650);
  scene.add(wall);

  // 左右の壁マーカー（境界の視認用・低めの目印立方体）
  const wallMat = new THREE.MeshBasicMaterial({ color: 0x664444 });
  for (const sx of [-ARENA_HALF_X, ARENA_HALF_X]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(20, 200, 600), wallMat);
    m.position.set(sx, 100, 100);
    scene.add(m);
  }
}

function _hide(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) obj.forEach(o => { if (o) o.visible = false; });
  else obj.visible = false;
}

export function initBossTest(deps) {
  const { scene, THREE, spawnDummy, enemies, ground, backWallPillars, bgElements } = deps;
  if (!scene || !THREE) return;
  _enemies = enemies;
  // 固定の広い壁でカメラ追従壁を上書き
  levelWalls.length = 0;
  levelWalls.push({ side: 'left',  x: -ARENA_HALF_X });
  levelWalls.push({ side: 'right', x:  ARENA_HALF_X });
  // 通常ステージの背景要素を隠す
  _hide(ground);
  _hide(backWallPillars);
  _hide(bgElements);
  _buildRoom(scene, THREE);
  if (spawnDummy) {
    _spawnDummy = spawnDummy;
    _spawnBoss();
  }
  _built = true;
}

export function tickBossTest() {
  // ボス死亡時の即リスポーン
  if (!_spawnDummy || !_enemies) return;
  const alive = _enemies.some(e =>
    (e.enemyType === 'boss01') && e.isAlive && !e.dying && !e.removed);
  if (!alive) _spawnBoss();
}

export function getBossTestDebugState() {
  const boss = _enemies?.find(e => e.enemyType === 'boss01');
  return {
    stage: 'bossTest',
    built: _built,
    bossHp:    boss?.hp ?? null,
    bossMaxHp: boss?.maxHp ?? null,
    bossPhase: boss?.bossPhase ?? null,
  };
}
