// ============================================================
//  SCRAP BLITZ — hit-engine（分離 Phase: Step D-2a/b）
//
//  ヒット時の演出系を集約：パーティクル・ヒットストップ・シェイク。
//
//  ES Module として index.html から import される：
//    import {
//      initHitEngine,
//      fxState, particles,
//      triggerHitstop, triggerShake,
//      spawnHitParticles, spawnLaunchSmoke, updateParticles,
//    } from './src/hit-engine.js';
//
//  外部依存（THREE / scene）は initHitEngine(deps) で初期化時にバインド：
//    initHitEngine({ THREE, scene });
//
//  使用側の参照書き換え：
//    旧 hitstopTimer / shakeTimer / shakeStrength / shakeOffsetX / shakeOffsetY（let 個別変数）
//    新 fxState.hitstopTimer / fxState.shakeTimer / ... （オブジェクトプロパティ）
//    → 単一オブジェクトに集約することで ESM 経由でも参照を共有できる
// ============================================================

import {
  STATE, applyHitInitialPitch,
  ENEMY_FALL_FRAMES, ENEMY_DOWN_FRONT_FRAMES,
  ENEMY_DOWN_CHOU_FRAMES, ENEMY_DOWN_RAKKA_FRAMES, ENEMY_DOWN_BOUND_FRAMES,
  ENEMY_DOWN_BURST_START_FRAMES,
  ENEMY_KB01_FRAMES, ENEMY_KB02_FRAMES, ENEMY_KB_AIR_FRAMES, ENEMY_KB03_FRAMES,
  ENEMY_AIRBORNE_Y_THRESHOLD,
  KB_BURST_VY, KB_BURST_VX, KB_BURST_VX_DECAY, KB_BURST_SPIN_RATE, KB_BURST_GRAV_MULT,
  KB_LV03_VY, KB_LV03_VX_MULT,
  KB_LV05_VY, KB_LV05_VX_MULT, KB_LV05_BOUNCE_VY, KB_LV07_HOP_VY,
  KB_LV06_VY, KB_LV06_VX_MULT,
} from './states.js';
import {
  COMBO_LEVELS, getComboLevel,
  PHYSICS, SP_CONFIG, HOMING_CONFIG, DUMMY_ATK_CONFIG,
} from './config.js';
import { resolveAttackAttr } from './attacks.js';

let _THREE = null;
let _scene = null;
let _comboEl = null;
let _comboNumEl = null;
let _players = null;

export function initHitEngine(deps) {
  _THREE      = deps.THREE;
  _scene      = deps.scene;
  _comboEl    = deps.comboEl;
  _comboNumEl = deps.comboNumEl;
  _players    = deps.players;
}

// ============================================================
//  コンボ状態（hit-engine 内に集約）
// ============================================================
export const combo = {
  count:        0,
  lastHitEnemy: null,
};

export function bumpCombo(hitEnemy) {
  // コンボ初回ヒット：最初に殴った敵を各プレイヤーの comboTarget としてロック
  if (combo.count === 0) {
    for (const pp of _players) {
      pp.comboTarget = hitEnemy;
      pp.oppositeInputFrames = 0;
    }
  }
  combo.count += 1;
  combo.lastHitEnemy = hitEnemy;
  _comboEl.style.opacity = '1';
  _comboNumEl.textContent = combo.count;
  // レベルに応じた色・演出
  const lv = getComboLevel(combo.count);
  _comboNumEl.style.color = lv.numColor;
  _comboEl.dataset.level = COMBO_LEVELS.indexOf(lv);
  // ポップアニメ
  _comboNumEl.style.transform = 'scale(1.3)';
  setTimeout(() => { _comboNumEl.style.transform = 'scale(1)'; }, 80);
}

// 最後に殴った敵が wait01 に戻ったら（または不在になったら）コンボ終了
// ただしプレイヤーが攻撃継続中（attacking/hit_confirm）はコンボを保持
export function checkComboBreak() {
  const p = _players[0];
  // 空振りクリーンアップ
  if (combo.count === 0) {
    if (p && p.state !== STATE.attacking && p.state !== STATE.hit_confirm) {
      for (const pp of _players) {
        if (pp.specialUsedIds.size > 0) pp.specialUsedIds.clear();
        pp.comboTarget = null;
        pp.oppositeInputFrames = 0;
      }
    }
    return;
  }
  if (p && (p.state === STATE.attacking || p.state === STATE.hit_confirm)) return;
  const e = combo.lastHitEnemy;
  if (!e || e.state === STATE.wait01) {
    combo.count = 0;
    combo.lastHitEnemy = null;
    _comboEl.style.opacity = '0';
    for (const pp of _players) {
      pp.specialUsedIds.clear();
      pp.comboTarget = null;
      pp.oppositeInputFrames = 0;
    }
  }
}

// ============================================================
//  演出グローバル状態（let の代わりに単一オブジェクトに集約）
//  外部からは fxState.hitstopTimer のように直接読み書き可能
// ============================================================
export const fxState = {
  hitstopTimer: 0,
  shakeTimer:   0,
  shakeStrength: 0,
  shakeOffsetX: 0,
  shakeOffsetY: 0,
};

export function triggerHitstop(frames) {
  if (frames > fxState.hitstopTimer) fxState.hitstopTimer = frames;
}

export function triggerShake(strength, frames) {
  if (strength > fxState.shakeStrength) fxState.shakeStrength = strength;
  if (frames > fxState.shakeTimer) fxState.shakeTimer = frames;
}

// ============================================================
//  パーティクル系（ヒット火花・打ち上げ煙）
// ============================================================
export const particles = [];

// opts.type : 'normal'(攻撃方向放射) | 'launch'(Y軸上方) | 'slam'(叩きつけ放射) | 'omni'(全方向・旧来)
// opts.dirX / opts.dirZ : 攻撃方向（normal 時に使用・正規化不要）
export function spawnHitParticles(x, y, z, color = 0xffee44, count = 10, opts = {}) {
  const { type = 'omni', dirX = 1, dirZ = 0 } = opts;
  const geom = new _THREE.BoxGeometry(7, 7, 7);

  // 攻撃方向の正規化と垂直ベクトル（XZ平面）
  const dLen = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
  const nx = dirX / dLen;
  const nz = dirZ / dLen;
  const perpX = -nz;   // XZ平面での垂直方向
  const perpZ =  nx;

  for (let i = 0; i < count; i++) {
    const mat = new _THREE.MeshBasicMaterial({ color });
    const mesh = new _THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    _scene.add(mesh);

    let vx, vy, vz;
    const r = Math.random;

    if (type === 'normal') {
      // 攻撃方向に前方コーンで放射（前方強め + 左右散らし + 上方向小さめ）
      const fwd = 7 + r() * 9;
      const lat = (r() - 0.5) * 11;
      vx = nx * fwd + perpX * lat;
      vz = nz * fwd + perpZ * lat;
      vy = 0.5 + r() * 3;
    } else if (type === 'launch') {
      // 打ち上げ：Y軸上方向に強く広がる
      vx = (r() - 0.5) * 8;
      vy = 9 + r() * 13;
      vz = (r() - 0.5) * 8;
    } else if (type === 'slam') {
      // 叩きつけ：XZ全方向に放射 + わずかに下方向（地面への叩き落とし感）
      const angle = r() * Math.PI * 2;
      const speed = 5 + r() * 8;
      vx = Math.cos(angle) * speed;
      vz = Math.sin(angle) * speed;
      vy = -(r() * 4);
    } else {
      // omni（全方向・旧来動作）
      vx = (r() - 0.5) * 14;
      vy = 4 + r() * 10;
      vz = (r() - 0.5) * 14;
    }

    particles.push({ mesh, vx, vy, vz, life: 22 + r() * 10 });
  }
}

// 打ち上げヒット時の足元から吹き上がる土煙エフェクト
export function spawnLaunchSmoke(x, y, z) {
  const count = 30;
  for (let i = 0; i < count; i++) {
    const col = Math.random() > 0.5 ? 0xeedd99 : 0xfff4cc; // 土埃・砂煙
    const size = 12 + Math.random() * 10;
    const geom = new _THREE.BoxGeometry(size, size, size);
    const mat  = new _THREE.MeshBasicMaterial({ color: col });
    const mesh = new _THREE.Mesh(geom, mat);
    // 足元から少し散らしてスポーン
    mesh.position.set(
      x + (Math.random() - 0.5) * 50,
      y + Math.random() * 20,
      z + (Math.random() - 0.5) * 25
    );
    _scene.add(mesh);
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 5,
      vy: 12 + Math.random() * 18,  // 強い上方向
      vz: (Math.random() - 0.5) * 5,
      life: 32 + Math.random() * 14,
    });
  }
}

// ============================================================
//  敵被弾判定（Step D-2c-1）
//
//  index.html から ctx を受け取って動作：
//    ctx = { enemies, enemyAttackToken: { get, set } }
//
//  enemyAttackToken は index.html 側のグローバル let を保持するため
//  関数引数経由で getter/setter を渡す。
// ============================================================
export function tryHitEnemies(p, attack, ctx) {
  const { enemies, enemyAttackToken } = ctx;
  const facing = p.facing;
  let anyHit = false;
  for (const e of enemies) {
    if (!e.isAlive) continue;
    // down_burst_* 中は完全無敵：判定もダメージも一切受けない
    if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) continue;
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    // 前方判定（omni 攻撃は全方向ヒット）
    // 真正面（dx=0）も拾えるよう「逆方向だけ弾く」判定に変更（旧 sign !== facing は dx=0 で空振り）
    if (!attack.omni && Math.sign(dx) === -facing) continue;
    // === ホーミング当たり判定拡張 ===
    // comboTarget 本人だけ rangeX / rangeZ にボーナスを乗せて
    // 「ぎりぎり外れた」攻撃を「届いた」扱いに（さりげなさのため）
    const _isLockedTarget = (e === p.comboTarget);
    const _bonusX = _isLockedTarget ? HOMING_CONFIG.HIT_RANGE_BONUS_X : 0;
    const _bonusZ = _isLockedTarget ? HOMING_CONFIG.HIT_RANGE_BONUS_Z : 0;
    if (Math.abs(dx) > attack.rangeX + _bonusX) continue;
    if (Math.abs(dz) > attack.rangeZ + _bonusZ) continue;
    // Y軸判定（非対称：上方向 rangeY / 下方向 rangeYDown ≥ rangeY）
    if (attack.rangeY !== undefined) {
      const dy = e.y - p.y;          // 正:敵が上 / 負:敵が下
      const maxDown = attack.rangeYDown ?? attack.rangeY;
      if (dy >  attack.rangeY) continue;
      if (dy < -maxDown)       continue;
    }
    // ダウン中の敵に対しては lv05 / lv07 のみヒット判定（その他は空振り）
    {
      const _downedForWhiff = (
        e.state === STATE.down_bas_start ||
        e.state === STATE.down_bas_loop ||
        e.state === STATE.down_bas_end
      );
      if (_downedForWhiff) {
        const _lv = (attack.atk_lv_down !== undefined)
          ? attack.atk_lv_down
          : (attack.atk_lv ?? 1);
        if (_lv !== 5 && _lv !== 7) continue;  // 空ぶる
      }
    }
    // ヒット
    e.hp = Math.max(0, e.hp - attack.damage);
    e.hitFlashTimer = 7;
    e.frozenByUlt   = false;  // ULT 凍結解除（ヒットを受けた敵だけ時間が進み始める）
    // 被弾時：倒れ方向を記録。IDLEのみ向きスナップ（FALL/DOWN/RISE中は回転競合のため不変）
    e.fallDir = (e.x !== p.x) ? Math.sign(e.x - p.x) : p.facing;
    if (e.state === STATE.wait01) {
      e.mesh.rotation.y = -e.fallDir * Math.PI / 2;
    }
    e.knockbackVx   = facing * (attack.knockback * 0.4);
    const resolved = resolveAttackAttr(attack);
    // ====================================================================
    //  重複必殺技ヒット：敵を down_burst_* に強制遷移（完全無敵スピン離脱）
    //  - ダメージは通常通り入る（既に上で適用済み）
    //  - lv 振り分けはスキップ・通常ステートには遷移させない
    //  - +1 コンボしてから自然消滅（着地で down_bas_start に合流）
    // ====================================================================
    if (attack.isSpecial && p.specialIsDuplicate) {
      // 後方斜め上に吹き飛び・facing と反対方向（プレイヤーから離れる）
      e.vy            = KB_BURST_VY;
      e.knockbackVx   = facing * KB_BURST_VX;          // facing 方向 = プレイヤーから遠ざかる
      e.kbDecay       = KB_BURST_VX_DECAY;
      e.state         = STATE.down_burst_start;
      e.downTimer     = ENEMY_DOWN_BURST_START_FRAMES;
      e.burstSpinRate = KB_BURST_SPIN_RATE;             // ロール累積レート
      e.burstGravMult = KB_BURST_GRAV_MULT;             // 重力軽減で滞空延長
      e.burstRollAngle = 0;                             // ロール角を 0 から開始
      e.peakHangTimer    = 0;
      e.launcherAirborne = false;
      applyHitInitialPitch(e);
      // 演出（通常ヒットエフェクト）
      spawnHitParticles(e.x, e.y + 60, e.z, attack.hitColor ?? 0xffffff,
        attack.hitCount ?? 24, { type: 'omni' });
      // コンボ +1（その後敵が wait01 に戻るまで切断されない）
      bumpCombo(e);
      triggerHitstop(attack.hitstop);
      triggerShake(attack.shake, attack.shake * 2 + 4);
      anyHit = true;
      continue;  // 通常 dispatch ツリーをスキップ
    }
    const _isAnyDowned = (
      e.state === STATE.down_bas_start ||
      e.state === STATE.down_bas_loop ||
      e.state === STATE.down_bas_end
    );
    if (_isAnyDowned) {
      // === ダウン中ヒット（最優先・lv05/lv07 のみ到達）===
      // lv05（叩きつけ）→ down_bound_start（バウンド優先・rakka スキップ）
      // lv07（拾い）→ knockback03（ダウン状態維持で少し浮く）→ 45F 後 down_bas_loop
      // ※その他 lv はダメージ前段で空振りチェック済み
      const lv = (attack.atk_lv_down !== undefined)
        ? attack.atk_lv_down
        : (attack.atk_lv ?? 1);
      if (lv === 5) {
        e.state       = STATE.down_bound_start;
        e.vy          = KB_LV05_BOUNCE_VY;
        e.downTimer   = ENEMY_DOWN_BOUND_FRAMES;
        e.knockbackVx = 0;
      } else if (lv === 7) {
        e.state       = STATE.knockback03;
        e.downTimer   = ENEMY_KB03_FRAMES;
        e.vy          = KB_LV07_HOP_VY;   // 小バウンド（ダウン姿勢のまま少し浮く）
        e.knockbackVx = 0;
      }
    } else if (
      attack.launchVy && (attack.atk_lv ?? 1) !== 5 &&
      // 連続打ち上げ抑止：空中敵 × atk_lv_air 定義あり の場合は通常 lv dispatch を優先
      // （既に浮いてる敵を更に打ち上げると無限コンボ化するため）
      // ただし必殺技（isSpecial）は specialUsedIds で 1 コンボ 1 回制限が掛かっているため
      // 抑止を解除して空中敵にも launchVy が効くようにする（例：c01_sp_02_air は空中追撃で再打ち上げ可）
      (attack.isSpecial || !(e.y > ENEMY_AIRBORNE_Y_THRESHOLD && attack.atk_lv_air !== undefined))
    ) {
      // 既存パス：lv04（打ち上げ）のみ。lv05 は down_rakka_start へ振る
      e.vy = attack.launchVy;
      e.launcherAirborne = !!resolved.peakHang; // LAUNCH_COMBO属性のみ頂点スロー有効
      e.state    = STATE.down_up_start;
      e.downTimer = ENEMY_FALL_FRAMES;  // タイマー駆動：0→π/2 のランプ用
      // tiltAngle は STATE_TILT_TARGET 系で計算されるので明示設定不要
      // rotation.yは維持（左右向きを保ったまま倒れる）
      spawnLaunchSmoke(e.x, e.y, e.z);
      p.homingTarget = e;  // キャンセルジャンプ時のホーミング対象として記録
    } else if (
      e.state === STATE.wait01 ||
      e.state === STATE.knockback01 ||
      e.state === STATE.knockback02 ||
      e.state === STATE.knockback03 ||
      e.state === STATE.knockback_air01 ||
      e.state === STATE.fall_loop ||
      e.state === STATE.land ||
      e.state === STATE.down_up_start ||
      e.state === STATE.down_up_loop ||
      e.state === STATE.down_rakka_start ||
      e.state === STATE.down_rakka_loop ||
      e.state === STATE.down_bound_start ||
      e.state === STATE.enemy_attacking  // Phase 2.4：敵 AI 攻撃中もカウンター被弾を受け付ける
    ) {
      // 敵 AI 攻撃中の被弾：AI 内部状態をクリーンアップしてからフリンチへ遷移
      if (e.state === STATE.enemy_attacking) {
        e.atkPhase     = null;
        e.atkTimer     = 0;
        e.atkCooldown  = DUMMY_ATK_CONFIG.cooldownFrames;
        e.hitDelivered = false;
        if (enemyAttackToken.get() === e) enemyAttackToken.set(null);  // トークン解放
      }
      // === atk_lv 駆動の被弾ステート振り分け ===
      // 再発火許可ステート：
      //  - wait01（初動）
      //  - knockback*（フリンチ系・タイマーリフレッシュでコンボ持続）
      //  - fall_loop / land（空中→落下→着地モーション中も拾う）
      //  - down_up_start / down_up_loop（**打ち上げ juggle 中の追撃でフリンチへ移行**）
      // 再発火しない（既存ダウン保護）：
      //  - down_front_* / down_chou_* / down_wall_* / down_roll_* / down_bas_*
      // 実効 lv：敵が空中（y > しきい値）かつ atk_lv_air が定義されていれば優先（例: c01_atk_l_01_air は空中ヒットで lv06）
      // しきい値で接地寸前の敵を地上扱いに固定し、バウンド瞬間や微小 y 値で誤って空中ルートに入るのを防ぐ
      const lv = (e.y > ENEMY_AIRBORNE_Y_THRESHOLD && attack.atk_lv_air !== undefined)
        ? attack.atk_lv_air
        : (attack.atk_lv ?? 1);
      if (lv === 6) {
        // 超吹き飛ばし — 専用ステート down_chou_start（地上/空中共用）
        // 着地で down_roll_start、壁ヒットで down_wall_start に強制遷移
        // 攻撃側で kb_vy_lv6 / kb_vx_mult_lv6 / kb_vx_decay_lv6 を上書き可能（lv6 専用）
        // フォールバック：legacy 共通フィールド kb_vy / kb_vx_mult / kb_vx_decay → 既定 KB_LV06_*
        e.vy           = attack.kb_vy_lv6 ?? attack.kb_vy ?? KB_LV06_VY;
        e.knockbackVx *= attack.kb_vx_mult_lv6 ?? attack.kb_vx_mult ?? KB_LV06_VX_MULT;
        e.kbDecay      = attack.kb_vx_decay_lv6 ?? attack.kb_vx_decay ?? 0.78;
        e.state       = STATE.down_chou_start;
        e.downTimer    = ENEMY_DOWN_CHOU_FRAMES;
      } else if (lv === 5) {
        // 叩きつけ — 真下に高速落下、着地で 1回バウンド
        // 連鎖抑止ガード（§4.1c）：叩きつけシーケンス中（rakka_start/_loop または
        // bound_start バウンド最中）の再ヒットは新 rakka を発火させず、
        // 通常吹き飛び（down_front_start）に降格させて 1 コンボ 1 回の叩きつけを維持
        const inSlamSequence = (
          e.state === STATE.down_rakka_start ||
          e.state === STATE.down_rakka_loop  ||
          e.state === STATE.down_bound_start
        );
        if (inSlamSequence) {
          e.vy           = KB_LV03_VY;
          e.knockbackVx *= KB_LV03_VX_MULT;
          e.state        = STATE.down_front_start;
          e.downTimer    = ENEMY_DOWN_FRONT_FRAMES;
        } else {
          // 攻撃側で kb_vy_lv5 / kb_vx_mult_lv5 を上書き可能（lv5 専用）
          // フォールバック：legacy 共通フィールド kb_vy / kb_vx_mult → 既定 KB_LV05_*
          e.vy           = attack.kb_vy_lv5 ?? attack.kb_vy ?? KB_LV05_VY;
          e.knockbackVx *= attack.kb_vx_mult_lv5 ?? attack.kb_vx_mult ?? KB_LV05_VX_MULT;
          e.state        = STATE.down_rakka_start;
          e.downTimer    = ENEMY_DOWN_RAKKA_FRAMES;
        }
      } else if (lv === 3) {
        // 吹き飛び（汎用後方ブロー）
        e.vy           = KB_LV03_VY;
        e.knockbackVx *= KB_LV03_VX_MULT;
        e.state       = STATE.down_front_start;
        e.downTimer    = Math.round(ENEMY_DOWN_FRONT_FRAMES * (attack.kbTimeMult ?? 1.0));
      } else if (e.y > ENEMY_AIRBORNE_Y_THRESHOLD) {
        // lv01/lv02 空中ヒット → knockback_air01 → fall_loop → land → wait01
        e.state    = STATE.knockback_air01;
        e.downTimer = Math.round(ENEMY_KB_AIR_FRAMES * (attack.kbTimeMult ?? 1.0));
        e.kbFromMega = false;  // 通常ヒット時はメガクラフラグをクリア
      } else if (lv === 2) {
        e.state    = STATE.knockback02;
        e.downTimer = Math.round(ENEMY_KB02_FRAMES * (attack.kbTimeMult ?? 1.0));
      } else {
        // lv01 / それ以外（未指定）地上 → knockback01
        e.state    = STATE.knockback01;
        e.downTimer = Math.round(ENEMY_KB01_FRAMES * (attack.kbTimeMult ?? 1.0));
      }
      applyHitInitialPitch(e);
    }
    // 空中の敵へのヒット：敵もホップで浮遊継続(非打ち上げ技共通・地上技でも適用)
    // ※叩きつけ/吹き飛ばし系はホップで vy を上書きされたくないので除外
    //   対象：down_chou_start（lv6）／ down_front_start（lv3）／ down_rakka_*（lv5・kb_vy 維持必須）
    //   ／ down_bound_start（バウンド上向き vy 維持）
    const _slamState = (
      e.state === STATE.down_chou_start  ||
      e.state === STATE.down_front_start ||
      e.state === STATE.down_rakka_start ||
      e.state === STATE.down_rakka_loop  ||
      e.state === STATE.down_bound_start
    );
    if (e.y > 0 && !attack.launchVy && !_slamState) {
      // Math.max をやめて直接セット → 打ち上げ余剰vy を持ち越させない
      e.vy = PHYSICS.AERIAL_HOP_V;
      e.peakHangTimer    = 0; // 頂点スロー強制解除
      e.launcherAirborne = false;
      // 敵が空中ならプレイヤーをY引き寄せ（同期感）
      if (attack.aerialHop && !p.isGrounded) {
        e.y += (p.y - e.y) * PHYSICS.AERIAL_Y_PULL;
      }
    } else if (_slamState) {
      // 叩きつけ系：頂点スローと launcherAirborne だけ解除（vy は dispatch 値を維持）
      e.peakHangTimer    = 0;
      e.launcherAirborne = false;
    }
    // 軽い浮かせ（pop）：attack.knockbackY が定義されていれば、launcher / slam 系を
    // 除いた lv 振り分け（lv01/02 等のフリンチ系）に上昇速度を追加する。
    // 例：c01_atk_l_01_up は lv02 軽フリンチ + 斜め上の浮きでコンボ始動として使う。
    // launchVy 持ち（lv04 等）は既に強い上昇速度が入っているので、Math.max で潰さない。
    if (attack.knockbackY !== undefined && !_slamState) {
      e.vy = Math.max(e.vy, attack.knockbackY);
      e.peakHangTimer    = 0;
      e.launcherAirborne = false;
    }
    // プレイヤーの空中ホップ：攻撃側に aerialHop:true が立っている技で発動
    // 対象：c01_atk_s_01_air / 02_air / 03_air / c01_atk_l_01_air（aerialHop 持ち全般）
    // Math.max で「下降中なら浮き直す／上昇中はそのまま」→ cancel jump 直後の上昇vyを潰さない
    // - launcher 系（launchVy あり）は通常ホップ対象外だが、aerialHopVy が明示指定されている時は強制適用
    //   （例：c01_sp_02 を空中ヒットさせて、打ち上げた敵を上から拾うためにホップしたい）
    const _customHop = attack.aerialHopVy !== undefined;
    if (attack.aerialHop && !p.isGrounded && (!attack.launchVy || _customHop)) {
      const hopVy = attack.aerialHopVy ?? PHYSICS.AERIAL_HOP_V;
      p.vy = Math.max(p.vy, hopVy);
    }
    // 演出
    triggerHitstop(attack.hitstop);
    triggerShake(attack.shake, attack.shake * 2 + 4);
    // ヒット演出：攻撃ごとに色・パーティクル数を変える（差別化）
    const hitColor = attack.hitColor ?? 0xffee44;
    const hitCount = attack.hitCount ?? 10;
    // パーティクルタイプ：attack.particleType が明示されていれば優先、なければ launchVy 符号で自動判定
    const _lvy = attack.launchVy ?? 0;
    const _pType = attack.particleType ?? (_lvy > 0 ? 'launch' : _lvy < 0 ? 'slam' : 'normal');
    spawnHitParticles(e.x - dx * 0.4, e.y + 80, e.z, hitColor, hitCount,
      { type: _pType, dirX: dx, dirZ: 0 });
    bumpCombo(e);
    // SP 獲得：attack.noSpGain で個別オプトアウト可（ULT 等の自己回復ループ防止用）
    if (!attack.noSpGain) {
      p.sp = Math.min(SP_CONFIG.MAX, p.sp + SP_CONFIG.GAIN_ON_HIT);
    }
    anyHit = true;
  }
  return anyHit;
}

// 毎フレームの粒子更新（位置進行・寿命減・スケール縮小・消滅）
export function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.vy -= 0.7;
    p.life--;
    const lifeRatio = Math.max(0, p.life / 22);
    p.mesh.scale.setScalar(lifeRatio);
    if (p.life <= 0 || p.mesh.position.y < 0) {
      _scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}
