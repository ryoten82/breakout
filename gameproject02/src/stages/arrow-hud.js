// ウェーブクリア時の「→」誘導 HUD（ベルスク定番）
// stages 共通モジュール。各ステージの runner から show/hide を呼ぶ。
//
// 表示タイミング：releaseLock() の直後（次ウェーブへ移動可能になった瞬間）
// 非表示タイミング：
//   - 次ウェーブ spawn 時 / ステージクリア時（明示 hide）
//   - 表示後 AUTO_HIDE_MS 経過で自動 fadeout（プレイヤーが進んでいなくても見続けない）

const AUTO_HIDE_MS = 4000;

let arrowEl = null;
let autoHideTimer = null;

function ensureArrow() {
  if (arrowEl) return arrowEl;
  const el = document.createElement('div');
  el.id = 'stage-arrow-hud';
  // build-info（更新 HUD）と同じ親要素に append して座標系を揃える
  // build-info は top:56px + 約 70-80px 高 = 下端 ~130〜140 なので top:160 で直下に
  const buildInfo = document.getElementById('build-info');
  const parent = buildInfo?.parentElement || document.body;
  el.style.cssText = [
    'position:absolute', 'top:240px', 'right:var(--sp-lg, 24px)',
    'color:#ffe44a', 'font-family:monospace', 'font-weight:bold',
    'font-size:140px', 'line-height:1',
    'text-shadow:0 0 20px rgba(255,200,40,0.9), 0 0 40px rgba(255,120,0,0.6)',
    'opacity:0', 'transition:opacity 0.35s ease',
    'pointer-events:none', 'z-index:100',
    'animation:stage-arrow-pulse 0.55s ease-in-out infinite alternate',
  ].join(';');
  el.textContent = '→';
  parent.appendChild(el);
  // pulse keyframes（右方向に少しスライドして呼吸）
  if (!document.getElementById('stage-arrow-kf')) {
    const style = document.createElement('style');
    style.id = 'stage-arrow-kf';
    // keyframes に opacity を含めると inline opacity:0 を上書きして消えなくなる。
    // フェードイン/アウトは inline style の opacity だけで制御し、ここは transform のみ
    style.textContent =
      '@keyframes stage-arrow-pulse {' +
      ' from { transform: translateX(0); }' +
      ' to   { transform: translateX(14px); }' +
      '}';
    document.head.appendChild(style);
  }
  arrowEl = el;
  return el;
}

export function showArrowHud() {
  const el = ensureArrow();
  el.style.opacity = '1';
  // 既存タイマーを破棄して再カウント（連続 show でも 4 秒は出続ける）
  if (autoHideTimer !== null) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
  autoHideTimer = setTimeout(() => {
    if (arrowEl) arrowEl.style.opacity = '0';
    autoHideTimer = null;
  }, AUTO_HIDE_MS);
}

export function hideArrowHud() {
  if (!arrowEl) return;
  arrowEl.style.opacity = '0';
  if (autoHideTimer !== null) {
    clearTimeout(autoHideTimer);
    autoHideTimer = null;
  }
}
