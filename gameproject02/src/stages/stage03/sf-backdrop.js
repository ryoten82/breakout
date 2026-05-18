// Stage 3 SF 背景骨格 — 既存柱組（廃工場感）を Stage 3 用 SF 調に差し替え
// 仕様：stages/stage03/deep-design.md 「SF 色のヤバい何か」テイスト
//
// MVP として：
//   - 既存 backWallPillars / bgElements を非表示
//   - 背面パネル（暗青系・全長カバー）
//   - 縦柱（細め・SF らしくシンプル）
//   - 青 LED 縦ストリップ（柱に貼り付け・発光感）
//
// 別タスクで追加予定：
//   - C セクションに六角パネル壁
//   - 配線・チューブの絡まり
//   - 通路ハッチ・グレーチング

import { STAGE03_META } from './waves.js';

let _backdropGroup = null;
let _hiddenRefs = [];
let _savedGroundMat = null;
let _savedGroundRef = null;

const Z_BACK = -380;
const PANEL_H = 600;
const PILLAR_GAP = 400;

// =================================================================
// Stage 3 SF 床テクスチャ
// =================================================================
function makeStage03FloorCanvas() {
  const W = 512, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // ベース：暗青系
  ctx.fillStyle = '#1c2030';
  ctx.fillRect(0, 0, W, H);

  // メタリックノイズ（青寄り）
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1 + 0.3;
    const v = 32 + Math.random() * 20;
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 8})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // ↘ パネル目地（stage1/2 と同じ進行方向パース）
  const numD = 6;
  const dSpace = W / numD;
  for (let i = -numD; i <= numD * 2; i++) {
    const xStart = i * dSpace;
    ctx.strokeStyle = 'rgba(75,95,130,0.55)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(xStart, 0);
    ctx.lineTo(xStart + H, H);
    ctx.stroke();
    // 影
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(xStart + 1.5, 0);
    ctx.lineTo(xStart + 1.5 + H, H);
    ctx.stroke();
  }

  // 青 LED ドット散布（SF アクティブパネル感）
  for (let i = 0; i < 14; i++) {
    const cx = Math.random() * W;
    const cy = Math.random() * H;
    const r = 2 + Math.random() * 2;
    // ハロー
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3.5);
    halo.addColorStop(0,   'rgba(80,180,255,0.45)');
    halo.addColorStop(1,   'rgba(80,180,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 3.5, 0, Math.PI * 2); ctx.fill();
    // コア
    ctx.fillStyle = 'rgba(120,200,255,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // 横線（奥行き感の補助・薄め）
  const numH = 12;
  for (let i = 1; i <= numH; i++) {
    const t = i / numH;
    const y = H * (1 - Math.pow(1 - t, 2.4));
    ctx.strokeStyle = 'rgba(55,75,105,0.22)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // 空気遠近法：奥（上端）に青ヘイズ
  const haze = ctx.createLinearGradient(0, H, 0, 0);
  haze.addColorStop(0.00, 'rgba(40,80,120,0.00)');
  haze.addColorStop(0.55, 'rgba(50,100,140,0.20)');
  haze.addColorStop(1.00, 'rgba(70,140,180,0.42)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  return c;
}

function makeStage03FloorTexture(THREE) {
  const tex = new THREE.CanvasTexture(makeStage03FloorCanvas());
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(8, 1);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function swapToStage03Floor(THREE, ground) {
  if (!ground) return;
  _savedGroundRef = ground;
  _savedGroundMat = ground.material;
  ground.material = new THREE.MeshToonMaterial({
    map: makeStage03FloorTexture(THREE),
    color: 0x7a8aa0,  // やや寒色寄り（SF 系金属感）
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
}

function restoreGround() {
  if (_savedGroundRef && _savedGroundMat) {
    _savedGroundRef.material = _savedGroundMat;
  }
  _savedGroundRef = null;
  _savedGroundMat = null;
}

function buildBackdrop(scene, THREE) {
  const group = new THREE.Group();

  // 暗青系の素材
  const panelMat  = new THREE.MeshToonMaterial({ color: 0x1c2030 });  // 背面パネル（最奥）
  const accentMat = new THREE.MeshToonMaterial({ color: 0x2a3245 });  // 柱本体
  const glowMat   = new THREE.MeshBasicMaterial({ color: 0x4499ff }); // 青 LED
  const stripMat  = new THREE.MeshToonMaterial({ color: 0x3a4055 });  // 横ストリップ

  // 背面パネル：全長カバー
  const xMin = STAGE03_META.worldXMin - 100;
  const xMax = STAGE03_META.worldXMax + 100;
  const xMid = (xMin + xMax) / 2;
  const xLen = xMax - xMin;

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(xLen, PANEL_H, 20),
    panelMat,
  );
  panel.position.set(xMid, PANEL_H / 2, Z_BACK - 25);
  group.add(panel);

  // 横ストリップ（パネル上の梁感・上・中・下に 3 本）
  for (const by of [PANEL_H - 30, PANEL_H * 0.55, 30]) {
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(xLen, 24, 24),
      stripMat,
    );
    beam.position.set(xMid, by, Z_BACK - 10);
    group.add(beam);
  }

  // 縦柱（200wu 太め × PILLAR_GAP 間隔・SF らしくフラット）
  for (let x = xMin; x <= xMax; x += PILLAR_GAP) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(40, PANEL_H, 30),
      accentMat,
    );
    pillar.position.set(x, PANEL_H / 2, Z_BACK);
    group.add(pillar);

    // 青 LED 縦ストリップ（柱の手前側に貼り付け・SF 感の主役）
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(6, PANEL_H * 0.7, 4),
      glowMat,
    );
    led.position.set(x, PANEL_H * 0.5, Z_BACK + 18);
    group.add(led);
  }

  scene.add(group);
  return group;
}

export function addSfBackdrop(deps) {
  const { scene, THREE, backWallPillars, bgElements, ground } = deps;
  if (_backdropGroup) return;

  // 既存 廃工場柱組・奥の柱ネオン を非表示（Stage 3 では使わない）
  for (const ref of [backWallPillars, bgElements]) {
    if (ref && ref.visible !== undefined) {
      _hiddenRefs.push({ obj: ref, was: ref.visible });
      ref.visible = false;
    }
  }

  // 床も Stage 3 SF 用に差し替え
  swapToStage03Floor(THREE, ground);

  _backdropGroup = buildBackdrop(scene, THREE);
}

export function disposeSfBackdrop(scene) {
  if (_backdropGroup) {
    scene.remove(_backdropGroup);
    _backdropGroup = null;
  }
  for (const r of _hiddenRefs) {
    r.obj.visible = r.was;
  }
  _hiddenRefs = [];
  restoreGround();
}
