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
//    - consumeStrongAttackBuffer ATTACKING 中の K バッファ消化（HIT_CONFIRM 移行時）
//    - updateComboHoming        最初に殴った敵への自動接近（コンボ補正）
//
//  ES Module として index.html から import される：
//    import {
//      initPlayerSystem,
//      processGuardInput, readDirInput, dirMatchesForFacing,
//      updateChargeJ, processSpecialInput,
//      processStrongAttackInput, consumeStrongAttackBuffer,
//      updateComboHoming,
//      getGameFrame, chargeRingState,
//    } from './src/player-system.js';
//
//  initPlayerSystem(deps) で依存を一括注入：
//    - inp: (code) => bool             入力ポーリング関数
//    - spawnChargeParticle, clearChargeParticles  FX function refs
//    - chargeReadyRing: THREE.Mesh     チャージ完成リング mesh
// ============================================================

import { STATE } from './states.js';
import {
  GUARD_CONFIG, SPECIAL_CONFIG, HOMING_CONFIG,
  CHARGE_PARTICLE_CONFIG, CHARGE_RING_CONFIG,
} from './config.js';
import { ATTACKS } from './attacks.js';
import {
  anyPlayerUlting, cancelGrabIntoAttack, startAttackById,
  pickStepAttackId, pickStrongAttackId, pickSpecialAttackId,
  matchCommand,
} from './attack-engine.js';

let _inp = null;
let _spawnChargeParticle = null;
let _clearChargeParticles = null;
let _chargeReadyRing = null;

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
    const canStart = lHeld && baseEligible && p.sp >= GUARD_CONFIG.MIN_SP_TO_START;
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
    last.frame = gameFrameCounter; // 同方向の連続は最新時刻のみ更新
  } else {
    p.dirHistory.push({ dir, frame: gameFrameCounter });
  }
  // 古いエントリの破棄
  const cutoff = gameFrameCounter - SPECIAL_CONFIG.DIR_BUFFER_FRAMES;
  while (p.dirHistory.length > 0 && p.dirHistory[0].frame < cutoff) {
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
  // 攻撃中・グラブ中・ガード中・ULT 中はチャージしない（独立行動中のみ）
  // ※ specialUsedIds に c01_sp_03 が含まれていてもチャージ可（重複は down_burst_* 経由で表現する設計）
  const canCharge = p.isGrounded
    && p.state === STATE.wait01
    && !p.guarding && !p.ultActive
    && p.state !== STATE.grabbing;
  const wasReady = p.chargeReady;
  const wasCharging = p.chargeJFrames > 0;
  if (jHeld && canCharge) {
    p.chargeJFrames++;
    p.jHeldDuringCharge = true;
    if (p.chargeJFrames >= SPECIAL_CONFIG.CHARGE_FRAMES) p.chargeReady = true;
  } else if (!jHeld) {
    // J 離した：jHeldDuringCharge を下げ、チャージ未完成なら蓄積も破棄
    // （完成済みは chargeReady=true のまま残し、processSpecialInput 側でリリースを技発動に使う）
    p.jHeldDuringCharge = false;
    if (!p.chargeReady && p.chargeJFrames > 0) {
      p.chargeJFrames = 0;
    }
  } else {
    // 押下中だがチャージ条件を満たさない（攻撃中など）→ 蓄積停止だがリセットはしない
  }
  // 収束粒子：チャージ進行中（>0 かつ未完了）に毎フレーム放出
  if (p.chargeJFrames > 0 && !p.chargeReady) {
    for (let i = 0; i < CHARGE_PARTICLE_CONFIG.SPAWN_PER_FRAME; i++) {
      _spawnChargeParticle(p.x, p.y, p.z);
    }
  }
  // チャージ成立瞬間（false → true）：拡散リング合図 + 残った収束粒子はクリア
  if (!wasReady && p.chargeReady) {
    chargeRingState.frames = CHARGE_RING_CONFIG.FRAMES;
    chargeRingState.x = p.x;
    chargeRingState.y = p.y + CHARGE_RING_CONFIG.Y_OFFSET;
    chargeRingState.z = p.z;
    _chargeReadyRing.visible = true;
    _clearChargeParticles();
  }
  // チャージが中断されたら粒子もクリア
  if (wasCharging && p.chargeJFrames === 0 && !p.chargeReady) {
    _clearChargeParticles();
  }
}

function canStartSpecial(p) {
  if (p.guarding) return false;
  if (p.ultActive) return false;
  if (anyPlayerUlting()) return false;
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
  return id.endsWith('_air') ? id.slice(0, -4) : id;
}
function startSpecial(p, id) {
  // 重複検出：specialUsedIds.add する前に判定して flag に保存。
  // 重複ヒットすると敵が down_burst_* に強制遷移（tryHitEnemies が参照）。
  const baseId = specialBaseId(id);
  p.specialIsDuplicate = p.specialUsedIds.has(baseId);
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
  p.specialFlashTimer  = SPECIAL_CONFIG.FLASH_FRAMES;
  // チャージ消費
  p.chargeJFrames = 0;
  p.chargeReady   = false;
  // 方向入力履歴クリア：同じコマンドが連打で再成立しないように
  // （1 コマンド = 1 発動。次に出すには方向を再入力する必要がある）
  p.dirHistory.length = 0;
  console.log('[SPECIAL]', id, p.specialIsDuplicate ? '重複（→burst）' : '発動');
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
    const fireable = canStartSpecial(p);
    p.chargeReady   = false;
    p.chargeJFrames = 0;
    if (fireable) {
      startSpecial(p, pickSpecialAttackId('c01_sp_03', p.isGrounded));
    }
    return;
  }

  // === gate ===
  // 必殺技 → 別 ID の必殺技キャンセルを許可する設計のため、ここでは ID 一律ブロックしない。
  // 重複（specialUsedIds に既出）でも発動を通す。ヒット時に敵が down_burst_* で離脱する設計。
  if (!canStartSpecial(p)) return;
  // === J/K 押下時にコマンドマッチ判定（最長一致優先：sp_01 → sp_02）===
  // 注意：コマンドが成立しなかった場合は通常 J / K の処理に流す
  //       （早期 return せず、後続の processAttackInput / processStrongAttackInput を生かす）
  const triggerJust = jJust || kJust;
  if (triggerJust) {
    // チャージ未満で J を離す前提：J 押下時点でチャージはリセット扱い（連打優先）
    if (jJust && !p.chargeReady) {
      p.chargeJFrames = 0;
    }
    // ↓↘→ （波動）地上/空中で別 ID にディスパッチ・使用済管理は base で共有
    if (matchCommand(p, ['D', 'DR', 'R'])) {
      startSpecial(p, pickSpecialAttackId('c01_sp_01', p.isGrounded));
      return;
    }
    // ↓↑ （対空）
    if (matchCommand(p, ['D', 'U'])) {
      startSpecial(p, pickSpecialAttackId('c01_sp_02', p.isGrounded));
      return;
    }
  }
}

// ============================================================
//  強攻撃入力処理（K キー押下）
// ============================================================
export function processStrongAttackInput(p) {
  // エッジ検出変数は常に更新
  const kPressed = _inp('KeyK');
  const justPressed = kPressed && !kKeyWasDown;
  kKeyWasDown = kPressed;
  if (p.guarding || p.ultActive) return;  // ガード中・ULT中は攻撃不可
  if (p.state === STATE.grabbing) return; // グラブ中は processGrabInput 側で扱う
  if (!justPressed) return;

  if (p.state === STATE.wait01) {
    // 地上ダッシュ中の派生：ステップK（ショルダータックル）
    if (p.dashActive && p.isGrounded) {
      startAttackById(p, pickStepAttackId(p, true), -1);
      return;
    }
    const upHeld = _inp('ArrowUp') || _inp('KeyW');
    const dnHeld = _inp('ArrowDown') || _inp('KeyS');
    startAttackById(p, pickStrongAttackId(p, upHeld, dnHeld), -1);
  } else if (p.state === STATE.hit_confirm) {
    // 弱 → 強キャンセル（Jチェーン中のみ ↑+K / ↓+K / 通常K を分岐）
    if (p.attackChainIdx >= 0) {
      const upHeld = _inp('ArrowUp') || _inp('KeyW');
      const dnHeld = _inp('ArrowDown') || _inp('KeyS');
      startAttackById(p, pickStrongAttackId(p, upHeld, dnHeld), -1);
    }
  } else if (p.state === STATE.attacking) {
    // ATTACKING 中はバッファに積む（方向状態を保存）
    p.kBuffered  = true;
    p.kBufferUp  = _inp('ArrowUp') || _inp('KeyW');
    p.kBufferDn  = _inp('ArrowDown') || _inp('KeyS');
  }
}

// ATTACKING中にバッファされたK入力をHIT_CONFIRM移行時に消費
export function consumeStrongAttackBuffer(p) {
  if (p.state !== STATE.hit_confirm) return;
  if (!p.kBuffered) return;
  if (p.attackChainIdx < 0) { p.kBuffered = false; return; } // Kチェーン外は無視
  const wasUp  = p.kBufferUp;
  const wasDn  = p.kBufferDn;
  p.kBuffered  = false;
  p.kBufferUp  = false;
  p.kBufferDn  = false;
  startAttackById(p, pickStrongAttackId(p, wasUp, wasDn), -1);
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
  if (Math.abs(dx) > HOMING_CONFIG.MAX_DISTANCE_X) {
    p.comboTarget = null;
    p.oppositeInputFrames = 0;
    return;
  }
  const distXZ = Math.hypot(dx, dz);
  if (distXZ > HOMING_CONFIG.MAX_DISTANCE) {
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
  if (p.oppositeInputFrames >= HOMING_CONFIG.BREAK_INPUT_FRAMES) {
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
  //   敵がコンボ的に逃げていく状態（down_front_* / down_chou_* / down_wall_* / down_roll_* / down_rakka_* / down_bound_*）で、
  //   プレイヤーが明示的に前方向を押していないなら、追わない（吸い込まれ感の軽減）
  //   ※ wait01・knockback01/02・down_up_*（打ち上げ juggle）は引き続き追跡する
  const _isFlungState = (
    t.state === STATE.down_front_start  || t.state === STATE.down_front_loop  ||
    t.state === STATE.down_chou_start   || t.state === STATE.down_chou_loop   ||
    t.state === STATE.down_wall_start   || t.state === STATE.down_wall_loop   ||
    t.state === STATE.down_roll_start   ||
    t.state === STATE.down_rakka_start  || t.state === STATE.down_rakka_loop  ||
    t.state === STATE.down_bound_start
  );
  const _forwardInput = (inputDir !== 0 && inputDir === targetDirX);
  if (_isFlungState && !_forwardInput) {
    return; // 自動接近をスキップ（ロック自体は維持・前入力で復活）
  }
  // facing 自動反転：FACING_FLIP_DIST より遠い時のみ強制反転（近距離は維持）
  if (Math.abs(dx) > HOMING_CONFIG.FACING_FLIP_DIST) p.facing = targetDirX;
  // 距離スケーリング：近い時 100%・FALLOFF_FAR で FALLOFF_FAR_RATIO まで線形減衰
  const falloff = (() => {
    if (distXZ <= HOMING_CONFIG.FALLOFF_NEAR) return 1.0;
    if (distXZ >= HOMING_CONFIG.FALLOFF_FAR)  return HOMING_CONFIG.FALLOFF_FAR_RATIO;
    const t01 = (distXZ - HOMING_CONFIG.FALLOFF_NEAR)
              / (HOMING_CONFIG.FALLOFF_FAR - HOMING_CONFIG.FALLOFF_NEAR);
    return 1.0 + (HOMING_CONFIG.FALLOFF_FAR_RATIO - 1.0) * t01;
  })();
  // X 補正：圏内デッドゾーン外なら寄せる
  const rangeX = atk.rangeX ?? 120;
  const desiredX = t.x - targetDirX * (rangeX * HOMING_CONFIG.AIM_OFFSET_X_RATIO);
  const gapX = desiredX - p.x;
  const deadX = rangeX * HOMING_CONFIG.AIM_OFFSET_X_RATIO + HOMING_CONFIG.DEADZONE_X_MARGIN;
  if (Math.abs(t.x - p.x) > deadX) {
    p.x += gapX * HOMING_CONFIG.WINDUP_LERP_X * falloff;
  }
  // Z 補正：強めに寄せる（2.5D 圧縮軸の救済）。デッドゾーンは狭く
  if (Math.abs(dz) > HOMING_CONFIG.DEADZONE_Z_MARGIN) {
    p.z += dz * HOMING_CONFIG.WINDUP_LERP_Z * falloff;
  }
  // Y 補正：空中時のみ（コンボ繋がりやすさ優先・据置）
  if (!p.isGrounded) {
    const desiredY = t.y + HOMING_CONFIG.AIM_Y_OFFSET;
    const gapY = desiredY - p.y;
    if (Math.abs(gapY) > HOMING_CONFIG.DEADZONE_Y_MARGIN) {
      p.y += gapY * HOMING_CONFIG.WINDUP_LERP_Y * falloff;
    }
  }
}
