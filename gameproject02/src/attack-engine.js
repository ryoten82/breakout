// ============================================================
//  SCRAP BLITZ — attack-engine（分離 Phase: Step D-3-1）
//
//  プレイヤー側の攻撃フローコアを集約：
//    - startAttackById / Chain wrappers
//    - 強攻撃 / ステップ攻撃 / 必殺技の ID 選別 helpers
//    - updateAttack / updateHitConfirm（フレーム駆動）
//    - processAttackInput（J 入力 → チェーン継続 / バッファ）
//    - consumeAttackBuffer（hit_confirm 移行時のバッファ消化）
//    - matchCommand（dirHistory パターン照合）
//
//  ES Module として index.html から import される：
//    import {
//      initAttackEngine,
//      startAttackById, startAttackFromChain, startAttack, startAerialAttack,
//      pickStrongAttackId, startStrongAttack, pickStepAttackId,
//      updateAttack, updateHitConfirm,
//      matchCommand, pickSpecialAttackId,
//      processAttackInput, consumeAttackBuffer,
//    } from './src/attack-engine.js';
//
//  initAttackEngine(deps) で依存を一括注入：
//    - inp: (code) => bool   入力ポーリング関数
//    - dirMatchesForFacing: (dir, pat, facing) => bool   コマンドマッチ判定
//    - onUltEnd: (p) => void  ULT 終了演出のクリーンアップ（dome / camera / token 等）
//    - hitCtx: { enemies, enemyAttackToken, getFrame }  hit-engine 渡し用
// ============================================================

import { ATTACKS, Z_CHAIN, A_CHAIN } from './attacks.js';
import {
  STATE, applyHitInitialPitch,
  KB_LV05_BOUNCE_VY,
  ENEMY_DOWN_BOUND_FRAMES, ENEMY_AIRBORNE_Y_THRESHOLD,
  ENEMY_KB_AIR_FRAMES, ENEMY_KB02_FRAMES,
} from './states.js';
import { PHYSICS, SP_CONFIG, MEGA_CONFIG, ULT_CONFIG } from './config.js';
import {
  tryHitEnemies, tryHitEnemiesMultiHit,
  spawnHitParticles, bumpCombo, triggerHitstop, triggerShake,
} from './hit-engine.js';
import { isHitstunState, _cancelHitstunForReversal } from './damage-system.js';

let _inp = null;
let _dirMatchesForFacing = null;
let _onUltEnd = null;
let _hitCtx = null;
// 特殊技（Step D-3-2）で使用する外部参照
let _players = null;
let _enemies = null;
let _megaDarkenEl = null;
let _megaRing = null;
let _ultDarkenEl = null;
let _ultDome = null;
let _camera = null;
// 演出 let 変数群への get/set アクセス（index.html ローカル let のため）
//   fxRefs = { megaDarken, megaSlow, megaSlowCounter, megaRingProg,
//              ultDarken, ultDomeProg, ultSlowPhase, ultSlowAccum,
//              ultSlowFadeRemaining, ultCamSavedZoom, ultCamZoomFrames, ultCamZoomTotal }
let _fxRefs = null;

export function initAttackEngine(deps) {
  _inp = deps.inp;
  _dirMatchesForFacing = deps.dirMatchesForFacing;
  _onUltEnd = deps.onUltEnd;
  _hitCtx = deps.hitCtx;
  // D-3-2 で追加された依存
  _players = deps.players;
  _enemies = deps.enemies;
  _megaDarkenEl = deps.megaDarkenEl;
  _megaRing = deps.megaRing;
  _ultDarkenEl = deps.ultDarkenEl;
  _ultDome = deps.ultDome;
  _camera = deps.camera;
  _fxRefs = deps.fxRefs;
}

// ============================================================
//  攻撃発火（ID 直指定）
// ============================================================
export function startAttackById(p, id, chainIdx) {
  if (!ATTACKS[id]) return;
  p.state           = STATE.attacking;
  p.attackId        = id;
  p.attackChainIdx  = chainIdx;   // -1 = チェーン外（K など）
  // チェーン外攻撃（K 単発・必殺技 sp 系）開始時は attackChainArr を明示クリア
  //   持ち越し時の Z バッファ漏れ系バグ（consumeAttackBuffer が前のチェーンに合流する等）の予防
  //   startAttackFromChain 経由はこの後で chain を再代入するので問題ない
  if (chainIdx < 0) p.attackChainArr = null;
  p.stateTimer      = ATTACKS[id].duration;
  p.hitDelivered    = false;
  p.cancelTimer     = 0;
  p.attackBuffered  = false;
  // 連続ヒット技：敵ごとの次ヒット可能フレーム管理を毎攻撃ごとにリセット
  p.multiHitNextHit.clear();
  // 急降下技：発動時はホバー（vy=0）→ divePause F 後に急降下
  if (ATTACKS[id].diveVy !== undefined && !p.isGrounded) {
    p.vy = 0;
    p.diveCountdown = ATTACKS[id].divePause ?? 0;
  }
  // === プレイヤー自身のリフト（plyrLift*）===
  //   plyrLiftVx：facing 方向の airVx 初速。常に即時適用（離地時 or 後で離地した時に効く）
  //   plyrLiftVy：上昇 vy 初速。
  //     - plyrLiftVyDelay 未指定 / 0 → 発動瞬間に適用
  //     - plyrLiftVyDelay 指定 → updateAttack 内の elapsed === delay フレームで適用（粉塵昇竜パターン）
  //   ボルカニックヴァイパー的な「前進しながら昇る」/ 粉塵昇竜的な「前進→上昇」を表現
  if (ATTACKS[id].plyrLiftVx !== undefined) {
    p.airVx = p.facing * ATTACKS[id].plyrLiftVx;
  }
  const _plyrLiftDelay = ATTACKS[id].plyrLiftVyDelay ?? 0;
  if (ATTACKS[id].plyrLiftVy !== undefined && _plyrLiftDelay === 0) {
    p.vy = Math.max(p.vy, ATTACKS[id].plyrLiftVy);
    if (p.isGrounded) p.isGrounded = false;  // 地上発動なら離地
  }
  // 踏み込み攻撃：lungeVx 指定があれば facing 方向へ短時間前進
  // ステップ攻撃と違って tilt 等の特別演出はせず、純粋に前進運動量だけを与える
  p.lungeMomentum = ATTACKS[id].lungeVx ?? 0;
  // ステップ攻撃：ダッシュ運動量を引き継いで前進開始
  if (ATTACKS[id].isStepAttack) {
    p.stepMomentum = PHYSICS.DASH_SPEED_MULT;
    // 向きを dashDirX に固定（裏向きで突進する事故を防ぐ）
    if (p.dashDirX !== 0) p.facing = Math.sign(p.dashDirX);
  } else {
    p.stepMomentum = 0;
  }
  // 空中で攻撃を開始したらブースター窓を打ち切る
  // → キャンセルジャンプ後に空中Jなどに繋いだ際、SPACE 押しっぱなしで
  //   ブースト推力＋空中コンボの vy 床（AERIAL_HOP_V）が積み上がって
  //   上空にかっとんでしまう不具合を防ぐ
  if (!p.isGrounded) {
    p.thrustFramesLeft = 0;
    p.bigBurstTimer    = 0;
  }
}

// チェーン共通ラッパ（配列 + インデックスで ID 解決）
export function startAttackFromChain(p, chain, chainIdx) {
  const id = chain[chainIdx];
  if (!id) return;
  p.attackChainArr = chain;
  // 空中Jチェーン開始時：落下速度を少し抑制してふわっとさせる
  // ホップ本体はヒット確定時（tryHitEnemies）で敵と同時に適用する
  if (chain === A_CHAIN && !p.isGrounded) {
    if (p.vy < 0) p.vy *= 0.8;
  }
  startAttackById(p, id, chainIdx);
}
// 地上 J チェーン
export function startAttack(p, chainIdx) {
  startAttackFromChain(p, Z_CHAIN, chainIdx);
}
// 空中 J チェーン
export function startAerialAttack(p, chainIdx) {
  startAttackFromChain(p, A_CHAIN, chainIdx);
}

// 強攻撃（K）はチェーン外で発動
// 接地状態と方向入力で発動技を決定（空中は方向問わず c01_atk_l_01_air 一択）
export function pickStrongAttackId(p, upHeld, dnHeld) {
  if (!p.isGrounded) {
    if (dnHeld) return 'c01_atk_l_01_air_down';
    return 'c01_atk_l_01_air';
  }
  if (upHeld) return 'c01_atk_l_01_up';
  if (dnHeld) return 'c01_atk_l_01_down';
  return 'c01_atk_l_01';
}
export function startStrongAttack(p, upHeld, dnHeld) {
  // 現プロト：METEO 固定。将来キャラ別の k_viper / k_cannon / k_bastion に切り替え
  startAttackById(p, pickStrongAttackId(p, !!upHeld, !!dnHeld), -1);
}

// ステップ攻撃（地上ダッシュ中の J/K 派生）
// strong=false → c01_atk_s_01_step / strong=true → c01_atk_l_01_step
export function pickStepAttackId(p, strong) {
  return strong ? 'c01_atk_l_01_step' : 'c01_atk_s_01_step';
}

// ============================================================
//  攻撃フレーム駆動：ヒット判定発生・終了処理
//
//  ULT 終了時の演出クリーンアップは _onUltEnd(p) コールバックに委譲
//  （ultDome / camera / enemyAttackToken など index.html ローカル参照のため）
// ============================================================
export function updateAttack(p) {
  if (p.state !== STATE.attacking) return;
  const atk = ATTACKS[p.attackId];
  const elapsed = atk.duration - p.stateTimer;

  // === 遅延 plyrLiftVy 発火（粉塵昇竜パターン：前進フェーズ → 指定フレームで上昇）===
  if (atk.plyrLiftVy !== undefined &&
      atk.plyrLiftVyDelay !== undefined && atk.plyrLiftVyDelay > 0 &&
      elapsed === atk.plyrLiftVyDelay) {
    p.vy = Math.max(p.vy, atk.plyrLiftVy);
    if (p.isGrounded) p.isGrounded = false;
  }

  // === 空中必殺技のホップ：攻撃発生フレームで一度だけ適用 ===
  // 「パイルバンカー射出の反動」のような表現を狙うため、発動瞬間ではなく
  // hitFrame に到達したタイミングで vy / airVx を仕込む。
  // 適用条件：isSpecial + aerialHop + 空中。
  //   launchVy 持ち（sp_02_air 等）でも aerialHopVy が明示されていれば適用する
  //   （tryHitEnemies on-hit と同じ _customHop ルール）
  {
    const _customHop = atk?.aerialHopVy !== undefined;
    if (
      elapsed === atk.hitFrame &&
      atk.isSpecial && atk.aerialHop && !p.isGrounded &&
      (!atk.launchVy || _customHop)
    ) {
      const hopVy = atk.aerialHopVy ?? PHYSICS.AERIAL_HOP_V;
      p.vy = Math.max(p.vy, hopVy);
      if (atk.aerialHopVx !== undefined) {
        // facing 方向の符号付き初速。負値で「後方ホップ」（c01_sp_01_air 等）
        p.airVx = p.facing * atk.aerialHopVx;
      }
    }
  }

  // === ヒット判定発生中フレーム ===
  if (atk.isMultiHit) {
    // 連続ヒット技：hitFrame から hitInterval 間隔で hitCount 回ヒット
    // hits は明示的にカウントしてスケジュール（最後の 1 発が isLast）
    const sinceHitStart = elapsed - atk.hitFrame;
    const interval = atk.hitInterval ?? 6;
    const total = atk.multiHitCount ?? 4;
    if (sinceHitStart >= 0 && sinceHitStart % interval === 0) {
      const hitIdx = sinceHitStart / interval;
      if (hitIdx < total) {
        const isLast = (hitIdx === total - 1);
        const hit = tryHitEnemiesMultiHit(p, atk, isLast, _hitCtx);
        if (hit) {
          p.hitDelivered = true;
          // 中間ヒット中は stepMomentum / lungeMomentum を切らない（突進を続ける）
          // 最終ヒット時のみ止める（オーバーシュート防止）
          if (isLast) {
            if (atk.isStepAttack) p.stepMomentum = 0;
            if (atk.lungeVx !== undefined) p.lungeMomentum = 0;
          }
        }
      }
    }
  } else {
    // 単発ヒット（既存）
    if (
      !p.hitDelivered &&
      elapsed >= atk.hitFrame &&
      elapsed <  atk.hitFrame + atk.hitDuration
    ) {
      if (tryHitEnemies(p, atk, _hitCtx)) {
        p.hitDelivered = true;
        // ステップ攻撃のヒット時は前進運動量を即停止（ぶつかって止まる重量感）
        if (atk.isStepAttack) p.stepMomentum = 0;
        // 踏み込み攻撃のヒット時も同様：当てたら止まる（オーバーシュート抑止）
        if (atk.lungeVx !== undefined) p.lungeMomentum = 0;
      }
    }
  }

  p.stateTimer--;
  if (p.stateTimer <= 0) {
    // 攻撃終了
    const enterCancelWindow = p.hitDelivered && !atk.noCancelOnHit;
    if (enterCancelWindow) {
      p.aerialWhiffed   = false;
      p.state           = STATE.hit_confirm;
      p.cancelTimer     = atk.cancelWindow;
    } else {
      // 空振り or noCancelOnHit ヒット → wait01 復帰
      // 空中空振りのみ次の空中Jを封鎖して落下させる（aerialWhiffed）
      p.aerialWhiffed   = !p.hitDelivered && p.attackChainArr === A_CHAIN && !p.isGrounded;
      p.state           = STATE.wait01;
      p.attackChainIdx  = -1;
      p.attackId        = null;
    }
    // 攻撃終了で踏み込み運動量をクリア（次の攻撃 / 待機状態に持ち越さない）
    p.lungeMomentum = 0;
    // 必殺技の重複フラグもクリア（次の発動時に再判定する）
    p.specialIsDuplicate = false;
    // ステップ攻撃終了：ダッシュ状態は解除して再ダッシュ要求にする（連発抑止）
    if (atk.isStepAttack) {
      p.dashActive   = false;
      p.stepMomentum = 0;
      p.dashCooldown = PHYSICS.DASH_COOLDOWN;
    }
    // ULT 終了：演出完全リセット・無敵解除・全敵を強制解凍
    // ultDome / camera / enemyAttackToken のクリーンアップは index.html 側コールバックに委譲
    if (atk.isUlt) {
      p.ultActive  = false;
      p.invincible = false;
      p.ultFrames  = 0;
      _onUltEnd(p);
    }
  }
}

export function updateHitConfirm(p) {
  if (p.state !== STATE.hit_confirm) return;
  p.cancelTimer--;
  if (p.cancelTimer <= 0) {
    // 受付終了 → wait01 復帰・チェーンリセット
    p.state           = STATE.wait01;
    p.attackChainIdx  = -1;
    p.attackId        = null;
  }
}

// ============================================================
//  コマンド入力（dirHistory パターン照合）
//  pattern を履歴の終端から見つける（最長一致）
//  pattern の各要素は順序通り出現する必要あり（途中に他方向が挟まっても許容するか？
//  → 厳密に連続している必要あり）
// ============================================================
export function matchCommand(p, pattern) {
  const hist = p.dirHistory;
  const facing = p.facing || 1;
  let pi = pattern.length - 1;
  for (let i = hist.length - 1; i >= 0 && pi >= 0; i--) {
    const entry = hist[i];
    if (_dirMatchesForFacing(entry.dir, pattern[pi], facing)) {
      pi--;
    } else if (entry.dir === 'N') {
      // ニュートラルは無視（手を離す瞬間がコマンド成立を阻害しないよう）
      continue;
    } else {
      // 想定外の方向が混入 → 失敗
      return false;
    }
  }
  return pi < 0;
}

// 地上/空中の派生を自動選択：ATTACKS に <base>_air が存在すれば空中時はそちらを返す
//   例: pickSpecialAttackId('c01_sp_01', false) → 'c01_sp_01_air' （c01_sp_01_air が定義されていれば）
export function pickSpecialAttackId(baseId, isGrounded) {
  if (!isGrounded) {
    const airId = baseId + '_air';
    if (ATTACKS[airId]) return airId;
  }
  return baseId;
}

// ============================================================
//  J 入力 → チェーン継続 / バッファ
//  zKeyWasDown はモジュール内に閉じる（旧 index.html 内 let zKeyWasDown）
// ============================================================
let zKeyWasDown = false;
export function processAttackInput(p) {
  // エッジ検出変数は常に更新（早期 return で取り残されると状態解除後に誤検出になるため）
  const zPressed = _inp('KeyJ');
  const justPressed = zPressed && !zKeyWasDown;
  zKeyWasDown = zPressed;
  if (p.guarding || p.ultActive) return;  // ガード中・ULT中は攻撃不可
  if (p.state === STATE.grabbing) return; // グラブ中は processGrabInput 側で扱う
  if (!justPressed) return;

  if (p.state === STATE.wait01) {
    // 地上ダッシュ中の派生：ステップJ（スライディング）
    if (p.dashActive && p.isGrounded) {
      startAttackById(p, pickStepAttackId(p, false), -1);
      return;
    }
    // 地上 / 空中でチェーンを切り替え
    if (p.isGrounded) startAttack(p, 0);
    else if (!p.aerialWhiffed) startAerialAttack(p, 0);
    // aerialWhiffed 中は入力を無視して落下させる
  } else if (p.state === STATE.hit_confirm) {
    // c01_atk_s_01_step（ステップJ）ヒット後 → J で Jコンボ2発目（c01_atk_s_02）にキャンセル
    if (p.attackId === 'c01_atk_s_01_step') {
      startAttackFromChain(p, Z_CHAIN, 1);
      return;
    }
    if (p.attackChainIdx < 0) return; // K（チェーン外）後は何もしない
    // 同じチェーン配列を継続（地上 or 空中を自動維持）
    const chain = p.attackChainArr || Z_CHAIN;
    const next  = p.attackChainIdx + 1;
    if (next < chain.length) startAttackFromChain(p, chain, next);
  } else if (p.state === STATE.attacking) {
    p.attackBuffered = true;
  }
}

// ============================================================
//  #section mega-ult — メガクラッシュ / ULT（Step D-3-2 で分離）
// ============================================================

// 画面上に ULT 発動中のプレイヤーが居るか（マルチ対応見込み・誰かの ULT 中は他者の SP 技を遮断）
export function anyPlayerUlting() {
  for (const pp of _players) {
    if (pp.ultActive) return true;
  }
  return false;
}

export function triggerMegaCrash(p) {
  if (anyPlayerUlting()) return; // 自他問わず ULT 演出中はメガクラ発動不可
  if (p.sp < SP_CONFIG.MEGA_CRASH_COST) return; // SP 不足 → 不発
  // 既にメガクラ演出進行中なら多重発動を禁止
  //   - megaDarkenFade > 0: 暗転フェード中
  //   - megaSlowFrames > 0: スロー継続中
  //   - megaRingProgress 0<x<1: リング拡大中
  // これらが全て 0 / 完了するまで再発動不可（連打抑止）
  const _mDark = _fxRefs.megaDarken.get();
  const _mSlow = _fxRefs.megaSlow.get();
  const _mRing = _fxRefs.megaRingProg.get();
  if (_mDark > 0 || _mSlow > 0 || (_mRing > 0 && _mRing < 1)) return;
  // 被弾中だった場合は state を強制クリア（リバーサル発動）
  if (isHitstunState(p)) _cancelHitstunForReversal(p);
  p.sp -= SP_CONFIG.MEGA_CRASH_COST;
  // 演出中（スロー継続中）は完全無敵
  p.invincible = true;
  // 必殺技使用済 ID 集合を全解除（メガクラで全必殺技を再使用可に）
  p.specialUsedIds.clear();

  // --- 視覚演出 ---
  // 画面暗転：瞬時に DARKEN_ALPHA まで上げ、リング展開後にゆっくりフェードアウト
  _megaDarkenEl.style.opacity = String(MEGA_CONFIG.DARKEN_ALPHA);
  _fxRefs.megaDarken.set(MEGA_CONFIG.EXPAND_FRAMES + MEGA_CONFIG.DARKEN_FADE_OUT);
  // 球体起動：player みぞおち位置にスポーン、progress 0 から
  _megaRing.position.set(p.x, p.y + 100, p.z);
  _megaRing.visible = true;
  _fxRefs.megaRingProg.set(0.001);  // updateMegaCrashFX で進める

  // --- スローモーション ---
  _fxRefs.megaSlow.set(MEGA_CONFIG.SLOW_FRAMES);
  _fxRefs.megaSlowCounter.set(0);

  // --- AoE ヒット判定（プレイヤー中心・半径 MEGA_CONFIG.RADIUS）---
  // ATTACKS テーブルの c01_sp_mega01 を参照。atk_lv 2/2/5 で振り分け
  const attack = ATTACKS.c01_sp_mega01;
  for (const e of _enemies) {
    if (!e.isAlive) continue;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist > MEGA_CONFIG.RADIUS) continue;
    // ダメージ適用
    e.hp = Math.max(0, e.hp - attack.damage);
    e.hitFlashTimer = 7;
    e.frozenByUlt   = false;  // ULT 凍結解除（メガクラを ULT 中に発動した場合の安全側）
    // 外向きノックバック方向（プレイヤー中心からの dx 符号）
    const dir = dist > 0.1 ? Math.sign(dx) : (p.facing || 1);
    e.fallDir     = dir;
    e.knockbackVx = dir * (attack.knockback * 0.4);
    // === atk_lv 駆動の振り分け（標準 dispatch を簡略化）===
    const isDowned = (
      e.state === STATE.down_bas_start ||
      e.state === STATE.down_bas_loop ||
      e.state === STATE.down_bas_end
    );
    // kbTimeMult：この攻撃で発生したフリンチ/バウンド時間の倍率（メガクラは 2.0）
    const tMult = attack.kbTimeMult ?? 1.0;
    if (isDowned) {
      // ダウン中：lv5 → down_bound_start（拾い直し）
      e.state       = STATE.down_bound_start;
      e.vy          = KB_LV05_BOUNCE_VY;
      e.downTimer   = Math.round(ENEMY_DOWN_BOUND_FRAMES * tMult);
      e.knockbackVx = 0;
    } else if (e.y > ENEMY_AIRBORNE_Y_THRESHOLD) {
      // 空中敵：lv2 → knockback_air01
      e.state    = STATE.knockback_air01;
      e.downTimer = Math.round(ENEMY_KB_AIR_FRAMES * tMult);
      e.kbFromMega = true;   // 重力半減フラグ（knockback_air01 終了時にリセット）
    } else {
      // 地上敵：lv2 → knockback02（軽フリンチ・コンボ繋ぎ）
      e.state    = STATE.knockback02;
      e.downTimer = Math.round(ENEMY_KB02_FRAMES * tMult);
    }
    applyHitInitialPitch(e);
    // 演出
    spawnHitParticles(e.x, e.y + 60, e.z, attack.hitColor, attack.hitCount,
      { type: 'normal', dirX: dx, dirZ: dz });
    bumpCombo(e);  // コンボ継続
  }
  triggerHitstop(attack.hitstop);
  triggerShake(attack.shake, attack.shake * 2 + 4);
  // 空中メガクラ：プレイヤーも aerialHop（各空中攻撃と同じ・次の行動につなげやすく）
  if (!p.isGrounded) {
    p.vy = Math.max(p.vy, PHYSICS.AERIAL_HOP_V);
  }
  // バッファクリア（メガクラ発動時に command/charge をリセット — 現状簡易版）
  p.attackBuffered = false;
  p.kBuffered      = false;

  console.log('[MEGA CRASH] SP残:', p.sp.toFixed(1));
}

// メガクラ無敵解除：暗転フェードが終わったタイミング（演出終了 ≒ megaDarkenFade==0）で false
// ULT 中はそちらの管理に任せる
export function maybeReleaseMegaInvincibility(p) {
  if (!p.invincible) return;
  if (p.ultActive) return;                              // ULT 側で管理中
  if (_fxRefs.megaDarken.get() > 0) return;             // メガクラ演出継続中
  if (_fxRefs.megaSlow.get() > 0) return;               // スロー継続中
  p.invincible = false;
}

export function triggerUlt(p) {
  // 発動制限：空中不可 / ガード中不可
  // 自他問わず ULT 演出中は割り込み発動不可（マルチ対応見込み）
  if (anyPlayerUlting()) return;
  if (!p.isGrounded) return;
  if (p.guarding)   return;
  // 被弾中だった場合は state を強制クリア（リバーサル発動）
  if (isHitstunState(p)) _cancelHitstunForReversal(p);
  // 許可ステート：wait01 / attacking / hit_confirm（hit_confirm からキャンセル発動可）
  if (p.state !== STATE.wait01 &&
      p.state !== STATE.attacking &&
      p.state !== STATE.hit_confirm) return;
  if (p.sp < SP_CONFIG.ULT_COST) {
    // SP 不足: J+K+L 入力の場合はメガクラへフォールバック
    triggerMegaCrash(p);
    return;
  }
  p.sp -= SP_CONFIG.ULT_COST;
  // 必殺技使用済 ID 集合を全解除（ULT で全必殺技を再使用可に）
  p.specialUsedIds.clear();

  // 既存攻撃を強制終了して ULT に切替
  const ultAtk = ATTACKS.c01_sp_ult01;
  p.state          = STATE.attacking;
  p.attackId       = 'c01_sp_ult01';
  p.attackChainIdx = -1;
  p.stateTimer     = ultAtk.duration;
  p.hitDelivered   = false;
  p.cancelTimer    = 0;
  p.attackBuffered = false;
  p.kBuffered      = false;
  p.ultActive      = true;
  p.ultFrames      = ultAtk.duration;
  p.invincible     = true;

  // === 時間停止：画面上の全エネミー（および将来の味方）を凍結 ===
  // 最初のヒットを受けた敵だけが個別に解除される（tryHitEnemies 内）
  for (const e of _enemies) {
    if (e.isAlive) e.frozenByUlt = true;
  }

  // === 演出起動 ===
  _ultDarkenEl.style.opacity = String(ULT_CONFIG.DARKEN_ALPHA);
  _fxRefs.ultDarken.set(ultAtk.duration);  // 全体長そのままで管理し、終盤フェードアウト
  // ドーム：足元位置にスポーン、進度 0 から
  _ultDome.position.set(p.x, p.y + 10, p.z);
  _ultDome.visible = true;
  _fxRefs.ultDomeProg.set(0.001);
  // スロー：ヒット前はピーク（divisor=4）、ヒット後にフェードで通常速度へ
  _fxRefs.ultSlowPhase.set(1);
  _fxRefs.ultSlowAccum.set(0);
  _fxRefs.ultSlowFadeRemaining.set(0);
  // カメラズーム
  _fxRefs.ultCamSavedZoom.set(_camera.zoom);
  _fxRefs.ultCamZoomFrames.set(ULT_CONFIG.CAM_ZOOM_FRAMES);
  _fxRefs.ultCamZoomTotal.set(ULT_CONFIG.CAM_ZOOM_FRAMES);

  console.log('[ULT] c01_sp_ult01 起動・SP残:', p.sp.toFixed(1));
}

// バッファ消化（HIT_CONFIRM になった瞬間に Z バッファがあれば次段へ）
export function consumeAttackBuffer(p) {
  if (p.state === STATE.hit_confirm && p.attackBuffered) {
    p.attackBuffered = false;
    // チェーン外の攻撃（K 単発・必殺技 sp 系など attackChainIdx<0）からは J バッファで連鎖しない
    // processAttackInput の live J 入力でも同条件で return しているので整合を取る
    // ※これがないと sp_02 ヒット中 J 連打で地上 c01_atk_s_01 が起動し、空中ホップが消えて落下する
    if (p.attackChainIdx < 0) return;
    const chain = p.attackChainArr || Z_CHAIN;
    const next  = p.attackChainIdx + 1;
    if (next < chain.length) startAttackFromChain(p, chain, next);
  }
}
