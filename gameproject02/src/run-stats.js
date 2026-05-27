// ランごとの戦績集約モジュール（リザルト画面の data source）
// 各システム（hit-engine / rc-system / 敵死亡フロー等）から push してもらう設計。
// Act 開始時に resetRun() で初期化する。
// 時間計測は Date.now() の wall-clock ベース（player-system との循環参照回避）。

const _stats = {
  startMs: Date.now(),
  endMs: null,           // 確定後は固定（リザルト表示中に増えないよう）
  maxCombo: 0,
  maxBurst: 0,
  rcSuccess: 0,
  critical: 0,
  kills: 0,
  damageBase: 0,         // 通常攻撃で与えたダメージ累計
  damageElement: 0,      // 属性（METEO=延焼DoT + 爆発）で与えたダメージ累計
  chips: [],             // 取得チップ rarityKey 配列（取得順）
};

export function resetRun() {
  _stats.startMs = Date.now();
  _stats.endMs = null;
  _stats.maxCombo = 0;
  _stats.maxBurst = 0;
  _stats.rcSuccess = 0;
  _stats.critical = 0;
  _stats.kills = 0;
  _stats.damageBase = 0;
  _stats.damageElement = 0;
  _stats.chips = [];
}

export function recordCombo(n) {
  if (typeof n !== 'number') return;
  if (n > _stats.maxCombo) _stats.maxCombo = n | 0;
}

export function recordBurst(n) {
  if (typeof n !== 'number') return;
  if (n > _stats.maxBurst) _stats.maxBurst = n | 0;
}

export function recordRcSuccess() {
  _stats.rcSuccess++;
}

export function recordCritical() {
  _stats.critical++;
}

export function recordKill() {
  _stats.kills++;
}

// kind: 'base'（通常攻撃）/ 'element'（延焼DoT・爆発など属性由来）
export function recordDamage(amount, kind = 'base') {
  if (typeof amount !== 'number' || amount <= 0) return;
  if (kind === 'element') _stats.damageElement += amount | 0;
  else                    _stats.damageBase    += amount | 0;
}

// rarityKey: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
export function recordChip(rarityKey) {
  if (!rarityKey) return;
  _stats.chips.push(rarityKey);
}

// リザルト確定（時間カウンタを固定する）
export function finalizeRun() {
  if (_stats.endMs == null) _stats.endMs = Date.now();
}

// 表示用スナップショット。残 HP / CR はその場で外部 source から拾う
export function getRunStats() {
  const endMs = _stats.endMs != null ? _stats.endMs : Date.now();
  const seconds = Math.max(0, Math.floor((endMs - _stats.startMs) / 1000));

  const hp = window?.SB?.players?.[0]?.hp ?? 0;
  const maxHp = window?.SB?.players?.[0]?.maxHp ?? 1;
  const hpPct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));

  const cr = (typeof window?.SB?.getCrTotal === 'function')
    ? (window.SB.getCrTotal() | 0) : 0;

  const ocCards = Array.isArray(window?.SB?._ocAppliedCards)
    ? window.SB._ocAppliedCards.slice() : [];

  return {
    timeSec: seconds,
    timeStr: _formatMmSs(seconds),
    kills: _stats.kills,
    hpPct,
    crEarned: cr,
    maxCombo: _stats.maxCombo,
    maxBurst: _stats.maxBurst,
    rcSuccess: _stats.rcSuccess,
    critical: _stats.critical,
    damageBase: _stats.damageBase,
    damageElement: _stats.damageElement,
    damageTotal: _stats.damageBase + _stats.damageElement,
    chips: _stats.chips.slice(),
    ocCards,
  };
}

function _formatMmSs(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// デバッグ確認用
if (typeof window !== 'undefined') {
  window.SB = window.SB || {};
  window.SB.runStats = {
    reset: resetRun,
    get: getRunStats,
    recordCombo, recordBurst, recordRcSuccess, recordCritical, recordKill, recordDamage, recordChip,
    finalize: finalizeRun,
  };
}
