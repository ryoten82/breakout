// Stage 3 ボス登場演出（第1段・2026-05-24）
// 仕様：stages/stage03/deep-design.md §5.5（簡略版）
//
// プレイヤーが BOSS wave triggerX に到達した瞬間に起動。stage03 が wave-runner.tick を
// 演出中はスキップし、終了後に runner が BOSS を通常通り spawn する。
//
// フェーズ（合計 ~3.5 秒）：
//   1. darken  30F：画面に半透明黒オーバーレイをフェードイン
//   2. rise    60F：ボス台座を地中(-120)から地表(0)へ easeOutCubic でせり上げ + BGM 仮切替
//   3. name    90F：「WARNING」赤テキストを点滅表示
//   4. fadeout 30F：オーバーレイをフェードアウト → done
//
// 第1段はせり上がり+暗転+ボス名+BGM placeholder の 4 要素。
// 6 秒 7 フェーズの完全版（バツン音/警告ブザー/ワンテンポ間/赤転換）は第2段で。

const BURIED_Y = -120;   // 台座を埋める Y（地中）
const SURFACE_Y = 0;     // 台座の表面位置（disk top が地表付近）

const DARKEN_F  = 30;
const RISE_F    = 60;
const NAME_F    = 90;
const FADEOUT_F = 30;

let _phase = 'idle';     // 'idle' | 'darken' | 'rise' | 'name' | 'fadeout' | 'done'
let _timer = 0;

let _platformGroup = null;
let _overlay = null;
let _bannerEl = null;

export function initBossIntro(deps) {
  _platformGroup = (deps && deps.platformGroup) || null;
  // 台座を地中に埋める（イントロ起動まで見えない）
  if (_platformGroup) _platformGroup.position.y = BURIED_Y;
  _ensureOverlay();
  _ensureBanner();
  _phase = 'idle';
  _timer = 0;
}

function _ensureOverlay() {
  if (_overlay) return _overlay;
  const el = document.createElement('div');
  el.id = 'boss-intro-overlay';
  el.style.cssText = [
    'position:fixed', 'inset:0', 'background:#000', 'opacity:0',
    'pointer-events:none', 'z-index:9500',
  ].join(';');
  document.body.appendChild(el);
  _overlay = el;
  return el;
}

function _ensureBanner() {
  if (_bannerEl) return _bannerEl;
  const el = document.createElement('div');
  el.id = 'boss-intro-banner';
  el.style.cssText = [
    'position:fixed', 'top:38%', 'left:50%', 'transform:translate(-50%,-50%)',
    'color:#ff3344', 'font-family:monospace', 'font-weight:bold',
    'font-size:84px', 'letter-spacing:0.3em',
    'opacity:0', 'pointer-events:none', 'z-index:9600',
    'text-shadow:0 0 16px #ff3344, 0 0 36px rgba(255,0,0,0.55)',
  ].join(';');
  el.textContent = 'WARNING';
  document.body.appendChild(el);
  _bannerEl = el;
  return el;
}

export function startBossIntro() {
  if (_phase !== 'idle' && _phase !== 'done') return;
  _phase = 'darken';
  _timer = 0;
}

export function isBossIntroActive() {
  return _phase !== 'idle' && _phase !== 'done';
}

export function tickBossIntro() {
  if (_phase === 'idle' || _phase === 'done') return;
  _timer++;
  switch (_phase) {
    case 'darken': {
      const t = Math.min(1, _timer / DARKEN_F);
      _overlay.style.opacity = String(t * 0.5);
      if (_timer >= DARKEN_F) {
        _phase = 'rise'; _timer = 0;
        // BGM 仮切替：実 BGM システム未実装のためログのみ
        console.log('[BOSS-INTRO] BGM swap → bgm.boss (placeholder)');
      }
      break;
    }
    case 'rise': {
      const t = Math.min(1, _timer / RISE_F);
      const eased = 1 - Math.pow(1 - t, 3);  // easeOutCubic
      if (_platformGroup) {
        _platformGroup.position.y = BURIED_Y + (SURFACE_Y - BURIED_Y) * eased;
      }
      if (_timer >= RISE_F) {
        _phase = 'name'; _timer = 0;
        _bannerEl.style.opacity = '1';
      }
      break;
    }
    case 'name': {
      // 点滅：8F 周期で 1.0 / 0.3 を交互（派手めに目を引く）
      _bannerEl.style.opacity = (Math.floor(_timer / 8) % 2 === 0) ? '1' : '0.3';
      if (_timer >= NAME_F) {
        _phase = 'fadeout'; _timer = 0;
        _bannerEl.style.opacity = '0';
      }
      break;
    }
    case 'fadeout': {
      const t = Math.min(1, _timer / FADEOUT_F);
      _overlay.style.opacity = String(0.5 * (1 - t));
      if (_timer >= FADEOUT_F) {
        _phase = 'done';
        _overlay.style.opacity = '0';
      }
      break;
    }
  }
}

export function getBossIntroDebugState() {
  return { phase: _phase, timer: _timer };
}
