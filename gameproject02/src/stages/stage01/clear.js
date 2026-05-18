// Stage 1 — STAGE CLEAR 演出（最小構成）
// 仕様：stages/stage01/layout.md §45-49

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

export function triggerStageClear() {
  if (cleared) return;
  cleared = true;
  const el = ensureOverlay();
  requestAnimationFrame(() => {
    el.style.background = 'rgba(0,0,0,0.6)';
    el.style.opacity = '1';
  });
}

export function resetStageClear() {
  cleared = false;
  if (overlayEl) {
    overlayEl.style.opacity = '0';
    overlayEl.style.background = 'rgba(0,0,0,0)';
  }
}
