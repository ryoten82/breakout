// 自動 invariant 検知システム
//
// 「意図しない挙動を起こしたら自動でログを出す」仕組み。
// プレイヤー・敵・壊れ物の状態を毎フレーム検査して、矛盾や数値異常を console.warn で出す。
//
// 3 階層：
//   🔴 致命（NaN / Infinity / 必須フィールド undefined）：フラグ不問で常時 ON・即座に警告
//   🟡 警告（HP 大幅マイナス / state ↔ フラグ矛盾）：window.SB?.DEBUG_INVARIANTS で ON
//   🟢 情報（worldXMax 超過等）：同上
//
// 重複抑止：同一フレーム内で同じ警告メッセージは 1 回まで
// レート制限：1 フレーム 10 件まで（コンソール汚染防止）
//
// 呼び出し：
//   毎フレーム update() ループ内で
//   - checkPlayer(p, frame)
//   - checkEnemy(e, frame)
//   - checkBreakable(b, frame)
//   ループ末尾で clearFrameWarnings()

const MAX_WARNS_PER_FRAME = 10;
const warnedThisFrame = new Set();
let warnCountThisFrame = 0;

// === 履歴蓄積（テストプレイ中に取得・分析するため）===
const HISTORY_MAX = 200;  // 最新 200 件まで保持（古いものから捨てる）
const history = [];        // { level, msg, frame, time, snapshot }[]
let _frameCounter = 0;

// 既知の STATE 値セット（state 文字列の妥当性チェック用）
let _knownStates = null;
export function setKnownStates(stateObj) {
  _knownStates = new Set(Object.values(stateObj));
}

// オブジェクトの主要プロパティだけ取り出し（循環参照回避・履歴保存用）
function _snapshot(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const snap = {};
  // 共通フィールド
  if (obj.x !== undefined) snap.x = obj.x;
  if (obj.y !== undefined) snap.y = obj.y;
  if (obj.z !== undefined) snap.z = obj.z;
  if (obj.vy !== undefined) snap.vy = obj.vy;
  if (obj.hp !== undefined) snap.hp = obj.hp;
  if (obj.state !== undefined) snap.state = obj.state;
  if (obj.dying !== undefined) snap.dying = obj.dying;
  if (obj.dyingPhase !== undefined) snap.dyingPhase = obj.dyingPhase;
  if (obj.isAlive !== undefined) snap.isAlive = obj.isAlive;
  if (obj.removed !== undefined) snap.removed = obj.removed;
  // breakable 系
  if (obj.userData) {
    if (obj.userData.fuseTimer !== undefined) snap.fuseTimer = obj.userData.fuseTimer;
    if (obj.userData.kind !== undefined) snap.kind = obj.userData.kind;
  }
  // mesh 位置（breakable）
  if (obj.position) {
    snap.posX = obj.position.x;
    snap.posY = obj.position.y;
  }
  return snap;
}

function _warn(level, msg, obj) {
  if (warnedThisFrame.has(msg)) return;
  if (warnCountThisFrame >= MAX_WARNS_PER_FRAME) return;
  warnedThisFrame.add(msg);
  warnCountThisFrame++;
  // 履歴に追加
  history.push({
    level,
    msg,
    frame: _frameCounter,
    time: Date.now(),
    snapshot: _snapshot(obj),
  });
  if (history.length > HISTORY_MAX) history.shift();
  // 致命=warn / 警告/情報=warn だが、prefix で区別可能に
  if (level === 'fatal') console.warn(msg, obj || '');
  else console.warn(msg, obj || '');
}

// === 履歴 API（テストプレイ取得用）===

// 最新 n 件を取得（既定 50 件）
export function dumpInvariants(n = 50) {
  return history.slice(-n);
}

// === 外部投入口（オートパイロット bot / window.onerror 等）===
// フレーム毎検査の外で起きた異常（JS 例外・スタック検知）を同じ history に乗せる。
// summarizeInvariants / invariantDumpNew でまとめて回収できる。
// 例外ループで history が溢れないよう、直近同一 msg を ~1 秒抑制する。
const _extLastSeen = new Map();  // msg -> time
const EXT_DEDUP_MS = 1000;
export function recordExternal(level, msg, snapshot) {
  const now = Date.now();
  const last = _extLastSeen.get(msg);
  if (last != null && now - last < EXT_DEDUP_MS) return;
  _extLastSeen.set(msg, now);
  history.push({ level, msg, frame: _frameCounter, time: now, snapshot: snapshot ?? null });
  if (history.length > HISTORY_MAX) history.shift();
  console.warn(msg);
}

// === 監視セッション管理（/loop 自動取得用）===
// コンテキスト消費を抑えるため、「監視すべき状態」を厳密に判定する。
// active=true の条件：markPlayStart 後 / pause 中でない / 10 分以内に入力あり
export const invariantWatch = {
  active: false,
  playStartTime: null,
  lastInputTime: 0,
  noWarnRunCount: 0,        // 新規警告なしの連続回数（/loop 側で利用）
  prevHistoryLength: 0,     // 前回 /loop 取得時の history 長
  paused: false,            // ゲーム側の pause と連動
};

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;  // 10 分

// プレイ開始マーカー：初回キー入力 or タイトル PLAY ボタンで呼ぶ
export function markPlayStart() {
  invariantWatch.active = true;
  invariantWatch.playStartTime = Date.now();
  invariantWatch.lastInputTime = Date.now();
  invariantWatch.noWarnRunCount = 0;
  invariantWatch.prevHistoryLength = history.length;
  invariantWatch.paused = false;
}

// 入力検知時に呼ぶ（lastInputTime を更新）
export function markInput() {
  if (!invariantWatch.active) return;
  invariantWatch.lastInputTime = Date.now();
}

// ゲーム一時停止と連動
export function setWatchPaused(paused) {
  invariantWatch.paused = !!paused;
  if (!paused) {
    // 再開時に入力時刻も更新（idle タイムアウトをリセット）
    invariantWatch.lastInputTime = Date.now();
  }
}

// /loop が「監視すべきか」を判定（false なら即終了して context 節約）
export function shouldWatch() {
  if (!invariantWatch.active) return false;
  if (invariantWatch.paused) return false;
  const idleMs = Date.now() - invariantWatch.lastInputTime;
  if (idleMs > IDLE_TIMEOUT_MS) {
    invariantWatch.active = false;  // 自動停止
    return false;
  }
  return true;
}

// /loop 専用：前回呼び出し以降の新規警告のみ返す（差分取得・context 節約）
export function dumpNewSinceLastCheck() {
  const newEntries = history.slice(invariantWatch.prevHistoryLength);
  invariantWatch.prevHistoryLength = history.length;
  if (newEntries.length === 0) {
    invariantWatch.noWarnRunCount++;
  } else {
    invariantWatch.noWarnRunCount = 0;
  }
  return {
    newWarnings: newEntries,
    noWarnRunCount: invariantWatch.noWarnRunCount,
    watching: invariantWatch.active && !invariantWatch.paused,
    idleMs: Date.now() - invariantWatch.lastInputTime,
  };
}

// 履歴をクリア（リスタート時等）
export function clearInvariantHistory() {
  history.length = 0;
}

// 履歴サマリ：レベル別・タグ別の集計
export function summarizeInvariants() {
  const byLevel = {};
  const byPrefix = {};
  for (const h of history) {
    byLevel[h.level] = (byLevel[h.level] || 0) + 1;
    // [INV-X🔴/🟡/🟢] xxx の X 部分でグルーピング
    const m = h.msg.match(/^\[INV-(\w)/);
    const prefix = m ? m[1] : '?';
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  }
  return {
    total: history.length,
    byLevel,
    byPrefix,
    oldest: history[0]?.time ?? null,
    newest: history[history.length - 1]?.time ?? null,
  };
}

function _isFlagOn() {
  return !!(window.SB && window.SB.DEBUG_INVARIANTS);
}

// === プレイヤー検査 ===
export function checkPlayer(p, frame) {
  if (!p) return;
  // 🔴 致命：数値の健全性（フラグ不問・常時 ON）
  if (!Number.isFinite(p.x))  _warn('fatal', `[INV-P🔴] p${p._dbgIdx ?? ''}.x not finite (${p.x})`, p);
  if (!Number.isFinite(p.y))  _warn('fatal', `[INV-P🔴] p${p._dbgIdx ?? ''}.y not finite (${p.y})`, p);
  if (!Number.isFinite(p.z))  _warn('fatal', `[INV-P🔴] p${p._dbgIdx ?? ''}.z not finite (${p.z})`, p);
  if (!Number.isFinite(p.vy)) _warn('fatal', `[INV-P🔴] p${p._dbgIdx ?? ''}.vy not finite (${p.vy})`, p);
  if (!Number.isFinite(p.hp)) _warn('fatal', `[INV-P🔴] p${p._dbgIdx ?? ''}.hp not finite (${p.hp})`, p);
  // 🔴 state が undefined / null
  if (p.state == null) _warn('fatal', `[INV-P🔴] p${p._dbgIdx ?? ''}.state is ${p.state}`, p);

  if (!_isFlagOn()) return;
  // 🟡 警告：state が既知の STATE 値外
  if (_knownStates && p.state != null && !_knownStates.has(p.state)) {
    _warn('warn', `[INV-P🟡] p.state unknown: "${p.state}"`, p);
  }
  // 🟡 HP 大幅マイナス（dying 経路で多少のマイナスは許容、-100 以下は異常）
  if (p.hp < -100) _warn('warn', `[INV-P🟡] p.hp << 0 (${p.hp})`, p);
}

// === 敵検査 ===
export function checkEnemy(e, frame) {
  if (!e) return;
  // 🔴 致命：数値の健全性
  if (!Number.isFinite(e.x))  _warn('fatal', `[INV-E🔴] e.x not finite (${e.x})`, e);
  if (!Number.isFinite(e.y))  _warn('fatal', `[INV-E🔴] e.y not finite (${e.y})`, e);
  if (!Number.isFinite(e.z))  _warn('fatal', `[INV-E🔴] e.z not finite (${e.z})`, e);
  if (!Number.isFinite(e.vy)) _warn('fatal', `[INV-E🔴] e.vy not finite (${e.vy})`, e);
  if (e.hp != null && !Number.isFinite(e.hp)) _warn('fatal', `[INV-E🔴] e.hp not finite (${e.hp})`, e);
  // 🔴 state が undefined / null
  if (e.state == null) _warn('fatal', `[INV-E🔴] e.state is ${e.state}`, e);
  // 🔴 dying と dyingPhase の整合
  if (e.dying && !e.dyingPhase) _warn('fatal', `[INV-E🔴] e dying=true but dyingPhase=${e.dyingPhase}`, e);

  if (!_isFlagOn()) return;
  // 🟡 警告：state が既知の STATE 値外
  if (_knownStates && e.state != null && !_knownStates.has(e.state)) {
    _warn('warn', `[INV-E🟡] e.state unknown: "${e.state}"`, e);
  }
  // 🟡 HP 大幅マイナス
  if (e.hp != null && e.hp < -100) _warn('warn', `[INV-E🟡] e.hp << 0 (${e.hp})`, e);
  // 🟡 dyingPhase 単独セット
  if (!e.dying && e.dyingPhase) _warn('warn', `[INV-E🟡] e dyingPhase=${e.dyingPhase} but dying=false`, e);
  // 🟡 isAlive=false なのに hp > 0
  //   例外：穴落下中（_inHole）は意図的に isAlive=false（updateEnemies スキップで落下させる）＋
  //   ダメージ死でないため hp が残る。落下→despawn まで毎 F 警告するノイズを抑止（floor-hole._dropEnemy）。
  if (e.isAlive === false && e.hp > 0 && !e._inHole) _warn('warn', `[INV-E🟡] e isAlive=false but hp=${e.hp} > 0`, e);
  // 🟢 情報：world 範囲外（極端な値のみ）
  if (Math.abs(e.x) > 100000) _warn('info', `[INV-E🟢] e.x very large (${e.x})`, e);
  if (e.y > 10000)            _warn('info', `[INV-E🟢] e.y very high (${e.y})`, e);
}

// === breakable 検査 ===
export function checkBreakable(b, frame) {
  if (!b || !b.userData) return;
  // 🔴 致命：mesh position の健全性
  if (b.position && !Number.isFinite(b.position.x)) {
    _warn('fatal', `[INV-B🔴] breakable position.x not finite`, b);
  }
  if (b.position && !Number.isFinite(b.position.y)) {
    _warn('fatal', `[INV-B🔴] breakable position.y not finite`, b);
  }
  // 🔴 fuseTimer マイナス（負のタイマーは爆発判定の事故）
  if (b.userData.fuseTimer != null && b.userData.fuseTimer < -5) {
    _warn('fatal', `[INV-B🔴] fuseTimer << 0 (${b.userData.fuseTimer})`, b);
  }
  // 🔴 vy 異常値
  if (b.userData.vy != null && !Number.isFinite(b.userData.vy)) {
    _warn('fatal', `[INV-B🔴] vy not finite (${b.userData.vy})`, b);
  }

  if (!_isFlagOn()) return;
  // 🟡 警告：alive=false なのにシーンに残ってる
  if (b.userData.alive === false && b.parent != null) {
    _warn('warn', `[INV-B🟡] breakable alive=false but still in scene`, b);
  }
  // 🟡 dying=true なのに fuseTimer=0 で長時間放置（爆散経路を通っていない）
  if (b.userData.dying && b.userData.fuseTimer === 0 && b.userData.isExplosive) {
    _warn('warn', `[INV-B🟡] dying canister with fuseTimer=0 (should be detonating)`, b);
  }
}

// === 攻撃トークン整合性検査 ===
// attackToken が dying / removed の敵を保持していないか（カテゴリ別トークン各枠に適用）
export function checkAttackToken(token, frame) {
  if (!token) return;
  // 🔴 token が enemy 参照だが、その敵が removed / isAlive=false
  if (token.removed || token.isAlive === false) {
    _warn('fatal', `[INV-T🔴] attackToken refers removed/dead enemy`, token);
  }
  if (!_isFlagOn()) return;
  // 🟡 dying enemy を持ち続けている
  if (token.dying) {
    _warn('warn', `[INV-T🟡] attackToken refers dying enemy (state=${token.state})`, token);
  }
}

// === 毎フレーム末尾で呼ぶ：警告セットをクリア ===
// frame を引数で受けると履歴にフレーム番号が乗る（呼び出し側 getGameFrame() 推奨）
export function clearFrameWarnings(frame) {
  warnedThisFrame.clear();
  warnCountThisFrame = 0;
  if (typeof frame === 'number') _frameCounter = frame;
}

// === デバッグ用ヘルパ：現在の警告状況を返す ===
export function getInvariantState() {
  return {
    flagOn:         _isFlagOn(),
    warnCountThisFrame,
    warnedCount:    warnedThisFrame.size,
    maxPerFrame:    MAX_WARNS_PER_FRAME,
  };
}
