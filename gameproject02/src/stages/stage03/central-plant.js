// Stage 3 中央プラント — 最小ビジュアル（プロト第一手）
// 仕様：stages/stage03/deep-design.md
//
// MVP として「セクション境界マーカー」だけ実装。
// 量産ライン・巨大球体・ボス台座・ボス intro 演出は別タスクで段階追加。
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

let _markers = [];

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

export function addCentralPlant(scene, THREE) {
  if (_markers.length > 0) return;
  const colors = STAGE03_META.sectionBoundaryColors;
  STAGE03_META.sectionBoundaries.forEach((x, i) => {
    const m = makeBoundaryBand(THREE, x, colors[i] ?? 0xffffff);
    scene.add(m);
    _markers.push(m);
  });
}

export function disposeCentralPlant(scene) {
  for (const m of _markers) scene.remove(m);
  _markers = [];
}
