// ============================================================
//  SCRAP BLITZ — hud-system（分離 Phase: Step E-2）
//
//  HUD 更新ロジックを集約：
//    - updateSPGauge / spawnSPStockRing  SP バー + ストック表示 + 充填エッジ演出
//    - updateHpHud                      HP バー + 危機点滅
//    - updateGrabGauge                  グラブ中の頭上ゲージ（world→screen 投影）
//
//  ES Module として index.html から import される：
//    import {
//      initHudSystem,
//      updateSPGauge, updateHpHud, updateGrabGauge,
//    } from './src/hud-system.js';
//
//  initHudSystem(deps) で依存を一括注入：
//    - THREE: Three.js モジュール（Vector3 ファクトリ用）
//    - players, enemies
//    - camera
//    - DOM refs（spBarEl / spStockNumEl / hpBarEl / hpNumEl /
//                grabGaugeEl / grabGaugeFillEl / hudLayerEl）
//    - gameWidth, gameHeight: 数値
//
//  SP_CONFIG / GRAB_CONFIG / STATE は ESM 直接 import。
// ============================================================

import { SP_CONFIG, GRAB_CONFIG, REPULSE_CONFIG, ENEMY_ATTACKS } from './config.js';
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
let _grabGaugeProj = null;
let _aiPhaseProj = null;
const _aiPhasePool = [];
let _stunProj = null;
const _stunPool = [];
let _detonateProj = null;
const _detonatePool = [];
let _personaProj = null;
const _personaPool = [];
let _dmgProj = null;
const _dmgNumbers = [];   // 飛び交うダメージ数値（{ x,y,z,vy,vx,life,maxLife,crit,el }）
const _dmgNumPool = [];   // DOM 要素プール（_inUse で借用管理）
let _repulseHudEl = null; // 「危↑」リパルスカウンター受付インジケータ
let _repulsePulse  = 0;   // 点滅アニメ用カウンタ
let _playerBuffHudEl = null; // プレイヤーバフアイコンコンテナ

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
  _grabGaugeProj = new _THREE.Vector3();
  _aiPhaseProj = new _THREE.Vector3();
  _stunProj = new _THREE.Vector3();
  _personaProj = new _THREE.Vector3();
  _dmgProj = new _THREE.Vector3();
  _detonateProj = new _THREE.Vector3();
  _repulseHudEl   = deps.repulseHudEl   ?? document.getElementById('repulse-hud');
  _playerBuffHudEl = deps.playerBuffHudEl ?? document.getElementById('player-buff-hud');
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
  // SP 色：通常時エメラルドグリーン（pickup SP タンクと色同期）/ MAX 時はやや明るく
  _spBarEl.style.background = atMax ? '#44ee99' : '#22cc88';
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
    el.style.fontFamily = "var(--font-pixel)";
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
    el.style.fontFamily = "var(--font-pixel)";
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

// ============================================================
//  デバッグ：敵の性格ラベル（#14・HP ゲージの上に常時表示）
//   - brave＝橙 / cunning＝紫。興奮中は末尾に「!」
//   - 性格システム（dodge/guard 頻度差）の確認用
// ============================================================
const _PERSONALITY_COLOR = {
  brave:   '#ff8844',  // 攻撃的＝橙
  cunning: '#bb77ff',  // 狡猾＝紫
};
function _getPersonaEl(idx) {
  while (_personaPool.length <= idx) {
    const el = document.createElement('div');
    el.id = `enemy-personality-${_personaPool.length}`;
    el.style.position = 'absolute';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '82';
    el.style.fontFamily = "var(--font-pixel)";
    el.style.fontSize = '13px';
    el.style.fontWeight = 'bold';
    el.style.textShadow = '0 0 4px #000, 2px 2px 0 #000';
    el.style.whiteSpace = 'nowrap';
    el.style.display = 'none';
    el.style.lineHeight = '1';
    (_hudLayerEl ?? document.body).appendChild(el);
    _personaPool.push(el);
  }
  return _personaPool[idx];
}
export function updateEnemyPersonalityHud() {
  for (let i = 0; i < _enemies.length; i++) {
    const e = _enemies[i];
    const el = _getPersonaEl(i);
    if (!e.isAlive || e.state === STATE.enemy_dying || e.dying) {
      el.style.display = 'none';
      continue;
    }
    el.textContent = (e.personality || '?').toUpperCase() + (e.enraged ? '!' : '');
    el.style.color = _PERSONALITY_COLOR[e.personality] || '#ffffff';
    // HP ゲージ（yOffset 220）の少し上に投影
    _personaProj.set(e.x, e.y + 255, e.z);
    _personaProj.project(_camera);
    el.style.left = ((_personaProj.x * 0.5 + 0.5) * _gameWidth)  + 'px';
    el.style.top  = ((-_personaProj.y * 0.5 + 0.5) * _gameHeight) + 'px';
    el.style.display = 'block';
  }
  for (let i = _enemies.length; i < _personaPool.length; i++) {
    _personaPool[i].style.display = 'none';
  }
}

// ============================================================
//  ダメージ数値ポップアップ（プレイヤー攻撃ヒット時の与ダメージ表示）
//   - spawnDamageNumber(x,y,z,amount,opts) でヒット位置にポップを生成
//   - updateDamageNumbers() を毎 update フレームで呼ぶ：画面空間で上昇 + フェード
//     （spawn 時に一度だけ world→screen 投影し、以降はカメラ非追従で固定上昇）
//   - DOM 要素はプール再利用（_inUse フラグで借用管理）
//   - opts.crit:true で強調表示（クリティカル攻撃・タスク #13 で使用）
// ============================================================
const _DMG_NUM_LIFE = 46;   // 表示寿命F（≒0.77 秒）

function _getDmgNumEl() {
  for (const el of _dmgNumPool) {
    if (!el._inUse) { el._inUse = true; return el; }
  }
  const el = document.createElement('div');
  el.className = 'dmg-number';
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '84';
  el.style.fontFamily = "var(--font-pixel)";
  el.style.fontWeight = 'bold';
  el.style.whiteSpace = 'nowrap';
  el.style.lineHeight = '1';
  el.style.display = 'none';
  el._inUse = true;
  (_hudLayerEl ?? document.body).appendChild(el);
  _dmgNumPool.push(el);
  return el;
}

// 1 個分の見た目反映（画面空間で上昇フェード + スケールポップ）。
//   座標は画面空間 sx/sy。カメラのシェイク・パンに追従しないので攻撃中もブレない。
function _renderDmgNumber(d) {
  const t   = d.life / d.maxLife;          // 1→0
  const age = 1 - t;                       // 0→1
  const alpha = (t >= 0.5) ? 1 : (t / 0.5);  // 寿命後半 50% で透明へ
  const scale = 0.4 + 0.6 * Math.min(1, age / 0.12);  // 0.4→1.0 の素早いポップ
  d.el.style.left = d.sx + 'px';
  d.el.style.top  = d.sy + 'px';
  d.el.style.opacity = alpha;
  d.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

export function spawnDamageNumber(x, y, z, amount, opts = {}) {
  const crit = !!opts.crit;
  const el = _getDmgNumEl();
  el.textContent = Math.round(amount);
  // 通常：白／クリティカル：橙＋大きめ／盾ダメージ：水色（本体ダメージと区別）
  if (opts.shield) {
    el.style.color = '#88ccff';
    el.style.fontSize = '32px';
    el.style.textShadow = '0 0 8px #2266aa, 2px 2px 0 #000';
  } else if (crit) {
    el.style.color = '#ff9922';
    el.style.fontSize = '52px';
    el.style.textShadow = '0 0 12px #ff5500, 0 0 6px #000, 3px 3px 0 #000';
  } else {
    el.style.color = '#ffffff';
    el.style.fontSize = '38px';
    el.style.textShadow = '0 0 6px #000, 2px 2px 0 #000';
  }
  el.style.display = 'block';
  // ヒット位置を spawn 時に一度だけ画面座標へ投影 → 以降は画面空間で固定上昇。
  //   カメラのシェイク／パンに追従しないので、攻撃中も数字がブレず読みやすい。
  let sx = _gameWidth / 2, sy = _gameHeight / 2;
  if (_camera && _dmgProj) {
    _dmgProj.set(x, y, z);
    _dmgProj.project(_camera);
    sx = (_dmgProj.x * 0.5 + 0.5) * _gameWidth;
    sy = (-_dmgProj.y * 0.5 + 0.5) * _gameHeight;
  }
  const d = {
    // 多段ヒットの完全重なりを避けるため X に微小ばらつき（控えめ）
    sx: sx + (Math.random() - 0.5) * 30,
    sy,
    rise: 3.4,                        // 画面上方向の上昇初速（px/F）
    life: _DMG_NUM_LIFE, maxLife: _DMG_NUM_LIFE,
    crit, el,
  };
  _dmgNumbers.push(d);
  _renderDmgNumber(d);  // spawn フレームから正しい位置・透明度で表示
}

export function updateDamageNumbers() {
  for (let i = _dmgNumbers.length - 1; i >= 0; i--) {
    const d = _dmgNumbers[i];
    d.life--;
    d.sy -= d.rise;   // 画面上方向へ（y は下が +）
    d.rise *= 0.90;   // 上昇減速（ふわっと止まる）
    if (d.life <= 0) {
      d.el.style.display = 'none';
      d.el._inUse = false;
      _dmgNumbers.splice(i, 1);
      continue;
    }
    _renderDmgNumber(d);
  }
}

// ============================================================
//  バナー表示（"SHIELD BREAK!" 等・大きな一時テキストを画面上部中央に）
//   - spawnBanner(text, opts) で表示。opts: { frames, color, fontSize }
//   - updateBanners() を毎 update フレームで呼ぶ：フェードイン → 保持 → フェードアウト
//   - DOM 要素はプール再利用（_inUse フラグで借用管理）
// ============================================================
const _banners = [];
const _bannerPool = [];

function _getBannerEl() {
  for (const el of _bannerPool) {
    if (!el._inUse) { el._inUse = true; return el; }
  }
  const el = document.createElement('div');
  el.className = 'hud-banner';
  el.style.position = 'absolute';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '86';
  el.style.left = '50%';
  el.style.top = '18%';
  el.style.fontFamily = "var(--font-pixel)";
  el.style.fontWeight = 'bold';
  el.style.whiteSpace = 'nowrap';
  el.style.lineHeight = '1';
  el.style.display = 'none';
  el._inUse = true;
  (_hudLayerEl ?? document.body).appendChild(el);
  _bannerPool.push(el);
  return el;
}

// 1 個分の見た目反映（フェードイン → 保持 → フェードアウト + スケールポップ）
function _renderBanner(b) {
  const t   = b.life / b.maxLife;   // 1→0
  const age = 1 - t;                // 0→1
  let alpha = 1;
  if (age < 0.12)      alpha = age / 0.12;   // 先頭 12% でフェードイン
  else if (t   < 0.35) alpha = t   / 0.35;   // 末尾 35% でフェードアウト
  const pop = 0.7 + 0.3 * Math.min(1, age / 0.10);  // 素早いスケールポップ
  b.el.style.opacity = alpha;
  b.el.style.transform = `translate(-50%, -50%) scale(${pop})`;
}

export function spawnBanner(text, opts = {}) {
  const frames = opts.frames ?? 60;
  const el = _getBannerEl();
  el.textContent = text;
  el.style.color = opts.color ?? '#ffcc22';
  el.style.fontSize = (opts.fontSize ?? 56) + 'px';
  el.style.textShadow = '0 0 16px #ff6600, 3px 3px 0 #000';
  el.style.display = 'block';
  const b = { el, life: frames, maxLife: frames };
  _banners.push(b);
  _renderBanner(b);
}

export function updateBanners() {
  for (let i = _banners.length - 1; i >= 0; i--) {
    const b = _banners[i];
    b.life--;
    if (b.life <= 0) {
      b.el.style.display = 'none';
      b.el._inUse = false;
      _banners.splice(i, 1);
      continue;
    }
    _renderBanner(b);
  }
}

// ============================================================
//  リパルスカウンター受付インジケータ（「危 ↑」）
//  repulseWindow=true の敵が存在する間だけ表示。点滅で緊急度を伝える。
// ============================================================
export function updateRepulseHud() {
  if (!_repulseHudEl || !_enemies) return;
  // 受付中の敵を探して軸アイコンを取得
  let _axisIcon = null;
  for (const e of _enemies) {
    if (e.repulseWindow && e.curAtkId) {
      // boss_overdrive は _odSlotAxis でスロットごとに軸が変わる
      const _axis = e._odSlotAxis ?? ENEMY_ATTACKS[e.curAtkId]?.repulseAxis;
      if (_axis) { _axisIcon = REPULSE_CONFIG.AXIS_ICON?.[_axis] ?? '!'; break; }
    }
  }
  if (_axisIcon) {
    _repulsePulse++;
    // 12F 周期で点滅（点灯 8F / 暗転 4F）
    const _lit = (_repulsePulse % 12) < 8;
    _repulseHudEl.style.display  = 'block';
    _repulseHudEl.style.opacity  = _lit ? '1' : '0.25';
    _repulseHudEl.textContent    = `危 ${_axisIcon}`;
  } else {
    _repulsePulse = 0;
    _repulseHudEl.style.display  = 'none';
  }
}

// ============================================================
//  敵ステータスアイコン列（本番採用想定）
//   各敵の頭上に 🔥❄️☠️ 等のアイコンを横並びで表示。
//   将来のデバフ追加時は _buildStatusIcons に行を足すだけで拡張可。
//   上段固定パネルはデバッグ用（detonateTimer カウント等）。
// ============================================================

// --- 敵追従ステータスアイコン行（per-enemy） ---
let _ignitePanelEl = null;
function _getIgnitePanelEl() {
  if (_ignitePanelEl) return _ignitePanelEl;
  const el = document.createElement('div');
  el.style.position    = 'absolute';
  el.style.top         = '4px';
  el.style.left        = '50%';
  el.style.transform   = 'translateX(-50%)';
  el.style.pointerEvents = 'none';
  el.style.zIndex      = '999';
  el.style.fontFamily  = "var(--font-pixel)";
  el.style.fontSize    = '13px';
  el.style.fontWeight  = 'bold';
  el.style.textShadow  = '0 0 4px #000, 1px 1px 0 #000';
  el.style.whiteSpace  = 'nowrap';
  el.style.display     = 'none';
  (_hudLayerEl ?? document.body).appendChild(el);
  _ignitePanelEl = el;
  return el;
}

function _getStatusIconEl(idx) {
  while (_detonatePool.length <= idx) {
    const el = document.createElement('div');
    el.style.position    = 'absolute';
    el.style.transform   = 'translate(-50%, -50%)';
    el.style.pointerEvents = 'none';
    el.style.zIndex      = '84';
    el.style.fontSize    = '20px';           // アイコン本体サイズ
    el.style.lineHeight  = '1';
    el.style.display     = 'flex';
    el.style.gap         = '2px';
    el.style.alignItems  = 'center';
    el.style.display     = 'none';
    (_hudLayerEl ?? document.body).appendChild(el);
    _detonatePool.push(el);
  }
  return _detonatePool[idx];
}

// デバフアイコン列を構築して innerHTML で返す
// 将来ステータス追加時はここに行を追加するだけ
function _buildStatusIcons(e) {
  let html = '';
  if (e.burnTimer > 0 || e.burnBlastReady || e.detonateTimer > 0) {
    // 🔥 = 延焼中（起爆準備状態も同じアイコン）/ 💥N = 起爆カウント中
    if (e.detonateTimer > 0) html += `<span>💥<span style="font-size:12px;vertical-align:middle">${e.detonateTimer}</span></span>`;
    else                     html += `<span>🔥</span>`;
  }
  // 将来: if (e.freezeTimer > 0) html += '<span title="氷結">❄️</span>';
  // 将来: if (e.poisonTimer > 0) html += '<span title="毒">☠️</span>';
  return html;
}

// ============================================================
//  プレイヤーバフアイコン（BERSERK 等）
//  表示ルール：
//    - 最大 4 件まで縦積み表示
//    - 下に行くほど opacity を落としてフェード感を演出
//    - 5 件目以降は「＋N 非表示」として最終行に明示
// ============================================================

const _BUFF_MAX_VISIBLE = 4;
// 上から順に opacity（4 段階）
const _BUFF_OPACITY = [1.0, 0.85, 0.65, 0.45];

function _collectActiveBuffs(p) {
  const buffs = [];
  if (window.SB?.OC_FLAGS?.berserk) {
    const ratio = p.hp / p.maxHp;
    if (ratio < 0.25) {
      buffs.push({ cls: 'pbuff-icon berserk-2', label: '⚡ BERSERK ×1.4' });
    } else if (ratio < 0.50) {
      buffs.push({ cls: 'pbuff-icon berserk-1', label: '⚡ BERSERK ×1.2' });
    }
    // HP50%以上のとき BERSERK はスタンバイ状態（アイコン非表示）
  }
  // 将来バフはここに push する
  return buffs;
}

export function updatePlayerStatusHud() {
  if (!_playerBuffHudEl || !_players) return;
  const p = _players[0];
  if (!p) { _playerBuffHudEl.innerHTML = ''; return; }

  const buffs = _collectActiveBuffs(p);
  if (buffs.length === 0) { _playerBuffHudEl.innerHTML = ''; return; }

  const visible   = buffs.slice(0, _BUFF_MAX_VISIBLE);
  const overflow  = buffs.length - _BUFF_MAX_VISIBLE;
  // 5件目以降がある場合、最後の枠を overflow 表示に置き換える
  if (overflow > 0) {
    visible[_BUFF_MAX_VISIBLE - 1] = {
      cls:   'pbuff-icon pbuff-overflow',
      label: `＋${overflow + 1} 非表示`,
    };
  }

  _playerBuffHudEl.innerHTML = visible.map((b, i) => {
    const op = _BUFF_OPACITY[i] ?? 0.45;
    return `<span class="${b.cls}" style="opacity:${op}">${b.label}</span>`;
  }).join('');
}

export function updateDetonateTimerHud() {
  if (!_enemies) return;
  const panel = _getIgnitePanelEl();
  const debugParts = [];

  for (let i = 0; i < _enemies.length; i++) {
    const e = _enemies[i];
    const iconEl = _getStatusIconEl(i);
    const hasAny = e.isAlive && !e.dying &&
      (e.burnTimer > 0 || e.burnBlastReady || e.detonateTimer > 0);

    if (!hasAny || !_detonateProj) {
      iconEl.style.display = 'none';
    } else {
      iconEl.innerHTML = _buildStatusIcons(e);
      _detonateProj.set(e.x, e.y + 200, e.z);   // HP バー相当の高さ
      _detonateProj.project(_camera);
      iconEl.style.left    = ((_detonateProj.x * 0.5 + 0.5) * _gameWidth)  + 'px';
      iconEl.style.top     = ((-_detonateProj.y * 0.5 + 0.5) * _gameHeight) + 'px';
      iconEl.style.display = 'flex';
    }

    // 固定デバッグパネル用
    if (e.isAlive && !e.dying && e.detonateTimer > 0) {
      debugParts.push(`[${i}]<span style="color:#ff2200">💥${e.detonateTimer}</span>`);
    }
  }
  for (let i = _enemies.length; i < _detonatePool.length; i++) _detonatePool[i].style.display = 'none';

  // 固定パネル（blastReady と detonateTimer だけ表示。通常の 🔥 は敵追従で十分）
  if (debugParts.length > 0) {
    panel.innerHTML = debugParts.join('  ');
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}
