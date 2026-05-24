// OVERCLOCK ジェム
//
// OC コンテナを破壊すると出現する紫の宝石。
// フロー：湧き上がり（rising）→ その場で一定時間ホバー滞在（idle）
//        → onAcquire コールバック（画面フラッシュ + OC 選択へ）→ 縮んで消滅（acquired）。
//
// 取得判定は無し（触れても拾えない）。滞在時間経過で自動的に取得扱いになる。

let _scene = null;
let _THREE = null;
let _onAcquire = null;
let _getPlayers = null;
let _gem = null;   // 同時に 1 個のみ。{ mesh, core, shell, phase, timer }

const RISE_FRAMES  = 24;    // 出現：下から湧き上がる
const DWELL_FRAMES = 100;   // 滞在：その場でホバー（約 1.7 秒）
const SHRINK_FRAMES = 10;   // 取得後：縮んで消える
const SPAWN_Y      = 50;    // 湧き出し開始の高さ
const HOVER_Y      = 300;   // ホバー中心の高さ（プレイヤー頭上）

export function initOcGem({ scene, THREE, onAcquire, getPlayers }) {
  _scene = scene;
  _THREE = THREE;
  _onAcquire = onAcquire || null;
  _getPlayers = getPlayers || null;
}

export function isOcGemActive() { return _gem !== null; }

// OC コンテナ破壊位置に宝石を出現させる
export function spawnOcGem(x, z) {
  if (!_scene || !_THREE || _gem) return;   // 既に居るなら無視
  const THREE = _THREE;
  const group = new THREE.Group();

  // 内側コア：発光する八面体
  const coreMat = new THREE.MeshLambertMaterial({
    color: 0xaa44ff, emissive: 0x9933ee, emissiveIntensity: 0.95,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(46), coreMat);
  group.add(core);

  // 外殻：一回り大きいワイヤフレーム（逆回転で煌めき）
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0xddaaff, wireframe: true, transparent: true, opacity: 0.6,
  });
  const shell = new THREE.Mesh(new THREE.OctahedronGeometry(66), shellMat);
  group.add(shell);

  group.position.set(x, SPAWN_Y, z);
  group.scale.setScalar(0.3);
  _scene.add(group);
  _gem = { mesh: group, core, shell, phase: 'rising', timer: 0 };
}

export function updateOcGem() {
  if (!_gem) return;
  const g = _gem;
  g.timer++;

  // 常時回転（コアと外殻を逆回し）
  g.core.rotation.y  += 0.05;
  g.core.rotation.x  += 0.02;
  g.shell.rotation.y -= 0.035;
  g.shell.rotation.x += 0.025;

  if (g.phase === 'rising') {
    const t = Math.min(1, g.timer / RISE_FRAMES);
    const ease = 1 - (1 - t) * (1 - t);   // ease-out
    g.mesh.position.y = SPAWN_Y + (HOVER_Y - SPAWN_Y) * ease;
    g.mesh.scale.setScalar(0.3 + 0.7 * ease);
    if (t >= 1) { g.phase = 'idle'; g.timer = 0; }

  } else if (g.phase === 'idle') {
    // プレイヤーに向けて引き寄せ（画面外に置き去り防止）
    if (_getPlayers) {
      const players = _getPlayers();
      if (players && players.length > 0) {
        // 最初の生存プレイヤーを対象
        const p = players.find(pl => pl.hp > 0) ?? players[0];
        const dx = p.x - g.mesh.position.x;
        const dz = (p.z ?? 0) - g.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 8) {
          // 近いほど遅く・遠いほど速く（max 18 wu/f）
          const speed = Math.min(dist * 0.10, 18);
          g.mesh.position.x += (dx / dist) * speed;
          g.mesh.position.z += (dz / dist) * speed;
        }
      }
    }
    // ゆったり上下にホバー
    g.mesh.position.y = HOVER_Y + Math.sin(g.timer * 0.08) * 10;
    if (g.timer >= DWELL_FRAMES) {
      g.phase = 'acquired';
      g.timer = 0;
      if (_onAcquire) _onAcquire();
    }

  } else if (g.phase === 'acquired') {
    // 取得演出：素早く縮みながら上昇 → 消滅
    const t = Math.min(1, g.timer / SHRINK_FRAMES);
    g.mesh.scale.setScalar(Math.max(0.01, 1 - t));
    g.mesh.position.y += 6;
    if (t >= 1) _removeGem();
  }
}

function _removeGem() {
  if (!_gem) return;
  _scene.remove(_gem.mesh);
  _gem.mesh.traverse(c => {
    if (c.geometry) c.geometry.dispose?.();
    if (c.material) c.material.dispose?.();
  });
  _gem = null;
}
