// ミッション制限時間 HUD（画面上中央・大きめ数字）
// 仕様：MISSION_TIMER_CONFIG（config.js）と連携。表示は MM:SS 形式。
//   0 到達でプレイヤー強制死亡（呼び出し側でハンドル）。

import { MISSION_TIMER_CONFIG } from '../config.js';

let hudEl = null;

function ensureHud() {
  if (hudEl) return hudEl;
  const cfg = MISSION_TIMER_CONFIG;
  const el = document.createElement('div');
  el.id = 'mission-timer-hud';
  el.style.cssText = [
    'position:fixed',
    'top:84px',
    'left:50%',
    'transform:translateX(-50%)',
    `font-size:${cfg.HUD_FONT_SIZE_PX}px`,
    'font-family:var(--font-pixel)',
    'font-weight:bold',
    `color:${cfg.HUD_COLOR_NORMAL}`,
    'letter-spacing:0.10em',
    'padding:4px 24px',
    'background:rgba(0,0,0,0.55)',
    'border:2px solid rgba(255,238,68,0.55)',
    'border-radius:4px',
    'text-shadow:0 0 12px rgba(255,238,68,0.7), 0 2px 0 #000',
    'pointer-events:none',
    'z-index:9000',
    'display:none',
  ].join(';');
  document.body.appendChild(el);
  hudEl = el;
  return el;
}

function _formatTime(sec) {
  return String(Math.max(0, Math.ceil(sec)));
}

export function showMissionTimer() {
  ensureHud().style.display = 'block';
}

export function hideMissionTimer() {
  if (hudEl) hudEl.style.display = 'none';
}

export function updateMissionTimerHud(secondsLeft, frozen) {
  const el = ensureHud();
  const cfg = MISSION_TIMER_CONFIG;
  el.textContent = _formatTime(secondsLeft);
  // 色 / 点滅切替
  let color = cfg.HUD_COLOR_NORMAL;
  let borderRgba = '255,238,68';
  if (frozen) {
    // ボス戦突入でグレーアウト・点滅なし
    color = '#888888';
    borderRgba = '120,120,120';
    el.style.animation = '';
  } else if (secondsLeft <= cfg.CRITICAL_THRESHOLD_SEC) {
    color = cfg.HUD_COLOR_CRITICAL;
    borderRgba = '255,68,68';
    el.style.animation = 'mission-timer-blink 0.5s infinite alternate';
  } else if (secondsLeft <= cfg.WARN_THRESHOLD_SEC) {
    color = cfg.HUD_COLOR_WARN;
    borderRgba = '255,136,68';
    el.style.animation = '';
  } else {
    el.style.animation = '';
  }
  el.style.color = color;
  el.style.borderColor = `rgba(${borderRgba}, 0.65)`;
  el.style.textShadow = `0 0 12px rgba(${borderRgba}, 0.85), 0 2px 0 #000`;
}

// 点滅 keyframes をドキュメントに 1 度だけ注入
(function _injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mission-timer-style')) return;
  const style = document.createElement('style');
  style.id = 'mission-timer-style';
  style.textContent = `
    @keyframes mission-timer-blink {
      0%   { opacity: 1.0; }
      100% { opacity: 0.35; }
    }
  `;
  document.head.appendChild(style);
})();
