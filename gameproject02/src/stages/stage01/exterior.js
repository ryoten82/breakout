// Stage 1 外周ヤード — 書割 5 層ビルダー（プロト第一手）
// 仕様：stages/stage01/exterior-design.md（書割多層構成）
//
// 5 層構成（既存 2 カメラ構造を活用）：
//   1. 空（晴天グラデ）          — bgCamera layer 1 / z=-3500
//   2. 遠景山岳                  — bgCamera layer 1 / z=-2500
//   3. 工場群シルエット（2 列）  — bgCamera layer 1 / z=-1500, -1300
//   4. 中景プロップ              — main camera layer 0 / z=-800 〜 -500
//   5. プレイ平面＋路面装飾      — 既存ベルスク帯流用（本ファイルでは触らない）
//
// 起動：`window.STAGE01_EXTERIOR = true` でオプトイン（デフォルト OFF）
// 既存装飾の扱い：
//   - buildBackWallPillars()（内部柱組・z=-380）は非表示
//   - buildBackgroundElements()（奥の柱ネオン）も非表示
//   - 既存地面はそのまま使用（プロト第一手では再スキンしない）
//
// スケール：1 wu ≒ 0.12 m（20m メカ基準）。値は仮・実装中に調整可。

import { STAGE01_META } from './waves.js';

let _builtGroups = [];
let _hiddenRefs = [];
let _savedGroundMat = null;
let _savedGroundRef = null;

// =================================================================
// 0. 地面（貨物用滑走路）— 既存 ground のマテリアル差し替え
// =================================================================
function makeRunwayCanvas() {
  const W = 512, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // ベース：低彩度・やや寒色寄りのアスファルト（Stage 2 内部床の温色とハッキリ差別化）
  ctx.fillStyle = '#34363a';
  ctx.fillRect(0, 0, W, H);

  // アスファルトの粒（寒色寄りのニュートラルグレー）
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const r = Math.random() * 1.2 + 0.3;
    const v = 50 + Math.random() * 22;
    ctx.fillStyle = `rgb(${v},${v + 1},${v + 4})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // === 斜め平行線（パース方向：進行方向 → に合う ↘ に変更 2026-05-18）===
  // 45° / W=H で seamless タイリング。アスファルトの目地っぽくする
  const numD = 6;
  const dSpace = W / numD;
  for (let i = -numD; i <= numD * 2; i++) {
    const xStart = i * dSpace;
    ctx.strokeStyle = 'rgba(70,75,82,0.40)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(xStart, 0);
    ctx.lineTo(xStart + H, H);
    ctx.stroke();
    // 影
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(xStart + 1.5, 0);
    ctx.lineTo(xStart + 1.5 + H, H);
    ctx.stroke();
  }

  // === 滑走路サイドライン（実線・寒色寄り白）===
  ctx.strokeStyle = 'rgba(200,205,210,0.72)';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(0, H * 0.16); ctx.lineTo(W, H * 0.16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H * 0.84); ctx.lineTo(W, H * 0.84); ctx.stroke();

  // === センター破線（白・走行方向・寒色寄り）===
  ctx.strokeStyle = 'rgba(215,220,225,0.85)';
  ctx.lineWidth = 6;
  ctx.setLineDash([46, 32]);
  ctx.beginPath();
  ctx.moveTo(0, H * 0.50);
  ctx.lineTo(W, H * 0.50);
  ctx.stroke();
  ctx.setLineDash([]);

  // === 黄色テキシーウェイライン（彩度をかなり抑え・くすんだ黄）===
  ctx.strokeStyle = 'rgba(160,150,90,0.40)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, H * 0.10); ctx.lineTo(W, H * 0.10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H * 0.90); ctx.lineTo(W, H * 0.90); ctx.stroke();

  // === タイヤスキッド（黒短線×6・廃滑走路の名残）===
  for (let i = 0; i < 6; i++) {
    const y = H * (0.28 + Math.random() * 0.44);
    const xLen = 90 + Math.random() * 160;
    const xStart = Math.random() * (W - xLen);
    const sg = ctx.createLinearGradient(xStart, y, xStart + xLen, y);
    sg.addColorStop(0,   'rgba(0,0,0,0)');
    sg.addColorStop(0.5, 'rgba(8,8,10,0.48)');
    sg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(xStart, y - 1.5, xLen, 3);
  }

  // === 油染み（控えめ・ニュートラル）===
  for (let i = 0; i < 4; i++) {
    const cx = Math.random() * W;
    const cy = Math.random() * H * 0.85 + H * 0.15;
    const r = 22 + Math.random() * 40;
    const og = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    og.addColorStop(0,   'rgba(6,8,10,0.50)');
    og.addColorStop(0.7, 'rgba(10,12,14,0.18)');
    og.addColorStop(1,   'rgba(10,12,14,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // === ヒビ・剥げ（寒色寄りのニュートラルグレー・彩度低）===
  for (let i = 0; i < 10; i++) {
    const cx = Math.random() * W;
    const cy = Math.random() * H;
    const r = 4 + Math.random() * 10;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0,   'rgba(90,92,96,0.32)');
    rg.addColorStop(1,   'rgba(90,92,96,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  // === 奥行きの空気遠近法：奥（テクスチャ上端）を青みがかったヘイズで覆う ===
  //   テクスチャ y=0 が奥（プレイヤーから遠い）、y=H が手前。
  //   下から上に向けて青み＆明度を上げて空気感を出す。
  //   既存の「奥ほど暗く」グラデは廃止して、代わりにヘイズで遠近感を作る。
  const haze = ctx.createLinearGradient(0, H, 0, 0);
  haze.addColorStop(0.00, 'rgba(60,90,120,0.00)');
  haze.addColorStop(0.45, 'rgba(70,100,135,0.10)');
  haze.addColorStop(0.80, 'rgba(85,120,155,0.28)');
  haze.addColorStop(1.00, 'rgba(110,145,175,0.45)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  return c;
}

function makeRunwayTexture(THREE) {
  const tex = new THREE.CanvasTexture(makeRunwayCanvas());
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(8, 1);  // 既存と同じ横タイリング数
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function swapToRunwayGround(THREE, ground) {
  if (!ground) return;
  _savedGroundRef = ground;
  _savedGroundMat = ground.material;
  ground.material = new THREE.MeshToonMaterial({
    map: makeRunwayTexture(THREE),
    color: 0x9a9ea4,  // アスファルト寒色寄り灰（彩度低・Stage 2 温色床と差別化）
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

// =================================================================
// 1. 空（晴天グラデ）
// =================================================================
function makeSkyGradientCanvas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.00, '#4ca8e0');  // 天頂：深い青
  g.addColorStop(0.55, '#a8d4ec');  // 中間：明るい青
  g.addColorStop(1.00, '#e8eee0');  // 地平線：白っぽい
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}

function buildSky(THREE) {
  const tex = new THREE.CanvasTexture(makeSkyGradientCanvas());
  const mat = new THREE.MeshBasicMaterial({ map: tex, depthWrite: false });
  // bgCamera (FOV 5°、下向き俯瞰) の視野に合わせて配置
  // z=-3500 で世界 y ≈ -300 〜 +80 が画面 0%(下)〜100%(上) に映る
  // 空は画面上半分を占めたいので y center ≈ -100、高さ 800（範囲 -500..+300）
  const geom = new THREE.PlaneGeometry(16000, 800);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(0, -100, -3500);
  mesh.layers.set(1);
  mesh.renderOrder = -100;
  return mesh;
}

// =================================================================
// 2. 遠景山岳
// =================================================================
function buildMountains(THREE) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x9a6648, depthWrite: false });

  // bgCamera at z=-2500：世界 y -580〜+163 が画面に映る
  // 山岳は画面の中段に出したいので base y = -300、peaks y ≈ +100 前後（高さ 350-500）
  const BASE_Y = -300;
  const mountains = [
    { x: -3200, w: 1500, h: 380 },
    { x: -1200, w: 1300, h: 460 },
    { x:  1200, w: 1400, h: 400 },
    { x:  3300, w: 1100, h: 340 },
  ];

  for (const m of mountains) {
    const shape = new THREE.Shape();
    shape.moveTo(-m.w / 2, 0);
    shape.lineTo(-m.w / 4, m.h * 0.55);
    shape.lineTo(-m.w / 8, m.h * 0.85);
    shape.lineTo(0, m.h);
    shape.lineTo(m.w / 5, m.h * 0.75);
    shape.lineTo(m.w / 3, m.h * 0.60);
    shape.lineTo(m.w / 2, 0);
    shape.closePath();
    const geom = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(m.x, BASE_Y, -2500);
    mesh.layers.set(1);
    mesh.renderOrder = -50;
    group.add(mesh);
  }
  return group;
}

// =================================================================
// 3. 工場群シルエット（前後 2 列で軽い視差）
// =================================================================
function buildFactorySilhouetteRow(THREE, z, color, baseY) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, depthWrite: false });

  // bgCamera at z=-1300：世界 y ≈ -480〜+264 が画面に映る
  // bgCamera at z=-1500：世界 y ≈ -497〜+247 が画面に映る
  // 建屋本体は画面中段に：base y ≈ -250（baseY 引数）、高さ 280-400
  const items = [
    { x: -2800, w:  900, h: 320, stack: true,  stackH: 480 },
    { x: -1500, w:  600, h: 260 },
    { x:  -300, w: 1000, h: 400, stack: true,  stackH: 540 },
    { x:  1100, w:  700, h: 280, stack: true,  stackH: 400 },
    { x:  2400, w:  800, h: 300 },
    { x:  3500, w:  900, h: 360, stack: true,  stackH: 480 },
  ];

  for (const it of items) {
    // 本体（base y から立ち上げる）
    const body = new THREE.Mesh(new THREE.BoxGeometry(it.w, it.h, 30), mat);
    body.position.set(it.x, baseY + it.h / 2, z);
    body.layers.set(1);
    group.add(body);
    // 煙突
    if (it.stack) {
      const stackH = it.stackH;
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(45, 65, stackH, 8),
        mat,
      );
      stack.position.set(it.x + it.w / 3, baseY + stackH / 2, z + 5);
      stack.layers.set(1);
      group.add(stack);
    }
  }
  return group;
}

function buildFactorySilhouettes(THREE) {
  const group = new THREE.Group();
  group.add(buildFactorySilhouetteRow(THREE, -1500, 0x3a4150, -250));  // 奥：濃い
  group.add(buildFactorySilhouetteRow(THREE, -1300, 0x4a5260, -230));  // 手前：少し明るい
  return group;
}

// =================================================================
// 共通プロップ：奥行きを持った建物前面壁（再利用想定）
// =================================================================
// 進行方向の終点に置くと「建物の前面 + 側面が奥に伸びる」パース表現になる。
// ベルスクの基本背景プロップとして他ステージでも流用想定。
//
// opts:
//   x           : 前面壁の X 位置（同じ X に levelWalls 右壁を別途登録すること）
//   yawRad      : Y 軸回転角（rad）。床パース ↘ と整合させるなら正の値で建物全体を CCW 回転
//   height      : 壁の高さ（wu）
//   zHalf       : 前面壁が Z 方向に伸びる半幅（プレイ帯 ±380 を覆う）
//   gateW       : 中央のゲート開口の Z 幅
//   gateH       : ゲート開口の高さ
//   sideDepth   : 側面壁が X 方向（手前 → 奥）に伸びる長さ
//   frontColor  : 前面壁色
//   sideColor   : 側面壁色（陰側なので少し暗く）
//   darkInside  : ゲート奥の暗がり色
//
// 構造ルール：children は **local 座標**（前面壁は x=0）で配置し、最後に group.position.x = x。
// これで yawRad による回転が group の原点（前面壁中心）周りで効く。
export function buildBuildingFrontWall(THREE, opts = {}) {
  const {
    x = 4000,
    yawRad = 0,
    height = 360,
    zHalf = 400,
    gateW = 280,
    gateH = 240,
    sideDepth = 700,
    frontColor = 0x2a2c30,
    sideColor = 0x1a1c20,
    darkInside = 0x050608,
  } = opts;

  const group = new THREE.Group();
  const frontMat = new THREE.MeshToonMaterial({ color: frontColor });
  const sideMat = new THREE.MeshToonMaterial({ color: sideColor });
  const darkMat = new THREE.MeshBasicMaterial({ color: darkInside });
  const T = 30;  // 壁の厚み

  // 前面壁・上部梁（ゲート開口の上）— local x=0
  const beamH = height - gateH;
  if (beamH > 0) {
    const topBeam = new THREE.Mesh(
      new THREE.BoxGeometry(T, beamH, gateW + 40),
      frontMat,
    );
    topBeam.position.set(0, gateH + beamH / 2, 0);
    group.add(topBeam);
  }

  // 前面壁・左右（ゲート開口の両脇）
  const sideZW = zHalf * 2 - gateW;
  if (sideZW > 0) {
    const wWidth = sideZW / 2;
    const leftSide = new THREE.Mesh(
      new THREE.BoxGeometry(T, height, wWidth + 20),
      frontMat,
    );
    leftSide.position.set(0, height / 2, -(gateW / 2 + wWidth / 2));
    group.add(leftSide);
    const rightSide = new THREE.Mesh(
      new THREE.BoxGeometry(T, height, wWidth + 20),
      frontMat,
    );
    rightSide.position.set(0, height / 2, gateW / 2 + wWidth / 2);
    group.add(rightSide);
  }

  // ゲート奥の暗がり（奥が見える演出）
  const dark = new THREE.Mesh(
    new THREE.PlaneGeometry(gateW, gateH),
    darkMat,
  );
  dark.position.set(-T / 2 - 1, gateH / 2, 0);
  dark.rotation.y = Math.PI / 2;
  group.add(dark);

  // 側面壁（手前と奥の Z 両側に・local +X 方向に伸びる）
  // カメラ -22° 俯瞰でこれが「奥行きへ消えていく壁」として映る
  // 前面壁と Z-fighting しないよう、local X 開始を T/2 オフセット
  const sideStartX = T / 2;
  const sideCenterX = sideStartX + sideDepth / 2;

  const sidePanelFar = new THREE.Mesh(
    new THREE.BoxGeometry(sideDepth, height, T),
    sideMat,
  );
  sidePanelFar.position.set(sideCenterX, height / 2, zHalf);
  group.add(sidePanelFar);

  const sidePanelNear = new THREE.Mesh(
    new THREE.BoxGeometry(sideDepth, height, T),
    sideMat,
  );
  sidePanelNear.position.set(sideCenterX, height / 2, -zHalf);
  group.add(sidePanelNear);

  // 屋根（建物のフタ・上方からも壁感を出す）
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(sideDepth + T, T, zHalf * 2 + T),
    sideMat,
  );
  roof.position.set(sideCenterX - T / 2, height + T / 2, 0);
  group.add(roof);

  group.position.set(x, 0, 0);
  group.rotation.y = yawRad;
  return group;
}

// =================================================================
// 共通プロップ（2D 版）：建物前面壁（書割・単一 Plane で全部描く）
// =================================================================
// SOR4 風の「2D 書割でパース込み」アプローチ。
// 壁全体を ↘ 方向に傾いた平行四辺形として描き、内部に目地・ゲートを配置。
// 床のパース ↘ と整合し「奥に伸びていく壁」の錯覚を作る。
function makeBuildingFront2DCanvas() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // 壁全体の平行四辺形 4 頂点（canvas をフルに使う・↘ パース）
  //   canvas 左 → 画面左、canvas 右 → 画面右
  //   上辺・下辺ともに ↘（左→右で下がる）→ 床パースと整合
  //   左辺・右辺ともに canvas 高さの 60% を占める（高さの主役は壁本体）
  const wall = {
    topL: { x: W * 0.00, y: H * 0.00 },
    topR: { x: W * 1.00, y: H * 0.40 },
    btmR: { x: W * 1.00, y: H * 1.00 },
    btmL: { x: W * 0.00, y: H * 0.60 },
  };

  // 平行四辺形内部の (s, t) ∈ [0,1]^2 を canvas 座標に変換
  // s=0 → 左端（手前）, s=1 → 右端（奥）
  // t=0 → 下端, t=1 → 上端
  function lerpInWall(s, t) {
    const xb = wall.btmL.x + (wall.btmR.x - wall.btmL.x) * s;
    const yb = wall.btmL.y + (wall.btmR.y - wall.btmL.y) * s;
    const xt = wall.topL.x + (wall.topR.x - wall.topL.x) * s;
    const yt = wall.topL.y + (wall.topR.y - wall.topL.y) * s;
    return { x: xb + (xt - xb) * t, y: yb + (yt - yb) * t };
  }

  // === 壁本体（コンクリ色）===
  ctx.fillStyle = '#2c2e32';
  ctx.beginPath();
  ctx.moveTo(wall.topL.x, wall.topL.y);
  ctx.lineTo(wall.topR.x, wall.topR.y);
  ctx.lineTo(wall.btmR.x, wall.btmR.y);
  ctx.lineTo(wall.btmL.x, wall.btmL.y);
  ctx.closePath();
  ctx.fill();

  // === 横目地（パース方向と整合）===
  ctx.strokeStyle = 'rgba(50,52,58,0.55)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    const pL = lerpInWall(0, t);
    const pR = lerpInWall(1, t);
    ctx.beginPath();
    ctx.moveTo(pL.x, pL.y);
    ctx.lineTo(pR.x, pR.y);
    ctx.stroke();
  }

  // === 縦目地（パネル分割線）===
  ctx.strokeStyle = 'rgba(45,48,55,0.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const s = i / 6;
    const pT = lerpInWall(s, 1);
    const pB = lerpInWall(s, 0);
    ctx.beginPath();
    ctx.moveTo(pT.x, pT.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();
  }

  // === ゲート（閉じシャッター・level 終端側 = canvas 右寄り）===
  // 壁が level 全体に渡る幅広 plane なので、canvas 右側 ≒ level 右端 ≒ end of level
  const gateSMin = 0.80, gateSMax = 0.92;  // canvas 右寄り（level 終端付近）
  const gateTMin = 0.05, gateTMax = 0.65;  // 下から 5%〜65%
  const gBL = lerpInWall(gateSMin, gateTMin);
  const gBR = lerpInWall(gateSMax, gateTMin);
  const gTL = lerpInWall(gateSMin, gateTMax);
  const gTR = lerpInWall(gateSMax, gateTMax);

  // シャッター本体
  ctx.fillStyle = '#1a1c20';
  ctx.beginPath();
  ctx.moveTo(gBL.x, gBL.y);
  ctx.lineTo(gBR.x, gBR.y);
  ctx.lineTo(gTR.x, gTR.y);
  ctx.lineTo(gTL.x, gTL.y);
  ctx.closePath();
  ctx.fill();

  // シャッターのスリット（横方向）
  ctx.strokeStyle = 'rgba(8,10,12,0.85)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const tInWall = gateTMin + (gateTMax - gateTMin) * t;
    const sL = lerpInWall(gateSMin, tInWall);
    const sR = lerpInWall(gateSMax, tInWall);
    ctx.beginPath();
    ctx.moveTo(sL.x, sL.y);
    ctx.lineTo(sR.x, sR.y);
    ctx.stroke();
  }

  // ゲート枠（金属）
  ctx.strokeStyle = '#4a4c52';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(gBL.x, gBL.y);
  ctx.lineTo(gBR.x, gBR.y);
  ctx.lineTo(gTR.x, gTR.y);
  ctx.lineTo(gTL.x, gTL.y);
  ctx.closePath();
  ctx.stroke();

  // 警告色テープ（ゲート上）
  const tapeBL = lerpInWall(gateSMin, gateTMax + 0.02);
  const tapeBR = lerpInWall(gateSMax, gateTMax + 0.02);
  const tapeTL = lerpInWall(gateSMin, gateTMax + 0.08);
  const tapeTR = lerpInWall(gateSMax, gateTMax + 0.08);
  ctx.save();
  ctx.globalAlpha = 0.75;
  const tapeSteps = 10;
  for (let i = 0; i < tapeSteps; i++) {
    const sStart = i / tapeSteps;
    const sEnd   = (i + 1) / tapeSteps;
    const tInB1 = lerpInWall(gateSMin + (gateSMax - gateSMin) * sStart, gateTMax + 0.02);
    const tInB2 = lerpInWall(gateSMin + (gateSMax - gateSMin) * sEnd,   gateTMax + 0.02);
    const tInT1 = lerpInWall(gateSMin + (gateSMax - gateSMin) * sStart, gateTMax + 0.08);
    const tInT2 = lerpInWall(gateSMin + (gateSMax - gateSMin) * sEnd,   gateTMax + 0.08);
    ctx.fillStyle = (i % 2 === 0) ? '#c89028' : '#1a1a1a';
    ctx.beginPath();
    ctx.moveTo(tInB1.x, tInB1.y);
    ctx.lineTo(tInB2.x, tInB2.y);
    ctx.lineTo(tInT2.x, tInT2.y);
    ctx.lineTo(tInT1.x, tInT1.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // === 壁の輪郭線（くっきりさせる）===
  ctx.strokeStyle = 'rgba(70,72,78,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wall.topL.x, wall.topL.y);
  ctx.lineTo(wall.topR.x, wall.topR.y);
  ctx.lineTo(wall.btmR.x, wall.btmR.y);
  ctx.lineTo(wall.btmL.x, wall.btmL.y);
  ctx.closePath();
  ctx.stroke();

  return c;
}

export function buildBuildingWall2D(THREE, opts = {}) {
  const {
    x = 4050,          // 画面 X：plane の中心 X
    z = -200,          // プレイ平面（z=0）より少し奥に置いて自然な depth 順に
    width = 1000,      // 画面 X 方向の見かけ幅（plane 標準向き）
    height = 300,      // Y 方向の高さ
    yCenter = 150,     // ground (y=0) から立ち上がるよう center=height/2
  } = opts;

  const tex = new THREE.CanvasTexture(makeBuildingFront2DCanvas());
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  // 注意：plane の rotation は無し（default normal +Z = camera を向く）
  //   かつて rotation.y=-π/2 にしていたが、main camera view direction が (0,-0.371,-0.928) で X 成分ゼロ
  //   のため plane normal (-X) と直角＝edge-on で 0 幅レンダリングになって完全に消えていた
  //   背景書割は BackWallPillars と同じく素直に +Z 向きで配置するのが正解
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.1,
    side: THREE.DoubleSide,
  });
  const geom = new THREE.PlaneGeometry(width, height);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, yCenter, z);
  return mesh;
}

// =================================================================
// 4. 中景プロップ（球状タンク・蒸留塔・配管・巨大車両用入り口）
// =================================================================
function buildMidgroundProps(THREE) {
  const group = new THREE.Group();
  const tankMat  = new THREE.MeshToonMaterial({ color: 0xb8b0a0 });
  const towerMat = new THREE.MeshToonMaterial({ color: 0x9a8878 });
  const pipeMat  = new THREE.MeshToonMaterial({ color: 0x665544 });

  // 注意：main camera (ortho) は CAM_Y=400 / CAM_Z=1000 / LOOK_Y=0 で約 -22° 俯瞰。
  // local_Y = 0.928 y_p - 0.371 z_p、可視範囲 ±350。
  // 奥（z<0）にあるほど画面上方に映るため、サイズや y_center を抑える必要あり。

  // 球状タンク × 2（半径 60wu ≒ 14m）— サイズ縮小 + Z 奥送り
  // Z 配置の方針：タンクは「パイプより手前」に配置（パイプが貫通して見えないように）
  // 注意：main camera は ortho なので Z を奥にしてもサイズは変わらない（geometry で調整）
  const TANK_R = 60;
  const tankPositions = [
    { x:  900, y:  20, z: -650 },
    { x: 2700, y:  20, z: -630 },
  ];
  for (const p of tankPositions) {
    const tank = new THREE.Mesh(new THREE.SphereGeometry(TANK_R, 18, 14), tankMat);
    tank.position.set(p.x, p.y, p.z);
    group.add(tank);
    // 4 本足（タンクの下に伸ばす）
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(12, 60, 12), pipeMat);
      leg.position.set(p.x + Math.cos(a) * 45, p.y - 60, p.z + Math.sin(a) * 45);
      group.add(leg);
    }
  }

  // 蒸留塔（高さ 200wu ≒ 24m）— サイズ縮小 + Z 奥送り
  const TOWER_H = 200;
  const TOWER_Z = -680;
  const TOWER_BASE_Y = -100;
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, TOWER_H, 14),
    towerMat,
  );
  tower.position.set(1900, TOWER_BASE_Y + TOWER_H / 2, TOWER_Z);
  group.add(tower);
  const towerCap = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 26, 16, 14),
    towerMat,
  );
  towerCap.position.set(1900, TOWER_BASE_Y + TOWER_H + 8, TOWER_Z);
  group.add(towerCap);

  // 横方向の主配管（さらに奥）— タンク（z=-650/-630）より奥配置
  const pipe1 = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 2000, 10),
    pipeMat,
  );
  pipe1.rotation.z = Math.PI / 2;
  pipe1.position.set(1500, 40, -780);
  group.add(pipe1);

  const pipe2 = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 1500, 10),
    pipeMat,
  );
  pipe2.rotation.z = Math.PI / 2;
  pipe2.position.set(2200, -30, -760);
  group.add(pipe2);

  // 建物前面壁（2D 書割）は Three.js プロトでは深追いしない方針
  //   2026-05-19：パース整合・depth・サイズの 3 つを同時に satisfy するのが難しく、試行錯誤で
  //   コンテキスト溶けるので一旦撤去。SOR4 風の本格パース壁・入口表現は UE 移行後に実装。
  //   背景の絵作りは既存工場群シルエット（layer 1 bgCamera）で代用。
  //   Three.js で再挑戦するなら memory `project_scrapblitz_act_scale_aesthetic.md` の
  //   「Three.js 段階の壁・入口表現の代替案」セクション参照。
  // const buildingWall = buildBuildingWall2D(THREE, { ... });
  // group.add(buildingWall);

  return group;
}

// =================================================================
// 公開 API
// =================================================================
export function initExterior(deps) {
  const { scene, THREE, backWallPillars, bgElements, ground } = deps;

  // 既存装飾を非表示にする（外周ヤード時は内部用装飾を見せない）
  for (const ref of [backWallPillars, bgElements]) {
    if (ref && ref.visible !== undefined) {
      _hiddenRefs.push({ obj: ref, was: ref.visible });
      ref.visible = false;
    }
  }

  // 地面を貨物用滑走路に差し替え
  swapToRunwayGround(THREE, ground);

  // 5 層を順番に組み立て・シーンに追加
  const sky = buildSky(THREE);
  scene.add(sky);
  _builtGroups.push(sky);

  const mountains = buildMountains(THREE);
  scene.add(mountains);
  _builtGroups.push(mountains);

  const factories = buildFactorySilhouettes(THREE);
  scene.add(factories);
  _builtGroups.push(factories);

  const midground = buildMidgroundProps(THREE);
  scene.add(midground);
  _builtGroups.push(midground);
}

// プロト調整用：シーンから外して既存装飾を戻す
export function disposeExterior(scene) {
  for (const g of _builtGroups) {
    scene.remove(g);
  }
  _builtGroups = [];
  for (const r of _hiddenRefs) {
    r.obj.visible = r.was;
  }
  _hiddenRefs = [];
  restoreGround();
}

// デバッグ用：構築したグループへの参照を返す
export function getExteriorGroups() {
  return _builtGroups.slice();
}
