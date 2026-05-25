// ============================================================
//  SCRAP BLITZ — RC HUD（スパイダーセンス／アーカム式 危機察知 UI）
//
//  自機追従の輪っかをワールド空間に出し、RC チャンス中だけ表示する。
//    - 黄色のベースリング（常時 / 表示中ずっと）
//    - 赤い弧：軸方向の中心から両側に角度を伸ばす成長アニメ
//    - 最大伸長時に先端が白フラッシュ → 攻撃ヒット直前のキュー
//
//  方向：repulseAxis に応じて中心角を変える
//    - aerial  : 真上（90°）
//    - ground  : 真下（270°）
//    - frontal : player.facing 方向（右=0° / 左=180°）
//
//  進度 t は敵の `_jdAimTimer` / 元の aimFrames から逆算（残 1 → 残 0）。
//  t=0：弧長 0（黄色だけ）／ t=1：弧長 MAX_ARC + 先端フラッシュ。
//
//  音ゲー的：プレイヤーは先端フラッシュ瞬間に SP2 を押せば RC 成立。
// ============================================================

import { ENEMY_ATTACKS } from './config.js';

let _THREE = null;
let _scene = null;
let _players = null;
let _enemies = null;

// ベース（黄色）リング
let _baseRing = null;
// グレー下敷き弧（全長）
let _arcGuide = null;
// 赤弧 mesh × 2：両端から中心に向かって伸びる演出のため左右別 mesh
//   geometry は thetaStart / thetaLength を動的に変えるため都度作り替え
let _arcLeftMesh  = null;
let _arcRightMesh = null;
let _arcLeftMat   = null;
let _arcRightMat  = null;
// 中心フラッシュ用の球（両端が中心で合流した瞬間に光る）
let _tipFlash = null;

// 表示パラメータ
const RING_RADIUS    = 90;    // 黄色リング半径
const RING_TUBE      = 4;     // 黄色リング太さ
const RING_Y_OFFSET  = 90;    // プレイヤー中心からの Y オフセット（胴体高さ）
// 赤弧は黄リングより外側に離す（前投稿の参考画像準拠）
const ARC_INNER      = 108;
const ARC_OUTER      = 124;
const ARC_MAX_LENGTH = Math.PI * 0.6;   // 弧の最大角（≈108°）
const TIP_FLASH_T    = 0.92;            // この t 以上で中心フラッシュ
const TIP_FLASH_SCALE_MAX = 18;
const COLOR_BASE  = 0xffaa11;
const COLOR_ARC   = 0xff2222;
const COLOR_GUIDE = 0x553030;   // グレーアウトした赤（下敷き）
const COLOR_TIP   = 0xffffff;

export function initRcHud(deps) {
  _THREE   = deps.THREE;
  _scene   = deps.scene;
  _players = deps.players;
  _enemies = deps.enemies;
  if (!_THREE || !_scene) return;
  // ベース黄色リング
  const baseGeom = new _THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 10, 64);
  const baseMat  = new _THREE.MeshBasicMaterial({
    color: COLOR_BASE, transparent: true, opacity: 0.85,
    depthTest: false, depthWrite: false,
  });
  _baseRing = new _THREE.Mesh(baseGeom, baseMat);
  _baseRing.visible = false;
  _baseRing.renderOrder = 9500;
  _scene.add(_baseRing);
  // グレー下敷き弧（全長を最初から見せ、赤弧の最終形状を予告）
  const guideMat = new _THREE.MeshBasicMaterial({
    color: COLOR_GUIDE, transparent: true, opacity: 0.55,
    depthTest: false, depthWrite: false, side: _THREE.DoubleSide,
  });
  _arcGuide = new _THREE.Mesh(new _THREE.RingGeometry(ARC_INNER, ARC_OUTER, 48, 1, 0, ARC_MAX_LENGTH), guideMat);
  _arcGuide.visible = false;
  _arcGuide.renderOrder = 9500;
  _scene.add(_arcGuide);
  // 赤弧 ×2（左端から内向き / 右端から内向き）
  _arcLeftMat = new _THREE.MeshBasicMaterial({
    color: COLOR_ARC, transparent: true, opacity: 0.95,
    depthTest: false, depthWrite: false, side: _THREE.DoubleSide,
  });
  _arcRightMat = new _THREE.MeshBasicMaterial({
    color: COLOR_ARC, transparent: true, opacity: 0.95,
    depthTest: false, depthWrite: false, side: _THREE.DoubleSide,
  });
  _arcLeftMesh  = new _THREE.Mesh(new _THREE.RingGeometry(ARC_INNER, ARC_OUTER, 24, 1, 0, 0.001), _arcLeftMat);
  _arcRightMesh = new _THREE.Mesh(new _THREE.RingGeometry(ARC_INNER, ARC_OUTER, 24, 1, 0, 0.001), _arcRightMat);
  _arcLeftMesh.visible  = false;
  _arcRightMesh.visible = false;
  _arcLeftMesh.renderOrder  = 9501;
  _arcRightMesh.renderOrder = 9501;
  _scene.add(_arcLeftMesh);
  _scene.add(_arcRightMesh);
  // 先端フラッシュ用 sphere
  const tipGeom = new _THREE.SphereGeometry(1, 12, 8);
  const tipMat  = new _THREE.MeshBasicMaterial({
    color: COLOR_TIP, transparent: true, opacity: 0,
    depthTest: false, depthWrite: false,
  });
  _tipFlash = new _THREE.Mesh(tipGeom, tipMat);
  _tipFlash.visible = false;
  _tipFlash.renderOrder = 9502;
  _scene.add(_tipFlash);
}

// 軸 → 中心角（リング座標：Three.js の RingGeometry は X+ 軸から反時計回りに theta 増加）
//   90° = 上 / 270° = 下 / 0° = 右 / 180° = 左
function _axisToCenterAngle(axis, facing) {
  if (axis === 'aerial')  return Math.PI / 2;
  if (axis === 'ground')  return -Math.PI / 2;
  if (axis === 'frontal') return (facing > 0) ? 0 : Math.PI;
  return Math.PI / 2;  // フォールバック上
}

export function updateRcHud() {
  if (!_baseRing || !_players || !_enemies) return;
  const p = _players[0];
  if (!p) { _baseRing.visible = false; _arcMesh.visible = false; _tipFlash.visible = false; return; }

  // RC 受付中の最寄り敵を探す
  let bestE = null;
  let bestAtk = null;
  let bestDistSq = Infinity;
  for (const e of _enemies) {
    if (!e || !e.isAlive || e.dying) continue;
    if (!e.repulseWindow) continue;
    const atk = e.curAtkId && ENEMY_ATTACKS[e.curAtkId];
    if (!atk || !atk.repulseAxis) continue;
    const dx = e.x - p.x, dz = e.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDistSq) { bestDistSq = d2; bestE = e; bestAtk = atk; }
  }

  if (!bestE) {
    _baseRing.visible    = false;
    _arcGuide.visible    = false;
    _arcLeftMesh.visible = false;
    _arcRightMesh.visible = false;
    _tipFlash.visible    = false;
    return;
  }

  // 位置：プレイヤー追従（胴体高さ）
  const rx = p.x;
  const ry = p.y + RING_Y_OFFSET;
  const rz = p.z;
  _baseRing.position.set(rx, ry, rz);
  _baseRing.visible = true;

  // 進度 t：bestE._jdAimTimer / bestAtk.aimFrames の進行度（残 1 → 残 0）
  //   dive grace 期間に入ってもインジケータは「最大伸長 + 先端フラッシュ」のまま維持
  const aimMax = bestAtk.aimFrames ?? 80;
  const aimLeft = bestE._jdAimTimer ?? 0;
  let t;
  if (bestE._jdPhase === 'aim') {
    t = 1 - Math.max(0, Math.min(1, aimLeft / aimMax));
  } else {
    // dive grace 等：t=1 固定（先端フラッシュ継続）
    t = 1;
  }

  // 方向の中心角
  const centerAngle = _axisToCenterAngle(bestAtk.repulseAxis, p.facing || 1);

  // 弧の全体配置：両端から中心へ収束させる
  //   全長 ARC_MAX_LENGTH の範囲 [leftEdge, rightEdge] を確保（中心 = centerAngle）
  //   左端から内向き / 右端から内向き に半長 t 分ずつ伸びる → t=1 で中央で合流
  const half = ARC_MAX_LENGTH / 2;
  const leftEdge  = centerAngle - half;   // 左端（小さい角度）
  const rightEdge = centerAngle + half;   // 右端（大きい角度）
  const fill      = half * t;             // 各端から内向きに進む量

  // 下敷きグレー：常時全長表示で「どこまで赤が伸びるか」を予告
  _arcGuide.position.set(rx, ry, rz);
  _arcGuide.visible = true;
  if (_arcGuide.geometry) _arcGuide.geometry.dispose();
  _arcGuide.geometry = new _THREE.RingGeometry(ARC_INNER, ARC_OUTER, 48, 1, leftEdge, ARC_MAX_LENGTH);

  // 左赤弧：leftEdge から内向きに fill
  if (_arcLeftMesh.geometry) _arcLeftMesh.geometry.dispose();
  _arcLeftMesh.geometry = new _THREE.RingGeometry(
    ARC_INNER, ARC_OUTER, 24, 1, leftEdge, Math.max(0.001, fill),
  );
  _arcLeftMesh.position.set(rx, ry, rz);
  _arcLeftMesh.visible = fill > 0.01;

  // 右赤弧：rightEdge から内向きに fill（thetaStart = rightEdge - fill / thetaLength = fill）
  if (_arcRightMesh.geometry) _arcRightMesh.geometry.dispose();
  _arcRightMesh.geometry = new _THREE.RingGeometry(
    ARC_INNER, ARC_OUTER, 24, 1, rightEdge - fill, Math.max(0.001, fill),
  );
  _arcRightMesh.position.set(rx, ry, rz);
  _arcRightMesh.visible = fill > 0.01;

  // 中心フラッシュ：両端が中心で合流した瞬間（t≥TIP_FLASH_T）に光る
  if (t >= TIP_FLASH_T) {
    const tipX = rx + Math.cos(centerAngle) * (ARC_OUTER + 6);
    const tipY = ry + Math.sin(centerAngle) * (ARC_OUTER + 6);
    _tipFlash.position.set(tipX, tipY, rz);
    _tipFlash.visible = true;
    const ft = (t - TIP_FLASH_T) / (1 - TIP_FLASH_T);
    const s = 4 + TIP_FLASH_SCALE_MAX * ft;
    _tipFlash.scale.set(s, s, s);
    _tipFlash.material.opacity = 0.6 + 0.4 * ft;
  } else {
    _tipFlash.visible = false;
  }
}
