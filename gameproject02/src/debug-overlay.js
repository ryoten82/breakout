// ============================================================
//  SCRAP BLITZ — debug-overlay（分離 Phase: Step E-7）
//
//  デバッグ HUD 更新を集約：
//    - updateDebug          プレイヤー座標・state・charge・特殊使用済 HUD
//    - updateHudHighlight   操作説明の HUD ハイライト（押下中ボタンを黄色く）
//
//  ES Module として index.html から import される：
//    import {
//      initDebugOverlay, updateDebug, updateHudHighlight,
//    } from './src/debug-overlay.js';
//
//  initDebugOverlay(deps) で依存を一括注入：
//    - inp, action          入力ポーリング関数
//    - players, enemies     状態取得用
//    - debugEl, dummyHpEl, stateHudPlayerEl, stateHudEnemyEl,
//      dbgDirHistEl, dbgChargeEl, dbgSpUsedEl  DOM refs
//
//  STATE / SPECIAL_CONFIG は ESM 直接 import。
//  ヒットボックス可視化（toggleHitbox / _dbg* / updateHitboxDebug）は
//  Three.js シーン構築と密結合のため index.html に残置。
// ============================================================

import { STATE } from './states.js';
import { SPECIAL_CONFIG } from './config.js';

let _inp = null;
let _action = null;
let _players = null;
let _enemies = null;
let _debugEl = null;
let _dummyHpEl = null;
let _stateHudPlayerEl = null;
let _stateHudEnemyEl = null;
let _dbgDirHistEl = null;
let _dbgChargeEl = null;
let _dbgSpUsedEl = null;

// HUD_HIGHLIGHT_MAP は init 時に _inp/_action を捕まえて構築する
let _hudHighlightMap = null;
let _hkEls = null;

export function initDebugOverlay(deps) {
  _inp = deps.inp;
  _action = deps.action;
  _players = deps.players;
  _enemies = deps.enemies;
  _debugEl = deps.debugEl;
  _dummyHpEl = deps.dummyHpEl;
  _stateHudPlayerEl = deps.stateHudPlayerEl;
  _stateHudEnemyEl = deps.stateHudEnemyEl;
  _dbgDirHistEl = deps.dbgDirHistEl;
  _dbgChargeEl = deps.dbgChargeEl;
  _dbgSpUsedEl = deps.dbgSpUsedEl;

  // 押されているボタンに対応する説明行を黄色くハイライトする
  _hudHighlightMap = [
    { id: 'hk-move',      check: () => _inp('ArrowLeft') || _inp('ArrowRight') || _inp('ArrowUp') || _inp('ArrowDown') || _inp('KeyA') || _inp('KeyD') || _inp('KeyW') || _inp('KeyS') },
    { id: 'hk-dash',      check: () => _players[0]?.dashActive },
    { id: 'hk-jump',      check: () => _action('jump') },
    { id: 'hk-weak',      check: () => _action('weakAttack') },
    { id: 'hk-strong',    check: () => _action('strongAttack') },
    { id: 'hk-cancel',    check: () => _action('jump') && _players[0]?.state === STATE.hit_confirm },
    { id: 'hk-secondary', check: () => _action('secondary') },
    { id: 'hk-mega',      check: () => _action('megaCrash') || (_inp('KeyJ') && _inp('KeyK') && !_inp('KeyL')) },
    { id: 'hk-ult',       check: () => _action('ult')      || (_inp('KeyJ') && _inp('KeyK') &&  _inp('KeyL')) },
    { id: 'hk-pixel',     check: () => _inp('KeyP') },
  ];
  _hkEls = {};
  _hudHighlightMap.forEach(({ id }) => { _hkEls[id] = document.getElementById(id); });
}

// ============================================================
//  プレイヤー座標・state・charge・特殊使用済 デバッグ HUD
// ============================================================
export function updateDebug() {
  const p = _players[0];
  _debugEl.textContent =
    `x:${p.x.toFixed(0)} z:${p.z.toFixed(0)} y:${p.y.toFixed(0)} | ` +
    `state:${p.state} chain:${p.attackChainIdx} | ` +
    `grounded:${p.isGrounded ? 'Y' : 'N'}`;
  _dummyHpEl.textContent = `${_enemies[0].hp}/${_enemies[0].maxHp}`;
  // ステートHUD更新（未設定の場合は「未設定」表示）
  _stateHudPlayerEl.textContent = _players[0]?.state ?? '未設定';
  _stateHudEnemyEl.textContent  = _enemies[0]?.state ?? '未設定';
  // 必殺技デバッグ HUD：直近 6 エントリの dir + chargeJFrames + 使用済 ID 集合
  if (_dbgDirHistEl) {
    const hist = _players[0]?.dirHistory ?? [];
    const recent = hist.slice(-6).map(e => e.dir).join(' ');
    _dbgDirHistEl.textContent = recent || '-';
  }
  if (_dbgChargeEl) {
    const cj = _players[0]?.chargeJFrames ?? 0;
    const ready = _players[0]?.chargeReady;
    _dbgChargeEl.textContent = `${cj}/${SPECIAL_CONFIG.CHARGE_FRAMES}${ready ? ' [READY]' : ''}`;
    _dbgChargeEl.style.color = ready ? '#ffff66' : '#cfffaa';
  }
  if (_dbgSpUsedEl) {
    const used = _players[0]?.specialUsedIds;
    _dbgSpUsedEl.textContent = (used && used.size > 0)
      ? Array.from(used).map(id => id.replace('c01_sp_', '')).join(',')
      : '-';
  }
}

// ============================================================
//  操作説明 HUD のハイライト（押下中ボタンを黄色く）
// ============================================================
export function updateHudHighlight() {
  _hudHighlightMap.forEach(({ id, check }) => {
    const el = _hkEls[id];
    if (!el) return;
    el.classList.toggle('hk-active', check());
  });
}
