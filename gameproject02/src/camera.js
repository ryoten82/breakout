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

let _camera = null;
let _bgCamera = null;
let _players = null;
let _enemies = null;
let _clockHandEl = null;
let _gameAspect = 1;

// カメラ追従状態（旧 index.html の let を移管）
let camFollowY = 0;   // Y 追従の遅延用（lerp）
let camTargetX = 0;   // デッドゾーンカメラ用 X 目標
let clockAngle = 0;   // 世界時計の角度

export function initCamera(deps) {
  _camera = deps.camera;
  _bgCamera = deps.bgCamera;
  _players = deps.players;
  _enemies = deps.enemies;
  _clockHandEl = deps.clockHandEl;
  _gameAspect = deps.gameAspect;
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
    const DEAD_ZONE = 220;
    if (p.x > camTargetX + DEAD_ZONE) camTargetX = p.x - DEAD_ZONE;
    if (p.x < camTargetX - DEAD_ZONE) camTargetX = p.x + DEAD_ZONE;
  }
  const baseX = camTargetX;

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

  // Y 追従：デッドゾーン付き lerp（低ジャンプではカメラ動かさない）
  const Y_DEAD_ZONE = 100;
  const yTarget = Math.max(0, p.y - Y_DEAD_ZONE);
  camFollowY += (yTarget - camFollowY) * 0.08;
  camFollowY = Math.max(0, Math.min(camFollowY, 150));
  // ピクセルシェーダー ON 時はシェイクをブリット側（UV）で処理するのでカメラに乗せない
  const sx = PIXEL_SHADER.ENABLED ? 0 : fxState.shakeOffsetX;
  const sy = PIXEL_SHADER.ENABLED ? 0 : fxState.shakeOffsetY;
  _camera.position.x = baseX + sx;
  _camera.position.y = CAM_CONFIG.CAM_Y + camFollowY + sy;
  _camera.position.z = CAM_CONFIG.CAM_Z;
  _camera.lookAt(baseX, CAM_CONFIG.LOOK_Y + camFollowY, 0);

  // 背景カメラ：X はデッドゾーン baseX 追従、Y はメインカメラの camFollowY と同期
  const bgX = baseX * 1.0;
  _bgCamera.position.x = bgX;
  _bgCamera.position.y = CAM_CONFIG.BG_CAM_Y + camFollowY;
  _bgCamera.position.z = CAM_CONFIG.BG_CAM_Z;
  _bgCamera.lookAt(bgX, CAM_CONFIG.BG_LOOK_Y + camFollowY, 0);
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
}
