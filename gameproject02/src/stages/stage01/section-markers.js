// Stage 1 — セクション境界マーカー（警告色テープ）
// 仕様：stages/stage01/layout.md §54
//   セクション境界に視覚マーカーを足す：警告色テープ（黄黒ストライプ）の
//   縦バンドを x=1200 と x=3000 に細い Mesh で 1 枚ずつ。
//
// 嘘パース廃工場テーマ準拠（visual_doctrine 参照）：黄黒の警告色は柱組と同系統。
// 床から空中まで届く縦バンド。プレイヤー進路上に立つので Z 位置はステージ奥寄りに置いて
// プレイ操作の邪魔をしない（あくまで装飾）。

import { STAGE01_META } from './waves.js';

const BAND_WIDTH  = 16;     // X 方向の厚み（細い）
const BAND_HEIGHT = 900;    // 縦の長さ
const BAND_Z      = -300;   // 奥行き：プレイ平面より少し奥
const STRIPE_SIZE = 64;     // ストライプ 1 本の幅（px 想定）

let _markers = [];

// 黄黒の斜めストライプテクスチャを Canvas で生成
function makeWarningTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = STRIPE_SIZE;
  c.height = STRIPE_SIZE;
  const ctx = c.getContext('2d');
  // 背景：黄
  ctx.fillStyle = '#f5c518';
  ctx.fillRect(0, 0, STRIPE_SIZE, STRIPE_SIZE);
  // 黒の斜め帯
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(STRIPE_SIZE / 2, 0);
  ctx.lineTo(0, STRIPE_SIZE / 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(STRIPE_SIZE, STRIPE_SIZE / 2);
  ctx.lineTo(STRIPE_SIZE, STRIPE_SIZE);
  ctx.lineTo(STRIPE_SIZE / 2, STRIPE_SIZE);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // 縦方向に繰り返す（縦バンドなので Y 方向に多めに）
  tex.repeat.set(0.5, BAND_HEIGHT / STRIPE_SIZE / 4);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function makeBand(THREE, x, texture) {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const geom = new THREE.PlaneGeometry(BAND_WIDTH, BAND_HEIGHT);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, BAND_HEIGHT / 2, BAND_Z);
  return mesh;
}

export function addSectionMarkers(scene, THREE) {
  if (_markers.length > 0) return;  // 二重生成防止
  const tex = makeWarningTexture(THREE);
  for (const x of STAGE01_META.sectionBoundaries) {
    const mesh = makeBand(THREE, x, tex);
    scene.add(mesh);
    _markers.push(mesh);
  }
}
