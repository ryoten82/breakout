// ============================================================
//  SCRAP BLITZ — fx-system（分離 Phase: Step E-5）
//
//  毎フレームの視覚エフェクト更新を集約：
//    - updateMegaCrashFX     メガクラの球体拡大 + 暗転フェードアウト
//    - updateChargeRingFX    チャージ完成リングの拡散
//    - updateHomingArrowFX   コンボホーミング矢印（デバッグ）
//    - updateUltFX           ULT のカメラズーム / 赤ドーム / 暗転フェード
//
//  ES Module として index.html から import される：
//    import {
//      initFxSystem,
//      updateMegaCrashFX, updateChargeRingFX, updateHomingArrowFX, updateUltFX,
//    } from './src/fx-system.js';
//
//  initFxSystem(deps) で依存を一括注入：
//    - players, camera
//    - megaRing, megaDarkenEl, ultDome, ultDarkenEl, homingArrowMesh, chargeReadyRing
//    - fxRefs: attack-engine と共有の演出 let アクセス ctx
//      （megaDarken / megaRingProg / ultSlowPhase / ultSlowFadeRemaining /
//       ultDomeProg / ultCamSavedZoom など）
//
//  MEGA_CONFIG / ULT_CONFIG / CHARGE_RING_CONFIG / HOMING_CONFIG は ESM 直接 import。
//  chargeRingState / getGameFrame は player-system.js から import。
// ============================================================

import {
  MEGA_CONFIG, ULT_CONFIG, CHARGE_RING_CONFIG, HOMING_CONFIG,
} from './config.js';
import { ATTACKS } from './attacks.js';
import { chargeRingState, getGameFrame } from './player-system.js';

let _players = null;
let _camera = null;
let _megaRing = null;
let _megaDarkenEl = null;
let _ultDome = null;
let _ultDarkenEl = null;
let _homingArrowMesh = null;
let _chargeReadyRing = null;
let _fxRefs = null;

export function initFxSystem(deps) {
  _players = deps.players;
  _camera = deps.camera;
  _megaRing = deps.megaRing;
  _megaDarkenEl = deps.megaDarkenEl;
  _ultDome = deps.ultDome;
  _ultDarkenEl = deps.ultDarkenEl;
  _homingArrowMesh = deps.homingArrowMesh;
  _chargeReadyRing = deps.chargeReadyRing;
  _fxRefs = deps.fxRefs;
}

// ============================================================
//  メガクラ視覚エフェクト：球体拡大 + 暗転フェードアウト
// ============================================================
export function updateMegaCrashFX() {
  // 球体拡大：単位球を MEGA_CONFIG.RADIUS まで scale。完成と同時にフェードアウト
  let megaRingProgress = _fxRefs.megaRingProg.get();
  if (megaRingProgress > 0 && megaRingProgress < 1) {
    megaRingProgress = Math.min(1, megaRingProgress + 1 / MEGA_CONFIG.EXPAND_FRAMES);
    _fxRefs.megaRingProg.set(megaRingProgress);
    const radius = megaRingProgress * MEGA_CONFIG.RADIUS;
    _megaRing.scale.set(radius, radius, radius);
    // 透明度カーブ：序盤くっきり、終盤フェード（球は薄め 0.5→0.1）
    const t = megaRingProgress;
    _megaRing.material.opacity = (1 - t) * 0.45 + 0.08;  // 0.53 → 0.08
    if (megaRingProgress >= 1) {
      _megaRing.visible = false;
      _megaRing.material.opacity = 0;
    }
  }
  // 暗転フェードアウト
  let megaDarkenFade = _fxRefs.megaDarken.get();
  if (megaDarkenFade > 0) {
    megaDarkenFade--;
    _fxRefs.megaDarken.set(megaDarkenFade);
    // フェード曲線：拡大中はキープ、その後リニアに減衰
    if (megaDarkenFade <= MEGA_CONFIG.DARKEN_FADE_OUT) {
      const t = megaDarkenFade / MEGA_CONFIG.DARKEN_FADE_OUT;
      _megaDarkenEl.style.opacity = String(MEGA_CONFIG.DARKEN_ALPHA * t);
    }
    if (megaDarkenFade === 0) _megaDarkenEl.style.opacity = '0';
  }
}

// ============================================================
//  チャージ成立リング視覚エフェクト
//  chargeReady になった瞬間に発火（player-system の updateChargeJ 内で
//  chargeRingState.frames をセット）。FRAMES から 0 へカウントダウン、
//  START_RADIUS → END_RADIUS に収束、フェードアウト
// ============================================================
export function updateChargeRingFX() {
  if (chargeRingState.frames <= 0) {
    if (_chargeReadyRing.visible) _chargeReadyRing.visible = false;
    return;
  }
  chargeRingState.frames--;
  // 進行 t は 0→1（チャージ完了瞬間に発火し、外へ拡散）
  const t = 1 - (chargeRingState.frames / CHARGE_RING_CONFIG.FRAMES);
  const eased = 1 - (1 - t) * (1 - t); // ease-out（序盤一気に出て終盤緩む）
  const radius = CHARGE_RING_CONFIG.START_RADIUS
    + (CHARGE_RING_CONFIG.END_RADIUS - CHARGE_RING_CONFIG.START_RADIUS) * eased;
  // プレイヤー追従
  const p = _players[0];
  if (p) {
    chargeRingState.x = p.x;
    chargeRingState.y = p.y + CHARGE_RING_CONFIG.Y_OFFSET;
    chargeRingState.z = p.z;
  }
  _chargeReadyRing.position.set(chargeRingState.x, chargeRingState.y, chargeRingState.z);
  // カメラは +Z 軸方向。TorusGeometry はデフォルトで XY 平面に円を描くので
  // rotation 無回転でちょうどカメラに正対する（リングの輪が見える）
  _chargeReadyRing.rotation.set(0, 0, 0);
  _chargeReadyRing.scale.set(radius, radius, radius);
  // 不透明度：序盤強く、終盤フェード
  _chargeReadyRing.material.opacity = (1 - eased) * 0.9 + 0.05;
  if (chargeRingState.frames === 0) {
    _chargeReadyRing.visible = false;
  }
}

// ============================================================
//  ホーミング対象矢印（デバッグ）
//  p.comboTarget が存在し SHOW_DEBUG_ARROW が true の時、対象敵頭上に三角を浮かす
// ============================================================
export function updateHomingArrowFX() {
  const p = _players[0];
  const target = p?.comboTarget;
  if (!target || !HOMING_CONFIG.SHOW_DEBUG_ARROW) {
    if (_homingArrowMesh.visible) _homingArrowMesh.visible = false;
    return;
  }
  _homingArrowMesh.visible = true;
  // 頭上に浮かべて、上下に sin で揺らす（視認性のため）
  const bob = Math.sin(getGameFrame() * 0.18) * 6;
  _homingArrowMesh.position.set(target.x, target.y + 230 + bob, target.z);
}

// ============================================================
//  ULT 視覚エフェクト：カメラズーム / 赤ドーム / 暗転フェードアウト
//  ULT 中（p.ultActive）に各演出を管理
// ============================================================
export function updateUltFX(p) {
  if (!p.ultActive) return;
  const atk = ATTACKS.c01_sp_ult01;
  const elapsed   = atk.duration - p.stateTimer;   // 経過フレーム
  const remaining = p.stateTimer;                  // 残フレーム

  // === スローフェード起動：ヒット発生フレームでピーク→フェードへ ===
  if (_fxRefs.ultSlowPhase.get() === 1 && elapsed >= atk.hitFrame) {
    _fxRefs.ultSlowPhase.set(2);
    _fxRefs.ultSlowFadeRemaining.set(ULT_CONFIG.SLOW_FADE_FRAMES);
  }

  // === カメラズーム ===
  // 序盤 CAM_ZOOM_FRAMES でズームイン → 中盤キープ → 終盤同フレームでズームアウト
  const zoomTotal = ULT_CONFIG.CAM_ZOOM_FRAMES;
  // 「ズーム比」を 1.0 → CAM_ZOOM_RATIO で寄せ、ULT 終盤に戻す
  let zoomRatio;
  if (elapsed < zoomTotal) {
    const t = elapsed / zoomTotal;
    zoomRatio = 1.0 + (ULT_CONFIG.CAM_ZOOM_RATIO - 1.0) * t;
  } else if (remaining < zoomTotal) {
    const t = remaining / zoomTotal;
    zoomRatio = ULT_CONFIG.CAM_ZOOM_RATIO + (1.0 - ULT_CONFIG.CAM_ZOOM_RATIO) * (1 - t);
  } else {
    zoomRatio = ULT_CONFIG.CAM_ZOOM_RATIO;
  }
  // OrthographicCamera.zoom：大きいほど寄る（既存値 / ratio で換算）
  _camera.zoom = _fxRefs.ultCamSavedZoom.get() / zoomRatio;
  _camera.updateProjectionMatrix();

  // === 赤ドーム拡大（hitFrame から DOME_EXPAND_FRAMES で 0→1）===
  let ultDomeProgress = _fxRefs.ultDomeProg.get();
  if (elapsed >= atk.hitFrame && ultDomeProgress < 1) {
    const domeElapsed = elapsed - atk.hitFrame;
    ultDomeProgress = Math.min(1, domeElapsed / ULT_CONFIG.DOME_EXPAND_FRAMES);
    _fxRefs.ultDomeProg.set(ultDomeProgress);
    const radius = ultDomeProgress * ULT_CONFIG.DOME_MAX_RADIUS;
    _ultDome.scale.set(radius, radius, radius);
    _ultDome.position.set(p.x, p.y + 10, p.z);  // 足元追従
    _ultDome.material.opacity = (1 - ultDomeProgress) * ULT_CONFIG.DOME_MAX_OPACITY;
  } else if (ultDomeProgress >= 1) {
    // 完成後はフェードアウト維持
    _ultDome.material.opacity *= 0.92;
    if (_ultDome.material.opacity < 0.01) {
      _ultDome.visible = false;
    }
  }

  // === 暗転フェードアウト（終盤 DARKEN_FADE_OUT フレーム）===
  if (remaining <= ULT_CONFIG.DARKEN_FADE_OUT) {
    const t = remaining / ULT_CONFIG.DARKEN_FADE_OUT;
    _ultDarkenEl.style.opacity = String(ULT_CONFIG.DARKEN_ALPHA * t);
  }
}
