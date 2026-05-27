// リザルト画面（Act 通しクリア / ゲームオーバー 共通・2ページ構成）
// showResultScreen({ mode }) で overlay 表示。
// mode: 'clear' | 'gameover'
// 1枚目（戦績サマリ）→ ENTER → 2枚目（永続成長：機体LV / 総CR / チップ詳細）→ ENTER → タイトル復帰

import { finalizeRun, getRunStats } from './run-stats.js';

let overlayEl = null;
let _keyHandler = null;
let _shown = false;
let _currentPage = 1;
let _currentMode = 'clear';
let _currentStats = null;
let _selectedChipIdx = 0;
// 累計CR は 2 ページ目突入時に 1 回だけ確定（再レンダリングで重複加算しないため）
let _totalCrBefore = 0;
let _totalCrAfter = 0;
let _crAnimDone = false;  // CR カウントアップアニメが完了したか（チップ切替の再 render では最終値を保つ）
let _lvAnimDone = false;  // EXP ゲージアニメが完了したか
let _checkedChipIdxs = new Set();  // 売却チェック中のチップ idx
let _soldChipIdxs = new Set();     // 売却済みチップ idx（グレーアウトで残す）
let _focusZone = 'nextBtn';        // フォーカス領域：1枚目='nextBtn' / 2枚目='grid'|'sellBtn'|'backBtn'|'returnBtn'
let _lastGridCol = 0;              // grid を離れる直前の列（外部 → grid 復帰時に同じ列に戻す）
let _lastInputDevice = 'keyboard'; // 'keyboard' | 'pad' | 'mouse' — footer 表記の切替に使用
let _lastNonMouseInputTime = 0;    // 直近のキーボード/ゲームパッド入力 timestamp（マウス hover 抑止用）
const MOUSE_SUPPRESS_MS = 350;     // この時間内のキー/パッド入力直後はマウス hover を無視
let _animsCompleteOnce = false;    // 一度でも 2 ページ目のアニメが完了したか（戻り再訪時はアニメ skip）
let _animSkipRequested = false;    // アニメ中に決定キーが押されてスキップ要求が来たか
let _modalKind = null;             // null | 'rareConfirm' | 'confirm'
let _modalYesIdx = 0;              // 0=YES, 1=NO
let _modalPendingIdxs = [];        // 売却対象 idx 配列
let _modalPendingTotal = 0;        // 売却額合計

const HEADING_TEXT = {
  clear:    'ゲームクリア',
  gameover: 'ゲームオーバー',
};
const HEADING_COLOR = {
  clear:    '#ff9922',
  gameover: '#dd2222',
};
const HEADING_GLOW = {
  clear:    'rgba(255,153,34,0.7)',
  gameover: 'rgba(221,34,34,0.7)',
};

// チップレアリティ別の表示メタ（本実装でチップ図鑑が決まったら差し替え）
const CHIP_RARITY_INFO = {
  common:    { label: 'Common' },
  uncommon:  { label: 'Uncommon' },
  rare:      { label: 'Rare' },
  epic:      { label: 'Epic' },
  legendary: { label: 'Legendary' },
};

// 仮の売却額（仕様未確定。経済バランスは後日詰める）
const CHIP_SELL_PRICE = {
  common:    100,
  uncommon:  250,
  rare:      600,
  epic:     1500,
  legendary: 4000,
};
const RARE_PLUS = new Set(['epic', 'legendary']);  // 二重確認対象

// レアリティ別ダミー固有チップ名 + 効果テンプレ
//   本実装でチップ図鑑が決まったらここを差し替えて、表示側の改修は最小限で済む構造
const DUMMY_CHIP_POOL = {
  common: [
    { name: '弾薬補正Mk1',  stats: ['基本ダメージ +3%'] },
    { name: '装甲補正Mk1',  stats: ['最大HP +5%'] },
    { name: '機動補正Mk1',  stats: ['移動速度 +4%'] },
    { name: 'SP補正Mk1',    stats: ['SP回復速度 +5%'] },
  ],
  uncommon: [
    { name: '連射制御Mk2',  stats: ['J 連打速度 +8%', 'ヒットストップ -1F'] },
    { name: '反動緩和Mk2',  stats: ['SP発動時の硬直 -10%'] },
    { name: '対地強化Mk2',  stats: ['地上敵への基本ダメージ +8%'] },
  ],
  rare: [
    { name: '火力増強',     stats: ['基本ダメージ +12%', '与ダメ時 +1% クリ率'] },
    { name: '装甲強化',     stats: ['最大HP +15%', '被ダメ時 SP +5'] },
    { name: '加速制御',     stats: ['ダッシュ速度 +10%', 'ジャンプ初速 +8%'] },
  ],
  epic: [
    { name: '連鎖反応',     stats: ['延焼スプレッド範囲 +25%', '延焼DoT +15%'] },
    { name: 'クリティカル+', stats: ['基礎クリ率 +5%', 'クリ倍率 +20%'] },
    { name: 'コンボ加速',   stats: ['10コンボ毎にSP +5', 'コンボ中ダメ +8%'] },
  ],
  legendary: [
    { name: '焼夷一撃',     stats: ['通常攻撃にも延焼付与', '延焼DoT +30%', '延焼中の敵への基本ダメ +20%'] },
    { name: '不死鳥',       stats: ['HP0時に1度だけ50%復活', '復活時 OVERCLOCK 自動発動', '復活後 8s 完全無敵'] },
  ],
};

// 機体LV進行（2026-05-27 spec-talk 確定）
//   memory: project_scrapblitz_machine_lv.md「✅ EXP 計算式 確定」セクション参照
//   index = LV、value = その LV に到達するために必要な累計経験値
//   LV1→2:200, 2→3:500, 3→4:1000, 4→5:1500, 5→6:2000, 6→7:2500, 7→8:3500, 8→9:5000, 9→10:8000
const LV_TABLE = [0, 0, 200, 700, 1700, 3200, 5200, 7700, 11200, 16200, 24200];
const LV_MAX = 10;

// 完走ベースの基礎 EXP（spec-talk 確定）
const BASE_EXP_STAGE_CLEAR = { 1: 100, 2: 250, 3: 600 };
const BASE_EXP_DEATH_RATIO = 0.4;  // 死亡時はその時点 Stage 基礎の 40%

// UI テスト部屋・実装初期段階用のダミー（実プレイ時は recordStageClear/Reached で上書きされる想定）
const DUMMY_LV_BEFORE = 3;
const DUMMY_EXP_BEFORE = 320;  // LV3 (累計700) + 320 = 1020 → LV3 進行中

export function showResultScreen({ mode = 'clear' } = {}) {
  if (_shown) return;
  _shown = true;
  _currentMode = mode;
  _currentPage = 1;
  _focusZone = 'nextBtn';

  finalizeRun();
  _currentStats = getRunStats();

  const el = _ensureOverlay();
  _render();
  el.style.display = 'flex';

  requestAnimationFrame(() => {
    el.style.opacity = '1';
  });

  setTimeout(() => {
    _keyHandler = (e) => {
      // 最後の入力デバイスを追跡（footer 表記の自動切替用）
      _lastNonMouseInputTime = performance.now();
      if (_lastInputDevice !== 'keyboard') { _lastInputDevice = 'keyboard'; _render(); }
      // メニュー UI キーバインド（ゲーム本体の J=攻撃 / K=強攻撃 とは別系統・モード分離）
      //   J = 決定 / K = キャンセル
      //   方向キー（←↑↓→ / WASD）でフォーカス移動

      // モーダル中は限定キーのみ受付
      if (_modalKind) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault(); _modalYesIdx = 0; _render();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault(); _modalYesIdx = 1; _render();
        } else if (e.key === 'j' || e.key === 'J') {
          e.preventDefault();
          if (_modalYesIdx === 0) _onModalYes();
          else                    _onModalNo();
        } else if (e.key === 'k' || e.key === 'K') {
          e.preventDefault(); _onModalNo();
        }
        return;
      }

      // 通常時
      if (_currentPage === 1) {
        if (e.key === 'j' || e.key === 'J') {
          e.preventDefault(); _onAdvance();
        }
        return;
      }

      // 2 ページ目
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault(); _moveFocus(-1, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault(); _moveFocus(1, 0);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault(); _moveFocus(0, -1);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault(); _moveFocus(0, 1);
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (!_animsCompleteOnce) {
          _animSkipRequested = true;  // アニメ中はスキップ専用：他動作は発火しない
        } else {
          _onConfirmButton();
        }
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        // K = キャンセル：アニメ完了後のみ「戻る」相当として動く
        if (_animsCompleteOnce) _onBackToPage1();
      }
    };
    window.addEventListener('keydown', _keyHandler);
    _startGamepadPoll();
  }, 800);
}

// フォーカス中のボタンを「決定」相当で押下
function _onConfirmButton() {
  switch (_focusZone) {
    case 'grid':      _toggleChipCheck(); break;
    case 'sellBtn':   _openSellModal();   break;
    case 'backBtn':   if (_animsCompleteOnce) _onBackToPage1(); break;
    case 'returnBtn': if (_animsCompleteOnce) _restart();        break;
    case 'nextBtn':   _onAdvance(); break;
  }
}

function _toggleChipCheck() {
  if (!_currentStats?.chips) return;
  const i = _selectedChipIdx;
  if (i < 0 || i >= _currentStats.chips.length) return;  // 空セル / 範囲外は無効
  if (_soldChipIdxs.has(i)) return;                      // 売却済みは操作不可
  if (_checkedChipIdxs.has(i)) _checkedChipIdxs.delete(i);
  else                         _checkedChipIdxs.add(i);
  _render();
}

function _openSellModal() {
  if (_checkedChipIdxs.size === 0) return;
  _modalPendingIdxs = [..._checkedChipIdxs];
  _modalPendingTotal = _calcSellTotal(_modalPendingIdxs);
  _modalYesIdx = 0;
  // 順序：通常確認 → (希少含む場合のみ) 希少確認 → 売却
  _modalKind = 'confirm';
  _render();
}

function _onModalYes() {
  if (_modalKind === 'confirm') {
    // 希少（EPIC 以上）を含んでいたら追加確認へ
    const hasRare = _modalPendingIdxs.some(i => RARE_PLUS.has(_currentStats?.chips?.[i]));
    if (hasRare) {
      _modalKind = 'rareConfirm';
      _modalYesIdx = 0;
      _render();
    } else {
      _processSell();
    }
  } else if (_modalKind === 'rareConfirm') {
    _processSell();
  }
}

function _onModalNo() {
  _modalKind = null;
  _modalPendingIdxs = [];
  _modalPendingTotal = 0;
  _render();
}

function _processSell() {
  const total = _modalPendingTotal;
  for (const i of _modalPendingIdxs) _soldChipIdxs.add(i);
  _checkedChipIdxs.clear();
  _modalKind = null;
  _modalPendingIdxs = [];
  _modalPendingTotal = 0;

  // 総 CR にカウントアップ：_totalCrBefore は「アニメ前の現在値」、_totalCrAfter は加算後
  _totalCrBefore = _totalCrAfter;
  _totalCrAfter += total;
  try { localStorage.setItem('_sbTotalCr', String(_totalCrAfter)); } catch (_) {}
  _crAnimDone = false;
  _render();
  setTimeout(_animateCr, 50);
}

export function hideResultScreen() {
  if (overlayEl) {
    overlayEl.style.opacity = '0';
    overlayEl.style.display = 'none';
  }
  if (_keyHandler) {
    window.removeEventListener('keydown', _keyHandler);
    _keyHandler = null;
  }
  _stopGamepadPoll();
  _shown = false;
  _currentPage = 1;
}

// ── ゲームパッド対応 ──────────────────────────────────────
// リザルト表示中はメインループ停止のため、ここで独自に poll ループを回す。
// 押下エッジ検出（前フレ未押下 → 今フレ押下）で反応。
const _padPrev = {
  up: false, down: false, left: false, right: false,
  a: false, b: false, x: false,
};
let _padRafId = null;

function _startGamepadPoll() {
  if (_padRafId != null) return;
  const tick = () => {
    _pollGamepadOnce();
    _padRafId = requestAnimationFrame(tick);
  };
  _padRafId = requestAnimationFrame(tick);
}

function _stopGamepadPoll() {
  if (_padRafId != null) cancelAnimationFrame(_padRafId);
  _padRafId = null;
  for (const k of Object.keys(_padPrev)) _padPrev[k] = false;
}

function _pollGamepadOnce() {
  if (!_shown) return;
  const pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : [];
  let pad = null;
  for (const p of pads) { if (p && p.connected) { pad = p; break; } }
  if (!pad) return;

  // D-pad or 左スティック（dead zone 0.5）
  const ax = pad.axes[0] ?? 0;
  const ay = pad.axes[1] ?? 0;
  const padLeft  = (pad.buttons[14]?.pressed) || ax < -0.5;
  const padRight = (pad.buttons[15]?.pressed) || ax >  0.5;
  const padUp    = (pad.buttons[12]?.pressed) || ay < -0.5;
  const padDown  = (pad.buttons[13]?.pressed) || ay >  0.5;
  const padA     = !!pad.buttons[0]?.pressed;  // 確定 (ENTER 相当)
  const padB     = !!pad.buttons[1]?.pressed;  // キャンセル (ESC 相当)
  const padX     = !!pad.buttons[2]?.pressed;  // チェック (J 相当)

  // 最後の入力デバイス追跡（押下エッジでパッド検知）
  const anyPadEdge = (padLeft && !_padPrev.left) || (padRight && !_padPrev.right)
                  || (padUp   && !_padPrev.up)   || (padDown  && !_padPrev.down)
                  || (padA    && !_padPrev.a)    || (padB     && !_padPrev.b)
                  || (padX    && !_padPrev.x);
  if (anyPadEdge) {
    _lastNonMouseInputTime = performance.now();
    if (_lastInputDevice !== 'pad') { _lastInputDevice = 'pad'; _render(); }
  }

  // モーダル中
  if (_modalKind) {
    if (padLeft  && !_padPrev.left)  { _modalYesIdx = 0; _render(); }
    if (padRight && !_padPrev.right) { _modalYesIdx = 1; _render(); }
    if (padA && !_padPrev.a) { (_modalYesIdx === 0 ? _onModalYes : _onModalNo)(); }
    if (padB && !_padPrev.b) { _onModalNo(); }
  } else {
    // 通常時
    if (padA && !_padPrev.a) {
      if (_currentPage === 2 && !_animsCompleteOnce) {
        _animSkipRequested = true;
      } else {
        _onConfirmButton();
      }
    }
    if (padB && !_padPrev.b && _currentPage === 2 && _animsCompleteOnce) {
      _onBackToPage1();
    }
    if (_currentPage === 2) {
      if (padLeft  && !_padPrev.left)  _moveFocus(-1, 0);
      if (padRight && !_padPrev.right) _moveFocus(1, 0);
      if (padUp    && !_padPrev.up)    _moveFocus(0, -1);
      if (padDown  && !_padPrev.down)  _moveFocus(0,  1);
      if (padX     && !_padPrev.x)     {
        if (!_animsCompleteOnce) {
          _animSkipRequested = true;
        } else if (_focusZone === 'grid') {
          _toggleChipCheck();
        } else {
          _onConfirmButton();
        }
      }
    }
  }
  _padPrev.left = padLeft; _padPrev.right = padRight;
  _padPrev.up   = padUp;   _padPrev.down  = padDown;
  _padPrev.a    = padA;    _padPrev.b     = padB;    _padPrev.x = padX;
}

export function isResultShown() {
  return _shown;
}

// メインループからの参照用に window 露出（dynamic import 経路でも参照できるよう）
if (typeof window !== 'undefined') {
  window.SB = window.SB || {};
  window.SB.isResultShown = isResultShown;
}

function _onAdvance() {
  if (_currentPage === 1) {
    _currentPage = 2;
    _selectedChipIdx = 0;
    _focusZone = 'grid';
    if (_animsCompleteOnce) {
      // 再訪：アニメは既に終わっているので最終値を即表示・再加算もしない
      _crAnimDone = true;
      _lvAnimDone = true;
      _render();
    } else {
      _crAnimDone = false;
      _lvAnimDone = false;
      _animSkipRequested = false;
      _commitTotalCr();
      _render();
      setTimeout(() => {
        _animateCr();
        _animateLv();
      }, 80);
    }
  }
}

function _onBackToPage1() {
  // 2 ページ目 → 1 ページ目に戻る（アニメ完了後のみ呼ばれる前提）
  if (!_animsCompleteOnce) return;
  _currentPage = 1;
  _focusZone = 'nextBtn';
  _render();
}

function _checkAnimsComplete() {
  if (_crAnimDone && _lvAnimDone && !_animsCompleteOnce) {
    _animsCompleteOnce = true;
    _animSkipRequested = false;
    _render();  // 戻る / 帰投 ボタンの enable を反映
  }
}

function _animateCr() {
  const startTotal = _totalCrBefore;
  const endTotal = _totalCrAfter;
  const earned = _currentStats?.crEarned ?? 0;
  const duration = 1400;
  const startTime = performance.now();

  const step = (now) => {
    const t = _animSkipRequested ? 1 : Math.min(1, (now - startTime) / duration);
    // easeOutCubic
    const ease = 1 - Math.pow(1 - t, 3);
    const curTotal  = Math.round(startTotal + (endTotal - startTotal) * ease);
    const curEarned = Math.round(earned * (1 - ease));

    const totalEl  = overlayEl?.querySelector('.result-cr-total');
    const earnedEl = overlayEl?.querySelector('.result-cr-earned');
    if (totalEl)  totalEl.textContent  = curTotal.toLocaleString();
    if (earnedEl) earnedEl.textContent = `(今回 +${curEarned.toLocaleString()})`;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      _crAnimDone = true;
      // パルス強調：完了時に短いポップ
      if (totalEl) {
        totalEl.classList.remove('result-cr-pop');
        void totalEl.offsetWidth;
        totalEl.classList.add('result-cr-pop');
      }
      _checkAnimsComplete();
    }
  };
  requestAnimationFrame(step);
}

// 累計CR を localStorage に 1 回だけ加算（snapshot を _totalCrBefore/After に保持）
function _commitTotalCr() {
  const earned = _currentStats?.crEarned ?? 0;
  let before = 0;
  try {
    before = parseInt(localStorage.getItem('_sbTotalCr') || '0', 10) || 0;
  } catch (_) {}
  const after = before + earned;
  try {
    localStorage.setItem('_sbTotalCr', String(after));
  } catch (_) {}
  _totalCrBefore = before;
  _totalCrAfter = after;
}

// フォーカス遷移：grid → sellBtn → backBtn ↔ returnBtn（縦並びの体）
const CHIP_GRID_COLS = 10;
const CHIP_GRID_ROWS_MIN = 3;
function _gridCellCount() {
  const n = _currentStats?.chips?.length || 0;
  return Math.max(CHIP_GRID_COLS * CHIP_GRID_ROWS_MIN, n);
}
function _moveFocus(dx, dy = 0) {
  if (!_currentStats?.chips) return;
  const total = _gridCellCount();

  if (_focusZone === 'returnBtn' || _focusZone === 'backBtn') {
    if (dx === -1) { _focusZone = 'backBtn';   _render(); return; }
    if (dx ===  1) { _focusZone = 'returnBtn'; _render(); return; }
    if (dy === -1) { _focusZone = 'sellBtn';   _render(); return; }
    if (dy ===  1 && _focusZone === 'returnBtn') {
      // 帰投 → ↓ で grid 最上行・記憶した列へ
      _focusZone = 'grid';
      _selectedChipIdx = Math.min(total - 1, _lastGridCol);
      _render();
      return;
    }
    return;
  }

  if (_focusZone === 'sellBtn') {
    if (dy === -1) {
      _focusZone = 'grid';
      const lastRowFirst = Math.floor((total - 1) / CHIP_GRID_COLS) * CHIP_GRID_COLS;
      _selectedChipIdx = Math.min(total - 1, lastRowFirst + _lastGridCol);
      _render();
    } else if (dy === 1) {
      _focusZone = 'returnBtn';
      _render();
    }
    return;
  }

  // grid
  if (dy !== 0) {
    const next = _selectedChipIdx + dy * CHIP_GRID_COLS;
    if (next >= 0 && next < total) {
      _selectedChipIdx = next;
      _lastGridCol = next % CHIP_GRID_COLS;
      _render();
    } else if (dy === 1) {
      _lastGridCol = _selectedChipIdx % CHIP_GRID_COLS;
      _focusZone = 'sellBtn';
      _render();
    } else if (dy === -1) {
      _lastGridCol = _selectedChipIdx % CHIP_GRID_COLS;
      _focusZone = 'returnBtn';
      _render();
    }
    return;
  }
  if (dx !== 0) {
    _selectedChipIdx = (_selectedChipIdx + dx + total) % total;
    _lastGridCol = _selectedChipIdx % CHIP_GRID_COLS;
    _render();
  }
}

function _setChipFocus(idx) {
  if (!_currentStats || !_currentStats.chips) return;
  const total = _gridCellCount();
  if (idx < 0 || idx >= total) return;
  _selectedChipIdx = idx;
  _lastGridCol = idx % CHIP_GRID_COLS;
  _focusZone = 'grid';
  _render();
}

// マウス hover をキーボード/パッド操作直後は無視する gate
// （直近 MOUSE_SUPPRESS_MS 以内のキー/パッド入力があれば true → hover 抑止）
function _isMouseSuppressed() {
  return (performance.now() - _lastNonMouseInputTime) < MOUSE_SUPPRESS_MS;
}

// マウス入力時に呼ぶ：device を 'mouse' に切替
function _markMouseInput() {
  if (_lastInputDevice !== 'mouse') {
    _lastInputDevice = 'mouse';
    _render();
  }
}

function _restart() {
  try {
    sessionStorage.removeItem('_sbAutoTransition');
    sessionStorage.removeItem('_sbCarryHp');
    sessionStorage.removeItem('_sbCarryMaxHp');
    sessionStorage.removeItem('_sbCarrySp');
    sessionStorage.removeItem('_sbCarryCr');
    sessionStorage.removeItem('_sbCarryOC');
  } catch (_) {}
  window.location.reload();
}

function _ensureOverlay() {
  if (overlayEl) return overlayEl;
  const el = document.createElement('div');
  el.id = 'result-overlay';
  el.style.display = 'none';
  document.body.appendChild(el);
  overlayEl = el;
  return el;
}

function _render() {
  if (!overlayEl) return;
  // ボタン click 等で activeElement に残ったフォーカスを解除しておく（J キーが効かない問題対策）
  try { if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); } catch (_) {}
  overlayEl.innerHTML = (_currentPage === 1)
    ? _renderPage1(_currentMode, _currentStats)
    : _renderPage2(_currentMode, _currentStats);
  // hover 系は「キー/パッド操作直後は無視」する gate を全部に挟む（マウスとキー操作の競合防止）
  const hover = (fn) => () => { if (_isMouseSuppressed()) return; _markMouseInput(); fn(); };
  const click = (fn) => () => { _markMouseInput(); fn(); };

  // 1 ページ目「次へ」ボタン
  if (_currentPage === 1) {
    const nextBtn = overlayEl.querySelector('#result-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('mouseenter', hover(() => { _focusZone = 'nextBtn'; _render(); }));
      nextBtn.addEventListener('click', click(_onAdvance));
    }
  }
  // チップグリッドのマウス操作 bind（2 ページ目のみ）
  if (_currentPage === 2) {
    const grid = overlayEl.querySelector('#result-chip-grid');
    if (grid) {
      grid.querySelectorAll('.result-chip-cell').forEach(cell => {
        if (!cell.dataset.chipIdx) return;
        const idx = parseInt(cell.dataset.chipIdx, 10);
        cell.addEventListener('mouseenter', hover(() => _setChipFocus(idx)));
        cell.addEventListener('click',      click(() => _setChipFocus(idx)));
      });
    }
    const sellBtn = overlayEl.querySelector('#result-chip-sell-btn');
    if (sellBtn) {
      sellBtn.addEventListener('mouseenter', hover(() => { _focusZone = 'sellBtn'; _render(); }));
      sellBtn.addEventListener('click', click(_openSellModal));
    }
    const backBtn = overlayEl.querySelector('#result-back-btn');
    if (backBtn) {
      backBtn.addEventListener('mouseenter', hover(() => { _focusZone = 'backBtn'; _render(); }));
      backBtn.addEventListener('click', click(() => { if (_animsCompleteOnce) _onBackToPage1(); }));
    }
    const returnBtn = overlayEl.querySelector('#result-return-btn');
    if (returnBtn) {
      returnBtn.addEventListener('mouseenter', hover(() => { _focusZone = 'returnBtn'; _render(); }));
      returnBtn.addEventListener('click', click(() => { if (_animsCompleteOnce) _restart(); }));
    }
    const yesBtn = overlayEl.querySelector('#result-modal-yes');
    if (yesBtn) {
      yesBtn.addEventListener('mouseenter', hover(() => { _modalYesIdx = 0; _render(); }));
      yesBtn.addEventListener('click', click(_onModalYes));
    }
    const noBtn = overlayEl.querySelector('#result-modal-no');
    if (noBtn) {
      noBtn.addEventListener('mouseenter', hover(() => { _modalYesIdx = 1; _render(); }));
      noBtn.addEventListener('click', click(_onModalNo));
    }
  }
}

function _renderPage1(mode, s) {
  const headingText = HEADING_TEXT[mode] || HEADING_TEXT.clear;
  const headingColor = HEADING_COLOR[mode] || HEADING_COLOR.clear;
  const headingGlow = HEADING_GLOW[mode] || HEADING_GLOW.clear;

  return `
    <div class="result-card">
      <div class="result-heading" style="color:${headingColor}; text-shadow: 0 0 24px ${headingGlow}, 3px 3px 0 #000;">
        ${headingText}
      </div>
      <div class="result-page-indicator">1 / 2 ・ 戦績サマリ</div>

      <div class="result-section-title">── 戦績 ──</div>
      <div class="result-rows">
        ${_row('プレイ時間',  s.timeStr)}
        ${_row('撃破数',      s.kills)}
        ${_row('残りHP',      s.hpPct + '%')}
        ${_row('獲得CR',      s.crEarned.toLocaleString())}
      </div>

      <div class="result-section-title">── 与ダメージ ──</div>
      <div class="result-rows">
        ${_row('総合ダメージ', s.damageTotal.toLocaleString())}
        ${_subRow('├ 基本ダメージ', s.damageBase.toLocaleString())}
        ${_subRow('└ 属性ダメージ', s.damageElement.toLocaleString())}
      </div>

      <div class="result-section-title">── 戦闘評価 ──</div>
      <div class="result-rows">
        ${_row('最大コンボ',     s.maxCombo)}
        ${_row('RC成功',         s.rcSuccess)}
        ${_row('クリティカル',   s.critical)}
      </div>

      <div class="result-page-actions">
        <button id="result-next-btn" class="result-action-btn result-action-btn--primary result-action-btn--focused" type="button">
          [${_btn('confirm')}] 次へ ▶
        </button>
      </div>
    </div>
  `;
}

function _renderPage2(mode, s) {
  const headingText = HEADING_TEXT[mode] || HEADING_TEXT.clear;
  const headingColor = HEADING_COLOR[mode] || HEADING_COLOR.clear;
  const headingGlow = HEADING_GLOW[mode] || HEADING_GLOW.clear;

  return `
    <div class="result-card result-card--page2">
      <div class="result-heading" style="color:${headingColor}; text-shadow: 0 0 24px ${headingGlow}, 3px 3px 0 #000;">
        ${headingText}
      </div>
      <div class="result-page-indicator">2 / 2 ・ 永続成長</div>

      <div class="result-page2-columns">
        <div class="result-page2-left">
          ${_renderMachineLvSection(s)}
          ${_renderCrSection(s)}
        </div>
        <div class="result-page2-right">
          ${_renderChipDetailSection(s)}
        </div>
      </div>

      <div class="result-page-actions">
        <button id="result-back-btn" class="result-action-btn${_animsCompleteOnce ? '' : ' result-action-btn--disabled'}${_focusZone === 'backBtn' ? ' result-action-btn--focused' : ''}" type="button">
          ◀ 戻る
        </button>
        <button id="result-return-btn" class="result-action-btn result-action-btn--primary${_animsCompleteOnce ? '' : ' result-action-btn--disabled'}${_focusZone === 'returnBtn' ? ' result-action-btn--focused' : ''}" type="button">
          帰投 ▶
        </button>
      </div>
    </div>
  `;
}

// ── 機体LV経験値 ─────────────────────────────────────────
function _renderMachineLvSection(s) {
  const calc = _computeLvProgress(s);

  const lvLabel = calc.lvUp
    ? `LV ${DUMMY_LV_BEFORE} → <span class="result-lv-up">${calc.lvAfter}</span>`
    : (calc.isMax ? `LV <span class="result-lv-up">${calc.lvAfter}</span> [MAX]`
                  : `LV <span class="result-lv-up">${calc.lvAfter}</span>`);

  const barLabel = calc.isMax
    ? 'MAX LV'
    : `${calc.intoLvAfter.toLocaleString()} / ${calc.lvSpanAfter.toLocaleString()} ・ 次のLVまで ${Math.max(0, calc.lvSpanAfter - calc.intoLvAfter).toLocaleString()}`;

  // EXP 内訳（デバッグ表示・window.SB.DEBUG_EXP_BREAKDOWN = true で出る）
  const bd = calc.breakdown;
  const bonusPct = bd.base > 0 ? Math.round((bd.bonus / bd.base) * 100) : 0;
  const showBreakdown = !!(typeof window !== 'undefined' && window.SB?.DEBUG_EXP_BREAKDOWN);
  const breakdownHtml = showBreakdown ? `
      <div class="result-lv-breakdown">
        [DEBUG] 基礎 ${bd.base} + 戦績 +${bd.bonus} (${bonusPct >= 0 ? '+' : ''}${bonusPct}%)
        <span class="result-lv-breakdown-sub">[撃破 +${bd.killBonus} / RC +${bd.rcBonus} / 残HP +${bd.hpBonus}]</span>
      </div>` : '';

  // バー：base (アニメ前から既にあった分) + gain (今回光って伸びる分)
  //   アニメ未完了：base のみ表示、gain は JS でアニメ中に幅を伸ばす
  //   アニメ完了後：base + gain が合算（gain は光ったまま残す）
  const basePct = calc.basePct;
  const gainPct = _lvAnimDone ? calc.gainPct : 0;

  // 表示用 +EXP（アニメ未完了は満額、完了後は 0）
  const expDisplay = _lvAnimDone ? 0 : calc.expGained;

  return `
    <div class="result-section-title">── 機体LV (METEO) ──</div>
    <div class="result-lv-block">
      <div class="result-lv-header">
        <span class="result-lv-text">${lvLabel}</span>
        <span class="result-lv-exp">+${expDisplay.toLocaleString()} EXP</span>
      </div>
      <div class="result-lv-bar-outer">
        <div class="result-lv-bar-base" style="width:${basePct}%"></div>
        <div class="result-lv-bar-gain" style="width:${gainPct}%"></div>
      </div>
      <div class="result-lv-bar-label">${barLabel}</div>
      ${breakdownHtml}
    </div>
  `;
}

// LV 進行の計算結果を 1 オブジェクトにまとめる（render とアニメで共有）
function _computeLvProgress(s) {
  const breakdown = _computeExpGained(s, _currentMode);
  const expGained = breakdown.total;
  const expBeforeTotal = _expForLv(DUMMY_LV_BEFORE) + DUMMY_EXP_BEFORE;
  const expAfterTotal  = expBeforeTotal + expGained;

  let lvAfter = DUMMY_LV_BEFORE;
  while (lvAfter < LV_MAX && expAfterTotal >= LV_TABLE[lvAfter + 1]) {
    lvAfter++;
  }
  const lvUp  = lvAfter > DUMMY_LV_BEFORE;
  const isMax = lvAfter >= LV_MAX;

  // アニメ完了時の LV バー（最終 LV 内での進行）
  const curLvBase  = LV_TABLE[lvAfter] ?? 0;
  const nextLvNeed = isMax ? curLvBase : (LV_TABLE[lvAfter + 1] ?? (curLvBase + 1));
  const intoLvAfter = expAfterTotal - curLvBase;
  const lvSpanAfter = Math.max(1, nextLvNeed - curLvBase);
  const totalPct = isMax ? 100 : Math.max(0, Math.min(100, (intoLvAfter / lvSpanAfter) * 100));

  // base = アニメ前から既にあった進行％。LV アップ時は 0（最終 LV のバーで描き直し）
  const basePct = lvUp ? 0 : Math.max(0, Math.min(100, (DUMMY_EXP_BEFORE / lvSpanAfter) * 100));
  // gain = 今回光って伸びる差分
  const gainPct = Math.max(0, totalPct - basePct);

  return {
    breakdown, expGained,
    lvAfter, lvUp, isMax,
    intoLvAfter, lvSpanAfter,
    basePct, gainPct, totalPct,
  };
}

function _animateLv() {
  if (!_currentStats) return;
  const calc = _computeLvProgress(_currentStats);
  const targetGain = calc.gainPct;
  const earned = calc.expGained;
  const duration = 1400;
  const startTime = performance.now();

  const step = (now) => {
    const t = _animSkipRequested ? 1 : Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const curGain   = targetGain * ease;
    const curEarned = Math.round(earned * (1 - ease));

    const gainEl = overlayEl?.querySelector('.result-lv-bar-gain');
    const expEl  = overlayEl?.querySelector('.result-lv-exp');
    if (gainEl) gainEl.style.width = curGain + '%';
    if (expEl)  expEl.textContent  = `+${curEarned.toLocaleString()} EXP`;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      _lvAnimDone = true;
      const outer = overlayEl?.querySelector('.result-lv-bar-outer');
      if (outer) {
        outer.classList.remove('result-lv-bar-pop');
        void outer.offsetWidth;
        outer.classList.add('result-lv-bar-pop');
      }
      _checkAnimsComplete();
    }
  };
  requestAnimationFrame(step);
}

function _expForLv(lv) {
  return LV_TABLE[Math.min(lv, LV_MAX)] || 0;
}

// EXP 計算（2026-05-27 spec-talk 確定式）
//   基礎 = 完走ベース（Stage1=100 / Stage2=250 / Stage3=600・死亡時はその40%）
//   戦績ボーナス = 撃破数(max+10%) + RC成功(+2%/個 max+5%) + 残HP%(残HP% × 10% / max+10%)
//   合計上限 = 基礎の +25%（実質 +20% 程度）
function _computeExpGained(s, mode) {
  // 現状 stage track 機構がないため、暫定で mode から base を決める
  //   clear → 中編完走想定 950 (= stage1+2+3 合算)
  //   gameover → stage1 中で死亡相当 40 (= 100 × 0.4)
  // 本実装時は run-stats に recordStageClear/Reached を追加して合算する
  const base = (mode === 'gameover')
    ? Math.round(BASE_EXP_STAGE_CLEAR[1] * BASE_EXP_DEATH_RATIO)
    : (BASE_EXP_STAGE_CLEAR[1] + BASE_EXP_STAGE_CLEAR[2] + BASE_EXP_STAGE_CLEAR[3]);

  // 戦績ボーナス
  // 撃破数：max +10%（全敵撃破想定の暫定基準値 40 体）
  const KILL_FULL = 40;
  const killPctRaw = Math.min(0.10, (s.kills / KILL_FULL) * 0.10);
  // RC 成功：+2% per、max +5%
  const rcPctRaw = Math.min(0.05, s.rcSuccess * 0.02);
  // 残HP%：残HP% × 10%（満タン +10% / 半分 +5%）
  const hpPctRaw = (s.hpPct / 100) * 0.10;

  // 合計上限 +25%
  const totalBonusRatio = Math.min(0.25, killPctRaw + rcPctRaw + hpPctRaw);

  const killBonus = Math.round(base * killPctRaw);
  const rcBonus   = Math.round(base * rcPctRaw);
  const hpBonus   = Math.round(base * hpPctRaw);
  const bonus     = Math.min(Math.round(base * 0.25), killBonus + rcBonus + hpBonus);

  return {
    base,
    bonus,
    total: base + bonus,
    killBonus,
    rcBonus,
    hpBonus,
  };
}

// ── 総CR ────────────────────────────────────────────────
// 累計CR の加算は _commitTotalCr で 2 ページ目突入時に 1 回だけ実施。
// ここでは snapshot した値を表示するのみ。
function _renderCrSection(s) {
  // アニメ未完了：開始値で出力（_animateCr が DOM 直接書き換えで進める）
  // アニメ完了後 or 再レンダリング：最終値で出力
  const totalNow  = _crAnimDone ? _totalCrAfter : _totalCrBefore;
  const earnedNow = _crAnimDone ? 0             : s.crEarned;
  return `
    <div class="result-section-title">── 総CR（永続） ──</div>
    <div class="result-cr-block">
      <div class="result-cr-total">${totalNow.toLocaleString()}</div>
      <div class="result-cr-earned">(今回 +${earnedNow.toLocaleString()})</div>
    </div>
  `;
}

// ── チップ詳細（アイコングリッド + 選択中の詳細パネル） ──
function _renderChipDetailSection(s) {
  const chipsLen = s?.chips?.length || 0;

  // インデックスごとの固有チップを決定的に生成（取得順 + rarity を seed に）
  const detailed = (s?.chips || []).map((rk, i) => _resolveChipAt(rk, i));

  // 格子（3 行 × 10 列 = 30 セル最低保証・超過分はスクロール）
  const totalCells = Math.max(CHIP_GRID_COLS * CHIP_GRID_ROWS_MIN, chipsLen);

  // フォーカス補正（空セルにも飛べる）
  if (_selectedChipIdx >= totalCells) _selectedChipIdx = totalCells - 1;
  if (_selectedChipIdx < 0) _selectedChipIdx = 0;

  const cells = [];
  for (let i = 0; i < totalCells; i++) {
    const focusedCls = (i === _selectedChipIdx && _focusZone === 'grid') ? ' result-chip-cell--focused' : '';
    if (i < chipsLen) {
      const checkedCls = _checkedChipIdxs.has(i) ? ' result-chip-cell--checked' : '';
      const soldCls    = _soldChipIdxs.has(i)    ? ' result-chip-cell--sold'    : '';
      const checkMark  = _checkedChipIdxs.has(i) ? '<span class="result-chip-check">✓</span>' : '';
      cells.push(`<button class="result-chip-cell${focusedCls}${checkedCls}${soldCls}" data-chip-idx="${i}" type="button">
        <span class="result-chip-icon result-chip-icon--${detailed[i].rarity}"></span>
        ${checkMark}
      </button>`);
    } else {
      // 空セルもフォーカス可（オレンジ枠が見える）
      cells.push(`<button class="result-chip-cell result-chip-cell--empty${focusedCls}" data-chip-idx="${i}" type="button"></button>`);
    }
  }
  const grid = cells.join('');

  // 売却ボタン（チェック数 + 売却額プレビュー）
  const sellTotal = _calcSellTotal([..._checkedChipIdxs]);
  const sellBtnDisabled = _checkedChipIdxs.size === 0 ? ' result-chip-sell-btn--disabled' : '';
  const sellBtnFocused  = (_focusZone === 'sellBtn') ? ' result-chip-sell-btn--focused' : '';
  const sellBtn = `
    <div class="result-chip-sell-actions">
      <button id="result-chip-sell-btn" class="result-chip-sell-btn${sellBtnDisabled}${sellBtnFocused}" type="button">
        チェック項目を売却 (${_checkedChipIdxs.size}) ${sellTotal > 0 ? `／ +${sellTotal.toLocaleString()} CR` : ''}
      </button>
    </div>
  `;

  const sel = detailed[_selectedChipIdx];
  const panelInner = sel ? `
      <div class="result-chip-panel-header">
        <span class="result-chip-icon result-chip-icon--${sel.rarity}"></span>
        <span class="result-chip-panel-name result-chip-detail-label--${sel.rarity}">${sel.name}</span>
        <span class="result-chip-panel-rarity result-chip-detail-label--${sel.rarity}">[${CHIP_RARITY_INFO[sel.rarity].label}]</span>
      </div>
      <ul class="result-chip-panel-stats">${sel.stats.map(t => `<li>${t}</li>`).join('')}</ul>
  ` : `
      <div class="result-chip-panel-empty">— 空き枠 —</div>
  `;

  return `
    <div class="result-section-title">── 獲得チップ詳細 (${chipsLen - _soldChipIdxs.size}/${chipsLen}) ──</div>
    <div class="result-chip-grid" id="result-chip-grid">${grid}</div>
    ${sellBtn}
    <div class="result-chip-panel">
      ${panelInner}
      <div class="result-chip-panel-hint">← ↑ ↓ → 選択 ・ [${_btn('check')}] チェック / 決定 ・ [${_btn('cancel')}] 戻る</div>
    </div>
    ${_renderModal()}
  `;
}

// 売却額合算
// 操作ボタン表記（最後の入力デバイスで自動切替）
//   action: 'confirm' | 'cancel' | 'check'
function _btn(action) {
  const pad = (_lastInputDevice === 'pad');
  if (action === 'confirm') return pad ? '↓' : 'J';
  if (action === 'cancel')  return pad ? '→' : 'K';
  if (action === 'check')   return pad ? '←' : 'J';
  return '?';
}

function _calcSellTotal(idxs) {
  if (!_currentStats?.chips) return 0;
  let sum = 0;
  for (const i of idxs) {
    const rk = _currentStats.chips[i];
    sum += CHIP_SELL_PRICE[rk] || 0;
  }
  return sum;
}

// 確認モーダル HTML
function _renderModal() {
  if (!_modalKind) return '';
  const isRare = _modalKind === 'rareConfirm';
  const text = isRare
    ? '希少なチップの売却となりますがよろしいですか？'
    : `これらのチップを売却してよろしいですか？（売却額：+${_modalPendingTotal.toLocaleString()} CR）`;
  const yesCls = (_modalYesIdx === 0) ? ' result-modal-btn--focused' : '';
  const noCls  = (_modalYesIdx === 1) ? ' result-modal-btn--focused' : '';
  return `
    <div class="result-modal-backdrop">
      <div class="result-modal">
        <div class="result-modal-text">${text}</div>
        <div class="result-modal-buttons">
          <button id="result-modal-yes" class="result-modal-btn${yesCls}" type="button">YES</button>
          <button id="result-modal-no"  class="result-modal-btn${noCls}" type="button">NO</button>
        </div>
      </div>
    </div>
  `;
}

// rarity + index から決定的に固有チップを引く（同じセッションなら同じ並び）
function _resolveChipAt(rarity, idx) {
  const pool = DUMMY_CHIP_POOL[rarity] || DUMMY_CHIP_POOL.common;
  const pick = pool[idx % pool.length];
  return { rarity, name: pick.name, stats: pick.stats };
}

// ── 共通ヘルパ ──────────────────────────────────────────
function _row(label, value) {
  return `<div class="result-row"><span class="result-label">${label}</span><span class="result-value">${value}</span></div>`;
}

function _subRow(label, value) {
  return `<div class="result-row result-row--sub"><span class="result-label">${label}</span><span class="result-value">${value}</span></div>`;
}

function _chipList(chips) {
  if (!chips || chips.length === 0) {
    return '<span class="result-chip-none">— なし —</span>';
  }
  return chips.map(rk => {
    const cls = `result-chip-icon result-chip-icon--${rk}`;
    return `<span class="${cls}" title="${rk}"></span>`;
  }).join('');
}
