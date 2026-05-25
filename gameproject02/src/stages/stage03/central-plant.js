// Stage 3 中央プラント — プロト第二手
// 仕様：stages/stage03/deep-design.md
//
// 構成：
//   - セクション境界マーカー（プロト第一手・色帯）
//   - D セクション 巨大発光装置（§3.5・青球体+ケーブル）
//   - E セクション ボス台座（§4・円形シャフトリフト）
//
// セクション境界はそれぞれ違う色で「トーン転換」を示唆：
//   A/B (x=800)   : 黄黒（普通の廃工場感）
//   B/C (x=2000)  : 青（SF 転換）
//   C/D (x=3400)  : 黄黒（量産ライン警告）
//   D/E (x=4800)  : 赤（ボス前広場予感）

import { STAGE03_META } from './waves.js';

const BAND_WIDTH  = 20;     // X 方向の厚み
const BAND_HEIGHT = 900;    // Y 方向の高さ
const BAND_Z      = -300;   // 奥（プレイ平面より少し奥）

// D セクション 巨大発光装置（§3.5）
// 2026-05-23 ステージ拡張で D セクションが 5200-6000 に移動したため中央 5600 に合わせる。
const EMITTER_X       = 5600;     // D セクション中央 (5200-6000 の真ん中)
const EMITTER_Y       = 320;      // 中心高さ（少し高めに置いて見せる）
const EMITTER_Z       = -700;     // 奥（プレイ平面 z=0 より大きく奥）
const EMITTER_RADIUS  = 200;
const EMITTER_COLOR   = 0x3399ff; // 青

// E セクション ボス台座（§4・円形シャフトリフト）
// 2026-05-23 ボス spawn が x=6300 になったので台座も同 x へ揃える（ボスが台座上に乗る）。
const PLATFORM_X         = 6300;
const PLATFORM_Z         = 0;
const PLATFORM_DISK_R    = 100;
const PLATFORM_DISK_H    = 20;
const PLATFORM_SHAFT_R   = 30;
const PLATFORM_SHAFT_H   = 200;
const PLATFORM_COLOR     = 0x4a4a55;

// scene 追加済み Object3D を一括管理（dispose で remove）
let _props = [];

function makeBoundaryBand(THREE, x, color) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const geom = new THREE.PlaneGeometry(BAND_WIDTH, BAND_HEIGHT);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, BAND_HEIGHT / 2, BAND_Z);
  return mesh;
}

// D セクション 巨大発光装置（青球体 + ケーブル 4 本）
function makeGiantEmitter(THREE) {
  const group = new THREE.Group();
  group.position.set(EMITTER_X, EMITTER_Y, EMITTER_Z);

  // 球本体（emissive で発光感）
  const sphereMat = new THREE.MeshLambertMaterial({
    color:    EMITTER_COLOR,
    emissive: EMITTER_COLOR,
    emissiveIntensity: 0.95,
  });
  const sphereGeom = new THREE.SphereGeometry(EMITTER_RADIUS, 32, 24);
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  group.add(sphere);

  // 球をうっすら囲むワイヤ外殻（煌めき感の補強・oc-gem.js のパターン参考）
  const shellMat = new THREE.MeshBasicMaterial({
    color: 0x88ccff, wireframe: true, transparent: true, opacity: 0.35,
  });
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(EMITTER_RADIUS + 20, 16, 12),
    shellMat,
  );
  group.add(shell);

  // ケーブル 4 本：球体から地面方向へ放射状に伸ばす（直線で簡略）
  // 中心からの方位角を 4 分割、各方向に下方向 70 度傾けて配置
  const cableMat = new THREE.MeshToonMaterial({ color: 0x333344 });
  const cableLen = EMITTER_Y + EMITTER_RADIUS - 20;   // 地面付近まで届く長さ
  for (let i = 0; i < 4; i++) {
    const azimuth = (i / 4) * Math.PI * 2;
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(4, 4, cableLen, 8),
      cableMat,
    );
    // CylinderGeometry は Y 軸方向 → 下に向けて少し外側へ寝かす
    cable.rotation.z = Math.PI;        // 上下反転（下から始まる感）
    cable.rotation.y = azimuth;
    cable.position.set(
      Math.cos(azimuth) * (EMITTER_RADIUS * 0.7),
      -EMITTER_RADIUS - cableLen / 2 + 40,
      Math.sin(azimuth) * (EMITTER_RADIUS * 0.7) * 0.3,   // 奥行きは控えめ
    );
    group.add(cable);
  }

  return group;
}

// E セクション ボス台座（円形ディスク + シャフト）
function makeBossPlatform(THREE) {
  const group = new THREE.Group();
  group.position.set(PLATFORM_X, 0, PLATFORM_Z);

  const mat = new THREE.MeshToonMaterial({ color: PLATFORM_COLOR });

  // ディスク：高さ中心が y=PLATFORM_DISK_H/2（上面 y=20）
  const disk = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATFORM_DISK_R, PLATFORM_DISK_R, PLATFORM_DISK_H, 32),
    mat,
  );
  disk.position.y = PLATFORM_DISK_H / 2;
  group.add(disk);

  // シャフト：ディスク真下に伸びる（地面下に潜る）
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATFORM_SHAFT_R, PLATFORM_SHAFT_R, PLATFORM_SHAFT_H, 16),
    mat,
  );
  shaft.position.y = -PLATFORM_SHAFT_H / 2;
  group.add(shaft);

  return group;
}

export function addCentralPlant(scene, THREE) {
  if (_props.length > 0) return;

  // セクション境界マーカー
  const colors = STAGE03_META.sectionBoundaryColors;
  STAGE03_META.sectionBoundaries.forEach((x, i) => {
    const m = makeBoundaryBand(THREE, x, colors[i] ?? 0xffffff);
    scene.add(m);
    _props.push(m);
  });

  // D セクション 巨大発光装置
  const emitter = makeGiantEmitter(THREE);
  scene.add(emitter);
  _props.push(emitter);

  // E セクション ボス台座（boss-intro が「せり上がり」アニメに使うため参照を返す）
  const platform = makeBossPlatform(THREE);
  scene.add(platform);
  _props.push(platform);

  return { platformGroup: platform };
}

export function disposeCentralPlant(scene) {
  for (const obj of _props) {
    scene.remove(obj);
    obj.traverse?.(c => {
      if (c.geometry) c.geometry.dispose?.();
      if (c.material) c.material.dispose?.();
    });
  }
  _props = [];
}
