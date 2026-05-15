// ============================================================
//  SCRAP BLITZ — debug-overlay（分離 Phase: Step E-7）
//
//  デバッグ HUD 更新を集約：
//    - updateDebug          プレイヤー座標・state・charge・特殊使用済 HUD
//    - updateHudHighlight   操作説明の HUD ハイライト（押下中ボタンを黄色く）
//
//  ES Module として index.html から import される：
//    import {
//      initDebugOverlay, updateDebug, updateHudHighlight,
//    } from './src/debug-overlay.js';
//
//  initDebugOverlay(deps) で依存を一括注入：
//    - inp, action          入力ポーリング関数
//    - players, enemies     状態取得用
//    - debugEl, dummyHpEl, stateHudPlayerEl, stateHudEnemyEl,
//      dbgDirHistEl, dbgChargeEl, dbgSpUsedEl  DOM refs
//
//  STATE / SPECIAL_CONFIG は ESM 直接 import。
//  ヒットボックス可視化（toggleHitbox / _dbg* / updateHitboxDebug）は
//  Three.js シーン構築と密結合のため index.html に残置。
// ============================================================

import { STATE } from './states.js';
import { SPECIAL_CONFIG } from './config.js';
import { combo, detectComboLoop } from './hit-engine.js';

let _inp = null;
let _action = null;
let _players = null;
let _enemies = null;
let _debugEl = null;
let _dummyHpEl = null;
let _stateHudPlayerEl = null;
let _stateHudEnemyEl = null;
let _dbgDirHistEl = null;
let _dbgChargeEl = null;
let _dbgSpUsedEl = null;
let _comboBurstBanner = null;
let _comboRouteRow = null;
let _lastRenderedRouteSig = '';   // 不要な innerHTML 上書きを避けるためのキャッシュ

// HUD_HIGHLIGHT_MAP は init 時に _inp/_action を捕まえて構築する
let _hudHighlightMap = null;
let _hkEls = null;

export function initDebugOverlay(deps) {
  _inp = deps.inp;
  _action = deps.action;
  _players = deps.players;
  _enemies = deps.enemies;
  _debugEl = deps.debugEl;
  _dummyHpEl = deps.dummyHpEl;
  _stateHudPlayerEl = deps.stateHudPlayerEl;
  _stateHudEnemyEl = deps.stateHudEnemyEl;
  _dbgDirHistEl = deps.dbgDirHistEl;
  _dbgChargeEl = deps.dbgChargeEl;
  _dbgSpUsedEl = deps.dbgSpUsedEl;
  _comboBurstBanner = deps.comboBurstBanner;
  _comboRouteRow    = deps.comboRouteRow;

  // 押されているボタンに対応する説明行を黄色くハイライトする
  _hudHighlightMap = [
    { id: 'hk-move',      check: () => _inp('ArrowLeft') || _inp('ArrowRight') || _inp('ArrowUp') || _inp('ArrowDown') || _inp('KeyA') || _inp('KeyD') || _inp('KeyW') || _inp('KeyS') },
    { id: 'hk-dash',      check: () => _players[0]?.dashActive },
    { id: 'hk-jump',      check: () => _action('jump') },
    { id: 'hk-weak',      check: () => _action('weakAttack') },
    { id: 'hk-strong',    check: () => _action('strongAttack') },
    { id: 'hk-cancel',    check: () => _action('jump') && _players[0]?.state === STATE.hit_confirm },
    { id: 'hk-secondary', check: () => _action('secondary') },
    { id: 'hk-mega',      check: () => _action('megaCrash') || (_inp('KeyJ') && _inp('KeyK') && !_inp('KeyL')) },
    { id: 'hk-ult',       check: () => _action('ult')      || (_inp('KeyJ') && _inp('KeyK') &&  _inp('KeyL')) },
    { id: 'hk-pixel',     check: () => _inp('KeyP') },
  ];
  _hkEls = {};
  _hudHighlightMap.forEach(({ id }) => { _hkEls[id] = document.getElementById(id); });
}

// ============================================================
//  プレイヤー座標・state・charge・特殊使用済 デバッグ HUD
// ============================================================
export function updateDebug() {
  const p = _players[0];
  _debugEl.textContent =
    `x:${p.x.toFixed(0)} z:${p.z.toFixed(0)} y:${p.y.toFixed(0)} | ` +
    `state:${p.state} chain:${p.attackChainIdx} | ` +
    `grounded:${p.isGrounded ? 'Y' : 'N'}`;
  _dummyHpEl.textContent = `${_enemies[0].hp}/${_enemies[0].maxHp}`;
  // ステートHUD更新（未設定の場合は「未設定」表示）
  _stateHudPlayerEl.textContent = _players[0]?.state ?? '未設定';
  _stateHudEnemyEl.textContent  = _enemies[0]?.state ?? '未設定';
  // 必殺技デバッグ HUD：直近 6 エントリの dir + chargeJFrames + 使用済 ID 集合
  if (_dbgDirHistEl) {
    const hist = _players[0]?.dirHistory ?? [];
    const recent = hist.slice(-6).map(e => e.dir).join(' ');
    _dbgDirHistEl.textContent = recent || '-';
  }
  if (_dbgChargeEl) {
    const cj = _players[0]?.chargeJFrames ?? 0;
    const ready = _players[0]?.chargeReady;
    _dbgChargeEl.textContent = `${cj}/${SPECIAL_CONFIG.CHARGE_FRAMES}${ready ? ' [READY]' : ''}`;
    _dbgChargeEl.style.color = ready ? '#ffff66' : '#cfffaa';
  }
  if (_dbgSpUsedEl) {
    const used = _players[0]?.specialUsedIds;
    _dbgSpUsedEl.textContent = (used && used.size > 0)
      ? Array.from(used).map(id => id.replace('c01_sp_', '')).join(',')
      : '-';
  }
  // === コンボ履歴パネル（中央下・トレーニング用 HUD 候補）===
  //   2 段：上段に BURST 演出（3 秒）／下段にルートチップ。
  //   ルートは burst 発火時に snapshot を取り、3 秒間プレイヤーが見えるよう保持する。
  if (_comboRouteRow && _comboBurstBanner) {
    // burst フラッシュ進行：HUD 用残 F をデクリメント
    if (combo.burstHudFrames > 0) combo.burstHudFrames--;
    // ルート供給：burst HUD 中は snapshot を、平時は「直近ヒット敵」の route を使う。
    //   comboTarget はホーミングロック対象（初撃時点で固定）で、mega/ULT の AoE 後段で
    //   別の敵に当たっても変わらない。HUD として「最新の行動を全部見せたい」設計のため
    //   lastHitEnemy を優先（無ければ comboTarget）。
    // route ソース：burst HUD 中は snapshot、平時は集約 route（ターゲット切替を跨いで継続）
    const route = (combo.burstHudFrames > 0 && combo.burstHudRoute)
      ? combo.burstHudRoute
      : combo.aggregateRoute;
    const cats = route.map(_categorizeAttack);
    // 表示状態をシグネチャ化して innerHTML を書き換えるのは変化時のみ
    // burst 理由と SP baseId / loopLen も含めて変化を捉える
    const sig = (combo.burstHudFrames > 0
        ? `B:${combo.burstHudReason}:${combo.burstHudSpBaseId ?? ''}:${combo.burstHudLoopLen}`
        : 'N')
      + '|' + cats.join(',');
    if (sig !== _lastRenderedRouteSig) {
      _lastRenderedRouteSig = sig;
      _comboRouteRow.innerHTML = '';
      if (cats.length === 0) {
        _comboRouteRow.style.opacity = '0.35';
        const empty = document.createElement('span');
        empty.textContent = '—';
        empty.style.opacity = '0.4';
        _comboRouteRow.appendChild(empty);
      } else {
        _comboRouteRow.style.opacity = '1';
        // ループ検出：burst HUD 中は burstHudLoopLen（記録済の L）を優先、平時は再走査
        const burstActive = combo.burstHudFrames > 0;
        const L = burstActive
          ? (combo.burstHudReason === 'loop' ? combo.burstHudLoopLen : 0)
          : detectComboLoop(route);
        const REPEAT = 3;
        const loopStart = (L > 0) ? (cats.length - L * REPEAT) : -1;
        // SP duplicate burst の場合：青枠で囲う対象 baseId
        const spDupBaseId = (burstActive && combo.burstHudReason === 'sp_dup')
          ? combo.burstHudSpBaseId
          : null;
        // メガクラ位置（route 内の最後の MC index）→ それより前はグレーアウト
        let lastMcIdx = -1;
        for (let i = route.length - 1; i >= 0; i--) {
          if (route[i] && route[i].includes('_sp_mega')) { lastMcIdx = i; break; }
        }
        const SHOW = 18;
        const startIdx = Math.max(0, cats.length - SHOW);
        if (startIdx > 0) {
          const ell = document.createElement('span');
          ell.textContent = '…';
          ell.style.cssText = 'opacity: 0.5; margin-right: 4px;';
          _comboRouteRow.appendChild(ell);
        }
        let currentLoopBox = null;
        for (let i = startIdx; i < cats.length; i++) {
          // ループ枠：L 単位ごとに新しい赤枠を作る（loop 由来の burst 時のみ）
          if (L > 0 && i >= loopStart && (i - loopStart) % L === 0) {
            currentLoopBox = document.createElement('span');
            currentLoopBox.style.cssText = 'display: inline-flex; gap: 4px; padding: 2px 6px; ' +
              'border: 2px solid #ff3366; border-radius: 3px; margin: 0 1px; ' +
              'box-shadow: 0 0 8px rgba(255,51,102,0.55);';
            _comboRouteRow.appendChild(currentLoopBox);
          }
          // ループ範囲外に出たら currentLoopBox を閉じる（後続を直接 row に追加）
          if (L > 0 && i >= cats.length) currentLoopBox = null;
          const inLoop = (L > 0 && i >= loopStart && i < loopStart + L * REPEAT);

          const chip = document.createElement('span');
          chip.textContent = cats[i];
          chip.style.cssText = _categoryStyle(cats[i]);
          // MC より前は強めにグレーアウト（無効化された入力を視覚的に弱める・2026-05-16 0.35→0.18）
          const isPreMc = (lastMcIdx >= 0 && i < lastMcIdx);
          if (isPreMc) {
            chip.style.opacity = '0.18';
            chip.style.filter = 'grayscale(1)';
          }
          // SP duplicate burst：対象 baseId のチップを青枠で囲む（個別）
          let parent = inLoop ? currentLoopBox : _comboRouteRow;
          if (spDupBaseId && route[i]) {
            const baseId = route[i].endsWith('_air') ? route[i].slice(0, -4) : route[i];
            if (baseId === spDupBaseId) {
              const blueBox = document.createElement('span');
              blueBox.style.cssText = 'display: inline-flex; padding: 2px 6px; margin: 0 1px; ' +
                'border: 2px solid #44aaff; border-radius: 3px; ' +
                'box-shadow: 0 0 8px rgba(68,170,255,0.55);';
              parent.appendChild(blueBox);
              blueBox.appendChild(chip);
              continue;
            }
          }
          parent.appendChild(chip);
        }
      }
    }
    // 上段バナー：
    //   COMBO RESET（mega 救済）が最優先 → BURST（loop/sp_dup）→ 非表示。
    if (combo.resetBannerFrames > 0) combo.resetBannerFrames--;
    const showReset  = combo.resetBannerFrames > 0;
    const showBurst  = !showReset && combo.burstHudFrames > 0
      && (combo.burstHudReason === 'loop' || combo.burstHudReason === 'sp_dup');
    if (showReset) {
      if (_comboBurstBanner.textContent !== 'COMBO RESET') {
        _comboBurstBanner.textContent = 'COMBO RESET';
        _comboBurstBanner.style.color = '#66ddff';
        _comboBurstBanner.style.textShadow = '0 0 12px rgba(102,221,255,0.9)';
      }
      _comboBurstBanner.style.opacity = '1';
    } else if (showBurst) {
      if (_comboBurstBanner.textContent !== 'BURST') {
        _comboBurstBanner.textContent = 'BURST';
        _comboBurstBanner.style.color = '';
        _comboBurstBanner.style.textShadow = '';
      }
      _comboBurstBanner.style.opacity = '1';
    } else if (_comboBurstBanner.style.opacity !== '0') {
      _comboBurstBanner.style.opacity = '0';
      _comboBurstBanner.textContent = '';
      _comboBurstBanner.style.color = '';
      _comboBurstBanner.style.textShadow = '';
    }
  }
}

// 攻撃 id → カテゴリ短縮：
//   S / L                    弱・強通常
//   aS / aL                  空中版（_air プレフィクス）
//   SP1〜SPn / aSP1〜aSPn    必殺技（地上・空中）
//   MC                       メガクラッシュ
//   ULT                      超必殺技
//   ↑L / ↓L / →L            方向付き強攻撃（→L は将来追加）
//   gS / gL                  つかみ中の打撃（g = grab・J / K）
//   TH                       つかみ投げ
//   wH                       壁ヒット（将来実装予定・仮想 ID）
//   ETC                      その他（ステップ攻撃・投げの巻き込み等）
function _categorizeAttack(id) {
  if (!id) return '?';
  // 仮想 ID（つかみ系・attack-engine 側で push）
  if (id === 'grab_punch_s')    return 'gS';
  if (id === 'grab_punch_l')    return 'gL';
  if (id === 'grab_throw')      return 'TH';
  if (id === 'wall_hit')        return 'wH';
  if (id === 'thrown_chain_hit') return 'ETC';
  // 特殊技
  if (id.includes('_sp_mega')) return 'MC';
  if (id.includes('_sp_ult'))  return 'ULT';
  // 方向別 L 攻撃（地上限定・空中版とは別扱い）
  if (id === 'c01_atk_l_01_up')   return '↑L';
  if (id === 'c01_atk_l_01_down') return '↓L';
  // 将来追加：c01_atk_l_01_fwd → '→L' をここに足す
  const isAir = id.endsWith('_air');
  const prefix = isAir ? 'a' : '';
  // 必殺技（番号別）
  const spMatch = id.match(/_sp_(0?\d+)/);
  if (spMatch) return prefix + 'SP' + parseInt(spMatch[1], 10);
  // ステップ攻撃：弱/強で dS / dL（dash の d）
  if (id.endsWith('_step')) {
    if (id.includes('_atk_l_')) return 'dL';
    if (id.includes('_atk_s_')) return 'dS';
    return 'ETC';
  }
  // 弱・強通常
  if (id.includes('_atk_l_')) return prefix + 'L';
  if (id.includes('_atk_s_')) return prefix + 'S';
  return 'ETC';
}

// カテゴリごとの色付け（視覚区別）
//   末尾文字 S/L で基本色、a/c プレフィクスや矢印修飾子は色に影響しない（種類はテキストで区別）。
//   SP は番号別でも青発光統一。MC/ULT/TH/ETC は専用色。
function _categoryStyle(cat) {
  const base = 'display:inline-block; padding:0 4px; border-radius:2px;';
  // 番号付き SP（SP1 / aSP1 等）→ SP 共通スタイル
  if (cat.replace(/^a/, '').startsWith('SP')) {
    return base + ' color:#88ccff; text-shadow:0 0 4px #88ccff;';
  }
  // 専用カテゴリ
  switch (cat) {
    case 'MC':  return base + ' color:#66ddff; background:rgba(100,220,255,0.15); text-shadow:0 0 4px #66ddff;';
    case 'ULT': return base + ' color:#ff66aa; background:rgba(255,100,170,0.15); text-shadow:0 0 6px #ff66aa;';
    case 'TH':  return base + ' color:#ffee44; background:rgba(255,238,68,0.15); text-shadow:0 0 4px #ffee44;';
    case 'wH':  return base + ' color:#cc99ff; background:rgba(204,153,255,0.15); text-shadow:0 0 4px #cc99ff;';
    case 'ETC': return base + ' color:#888888;';
  }
  // 末尾 S / L で基本色判定（aS / cL / ↑L / →L など全部吸収）
  const lastChar = cat.charAt(cat.length - 1);
  if (lastChar === 'S') return base + ' color:#aaffaa;';
  if (lastChar === 'L') return base + ' color:#ffcc88;';
  return base + ' color:#aaaaaa;';
}

// ============================================================
//  操作説明 HUD のハイライト（押下中ボタンを黄色く）
// ============================================================
export function updateHudHighlight() {
  _hudHighlightMap.forEach(({ id, check }) => {
    const el = _hkEls[id];
    if (!el) return;
    el.classList.toggle('hk-active', check());
  });
}
