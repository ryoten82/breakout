// ============================================================
//  SCRAP BLITZ — player-system（分離 Phase: Step E-4a）
//
//  プレイヤー側の入力・ガード・必殺技・コンボホーミングを集約：
//    - processGuardInput        L キーガード（SP 消費・フェードアウト・後退）
//    - readDirInput / updateDirHistory / dirMatchesForFacing
//                              方向入力履歴管理（必殺技コマンド判定の基盤）
//    - updateChargeJ            J 長押し蓄積（チャージ必殺の前段）
//    - canStartSpecial / specialBaseId / startSpecial
//                              必殺技発動の gate / ID 正規化 / 起動
//    - processSpecialInput      コマンド / チャージ → 必殺技 dispatch
//    - processStrongAttackInput K 攻撃（強攻撃 / ステップ K / バッファ）
//    - updateComboHoming        最初に殴った敵への自動接近（コンボ補正）
//
//  ES Module として index.html から import される：
//    import {
//      initPlayerSystem,
//      processGuardInput, readDirInput, dirMatchesForFacing,
//      updateChargeJ, processSpecialInput,
//      processStrongAttackInput,
//      updateComboHoming,
//      getGameFrame, chargeRingState,
//    } from './src/player-system.js';
//
//  initPlayerSystem(deps) で依存を一括注入：
//    - inp: (code) => bool             入力ポーリング関数
//    - spawnChargeParticle, clearChargeParticles  FX function refs
//    - chargeReadyRing: THREE.Mesh     チャージ完成リング mesh
// ============================================================

import {
  STATE, PLAYER_JUMP_STATES, STATE_PITCH_TARGET, ENEMY_AIRBORNE_Y_THRESHOLD,
  PLAYER_JUMP_START_FRAMES, PLAYER_JUMP_D_START_FRAMES,
  PLAYER_JUMP_END_FRAMES, PLAYER_JUMP_D_END_FRAMES,
} from './states.js';
import {
  PHYSICS, SP_CONFIG,
  GUARD_CONFIG, SPECIAL_CONFIG, HOMING_CONFIG,
  CHARGE_PARTICLE_CONFIG, CHARGE_RING_CONFIG,
  DUMMY_ATK_CONFIG, ENEMY_ATTACKS, UKEMI_CONFIG,
} from './config.js';
import { ATTACKS, getHitWindowEnd } from './attacks.js';
import {
  anyPlayerUlting, isMegaSlowActive, isMegaComboGrace, cancelGrabIntoAttack, startAttackById,
  pickSpecialAttackId,
  processGrabInput, tryGrabActivate, processAttackInput,
  consumeAttackBuffer,
  processDashInput, tryCancelJump,
  updateAttack, updateHitConfirm,
} from './attack-engine.js';
import {
  isHitstunState, updatePlayerHitstun,
  updateCrisisEffect, updateInvincibleBlink,
  _cancelHitstunForReversal,
} from './damage-system.js';
import { spawnHitParticles } from './hit-engine.js';
import { getActiveWallX } from './camera.js';

let _inp = null;
let _spawnChargeParticle = null;
let _clearChargeParticles = null;
let _chargeReadyRing = null;
// E-4b 追加 deps（updatePlayer 用）
let _enemies = null;
let _processMegaCrashUltInput = null;
let _applyBodyEmissive = null;
let _getEnemyHitboxMesh = null;
let _hideAllEnemyHitboxes = null;
let _guardShield = null;
let _specialHitboxMesh = null;
let _PART_REST = null;
let _PART_ANIMS = null;

// 内部 module state（旧 index.html の let を移管）
let gameFrameCounter = 0;
let kKeyWasDown = false;

// チャージリング FX 状態：updateChargeRingFX（index.html）が読み取るため export
export const chargeRingState = {
  frames: 0,
  x: 0, y: 0, z: 0,
};

export function getGameFrame() {
  return gameFrameCounter;
}

export function initPlayerSystem(deps) {
  _inp = deps.inp;
  _spawnChargeParticle = deps.spawnChargeParticle;
  _clearChargeParticles = deps.clearChargeParticles;
  _chargeReadyRing = deps.chargeReadyRing;
  // E-4b 追加
  _enemies = deps.enemies;
  _processMegaCrashUltInput = deps.processMegaCrashUltInput;
  _applyBodyEmissive = deps.applyBodyEmissive;
  _getEnemyHitboxMesh = deps.getEnemyHitboxMesh;
  _hideAllEnemyHitboxes = deps.hideAllEnemyHitboxes;
  _guardShield = deps.guardShield;
  _specialHitboxMesh = deps.specialHitboxMesh;
  _PART_REST = deps.PART_REST;
  _PART_ANIMS = deps.PART_ANIMS;
}

// ============================================================
//  #section guard — METEO L キー前方ガード
//  仕様: 長押しで持続消費・移動可・攻撃不可。離す or SP 切れで即解除→フェードアウト
// ============================================================
export function processGuardInput(p) {
  // 「新規起動／SP 消費」はブロック対象だが、「フェードアウトの進行」は常に走らせる
  // → ULT・グラブ・攻撃などで早期 return すると以前は bar/シールドが固まった
  const blockNewInput = p.ultActive || (p.state === STATE.grabbing);
  const lHeld = _inp('KeyL');

  if (!blockNewInput) {
    const lEdge = lHeld && !p._lWasHeld;  // L の rising edge
    // hit_confirm はガード起動許可：空中 SP 着地後の防御不可問題を解消（2026-05-26）。
    // attacking のみ排除（攻撃モーション中のガード割り込みは禁止）。
    const baseEligible =
      !p.guarding &&
      p.isGrounded &&
      p.state !== STATE.attacking;
    // J+K 同時押し中の L 押下は ULT 入力候補なのでガードに入らない（誤発動防止・2026-05-15）
    // 旧版だと L 押した瞬間にガード起動 → p.guarding=true → ULT 入力 blocked で ULT が出なかった
    const _jkAlsoHeld = _inp('KeyJ') && _inp('KeyK');
    const canStart = lHeld && baseEligible && p.sp >= GUARD_CONFIG.MIN_SP_TO_START
      && !_jkAlsoHeld;
    if (canStart) {
      p.guarding       = true;
      p.guardFadeTimer = 0;
      // ダッシュ中にガードに移行 → 強制的に歩きへ
      if (p.dashActive) {
        p.dashActive   = false;
        p.dashCooldown = PHYSICS.DASH_COOLDOWN;
      }
    }
    // SP 不足で L を新規押下した時：エネルギー不足の点滅フィードバック
    if (lEdge && baseEligible && p.sp < GUARD_CONFIG.MIN_SP_TO_START) {
      p.guardFailFlashTimer = GUARD_CONFIG.FAIL_FLASH_FRAMES;
    }
    p._lWasHeld = lHeld;
    if (p.guarding) {
      // ガード成功直後の SP 減少ポーズ（手応え演出・damagePlayer がセット）
      if (p.guardDrainPauseTimer > 0) {
        p.guardDrainPauseTimer--;
      } else {
        // SP 消費 + 維持条件チェック
        p.sp -= GUARD_CONFIG.SP_DRAIN;
      }
      // ガード成功の軽い後退（damagePlayer がセット・徐々に減衰）
      if (p.guardKbVx !== 0) {
        p.x += p.guardKbVx;
        p.guardKbVx *= GUARD_CONFIG.HIT_KB_DECAY;
        if (Math.abs(p.guardKbVx) < 0.05) p.guardKbVx = 0;
      }
      // 発光タイマー減算（描画は guardShield 同期ブロックで処理）
      if (p.guardFlashTimer > 0) p.guardFlashTimer--;
      if (p.sp <= 0) {
        p.sp = 0;
        p.guarding = false;
      } else if (!lHeld && p.guardDrainPauseTimer <= 0) {
        // ガード成功直後の硬直中（drainPause > 0）はボタン離しても解除しない
        p.guarding = false;
      }
      // 攻撃で割り込まれた場合（将来用：被弾やメガクラ等が p.guarding を強制 false にする）
      if (p.state === STATE.attacking) p.guarding = false;
      // 解除した瞬間：フェードアウトタイマー始動・歩行 state を idle に戻す
      if (!p.guarding) {
        p.guardFadeTimer = GUARD_CONFIG.FADE_OUT_FRAMES;
        if (p.state === STATE.walk_fwd || p.state === STATE.walk_back) p.state = STATE.wait01;
      }
    }
  } else if (p.guarding) {
    // ULT・グラブ等が発生 → ガード強制解除しフェードアウトへ
    p.guarding = false;
    p.guardFadeTimer = GUARD_CONFIG.FADE_OUT_FRAMES;
    if (p.state === STATE.walk_fwd || p.state === STATE.walk_back) p.state = STATE.wait01;
  }

  // 不透明度の更新（常に走らせる：フェード中に他状態へ遷移しても opacity を 0 まで完走させる）
  if (p.guarding) {
    // 発動中は素早く 1 へ
    p.guardOpacity += (1 - p.guardOpacity) * GUARD_CONFIG.FADE_IN_LERP;
  } else if (p.guardFadeTimer > 0) {
    // フェードアウト中：FADE_OUT_FRAMES 以上は opacity=1 を維持、以下で線形フェード
    // これにより guard_crash 等でタイマーを延ばしてもノックバック中は shield が見え続ける
    p.guardFadeTimer--;
    p.guardOpacity = Math.min(1.0, p.guardFadeTimer / GUARD_CONFIG.FADE_OUT_FRAMES);
  } else {
    p.guardOpacity = 0;
  }
}

// ガードシールドメッシュの同期（hitstop 中・hitstun 中・通常フレームで共用）。
// updatePlayer はヒットストップ中に呼ばれないため、index.html の hitstop ブロックでも
// この関数を呼ぶことで「シールドが古い状態で固まる」問題を解消する。
export function syncGuardShield(p) {
  if (!_guardShield) return;
  if ((p.guardCrashFadeTimer ?? 0) > 0) {
    const t = 1 - p.guardCrashFadeTimer / GUARD_CONFIG.CRASH_SHIELD_FADE;
    _guardShield.visible = true;
    _guardShield.position.set(p.guardCrashX, p.guardCrashY, p.guardCrashZ);
    _guardShield.rotation.y = (p.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
    _guardShield.scale.setScalar(1 + t * 0.7);
    _guardShield.material.color.setHex(0xffffff);
    _guardShield.material.opacity = (1 - t) * GUARD_CONFIG.FLASH_OPACITY;
    p.guardCrashFadeTimer--;
    if (p.guardCrashFadeTimer <= 0) _guardShield.scale.setScalar(1);
  } else if (p.guardOpacity > 0.01) {
    _guardShield.scale.setScalar(1);
    _guardShield.visible = true;
    _guardShield.position.set(p.x, p.y + GUARD_CONFIG.SHIELD_Y_OFFSET, p.z);
    _guardShield.rotation.y = (p.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
    const flashT = (p.guardFlashTimer > 0) ? (p.guardFlashTimer / GUARD_CONFIG.FLASH_FRAMES) : 0;
    const baseOp = p.guardOpacity * GUARD_CONFIG.SHIELD_MAX_OPACITY;
    _guardShield.material.opacity = baseOp + (GUARD_CONFIG.FLASH_OPACITY - baseOp) * flashT;
    _guardShield.material.color.setHex(flashT > 0 ? GUARD_CONFIG.FLASH_COLOR : GUARD_CONFIG.SHIELD_COLOR);
  } else if (p.guardFailFlashTimer > 0) {
    _guardShield.visible = true;
    _guardShield.position.set(p.x, p.y + GUARD_CONFIG.SHIELD_Y_OFFSET, p.z);
    _guardShield.rotation.y = (p.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
    const t = 1 - (p.guardFailFlashTimer / GUARD_CONFIG.FAIL_FLASH_FRAMES);
    _guardShield.material.opacity = GUARD_CONFIG.FAIL_FLASH_OPACITY * Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t);
    _guardShield.material.color.setHex(GUARD_CONFIG.FAIL_FLASH_COLOR);
    p.guardFailFlashTimer--;
    if (p.guardFailFlashTimer <= 0) _guardShield.material.color.setHex(GUARD_CONFIG.SHIELD_COLOR);
  } else {
    _guardShield.visible = false;
  }
}

// ============================================================
//  #section special-system — 必殺技（コマンド技・溜め技）入力検出
// ============================================================
export function readDirInput() {
  const up = _inp('ArrowUp')    || _inp('KeyW');
  const dn = _inp('ArrowDown')  || _inp('KeyS');
  const lf = _inp('ArrowLeft')  || _inp('KeyA');
  const rt = _inp('ArrowRight') || _inp('KeyD');
  let v = 0, h = 0;
  if (up) v -= 1;
  if (dn) v += 1;
  if (lf) h -= 1;
  if (rt) h += 1;
  // 8 方向 + N
  if (v === -1 && h === 0) return 'U';
  if (v === -1 && h === 1) return 'UR';
  if (v === 0  && h === 1) return 'R';
  if (v === 1  && h === 1) return 'DR';
  if (v === 1  && h === 0) return 'D';
  if (v === 1  && h === -1) return 'DL';
  if (v === 0  && h === -1) return 'L';
  if (v === -1 && h === -1) return 'UL';
  return 'N';
}

function updateDirHistory(p) {
  gameFrameCounter++;
  const dir = readDirInput();
  const last = p.dirHistory[p.dirHistory.length - 1];
  if (last && last.dir === dir) {
    // 同方向の連続：frame は entry 作成時のまま保持（更新しない）
    // 旧コードは `last.frame = gameFrameCounter` で更新していたため、長押し中の閉じタップが
    // 毎フレーム fresh 扱いになり、ダッシュ走行中の J/K で SP1 が誤爆していた（2026-05-18 修正）。
    // 連続保持中の entry は古い frame を維持し、DIR_BUFFER_FRAMES を超えたら自然に shift される。
  } else {
    p.dirHistory.push({ dir, frame: gameFrameCounter });
  }
  // 古いエントリの破棄（末尾エントリ＝現在保持中の dir は絶対に消さない）
  // 末尾を消すと、次フレームで last===undefined → 同方向のまま現在 frame で再 push され、
  // 長押し中の dir が周期的に「フレッシュプレス」誤認される暴発バグになる（2026-05-20 修正）。
  const cutoff = gameFrameCounter - SPECIAL_CONFIG.DIR_BUFFER_FRAMES;
  while (p.dirHistory.length > 1 && p.dirHistory[0].frame < cutoff) {
    p.dirHistory.shift();
  }
}

// facing を考慮した方向マッチ：右向き時は L/R をそのまま、左向き時は反転して評価
// 「波動」は前方向（プレイヤーが向いている方向）に成立すれば良い
export function dirMatchesForFacing(actual, expected, facing) {
  if (expected === 'R') return facing >= 0 ? actual === 'R' : actual === 'L';
  if (expected === 'L') return facing >= 0 ? actual === 'L' : actual === 'R';
  if (expected === 'DR') return facing >= 0 ? actual === 'DR' : actual === 'DL';
  if (expected === 'DL') return facing >= 0 ? actual === 'DL' : actual === 'DR';
  if (expected === 'UR') return facing >= 0 ? actual === 'UR' : actual === 'UL';
  if (expected === 'UL') return facing >= 0 ? actual === 'UL' : actual === 'UR';
  return actual === expected;
}

export function updateChargeJ(p) {
  const jHeld = _inp('KeyJ');
  // チャージ可能条件：グラブ/ガード/ULT 中でない。
  // 攻撃中（attacking / hit_confirm）でも蓄積する：J 押しっぱなしで他 SP を撃ったり
  // 通常コンボの最中に裏で sp_03 を溜めるパターンを許可（プレイヤー側の主体的キャンセル繋ぎ）。
  // 空中でも蓄積可：難度高めだが「裏で溜めて空中 sp_03_air に繋ぐ」ルートをプレイヤー裁量で開放。
  // 2026-05-25：knockback / down 中も溜め可能に（吹き飛ばされながら仕切り直しのチャージ）。
  //   dying / dead / respawning は除外。被弾でチャージはリセットされるため「0 から溜め直し」前提。
  const _inRecoverableHitstun = isHitstunState(p)
    && p.state !== STATE.dying
    && p.state !== STATE.dead
    && p.state !== STATE.respawning;
  const canCharge =
    (p.state === STATE.wait01 || p.state === STATE.attacking || p.state === STATE.hit_confirm ||
     PLAYER_JUMP_STATES.has(p.state) || _inRecoverableHitstun)
    && !p.guarding && !p.ultActive
    && p.state !== STATE.grabbing;
  const wasReady = p.chargeReady;
  const wasLevel = p.chargeLevel ?? 0;
  const wasCharging = p.chargeJFrames > 0;
  if (jHeld && canCharge) {
    p.chargeJFrames++;
    p.jHeldDuringCharge = true;
    // 2 段階成立：STAGE2 で level=2（→ sp_03_max）、STAGE1 で level=1（→ sp_03）
    // 将来 OC/チップで stage3+ を追加する場合は閾値配列化を検討。
    if (p.chargeJFrames >= SPECIAL_CONFIG.CHARGE_FRAMES_STAGE2) {
      p.chargeLevel = 2;
      p.chargeReady = true;
    } else if (p.chargeJFrames >= SPECIAL_CONFIG.CHARGE_FRAMES_STAGE1) {
      p.chargeLevel = 1;
      p.chargeReady = true;
    }
  } else if (!jHeld) {
    // J 離した：jHeldDuringCharge を下げ、チャージ未完成なら蓄積も破棄
    // （完成済みは chargeReady=true のまま残し、processSpecialInput 側でリリースを技発動に使う）
    p.jHeldDuringCharge = false;
    if (!p.chargeReady && p.chargeJFrames > 0) {
      p.chargeJFrames = 0;
      p.chargeLevel = 0;
    }
  } else {
    // 押下中だがチャージ条件を満たさない（攻撃中など）→ 蓄積停止だがリセットはしない
  }
  // 収束粒子：チャージ進行中（stage2 未到達まで）毎フレーム放出
  //   level 0（0-30F 充填中）→ 黄色（既定）
  //   level 1（30-60F 充填中・stage2 へ向けて高温化）→ 白
  //   level 2 到達後はスポーン停止（MAX 表現）
  const curLevel = p.chargeLevel ?? 0;
  if (p.chargeJFrames > 0 && curLevel < 2) {
    const partColor = curLevel >= 1 ? 0xffffff : CHARGE_PARTICLE_CONFIG.COLOR;
    for (let i = 0; i < CHARGE_PARTICLE_CONFIG.SPAWN_PER_FRAME; i++) {
      _spawnChargeParticle(p.x, p.y, p.z, partColor);
    }
  }
  // チャージ成立瞬間（level 上昇）：拡散リング合図 + 残った収束粒子はクリア
  // stage1 成立時（0→1）と stage2 成立時（1→2）の両方で発火。色も段階で切替。
  if (curLevel > wasLevel && curLevel >= 1) {
    chargeRingState.frames = CHARGE_RING_CONFIG.FRAMES;
    chargeRingState.x = p.x;
    chargeRingState.y = p.y + CHARGE_RING_CONFIG.Y_OFFSET;
    chargeRingState.z = p.z;
    // リング色：stage2 は白（高温の炎イメージ）、stage1 は従来の黄
    _chargeReadyRing.material.color.setHex(curLevel >= 2 ? 0xffffff : 0xffee44);
    _chargeReadyRing.visible = true;
    _clearChargeParticles();
  }
  // チャージが中断されたら粒子もクリア
  if (wasCharging && p.chargeJFrames === 0 && !p.chargeReady) {
    _clearChargeParticles();
  }
}

function canStartSpecial(p, opts) {
  if (p.guarding) return false;
  if (p.ultActive) return false;
  if (anyPlayerUlting()) return false;
  // 連続用 RC フィニッシュ中の SP は出し切り強制（キャンセル不可）。
  //   `_triggerComboRcFinish` がフラグを立て、SP 完走（state が attacking から抜ける）で自動解除。
  //   トドメの一撃を別 SP で塗り潰さず、演出的決着を保証する。
  if (p._comboRcFinishLockActive) {
    if (p.state === STATE.attacking) return false;  // 進行中 → キャンセル禁止
    p._comboRcFinishLockActive = false;             // 完走済 → ロック解除
  }
  // 空中攻撃ロックアウト中（aerialHop 直後）は空中 SP を封鎖。
  // ただしヒット確認があれば別の空中 SP へキャンセル可（hit→SP→SP 等のコンボ続行を許容）
  if (!p.isGrounded && (p.airAttackLockout ?? 0) > 0 && !p.hitDelivered) return false;
  // 空中 SP 使用回数制限は撤廃（2026-05-20）：
  //   旧 1 回制限 → 他の制限（specialUsedIds 同コンボ 3 回 / specialHitBy 敵単位 3 回 / superFlight 3 回）で
  //   十分にループを断ち切れるため、空中での SP キャンセル連鎖の自由度を優先。
  //   airSpecialUsed フラグも撤去（2026-05-20）。
  // grab 中は OK（cancelGrabIntoAttack 経由で発動）
  if (p.state === STATE.grabbing) return true;
  if (p.state === STATE.wait01) return true;
  if (p.state === STATE.walk_fwd || p.state === STATE.walk_back) return true;
  if (p.state === STATE.hit_confirm) return true;
  // 連続用 RC スライド中も SP 開始可（次スロットの RC を即座に繰り出せるように）
  if (p.state === STATE.combo_rc_slide) return true;
  if (p.state === STATE.attacking) {
    // 攻撃中からの SP キャンセルはヒット確認必須。
    //   ★空中の場合：本攻撃が当たってなくても airHitOccurred（同ジャンプ中の SP ヒット履歴）があれば許可。
    //   これで「SP2 ヒット → SP1 whiff → SP3」のような連鎖を可能にする（2026-05-26）。
    //   地上では従来通り hitDelivered 必須（地上 SP→SP 乱射防止）。
    const _hitOk = p.hitDelivered || (!p.isGrounded && p.airHitOccurred);
    if (!_hitOk) return false;
    // SP→SP キャンセルはヒット成立直後から即受付（2026-05-26 修正）。
    //   旧仕様は hitFrame + hitDuration の遅延を入れていたが、当該 6F 期間に K を押すと kKeyWasDown が
    //   立ったまま窓に届かず死に入力になっていた（SP1 が出ない事象の主因）。
    //   ヒットの直後にキャンセル可能でも、hitstop で視覚的にはほぼ違和感がない。
    return true;
  }
  // ジャンプ系 state は wait01 と同じ受付（演出フック）
  if (PLAYER_JUMP_STATES.has(p.state)) return true;
  return false;
}

// SP2（RC）専用 gate：ほぼ全行動から強制キャンセル発動を許可（2026-05-26）
//   乱戦で攻撃モーション硬直により RC を逃す問題への対処。
//   ULT / メガクラ / 吹き飛び / ダウン / 致命系のみ拒否。軽い被弾（knockback 系）からはリバーサル発動。
const _SP2_RC_BLOCKED_STATES = new Set([
  STATE.down_front_start, STATE.down_front_loop,
  STATE.down_up_start, STATE.down_up_loop,
  STATE.down_rakka_start, STATE.down_rakka_loop, STATE.down_bound_start,
  STATE.down_super_start, STATE.down_super_loop, STATE.down_wall_start,
  STATE.down_roll_start, STATE.down_roll_loop,
  STATE.down_bas_start, STATE.down_bas_loop, STATE.down_bas_end,
  STATE.guard_crash, STATE.dying, STATE.dead, STATE.respawning,
]);
function canStartSP2ForRC(p) {
  if (p.guarding) return false;
  if (p.ultActive) return false;
  if (anyPlayerUlting()) return false;
  if (p.attackId === 'c01_sp_mega01') return false;
  if (_SP2_RC_BLOCKED_STATES.has(p.state)) return false;
  return true;
}

// 必殺技 ID の正規化：地上/空中の派生は同じ base として 1 コンボ 1 回ルールを共有する
//   例: 'c01_sp_01' と 'c01_sp_01_air' は同じ base 'c01_sp_01' として扱う
function specialBaseId(id) {
  // 派生サフィックスを順に剥がす：_air → _NN（チャージ段階）→ 基底 ID
  // 例: c01_sp_04_02_air → c01_sp_04_02 → c01_sp_04
  // burst トリガ（敵単位 1 回制限）は基底 ID で共有させたいので
  // チャージ段階別の sp_04 系も同じ ID にまとめる
  let s = id;
  if (s.endsWith('_air'))   s = s.slice(0, -4);
  if (s.endsWith('_short')) s = s.slice(0, -6);   // 2026-05-26：SP2 短押し版（c01_sp_02_short → c01_sp_02）
  // 段階サフィックス（_NN_NN 末尾の _NN）だけ剥がす：c01_sp_04_01 → c01_sp_04
  //   単独 _NN（c01_sp_01 等）は SP 番号そのものなので保持。
  //   2026-05-26 修正：旧 /_\d{2}$/ は SP 番号まで剥がしてしまい c01_sp_01 → c01_sp になっていた
  //   （全空中 SP が同 baseId 'c01_sp' に潰れ、airUsedSpecialIds で互いをブロックしていた）。
  s = s.replace(/(_\d{2})_\d{2}$/, '$1');
  return s;
}
// 必殺技の短期連発抑止クールダウン（コンボ未確立中のみ適用）
//   コンボ中はクールダウン無視（同 base ID 再ヒットで down_burst 誘発する仕様を保持）
const _SPECIAL_COOLDOWN_FRAMES = 30;   // 0.5 秒。同 ID の連発のみ適用、地上⇄空中の派生切替は無視

function startSpecial(p, id) {
  // 重複検出：specialUsedIds.add する前に判定して flag に保存。
  // 重複ヒットすると敵が down_burst_* に強制遷移（tryHitEnemies が参照）。
  const baseId = specialBaseId(id);
  const _dbg = window.SB?.DEBUG_SPECIAL;
  if (_dbg) {
    const _atk = p.attackId ? ATTACKS[p.attackId] : null;
    const _elapsed = _atk ? (_atk.duration - p.stateTimer) : '-';
    console.log(`[SP TRY] id=${id} base=${baseId} state=${p.state} curAttack=${p.attackId} elapsed=${_elapsed} grounded=${p.isGrounded} hitDel=${p.hitDelivered} airHit=${p.airHitOccurred} airLock=${p.airAutoLockout ?? p.airAttackLockout ?? 0} landingLag=${p.landingLagTimer ?? 0} airUsed=${p.airUsedSpecialIds ? [...p.airUsedSpecialIds].join(',') : 'null'}`);
  }
  // 2 回目の方向タップ → SP コマンド のように、ダッシュ起動と SP 発動が同期する入力では
  // ダッシュが SP 発動より 1〜2F 早く立つ。SP 発動時にはダッシュをクリアして、
  // SP 終了後に方向キー保持で「裏ダッシュが続く」事故を防ぐ（2026-05-18）。
  if (p.dashActive) {
    p.dashActive   = false;
    p.dashDirX     = 0;
    p.dashDirZ     = 0;
    p.dashCooldown = PHYSICS.DASH_COOLDOWN;
    p.lastTapDir   = null;
    p.lastTapTimer = 0;
  }
  // === 短期連発抑止 ===
  // 「同じ id」を _SPECIAL_COOLDOWN_FRAMES 以内に再発動するなら拒否（地上ループ防止）。
  // 「地上 SP2 → 空中 SP2」のような地上⇄空中の派生切替は別 id なので cooldown 無視 → 繋がる
  const _lastFire = p._specialFireFrames?.[baseId] ?? -Infinity;
  const _lastFireId = p._specialFireIds?.[baseId];
  if (_lastFireId === id && getGameFrame() - _lastFire < _SPECIAL_COOLDOWN_FRAMES) {
    if (_dbg) console.log(`  [SP REJECT] cooldown gap=${getGameFrame() - _lastFire} < ${_SPECIAL_COOLDOWN_FRAMES}`);
    return false;
  }
  // === 空中 SP 出戻り禁止 ===
  // 同ジャンプ中に一度使った base ID は着地まで再使用不可（SP2→SP1→SP2 の無限チェーン防止）
  if (!p.isGrounded) {
    if (p.airUsedSpecialIds?.has(baseId)) {
      if (_dbg) console.log(`  [SP REJECT] airUsedSpecialIds has ${baseId}`);
      return false;
    }
  }
  // 重複判定はヒット時に「敵単位」で行うようになったため、ここでは発動可否判定をしない
  // （p.specialUsedIds は debug HUD 表示・将来 UI 用に維持。burst トリガには不使用）
  const wasGrabbing = (p.state === STATE.grabbing);
  if (wasGrabbing) {
    if (!cancelGrabIntoAttack(p, id)) return false;
  } else {
    startAttackById(p, id, -1);
  }
  // ※ 空中必殺技のホップ（空振り含む）は updateAttack の hitFrame タイミングで適用する。
  //    発動瞬間ではなく「攻撃が出る瞬間（パイルバンカー射出など）の反動」として表現するため。
  // 使用済 ID は地上/空中で共有するため base ID で記録（重複時も add は冪等）
  p.specialUsedIds.add(baseId);
  // 空中使用済み ID を記録（同ジャンプ中の出戻り連打を防ぐ）
  if (!p.isGrounded) {
    if (!p.airUsedSpecialIds) p.airUsedSpecialIds = new Set();
    p.airUsedSpecialIds.add(baseId);
  }
  // 短期連発抑止用：base ID ごとに「技終了時刻」を記録（cooldown はそこから開始）
  // → 技 duration が長い必殺技でも、終了してから一定 F 経過しないと再発動できない
  if (!p._specialFireFrames) p._specialFireFrames = {};
  if (!p._specialFireIds) p._specialFireIds = {};
  const _atkDur = ATTACKS[id]?.duration ?? 0;
  p._specialFireFrames[baseId] = getGameFrame() + _atkDur;
  p._specialFireIds[baseId] = id;  // 地上⇄空中クロス判定用：直近の発動 id を記録
  // 必殺技終了直後の振り向き禁止：duration + 40F の間 facing を固定
  // SP2 等は着地余韻まで「キャラが前向きのまま」見せたい（最終ヒット失敗の振り向き混乱対策）
  p._facingLockUntil = getGameFrame() + _atkDur + 40;
  p.specialFlashTimer  = SPECIAL_CONFIG.FLASH_FRAMES;
  // チャージは消費しない：J 押しっぱなしで他 SP を撃った場合に蓄積を保持して
  // 後から J リリースで sp_03 を連結できるようにする。sp_03 自身を J リリース
  // 経路から発動する際はそちら（processSpecialInput 内）で chargeReady/Frames を 0 にする。
  // 方向入力履歴クリア：同じコマンドが連打で再成立しないように
  // （1 コマンド = 1 発動。次に出すには方向を再入力する必要がある）
  p.dirHistory.length = 0;
  if (_dbg) console.log(`  [SP FIRE OK] ${id}`);
  return true;
}

export function processSpecialInput(p) {
  // === 常時更新 ===
  updateDirHistory(p);
  updateChargeJ(p);
  updateSp2Hold(p);

  // J / K エッジ検出（必殺技用：processAttackInput の zKeyWasDown / kKeyWasDown とは独立）
  // コマンドは J/K どちらでも受付可。チャージは J のみ（K は通常強攻撃で即発動するため）
  const jHeld = _inp('KeyJ');
  const jJust = jHeld && !p._jWasDownSpecial;
  const jReleasedEdge = !jHeld && p._jWasDownSpecial;
  p._jWasDownSpecial = jHeld;
  const kHeld = _inp('KeyK');
  const kJust = kHeld && !p._kWasDownSpecial;
  p._kWasDownSpecial = kHeld;

  // === チャージ発動：J リリースエッジ + chargeReady ===
  // リリースは必ず chargeReady を消費する（発動不可でも畳む。さもないと明滅が残り続ける）
  // 重複（specialUsedIds に既出）でも発動は通す → ヒット時に敵側を down_burst_* に強制遷移
  if (jReleasedEdge && p.chargeReady) {
    const fireable = canStartSpecial(p, { forCharge: true });
    const level = p.chargeLevel ?? 1;
    p.chargeReady   = false;
    p.chargeLevel   = 0;
    p.chargeJFrames = 0;
    if (fireable) {
      // N 段階分岐：level 2 で sp_04_02、level 1 で sp_04_01（地上/空中は pickSpecialAttackId で振り分け）
      const baseId = level >= 2 ? 'c01_sp_04_02' : 'c01_sp_04_01';
      startSpecial(p, pickSpecialAttackId(baseId, p.isGrounded));
    }
    return;
  }

  // === gate ===
  // 必殺技 → 別 ID の必殺技キャンセルを許可する設計のため、ここでは ID 一律ブロックしない。
  // 重複（specialUsedIds に既出）でも発動を通す。ヒット時に敵が down_burst_* で離脱する設計。
  if (!canStartSpecial(p)) return;
  // J 押下時のチャージリセット（連打優先）：チャージ未満で J を押し直したらリセット扱い。
  // SP1〜SP3 のタップコマンドは 2026-05-19 で廃止（dir+K へ移行）。SP4 のみ J 長押しチャージで残存。
  if (jJust && !p.chargeReady) {
    p.chargeJFrames = 0;
    p.chargeLevel = 0;
  }
}

// ============================================================
//  強攻撃入力処理（K キー = 必殺技ボタン化・2026-05-19）
//
//  方向 + K で各必殺技にディスパッチ：
//    →K = SP1（波動）
//    ↑K = SP2（対空）
//    ↓K = SP3（急降下踏みつけ）
//    無方向 K = 何も発動しない（誤爆抑止）
//  SP4 のみチャージ J リリース経由で従来通り発動（processSpecialInput）。
//  従来の派生 K（↑K / →K / ↓K）は J 系へ移動（attack-engine.js の processAttackInput）。
// ============================================================
// SP2 押下時のタイミング検証ログ（2026-05-27）。
//   window.SB.DEBUG_SP2_LOG = true で ON。
//   押下瞬間の「敵 _jdPhase / repulseWindow / 距離 / grace 残 F」をスナップショット。
//   何回か押すと、自分が「aim 中で押せている / dive grace 中 / もう dive 進行済 / そもそも aim 入ってない」のどれが多いか可視化できる。
let _sp2LogSeq = 0;
function _logSp2Snapshot(p, attackId) {
  if (typeof window === 'undefined' || !window.SB?.DEBUG_SP2_LOG) return;
  if (!_enemies) return;
  _sp2LogSeq++;
  const frame = getGameFrame();
  // 最寄りの jump_dive 中の敵を 1 体ピック
  let best = null, bestDist = Infinity;
  for (const e of _enemies) {
    if (!e || !e.isAlive || e.dying) continue;
    const atk = e.curAtkId && ENEMY_ATTACKS[e.curAtkId];
    if (!atk || atk.kind !== 'jump_dive') continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < bestDist) { bestDist = d; best = e; }
  }
  const tag = `[SP2 #${_sp2LogSeq}]`;
  if (!best) {
    console.log(`${tag} frame=${frame} attack=${attackId} → 敵 jump_dive 中なし（aim/dive 未起動）`);
    return;
  }
  const phase = best._jdPhase ?? 'null';
  const win   = !!best.repulseWindow;
  const grace = best._jdDiveGrace ?? 0;
  const aimLeft = best._jdAimTimer ?? 0;
  console.log(
    `${tag} frame=${frame} attack=${attackId} | enemy.phase=${phase} repulseWindow=${win} ` +
    `dist=${bestDist.toFixed(0)}wu aimLeft=${aimLeft}F diveGrace=${grace}F` +
    `${win ? '  ✅ RC 受付中' : '  ❌ RC OFF'}`
  );
}

export function processStrongAttackInput(p) {
  const kPressed = _inp('KeyK');
  const justPressed = kPressed && !kKeyWasDown;
  kKeyWasDown = kPressed;
  if (p.guarding || p.ultActive) return;
  if (p.state === STATE.grabbing) return;
  if (!justPressed) return;
  if (window.SB?.DEBUG_SPECIAL) {
    const upH = _inp('ArrowUp') || _inp('KeyW');
    const dnH = _inp('ArrowDown') || _inp('KeyS');
    console.log(`[K PRESS] up=${upH} dn=${dnH} state=${p.state} curAttack=${p.attackId}`);
  }
  // SP2（RC）は canStartSP2ForRC で後処理。SP1/SP3 は後述の canStartSpecial チェックで制限。

  const upHeld  = _inp('ArrowUp')    || _inp('KeyW');
  const dnHeld  = _inp('ArrowDown')  || _inp('KeyS');

  // 命名規則 §9.0：↑K=SP2 / ↓K=SP3 / それ以外（中立 K / ←/→ + K）= SP1（波動）
  // 中立 K もデフォルトで SP1 を発射するので、無方向でも何か出る = 入口を下げた設計。
  // SP2：押下即発動（2026-05-26・ホールド分岐は一旦廃止 / 押した瞬間出るシンプル版に絞る）
  //   - 地上：c01_sp_02_short（大昇り単発・粉塵昇竜の自機上昇感を残した形態）
  //   - 空中：c01_sp_02_air（控えめ単発・コンボ降下しない調整）
  //   - 旧 ホールド分岐コード（updateSp2Hold / SP2_HOLD_FRAMES）は実装は残置・本入口だけ即発に戻す
  //   - c01_sp_02（粉塵昇竜・多段）は OC / 強化版として将来再利用予定（定義は attacks.js に残置）
  // SP2 だけは canStartSP2ForRC で「ほぼ全行動からキャンセル可」（2026-05-26）。
  //   乱戦で攻撃硬直により RC を逃す問題への対処。被弾中（軽 knockback）はメガクラ同様にリバーサル発動。
  if (upHeld) {
    if (!canStartSP2ForRC(p)) return;
    if (isHitstunState(p)) _cancelHitstunForReversal(p);
    const id = p.isGrounded ? 'c01_sp_02_short' : 'c01_sp_02_air';
    _logSp2Snapshot(p, id);  // タイミング検証ログ（window.SB.DEBUG_SP2_LOG で ON/OFF）
    const _attackIdBefore = p.attackId;
    const _stateBefore    = p.state;
    const _spBefore       = p.sp;
    const _fired = startSpecial(p, id);
    if (typeof window !== 'undefined' && window.SB?.DEBUG_SP2_LOG) {
      const fired = p.attackId === id && p.attackId !== _attackIdBefore;
      if (!fired) {
        console.log(`  [SP2 START FAIL] reason check: state(before)=${_stateBefore} attackId(before)=${_attackIdBefore} attackId(after)=${p.attackId} sp=${_spBefore.toFixed(1)}`);
      } else {
        console.log(`  [SP2 START OK] attackId=${p.attackId} stateTimer=${p.stateTimer} sp=${p.sp.toFixed(1)}`);
      }
    }
    // SP2 が airUsedSpecialIds 等で発動失敗した場合は SP1 へフォールスルー（2026-05-26）。
    //   理由：↑を押しっぱなしのまま K で SP1 を狙ったとき、SP2 試行→ブロック→不発で固まる事象の救済。
    if (_fired) return;
    if (window.SB?.DEBUG_SPECIAL) console.log(`  [SP2 fallthrough → SP1]`);
  }

  // SP1/SP3 は従来通り canStartSpecial で受付（SP2 のみ強制キャンセル特権）
  if (!canStartSpecial(p)) return;

  let baseId;
  if (dnHeld) baseId = 'c01_sp_03';
  else        baseId = window.SB?.OC_FLAGS?.ignite ? 'c01_sp_01_ignite' : 'c01_sp_01';

  startSpecial(p, pickSpecialAttackId(baseId, p.isGrounded));
}

// ============================================================
//  SP2 ホールド分岐（2026-05-26）
//  - processStrongAttackInput が ↑+K 押下時に p.sp2Holding を立てる
//  - 本関数は毎フレーム呼ばれ、K 継続/リリース/最大 F を見て発動を確定する
//  - 短押し（< SP2_HOLD_FRAMES） → c01_sp_02_air（単発・弱形態）
//  - 長押し（≥ SP2_HOLD_FRAMES）→ 地上 c01_sp_02（粉塵昇竜）/ 空中 c01_sp_02_air
//  - 最大 F（SP2_HOLD_FRAMES_MAX）到達でリリース待たず強制発動（昇竜）
//  - state 異常（grab/ult 等）に陥った場合はキャンセル
// ============================================================
export function updateSp2Hold(p) {
  // 2026-05-26：SP2 を押下即発動に戻したためホールド処理は無効化。
  // 旧 sp2Holding が立ったままの個体があれば畳むだけ。
  if (p.sp2Holding) { p.sp2Holding = false; p.sp2HoldFrames = 0; }
  return;
  // ↓ 旧ホールド分岐ロジック（将来復活する場合のため残置）
  // eslint-disable-next-line no-unreachable
  if (!p.sp2Holding) return;
  const kHeld = _inp('KeyK');
  // チャージ中に発動不能 state に陥ったらキャンセル（破棄）
  if (p.guarding || p.ultActive || p.state === STATE.grabbing) {
    p.sp2Holding    = false;
    p.sp2HoldFrames = 0;
    return;
  }
  p.sp2HoldFrames++;
  const maxReached = p.sp2HoldFrames >= SPECIAL_CONFIG.SP2_HOLD_FRAMES_MAX;
  // K リリース or 最大 F 到達で発動確定
  if (!kHeld || maxReached) {
    // 長押し粉塵昇竜は一旦無効化（2026-05-26・RC 検証中の混線を避けるため）。
    // SP_HOLD_FRAMES 経過しても常に短押し形態（単発アッパー）が出る。
    // 復活時は `useStrong = p.sp2HoldFrames >= SPECIAL_CONFIG.SP2_HOLD_FRAMES` に戻す。
    const useStrong = false;
    p.sp2Holding    = false;
    p.sp2HoldFrames = 0;
    if (!canStartSpecial(p)) return;
    let id;
    if (useStrong) {
      // 長押し（封印中）：地上 c01_sp_02（粉塵昇竜）/ 空中 c01_sp_02_air
      id = pickSpecialAttackId('c01_sp_02', p.isGrounded);
    } else {
      // 短押し：地上 c01_sp_02_short（大昇り単発）/ 空中 c01_sp_02_air（控えめ単発）
      id = p.isGrounded ? 'c01_sp_02_short' : 'c01_sp_02_air';
    }
    startSpecial(p, id);
  }
}

// p.usedDerivativesThisCombo をクリア（コンボリセット時に呼ばれる・派生 J 封じ解除）
export function clearUsedDerivatives(p) {
  if (p.usedDerivativesThisCombo) p.usedDerivativesThisCombo.clear();
}

// ============================================================
//  コンボホーミング（最初に殴った敵への自動接近）
//  - bumpCombo の初回ヒットで p.comboTarget がセットされる
//  - 反対方向入力 0.3 秒（連打 or 持続）で解除
//  - 距離が遠すぎる / target が無敵化 / 不在 でも自動解除
//  - 攻撃 windup 中だけ自動接近を作用させる（待機・歩行・ダッシュは触らない）
// ============================================================
export function updateComboHoming(p) {
  if (!p.comboTarget) return;
  // 攻撃側に requireLockForHoming があり、攻撃開始時にロックが無かった場合はホーミング全停止。
  // sp_03 地上版：ノーロック発動時は「コツが必要」な技として位置取りで当てる設計（2026-05-16）。
  const _curAtkForHoming = p.attackId ? ATTACKS[p.attackId] : null;
  if (_curAtkForHoming?.requireLockForHoming && !p._homingPreLocked) return;
  const t = p.comboTarget;
  // === ロック解除条件 ===
  // 1) 対象が死亡・グラブ被害中・きりもみ離脱中・ゴアクリ armed 中（追撃させない）
  if (!t.isAlive || t.state === STATE.grabbed
      || t.state === STATE.down_burst_start || t.state === STATE.down_burst_loop
      || (t.goreCritical && t.goreCritical.armed)) {
    p.comboTarget = null;
    p.oppositeInputFrames = 0;
    return;
  }
  // 2) 距離超過：X 単独 → 合算 の順でチェック
  //    X はベルスクの「横にスクロールして離れる」方向なので主軸として厳しめ
  //    Z は 2.5D 圧縮軸なので別管理（強めの追従）・合算は最終フェイルセーフ
  const dx = t.x - p.x;
  const dz = t.z - p.z;
  // mega コンボ猶予中は距離判定を緩める（mega knockback で target が押されても lock 維持）
  const _megaGrace = isMegaComboGrace();
  const _maxX  = _megaGrace ? HOMING_CONFIG.MAX_DISTANCE_X * 2 : HOMING_CONFIG.MAX_DISTANCE_X;
  const _maxXZ = _megaGrace ? HOMING_CONFIG.MAX_DISTANCE   * 2 : HOMING_CONFIG.MAX_DISTANCE;
  if (Math.abs(dx) > _maxX) {
    p.comboTarget = null;
    p.oppositeInputFrames = 0;
    return;
  }
  const distXZ = Math.hypot(dx, dz);
  if (distXZ > _maxXZ) {
    p.comboTarget = null;
    p.oppositeInputFrames = 0;
    return;
  }
  // 3) 反対方向入力の累積（持続 or 連打どちらでも累積。離している間は減衰）
  const targetDirX = Math.sign(dx) || p.facing;
  const inL = _inp('ArrowLeft')  || _inp('KeyA');
  const inR = _inp('ArrowRight') || _inp('KeyD');
  const inputDir = inL ? -1 : (inR ? 1 : 0);
  if (inputDir !== 0 && inputDir === -targetDirX) {
    p.oppositeInputFrames += 1;
  } else {
    p.oppositeInputFrames = Math.max(0, p.oppositeInputFrames - HOMING_CONFIG.OPPOSITE_DECAY);
  }
  // mega コンボ猶予中は反対入力での解除も無効化（追撃方向転換で誤解除しない）
  if (!_megaGrace && p.oppositeInputFrames >= HOMING_CONFIG.BREAK_INPUT_FRAMES) {
    p.comboTarget = null;
    p.oppositeInputFrames = 0;
    return;
  }
  // === 攻撃 windup 中の自動接近 ===
  // hitFrame に到達するまで（= 当たる前まで）に target の圏内に入るよう補間
  // hit_confirm 中・hitDuration 中は補正しない
  if (p.state !== STATE.attacking || !p.attackId) return;
  const atk = ATTACKS[p.attackId];
  if (!atk) return;
  const elapsed = atk.duration - p.stateTimer;
  if (elapsed >= atk.hitFrame) return;
  // === 「吹き飛び中の敵 × 前方向入力なし」では自動接近を抑止 ===
  //   敵がコンボ的に逃げていく状態（down_front_* / down_super_* / down_wall_* / down_roll_* / down_rakka_* / down_bound_*）で、
  //   プレイヤーが明示的に前方向を押していないなら、追わない（吸い込まれ感の軽減）
  //   ※ wait01・knockback01/02・down_up_*（打ち上げ juggle）は引き続き追跡する
  const _isFlungState = (
    t.state === STATE.down_front_start  || t.state === STATE.down_front_loop  ||
    t.state === STATE.down_super_start   || t.state === STATE.down_super_loop   ||
    t.state === STATE.down_wall_start   || t.state === STATE.down_wall_loop   ||
    t.state === STATE.down_roll_start   || t.state === STATE.down_roll_loop   ||
    t.state === STATE.down_rakka_start  || t.state === STATE.down_rakka_loop  ||
    t.state === STATE.down_bound_start
  );
  const _forwardInput = (inputDir !== 0 && inputDir === targetDirX);
  if (_isFlungState && !_forwardInput) {
    return; // 自動接近をスキップ（ロック自体は維持・前入力で復活）
  }
  // facing 自動反転：FACING_FLIP_DIST より遠い時のみ強制反転（近距離は維持）
  // 必殺技中は facing 固定（SP2 等で敵が後ろにいると反転して最終ヒットが当たらない）
  const _curAtkFacing = p.attackId ? ATTACKS[p.attackId] : null;
  if (!_curAtkFacing?.isSpecial && Math.abs(dx) > HOMING_CONFIG.FACING_FLIP_DIST) {
    p.facing = targetDirX;
  }
  // 距離スケーリング：近い時 100%・FALLOFF_FAR で FALLOFF_FAR_RATIO まで線形減衰
  const falloff = (() => {
    if (distXZ <= HOMING_CONFIG.FALLOFF_NEAR) return 1.0;
    if (distXZ >= HOMING_CONFIG.FALLOFF_FAR)  return HOMING_CONFIG.FALLOFF_FAR_RATIO;
    const t01 = (distXZ - HOMING_CONFIG.FALLOFF_NEAR)
              / (HOMING_CONFIG.FALLOFF_FAR - HOMING_CONFIG.FALLOFF_NEAR);
    return 1.0 + (HOMING_CONFIG.FALLOFF_FAR_RATIO - 1.0) * t01;
  })();
  // 個別倍率：攻撃側に homingLerpMult が指定されていれば各軸 LERP に乗算
  //   既定 1.0（既存挙動維持）。空中 J 系などホーミングを弱めたい技で 0.6 等を設定。
  //   ただし対象敵が空中なら mult は無効化（juggle 中は他攻撃と同等の追従が必要・2026-05-15）。
  const _targetAirborne = t.y > ENEMY_AIRBORNE_Y_THRESHOLD;
  let homingMult = _targetAirborne ? 1.0 : (atk.homingLerpMult ?? 1.0);
  // メガクラ・スロー中はターゲットへのホーミングを 2x に強化（追撃繋ぎ補助・2026-05-16）
  //   ヒット後の "間" にプレイヤーを敵まで強く引き寄せて、コンボ継続をしやすくする。
  if (isMegaSlowActive()) homingMult *= 2.0;
  // X 補正：圏内デッドゾーン外なら寄せる
  const rangeX = atk.rangeX ?? 120;
  const desiredX = t.x - targetDirX * (rangeX * HOMING_CONFIG.AIM_OFFSET_X_RATIO);
  const gapX = desiredX - p.x;
  const deadX = rangeX * HOMING_CONFIG.AIM_OFFSET_X_RATIO + HOMING_CONFIG.DEADZONE_X_MARGIN;
  if (Math.abs(t.x - p.x) > deadX) {
    p.x += gapX * HOMING_CONFIG.WINDUP_LERP_X * falloff * homingMult;
  }
  // Z 補正：強めに寄せる（2.5D 圧縮軸の救済）。デッドゾーンは狭く
  if (Math.abs(dz) > HOMING_CONFIG.DEADZONE_Z_MARGIN) {
    p.z += dz * HOMING_CONFIG.WINDUP_LERP_Z * falloff * homingMult;
  }
  // Y 補正：空中時のみ（コンボ繋がりやすさ優先・据置）
  // 攻撃側に noHomingY が立っていれば Y 補正をスキップ（sp_03 等の dive 系で Y を固定したい技用）
  if (!p.isGrounded && !atk.noHomingY) {
    const desiredY = t.y + HOMING_CONFIG.AIM_Y_OFFSET;
    const gapY = desiredY - p.y;
    if (Math.abs(gapY) > HOMING_CONFIG.DEADZONE_Y_MARGIN) {
      p.y += gapY * HOMING_CONFIG.WINDUP_LERP_Y * falloff * homingMult;
    }
  }
}

// ============================================================
//  パーツアニメーション（Step E-4b で分離）
//  攻撃の意思を四肢の動きで表現：PART_ANIMS データテーブル駆動
// ============================================================
function updatePartAnims(p) {
  const parts = p.mesh.userData.parts;
  if (!parts) return;
  const LERP_SPD = 0.30;

  const inAttack = (p.state === STATE.attacking || p.state === STATE.hit_confirm) && p.attackId;
  const atk      = inAttack ? ATTACKS[p.attackId] : null;
  const animKey  = atk?.partsAnim;
  const animDef  = animKey ? _PART_ANIMS[animKey] : null;
  const elapsed  = atk ? (atk.duration - p.stateTimer) : 0;
  // 多段ヒット技は窓全体でアタックポーズを保持する（hitDuration だけで切らない）
  // [TEST 2026-05-15] アニメ開始を技開始時（elapsed >= 0）に前倒し。
  // 旧：`elapsed >= atk.hitFrame` で hitFrame 到達後に lerp 開始 → 判定発生から
  // 視覚的に手が出きるまで 5-7F ズレてタイミング視認性が悪かった。
  // 今：技開始から目標位置へ lerp 開始 → hitFrame の頃には手がほぼ目標到達。
  const inHit    = atk && elapsed >= 0 && elapsed < getHitWindowEnd(atk) + 2;

  for (const [name, rest] of Object.entries(_PART_REST)) {
    const part = parts[name];
    if (!part) continue;
    const delta = (inHit && animDef) ? animDef[name] : null;
    const tx = rest.x + (delta?.x ?? 0);
    const ty = rest.y + (delta?.y ?? 0);
    const tz = rest.z + (delta?.z ?? 0);
    part.position.x += (tx - part.position.x) * LERP_SPD;
    part.position.y += (ty - part.position.y) * LERP_SPD;
    part.position.z += (tz - part.position.z) * LERP_SPD;
  }
}

// ============================================================
//  #section update-player — updatePlayer（毎フレームのプレイヤー処理本体）
//  入力 → 移動 → ステート遷移 → メッシュ反映 まで一気通貫
//  Step E-4b で player-system.js に分離
// ============================================================
export function updatePlayer(p) {
  // フェイタル小爆発フェーズ：プレイヤーを完全固定（入力・移動・攻撃すべて遮断）
  //   ボスの「終了」を明示するため、爆発演出中はキャラ操作を奪う。
  //   big_explode 突入で window.SB._fatalPlayerFreeze=false に戻る → 通常フローへ復帰。
  if (typeof window !== 'undefined' && window.SB?._fatalPlayerFreeze) {
    return;
  }
  // 受け身用：ジャンプキーの押下エッジを毎フレーム検出（被弾中の受け身入力に使う）
  const _spaceDown = _inp('Space');
  const _ukemiJumpEdge = _spaceDown && !p._ukemiJumpPrev;
  p._ukemiJumpPrev = _spaceDown;

  // === 掴み発動 readiness フラグ ===
  // 仕様：「wait01 中に自分の意思で移動した」状態でのみ tryGrabActivate を許可。
  // wait01 以外（hitstun / attacking / grabbing 等）に入った瞬間に false へリセット。
  // 物理移動セクション後（mvx/mvz 確定後）に「実際に動いていた」なら true に立てる。
  // → 被弾のけぞり後・攻撃終了後にユーザーが新規に移動を入力するまで掴めない。
  if (p.state !== STATE.wait01 && p.state !== STATE.walk_fwd && p.state !== STATE.walk_back) p._grabReady = false;

  // === 被弾中：入力一切受け付けず、hitstun の自動進行のみ走らせて return ===
  if (isHitstunState(p)) {
    // 被弾でノックバック → 敵に密着した状態で wait01 復帰したとき、移動キー押しっぱなしで
    // 近接グラブが暴発するのを防ぐ。被弾後は移動キーを一度離すまでグラブを再アームしない。
    p._grabHitLock = true;
    const canReverse = (p.state !== STATE.dying && p.state !== STATE.dead && p.state !== STATE.guard_crash);
    if (canReverse) _processMegaCrashUltInput(p);
    // 連続用 RC スライド中は通常 SP 入力も受け付ける（次スロット RC のため即時 SP 発動を許可）。
    //   SP が発動すれば state は attacking に切り替わり、kbVx スライドは SP 移動に上書きされる。
    if (p.state === STATE.combo_rc_slide) {
      processSpecialInput(p);
      // SP 発動で state が変わった場合は通常 updatePlayer フローに任せて return（hitstun 後処理は不要）
      if (p.state !== STATE.combo_rc_slide) {
        return;
      }
    }
    // 2026-05-25：knockback/down 中も J 長押しチャージを蓄積させる（仕切り直し溜め）。
    // dying/dead/guard_crash は除外（canReverse と同条件）。
    // リリースエッジ検出は processSpecialInput に任せる（hitstun 脱出後の最初フレームで発火）。
    if (canReverse) updateChargeJ(p);
    // 受け身入力：被弾中の最初のジャンプ押下だけをバッファ投入に使う（1被弾1回）。
    //   連打でバッファを再充填し続けると受け身が確定してしまうため、ukemiAttempted で締める。
    //   早すぎる1回目はバッファが切れて不成立 → 連打は自滅。＝タイミングを読む技。
    if (_ukemiJumpEdge && !p.ukemiAttempted) {
      p.ukemiBuffer = UKEMI_CONFIG.BUFFER_FRAMES;
      p.ukemiAttempted = true;
    }
    updatePlayerHitstun(p);
    updateCrisisEffect(p);
    // 被弾で kbVx により壁外まで吹き飛ぶのを防ぐ：通常 update と同じ壁クランプを適用。
    // ここを忘れると着地時に通常 update のクランプが走って「壁向こう→ワープで戻る」現象になる。
    const wallL = getActiveWallX('left');
    const wallR = getActiveWallX('right');
    p.x = Math.max(Math.max(PHYSICS.STAGE_LEFT, wallL), Math.min(Math.min(PHYSICS.STAGE_RIGHT, wallR), p.x));
    // lv6 転がり中は updatePlayerHitstun が腰ピボット補正込みで mesh.x を設定済 → 上書きしない。
    if (p.mesh && p.state !== STATE.down_roll_start && p.state !== STATE.down_roll_loop) {
      p.mesh.position.x = p.x;
    }
    // 被弾中はブースター演出を消す。updatePlayer 本体（thruster 可視制御）を return で
    //   スキップするため、ジャンプ中に被弾するとバーニアが点いたまま固まる不具合の対策。
    // thrustFramesLeft も 0 に：残ったままだと復帰直後 1F だけ thrustingNow が再点灯する。
    p.thrustFramesLeft = 0;
    const _hsParts = p.mesh && p.mesh.userData.parts;
    if (_hsParts) {
      _hsParts.thrusterL.visible = false;
      _hsParts.thrusterR.visible = false;
      _hsParts.yawL.visible = false;
      _hsParts.yawR.visible = false;
    }
    // 必殺技中などに被弾した場合、攻撃ポーズ・攻撃エフェクトが固まって残るのを防ぐ。
    //   updatePlayer 本体（パーツ姿勢・必殺技ヒットボックス・本体発光）を return でスキップするため、
    //   ここで明示的に rest 姿勢へ戻し、攻撃エフェクトを消す（attackId は被弾で既に null）。
    updatePartAnims(p);
    if (_specialHitboxMesh) _specialHitboxMesh.visible = false;
    if (p._bodyEmissiveWasOn) {
      _applyBodyEmissive(p.mesh, 0, 0, 0);
      p._bodyEmissiveWasOn = false;
    }
    // ガードシールド：hitstun 中も syncGuardShield を呼ぶことで
    // クラッシュアニメの進行・ドーム残留の両方を解消する。
    syncGuardShield(p);
    return;
  }
  if (p.invincibleFrames > 0) p.invincibleFrames--;

  // ============================================================
  // 攻撃連発ロック群（2026-05-26 整理）
  //   ① airAttackLockout（postAirLockout 由来・空中限定）
  //      - aerialHop 発火時に SP の postAirLockout 値で起動
  //      - canStartSpecial で `!p.hitDelivered` の時のみブロック → 命中時は素通り
  //      - 着地でクリア
  //   ② landingLag（空中技後の地上硬直）
  //      - 着地時に SP の landingLag 値で起動
  //      - ★命中時はスキップ：hitDelivered=true の場合 set されない（攻めの継続を優先）
  //      - 空振り着地時のみ攻撃/SP/ダッシュ入力を一定 F 封鎖（メガクラ/ULT/移動/ガードは許可）
  //   ③ airUsedSpecialIds（空中 SP 出戻り禁止）
  //      - 同 base ID は着地まで再使用不可
  //      - 異なる SP への乗換は自由（SP2→SP1→SP3 は OK / SP2→SP1→SP2 は NG）
  //   ④ _specialFireFrames（同 ID 30F 連発抑止）
  //      - 全 SP 共通の最小クールダウン
  // ============================================================

  // === 空中攻撃ロックアウト（aerialHop 後の連打防止）===
  if (p.airAttackLockout > 0) {
    if (p.isGrounded) p.airAttackLockout = 0;  // 着地でリセット
    else p.airAttackLockout--;
  }

  // === 着地硬直（landingLag）：空中技空振り着地後の攻撃/SP/ダッシュ入力封鎖（移動は許可）===
  //   2026-05-26 修正：旧実装は return で updatePlayer 全体を打ち切っていたため歩行も止まっていた。
  //   2026-05-26 修正：hitDelivered の場合は set されないため、命中時はそもそも _landingLagged にならない。
  //   2026-05-26 修正：地上時のみ判定（ジャンプで離陸したら即解除・タイマーもジャンプ時にクリア）。
  if ((p.landingLagTimer ?? 0) > 0) p.landingLagTimer--;
  const _landingLagged = (p.landingLagTimer ?? 0) > 0 && p.isGrounded;

  // === SP 自然回復 ===
  p.sp = Math.min(SP_CONFIG.MAX, p.sp + SP_CONFIG.REGEN_RATE);
  if (p.dashCooldown > 0) p.dashCooldown--;

  // === ガード入力（最優先・他入力をブロック）===
  processGuardInput(p);

  // === グラブ自動発動／中の入力 ===
  if (p.state === STATE.grabbing) {
    processGrabInput(p);
  } else {
    tryGrabActivate(p);
  }

  // === 攻撃入力処理（毎フレーム）===
  // メガクラ／ULT は緊急回避手段なので landingLag 中も通す（防御選択肢の確保）。
  _processMegaCrashUltInput(p);
  // 通常攻撃・SP は landingLag 中スキップ（攻撃ロックアウトの本来の目的）。
  // 受け身ジャンプ上昇中（ukemiInvuln）は攻撃を封印：受け身でテンポを上げすぎない（2026-05-20）。
  if (!_landingLagged && !p.ukemiInvuln) {
    processSpecialInput(p);
    processAttackInput(p);
    processStrongAttackInput(p);
  }

  if (p.specialFlashTimer > 0) p.specialFlashTimer--;
  if (p.ukemiFlashTimer > 0) p.ukemiFlashTimer--;
  if (!_landingLagged && !p.guarding && !p.ultActive && p.state !== STATE.grabbing) processDashInput(p);

  tryCancelJump(p);
  updateComboHoming(p);

  // === ステート更新 ===
  updateAttack(p);
  updateHitConfirm(p);
  consumeAttackBuffer(p);

  const movementLocked = ((p.state === STATE.attacking) || (p.state === STATE.grabbing)) && p.isGrounded;

  let mvx = 0, mvz = 0;
  const curAtk = p.attackId ? ATTACKS[p.attackId] : null;
  const isStepAttack = (p.state === STATE.attacking) && p.isGrounded && !!curAtk?.isStepAttack;
  const isDashing = p.dashActive && !isStepAttack;

  if (!p.isGrounded) {
    let ix = 0, iz = 0;
    if (_inp('ArrowLeft')  || _inp('KeyA')) ix -= 1;
    if (_inp('ArrowRight') || _inp('KeyD')) ix += 1;
    if (_inp('ArrowUp')    || _inp('KeyW')) iz -= 1;
    if (_inp('ArrowDown')  || _inp('KeyS')) iz += 1;
    const ilen = Math.hypot(ix, iz);
    if (ilen > 0) { ix /= ilen; iz /= ilen; }

    if (p.homingFrames > 0 && p.homingTarget) {
      const tgt = p.homingTarget;
      const sideOffset = (p.x <= tgt.x) ? -80 : 80;
      const dx = (tgt.x + sideOffset) - p.x;
      const dz = tgt.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 1) {
        const spd = Math.min(dist * 0.25, 12);
        p.airVx += ((dx / dist) * spd - p.airVx) * 0.35;
        p.airVz += ((dz / dist) * spd - p.airVz) * 0.35;
      }
      // 必殺技中はホーミングで facing 反転しない（後ろの敵を捕捉して向きが変わるのを防止）
      if (!curAtk?.isSpecial) {
        const faceDx = tgt.x - p.x;
        if (Math.abs(faceDx) > 5) p.facing = faceDx > 0 ? 1 : -1;
      }
      p.homingFrames--;
    } else if (curAtk?.isSpecial) {
      // 必殺技中（SP2 の離地後など）：方向入力による修正なし、慣性維持（AIR_FRICTION 減衰のみ）
      p.airVx *= PHYSICS.AIR_FRICTION;
      p.airVz *= PHYSICS.AIR_FRICTION;
    } else if (p.airWasDash) {
      p.airVx = p.airVx * PHYSICS.AIR_FRICTION + ix * PHYSICS.AIR_CONTROL;
      p.airVz = p.airVz * PHYSICS.AIR_FRICTION + iz * PHYSICS.AIR_CONTROL;
    } else {
      const tVx = ix * PHYSICS.SPEED;
      const tVz = iz * PHYSICS.SPEED;
      p.airVx += (tVx - p.airVx) * PHYSICS.GROUND_ACCEL;
      p.airVz += (tVz - p.airVz) * PHYSICS.GROUND_ACCEL;
    }
    p.x += p.airVx;
    p.z += p.airVz * PHYSICS.Z_SPEED_MULT;
    // ターゲット追い越し抑止：攻撃側に targetOvershootGuard が立っていて comboTarget があれば、
    // facing 方向に対して敵の手前（margin）で X を止める（sp_03 leap+dive で 3 キャラ分が
    // ターゲット越えになるのを防ぐ・2026-05-16）。
    // ただし requireLockForHoming 技で攻撃開始時にロック無しだった場合は、初ヒット時に
    // bumpCombo で target が後付け設定されても X 補正しない（ノーロック特性を維持）。
    const _ovsGuardActive = curAtk?.targetOvershootGuard && p.comboTarget &&
      (!curAtk.requireLockForHoming || p._homingPreLocked);
    if (_ovsGuardActive) {
      const tgt = p.comboTarget;
      const margin = 50;
      if (p.facing > 0 && p.x > tgt.x - margin) {
        p.x = tgt.x - margin;
        p.airVx = 0;
      } else if (p.facing < 0 && p.x < tgt.x + margin) {
        p.x = tgt.x + margin;
        p.airVx = 0;
      }
    }
    mvx = p.airVx;
    mvz = p.airVz;
  } else if (isStepAttack) {
    p.stepMomentum = (p.stepMomentum ?? 0) * (curAtk.momentumDecay ?? 0.95);
    if (p.stepMomentum > 0.05) {
      mvx = p.dashDirX;
      mvz = p.dashDirZ;
      // 潜り込み貫通防止：ヒット後（hitDelivered）に敵 X 距離 50wu 以内に近づいたら前進停止。
      // ヒット前は無制限（攻撃が敵に届くまで滑り込む必要があるため）
      let blockedByEnemy = false;
      if (p.hitDelivered && _enemies) {
        for (const e of _enemies) {
          if (!e.isAlive) continue;
          if (Math.abs(e.z - p.z) > 100) continue;
          const dx = e.x - p.x;
          if (Math.sign(dx) === Math.sign(mvx) && Math.abs(dx) < 50) {
            blockedByEnemy = true;
            break;
          }
        }
      }
      if (blockedByEnemy) {
        p.stepMomentum = 0;
      } else {
        p.x += mvx * PHYSICS.SPEED * p.stepMomentum;
        p.z += mvz * PHYSICS.SPEED * p.stepMomentum * PHYSICS.Z_SPEED_MULT;
      }
    }
  } else if (movementLocked && (p.lungeMomentum ?? 0) > 0.1) {
    const decay = curAtk?.lungeDecay ?? 0.85;
    // 敵密着で前進停止：facing 方向 + Z 近接 + X 距離 70wu 以内に生存敵がいたら lungeMomentum=0
    // （ヒット時の停止は attack-engine 側、こちらは「ヒットしない技で貫通」を防ぐ保険）
    let blockedByEnemy = false;
    if (_enemies) {
      for (const e of _enemies) {
        if (!e.isAlive) continue;
        if (Math.abs(e.z - p.z) > 100) continue;
        const dx = e.x - p.x;
        if (Math.sign(dx) === p.facing && Math.abs(dx) < 70) {
          blockedByEnemy = true;
          break;
        }
      }
    }
    if (blockedByEnemy) {
      p.lungeMomentum = 0;
    } else {
      p.x += p.facing * p.lungeMomentum;
      mvx = p.facing;
      p.lungeMomentum *= decay;
    }
    // targetOvershootGuard：lunge 突進中も comboTarget の手前 50wu で X クランプ
    // （SP1 等で「ターゲットを通過しない」要件を満たす・2026-05-18）
    if (curAtk?.targetOvershootGuard && p.comboTarget &&
        (!curAtk.requireLockForHoming || p._homingPreLocked)) {
      const tgt = p.comboTarget;
      const margin = 50;
      if (p.facing > 0 && p.x > tgt.x - margin) {
        p.x = tgt.x - margin;
        p.lungeMomentum = 0;
      } else if (p.facing < 0 && p.x < tgt.x + margin) {
        p.x = tgt.x + margin;
        p.lungeMomentum = 0;
      }
    }
  } else if (isDashing) {
    let dvx = 0, dvz = 0;
    if (_inp('ArrowLeft')  || _inp('KeyA')) dvx -= 1;
    if (_inp('ArrowRight') || _inp('KeyD')) dvx += 1;
    if (_inp('ArrowUp')    || _inp('KeyW')) dvz -= 1;
    if (_inp('ArrowDown')  || _inp('KeyS')) dvz += 1;
    const anyKey = dvx !== 0 || dvz !== 0;

    if (!anyKey || movementLocked) {
      p.dashActive   = false;
      p.dashCooldown = PHYSICS.DASH_COOLDOWN;
    } else {
      const dvlen = Math.hypot(dvx, dvz);
      if (dvlen > 0) { dvx /= dvlen; dvz /= dvlen; }
      const prevAngle = Math.atan2(p.dashDirZ, p.dashDirX);
      const currAngle = Math.atan2(dvz, dvx);
      let angleDiff = Math.abs(currAngle - prevAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      if (angleDiff > PHYSICS.DASH_SPARK_ANGLE && p.isGrounded) {
        spawnHitParticles(p.x, p.y + 5, p.z, p.dashSparkColor, 10);
      }
      p.dashDirX = dvx;
      p.dashDirZ = dvz;
      mvx = dvx;
      mvz = dvz;
      p.x += mvx * PHYSICS.SPEED * PHYSICS.DASH_SPEED_MULT;
      p.z += mvz * PHYSICS.SPEED * PHYSICS.DASH_SPEED_MULT * PHYSICS.Z_SPEED_MULT;
    }
  } else if (!movementLocked) {
    if (_inp('ArrowLeft')  || _inp('KeyA')) mvx -= 1;
    if (_inp('ArrowRight') || _inp('KeyD')) mvx += 1;
    if (_inp('ArrowUp')    || _inp('KeyW')) mvz -= 1;
    if (_inp('ArrowDown')  || _inp('KeyS')) mvz += 1;
    const rawLen = Math.hypot(mvx, mvz);
    if (rawLen > 0) { mvx /= rawLen; mvz /= rawLen; }
    const speedMult = p.guarding ? GUARD_CONFIG.MOVE_SPEED_MULT : 1.0;
    const tVx = mvx * PHYSICS.SPEED * speedMult;
    const tVz = mvz * PHYSICS.SPEED * PHYSICS.Z_SPEED_MULT * speedMult;
    p.groundVx += (tVx - p.groundVx) * PHYSICS.GROUND_ACCEL;
    p.groundVz += (tVz - p.groundVz) * PHYSICS.GROUND_ACCEL;
    p.x += p.groundVx;
    p.z += p.groundVz;
  }
  const len = Math.hypot(mvx, mvz);

  // === ガード中の歩行 state 設定 ===
  // 移動中は方向に応じて walk_fwd / walk_back、静止は wait01 へ
  if (p.guarding && p.isGrounded &&
      (p.state === STATE.wait01 || p.state === STATE.walk_fwd || p.state === STATE.walk_back)) {
    if (len > 0) {
      p.state = (mvx * p.facing < 0) ? STATE.walk_back : STATE.walk_fwd;
    } else {
      p.state = STATE.wait01;
    }
  }

  // === 攻撃反動：selfRecoilMomentum を毎フレーム適用（後方ノックバック・2026-05-18）===
  // attack-engine の hitFrame で仕込まれる。facing と逆方向にプレイヤーを押し戻す。
  // ステージ端 clamp は後段で実施されるので、ここでは純粋に位置加算のみ。
  if ((p.selfRecoilMomentum ?? 0) > 0.1) {
    const rDecay = curAtk?.selfRecoilDecay ?? 0.85;
    p.x -= p.facing * p.selfRecoilMomentum;
    p.selfRecoilMomentum *= rDecay;
  } else if (p.selfRecoilMomentum !== undefined && p.selfRecoilMomentum <= 0.1) {
    p.selfRecoilMomentum = 0;
  }

  // 掴み readiness：wait01 中に意思入力で動いたフレームでフラグ立て
  // （tryGrabActivate は次フレームの早い段階で読む）
  // 被弾ロック中（_grabHitLock）は、移動キーを一度離す（mvx/mvz=0）まで再アームしない。
  // → 被弾でノックバックされた先の敵を、押しっぱなしの移動キーで掴んでしまう事故を防ぐ。
  if ((p.state === STATE.wait01 || p.state === STATE.walk_fwd || p.state === STATE.walk_back) && p.isGrounded) {
    if (mvx === 0 && mvz === 0) {
      p._grabHitLock = false;       // 移動キーを離した → ロック解除（次の意思入力で再アーム可）
    } else if (!p._grabHitLock) {
      p._grabReady = true;
    }
  }

  // 横方向クランプ：画面端壁（カメラ追従中心 ± 半幅）を採用。levelWalls に静的壁があれば優先。
  // 旧版は PHYSICS.STAGE_LEFT / STAGE_RIGHT のワールド固定壁。それは外側ガードレールとして残す（保険）。
  {
    const wallL = getActiveWallX('left');
    const wallR = getActiveWallX('right');
    const outerL = PHYSICS.STAGE_LEFT;
    const outerR = PHYSICS.STAGE_RIGHT;
    p.x = Math.max(Math.max(outerL, wallL), Math.min(Math.min(outerR, wallR), p.x));
  }
  p.z = Math.max(-380, Math.min(700, p.z));

  // === 向き ===
  // 必殺技中（isSpecial）+ 必殺技終了直後（_facingLockUntil 経過まで）は facing 固定
  // SP2 最終ヒット失敗 → wait01 への遷移で即振り向く不自然な見た目を防ぐ
  const isSpecialAttack = curAtk?.isSpecial &&
    (p.state === STATE.attacking || p.state === STATE.hit_confirm);
  const postSpecialLock = (p._facingLockUntil ?? 0) > getGameFrame();
  const facingLocked = isSpecialAttack || postSpecialLock;
  if ((isDashing || !movementLocked) && !p.guarding && !facingLocked) {
    if (!p.isGrounded) {
      if (p.homingFrames > 0 && p.homingTarget) {
        const faceDx = p.homingTarget.x - p.x;
        if (Math.abs(faceDx) > 5) p.facing = faceDx > 0 ? 1 : -1;
      } else {
        const inL = _inp('ArrowLeft')  || _inp('KeyA');
        const inR = _inp('ArrowRight') || _inp('KeyD');
        if (inR && !inL) p.facing = 1;
        else if (inL && !inR) p.facing = -1;
      }
    } else {
      if (mvx > 0) p.facing = 1;
      else if (mvx < 0) p.facing = -1;
    }
  }

  // === 方向転換 yaw thruster ===
  if (!isDashing) {
    const curMoveDir = (mvx > 0) ? 1 : (mvx < 0 ? -1 : 0);
    if (curMoveDir !== 0 && p.prevMoveDir !== 0 && curMoveDir !== p.prevMoveDir) {
      p.yawBurstSide  = p.prevMoveDir;
      p.yawBurstTimer = PHYSICS.YAW_BURST_FRAMES;
    }
    if (curMoveDir !== 0) p.prevMoveDir = curMoveDir;
  }

  // === ジャンプ・ブースター・重力 ===
  if (!_inp('Space')) p.jumpConsumed = false;
  if (p.isGrounded && _inp('Space') && !p.jumpConsumed && p.bigBurstTimer === 0 && !p.guarding && p.state !== STATE.grabbing && p.state !== STATE.attacking) {
    if (p.dashActive) {
      p.airVx = p.dashDirX * PHYSICS.SPEED * PHYSICS.DASH_SPEED_MULT;
      p.airVz = p.dashDirZ * PHYSICS.SPEED * PHYSICS.DASH_SPEED_MULT;
      p.dashActive  = false;
      p.airWasDash  = true;
    } else {
      p.airVx = mvx * PHYSICS.SPEED;
      p.airVz = mvz * PHYSICS.SPEED;
      p.airWasDash  = false;
    }
    p.vy = PHYSICS.JUMP_V;
    p.isGrounded = false;
    p.thrustFramesLeft = PHYSICS.THRUST_FRAMES;
    p.jumpConsumed = true;
    p.landingLagTimer = 0;   // ジャンプで離陸 → landingLag は意味を成さないのでクリア（2026-05-26）
    // 離陸 state（ダッシュジャンプは jump_d_*）。攻撃中・grabbing はジャンプ条件で除外済み。
    if (p.airWasDash) {
      p.state      = STATE.jump_d_start;
      p.stateTimer = PLAYER_JUMP_D_START_FRAMES;
    } else {
      p.state      = STATE.jump_start;
      p.stateTimer = PLAYER_JUMP_START_FRAMES;
    }
  }
  // 離陸 → ループ遷移
  if (p.state === STATE.jump_start) {
    p.stateTimer--;
    if (p.stateTimer <= 0) p.state = STATE.jump_loop;
  } else if (p.state === STATE.jump_d_start) {
    p.stateTimer--;
    if (p.stateTimer <= 0) p.state = STATE.jump_d_loop;
  }

  // 小ジャンプ廃止（2026-05-18）：SPACE 短押しでも常に THRUST_FRAMES 分のブースト発火。
  //   旧版は `_inp('Space')` で離した瞬間にブースト終了 → 短押し小ジャンプが永続コンボの起点になりやすかった。
  //   ジャンプは常に同じ最大高度に達するので、コンボ難易度に依存しない均質な空中行動になる。
  const thrustingNow =
    !p.isGrounded &&
    p.thrustFramesLeft > 0 &&
    p.vy >= 0;

  if (!p.isGrounded) {
    if (thrustingNow) {
      p.vy += PHYSICS.THRUST_FORCE;
      p.thrustFramesLeft--;
    }
    if (p.diveCountdown > 0) {
      p.vy = 0;
      p.diveCountdown--;
      if (p.diveCountdown === 0) p.vy = ATTACKS[p.attackId]?.diveVy ?? -22;
    } else {
      // 空中コンボ中＋コンボ後の猶予フレームは重力軽減（拾い直しの余裕）。通常ジャンプには適用しない（2026-05-20）。
      const inAerialCombo = !p.isGrounded && p.attackChainArr !== null;
      if (inAerialCombo) {
        p._aerialGraceTimer = PHYSICS.AERIAL_GRACE_FRAMES ?? 30;
      } else if (p.isGrounded) {
        p._aerialGraceTimer = 0;
      } else if (p._aerialGraceTimer > 0) {
        p._aerialGraceTimer--;
      }
      let pGravFactor = (inAerialCombo || p._aerialGraceTimer > 0) ? PHYSICS.AERIAL_GRAV_FACTOR : 1.0;
      // 空中滞空攻撃（airGravFactor 指定の必殺技）：攻撃中は重力を差し替えて滞空。
      //   空中の敵（浮力 0.65）に高度を合わせ、下方向射撃が敵を取りこぼさないようにする。
      if (p.state === STATE.attacking && curAtk?.airGravFactor !== undefined) {
        pGravFactor = curAtk.airGravFactor;
      }
      p.vy -= PHYSICS.GRAVITY * pGravFactor;
      // 終端速度クランプ：空中コンボで滞空フレームが長くなると vy が際限なく溜まり、
      // コンボ離脱後に異常な急降下になる事象を抑える（2026-05-19 追加）。
      if (p.vy < PHYSICS.MAX_FALL_VY) p.vy = PHYSICS.MAX_FALL_VY;
    }
    p.y += p.vy;
    // 受け身：上昇から頂点（vy<=0）に達したら無敵終了
    if (p.ukemiInvuln && p.vy <= 0) p.ukemiInvuln = false;
    if (p.y <= 0) {
      const _wasDashJump = !!p.airWasDash;  // 後段で airWasDash が false 化される前に保持
      p.y = 0;
      p.vy = 0;
      p.isGrounded    = true;
      p.aerialWhiffed = false;
      p.ukemiInvuln   = false;  // 着地で念のため受け身無敵を解除
      p.ukemiBuffer   = 0;
      p.thrustFramesLeft = 0;
      p.diveCountdown = 0;
      p.homingFrames  = 0;
      p.homingTarget  = null;
      p._aerialGraceTimer = 0;  // 着地で AERIAL_GRACE をクリア（次ジャンプに軽重力が漏れるのを防ぐ・2026-05-20）
      // attackChainArr は wait01 または新ジャンプ airborne state（loop/start）でのみクリア。
      // 2026-05-20：旧コードは state==wait01 限定だったが、jump_loop / jump_d_loop / jump_start /
      //   jump_d_start state を導入したためクリア漏れ発生 → 次ジャンプで inAerialCombo 誤判定。
      //   hit_confirm 着地で chainArr が残る挙動（ground J → hit_confirm 経由の高高度ジャンプ等）は旧仕様維持。
      if (p.state === STATE.wait01 ||
          p.state === STATE.jump_start    || p.state === STATE.jump_loop ||
          p.state === STATE.jump_d_start  || p.state === STATE.jump_d_loop) {
        p.attackChainArr = null;
      }
      // 着地で wait01 に即降格：
      //   - diveVy 系（c01_sp_03_air 急降下踏みつけ（旧 c01_atk_l_01_air_down））
      //   - cancelOnLand:true（空中 J 系 / 空中 K：着地後すぐ立ち J/K に行きたい技）
      const _landAtk = p.attackId ? ATTACKS[p.attackId] : null;
      if (_landAtk &&
          (_landAtk.diveVy !== undefined || _landAtk.cancelOnLand) &&
          !_landAtk.autoLandGeyser &&   // 着地ゲイザー技は attack-engine 側で着地を検知して自己遷移する
          (p.state === STATE.attacking || p.state === STATE.hit_confirm)) {
        p.state          = STATE.wait01;
        p.attackChainIdx = -1;
        p.attackChainArr = null;  // 着地時に必ずクリア（次ジャンプで AERIAL_GRAV_FACTOR が漏れるのを防ぐ・2026-05-20）
        p.attackId       = null;
        p.stateTimer     = 0;
        p.cancelTimer    = 0;
        p.kBuffered      = false;
        p.attackBuffered = false;
      }
      // 着地硬直（landingLag）：空中技着地後の攻撃入力封鎖。
      //   ★ヒット成立済（hitDelivered）はスキップ：命中時はキャンセル/チェーン優先（2026-05-26）。
      //   空振り着地時のみ後隙ペナルティとして発動。
      if (_landAtk?.landingLag && !p.hitDelivered &&
          (p.state === STATE.attacking || p.state === STATE.hit_confirm || p.state === STATE.wait01)) {
        p.landingLagTimer = _landAtk.landingLag;
      }
      { let ldx = 0, ldz = 0;
        if (_inp('ArrowLeft')  || _inp('KeyA')) ldx -= 1;
        if (_inp('ArrowRight') || _inp('KeyD')) ldx += 1;
        if (_inp('ArrowUp')    || _inp('KeyW')) ldz -= 1;
        if (_inp('ArrowDown')  || _inp('KeyS')) ldz += 1;
        const llen = Math.hypot(ldx, ldz);
        if (llen > 0 && p.dashCooldown === 0 && p.airWasDash) {
          p.dashActive   = true;
          p.dashDirX     = ldx / llen;
          p.dashDirZ     = ldz / llen;
        }
        p.airWasDash = false;
      }
      p.aerialHopCount = 0;      // 着地で連続ホップ減衰カウンタもリセット
      p.airUsedSpecialIds = null; // 着地で空中 SP 使用履歴をリセット（出戻り禁止フラグのクリア）
      p.airHitOccurred = false;   // 着地で空中ヒット履歴をリセット（SP→SP whiff チェーン許可フラグ）
      // 同 ID 30F cooldown をクリア：着地後の次ジャンプで同じ空中 SP を再使用可能にする（2026-05-26）。
      //   元々「地上ループ防止」目的で導入されたが、空中は airUsedSpecialIds が 1 回制限を担うため重複。
      //   着地のたびにリセットして「再ジャンプ→同 SP」を阻害しない。地上連打は次の同 ID 発動で再度 set される。
      p._specialFireFrames = null;
      p._specialFireIds    = null;
      p.airVx = 0;
      p.airVz = 0;
      // 通常ジャンプ着地 → jump_end / jump_d_end へ（攻撃中・ダッシュ中は介入しない）。
      // 2026-05-20：state 化。攻撃/ジャンプ入力で即 cancel される演出フック。
      // 上の cancelOnLand ブロックで state==wait01 に降ろされた場合や、ただ落ちて wait01 のままの場合に該当。
      const inJumpAirState = (p.state === STATE.jump_loop || p.state === STATE.jump_d_loop ||
                              p.state === STATE.jump_start || p.state === STATE.jump_d_start);
      if ((p.state === STATE.wait01 || inJumpAirState) && !p.dashActive) {
        if (_wasDashJump) {
          p.state      = STATE.jump_d_end;
          p.stateTimer = PLAYER_JUMP_D_END_FRAMES;
        } else {
          p.state      = STATE.jump_end;
          p.stateTimer = PLAYER_JUMP_END_FRAMES;
        }
      }
    }
  }
  // jump_end / jump_d_end の自然終了：タイマー満了で wait01。
  // 攻撃/ジャンプ入力は他処理で state を上書きするので cancel される。
  if (p.state === STATE.jump_end || p.state === STATE.jump_d_end) {
    p.stateTimer--;
    if (p.stateTimer <= 0) p.state = STATE.wait01;
  }

  if (p.bigBurstTimer > 0) p.bigBurstTimer--;

  const parts = p.mesh.userData.parts;

  const thrustOrDash = thrustingNow;
  parts.thrusterL.visible = thrustOrDash;
  parts.thrusterR.visible = thrustOrDash;
  if (thrustOrDash) {
    const isBig  = p.bigBurstTimer > 0;
    const isDash = isDashing && !thrustingNow;
    const col  = isBig ? 0xffff66 : isDash ? 0xff8800 : 0x00ddff;
    const sz   = isBig ? 1.8 : isDash ? 1.4 : 1.0;
    const pulse = (isBig ? 1.6 : isDash ? 1.3 : 0.85)
                + Math.random() * (isBig ? 0.7 : isDash ? 0.5 : 0.4);
    parts.thrusterL.scale.set(sz, pulse, sz);
    parts.thrusterR.scale.set(sz, pulse, sz);
    parts.thrusterL.material.color.setHex(col);
    parts.thrusterR.material.color.setHex(col);
  } else {
    parts.thrusterL.material.color.setHex(0x00ddff);
    parts.thrusterR.material.color.setHex(0x00ddff);
  }

  if (p.yawBurstTimer > 0) p.yawBurstTimer--;
  const yawActive = p.yawBurstTimer > 0;
  parts.yawL.visible = yawActive && (p.yawBurstSide <= 0);
  parts.yawR.visible = yawActive && (p.yawBurstSide >= 0);
  if (yawActive) {
    const yawPulse = 0.6 + Math.random() * 0.6;
    const target = (p.yawBurstSide < 0) ? parts.yawL : parts.yawR;
    target.scale.set(1, yawPulse, 1);
  }

  updatePartAnims(p);

  const isMoving = (len > 0);
  if (isMoving && p.isGrounded) {
    p.bobPhase += 0.3;
  } else if (p.isGrounded) {
    p.bobPhase += 0.05;
  }
  const bobY = isMoving ? Math.abs(Math.sin(p.bobPhase)) * 4 : Math.sin(p.bobPhase) * 2;

  updateCrisisEffect(p);
  updateInvincibleBlink(p);

  // === メッシュへ反映 ===
  p.mesh.position.set(p.x, p.y + bobY, p.z);
  const targetRot = (p.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
  p.mesh.rotation.y += (targetRot - p.mesh.rotation.y) * 0.2;
  const atkForTilt = (p.state === STATE.attacking && p.attackId) ? ATTACKS[p.attackId] : null;
  let targetTiltX = 0;
  if (atkForTilt?.tiltX !== undefined) {
    targetTiltX = atkForTilt.tiltX;
  } else if (STATE_PITCH_TARGET[p.state] !== undefined) {
    targetTiltX = STATE_PITCH_TARGET[p.state];
  }
  p.mesh.rotation.x += (targetTiltX - p.mesh.rotation.x) * 0.35;

  // === 必殺技 / 受け身：本体 emissive 制御 ===
  const ukemiFlashing = p.ukemiFlashTimer > 0;
  const flashing = p.specialFlashTimer > 0;
  const pulsing  = p.chargeReady && !flashing && !ukemiFlashing;
  if (ukemiFlashing) {
    const t = p.ukemiFlashTimer / UKEMI_CONFIG.FLASH_FRAMES;
    _applyBodyEmissive(p.mesh, t, t, t);   // 受け身成立：白く発光
  } else if (flashing) {
    const t = p.specialFlashTimer / SPECIAL_CONFIG.FLASH_FRAMES;
    _applyBodyEmissive(p.mesh, t, t, t);
  } else if (pulsing) {
    const pulse = 0.25 + 0.50 * (0.5 + 0.5 * Math.sin(gameFrameCounter * 0.21));
    // stage2（MAX）は白で脈動（高温の炎イメージ）。stage1 までは従来の黄色。
    if ((p.chargeLevel ?? 0) >= 2) {
      _applyBodyEmissive(p.mesh, pulse, pulse, pulse);
    } else {
      _applyBodyEmissive(p.mesh, pulse, pulse * 0.85, pulse * 0.10);
    }
  } else if (p._bodyEmissiveWasOn) {
    _applyBodyEmissive(p.mesh, 0, 0, 0);
  }
  p._bodyEmissiveWasOn = flashing || pulsing || ukemiFlashing;

  // === 必殺技：当たり判定可視化 ===
  const curAtkVis = (p.state === STATE.attacking && p.attackId) ? ATTACKS[p.attackId] : null;
  const showHb = curAtkVis && curAtkVis.isSpecial && curAtkVis.showHitbox && SPECIAL_CONFIG.SHOW_HITBOX;
  if (showHb) {
    const elapsedVis = curAtkVis.duration - p.stateTimer;
    const hitEnd = getHitWindowEnd(curAtkVis);
    const inHitFrame = elapsedVis >= curAtkVis.hitFrame && elapsedVis < hitEnd;
    if (inHitFrame) {
      const rx = curAtkVis.rangeX ?? 100;
      const ryUp   = curAtkVis.rangeY ?? 100;
      const ryDown = curAtkVis.rangeYDown ?? ryUp;
      const rz = curAtkVis.rangeZ ?? 100;
      const yHeight = ryUp + ryDown;
      const yCenter = p.y + (ryUp - ryDown) * 0.5;
      // omni 技（全方向）はプレイヤー中心配置・通常技は前方片側配置
      const _hbXOffset = curAtkVis.omni ? 0 : p.facing * (rx * 0.5);
      _specialHitboxMesh.visible = true;
      _specialHitboxMesh.position.set(p.x + _hbXOffset, yCenter, p.z);
      _specialHitboxMesh.scale.set(rx, yHeight, rz * 2);
      // 個別色：攻撃定義に hitboxColor があれば上書き（sp_03_max の青炎など）
      _specialHitboxMesh.material.color.setHex(curAtkVis.hitboxColor ?? SPECIAL_CONFIG.HITBOX_COLOR);
    } else {
      _specialHitboxMesh.visible = false;
    }
  } else {
    _specialHitboxMesh.visible = false;
  }

  // === 敵攻撃の当たり判定可視化 ===
  // プール内の全 hitbox を先に hide：enemies.splice で配列縮小すると
  //   プール側の N 番 mesh が visible=true のまま空間に取り残されるため、毎フレーム必ずリセットする
  if (_hideAllEnemyHitboxes) _hideAllEnemyHitboxes();
  for (let i = 0; i < _enemies.length; i++) {
    const e = _enemies[i];
    const mesh = _getEnemyHitboxMesh(i);
    const atkDef = (e.curAtkId && ENEMY_ATTACKS[e.curAtkId]) ? ENEMY_ATTACKS[e.curAtkId] : null;
    // slash_rush はヒット瞬間のみフラッシュ表示（通常攻撃はアクティブ全体）
    const isSlashRush = atkDef?.kind === 'slash_rush';
    const showActive  = e.isAlive && e.state === STATE.enemy_attacking && e.atkPhase === 'active';
    const showHit     = isSlashRush ? ((e.slashHitFlash ?? 0) > 0) : showActive;
    if (!showHit) {
      mesh.visible = false;
      continue;
    }
    const rx = atkDef?.hitboxRangeX ?? DUMMY_ATK_CONFIG.hitboxRangeX;
    const ry = atkDef?.hitboxRangeY ?? DUMMY_ATK_CONFIG.hitboxRangeY;
    const rz = atkDef?.hitboxRangeZ ?? DUMMY_ATK_CONFIG.hitboxRangeZ;
    mesh.visible = true;
    mesh.position.set(e.x + e.facing * (rx * 0.5), e.y + ry * 0.5, e.z);
    mesh.scale.set(rx, ry * 2, rz * 2);
    mesh.material.color.setHex(isSlashRush ? 0xff8800 : 0xff4444);
  }

  // === ガードシールド同期 ===
  syncGuardShield(p);

}
