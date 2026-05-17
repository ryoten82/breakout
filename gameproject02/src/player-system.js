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

import { STATE, STATE_PITCH_TARGET, ENEMY_AIRBORNE_Y_THRESHOLD } from './states.js';
import {
  PHYSICS, SP_CONFIG,
  GUARD_CONFIG, SPECIAL_CONFIG, HOMING_CONFIG,
  CHARGE_PARTICLE_CONFIG, CHARGE_RING_CONFIG,
  DUMMY_ATK_CONFIG,
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
    const baseEligible =
      !p.guarding &&
      p.isGrounded &&
      p.state !== STATE.attacking &&
      p.state !== STATE.hit_confirm;
    // J+K 同時押し中の L 押下は ULT 入力候補なのでガードに入らない（誤発動防止・2026-05-15）
    // 旧版だと L 押した瞬間にガード起動 → p.guarding=true → ULT 入力 blocked で ULT が出なかった
    const _jkAlsoHeld = _inp('KeyJ') && _inp('KeyK');
    const canStart = lHeld && baseEligible && p.sp >= GUARD_CONFIG.MIN_SP_TO_START
      && !_jkAlsoHeld;
    if (canStart) {
      p.guarding       = true;
      p.guardFadeTimer = 0;
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
      } else if (!lHeld) {
        p.guarding = false;
      }
      // 攻撃で割り込まれた場合（将来用：被弾やメガクラ等が p.guarding を強制 false にする）
      if (p.state === STATE.attacking) p.guarding = false;
      // 解除した瞬間：フェードアウトタイマー始動
      if (!p.guarding) p.guardFadeTimer = GUARD_CONFIG.FADE_OUT_FRAMES;
    }
  } else if (p.guarding) {
    // ULT・グラブ等が発生 → ガード強制解除しフェードアウトへ
    p.guarding = false;
    p.guardFadeTimer = GUARD_CONFIG.FADE_OUT_FRAMES;
  }

  // 不透明度の更新（常に走らせる：フェード中に他状態へ遷移しても opacity を 0 まで完走させる）
  if (p.guarding) {
    // 発動中は素早く 1 へ
    p.guardOpacity += (1 - p.guardOpacity) * GUARD_CONFIG.FADE_IN_LERP;
  } else if (p.guardFadeTimer > 0) {
    // フェードアウト中：線形に 0 へ
    p.guardFadeTimer--;
    p.guardOpacity = p.guardFadeTimer / GUARD_CONFIG.FADE_OUT_FRAMES;
  } else {
    p.guardOpacity = 0;
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
  const canCharge =
    (p.state === STATE.wait01 || p.state === STATE.attacking || p.state === STATE.hit_confirm)
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
  // 空中 SP 使用回数制限は撤廃（2026-05-20）：
  //   旧 1 回制限 → 他の制限（specialUsedIds 同コンボ 3 回 / specialHitBy 敵単位 3 回 / superFlight 3 回）で
  //   十分にループを断ち切れるため、空中での SP キャンセル連鎖の自由度を優先。
  //   airSpecialUsed フラグは互換のため残置するが gating には使わない。
  // grab 中は OK（cancelGrabIntoAttack 経由で発動）
  if (p.state === STATE.grabbing) return true;
  if (p.state === STATE.wait01) return true;
  if (p.state === STATE.hit_confirm) return true;
  if (p.state === STATE.attacking) return true; // attacking もキャンセル発動可
  return false;
}
// 必殺技 ID の正規化：地上/空中の派生は同じ base として 1 コンボ 1 回ルールを共有する
//   例: 'c01_sp_01' と 'c01_sp_01_air' は同じ base 'c01_sp_01' として扱う
function specialBaseId(id) {
  // 派生サフィックスを順に剥がす：_air → _NN（チャージ段階）→ 基底 ID
  // 例: c01_sp_04_02_air → c01_sp_04_02 → c01_sp_04
  // burst トリガ（敵単位 1 回制限）は基底 ID で共有させたいので
  // チャージ段階別の sp_04 系も同じ ID にまとめる
  let s = id;
  if (s.endsWith('_air')) s = s.slice(0, -4);
  s = s.replace(/_\d{2}$/, '');  // _01, _02, ... の段階サフィックスを剥がす
  return s;
}
// 必殺技の短期連発抑止クールダウン（コンボ未確立中のみ適用）
//   コンボ中はクールダウン無視（同 base ID 再ヒットで down_burst 誘発する仕様を保持）
const _SPECIAL_COOLDOWN_FRAMES = 30;   // 0.5 秒。同 ID の連発のみ適用、地上⇄空中の派生切替は無視

function startSpecial(p, id) {
  // 重複検出：specialUsedIds.add する前に判定して flag に保存。
  // 重複ヒットすると敵が down_burst_* に強制遷移（tryHitEnemies が参照）。
  const baseId = specialBaseId(id);
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
  if (_lastFireId === id && getGameFrame() - _lastFire < _SPECIAL_COOLDOWN_FRAMES) return false;
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
  // 空中で発動したら airSpecialUsed フラグを立てる（着地で false 復帰・連発抑止）
  if (!p.isGrounded) p.airSpecialUsed = true;
  p.specialFlashTimer  = SPECIAL_CONFIG.FLASH_FRAMES;
  // チャージは消費しない：J 押しっぱなしで他 SP を撃った場合に蓄積を保持して
  // 後から J リリースで sp_03 を連結できるようにする。sp_03 自身を J リリース
  // 経路から発動する際はそちら（processSpecialInput 内）で chargeReady/Frames を 0 にする。
  // 方向入力履歴クリア：同じコマンドが連打で再成立しないように
  // （1 コマンド = 1 発動。次に出すには方向を再入力する必要がある）
  p.dirHistory.length = 0;
  console.log('[SPECIAL]', id, '発動');
  return true;
}

export function processSpecialInput(p) {
  // === 常時更新 ===
  updateDirHistory(p);
  updateChargeJ(p);

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
export function processStrongAttackInput(p) {
  const kPressed = _inp('KeyK');
  const justPressed = kPressed && !kKeyWasDown;
  kKeyWasDown = kPressed;
  if (p.guarding || p.ultActive) return;
  if (p.state === STATE.grabbing) return;
  if (!justPressed) return;
  if (!canStartSpecial(p)) return;

  const upHeld  = _inp('ArrowUp')    || _inp('KeyW');
  const dnHeld  = _inp('ArrowDown')  || _inp('KeyS');

  // 命名規則 §9.0：↑K=SP2 / ↓K=SP3 / それ以外（中立 K / ←/→ + K）= SP1（波動）
  // 中立 K もデフォルトで SP1 を発射するので、無方向でも何か出る = 入口を下げた設計。
  let baseId;
  if (upHeld)      baseId = 'c01_sp_02';
  else if (dnHeld) baseId = 'c01_sp_03';
  else             baseId = 'c01_sp_01';

  startSpecial(p, pickSpecialAttackId(baseId, p.isGrounded));
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
  // 1) 対象が死亡・グラブ被害中・きりもみ離脱中
  if (!t.isAlive || t.state === STATE.grabbed
      || t.state === STATE.down_burst_start || t.state === STATE.down_burst_loop) {
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
  // === 掴み発動 readiness フラグ ===
  // 仕様：「wait01 中に自分の意思で移動した」状態でのみ tryGrabActivate を許可。
  // wait01 以外（hitstun / attacking / grabbing 等）に入った瞬間に false へリセット。
  // 物理移動セクション後（mvx/mvz 確定後）に「実際に動いていた」なら true に立てる。
  // → 被弾のけぞり後・攻撃終了後にユーザーが新規に移動を入力するまで掴めない。
  if (p.state !== STATE.wait01) p._grabReady = false;

  // === 被弾中：入力一切受け付けず、hitstun の自動進行のみ走らせて return ===
  if (isHitstunState(p)) {
    const canReverse = (p.state !== STATE.dying && p.state !== STATE.dead && p.state !== STATE.guard_crash);
    if (canReverse) _processMegaCrashUltInput(p);
    updatePlayerHitstun(p);
    updateCrisisEffect(p);
    return;
  }
  if (p.invincibleFrames > 0) p.invincibleFrames--;

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
  _processMegaCrashUltInput(p);
  processSpecialInput(p);
  processAttackInput(p);
  processStrongAttackInput(p);

  if (p.specialFlashTimer > 0) p.specialFlashTimer--;
  if (!p.guarding && !p.ultActive && p.state !== STATE.grabbing) processDashInput(p);

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
  if (p.state === STATE.wait01 && p.isGrounded && (mvx !== 0 || mvz !== 0)) {
    p._grabReady = true;
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
      const pGravFactor = (inAerialCombo || p._aerialGraceTimer > 0) ? PHYSICS.AERIAL_GRAV_FACTOR : 1.0;
      p.vy -= PHYSICS.GRAVITY * pGravFactor;
      // 終端速度クランプ：空中コンボで滞空フレームが長くなると vy が際限なく溜まり、
      // コンボ離脱後に異常な急降下になる事象を抑える（2026-05-19 追加）。
      if (p.vy < PHYSICS.MAX_FALL_VY) p.vy = PHYSICS.MAX_FALL_VY;
    }
    p.y += p.vy;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.isGrounded    = true;
      p.aerialWhiffed = false;
      p.thrustFramesLeft = 0;
      p.diveCountdown = 0;
      p.homingFrames  = 0;
      p.homingTarget  = null;
      p._aerialGraceTimer = 0;  // 着地で AERIAL_GRACE をクリア（次ジャンプに軽重力が漏れるのを防ぐ・2026-05-20）
      // attackChainArr は wait01 時のみクリア（攻撃継続中の状態を壊さない）
      // → wait01 でないと cancelOnLand ブロックで処理される or 攻撃継続なのでクリア不要
      if (p.state === STATE.wait01) p.attackChainArr = null;
      // 着地で wait01 に即降格：
      //   - diveVy 系（c01_sp_03_air 急降下踏みつけ（旧 c01_atk_l_01_air_down））
      //   - cancelOnLand:true（空中 J 系 / 空中 K：着地後すぐ立ち J/K に行きたい技）
      const _landAtk = p.attackId ? ATTACKS[p.attackId] : null;
      if (_landAtk &&
          (_landAtk.diveVy !== undefined || _landAtk.cancelOnLand) &&
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
      p.airSpecialUsed = false;  // 着地で空中必殺チャージ復活
      p.aerialHopCount = 0;      // 着地で連続ホップ減衰カウンタもリセット
      p.airVx = 0;
      p.airVz = 0;
    }
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

  // === 必殺技：本体 emissive 制御 ===
  const flashing = p.specialFlashTimer > 0;
  const pulsing  = p.chargeReady && !flashing;
  if (flashing) {
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
  p._bodyEmissiveWasOn = flashing || pulsing;

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
      _specialHitboxMesh.visible = true;
      _specialHitboxMesh.position.set(p.x + p.facing * (rx * 0.5), yCenter, p.z);
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
  for (let i = 0; i < _enemies.length; i++) {
    const e = _enemies[i];
    const mesh = _getEnemyHitboxMesh(i);
    if (!e.isAlive || e.state !== STATE.enemy_attacking || e.atkPhase !== 'active') {
      mesh.visible = false;
      continue;
    }
    const cfg = DUMMY_ATK_CONFIG;
    const rx = cfg.hitboxRangeX, ry = cfg.hitboxRangeY, rz = cfg.hitboxRangeZ;
    mesh.visible = true;
    mesh.position.set(e.x + e.facing * (rx * 0.5), e.y + ry * 0.5, e.z);
    mesh.scale.set(rx, ry * 2, rz * 2);
  }

  // === ガードシールド同期 ===
  if (p.guardOpacity > 0.01) {
    _guardShield.visible      = true;
    _guardShield.position.set(p.x, p.y + GUARD_CONFIG.SHIELD_Y_OFFSET, p.z);
    _guardShield.rotation.y   = (p.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
    const flashT = (p.guardFlashTimer > 0) ? (p.guardFlashTimer / GUARD_CONFIG.FLASH_FRAMES) : 0;
    const baseOp = p.guardOpacity * GUARD_CONFIG.SHIELD_MAX_OPACITY;
    _guardShield.material.opacity = baseOp + (GUARD_CONFIG.FLASH_OPACITY - baseOp) * flashT;
    if (flashT > 0) {
      _guardShield.material.color.setHex(GUARD_CONFIG.FLASH_COLOR);
    } else {
      _guardShield.material.color.setHex(GUARD_CONFIG.SHIELD_COLOR);
    }
  } else if (p.guardFailFlashTimer > 0) {
    _guardShield.visible    = true;
    _guardShield.position.set(p.x, p.y + GUARD_CONFIG.SHIELD_Y_OFFSET, p.z);
    _guardShield.rotation.y = (p.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
    const t = 1 - (p.guardFailFlashTimer / GUARD_CONFIG.FAIL_FLASH_FRAMES);
    const envelope = 1 - t;
    const pulse = Math.abs(Math.sin(t * Math.PI * 2));
    _guardShield.material.opacity = GUARD_CONFIG.FAIL_FLASH_OPACITY * pulse * envelope;
    _guardShield.material.color.setHex(GUARD_CONFIG.FAIL_FLASH_COLOR);
    p.guardFailFlashTimer--;
    if (p.guardFailFlashTimer <= 0) {
      _guardShield.material.color.setHex(GUARD_CONFIG.SHIELD_COLOR);
    }
  } else {
    _guardShield.visible = false;
  }

}
