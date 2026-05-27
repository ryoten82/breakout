// STAGE CLEAR 演出 + 次ステージ自動遷移（共通モジュール）
// 仕様：stages/stage01/layout.md §45-49
//
// triggerStageClear({ nextStageId }) で：
//   1. "STAGE CLEAR" バナーをフェードイン
//   2. CLEAR_TO_TRANSITION_MS 後、次ステージへ ?stage=<id> でリロード遷移
//   3. nextStageId が null/undefined の場合は "GAME CLEAR" 表示で停止
//
// MVP: URL リロード方式（scene 再構築の衝突リスク回避）。
// 将来 in-place 遷移にする時はここを差し替える。

import { showResultScreen } from '../../result-screen.js';

const CLEAR_TO_TRANSITION_MS = 5000;  // バナー表示 → 遷移開始までの待ち（コイン回収時間込み）
const FADE_OUT_MS = 800;              // 黒フェードアウト時間
const POLL_OC_INTERVAL_MS = 200;       // OC 完了ポーリング間隔
const GAME_CLEAR_AUTO_COLLECT_DELAY_MS = 1500;  // GAME CLEAR 表示からコイン自動回収開始まで
const GAME_CLEAR_RESULT_DELAY_MS = 5000;        // GAME CLEAR 表示からリザルト画面表示まで

let overlayEl = null;
let cleared = false;

function ensureOverlay() {
  if (overlayEl) return overlayEl;
  const el = document.createElement('div');
  el.id = 'stage-clear-overlay';
  el.style.cssText = [
    'position:fixed', 'inset:0',
    'background:rgba(0,0,0,0)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'color:#fff', 'font-family:var(--font-pixel)', 'font-weight:bold',
    'font-size:64px', 'letter-spacing:0.2em',
    'opacity:0', 'transition:opacity 1.5s ease, background 1.5s ease',
    'pointer-events:none', 'z-index:9999',
    'text-shadow:0 0 16px rgba(255,80,80,0.8)',
  ].join(';');
  el.textContent = 'STAGE CLEAR';
  document.body.appendChild(el);
  overlayEl = el;
  return el;
}

export function isStageCleared() {
  return cleared;
}

// 引数：
//   opts.nextStageId — 次ステージ ID（'stage02' 等）。null なら GAME CLEAR
export function triggerStageClear(opts = {}) {
  if (cleared) return;
  cleared = true;
  const nextStageId = opts.nextStageId || null;

  // OC 選択中（ボスドロップ OC ジェム滞在中 or カード選択中）はバナー表示を待機。
  // SB.isOcActive() が true の間ポーリングし、終わったら本体演出を開始。
  const _begin = () => _beginClearPresentation(nextStageId);
  const _checkOc = () => {
    const active = (typeof window !== 'undefined') && window.SB
      && typeof window.SB.isOcActive === 'function' && window.SB.isOcActive();
    if (active) {
      setTimeout(_checkOc, POLL_OC_INTERVAL_MS);
    } else {
      _begin();
    }
  };
  _checkOc();
}

function _beginClearPresentation(nextStageId) {
  const el = ensureOverlay();
  el.textContent = nextStageId ? 'STAGE CLEAR' : 'GAME CLEAR';
  // バナー表示中は背景を暗くしない（プレイ画面の戦利品収集を妨げない）
  requestAnimationFrame(() => {
    el.style.background = 'rgba(0,0,0,0)';
    el.style.opacity = '1';
  });

  if (!nextStageId) {
    // 最終ステージ：GAME CLEAR 表示後にフィールド上のコインを強制マグネット回収。
    // 取り逸し防止のため、SB.collectAllCR() を呼んでコインをプレイヤーへ吸引させる。
    setTimeout(() => {
      if (window.SB && typeof window.SB.collectAllCR === 'function') {
        window.SB.collectAllCR();
      }
    }, GAME_CLEAR_AUTO_COLLECT_DELAY_MS);
    // Act 通しクリア → リザルト画面（CR 回収完了を見せた後）
    setTimeout(() => {
      showResultScreen({ mode: 'clear' });
    }, GAME_CLEAR_RESULT_DELAY_MS);
    return;
  }

  setTimeout(() => {
    // 黒フェードアウト → リロード
    el.style.transition = `opacity ${FADE_OUT_MS}ms ease, background ${FADE_OUT_MS}ms ease`;
    el.style.background = 'rgba(0,0,0,1)';
    el.style.opacity = '1';
    setTimeout(() => {
      // 自動遷移先を sessionStorage に保存してリロード
      // → URL を汚さないので、後で F5 した時は stage01 から再スタートできる
      try {
        sessionStorage.setItem('_sbAutoTransition', nextStageId);
        // HP/SP 引継ぎ：次ステージ開始時に復元（HP は +30% ボーナス込みで適用）
        const _p = window.SB?.players?.[0];
        if (_p) {
          sessionStorage.setItem('_sbCarryHp',    String(_p.hp));
          sessionStorage.setItem('_sbCarryMaxHp', String(_p.maxHp));
          sessionStorage.setItem('_sbCarrySp',    String(_p.sp));
        }
        // CR 引継ぎ
        const _crVal = window.SB?.getCrTotal?.();
        if (_crVal != null) sessionStorage.setItem('_sbCarryCr', String(_crVal));
        // デバッグ HUD の表示状態を引継ぎ（html.dbg-hidden クラスで判定）
        const _hudHidden = document.documentElement.classList.contains('dbg-hidden');
        if (_hudHidden) sessionStorage.setItem('_sbDbgHidden', '1');
        else sessionStorage.removeItem('_sbDbgHidden');
        // OC カード引継ぎ：_ocAppliedCards の ID リストをそのまま保存
        const _ocCards = window.SB?._ocAppliedCards;
        if (Array.isArray(_ocCards) && _ocCards.length > 0) {
          sessionStorage.setItem('_sbCarryOC', JSON.stringify(_ocCards));
        } else {
          sessionStorage.removeItem('_sbCarryOC');
        }
      } catch (_) { /* ignore */ }
      window.location.reload();
    }, FADE_OUT_MS);
  }, CLEAR_TO_TRANSITION_MS);
}

export function resetStageClear() {
  cleared = false;
  if (overlayEl) {
    overlayEl.style.opacity = '0';
    overlayEl.style.background = 'rgba(0,0,0,0)';
  }
}
