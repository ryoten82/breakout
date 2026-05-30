// ============================================================
//  SCRAP BLITZ — オートパイロット bot（デバッグ部屋・自動ファズ基盤）
//
//  ブラウザ内 JS でフルスピード自動プレイする bot。
//  最終目的は自動ファズ：延々プレイし続けて invariant 違反 / NaN /
//  スタック / JS エラーを debug-invariants の history に積む。
//
//  駆動：index.html の update() 冒頭で window.SB.autopilot.tick() が呼ばれる。
//    → hitstop / pause / slow 中は update 自体が止まるので bot も自然に同期停止。
//  入力：input-system の仮想入力レイヤ（setVirtualKey）に宣言的に反映。
//    → 人間の keys と分離。stop で clearVirtualKeys 一括解除。
//
//  起動：window.SB.autopilot.start() / stop()。stage 遷移（reload）は
//    sessionStorage._sbAutopilot で継続（autoStart は index.html 側フック）。
// ============================================================

import { setVirtualKey, clearVirtualKeys } from '../input-system.js';
import { analyzeLogs, sigOf } from './log-analyzer.js';

const CODE = {
  LEFT:  'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP:    'ArrowUp',
  DOWN:  'ArrowDown',
  JUMP:  'Space',
  J:     'KeyJ',
  K:     'KeyK',
};

const config = {
  ATTACK_RANGE_X:   90,    // この x 距離以内で殴る
  APPROACH_RANGE_X: 600,   // この距離以内なら間合い詰め
  Z_ALIGN:          40,    // z 差がこれ以内なら横軸が合っている
  WALK_PROBE_X:     6500,  // 敵不在時に右進行する上限（worldXMax 既定）
  ATTACK_HOLD_F:    6,     // J/K を押す持続フレーム
  ATTACK_GAP_F:     8,     // 攻撃と攻撃の間隔
  STRONG_EVERY:     4,     // N 回に 1 回は K（強攻撃）
  STUCK_X_EPS:      5,     // この移動量未満が続いたら停滞カウント
  STUCK_FRAMES:     600,   // 10 秒進展なしで stuck 判定（at 60fps）
  OBS_BLOCK_TRIGGER: 30,   // X 進行が止まって何 F で障害物回避(Z スライド)を始めるか
  OBS_Z_TRY_FRAMES:  90,   // Z 片側を何 F 試してダメなら反対側へ
  logActions:       true,  // 各行動を console.log + リングバッファに残す（SP テスト DEBUG ログ相当）
  RESULT_DWELL_TICKS: 4,   // result 画面を何 tick(×400ms) 表示してから新ランへ（UI コード走行＝カバレッジ）
};

const stats = {
  framesRun:      0,
  attacksThrown:  0,
  kills:          0,        // 撃破数（敵 alive 減少で加算）
  stuckEvents:    0,
  fatalInvariants:0,        // 監視用ライブ値（summarize から反映）
  jsErrors:       0,        // window.onerror フックから加算
  ocPicks:        0,        // OC カード自動選択回数
  runs:           0,        // 通算ラン数（death/clear で +1・延々ループ用）
  curState:       'IDLE',
  playerX:        0,
  targetIdx:      -1,
};

let _enabled = false;

// 内部状態
let _lastTickFrame = -1;
let _held = new Set();        // 現在 setVirtualKey で押している code 集合
let _attackHoldRemaining = 0;
let _attackCooldown = 0;
let _attackCount = 0;
let _lastAtkKey = CODE.J;
let _lastX = null;
let _stuckFrames = 0;
let _prevAliveCount = 0;
// 汎用障害物回避（X 詰まり → Z 回り込み）
let _obsLastX = null;         // 前フレームの x（進行判定用）
let _obsBlockFrames = 0;      // X 進行が止まっている連続フレーム数
let _obsZDir = 0;             // 現在の Z 回避方向（0=なし / +1=+Z(Down) / -1=-Z(Up)）
let _obsZElapsed = 0;         // 現 Z 方向での経過フレーム
let _menuTimer = null;        // メニュー監視（実時間 setInterval・pause/rAF停止に依存しない）
let _resultDwell = 0;         // result 画面の表示滞在 tick カウント

// 行動ログ（リングバッファ・reload またぎは sessionStorage で継続）
const LOG_MAX = 800;
let _actionLog = [];
let _prevLoggedState = '';
let _stashCountdown = 0;

function _logEvent(type, msg) {
  const SB = window.SB;
  const p = SB && SB.players && SB.players[0];
  const entry = {
    f: stats.framesRun,
    run: stats.runs,
    stage: (SB && SB.stageDbg && SB.stageDbg.selected) || null,
    type,
    msg: msg || '',
    x: p ? Math.round(p.x) : null,
    z: p ? Math.round(p.z) : null,
    hp: p ? Math.round(p.hp) : null,
  };
  _actionLog.push(entry);
  if (_actionLog.length > LOG_MAX) _actionLog.shift();
  if (config.logActions && typeof console !== 'undefined') {
    console.log(`[BOT ${entry.stage || '?'} r${entry.run} f${entry.f}] ${type}${msg ? ': ' + msg : ''} @x${entry.x} z${entry.z} hp${entry.hp}`);
  }
}

function _stashLog() {
  try {
    sessionStorage.setItem('_sbBotLog', JSON.stringify(_actionLog.slice(-LOG_MAX)));
    sessionStorage.setItem('_sbBotRuns', String(stats.runs));
  } catch (_) {}
}

function _restoreLog() {
  try {
    const s = sessionStorage.getItem('_sbBotLog');
    if (s) _actionLog = JSON.parse(s).slice(-LOG_MAX);
    const r = sessionStorage.getItem('_sbBotRuns');
    if (r != null) stats.runs = parseInt(r, 10) || 0;
  } catch (_) {}
}

// invariant シグネチャ集約（reload またぎ・複数ラン横断の永続バグ台帳）
function _loadFindings() {
  try { return JSON.parse(sessionStorage.getItem('_sbBotFindings') || '{}'); } catch (_) { return {}; }
}
function _saveFindings(f) {
  try { sessionStorage.setItem('_sbBotFindings', JSON.stringify(f)); } catch (_) {}
}
// 現在の invariant 履歴を永続台帳へ畳み込む（count は window 内最大を採用＝過剰カウント回避の近似）。
function _foldFindings() {
  const SB = window.SB;
  if (!SB || !SB.dumpInvariants) return _loadFindings();
  const invs = SB.dumpInvariants(200) || [];
  const stage = (SB.stageDbg && SB.stageDbg.selected) || null;
  const f = _loadFindings();
  const wc = {};
  for (const w of invs) { const s = sigOf(w.msg); wc[s] = (wc[s] || 0) + 1; }
  for (const w of invs) {
    const s = sigOf(w.msg);
    const e = f[s] || (f[s] = { level: w.level, count: 0, msgSample: w.msg, firstFrame: w.frame, lastFrame: w.frame, sample: w.snapshot || null, stages: [] });
    e.count = Math.max(e.count, wc[s]);
    e.lastFrame = w.frame;
    if (!e.sample && w.snapshot) e.sample = w.snapshot;
    if (stage && !e.stages.includes(stage)) e.stages.push(stage);
  }
  _saveFindings(f);
  return f;
}

// メニュー処理：pause 中は update()（=tick）が止まるため、tick とは別経路で駆動する。
// OC カード選択画面が出たら先頭カードを自動確定して通しプレイを継続する。
function _menuTick() {
  const SB = window.SB;
  if (!SB || !_enabled) return;
  try {
    // result 画面（gameover/clear）：少し滞在 → stage01 から新ランへ（延々ループ）
    // SB.isResultShown は動的 import 後付けで不安定なため DOM overlay を直接判定。
    const _resEl = document.getElementById('result-overlay');
    const _resultShown = _resEl && getComputedStyle(_resEl).display !== 'none';
    if (_resultShown) {
      if (++_resultDwell >= config.RESULT_DWELL_TICKS) {
        _resultDwell = 0;
        stats.runs++;
        _logEvent('RESTART', `run ${stats.runs} → stage01`);
        _foldFindings();   // 直前ランの invariant を永続台帳へ
        _stashLog();
        try { sessionStorage.setItem('_sbAutopilot', '1'); } catch (_) {}
        // carry 系は持ち越さない（クリーンな新ラン）
        try {
          ['_sbAutoTransition','_sbCarryHp','_sbCarryMaxHp','_sbCarrySp','_sbCarryCr','_sbCarryOC']
            .forEach(k => sessionStorage.removeItem(k));
        } catch (_) {}
        window.location.href = 'index.html?stage=stage01';
      }
      return;
    }
    _resultDwell = 0;
    // OC カード選択：先頭カードを自動確定
    if (SB.oc && SB.oc.isPending && SB.oc.isPending()) {
      const picked = SB.oc.pick(0);
      if (picked) { stats.ocPicks++; _logEvent('OC_PICK', String(picked)); }
    }
  } catch (_) { /* メニュー未露出環境は無視 */ }
}

function _resetState() {
  _lastTickFrame = -1;
  _attackHoldRemaining = 0;
  _attackCooldown = 0;
  _attackCount = 0;
  _lastAtkKey = CODE.J;
  _lastX = null;
  _stuckFrames = 0;
  _prevAliveCount = 0;
  _obsLastX = null;
  _obsReset();
  _applyHeld(new Set());
}

// 宣言的入力反映：今フレーム押すべき code 集合を前フレーム差分で setVirtualKey
function _applyHeld(next) {
  for (const c of _held) if (!next.has(c)) setVirtualKey(c, false);
  for (const c of next) if (!_held.has(c)) setVirtualKey(c, true);
  _held = next;
}

// 汎用障害物回避：X 方向 dir に進みたいのに X が進まなくなったら Z 軸へ回り込む。
//   穴・壁など障害物の種類を問わない（落下しないので穴ジャンプより安全）。
//   手順：①X 進行が止まる → ②Z 片側へスライド（広いレーン側＝+Z から）→ ③ダメなら反対 Z
//          → ④両側ダメなら「他要因」として flag。X が再び進み出したら Z 入力を解除。
//   ArrowDown=+Z（z 増・最大 700 の広レーン）/ ArrowUp=-Z（z 減・-380 まで）。
// 戻り値：Z 回避入力を出したら true（呼び出し側は _alignZ を抑止する）。
function _applyMove(SB, p, dir, held) {
  if (!dir) { _obsReset(); return false; }
  held.add(dir > 0 ? CODE.RIGHT : CODE.LEFT);

  // X 進行の監視
  const dx = (_obsLastX == null) ? 0 : (p.x - _obsLastX);
  _obsLastX = p.x;
  const progressing = (dir > 0) ? (dx > 0.5) : (dx < -0.5);
  if (progressing) { _obsReset(); return false; }   // 進めている → 障害物処理解除

  // 進めていない
  _obsBlockFrames++;
  if (_obsBlockFrames < config.OBS_BLOCK_TRIGGER) return false;  // 短い停滞（攻撃硬直等）は無視

  // 障害物とみなし Z 回避を開始/継続
  if (_obsZDir === 0) { _obsZDir = +1; _obsZElapsed = 0; _logEvent('OBSTACLE', `block dir=${dir} → try +Z`); }
  held.add(_obsZDir > 0 ? CODE.DOWN : CODE.UP);
  stats.curState = 'OBSTACLE_Z';
  if (++_obsZElapsed > config.OBS_Z_TRY_FRAMES) {
    if (_obsZDir === +1) {
      _obsZDir = -1; _obsZElapsed = 0;                       // 片側ダメ → 反対側
      _logEvent('OBSTACLE', `+Z failed → try -Z`);
    } else {
      if (SB.recordInvariant) {                              // 両側ダメ → 他要因
        SB.recordInvariant('warn', `[INV-BOT🟡] blocked (X+Z both failed): x=${p.x|0} z=${p.z|0} dir=${dir}`);
      }
      _logEvent('BLOCKED', `X+Z both failed dir=${dir}`);
      _obsReset();   // リセットして再試行（連続 flag 防止の間隔にもなる）
    }
  }
  return true;
}

function _obsReset() {
  _obsBlockFrames = 0;
  _obsZDir = 0;
  _obsZElapsed = 0;
}

function _aliveEnemies(SB) {
  const out = [];
  const list = SB.enemies || [];
  for (const e of list) {
    if (!e || !e.isAlive || e.dying) continue;
    if (!Number.isFinite(e.x)) continue;
    out.push(e);
  }
  return out;
}

function _nearest(p, list) {
  let best = null, bestD = Infinity, bestIdx = -1;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const dx = Math.abs(e.x - p.x);
    const dz = Math.abs((e.z ?? 0) - (p.z ?? 0));
    const d = dx + dz * 0.5;  // x 主・z 副
    if (d < bestD) { bestD = d; best = e; bestIdx = i; }
  }
  return { e: best, idx: bestIdx };
}

function _recordStuck(SB, p, alive) {
  stats.stuckEvents++;
  if (SB.recordInvariant) {
    SB.recordInvariant('warn',
      `[INV-BOT🟡] stuck: x=${(p.x|0)} state=${p.state} enemies=${alive.length}`);
  }
}

function tick() {
  const SB = window.SB;
  if (!SB || !_enabled) return;

  // 多重 update ガード（GAME_SPEED の while で 1F 複数回呼ばれ得る）
  const frame = SB.getGameFrame ? SB.getGameFrame() : -1;
  if (frame >= 0 && frame === _lastTickFrame) return;
  _lastTickFrame = frame;

  stats.framesRun++;

  const p = (SB.players || [])[0];
  if (!p) { _applyHeld(new Set()); stats.curState = 'NO_PLAYER'; return; }
  stats.playerX = p.x;

  // プレイヤーの生存は state で判定（player には isAlive フィールドが無い）。
  // dead/dying/respawning 中は入力せず reload / 復活を待つ。
  const ST = SB.STATE || {};
  if (p.state === ST.dead || p.state === ST.dying || p.state === ST.respawning) {
    _applyHeld(new Set());
    stats.curState = 'DOWN';
    _lastX = p.x;
    return;
  }

  // 被弾やられ中は待つ（入力しない）
  const inHitstun = SB.isHitstunState ? SB.isHitstunState(p.state) : false;
  if (inHitstun) {
    _applyHeld(new Set());
    stats.curState = 'WAIT_RECOVER';
    _lastX = p.x;  // やられ中の位置移動を停滞と誤検知しない
    return;
  }

  const alive = _aliveEnemies(SB);
  // 撃破カウント（生存数の減少分を加算）
  if (_prevAliveCount > alive.length) stats.kills += (_prevAliveCount - alive.length);
  _prevAliveCount = alive.length;

  const held = new Set();

  const { e: target, idx } = _nearest(p, alive);
  stats.targetIdx = idx;

  if (!target) {
    // 敵なし → 右へ進んで次ウェーブ誘発 / clearWalkX 踏破
    stats.curState = 'ADVANCE';
    _applyMove(SB, p, (p.x < config.WALK_PROBE_X) ? 1 : 0, held);
    _tickAttackCounters();
  } else {
    const dx = target.x - p.x;
    const dist = Math.abs(dx);
    const faceRight = dx >= 0;

    if (dist > config.APPROACH_RANGE_X) {
      stats.curState = 'SEEK';
      const obsZ = _applyMove(SB, p, faceRight ? 1 : -1, held);
      if (!obsZ) _alignZ(held, p, target);   // 回避中は target への z 合わせを止める（Z 入力衝突回避）
      _tickAttackCounters();
    } else if (dist > config.ATTACK_RANGE_X) {
      stats.curState = 'APPROACH';
      const obsZ = _applyMove(SB, p, faceRight ? 1 : -1, held);
      if (!obsZ) _alignZ(held, p, target);
      _tickAttackCounters();
    } else {
      stats.curState = 'ATTACK';
      // 攻撃リズム：押す → 離す（edge 検出を踏ませる）
      if (_attackHoldRemaining > 0) {
        held.add(_lastAtkKey);
        _attackHoldRemaining--;
      } else if (_attackCooldown <= 0) {
        _attackCount++;
        _lastAtkKey = (_attackCount % config.STRONG_EVERY === 0) ? CODE.K : CODE.J;
        held.add(_lastAtkKey);
        _attackHoldRemaining = config.ATTACK_HOLD_F - 1;
        _attackCooldown = config.ATTACK_HOLD_F + config.ATTACK_GAP_F;
        stats.attacksThrown++;
      } else {
        _attackCooldown--;
      }
    }
  }

  _applyHeld(held);
  _updateStuck(SB, p, alive, /*moved*/held.has(CODE.RIGHT) || held.has(CODE.LEFT));

  // 行動トレース：curState が変わった時だけ記録（毎フレーム spam を避ける）
  if (stats.curState !== _prevLoggedState) {
    _logEvent('STATE', `${_prevLoggedState || '-'}→${stats.curState}`);
    _prevLoggedState = stats.curState;
  }
  // 定期 stash（reload またぎでログ継続）+ invariant 永続台帳へ畳み込み
  if (--_stashCountdown <= 0) { _stashCountdown = 240; _stashLog(); _foldFindings(); }
}

function _alignZ(held, p, target) {
  const dz = (target.z ?? 0) - (p.z ?? 0);
  if (dz > config.Z_ALIGN) held.add(CODE.DOWN);
  else if (dz < -config.Z_ALIGN) held.add(CODE.UP);
}

function _tickAttackCounters() {
  if (_attackHoldRemaining > 0) _attackHoldRemaining--;
  if (_attackCooldown > 0) _attackCooldown--;
}

function _updateStuck(SB, p, alive, moving) {
  if (_lastX == null) { _lastX = p.x; return; }
  const moved = Math.abs(p.x - _lastX);
  _lastX = p.x;
  // 移動入力をしているのに進んでいない場合のみ停滞カウント
  if (moving && moved < config.STUCK_X_EPS) _stuckFrames++;
  else _stuckFrames = 0;

  if (_stuckFrames > config.STUCK_FRAMES) {
    // 障害物回避(Z スライド)でも進めない＝真の停滞。flag のみ（脱出行動は _applyMove の Z 回避に一本化）。
    _recordStuck(SB, p, alive);
    _stuckFrames = 0;
  }
}

export const autopilot = {
  tick,
  get enabled() { return _enabled; },
  stats,
  config,

  start(opts = {}) {
    if (window.SB) {
      window.SB.DEBUG_INVARIANTS = true;          // 🟡🟢 も history に乗せる
      if (window.SB.markPlayStart) window.SB.markPlayStart();
    }
    try { sessionStorage.setItem('_sbAutopilot', '1'); } catch (_) {}
    _resetState();
    // stats をリセット（resumed 時はラン継続なので framesRun 等のみリセット）
    if (!opts.keepStats) {
      stats.framesRun = 0; stats.attacksThrown = 0; stats.kills = 0;
      stats.stuckEvents = 0; stats.jsErrors = 0; stats.ocPicks = 0;
    }
    if (opts.resumed) {
      _restoreLog();           // reload またぎのログ・ラン数を復元
    } else {
      _actionLog = [];         // 明示 start は新規セッション扱い
      stats.runs = 0;
      try {
        sessionStorage.removeItem('_sbBotLog');
        sessionStorage.removeItem('_sbBotRuns');
        sessionStorage.removeItem('_sbBotFindings');   // バグ台帳も新規セッションでリセット
      } catch (_) {}
    }
    _prevLoggedState = '';
    _resultDwell = 0;
    _enabled = true;
    if (_menuTimer == null) _menuTimer = setInterval(_menuTick, 400);
    _logEvent('START', opts.resumed ? 'resumed' : 'fresh');
    console.log('[AUTOPILOT] start', opts);
  },

  // 行動ログ取得：最新 n 件（既定 120）。後で自動解析する想定。
  dumpLog(n = 120) { return _actionLog.slice(-n); },
  clearLog() { _actionLog = []; try { sessionStorage.removeItem('_sbBotLog'); } catch (_) {} },

  // 自動解析 → バグ報告（読み取り側の入口）。
  //   行動ログ + invariant 履歴（+ 永続台帳）を集約した構造化レポートを返す。
  //   opts.print=false で console 出力抑止。SB.autopilot.report().summary で要約だけ読める。
  report(opts = {}) {
    const SB = window.SB;
    const invariants = (SB && SB.dumpInvariants) ? SB.dumpInvariants(200) : [];
    const persisted = _foldFindings();   // 今の履歴も畳んでから解析
    const rep = analyzeLogs({ actionLog: _actionLog, invariants, persisted });
    if (opts.print !== false && typeof console !== 'undefined') {
      console.log('%c=== AUTOPILOT BUG REPORT ===', 'background:#223;color:#9cf;padding:3px 8px;font-weight:bold;');
      console.log(rep.summary);
    }
    return rep;
  },
  // 永続バグ台帳の操作
  findings() { return _loadFindings(); },
  clearFindings() { try { sessionStorage.removeItem('_sbBotFindings'); } catch (_) {} },

  stop() {
    _enabled = false;
    clearVirtualKeys();
    _held = new Set();
    if (_menuTimer != null) { clearInterval(_menuTimer); _menuTimer = null; }
    try { sessionStorage.removeItem('_sbAutopilot'); } catch (_) {}
    console.log('[AUTOPILOT] stop. stats=', { ...stats });
  },

  // 起動時 autoStart 判定（index.html フックから利用）
  shouldAutoStart() {
    try { return sessionStorage.getItem('_sbAutopilot') === '1'; } catch (_) { return false; }
  },

  // JS エラー件数を加算（index.html の onerror フックから）
  _bumpJsError() { stats.jsErrors++; },
};
