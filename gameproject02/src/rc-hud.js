// ============================================================
//  SCRAP BLITZ — RC HUD（収縮リング式 危機察知 UI / 2026-05-26 改修）
//
//  自機追従のワールド UI：
//    - 黄色ベースリング（停止位置・常時表示）
//    - 赤い細い円が外側から黄色リング目掛けて収縮（音ゲー譜面風）
//    - 軸方向（aerial/ground/frontal）に強い光が灯る
//    - 黄色と赤が重なった瞬間 = RC タイミング（タップキュー）
//
//  連続 RC（boss_overdrive）では同時 2 つまで：
//    - 現在スロット：赤円・収縮中・フル不透明
//    - 次スロット：透明度を下げた赤円が外側に待機（プレビュー）
//    - 現在ロックアウト時 / 最終スロット中はプレビュー非表示
//
//  方向：repulseAxis に応じて光の位置（円周上）を決める
//    - aerial  : 真上（90°）
//    - ground  : 真下（-90°）
//    - frontal : player.facing 方向（右=0° / 左=180°）
// ============================================================

import { ENEMY_ATTACKS } from './config.js';

let _THREE = null;
let _scene = null;
let _players = null;
let _enemies = null;

// 黄色ベースリング（停止位置）
let _baseRing = null;
// 現在スロットの赤い収縮リング + 方向光
let _redRingCurrent     = null;
let _redRingCurrentMat  = null;
let _dirLightCurrent    = null;
let _dirLightCurrentMat = null;
// プレビュー（次スロット）赤リング + 方向光
let _redRingPreview     = null;
let _redRingPreviewMat  = null;
let _dirLightPreview    = null;
let _dirLightPreviewMat = null;

// 表示パラメータ
const RING_RADIUS         = 90;     // 黄色ベースリング半径（赤円の最終収縮位置 = RC 成立タイミング）
const RING_TUBE           = 4;
const RING_Y_OFFSET       = 90;     // 胴体高さ（プレイヤー中心から）
const RED_RING_OUTER      = 150;    // 赤リング出現時の半径（旧 230 → 150：UI を小さく / 外への広がり抑制）
const RED_RING_TUBE       = 3;      // 旧 4 → 3：細めにして UI を圧迫しない
const PREVIEW_LAG         = 80;     // プレビュー方向光は現在リングより +80wu 外側で同速収縮（線なし・光のみ）
const DIR_LIGHT_SIZE      = 14;     // 旧 18 → 14：UI 全体縮小に合わせて
const COLOR_BASE  = 0xffaa11;
const COLOR_RED   = 0xff2222;
const COLOR_LIGHT = 0xffffcc;       // 方向光：黄寄りの白で「灯っている」感

export function initRcHud(deps) {
  _THREE   = deps.THREE;
  _scene   = deps.scene;
  _players = deps.players;
  _enemies = deps.enemies;
  if (!_THREE || !_scene) return;

  // 黄色ベースリング（停止位置・常時表示）
  const baseGeom = new _THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 10, 64);
  const baseMat  = new _THREE.MeshBasicMaterial({
    color: COLOR_BASE, transparent: true, opacity: 0.90,
    depthTest: false, depthWrite: false,
  });
  _baseRing = new _THREE.Mesh(baseGeom, baseMat);
  _baseRing.visible = false;
  _baseRing.renderOrder = 9500;
  _scene.add(_baseRing);

  // 現在スロット赤リング（収縮）
  _redRingCurrentMat = new _THREE.MeshBasicMaterial({
    color: COLOR_RED, transparent: true, opacity: 0.95,
    depthTest: false, depthWrite: false,
  });
  _redRingCurrent = new _THREE.Mesh(
    new _THREE.TorusGeometry(RED_RING_OUTER, RED_RING_TUBE, 8, 64),
    _redRingCurrentMat,
  );
  _redRingCurrent.visible = false;
  _redRingCurrent.renderOrder = 9502;
  _scene.add(_redRingCurrent);

  // 現在スロット方向光（軸位置の光点）
  _dirLightCurrentMat = new _THREE.MeshBasicMaterial({
    color: COLOR_LIGHT, transparent: true, opacity: 1.0,
    depthTest: false, depthWrite: false,
  });
  _dirLightCurrent = new _THREE.Mesh(
    new _THREE.SphereGeometry(DIR_LIGHT_SIZE, 16, 12),
    _dirLightCurrentMat,
  );
  _dirLightCurrent.visible = false;
  _dirLightCurrent.renderOrder = 9503;
  _scene.add(_dirLightCurrent);

  // プレビュー（次スロット）赤リング：線は描画しない方針に変更（mesh は残置・常時 visible=false）
  //   方向光だけで予告し、UI を圧迫しない
  _redRingPreviewMat = new _THREE.MeshBasicMaterial({
    color: COLOR_RED, transparent: true, opacity: 0.0,
    depthTest: false, depthWrite: false,
  });
  _redRingPreview = new _THREE.Mesh(
    new _THREE.TorusGeometry(RED_RING_OUTER + PREVIEW_LAG, RED_RING_TUBE, 8, 64),
    _redRingPreviewMat,
  );
  _redRingPreview.visible = false;
  _redRingPreview.renderOrder = 9501;
  _scene.add(_redRingPreview);

  // プレビュー方向光
  _dirLightPreviewMat = new _THREE.MeshBasicMaterial({
    color: COLOR_LIGHT, transparent: true, opacity: 0.35,
    depthTest: false, depthWrite: false,
  });
  _dirLightPreview = new _THREE.Mesh(
    new _THREE.SphereGeometry(DIR_LIGHT_SIZE * 0.7, 12, 8),
    _dirLightPreviewMat,
  );
  _dirLightPreview.visible = false;
  _dirLightPreview.renderOrder = 9501;
  _scene.add(_dirLightPreview);
}

// 軸 → 角度（XY 平面の極座標：90°=上 / -90°=下 / 0°=右 / 180°=左）
function _axisToCenterAngle(axis, facing) {
  if (axis === 'aerial')  return Math.PI / 2;
  if (axis === 'ground')  return -Math.PI / 2;
  if (axis === 'frontal') return (facing > 0) ? 0 : Math.PI;
  return Math.PI / 2;
}

function _hideAll() {
  if (_baseRing)        _baseRing.visible        = false;
  if (_redRingCurrent)  _redRingCurrent.visible  = false;
  if (_dirLightCurrent) _dirLightCurrent.visible = false;
  if (_redRingPreview)  _redRingPreview.visible  = false;
  if (_dirLightPreview) _dirLightPreview.visible = false;
}

export function updateRcHud() {
  if (!_baseRing || !_players || !_enemies) return;
  const p = _players[0];
  if (!p) { _hideAll(); return; }

  // RC 受付中の最寄り敵を探す（boss_overdrive は _odSlotAxis でスロット単位の軸を持つ）
  let bestE = null;
  let bestAtk = null;
  let bestAxis = null;
  let bestDistSq = Infinity;
  for (const e of _enemies) {
    if (!e || !e.isAlive || e.dying) continue;
    if (!e.repulseWindow) continue;
    const atk = e.curAtkId && ENEMY_ATTACKS[e.curAtkId];
    if (!atk) continue;
    const axis = e._odSlotAxis ?? atk.repulseAxis;
    if (!axis) continue;
    const dx = e.x - p.x, dz = e.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDistSq) { bestDistSq = d2; bestE = e; bestAtk = atk; bestAxis = axis; }
  }

  if (!bestE) { _hideAll(); return; }

  // プレイヤー追従位置（胴体高さ）
  const rx = p.x;
  const ry = p.y + RING_Y_OFFSET;
  const rz = p.z;
  _baseRing.position.set(rx, ry, rz);
  _baseRing.visible = true;

  // 進度 t：攻撃 kind 別に取得
  //   t=0：スロット開始（赤円は最遠）／ t=1：wind 完走（赤円が黄色に重なる = RC 成立タイミング）
  let t;
  if (bestAtk.kind === 'jump_dive') {
    const aimMax  = bestAtk.aimFrames ?? 80;
    const aimLeft = bestE._jdAimTimer ?? 0;
    t = (bestE._jdPhase === 'aim') ? (1 - Math.max(0, Math.min(1, aimLeft / aimMax))) : 1;
  } else if (bestAtk.kind === 'boss_overdrive') {
    const slots = bestAtk.comboSlots ?? [];
    const slot  = slots[bestE._odSlotIdx ?? 0];
    const wMax  = slot?.windF ?? 20;
    const wLeft = bestE._odSlotTimer ?? 0;
    t = 1 - Math.max(0, Math.min(1, wLeft / wMax));
  } else {
    const wMax  = bestAtk.windFrames ?? 60;
    const wLeft = bestE.atkTimer ?? 0;
    t = 1 - Math.max(0, Math.min(1, wLeft / wMax));
  }

  // 現在スロット赤リング：外側 RED_RING_OUTER → 黄色 RING_RADIUS へ収縮
  const currentRadius = RED_RING_OUTER + (RING_RADIUS - RED_RING_OUTER) * t;
  if (_redRingCurrent.geometry) _redRingCurrent.geometry.dispose();
  _redRingCurrent.geometry = new _THREE.TorusGeometry(currentRadius, RED_RING_TUBE, 8, 64);
  _redRingCurrent.position.set(rx, ry, rz);
  _redRingCurrent.visible = true;

  // 現在スロット方向光：赤リング上の軸角度位置に配置（リング収縮に追従）
  const angle  = _axisToCenterAngle(bestAxis, p.facing || 1);
  const lightX = rx + Math.cos(angle) * currentRadius;
  const lightY = ry + Math.sin(angle) * currentRadius;
  _dirLightCurrent.position.set(lightX, lightY, rz);
  _dirLightCurrent.visible = true;
  // 収縮完了瞬間（t≈1）に光を強める：「重なった！」のキュー
  _dirLightCurrentMat.opacity = 0.6 + 0.4 * t;
  const _lightScale = 0.85 + 0.45 * t;   // t=1 で 1.3x にやや拡大
  _dirLightCurrent.scale.set(_lightScale, _lightScale, _lightScale);

  // プレビュー（次スロット）：boss_overdrive 専用・方向光のみ（リング線は非表示）
  //   現在リングより +PREVIEW_LAG 外側で同じ速度で収縮 → スロット遷移時にちょうど現在開始位置にいて滑らかに繋がる。
  //   光だけが「次の方向」を予告して近づいてくる音ゲー譜面感
  let previewVisible = false;
  if (bestAtk.kind === 'boss_overdrive') {
    const slots      = bestAtk.comboSlots ?? [];
    const currentIdx = bestE._odSlotIdx ?? 0;
    const lockedOut  = !!bestE._odComboRcLockedOut;
    const nextSlot   = slots[currentIdx + 1];
    const nextAxis   = nextSlot?.repulseAxis;
    if (!lockedOut && nextAxis) {
      // プレビュー方向光：現在リング半径 + PREVIEW_LAG の位置に配置（同速度で収縮）
      const previewRadius = currentRadius + PREVIEW_LAG;
      const pAngle = _axisToCenterAngle(nextAxis, p.facing || 1);
      _dirLightPreview.position.set(
        rx + Math.cos(pAngle) * previewRadius,
        ry + Math.sin(pAngle) * previewRadius,
        rz,
      );
      _dirLightPreview.visible = true;
      _dirLightPreviewMat.opacity = 0.30 + 0.30 * t;  // 0.30 → 0.60（接近と共に明るく）
      previewVisible = true;
    }
  }
  // プレビューリング線は常時非表示（プレビューは光のみで表現）
  if (_redRingPreview) _redRingPreview.visible = false;
  // 光は対象が無ければ非表示
  if (!previewVisible && _dirLightPreview) _dirLightPreview.visible = false;
}
