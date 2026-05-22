// ピンボール衝突 — KB 中の敵 A が他敵 B / 壊れ物に当たると軌道変化
//
// 想定挙動：
// - lv6（atk_lv=6 由来・down_super_start/loop）で吹き飛ばされた A が B に当たる
//   → A: down_rakka（垂直叩きつけ）/ B: 後方吹き飛び（lv3）
// - 空中 sp1（c01_sp_01_air）で打ち上げられた A が B に当たる
//   → A: 斜め上に dmg_super で再射出（lv6）/ B: 通常吹き飛び
// - 壊れ物（crate / canister）への衝突も同じ枠組みで扱う
//   → A 反射 + 壊れ物破壊シーケンス開始
//
// メモ：
// - 既存 throw chain（tryThrownChainHit）は thrownProjectile=true 専用。本モジュールは
//   通常 KB（down_super / down_front の速度大）にも作用させて「ピンボール」感を出す。
// - 1 mover につき 1 フレーム最大 1 ヒット。連続ヒット防止クールダウン _pinballCooldown フレーム。

import {
  STATE,
  KB_LV03_VY, KB_LV03_VX_MULT,
  KB_LV05_VY,
  KB_LV06_VY, KB_LV06_VX_MULT,
  ENEMY_DOWN_SUPER_FRAMES, ENEMY_DOWN_RAKKA_FRAMES, ENEMY_DOWN_FRONT_FRAMES,
  ENEMY_FALL_FRAMES,
  ENEMY_AIRBORNE_Y_THRESHOLD,
  applyHitInitialPitch,
} from './states.js';

// lv6 衝突時のボウリング打ち上げ（sp_02 の launchVy=22 と同じ挙動）
const BOWLING_LAUNCH_VY = 22;

// 衝突判定範囲（mover サイズ感）
const HIT_RANGE_X = 80;
const HIT_RANGE_Y = 100;
const HIT_RANGE_Z = 50;

// mover 速度がこれ以上ないとピンボール判定しない（通常コンボ ヒットを汚染しないため）
const MIN_KBVX = 6;

// 1 衝突後の再判定クールダウン
const PINBALL_COOLDOWN = 10;

// 「ピンボール mover」として扱うか判定
function _isPinballMover(e) {
  if (!e || !e.isAlive || e.dying) return false;
  if (e.frozenByUlt) return false;
  // lv6 super：吹き飛び/打ち上げの王道
  if (e.state === STATE.down_super_start || e.state === STATE.down_super_loop) return true;
  // 空中 KB 系（sp1_air 等で打ち上げられた状態）
  if (e.state === STATE.down_front_start || e.state === STATE.down_front_loop) {
    if (Math.abs(e.knockbackVx) >= MIN_KBVX) return true;
  }
  return false;
}

// 既にダウン/被弾系にいる敵は再被弾対象外（過剰連鎖を防ぐ）
function _isAlreadyDowned(e) {
  return (
    e.state === STATE.down_front_start || e.state === STATE.down_front_loop ||
    e.state === STATE.down_bas_start   || e.state === STATE.down_bas_loop   || e.state === STATE.down_bas_end ||
    e.state === STATE.down_super_start || e.state === STATE.down_super_loop ||
    e.state === STATE.down_rakka_start || e.state === STATE.down_rakka_loop ||
    e.state === STATE.down_bound_start ||
    e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop ||
    e.state === STATE.down_roll_start  || e.state === STATE.down_roll_loop ||
    e.state === STATE.grabbed
  );
}

// mover の元 attack 由来を見て、衝突後の mover 軌道を決定
function _redirectMover(mover) {
  const lv  = mover.lastHitter?.lv ?? null;
  const aid = mover.lastHitter?.attackId ?? '';
  // 1) 空中 SP1（c01_sp_01_air）など「打ち上げ系」由来は斜め上に dmg_super で再射出
  if (aid.includes('sp_01_air') || aid.includes('atk_l_01_air')) {
    mover.state         = STATE.down_super_start;
    mover.downTimer     = ENEMY_DOWN_SUPER_FRAMES;
    mover.vy            = KB_LV06_VY;
    // 反射方向：mover の進行方向反対へ
    mover.knockbackVx   = -mover.knockbackVx * 0.6;
    mover.kbDecay       = 0.85;
    mover.fallDir       = Math.sign(mover.knockbackVx) || mover.fallDir || 1;
    mover.peakHangTimer = 0;
    mover.launcherAirborne = false;
    applyHitInitialPitch(mover);
    return 'redirect_super';
  }
  // 2) lv6（down_super）→ ボウリング打ち上げ（sp_02 の launchVy=22 と同じ挙動）
  //    旧仕様 down_rakka（下叩き）→ ユーザー指示で打ち上げに変更（2026-05-19）
  //    sp_02 と同じ「down_up_start + launcherAirborne(頂点スロー)」で緩やかに落下
  if (lv === 6 || mover.state === STATE.down_super_start || mover.state === STATE.down_super_loop) {
    mover.state            = STATE.down_up_start;
    mover.downTimer        = ENEMY_FALL_FRAMES;
    mover.vy               = BOWLING_LAUNCH_VY;
    mover.knockbackVx     *= 0.2;
    mover.kbDecay          = 0.78;
    mover.launcherAirborne = true;             // LAUNCH_COMBO 相当：頂点スローで「重力緩やか」感
    mover.peakHangTimer    = 0;
    applyHitInitialPitch(mover);
    return 'redirect_bowling_launch';
  }
  // 3) その他：軽い反射のみ
  mover.knockbackVx *= -0.4;
  mover.vy = Math.max(mover.vy, 6);
  return 'redirect_bounce';
}

// 被弾 target を後方吹き飛びに（lv3 系）
function _applyTargetHit(target, mover, ctx) {
  const dir = Math.sign(mover.knockbackVx) || mover.facing || 1;
  target.hp = Math.max(0, target.hp - 10);
  target.lastHitter = {
    attackId: 'pinball_chain',
    profileKey: 'METEO',
    facing: dir,
    lv: 3,
    wasGrounded: target.y <= ENEMY_AIRBORNE_Y_THRESHOLD,
  };
  target.hitFlashTimer  = 7;
  target.fallDir        = dir;
  target.vy             = KB_LV03_VY;
  target.knockbackVx    = dir * Math.max(8, Math.abs(mover.knockbackVx) * 0.8);
  target.kbDecay        = 0.78;
  target.state          = STATE.down_front_start;
  target.downTimer      = ENEMY_DOWN_FRONT_FRAMES;
  target.peakHangTimer  = 0;
  target.launcherAirborne = false;
  // AI 攻撃中だった場合のクリーンアップ
  target.atkPhase    = null;
  target.atkTimer    = 0;
  target.atkCooldown = 30;
  target.hitDelivered = false;
  if (ctx?.attackTokens) {
    const _pCat = target.curAtkCategory ?? 'melee';
    const _pTok = ctx.attackTokens[_pCat];
    if (_pTok && _pTok.get() === target) _pTok.set(null);
  }
  applyHitInitialPitch(target);
}

// 毎フレーム呼ぶ：mover→ターゲット（敵 / 壊れ物）の衝突判定
// 呼び出し場所：enemy-system update ループ内
// ctx: { enemies, attackTokens, breakablesApi, spawnHitParticles, triggerHitstop, triggerShake }
//   breakablesApi: { findBreakableHitBy, hitBreakableExternal } | null
export function tryPinballHit(mover, ctx) {
  if (!_isPinballMover(mover)) return false;
  if ((mover._pinballCooldown ?? 0) > 0) {
    mover._pinballCooldown--;
    return false;
  }
  // (A) 他敵との衝突
  const enemies = ctx.enemies || [];
  for (const other of enemies) {
    if (other === mover) continue;
    if (!other.isAlive || other.dying) continue;
    if (other.frozenByUlt) continue;
    if (other.goreCritical && other.goreCritical.armed) continue;
    if (_isAlreadyDowned(other)) continue;
    const dx = Math.abs(other.x - mover.x);
    const dy = Math.abs((other.y || 0) - (mover.y || 0));
    const dz = Math.abs((other.z || 0) - (mover.z || 0));
    if (dx > HIT_RANGE_X) continue;
    if (dy > HIT_RANGE_Y) continue;
    if (dz > HIT_RANGE_Z) continue;
    _applyTargetHit(other, mover, ctx);
    _redirectMover(mover);
    mover._pinballCooldown = PINBALL_COOLDOWN;
    _fxImpact(mover, other, ctx);
    return true;
  }
  // (B) 壊れ物との衝突
  if (ctx.breakablesApi) {
    const b = ctx.breakablesApi.findBreakableHitBy(
      mover.x, mover.y, mover.z,
      HIT_RANGE_X * 0.6, HIT_RANGE_Y * 0.6, HIT_RANGE_Z * 0.6,
    );
    if (b) {
      ctx.breakablesApi.hitBreakableExternal(b, { hitstop: 0 });
      _redirectMover(mover);
      mover._pinballCooldown = PINBALL_COOLDOWN;
      _fxImpactBreakable(mover, b, ctx);
      return true;
    }
  }
  return false;
}

function _fxImpact(mover, other, ctx) {
  const midX = (mover.x + other.x) / 2;
  const midY = (mover.y + other.y) / 2 + 50;
  const midZ = (mover.z + other.z) / 2;
  if (ctx.spawnHitParticles) ctx.spawnHitParticles(midX, midY, midZ, 0xffaa44, 18, { type: 'normal' });
  if (ctx.triggerHitstop) ctx.triggerHitstop(10);
  if (ctx.triggerShake)   ctx.triggerShake(8, 12);
}

function _fxImpactBreakable(mover, b, ctx) {
  const midX = (mover.x + b.position.x) / 2;
  const midY = (mover.y + b.position.y + (b.userData.aabb?.hh ?? 40)) / 2 + 30;
  const midZ = (mover.z + b.position.z) / 2;
  if (ctx.spawnHitParticles) ctx.spawnHitParticles(midX, midY, midZ, 0xffcc66, 14, { type: 'normal' });
  if (ctx.triggerHitstop) ctx.triggerHitstop(8);
  if (ctx.triggerShake)   ctx.triggerShake(6, 10);
}
