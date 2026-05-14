// ============================================================
//  SCRAP BLITZ — hit-engine（分離 Phase: Step D-2a/b）
//
//  ヒット時の演出系を集約：パーティクル・ヒットストップ・シェイク。
//
//  ES Module として index.html から import される：
//    import {
//      initHitEngine,
//      fxState, particles,
//      triggerHitstop, triggerShake,
//      spawnHitParticles, spawnLaunchSmoke, updateParticles,
//    } from './src/hit-engine.js';
//
//  外部依存（THREE / scene）は initHitEngine(deps) で初期化時にバインド：
//    initHitEngine({ THREE, scene });
//
//  使用側の参照書き換え：
//    旧 hitstopTimer / shakeTimer / shakeStrength / shakeOffsetX / shakeOffsetY（let 個別変数）
//    新 fxState.hitstopTimer / fxState.shakeTimer / ... （オブジェクトプロパティ）
//    → 単一オブジェクトに集約することで ESM 経由でも参照を共有できる
// ============================================================

let _THREE = null;
let _scene = null;

export function initHitEngine(deps) {
  _THREE = deps.THREE;
  _scene = deps.scene;
}

// ============================================================
//  演出グローバル状態（let の代わりに単一オブジェクトに集約）
//  外部からは fxState.hitstopTimer のように直接読み書き可能
// ============================================================
export const fxState = {
  hitstopTimer: 0,
  shakeTimer:   0,
  shakeStrength: 0,
  shakeOffsetX: 0,
  shakeOffsetY: 0,
};

export function triggerHitstop(frames) {
  if (frames > fxState.hitstopTimer) fxState.hitstopTimer = frames;
}

export function triggerShake(strength, frames) {
  if (strength > fxState.shakeStrength) fxState.shakeStrength = strength;
  if (frames > fxState.shakeTimer) fxState.shakeTimer = frames;
}

// ============================================================
//  パーティクル系（ヒット火花・打ち上げ煙）
// ============================================================
export const particles = [];

// opts.type : 'normal'(攻撃方向放射) | 'launch'(Y軸上方) | 'slam'(叩きつけ放射) | 'omni'(全方向・旧来)
// opts.dirX / opts.dirZ : 攻撃方向（normal 時に使用・正規化不要）
export function spawnHitParticles(x, y, z, color = 0xffee44, count = 10, opts = {}) {
  const { type = 'omni', dirX = 1, dirZ = 0 } = opts;
  const geom = new _THREE.BoxGeometry(7, 7, 7);

  // 攻撃方向の正規化と垂直ベクトル（XZ平面）
  const dLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
  const nx = dirX / dLen;
  const nz = dirZ / dLen;
  const perpX = -nz;   // XZ平面での垂直方向
  const perpZ =  nx;

  for (let i = 0; i < count; i++) {
    const mat = new _THREE.MeshBasicMaterial({ color });
    const mesh = new _THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    _scene.add(mesh);

    let vx, vy, vz;
    const r = Math.random;

    if (type === 'normal') {
      // 攻撃方向に前方コーンで放射（前方強め + 左右散らし + 上方向小さめ）
      const fwd = 7 + r() * 9;
      const lat = (r() - 0.5) * 11;
      vx = nx * fwd + perpX * lat;
      vz = nz * fwd + perpZ * lat;
      vy = 0.5 + r() * 3;
    } else if (type === 'launch') {
      // 打ち上げ：Y軸上方向に強く広がる
      vx = (r() - 0.5) * 8;
      vy = 9 + r() * 13;
      vz = (r() - 0.5) * 8;
    } else if (type === 'slam') {
      // 叩きつけ：XZ全方向に放射 + わずかに下方向（地面への叩き落とし感）
      const angle = r() * Math.PI * 2;
      const speed = 5 + r() * 8;
      vx = Math.cos(angle) * speed;
      vz = Math.sin(angle) * speed;
      vy = -(r() * 4);
    } else {
      // omni（全方向・旧来動作）
      vx = (r() - 0.5) * 14;
      vy = 4 + r() * 10;
      vz = (r() - 0.5) * 14;
    }

    particles.push({ mesh, vx, vy, vz, life: 22 + r() * 10 });
  }
}

// 打ち上げヒット時の足元から吹き上がる土煙エフェクト
export function spawnLaunchSmoke(x, y, z) {
  const count = 30;
  for (let i = 0; i < count; i++) {
    const col = Math.random() > 0.5 ? 0xeedd99 : 0xfff4cc; // 土埃・砂煙
    const size = 12 + Math.random() * 10;
    const geom = new _THREE.BoxGeometry(size, size, size);
    const mat  = new _THREE.MeshBasicMaterial({ color: col });
    const mesh = new _THREE.Mesh(geom, mat);
    // 足元から少し散らしてスポーン
    mesh.position.set(
      x + (Math.random() - 0.5) * 50,
      y + Math.random() * 20,
      z + (Math.random() - 0.5) * 25
    );
    _scene.add(mesh);
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 5,
      vy: 12 + Math.random() * 18,  // 強い上方向
      vz: (Math.random() - 0.5) * 5,
      life: 32 + Math.random() * 14,
    });
  }
}

// 毎フレームの粒子更新（位置進行・寿命減・スケール縮小・消滅）
export function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.vy -= 0.7;
    p.life--;
    const lifeRatio = Math.max(0, p.life / 22);
    p.mesh.scale.setScalar(lifeRatio);
    if (p.life <= 0 || p.mesh.position.y < 0) {
      _scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}
