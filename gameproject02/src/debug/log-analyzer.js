// ============================================================
//  SCRAP BLITZ — ログ自動解析（オートパイロット bot の「読み取り側」）
//
//  行動ログ（SB.autopilot.dumpLog）と invariant 履歴（SB.dumpInvariants）を
//  受け取り、バグ報告に使える構造化レポートへ集約する純関数。
//
//  - invariant：メッセージを正規化（数値・state 値を伏せる）して同種をまとめる。
//    🔴 fatal（NaN/必須欠落/JS 例外）と 🟡 warn を分離。
//  - 行動ログ：死亡ホットスポット（STATE→DOWN）／ナビ詰まり（BLOCKED）を
//    stage + x バケットでグルーピング。ラン数・最高到達 stage も集計。
//  - severity：🔴 あり=high / 🟡 多発=medium / それ以外の異常=low / 無=none。
//
//  生ログを全部読まず、このレポート 1 個を読めば triage できる（自動解析・自動報告の入口）。
// ============================================================

// メッセージ正規化：数値（負/小数含む）と state=xxx を伏せて同種を集約。
export function sigOf(msg) {
  return String(msg)
    .replace(/-?\d+(\.\d+)?/g, 'N')
    .replace(/state=[a-zA-Z0-9_]+/g, 'state=*')
    .replace(/@[^\s]+/g, '@*');   // ファイルパス:行:列 等を伏せる
}

function _bucketX(x, size = 200) {
  if (x == null || !Number.isFinite(x)) return null;
  return Math.round(x / size) * size;
}

const STAGE_ORDER = { stage01: 1, stage02: 2, stage03: 3, bossTest: 9, actionTest: 9 };

// invariants: [{level,msg,frame,time,snapshot}], persisted: { sig: {...} }
export function analyzeLogs({ actionLog = [], invariants = [], persisted = {} } = {}) {
  // ---- 1) invariant グルーピング（live 履歴 + 永続集約をマージ）----
  const groups = {};
  const windowCount = {};
  for (const w of invariants) {
    const sig = sigOf(w.msg);
    windowCount[sig] = (windowCount[sig] || 0) + 1;
  }
  for (const w of invariants) {
    const sig = sigOf(w.msg);
    const g = groups[sig] || (groups[sig] = {
      sig, level: w.level, count: 0, msgSample: w.msg,
      firstFrame: w.frame, lastFrame: w.frame, sample: w.snapshot || null, stages: [],
    });
    g.count = windowCount[sig];     // この window 内の出現数
    g.lastFrame = w.frame;
    if (!g.sample && w.snapshot) g.sample = w.snapshot;
  }
  // 永続集約（reload またぎ）をマージ：count は大きい方を採用（過剰カウント防止の近似）
  for (const sig in persisted) {
    const pf = persisted[sig];
    const g = groups[sig] || (groups[sig] = {
      sig, level: pf.level, count: 0, msgSample: pf.msgSample,
      firstFrame: pf.firstFrame, lastFrame: pf.lastFrame, sample: pf.sample || null, stages: pf.stages || [],
    });
    g.count = Math.max(g.count, pf.count || 0);
    g.stages = Array.from(new Set([...(g.stages || []), ...(pf.stages || [])]));
    if (!g.sample && pf.sample) g.sample = pf.sample;
  }
  const all = Object.values(groups);
  const fatal = all.filter(g => g.level === 'fatal').sort((a, b) => b.count - a.count);
  const warn  = all.filter(g => g.level !== 'fatal').sort((a, b) => b.count - a.count);

  // ---- 2) 行動ログ：死亡 / ナビ詰まり ホットスポット + ラン集計 ----
  const blockMap = {};
  const deathMap = {};
  let maxRun = 0;
  let reached = null;
  for (const e of actionLog) {
    if (typeof e.run === 'number') maxRun = Math.max(maxRun, e.run);
    if (e.stage && STAGE_ORDER[e.stage] && (!reached || STAGE_ORDER[e.stage] > STAGE_ORDER[reached])) {
      reached = e.stage;
    }
    if (e.type === 'BLOCKED') {
      const k = `${e.stage}@${_bucketX(e.x)}`;
      const b = blockMap[k] || (blockMap[k] = { stage: e.stage, xApprox: _bucketX(e.x), count: 0, sampleMsg: e.msg });
      b.count++;
    }
    // 死亡/ラン終了地点：STATE→DOWN（tick が観測できた時）と RESTART（result 発生地点）を両方拾う。
    //   ヘッドレスでは tick が死亡を観測できないことがあるため RESTART の座標が主シグナル。
    if ((e.type === 'STATE' && /→DOWN$/.test(e.msg)) || e.type === 'RESTART') {
      const k = `${e.stage}@${_bucketX(e.x)}`;
      const d = deathMap[k] || (deathMap[k] = { stage: e.stage, xApprox: _bucketX(e.x), count: 0, lastHp: e.hp });
      d.count++;
    }
  }
  const navBlocked    = Object.values(blockMap).sort((a, b) => b.count - a.count);
  const deathHotspots = Object.values(deathMap).sort((a, b) => b.count - a.count);

  // ---- 3) severity ----
  let severity = 'none';
  if (warn.length || navBlocked.length || deathHotspots.length) severity = 'low';
  if (warn.some(g => g.count >= 20)) severity = 'medium';
  if (fatal.length) severity = 'high';

  // ---- 4) 人間可読サマリ ----
  const L = [];
  L.push(`runs=${maxRun + 1}  reached=${reached || '?'}  severity=${severity}`);
  if (fatal.length) {
    L.push(`🔴 FATAL (${fatal.length} 種):`);
    fatal.slice(0, 8).forEach(g => L.push(`  ×${g.count}  ${g.msgSample}`));
  }
  if (warn.length) {
    L.push(`🟡 WARN (${warn.length} 種):`);
    warn.slice(0, 10).forEach(g => L.push(`  ×${g.count}${g.stages.length ? ` [${g.stages.join(',')}]` : ''}  ${g.msgSample}`));
  }
  if (deathHotspots.length) {
    L.push(`☠ 死亡ホットスポット:`);
    deathHotspots.slice(0, 6).forEach(d => L.push(`  ×${d.count}  ${d.stage}@x~${d.xApprox}`));
  }
  if (navBlocked.length) {
    L.push(`⛔ ナビ詰まり（X+Z 両側失敗）:`);
    navBlocked.slice(0, 6).forEach(b => L.push(`  ×${b.count}  ${b.stage}@x~${b.xApprox}`));
  }
  if (!fatal.length && !warn.length && !navBlocked.length && !deathHotspots.length) {
    L.push('（異常検出なし）');
  }

  return {
    runs: maxRun + 1,
    reached,
    severity,
    invariants: { fatal, warn, liveCount: invariants.length },
    deathHotspots,
    navBlocked,
    summary: L.join('\n'),
  };
}
