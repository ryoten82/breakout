// ============================================================
//  SCRAP BLITZ — camera（分離 Phase: Step E-1）
//
//  カメラ追従・シェイク・直交投影設定・時計 HUD を集約：
//    - updateCamera()    デッドゾーン追従 + ULT 中直接追従 + シェイク反映
//    - applyCamConfig()  直交カメラのフラスタム更新（FOV/アスペクト変更時）
//    - updateClockHud()  画面右上の世界時計（ULT 凍結中は停止）
//
//  ES Module として index.html から import される：
//    import {
//      initCamera, updateCamera, applyCamConfig, updateClockHud,
//    } from './src/camera.js';
//
//  initCamera(deps) で依存を一括注入：
//    - camera, bgCamera: THREE.OrthographicCamera
//    - players, enemies
//    - clockHandEl: DOM ref（#clock-hand）
//    - gameAspect: 数値（GAME_WIDTH / GAME_HEIGHT）
//
//  CAM_CONFIG / PIXEL_SHADER は ESM から直接 import、fxState は hit-engine.js から import。
// ============================================================

import { CAM_CONFIG, PIXEL_SHADER } from './config.js';
import { fxState } from './hit-engine.js';

// デッドゾーン半幅（X は左右対称、Y も上下対称・X と同じハード追従式）
// プレイヤーが camTargetX / camFollowY を中心とした ±半幅 の範囲を超えると追従開始
// X / Z はキャラ約 2 人分相当の追従中心相対デッドゾーン
// Y は「絶対位置（地面 y=0）基準」で運用：プレイヤーが y > Y_UP の時のみ camFollowY 追従、
// それ以外は camFollowY = 0 に戻す。ジャンプ降下後カメラが地面に自動で戻る
const DEAD_ZONE_X = 380;        // 画像の赤枠サイズに合わせて再拡張
const DEAD_ZONE_Y_UP = 200;     // 物理 Y 軸（既存ロジック互換のため残置・現在は screenY 基準）
const DEAD_ZONE_Y_DOWN = 500;   // 地下ステージ対応・下方向の許容
const DEAD_ZONE_Z = 420;
// screenY のデッドゾーン上端：camera 動き始めの境界を上げて「ブヨブヨ」を抑制
//   100 → 200 : ジャンプ中空までは camera 動かない
const SCREEN_Y_UP = 200;
const SCREEN_Y_DOWN = -250;

let _camera = null;
let _bgCamera = null;
let _players = null;
let _enemies = null;
let _clockHandEl = null;
let _gamespeedHudEl = null;
let _gameSpeed = null;
let _gameAspect = 1;

// カメラ追従状態（旧 index.html の let を移管）
let camFollowY = 0;   // Y 追従の遅延用（lerp）
let camTargetX = 0;   // デッドゾーンカメラ用 X 目標
let camFollowZ = 0;   // Z 追従用（広いステージで奥のプレイヤーが画面外に出ないよう追従）

// ============================================================
//  壁オブジェクト管理（2026-05-18）
//  - levelWalls：ステージに配置された静的な壁（背景オブジェクト等）。
//    現状は空配列。将来ステージエディタやレベルデータから push する想定。
//    各要素は { side: 'left'|'right', x: number, zMin?, zMax? } の形を想定。
//  - getActiveWallX(side)：side（'left'|'right'）の有効な壁 X 座標を返す。
//    優先順：levelWalls に該当があればそれを採用、無ければ画面端（カメラ追従中心 ± 半幅）。
//  - 画面端基準：camTargetX ± (camera.right / camera.zoom)。
//    ズーム時は frustum 縮小に追従して壁も近づく（ULT 中など）。
// ============================================================
export const levelWalls = [];

export function getActiveWallX(side) {
  // levelWalls 優先：side が一致する壁の中で、プレイヤー側に最も近い x を採用
  let levelMatch = null;
  for (const w of levelWalls) {
    if (w.side !== side) continue;
    if (levelMatch === null) { levelMatch = w.x; continue; }
    // left 壁は右側（大きい x）優先 / right 壁は左側（小さい x）優先
    if (side === 'left'  && w.x > levelMatch) levelMatch = w.x;
    if (side === 'right' && w.x < levelMatch) levelMatch = w.x;
  }
  if (levelMatch !== null) return levelMatch;
  // フォールバック：画面端
  const halfW = _camera ? (_camera.right / (_camera.zoom || 1)) : 622;
  return side === 'left' ? (camTargetX - halfW) : (camTargetX + halfW);
}
let clockAngle = 0;   // 世界時計の角度
let _lastGameSpeedShown = null;  // GAME_SPEED 表示の差分検知

// デバッグ：デッドゾーン可視化用 Mesh（X/Y 軸：縦横帯 / Z 軸：床面の矩形領域）。半透明・トグル可
let _deadzoneL = null;  // X 軸左
let _deadzoneR = null;  // X 軸右
let _deadzoneB = null;  // Y 軸下（追従開始ライン y=Y_DEAD_ZONE_LOW）
let _deadzoneT = null;  // Y 軸上（追従上限ライン y=Y_DEAD_ZONE_LOW + Y_FOLLOW_CAP）
let _deadzoneFloor = null;  // Z 軸：床面に水平な矩形（X×Z 範囲）
let _groundMarker = null;   // デバッグ：プレイヤー真下の地上位置を示す赤リング（ジャンプ視認用）

export function initCamera(deps) {
  _camera = deps.camera;
  _bgCamera = deps.bgCamera;
  _players = deps.players;
  _enemies = deps.enemies;
  _clockHandEl = deps.clockHandEl;
  _gamespeedHudEl = deps.gamespeedHudEl || null;
  _gameSpeed = deps.gameSpeed || null;
  _gameAspect = deps.gameAspect;

  // デッドゾーン可視化 Mesh の生成（scene 直接配置・毎フレーム updateCamera で追従）
  if (deps.THREE && deps.scene) {
    const THREE = deps.THREE;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff9933, transparent: true, opacity: 0.18,
      depthWrite: false, depthTest: false,
    });
    // X 軸縦帯：幅 4wu の細長い帯、高さは画面縦範囲をカバー
    const geomV = new THREE.PlaneGeometry(4, 1200);
    _deadzoneL = new THREE.Mesh(geomV, mat);
    _deadzoneR = new THREE.Mesh(geomV, mat);
    // Y 軸横帯：高さ 4wu の細長い帯、幅は画面横範囲をカバー
    const geomH = new THREE.PlaneGeometry(2400, 4);
    _deadzoneB = new THREE.Mesh(geomH, mat);
    _deadzoneT = new THREE.Mesh(geomH, mat);
    // Z 軸：床面に水平な矩形（X×Z）。サイズは DEAD_ZONE_X*2 × DEAD_ZONE_Z*2
    // 色は X/Y 帯と区別しやすいよう少し濃く別マテリアル
    const matFloor = new THREE.MeshBasicMaterial({
      color: 0xff9933, transparent: true, opacity: 0.10,
      depthWrite: false, depthTest: false,
    });
    const geomFloor = new THREE.PlaneGeometry(DEAD_ZONE_X * 2, DEAD_ZONE_Z * 2);
    _deadzoneFloor = new THREE.Mesh(geomFloor, matFloor);
    _deadzoneFloor.rotation.x = -Math.PI / 2;  // 床面に水平
    for (const m of [_deadzoneL, _deadzoneR, _deadzoneB, _deadzoneT, _deadzoneFloor]) {
      m.visible = false;
      m.renderOrder = 9999;
      deps.scene.add(m);
    }
    // 地上マーカー：プレイヤーの (x, 0, z) 位置に赤いリングを表示（ジャンプ中に視認用）
    // p.y > 0（空中）の時だけ visible にする。常時 scene に存在
    const matRing = new THREE.MeshBasicMaterial({
      color: 0xff3344, transparent: true, opacity: 0.85,
      depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    });
    const geomRing = new THREE.RingGeometry(28, 38, 24);
    _groundMarker = new THREE.Mesh(geomRing, matRing);
    _groundMarker.rotation.x = -Math.PI / 2;
    _groundMarker.visible = false;
    _groundMarker.renderOrder = 9998;
    deps.scene.add(_groundMarker);
  }
}

// デバッグ：デッドゾーン表示トグル（Digit6 想定）
export function setDeadzoneVisible(visible) {
  for (const m of [_deadzoneL, _deadzoneR, _deadzoneB, _deadzoneT, _deadzoneFloor]) {
    if (m) m.visible = visible;
  }
}

export function isDeadzoneVisible() {
  return !!(_deadzoneL && _deadzoneL.visible);
}

// リスポーン時など、カメラをプレイヤー位置に即座にスナップしたい時用
//   Y は絶対位置基準なので updateCamera と同じ判定を再現
export function resetCameraToPlayer(p) {
  camTargetX = p.x;
  if (p.y > DEAD_ZONE_Y_UP) {
    camFollowY = p.y - DEAD_ZONE_Y_UP;
  } else if (p.y < -DEAD_ZONE_Y_DOWN) {
    camFollowY = p.y + DEAD_ZONE_Y_DOWN;
  } else {
    camFollowY = 0;
  }
  camFollowZ = p.z;
}

// デバッグ HUD 表示用：現在のデッドゾーン半幅を返す
export function getDeadzoneValues() {
  return {
    x: DEAD_ZONE_X,
    yUp: DEAD_ZONE_Y_UP,
    yDown: DEAD_ZONE_Y_DOWN,
    z: DEAD_ZONE_Z,
  };
}

// デッドゾーン追従 + ULT 中はプレイヤー直接追従
//   終了後は通常デッドゾーンが自動的に再開
export function updateCamera() {
  const p = _players[0];

  // ULT 中はデッドゾーンを無視してプレイヤー X に直接追従（ズーム時の被写体センター揃え）
  // 終了後は通常デッドゾーンが自動的に再開
  if (p.ultActive) {
    camTargetX += (p.x - camTargetX) * 0.25;
  } else {
    // デッドゾーン：中央帯では固定、端に達したら追従
    if (p.x > camTargetX + DEAD_ZONE_X) camTargetX = p.x - DEAD_ZONE_X;
    if (p.x < camTargetX - DEAD_ZONE_X) camTargetX = p.x + DEAD_ZONE_X;
  }
  const baseX = camTargetX;

  // デバッグ：デッドゾーン帯を「カメラ追従中心 ± 半幅」に追従（Y のみ上下非対称）
  // Z 軸は床面に矩形を置いて表示（カメラの俯瞰投影で台形に見える）
  if (_deadzoneL && _deadzoneL.visible) {
    const yCenter = CAM_CONFIG.LOOK_Y + camFollowY;
    _deadzoneL.position.set(camTargetX - DEAD_ZONE_X, yCenter, camFollowZ);
    _deadzoneR.position.set(camTargetX + DEAD_ZONE_X, yCenter, camFollowZ);
    _deadzoneB.position.set(camTargetX, camFollowY - DEAD_ZONE_Y_DOWN, camFollowZ);
    _deadzoneT.position.set(camTargetX, camFollowY + DEAD_ZONE_Y_UP, camFollowZ);
    _deadzoneFloor.position.set(camTargetX, 1, camFollowZ);  // y=1 で床面のすぐ上（Z-fighting 回避）
  }
  // 地上マーカー：プレイヤーが空中にいる時だけ p.x/p.z の真下に表示（デッドゾーン visibility に依存しない）
  if (_groundMarker) {
    if (p.y > 5) {
      _groundMarker.visible = true;
      _groundMarker.position.set(p.x, 2, p.z);
    } else {
      _groundMarker.visible = false;
    }
  }

  // シェイク計算（fxState は hit-engine の単一オブジェクト参照）
  if (fxState.shakeTimer > 0) {
    fxState.shakeOffsetX = (Math.random() - 0.5) * fxState.shakeStrength * 2;
    fxState.shakeOffsetY = (Math.random() - 0.5) * fxState.shakeStrength * 2;
    fxState.shakeTimer--;
    if (fxState.shakeTimer <= 0) {
      fxState.shakeStrength = 0;
      fxState.shakeOffsetX  = 0;
      fxState.shakeOffsetY  = 0;
    }
  } else {
    fxState.shakeOffsetX = 0;
    fxState.shakeOffsetY = 0;
  }

  // Y 追従：プレイヤーの「画面上 Y 位置 (screenY)」基準で決める。
  //   理由：俯瞰投影で z 軸の値もスクリーン Y に影響するため、p.y だけ見ていると
  //   Z 軸奥（dz < 0）でジャンプした時に p.y < Y_UP でも画面上端を突き抜けてしまう。
  //   screenY = (CAM_Z*dy - CAM_Y*dz) / sqrt(CAM_Y²+CAM_Z²)（カメラ俯瞰の up' ベクトル射影）
  //   camFollowY を 1 増やすと screenY は -CAM_Z/sqrt(...) ≒ -0.929 動く（係数 K_INV）
  const dy = p.y - camFollowY;
  const dz = p.z - camFollowZ;
  const camDist = Math.sqrt(CAM_CONFIG.CAM_Y * CAM_CONFIG.CAM_Y + CAM_CONFIG.CAM_Z * CAM_CONFIG.CAM_Z);
  const screenY = (CAM_CONFIG.CAM_Z * dy - CAM_CONFIG.CAM_Y * dz) / camDist;
  // screenY のデッドゾーン（上 100 / 下 -250）。これを超えたら camFollowY で補正
  // 上端側は控えめにしてプレイヤー身体（中心から +150wu の頭部）まで画面内に収める
  // 目標 camFollowY を「screenY がちょうど境界に来る値」として絶対計算する。
  // screenY = (CAM_Z*(p.y - camFollowY) - CAM_Y*dz) / camDist = 境界値 を解くと：
  //   camFollowY = p.y - (CAM_Y/CAM_Z)*dz - 境界値 * (camDist/CAM_Z)
  // これで targetY が camFollowY に依存しなくなり、lerp がスプリング振動しない
  const Y_RATIO = CAM_CONFIG.CAM_Y / CAM_CONFIG.CAM_Z;     // 0.4
  const SCREEN_SCALE = camDist / CAM_CONFIG.CAM_Z;          // 1.077
  // 「2D 認識」モード：境界判定を連続関数化（target が 0 から滑らかに立ち上がる）。
  //   閾値方式だと、screenY が境界を細かく跨ぐ中間地点ジャンプで target が「0 ⇄ 大きな値」に
  //   スナップしてカメラがグラグラする。upTarget/downTarget をそのまま使えば境界で連続。
  const upTarget   = p.y - Y_RATIO * dz - SCREEN_Y_UP   * SCREEN_SCALE;
  const downTarget = p.y - Y_RATIO * dz - SCREEN_Y_DOWN * SCREEN_SCALE;
  let targetCamY;
  if (upTarget > 0) {
    targetCamY = upTarget;     // 上端を越えた分だけ追従
  } else if (downTarget < 0) {
    targetCamY = downTarget;   // 下端を越えた分だけ追従
  } else {
    targetCamY = 0;            // デッドゾーン内：camera は地上ベース
  }
  // 線形定速で target へ追従（上下とも一定速 10wu/F）
  // 重力加速を camera に持ち込まない（target が p.y に追従する性質上、step を遅くすることで
  // 「camera 側の加速感」を構造的に出さない設計）。プレイヤーは画面内で多少動く
  const STEP = 10;
  const diff = targetCamY - camFollowY;
  if (Math.abs(diff) > STEP) {
    camFollowY += Math.sign(diff) * STEP;
  } else {
    camFollowY = targetCamY;
  }
  // Z 追従：X/Y と同じハード境界式（camFollowZ ± DEAD_ZONE_Z の外でのみ追従）
  if (p.z > camFollowZ + DEAD_ZONE_Z) camFollowZ = p.z - DEAD_ZONE_Z;
  if (p.z < camFollowZ - DEAD_ZONE_Z) camFollowZ = p.z + DEAD_ZONE_Z;
  // シェイクは常にカメラへ直接適用：両 RT（pixelRT / outlineRT）が同じ projection で
  // レンダリングされるので color と outline が同期する。
  // （旧コード：PIXEL_SHADER ON 時は blit shader の uColorOffset 経由で color のみ揺らしていたが、
  //  ULT 等の強シェイク中に outline と color が分離して見える問題があったため廃止）
  const sx = fxState.shakeOffsetX;
  const sy = fxState.shakeOffsetY;
  // ピクセルシェーダーの量子化と camera 位置の小数値が干渉してジャギが目立つため、
  // camera.position と lookAt 引数を整数 wu に snap する（pixel-perfect 対策）。
  // camFollowY は lerp の状態を保つために浮動小数のまま、適用時のみ Math.round
  const camPosX = Math.round(baseX + sx);
  const camPosY = Math.round(CAM_CONFIG.CAM_Y + camFollowY + sy);
  const camPosZ = Math.round(CAM_CONFIG.CAM_Z + camFollowZ);
  const lookY   = Math.round(CAM_CONFIG.LOOK_Y + camFollowY);
  const lookZ   = Math.round(camFollowZ);
  _camera.position.set(camPosX, camPosY, camPosZ);
  _camera.lookAt(Math.round(baseX), lookY, lookZ);

  // 背景カメラ：X はデッドゾーン baseX 追従、Y/Z はメインカメラと同期（同じく pixel snap）
  const bgX = Math.round(baseX);
  _bgCamera.position.set(bgX, Math.round(CAM_CONFIG.BG_CAM_Y + camFollowY), Math.round(CAM_CONFIG.BG_CAM_Z + camFollowZ));
  _bgCamera.lookAt(bgX, Math.round(CAM_CONFIG.BG_LOOK_Y + camFollowY), lookZ);
}

// FOV / アスペクト変更時はフラスタム更新が必要なためヘルパー経由
export function applyCamConfig() {
  const h = CAM_CONFIG.ORTHO_H / 2;
  _camera.left   = -h * _gameAspect;
  _camera.right  =  h * _gameAspect;
  _camera.top    =  h;
  _camera.bottom = -h;
  _camera.updateProjectionMatrix();
}

// 世界時計 HUD：通常は 6°/F で回転、ULT 凍結中は停止
//   - SLOWMO / メガクラスロー / ULT スロー：update が間引かれるので針も遅くなる
//   - ヒットストップ：update が止まるので針も止まる
//   - ULT 凍結中のエネミーがいる間：針を停止（時間停止演出の可視化）
export function updateClockHud() {
  let worldFrozen = false;
  for (const e of _enemies) {
    if (e.frozenByUlt) { worldFrozen = true; break; }
  }
  if (!worldFrozen) {
    clockAngle = (clockAngle + 6) % 360;
    if (_clockHandEl) _clockHandEl.setAttribute('transform', `rotate(${clockAngle})`);
  }
  // GAME_SPEED.scale を時計直下に表示（コンソール書き換えで即反映）
  if (_gamespeedHudEl && _gameSpeed) {
    const s = _gameSpeed.scale;
    if (s !== _lastGameSpeedShown) {
      _gamespeedHudEl.textContent = 'x' + s.toFixed(2);
      _lastGameSpeedShown = s;
    }
  }
}
