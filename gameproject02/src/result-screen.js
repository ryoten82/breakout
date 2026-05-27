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

// 機体LV進行（たたき台ダミー）
//   実際の経験値計算式は memory: project_scrapblitz_machine_lv.md を参照して後日詰める
const LV_TABLE = [0, 100, 250, 500, 900, 1500, 2300, 3300];  // index = LV、value = 累計経験値
const DUMMY_LV_BEFORE = 3;
const DUMMY_EXP_BEFORE = 380;

export function showResultScreen({ mode = 'clear' } = {}) {
  if (_shown) return;
  _shown = true;
  _currentMode = mode;
  _currentPage = 1;

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
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        _onAdvance();
      } else if (_currentPage === 2) {
        // 2 ページ目：左右キーでチップフォーカス移動
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          _moveChipFocus(-1);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          _moveChipFocus(1);
        }
      }
    };
    window.addEventListener('keydown', _keyHandler);
  }, 800);
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
  _shown = false;
  _currentPage = 1;
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
    _commitTotalCr();
    _render();
  } else {
    _restart();
  }
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

function _moveChipFocus(delta) {
  if (!_currentStats || !_currentStats.chips || _currentStats.chips.length === 0) return;
  const n = _currentStats.chips.length;
  _selectedChipIdx = (_selectedChipIdx + delta + n) % n;
  _render();
}

function _setChipFocus(idx) {
  if (!_currentStats || !_currentStats.chips) return;
  if (idx < 0 || idx >= _currentStats.chips.length) return;
  _selectedChipIdx = idx;
  _render();
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
  overlayEl.innerHTML = (_currentPage === 1)
    ? _renderPage1(_currentMode, _currentStats)
    : _renderPage2(_currentMode, _currentStats);
  // チップグリッドのマウス操作 bind（2 ページ目のみ）
  if (_currentPage === 2) {
    const grid = overlayEl.querySelector('#result-chip-grid');
    if (grid) {
      grid.querySelectorAll('.result-chip-cell').forEach(cell => {
        const idx = parseInt(cell.dataset.chipIdx, 10);
        cell.addEventListener('mouseenter', () => _setChipFocus(idx));
        cell.addEventListener('click',      () => _setChipFocus(idx));
      });
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

      <div class="result-section-title">── 獲得チップ (${s.chips.length}) ──</div>
      <div class="result-chip-list">
        ${_chipList(s.chips)}
      </div>

      <div class="result-footer">[ENTER] 詳細へ ▶</div>
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

      ${_renderMachineLvSection(s)}

      ${_renderCrSection(s)}

      ${_renderChipDetailSection(s)}

      <div class="result-footer">[ENTER] タイトルへ</div>
    </div>
  `;
}

// ── 機体LV経験値 ─────────────────────────────────────────
function _renderMachineLvSection(s) {
  // 今回ランで稼いだ経験値（ダミー式：撃破×10 + ダメージ÷10 + 最大コンボ×5）
  const expGained = (s.kills * 10) + Math.floor(s.damageTotal / 10) + (s.maxCombo * 5);
  const expBefore = DUMMY_EXP_BEFORE;
  const expAfterTotal = expBefore + _expForLv(DUMMY_LV_BEFORE) + expGained;

  let lvAfter = DUMMY_LV_BEFORE;
  while (lvAfter + 1 < LV_TABLE.length && expAfterTotal >= LV_TABLE[lvAfter + 1]) {
    lvAfter++;
  }
  const lvUp = lvAfter > DUMMY_LV_BEFORE;
  const curLvBase = LV_TABLE[lvAfter] ?? 0;
  const nextLvNeed = LV_TABLE[lvAfter + 1] ?? (curLvBase + 1);
  const intoLv = expAfterTotal - curLvBase;
  const lvSpan = nextLvNeed - curLvBase;
  const pct = Math.max(0, Math.min(100, Math.round((intoLv / lvSpan) * 100)));

  const lvLabel = lvUp
    ? `LV ${DUMMY_LV_BEFORE} → <span class="result-lv-up">${lvAfter}</span> ${'★'.repeat(lvAfter - DUMMY_LV_BEFORE)}`
    : `LV ${lvAfter}`;

  return `
    <div class="result-section-title">── 機体LV (METEO) ──</div>
    <div class="result-lv-block">
      <div class="result-lv-header">
        <span class="result-lv-text">${lvLabel}</span>
        <span class="result-lv-exp">+${expGained.toLocaleString()} EXP</span>
      </div>
      <div class="result-lv-bar-outer">
        <div class="result-lv-bar-inner" style="width:${pct}%"></div>
      </div>
      <div class="result-lv-bar-label">${intoLv.toLocaleString()} / ${lvSpan.toLocaleString()} ・ 次のLVまで ${Math.max(0, lvSpan - intoLv).toLocaleString()}</div>
    </div>
  `;
}

function _expForLv(lv) {
  return LV_TABLE[Math.min(lv, LV_TABLE.length - 1)] || 0;
}

// ── 総CR ────────────────────────────────────────────────
// 累計CR の加算は _commitTotalCr で 2 ページ目突入時に 1 回だけ実施。
// ここでは snapshot した値を表示するのみ。
function _renderCrSection(s) {
  return `
    <div class="result-section-title">── 総CR（永続） ──</div>
    <div class="result-rows">
      ${_row('今回獲得',  '+' + s.crEarned.toLocaleString())}
      ${_subRow('├ 累計CR (前)', _totalCrBefore.toLocaleString())}
      ${_subRow('└ 累計CR (後)', _totalCrAfter.toLocaleString())}
    </div>
  `;
}

// ── チップ詳細（アイコングリッド + 選択中の詳細パネル） ──
function _renderChipDetailSection(s) {
  if (!s.chips || s.chips.length === 0) {
    return `
      <div class="result-section-title">── 獲得チップ詳細 ──</div>
      <div class="result-chip-detail-empty">— なし —</div>
    `;
  }

  // インデックスごとの固有チップを決定的に生成（取得順 + rarity を seed に）
  const detailed = s.chips.map((rk, i) => _resolveChipAt(rk, i));

  // フォーカス補正
  if (_selectedChipIdx >= detailed.length) _selectedChipIdx = detailed.length - 1;
  if (_selectedChipIdx < 0) _selectedChipIdx = 0;

  const grid = detailed.map((c, i) => {
    const focused = (i === _selectedChipIdx) ? ' result-chip-cell--focused' : '';
    return `<button class="result-chip-cell${focused}" data-chip-idx="${i}" type="button">
      <span class="result-chip-icon result-chip-icon--${c.rarity}"></span>
    </button>`;
  }).join('');

  const sel = detailed[_selectedChipIdx];
  const stats = sel.stats.map(s => `<li>${s}</li>`).join('');

  return `
    <div class="result-section-title">── 獲得チップ詳細 (${s.chips.length}) ──</div>
    <div class="result-chip-grid" id="result-chip-grid">${grid}</div>
    <div class="result-chip-panel">
      <div class="result-chip-panel-header">
        <span class="result-chip-icon result-chip-icon--${sel.rarity}"></span>
        <span class="result-chip-panel-name result-chip-detail-label--${sel.rarity}">${sel.name}</span>
        <span class="result-chip-panel-rarity result-chip-detail-label--${sel.rarity}">[${CHIP_RARITY_INFO[sel.rarity].label}]</span>
      </div>
      <ul class="result-chip-panel-stats">${stats}</ul>
      <div class="result-chip-panel-hint">← → でチップを選択</div>
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
