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

const CLEAR_TO_TRANSITION_MS = 3000;  // バナー表示 → 遷移開始までの待ち
const FADE_OUT_MS = 800;              // 黒フェードアウト時間

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
    'color:#fff', 'font-family:monospace', 'font-weight:bold',
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
  const el = ensureOverlay();
  el.textContent = nextStageId ? 'STAGE CLEAR' : 'GAME CLEAR';
  requestAnimationFrame(() => {
    el.style.background = 'rgba(0,0,0,0.6)';
    el.style.opacity = '1';
  });

  if (!nextStageId) return;  // 最終ステージは遷移なし

  setTimeout(() => {
    // 黒フェードアウト → リロード
    el.style.transition = `opacity ${FADE_OUT_MS}ms ease, background ${FADE_OUT_MS}ms ease`;
    el.style.background = 'rgba(0,0,0,1)';
    el.style.opacity = '1';
    setTimeout(() => {
      // ?stage=<id> でリロード遷移
      window.location.search = `?stage=${encodeURIComponent(nextStageId)}`;
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
