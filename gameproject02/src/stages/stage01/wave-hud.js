// Stage 1 — WAVE n/N HUD（右上）
// 仕様：stages/stage01/layout.md §63-65

let hudEl = null;

function ensureHud() {
  if (hudEl) return hudEl;
  const el = document.createElement('div');
  el.id = 'wave-hud';
  el.style.cssText = [
    'position:fixed', 'top:12px', 'right:16px',
    'color:#fff', 'font-family:monospace', 'font-weight:bold',
    'font-size:18px', 'letter-spacing:0.15em',
    'padding:6px 12px',
    'background:rgba(0,0,0,0.55)',
    'border:1px solid rgba(255,80,80,0.6)',
    'text-shadow:0 0 6px rgba(255,80,80,0.7)',
    'pointer-events:none', 'z-index:9000',
    'display:none',
  ].join(';');
  document.body.appendChild(el);
  hudEl = el;
  return el;
}

export function initWaveHud() {
  ensureHud();
}

export function updateWaveHud(currentWave, totalWaves, visible) {
  const el = ensureHud();
  if (!visible) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';
  el.textContent = `WAVE ${currentWave}/${totalWaves}`;
}
