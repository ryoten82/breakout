// ============================================================
//  SCRAP BLITZ — hud-system（分離 Phase: Step E-2）
//
//  HUD 更新ロジックを集約：
//    - updateSPGauge / spawnSPStockRing  SP バー + ストック表示 + 充填エッジ演出
//    - updateHpHud                      HP バー + 危機点滅
//    - updateGrabGauge                  グラブ中の頭上ゲージ（world→screen 投影）
//    - updateEnemyAtkCountdown          敵攻撃カウントダウン（3/2/1）
//
//  ES Module として index.html から import される：
//    import {
//      initHudSystem,
//      updateSPGauge, updateHpHud, updateGrabGauge, updateEnemyAtkCountdown,
//    } from './src/hud-system.js';
//
//  initHudSystem(deps) で依存を一括注入：
//    - THREE: Three.js モジュール（Vector3 ファクトリ用）
//    - players, enemies
//    - camera
//    - DOM refs（spBarEl / spStockNumEl / hpBarEl / hpNumEl /
//                grabGaugeEl / grabGaugeFillEl / hudLayerEl / enemyAtkCdTemplate）
//    - gameWidth, gameHeight: 数値
//
//  SP_CONFIG / GRAB_CONFIG / STATE / ENEMY_AI は ESM 直接 import。
// ============================================================

import { SP_CONFIG, GRAB_CONFIG, ENEMY_AI } from './config.js';
import { STATE } from './states.js';

let _THREE = null;
let _players = null;
let _enemies = null;
let _camera = null;
let _spBarEl = null;
let _spStockNumEl = null;
let _hpBarEl = null;
let _hpNumEl = null;
let _grabGaugeEl = null;
let _grabGaugeFillEl = null;
let _hudLayerEl = null;
let _gameWidth = 1920;
let _gameHeight = 1080;

// 内部状態
let _prevFullStocks = -1;
let _enemyCdProj = null;
let _grabGaugeProj = null;
const _enemyCdPool = [];
let _aiPhaseProj = null;
const _aiPhasePool = [];
let _stunProj = null;
const _stunPool = [];

export function initHudSystem(deps) {
  _THREE = deps.THREE;
  _players = deps.players;
  _enemies = deps.enemies;
  _camera = deps.camera;
  _spBarEl = deps.spBarEl;
  _spStockNumEl = deps.spStockNumEl;
  _hpBarEl = deps.hpBarEl;
  _hpNumEl = deps.hpNumEl;
  _grabGaugeEl = deps.grabGaugeEl;
  _grabGaugeFillEl = deps.grabGaugeFillEl;
  _hudLayerEl = deps.hudLayerEl;
  _gameWidth = deps.gameWidth;
  _gameHeight = deps.gameHeight;
  // 投影用 Vector3 は init 時に確保（毎フレーム new しない）
  _enemyCdProj = new _THREE.Vector3();
  _grabGaugeProj = new _THREE.Vector3();
  _aiPhaseProj = new _THREE.Vector3();
  _stunProj = new _THREE.Vector3();
}

// ============================================================
//  SP ゲージ：右→左に伸びる単一バー + 左側にストック数（カウントアップ）
// ============================================================
export function updateSPGauge() {
  const p = _players[0];
  const stockSize  = SP_CONFIG.STOCK_SIZE;    // 20
  const maxStocks  = SP_CONFIG.MAX_STOCKS;    // 5
  const fullStocks = Math.min(maxStocks, Math.floor(p.sp / stockSize));
  // 現在充填中のバーの伸長量（次のストックに向けて 0→1）
  const partial    = Math.max(0, Math.min(1, (p.sp - fullStocks * stockSize) / stockSize));
  const atMax = (fullStocks >= maxStocks);
  // MAX 到達時はバーを満タン表示（空白だと「ゲージが空」と誤認されるため）
  const barW = atMax ? 100 : (partial * 100);
  _spBarEl.style.width = barW.toFixed(1) + '%';
  if (_spStockNumEl) _spStockNumEl.textContent = fullStocks;
  // MAX 到達時は色を変えて可視化（ULT 発動可サイン）
  _spBarEl.style.background = atMax ? '#00ffaa' : '#00ddff';
  // ストック充填エッジ：fullStocks が前フレームより増えたタイミングでリング放射
  if (_prevFullStocks >= 0 && fullStocks > _prevFullStocks) {
    spawnSPStockRing();
  }
  _prevFullStocks = fullStocks;
}

// SP ストック 1 つ充填毎の演出（派手版）：
//   - 二重リング（シアン本体 + 遅延の黄色 = 余韻）
//   - 数字本体のスケール＆発光パルス
//   - 8 方向の放射スパーク
// 全要素は CSS animation 完了時に DOM から自動削除される
export function spawnSPStockRing() {
  const host = _spStockNumEl;
  if (!host) return;
  const addAnimEl = (className, extraStyles) => {
    const el = document.createElement('div');
    el.className = className;
    if (extraStyles) Object.assign(el.style, extraStyles);
    host.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    return el;
  };
  // 二重リング
  addAnimEl('sp-stock-ring');
  addAnimEl('sp-stock-ring delay');
  // 8 方向スパーク
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * 360;
    addAnimEl('sp-stock-spark', { '--angle': `${angle}deg` });
  }
  // 数字パルス（既存クラスを一旦剥がして再付与でアニメ再起動）
  host.classList.remove('sp-stock-num-pulse');
  void host.offsetWidth; // reflow を強制してアニメ再起動を担保
  host.classList.add('sp-stock-num-pulse');
}

// ============================================================
//  HP HUD：プレイヤーごとの HP バー更新（将来 P2/P3/P4 拡張用に forEach 構造）
// ============================================================
export function updateHpHud() {
  const p = _players[0];
  if (!p || !_hpBarEl) return;
  const ratio = Math.max(0, Math.min(1, p.hp / p.maxHp));
  _hpBarEl.style.width = (ratio * 100).toFixed(1) + '%';
  if (_hpNumEl) _hpNumEl.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  // 危機状態（p.inCrisis）と連動して点滅
  // → 機体本体の火花スポーンと同タイミングで切り替わる（HP_CONFIG.CRISIS_THRESHOLD 一元管理）
  _hpBarEl.classList.toggle('low', !!p.inCrisis);
}

// ============================================================
//  デバッグ：敵攻撃カウントダウン（敵ごとに頭上 world→screen 投影）
//   - カウントダウン中（wind フェーズ）だけ「3 / 2 / 1」を大きく表示
//   - 敵ごとに DOM 要素を動的生成・プール管理
// ============================================================
function _getEnemyCdEl(idx) {
  while (_enemyCdPool.length <= idx) {
    const el = document.createElement('div');
    el.id = `enemy-atk-cd-${_enemyCdPool.length}`;
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '81';
    el.style.fontFamily = "'Courier New', monospace";
    el.style.fontSize = '56px';
    el.style.fontWeight = 'bold';
    el.style.textShadow = '0 0 10px #000, 3px 3px 0 #000';
    el.style.whiteSpace = 'nowrap';
    el.style.display = 'none';
    el.style.lineHeight = '1';
    // 既存 CSS の cd-1/2/3 クラスで色付け（既存スタイル流用）
    (_hudLayerEl ?? document.body).appendChild(el);
    _enemyCdPool.push(el);
  }
  return _enemyCdPool[idx];
}
export function updateEnemyAtkCountdown() {
  for (let i = 0; i < _enemies.length; i++) {
    const e = _enemies[i];
    const el = _getEnemyCdEl(i);
    if (!e.isAlive || e.state === STATE.enemy_dying || !ENEMY_AI.enabled || !e.aiEnabled ||
        e.state !== STATE.enemy_attacking || e.atkPhase !== 'wind') {
      el.style.display = 'none';
      continue;
    }
    // 残F → 秒（切り上げ）：180..121=3 / 120..61=2 / 60..1=1
    const sec = Math.ceil(e.atkTimer / 60);
    el.textContent = sec;
    el.className = 'cd-' + sec;
    _enemyCdProj.set(e.x, e.y + 260, e.z);
    _enemyCdProj.project(_camera);
    const frameX = (_enemyCdProj.x * 0.5 + 0.5) * _gameWidth;
    const frameY = (-_enemyCdProj.y * 0.5 + 0.5) * _gameHeight;
    el.style.left = frameX + 'px';
    el.style.top  = frameY + 'px';
    el.style.display = 'block';
  }
}

// ============================================================
//  デバッグ：グラブゲージ（敵頭上に world→screen 投影）
//   - グラブ中だけ表示
//   - 残り時間に応じて左→右に塗りつぶし、満杯で解除
// ============================================================
export function updateGrabGauge() {
  const p = _players[0];
  if (!p || p.state !== STATE.grabbing || !p.grabTarget) {
    if (_grabGaugeEl) _grabGaugeEl.style.display = 'none';
    return;
  }
  const e = p.grabTarget;
  // 充填率：時間が経過/攻撃ヒットで grabTimer が減るほど fill が右へ
  const fill = Math.max(0, Math.min(1, 1 - p.grabTimer / GRAB_CONFIG.DURATION));
  _grabGaugeFillEl.style.width = (fill * 100).toFixed(1) + '%';
  // 敵頭上を world→画面（1920x1080 フレーム座標）に投影
  _grabGaugeProj.set(e.x, e.y + 220, e.z);
  _grabGaugeProj.project(_camera);
  const frameX = (_grabGaugeProj.x * 0.5 + 0.5) * _gameWidth;
  const frameY = (-_grabGaugeProj.y * 0.5 + 0.5) * _gameHeight;
  _grabGaugeEl.style.left = frameX + 'px';
  _grabGaugeEl.style.top  = frameY + 'px';
  _grabGaugeEl.style.display = 'block';
}

// ============================================================
//  デバッグ：敵 aiPhase ラベル（Phase 3 ステート明示化）
//   - window.SB.DEBUG_AI === true のときだけ敵頭上に idle/chase/attack/retreat/stun を表示
//   - フェーズ色分け：chase=cyan / attack=orange / retreat=lime / stun=gray / idle=white
// ============================================================
const _AI_PHASE_COLOR = {
  idle:    '#cccccc',
  chase:   '#44ddff',
  attack:  '#ff8844',
  retreat: '#88ff66',
  hitstun: '#888888',  // 被弾系 / grabbed / status_stun の汎用ラベル
};
function _getAiPhaseEl(idx) {
  while (_aiPhasePool.length <= idx) {
    const el = document.createElement('div');
    el.id = `enemy-ai-phase-${_aiPhasePool.length}`;
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '82';
    el.style.fontFamily = "'Courier New', monospace";
    el.style.fontSize = '14px';
    el.style.fontWeight = 'bold';
    el.style.textShadow = '0 0 4px #000, 2px 2px 0 #000';
    el.style.whiteSpace = 'nowrap';
    el.style.display = 'none';
    el.style.lineHeight = '1';
    (_hudLayerEl ?? document.body).appendChild(el);
    _aiPhasePool.push(el);
  }
  return _aiPhasePool[idx];
}
export function updateEnemyAiPhaseHud() {
  const enabled = !!(window.SB && window.SB.DEBUG_AI);
  for (let i = 0; i < _enemies.length; i++) {
    const e = _enemies[i];
    const el = _getAiPhaseEl(i);
    if (!enabled || !e.isAlive || e.state === STATE.enemy_dying) { el.style.display = 'none'; continue; }
    el.textContent = e.aiPhase || '-';
    el.style.color = _AI_PHASE_COLOR[e.aiPhase] || '#ffffff';
    _aiPhaseProj.set(e.x, e.y + 320, e.z);
    _aiPhaseProj.project(_camera);
    const frameX = (_aiPhaseProj.x * 0.5 + 0.5) * _gameWidth;
    const frameY = (-_aiPhaseProj.y * 0.5 + 0.5) * _gameHeight;
    el.style.left = frameX + 'px';
    el.style.top  = frameY + 'px';
    el.style.display = 'block';
  }
  // 過剰要素を隠す
  for (let i = _enemies.length; i < _aiPhasePool.length; i++) {
    _aiPhasePool[i].style.display = 'none';
  }
}

// ============================================================
//  ステータス：スタン可視化（Phase 3 placeholder）
//   - state===status_stun の敵頭上に黄色「★ STUN」を回転表示
//   - DEBUG_AI に依存せず常に表示（プレイヤーが把握すべきステータス）
//   - 将来 freeze / poison など他ステータスに拡張する場合は同形で追加
// ============================================================
function _getStunEl(idx) {
  while (_stunPool.length <= idx) {
    const el = document.createElement('div');
    el.id = `enemy-status-stun-${_stunPool.length}`;
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '83';
    el.style.fontFamily = "'Courier New', monospace";
    el.style.fontSize = '24px';
    el.style.fontWeight = 'bold';
    el.style.color = '#ffee44';
    el.style.textShadow = '0 0 6px #000, 2px 2px 0 #000';
    el.style.whiteSpace = 'nowrap';
    el.style.display = 'none';
    el.style.lineHeight = '1';
    (_hudLayerEl ?? document.body).appendChild(el);
    _stunPool.push(el);
  }
  return _stunPool[idx];
}
let _stunPhase = 0;
export function updateStatusStunHud() {
  _stunPhase = (_stunPhase + 1) % 60;
  // 回転表示用の星位置（簡易：3 つの星を時間で回す）
  const star = ['✦   ✦', ' ✦ ✦ ', '✦   ✦'][Math.floor(_stunPhase / 20)];
  for (let i = 0; i < _enemies.length; i++) {
    const e = _enemies[i];
    const el = _getStunEl(i);
    if (!e.isAlive || e.state !== STATE.status_stun) {
      el.style.display = 'none';
      continue;
    }
    el.textContent = star;
    _stunProj.set(e.x, e.y + 230, e.z);
    _stunProj.project(_camera);
    el.style.left = ((_stunProj.x * 0.5 + 0.5) * _gameWidth)  + 'px';
    el.style.top  = ((-_stunProj.y * 0.5 + 0.5) * _gameHeight) + 'px';
    el.style.display = 'block';
  }
  for (let i = _enemies.length; i < _stunPool.length; i++) {
    _stunPool[i].style.display = 'none';
  }
}
