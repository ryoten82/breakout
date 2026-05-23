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
  ENEMY_DOWN_SUPER_FRAMES, ENEMY_DOWN_RAKKA_FRAMES, ENEMY_DOWN_BOUND_FRAMES,
  ENEMY_DOWN_BURST_START_FRAMES,
  ENEMY_KB01_FRAMES, ENEMY_KB02_FRAMES, ENEMY_KB_AIR_FRAMES, ENEMY_KB03_FRAMES,
  ENEMY_STAGGER_FRAMES, ENEMY_BLOCK_HIT_FRAMES,
  ENEMY_AIRBORNE_Y_THRESHOLD,
  KB_BURST_VY, KB_BURST_VX, KB_BURST_VX_DECAY, KB_BURST_SPIN_RATE, KB_BURST_GRAV_MULT,
  KB_LV03_VY, KB_LV03_VX_MULT,
  KB_LV05_VY, KB_LV05_VX_MULT, KB_LV05_BOUNCE_VY, KB_LV07_HOP_VY,
  KB_LV06_VY, KB_LV06_VX_MULT,
} from './states.js';
import {
  COMBO_LEVELS, getComboLevel,
  PHYSICS, SP_CONFIG, HOMING_CONFIG, ENEMY_ATTACKS, SPECIAL_CONFIG, SAME_ATK_CONFIG, CRIT_CONFIG, ENEMY_REACT_CONFIG, MIDBOSS_SHIELD_CONFIG, REPULSE_CONFIG,
} from './config.js';
import { resolveAttackAttr } from './attacks.js';
import { handleEnemyDyingHit, enterEnemyDyingBurst, triggerShieldBreak } from './enemy-system.js';
import { spawnDamageNumber, spawnBanner } from './hud-system.js';

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
  framesSinceLastHit: 0,   // 直近ヒットからの経過 F（タイムアウト break 用）
  burstHudFrames: 0,       // burst 発火直後に大きく BURST 表示するための残 F（HUD 用・180=3s）
  burstHudRoute:  null,    // burst 発火瞬間の route スナップショット
  burstHudReason: null,    // 'loop' / 'sp_dup'：HUD の枠色判定に使う
  burstHudSpBaseId: null,  // sp_dup 由来時の必殺技 base id（同 id 履歴を青枠で囲うため）
  burstHudLoopLen: 0,      // loop 由来時のループ長（L 単位で赤枠を区切るため）
  lastNonEmptyRoute: null, // 直近の非空 route のスナップショット（コンボ break 時の HUD 用）
  aggregateRoute: [],      // プレイヤー視点の集約 route（ターゲット切替を跨いで継続・1 攻撃 1 エントリ）
  resetBannerFrames: 0,    // burst 中にメガクラを当てた際の COMBO RESET バナー残 F（180=3s）
};

// コンボルート ループ検出：同じパターン（長さ 1〜MAX_LOOP_LEN）が 3 回連続で繰り返されたら burst。
//   例：「空中 J1 → 空中 J2 → 立ち J1」を 3 回繰り返すと検出。
//   ヒット数では制限しない（工夫で 30+ ヒットも狙える設計）が、純粋なループだけ確実に切る。
const COMBO_LOOP_MAX_LEN = 8;   // 検出する最大ループ長
const COMBO_LOOP_REPEAT  = 3;   // この回数連続で同パターン → burst
// 必殺技 同 baseId 使用上限（敵 1 体に対する累計使用回数・超過した次ヒットで burst）
const SPECIAL_USE_LIMIT  = 3;   // 2026-05-20: 2→3 に拡張（旧 Set だと実質 1 で burst だったため Map 化）
// 飛行系状態（down_super_* / down_wall_*）への突入回数上限・超過した次回突入で burst
const FLIGHT_BURST_LIMIT = 3;   // 2026-05-20: 旧 2 → 3 に拡張、かつ lateralCombatInvincible → burst に統一
// 敵を down_burst_start 状態に遷移させる共通ヘルパ（2026-05-20 切り出し）。
//   ループ系制限（必殺技ループ／壁ヒット上限／超吹っ飛ばし上限／aggregate ループ）と
//   ULT の forceBurstDown など、複数箇所から再利用する。
//   FX（hitstop/shake/particle）と HUD 更新はトリガ側の責務（必要な情報を持っているため）。
export function triggerBurstState(e, facing) {
  e.vy            = KB_BURST_VY;
  e.knockbackVx   = facing * KB_BURST_VX;
  e.kbDecay       = KB_BURST_VX_DECAY;
  e.state         = STATE.down_burst_start;
  e.downTimer     = ENEMY_DOWN_BURST_START_FRAMES;
  e.burstSpinRate = KB_BURST_SPIN_RATE;
  e.burstGravMult = KB_BURST_GRAV_MULT;
  e.burstRollAngle = 0;
  e.peakHangTimer    = 0;
  e.launcherAirborne = false;
  e.burstFlashTimer  = Math.round(SPECIAL_CONFIG.FLASH_FRAMES * 1.5);
  applyHitInitialPitch(e);
}

// 末尾 L 個の attack id 配列が直前の L 個（×REPEAT-1 セット）と一致するか判定。
//   一致するループ長を返す（無ければ 0）。最短ループを優先（L=1 から走査）。
//   メガクラッシュ（_sp_mega）は意図的な「リセット」要素なので、最後の MC より前は検出対象外。
//   MC を跨いだループは loop 扱いにしない（プレイヤーがコンボリセットを挟めば免責）。
export function detectComboLoop(route) {
  const N = route.length;
  // 最後の MC 位置を探し、それ以降の subroute のみで検出
  let postMC = 0;
  for (let i = N - 1; i >= 0; i--) {
    if (route[i] && route[i].includes('_sp_mega')) { postMC = i + 1; break; }
  }
  const subLen = N - postMC;
  const maxLen = Math.min(COMBO_LOOP_MAX_LEN, Math.floor(subLen / COMBO_LOOP_REPEAT));
  for (let L = 1; L <= maxLen; L++) {
    let match = true;
    let containsGrabPunch = false;
    for (let i = 0; i < L && match; i++) {
      const base = route[N - 1 - i];
      // つかみ中の打撃（連打で簡単にループするため）はループ検出対象外。
      // パターン自体に含まれていればそのループ長は無効扱い。
      if (base === 'grab_punch_s' || base === 'grab_punch_l') {
        containsGrabPunch = true; break;
      }
      for (let r = 1; r < COMBO_LOOP_REPEAT; r++) {
        const idx = N - 1 - r * L - i;
        if (idx < postMC) { match = false; break; }   // MC 境界を跨がない
        if (route[idx] !== base) { match = false; break; }
      }
    }
    if (match && !containsGrabPunch) return L;
  }
  return 0;
}
// コンボ最大空白：直近ヒットから N F 経過したらプレイヤー状態に関わらず強制 break
//   通常 J/K キャンセルは 10-20F 以内に次ヒット成立するので 90F でも十分安全マージン。
//   50→90F：地上 mega の knockback02（kbTimeMult 2.0 適用で 70F）を完走させてから
//   state-based break に拾わせる（target が長時間ロックされた状態を活かす）。
//   SP02 無限ループは敵単位 specialHitBy（1 コンボ 1 回制限）で別途抑止済みなので影響なし。
const COMBO_MAX_GAP_FRAMES = 90;

// コンボ break 対象の「起き上がり／復帰」ステート集合：
//   それぞれのやられルートが「立ち上がり」アニメに入った瞬間にコンボを切る。
//   wait01 までは待たず尺を詰めるため、起き上がり再生開始でリセット。
//   knockback01/02 は専用「起き上がり」ステートを持たず直接 wait01 へ行くので、
//   保険として wait01 も break 条件に維持する（checkComboBreak 側で or 評価）。
//   起き上がり：全ダウンルートが down_bas_loop → down_bas_end → wait01 に合流するため down_bas_end が網羅的
//   着地復帰：fall_loop → land → wait01 のパス用
//   保険：knockback01/02 → 直 wait01 経路
const COMBO_BREAK_STATES = new Set([
  STATE.down_bas_end,
  STATE.land,
  STATE.wait01,
]);

export function bumpCombo(hitEnemy) {
  // コンボ初回ヒット：最初に殴った敵を各プレイヤーの comboTarget としてロック。
  // また、コンボ継続中でも comboTarget が解除済（距離超過・反対入力で null になった等）
  // のプレイヤーには今ヒットした敵を再ロックする。これにより mega/ULT 等の AoE 攻撃が
  // ターゲット復活のチャンスになり、ヒット後の追撃ホーミングが効きやすくなる（2026-05-16）。
  // ただしゴアクリ armed 中の敵は再ロック対象外（追撃禁止・2026-05-18）。
  const _armed = hitEnemy && hitEnemy.goreCritical && hitEnemy.goreCritical.armed;
  for (const pp of _players) {
    if (!pp.comboTarget && !_armed) {
      pp.comboTarget = hitEnemy;
      pp.oppositeInputFrames = 0;
    }
  }
  combo.count += 1;
  combo.lastHitEnemy = hitEnemy;
  combo.framesSinceLastHit = 0;
  // route スナップショット更新（コンボ break 時に "直前の最終 route" を HUD で 3 秒保持するため）
  if (combo.aggregateRoute.length > 0) {
    combo.lastNonEmptyRoute = combo.aggregateRoute.slice();
  }
  // burst HUD 表示中に新ヒットが来たら即座に HUD を畳んで新しい route 表示へ移す
  //   （burst を呼び出した bumpCombo そのものはまだ burstHudFrames=0 なのでこの分岐に入らない）
  if (combo.burstHudFrames > 0) {
    combo.burstHudFrames = 0;
    combo.burstHudRoute = null;
    combo.burstHudReason = null;
    combo.burstHudSpBaseId = null;
    combo.burstHudLoopLen = 0;
  }
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
//   opts.megaSlow=true なら state による break をスキップ（mega 後のスロー中はコンボ繋ぎ補助）
export function checkComboBreak(opts) {
  const _megaSlow = !!(opts && opts.megaSlow);
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
  // ヒット空白カウンタ：bumpCombo で 0 リセットされる
  combo.framesSinceLastHit++;
  // タイムアウト強制 break：プレイヤー攻撃中でも、最後のヒットから COMBO_MAX_GAP_FRAMES 超でリセット
  //   SP02 → ダウン → 起き上がり → SP02 のような無限ループを切るための保険。
  //   通常キャンセル（10-20F 内に次ヒット）は影響を受けない。
  const _timedOut = combo.framesSinceLastHit > COMBO_MAX_GAP_FRAMES;
  if (!_timedOut && p && (p.state === STATE.attacking || p.state === STATE.hit_confirm)) return;
  // mega スロー中はターゲットが break ステートに入ってもコンボを維持（追撃繋ぎ補助・2026-05-16）
  if (!_timedOut && _megaSlow) return;
  const e = combo.lastHitEnemy;
  if (_timedOut || !e || COMBO_BREAK_STATES.has(e.state)) {
    // burst HUD が走っていなければ、break 履歴 HUD を 3 秒分セット（直近 route の snapshot を保持）
    if (combo.burstHudFrames === 0 && combo.lastNonEmptyRoute && combo.lastNonEmptyRoute.length > 0) {
      // 次の新規コンボ開始まで無制限保持（bumpCombo で 0 にクリアされる）
      combo.burstHudFrames = Infinity;
      combo.burstHudRoute  = combo.lastNonEmptyRoute.slice();
      combo.burstHudReason = 'break';
      combo.burstHudSpBaseId = null;
      combo.burstHudLoopLen = 0;
    }
    combo.count = 0;
    combo.lastHitEnemy = null;
    combo.aggregateRoute.length = 0;  // 次コンボに備えて集約 route をクリア
    _comboEl.style.opacity = '0';
    for (const pp of _players) {
      pp.specialUsedIds.clear();
      pp.comboTarget = null;
      pp.oppositeInputFrames = 0;
      pp._aggregateRouteAppended = false;
      if (pp.usedDerivativesThisCombo) pp.usedDerivativesThisCombo.clear();
      if (pp.attackHitCounts) pp.attackHitCounts.clear();  // 同技補正カウンタもリセット（2026-05-18）
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
  // カメラ Y リフト：armed gc_04 等で「画面を上に持ち上げる」演出用。
  // enemy-system が毎フレーム加算して push、camera 側はこれを camFollowY のターゲットに反映して
  // フレーム末で 0 に戻す（per-frame transient）。
  camYLift: 0,
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

// モジュール内で BoxGeometry をキャッシュ（2026-05-20 メモリリーク対策）
// 毎回 new BoxGeometry すると Three.js 側でハンドル累積 → 爆発多発時に fps 劣化や描画破綻の原因
let _PARTICLE_GEOM = null;
function _getParticleGeom() {
  if (!_PARTICLE_GEOM && _THREE) _PARTICLE_GEOM = new _THREE.BoxGeometry(7, 7, 7);
  return _PARTICLE_GEOM;
}

// 縦長 BoxGeometry をキャッシュ（spawnTrailDot 用：「線状トレイル」の見た目）
//   通常の 7x7x7 cube だと頭の vy 速度に追従する間に伸びる軌跡が「点線」「血チャンク」っぽくしか見えない
//   3 x 36 x 3 の細長 box にすることで各粒子が薄い縦ストリーク → 連続して滑らかな尾を引く
let _TRAIL_GEOM = null;
function _getTrailGeom() {
  if (!_TRAIL_GEOM && _THREE) _TRAIL_GEOM = new _THREE.BoxGeometry(3, 36, 3);
  return _TRAIL_GEOM;
}

// ============================================================
//  ゴア・クリティカル用「血しぶき感のないクリーン トレイル粒子」
//   - 散らばらず指定 vy だけ持つ縦長粒子を 1 つ push
//   - 飛翔オブジェクト（頭部 等）の vy より少し遅い vy を渡すと、後方に置き去りになる
//   - 既存 updateParticles の管理に乗る（gravity -0.7 / 寿命減衰）
// ============================================================
export function spawnTrailDot(x, y, z, color, vy, life, sizeScale = 1.5) {
  const geom = _getTrailGeom();
  const mat = new _THREE.MeshBasicMaterial({ color });
  const mesh = new _THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(sizeScale);
  _scene.add(mesh);
  particles.push({ mesh, vx: 0, vy, vz: 0, life, initSize: sizeScale });
}

// opts.type : 'normal'(攻撃方向放射) | 'launch'(Y軸上方) | 'slam'(叩きつけ放射) | 'omni'(全方向・旧来)
// opts.dirX / opts.dirZ : 攻撃方向（normal 時に使用・正規化不要）
// opts.sizeScale : 初期スケール倍率（既定 1.0）
// opts.lifeMul : 寿命倍率（既定 1.0・余韻演出時に > 1）
// opts.speedMul : 速度倍率（既定 1.0・大きい爆発で広範囲化）
export function spawnHitParticles(x, y, z, color = 0xffee44, count = 10, opts = {}) {
  const { type = 'omni', dirX = 1, dirZ = 0, sizeScale = 1, lifeMul = 1, speedMul = 1 } = opts;
  const geom = _getParticleGeom();

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
    if (sizeScale !== 1) mesh.scale.setScalar(sizeScale);
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

    if (speedMul !== 1) { vx *= speedMul; vy *= speedMul; vz *= speedMul; }
    particles.push({ mesh, vx, vy, vz, life: (22 + r() * 10) * lifeMul, initSize: sizeScale });
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
//  Phase 3-B：共用「死亡爆発」エフェクト（プレイヤー＆敵共通・2026-05-20）
//   - 1.5x スケール / 速度・寿命強化 / 30F 余韻（後段に大きく・遅く・長寿命の層）
//   - 白／黄／橙／赤の多層パーティクル＋黒 debris
//   - 既存プレイヤー dying 演出と同じ位置（mesh の頭上 y+80）を想定
// ============================================================
export function spawnDeathExplosion(x, y, z) {
  const main = { type: 'omni', sizeScale: 1.5, speedMul: 1.35, lifeMul: 1.0 };
  // 中心の閃光（少数だが白）
  spawnHitParticles(x, y, z, 0xffffff, 14, main);
  // 黄→橙→赤 の多層爆炎
  spawnHitParticles(x, y, z, 0xffee44, 24, main);
  spawnHitParticles(x, y, z, 0xff8822, 32, main);
  spawnHitParticles(x, y, z, 0xff3322, 38, main);
  // 暗色 debris（飛び散る破片風・少し速め）
  spawnHitParticles(x, y, z, 0x222222, 18, { type: 'omni', sizeScale: 1.2, speedMul: 1.6, lifeMul: 1.0 });
  // 余韻層（30F ほど残る・大きく・低速で漂う煙感）
  const lingerLife = (50 / 22);  // 約 50F 寿命（既存22Fベース → lifeMul で 50F 相当）
  const linger = { type: 'omni', sizeScale: 2.0, speedMul: 0.45, lifeMul: lingerLife };
  spawnHitParticles(x, y, z, 0xff7733, 10, linger);
  spawnHitParticles(x, y, z, 0x553311, 8,  linger);
  triggerHitstop(10);
  triggerShake(16, 26);
}

// ============================================================
//  超吹き飛び軌跡トレイル（2026-05-18 追加）
//  超吹き飛ばし（down_super_start / down_super_loop）中の entity の
//  飛行軌跡を残光ノードで描画。敵味方共通。
//  - 高速で飛ぶ敵を見失わない視認性ヘルプ
//  - 演出強化（後続実装の布石）
// ============================================================
export const superFlightTrails = [];

const SUPER_TRAIL_LIFE        = 28;       // ノード寿命（フレーム）
const SUPER_TRAIL_SIZE        = 14;       // ノード 1 個のサイズ（wu）
const SUPER_TRAIL_SPAWN_EVERY = 1;        // フレーム毎に 1 ノード生成（1=毎フレーム）
const SUPER_TRAIL_COLOR       = 0xff44cc; // 紫ピンク（burstFlash と統一感）
const SUPER_TRAIL_Y_OFFSET    = 30;       // 中心から少し上（胸〜頭の高さ）

// entity が down_super_* 中ならトレイルノードをスポーン
// entity = enemy / player どちらでも OK（state プロパティで判定）
function _maybeSpawnSuperFlightTrailFor(entity) {
  if (!entity.isAlive) return;
  if (entity.state !== STATE.down_super_start &&
      entity.state !== STATE.down_super_loop) return;
  // スポーン間隔制御
  entity._superTrailCD = (entity._superTrailCD ?? 0) - 1;
  if (entity._superTrailCD > 0) return;
  entity._superTrailCD = SUPER_TRAIL_SPAWN_EVERY;

  const geom = new _THREE.BoxGeometry(
    SUPER_TRAIL_SIZE, SUPER_TRAIL_SIZE, SUPER_TRAIL_SIZE
  );
  const mat = new _THREE.MeshBasicMaterial({
    color:       SUPER_TRAIL_COLOR,
    transparent: true,
    opacity:     0.9,
    blending:    _THREE.AdditiveBlending,
    depthWrite:  false,
  });
  const mesh = new _THREE.Mesh(geom, mat);
  mesh.position.set(entity.x, entity.y + SUPER_TRAIL_Y_OFFSET, entity.z);
  // 軽くランダム回転（残光のキラキラ感）
  mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, 0);
  _scene.add(mesh);
  superFlightTrails.push({ mesh, life: SUPER_TRAIL_LIFE, lifeMax: SUPER_TRAIL_LIFE });
}

// 毎フレーム呼ぶ：エンティティをスキャンしてトレイル生成 + 既存ノードのフェード
// entities: [..players, ..enemies] のような配列（複数渡せる）
export function updateSuperFlightTrails(...entitySets) {
  // スポーン
  for (const set of entitySets) {
    if (!set) continue;
    for (const e of set) _maybeSpawnSuperFlightTrailFor(e);
  }
  // 既存ノード更新
  for (let i = superFlightTrails.length - 1; i >= 0; i--) {
    const t = superFlightTrails[i];
    t.life--;
    const ratio = t.life / t.lifeMax;
    t.mesh.material.opacity = 0.9 * ratio;
    // 軽く縮小して消える
    const s = 0.6 + 0.4 * ratio;
    t.mesh.scale.set(s, s, s);
    if (t.life <= 0) {
      _scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      superFlightTrails.splice(i, 1);
    }
  }
}

// ============================================================
//  敵被弾判定（Step D-2c-1）
//
//  index.html から ctx を受け取って動作：
//    ctx = { enemies, attackTokens: { melee, aerial, ... } }
//
//  attackTokens は index.html 側のグローバル let 群を保持するため
//  関数引数経由で getter/setter を渡す。
// ============================================================
export function tryHitEnemies(p, attack, ctx) {
  const { enemies, attackTokens, breakablesHitFn } = ctx;
  // 並行して壊れ物プロップにも同じ攻撃 range を当てる（依存注入：循環 import 回避）
  if (breakablesHitFn) breakablesHitFn(p, attack);
  const facing = p.facing;
  let anyHit = false;
  for (const e of enemies) {
    if (!e.isAlive) continue;
    // Phase 3：dying final フェーズ中は完全無敵（後方吹き飛び中の爆発待ち）
    if (e.dyingInvincible) continue;
    // down_burst_* 中は完全無敵：判定もダメージも一切受けない
    // ※ attack.forceBurstDown:true（ULT 等）はこの保護をバイパスして必ずヒットさせる
    const _DBG_SP2AIR = window.SB?.DEBUG_SP2AIR && p.attackId === 'c01_sp_02_air';
    if (!attack.forceBurstDown &&
        (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop)) {
      if (_DBG_SP2AIR) console.log(`[SP2AIR] skip burst state=${e.state}`);
      continue;
    }
    if (e.ultBurstInvincible) { if (_DBG_SP2AIR) console.log('[SP2AIR] skip ultBurstInvincible'); continue; }
    if (e.lateralCombatInvincible) { if (_DBG_SP2AIR) console.log('[SP2AIR] skip lateralCombatInvincible'); continue; }
    if (e.dodgeInvuln) continue;  // #14-B：バックステップ回避の前半無敵
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    if (_DBG_SP2AIR) console.log(`[SP2AIR] candidate state=${e.state} dx=${dx.toFixed(0)} dz=${dz.toFixed(0)} dy=${(e.y-p.y).toFixed(0)} pY=${p.y.toFixed(0)} eY=${e.y.toFixed(0)} facing=${facing} eyAbove=${e.y > 10}`);
    // 前方判定（omni 攻撃は全方向ヒット）
    // multiHit 中間で既に当てた敵には最終ヒットの前方判定をスキップ（2026-05-20 SP1_air 不発バグ修正）：
    //   中間ヒット中に敵が背後に回り込むケース（壁バウンス絡み等）で最終ヒットだけ弾かれて
    //   state 遷移が走らずやられモーションが消える問題への対策。
    const _alreadyMultiHit = attack.isMultiHit && p.multiHitNextHit && p.multiHitNextHit.has(e);
    if (!attack.omni && !_alreadyMultiHit && Math.sign(dx) === -facing) { if (_DBG_SP2AIR) console.log('[SP2AIR] skip behind'); continue; }
    // === ホーミング当たり判定拡張 ===
    // comboTarget 本人だけ rangeX / rangeZ にボーナスを乗せて
    // 「ぎりぎり外れた」攻撃を「届いた」扱いに（さりげなさのため）
    const _isLockedTarget = (e === p.comboTarget);
    const _bonusX = _isLockedTarget ? HOMING_CONFIG.HIT_RANGE_BONUS_X : 0;
    const _bonusZ = _isLockedTarget ? HOMING_CONFIG.HIT_RANGE_BONUS_Z : 0;
    if (Math.abs(dx) > attack.rangeX + _bonusX) { if (_DBG_SP2AIR) console.log(`[SP2AIR] skip dx>rangeX (${Math.abs(dx).toFixed(0)}>${attack.rangeX})`); continue; }
    if (Math.abs(dz) > attack.rangeZ + _bonusZ) { if (_DBG_SP2AIR) console.log(`[SP2AIR] skip dz>rangeZ (${Math.abs(dz).toFixed(0)}>${attack.rangeZ})`); continue; }
    // Y軸判定（非対称：上方向 rangeY / 下方向 rangeYDown ≥ rangeY）
    if (attack.rangeY !== undefined) {
      const dy = e.y - p.y;          // 正:敵が上 / 負:敵が下
      const maxDown = attack.rangeYDown ?? attack.rangeY;
      if (dy >  attack.rangeY) { if (_DBG_SP2AIR) console.log(`[SP2AIR] skip dy>rangeY (${dy.toFixed(0)}>${attack.rangeY})`); continue; }
      if (dy < -maxDown)       { if (_DBG_SP2AIR) console.log(`[SP2AIR] skip dy<-rangeYDown (${dy.toFixed(0)}<-${maxDown})`); continue; }
    }
    if (_DBG_SP2AIR) console.log(`[SP2AIR] HIT! state=${e.state}`);
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
    // === 同技補正：攻撃 ID ごとのヒット回数を参照してダメージ / KB をスケーリング ===
    //   p.attackHitCounts は per-baseId カウンタ。コンボ中の累積。
    //   メガクラで MEGA_REDUCE_BY 分減算（部分回復）、resetCombo / checkComboBreak で 0 リセット
    const _sameAtkBaseId = p.attackId ? (p.attackId.endsWith('_air') ? p.attackId.slice(0, -4) : p.attackId) : null;
    const _sameAtkCount = _sameAtkBaseId ? (p.attackHitCounts?.get(_sameAtkBaseId) ?? 0) : 0;
    const _sameAtkDmgScale = (() => {
      const arr = SAME_ATK_CONFIG.SCALE_DAMAGE;
      return arr[Math.min(_sameAtkCount, arr.length - 1)];
    })();
    const _sameAtkKbScale = (() => {
      const arr = SAME_ATK_CONFIG.SCALE_KNOCKBACK;
      const v = arr[Math.min(_sameAtkCount, arr.length - 1)];
      return Math.max(v, SAME_ATK_CONFIG.MIN_KB_RATIO);
    })();
    const _scaledDamage = Math.max(SAME_ATK_CONFIG.MIN_DAMAGE, Math.round(attack.damage * _sameAtkDmgScale));
    // 実効 atk_lv：敵が空中なら atk_lv_air、地上なら atk_lv（variants マッチ・ガード判定・stagger に共用）
    const _hitLv = (e.y > ENEMY_AIRBORNE_Y_THRESHOLD && attack.atk_lv_air !== undefined)
      ? attack.atk_lv_air
      : (attack.atk_lv ?? 1);
    // ガード成立判定（#14-B）：enemy_guard 中・前面・atk_lv ≤ guardStrength のヒットはガードで軽減。
    //   guardStrength 超 / 背面はガード崩れ → 通常 dispatch（下流の lv 振り分け）に流す。
    //   e.guardStrength が未設定の場合は 3（enem01/enem02 相当）
    const _hitFromFront = (Math.sign(p.x - e.x) === e.facing) || (p.x === e.x);
    const _guarded = (e.state === STATE.enemy_guard) && _hitFromFront && _hitLv <= (e.guardStrength ?? 3);
    // midboss01 盾判定（盾未破壊のときのみ）：
    //   前面接地ヒット → 本体完全防御だが盾 HP は削れる。
    //   背面 or プレイヤー空中（上から）ヒット → 本体に通常ダメージ + 盾 HP を大きく削る。
    const _shieldActive     = (e.enemyType === 'midboss01') && !e.shieldBroken;
    const _hitFromAbove     = !p.isGrounded;   // プレイヤーが浮いている＝上から
    const _shieldFrontBlock = _shieldActive && _hitFromFront && !_hitFromAbove;
    // クリティカル判定：カウンターヒット（敵の攻撃発生中 wind/active）は確定。
    //   それ以外は基礎確率。ガード成立時はクリ無効。敵 state は直後に上書きされるため先に判定。
    const _isCounterHit = (e.state === STATE.enemy_attacking &&
                           (e.atkPhase === 'wind' || e.atkPhase === 'active'));
    // リパルスカウンター判定：aim フェーズ中（repulseWindow=true）の敵に、軸が一致する SP を当てた場合。
    //   確定クリ＋即死（雑魚）＋専用バナー＋パーティクル。SP コスト消費なし（腕前ゲート不要）。
    const _repulseMatch = e.repulseWindow && attack.repulseAxis &&
      ENEMY_ATTACKS[e.curAtkId]?.repulseAxis === attack.repulseAxis;
    if (_repulseMatch) e.repulseWindow = false;   // ウィンドウ消費（1 回限り）
    const _isCrit = !_guarded && (_repulseMatch || _isCounterHit || (Math.random() < CRIT_CONFIG.BASE_CHANCE));
    let _finalDamage = _isCrit
      ? Math.round(_scaledDamage * CRIT_CONFIG.DAMAGE_MULT)
      : _scaledDamage;
    if (_repulseMatch) _finalDamage = Math.max(_finalDamage, e.hp);   // 雑魚は即死保証
    if (_guarded) _finalDamage = Math.max(1, Math.round(_finalDamage * ENEMY_REACT_CONFIG.GUARD_DAMAGE_MULT));
    // midboss01 盾ダメージ振り分け：盾 HP を削り、前面接地ヒットは本体ダメージを 0 にする。
    //   盾削りはクリ補正前の素ダメージ基準（クリ補正は本体専用）。
    let _shieldDmg = 0;
    if (_shieldActive) {
      const _SC = MIDBOSS_SHIELD_CONFIG;
      const _chipMult = _shieldFrontBlock ? _SC.CHIP_FRONT_MULT : _SC.CHIP_BACK_MULT;
      _shieldDmg = Math.max(1, Math.round(_scaledDamage * _chipMult));
      e.shieldHp = Math.max(0, e.shieldHp - _shieldDmg);
      if (_shieldFrontBlock) _finalDamage = 0;   // 前面接地：本体完全防御
    }
    // ヒット
    e.hp = Math.max(0, e.hp - _finalDamage);
    // 与ダメージ数値ポップ（本体ダメージ＝橙/白、盾ダメージ＝水色を別行で）
    if (_finalDamage > 0) spawnDamageNumber(e.x, e.y + 110, e.z, _finalDamage, { crit: _isCrit });
    if (_shieldDmg > 0)   spawnDamageNumber(e.x, e.y + 150, e.z, _shieldDmg, { shield: true });
    // リパルスカウンター成立演出（バナー＋紫パーティクルバースト）
    if (_repulseMatch) {
      const _RC = REPULSE_CONFIG;
      spawnBanner('REPULSE!', { frames: _RC.BANNER_FRAMES, color: '#cc88ff', fontSize: 62 });
      spawnHitParticles(e.x, e.y + 100, e.z, _RC.FLASH_COLOR, _RC.FLASH_COUNT, { type: 'omni' });
    }
    // 最終ヒッター記録（ゴア・クリティカル抽選で参照・enterEnemyDying 内で profile lookup に使う）
    // wasGrounded：被弾"前"の接地状態を記録（gc 抽選の requireGrounded 判定で使用）。
    //   この時点ではまだ攻撃の vy/knockback が dispatch されてないので、ここで取れば「打ち上げ前」の値が取れる。
    e.lastHitter = { attackId: p.attackId, profileKey: 'METEO', facing: p.facing, lv: _hitLv, wasGrounded: e.y <= ENEMY_AIRBORNE_Y_THRESHOLD };
    // Phase 3-B：dying 中の追加処理（黒オイル + 抽選で 1 パーツ分離 / ゴアクリ抽選）
    if (e.dying) {
      handleEnemyDyingHit(e, e.x, e.y + 60, e.z, p.facing);
      // armed 発火した場合は以降の dispatch をスキップ（knockback / state 上書きで wall_blast setup が消えるのを防ぐ）
      if (e.goreCritical && e.goreCritical.armed) {
        bumpCombo(e);
        triggerHitstop(attack.hitstop ?? 4);
        triggerShake(attack.shake ?? 4, (attack.shake ?? 4) * 2 + 4);
        anyHit = true;
        continue;
      }
    }
    // ガード成立（#14-B）：通常 dispatch をスキップして enemy_block_hit へ。
    //   ダメージは上で軽減済み・軽 KB・青パーティクル。コンボカウントは増やさない（防御は中立）。
    if (_guarded) {
      e.hitFlashTimer = 5;
      e.frozenByUlt   = false;
      e.fallDir       = (e.x !== p.x) ? Math.sign(e.x - p.x) : p.facing;
      e.state         = STATE.enemy_block_hit;
      e.downTimer     = ENEMY_BLOCK_HIT_FRAMES;
      e.knockbackVx   = e.fallDir * ENEMY_REACT_CONFIG.GUARD_KB_VX;
      e.kbDecay       = 0.8;
      applyHitInitialPitch(e);
      spawnHitParticles(e.x + e.facing * 50, e.y + 90, e.z, 0x66ccff, 12);  // 青＝ガード
      triggerHitstop(3);
      anyHit = true;
      continue;
    }
    // midboss01 盾破壊：盾 HP がこのヒットで 0 到達 → SHIELD BREAK → enraged_intro。
    //   ダメージ（本体/盾）は上で適用済み。通常 dispatch をスキップ（state は確定済み）。
    if (_shieldActive && e.shieldHp === 0 && !e.shieldBroken) {
      triggerShieldBreak(e, ctx);
      bumpCombo(e);   // 「割った」達成感のためコンボ加点
      spawnHitParticles(e.x, e.y + 100, e.z, 0xffdd44, 28, { type: 'omni' });
      anyHit = true;
      continue;
    }
    // midboss01 前面ブロック（盾はまだ割れていない）：のけぞらせず軽後退のみ。
    //   コンボ加点なし（防御は中立）・通常 dispatch スキップ＝本体被弾モーションに入らない。
    if (_shieldFrontBlock) {
      e.hitFlashTimer    = 4;
      e.frozenByUlt      = false;
      e.shieldBlockTimer = Math.max((e.shieldBlockTimer ?? 0), 10);  // ガードドーム表示
      e.knockbackVx      = Math.sign(e.x - p.x || p.facing) * (ENEMY_REACT_CONFIG.GUARD_KB_VX * 0.5);
      e.kbDecay          = 0.8;
      // ガードカウンターカウント（累積が閾値に達したら即反撃フラグ）
      e.shieldBlockCount  = (e.shieldBlockCount ?? 0) + 1;
      e._blockDecayTimer  = 0;   // ブロックが続いている間は減衰しない
      if (e.shieldBlockCount >= (MIDBOSS_SHIELD_CONFIG.GUARD_COUNTER_THRESHOLD ?? 3)) {
        e.guardCounterArmed = true;
      }
      spawnHitParticles(e.x + e.facing * 60, e.y + 100, e.z, 0xaaccff, 10);  // 盾ヒット火花
      triggerHitstop(3);
      triggerShake(2, 6);
      anyHit = true;
      continue;
    }
    // スーパーアーマー：berserker のアクティブフェーズ中のみ（wind/recover は無効）
    if (e.superArmor > 0 && e.atkPhase === 'active' && (e.saHp ?? 0) > 0) {
      e.saHp--;
      if (e.saHp > 0) {   // 装甲残り有り → 通常リアクションをスキップ
        e.hitFlashTimer = 6;
        spawnHitParticles(e.x, e.y + 100, e.z, 0xff8800, 14, { type: 'omni' });  // 橙：SA 吸収
        anyHit = true;
        continue;
      }
      // SA 破壊（最後の 1 枚剥がれ）→ 通常被弾反応へ落下
      spawnHitParticles(e.x, e.y + 120, e.z, 0xff4400, 22, { type: 'omni' });
      triggerHitstop(4);
    }
    e.hitFlashTimer = 7;
    e.frozenByUlt   = false;  // ULT 凍結解除（ヒットを受けた敵だけ時間が進み始める）
    // 連続被弾累積（#14-B）：閾値超で次の小フリンチが enemy_stagger に降格（中ボス以降で主に発火）
    e.accumStagger = (e.accumStagger ?? 0) + 1;
    // 被弾時：倒れ方向を記録。IDLEのみ向きスナップ（FALL/DOWN/RISE中は回転競合のため不変）
    e.fallDir = (e.x !== p.x) ? Math.sign(e.x - p.x) : p.facing;
    if (e.state === STATE.wait01) {
      e.mesh.rotation.y = -e.fallDir * Math.PI / 2;
    } else if (e.isWallBounce) {
      // 壁バウンス中の敵を拾った：壁向き rotation を通常向きに復帰（2026-05-20）。
      // ⚠ isWallBounce フラグは clear しない：後段 dispatch（line 670 の
      // `down_super_loop && isWallBounce`）が knockback 遷移をするために必要。
      // フラグは wait01 復帰時に enemy-system.js が自動 clear する。
      e.mesh.rotation.y = -e.fallDir * Math.PI / 2;
    }
    e.knockbackVx   = facing * (attack.knockback * 0.4 * _sameAtkKbScale);
    const resolved = resolveAttackAttr(attack);
    // === 超吹き飛ばし回数上限（down_super_* 中の敵に lv6 攻撃命中）===
    //   FLIGHT_BURST_LIMIT 回到達でバーストダウン化（2026-05-20 仕様統一）。
    //   旧仕様：lateralCombatInvincible でトラジェクトリ温存 → 統一して burst に。
    //   実効 lv は dispatch tree と同じ式で計算（atk_lv_air が定義され敵が空中ならそちらを優先）。
    {
      const _effectiveLv = (e.y > ENEMY_AIRBORNE_Y_THRESHOLD && attack.atk_lv_air !== undefined)
        ? attack.atk_lv_air
        : (attack.atk_lv ?? 1);
      const _inSuperFlight = (e.state === STATE.down_super_start || e.state === STATE.down_super_loop);
      if (_effectiveLv === 6 && _inSuperFlight) {
        e.superFlightCount = (e.superFlightCount ?? 0) + 1;
        if (e.superFlightCount >= FLIGHT_BURST_LIMIT) {
          // burst に遷移して以降の通常 lv6 dispatch をスキップ
          triggerBurstState(e, facing);
          spawnHitParticles(e.x, e.y + 60, e.z, attack.hitColor ?? 0xffffff,
            attack.hitCount ?? 24, { type: 'omni' });
          bumpCombo(e);
          combo.burstHudFrames = Infinity;
          combo.burstHudRoute  = combo.aggregateRoute.slice();
          combo.burstHudReason = 'flight_limit';
          combo.burstHudSpBaseId = null;
          combo.burstHudLoopLen = 0;
          triggerHitstop(attack.hitstop);
          triggerShake(attack.shake, attack.shake * 2 + 4);
          anyHit = true;
          continue;
        }
      }
    }
    // ====================================================================
    //  重複必殺技ヒット：敵を down_burst_* に強制遷移（完全無敵スピン離脱）
    //  - ダメージは通常通り入る（既に上で適用済み）
    //  - lv 振り分けはスキップ・通常ステートには遷移させない
    //  - +1 コンボしてから自然消滅（着地で down_bas_start に合流）
    // ====================================================================
    // === 必殺技 重複判定：敵単位 ===
    //   この敵が同 baseId の必殺技で既にヒットを受けていたら burst。
    //   別の敵への切替（A→B）は B 視点で「初撃」になるので burst しない。
    //   敵の specialHitBy は updateEnemies 側で wait01 復帰時にクリアされる。
    let _spDuplicateOnThisEnemy = false;
    let _spBaseIdForMark = null;
    if (attack.isSpecial && p.attackId) {
      const _aid = p.attackId;
      _spBaseIdForMark = _aid.endsWith('_air') ? _aid.slice(0, -4) : _aid;
      // 敵単位カウント：specialHitBy Map<baseId, count>。LIMIT 回目のヒットで burst（2026-05-20）。
      //   count は読み取り時点で「過去のヒット数」なので、count >= LIMIT-1 で「これが LIMIT 回目」になる。
      const _spCount = (e.specialHitBy && typeof e.specialHitBy.get === 'function')
        ? (e.specialHitBy.get(_spBaseIdForMark) ?? 0)
        : 0;
      _spDuplicateOnThisEnemy = _spCount >= SPECIAL_USE_LIMIT - 1;
    }
    // === コンボルートのループ検出（永久コンボ抑止） ===
    //   この敵に対する初撃時のみ attack id を route に追加。
    //   同じパターンが COMBO_LOOP_REPEAT 回連続で繰り返されたら burst。
    //   route のクリア：敵 wait01 復帰時 / メガクラ被弾時（mega は意図的なリセット手段）。
    let _loopDetectedLen = 0;
    if (p.attackId) {
      if (!p._routeAppendedFor) p._routeAppendedFor = new Set();
      if (!p._routeAppendedFor.has(e)) {
        if (!e.comboRoute) e.comboRoute = [];
        e.comboRoute.push(p.attackId);
        p._routeAppendedFor.add(e);
      }
      // 集約 route：1 攻撃インスタンスにつき 1 回だけ push（複数敵ヒットでも 1 エントリに集約）
      if (!p._aggregateRouteAppended) {
        combo.aggregateRoute.push(p.attackId);
        p._aggregateRouteAppended = true;
        _loopDetectedLen = detectComboLoop(combo.aggregateRoute);
      }
    }
    const _loopDetected = _loopDetectedLen > 0;
    // ULT 等の forceBurstDown:true は無条件で burst 遷移ルートへ（combo break HUD は出さない）
    const _forceBurst = !!attack.forceBurstDown;
    if (_spDuplicateOnThisEnemy || _loopDetected || _forceBurst) {
      // 後方斜め上に吹き飛び・facing と反対方向（プレイヤーから離れる）
      triggerBurstState(e, facing);
      // ULT 由来の burst：起き上がる（wait01 復帰）まで完全無敵・メガクラも不可
      if (_forceBurst) e.ultBurstInvincible = true;
      // 演出（通常ヒットエフェクト）
      spawnHitParticles(e.x, e.y + 60, e.z, attack.hitColor ?? 0xffffff,
        attack.hitCount ?? 24, { type: 'omni' });
      // コンボ +1（その後敵が wait01 に戻るまで切断されない）
      bumpCombo(e);
      // burst HUD 表示：3 秒（180F）BURST を route の上に大きく表示。
      // route 自体は wait01 復帰時に自然にクリアされるのでここでは触らない。
      // 「どこで burst が起きたか」プレイヤーに見せたいので snapshot を取って HUD で固定表示する。
      // 次の新規コンボ開始まで無制限保持（bumpCombo で 0 にクリアされる）
      // ※ ULT 等の forceBurstDown は意図的な発動なので combo break HUD は出さない
      if (!_forceBurst) {
        combo.burstHudFrames = Infinity;
        combo.burstHudRoute  = combo.aggregateRoute.slice();
        // 理由を記録（HUD の枠色を切り替える）：SP duplicate を loop より優先（より具体的）
        if (_spDuplicateOnThisEnemy) {
          combo.burstHudReason = 'sp_dup';
          combo.burstHudSpBaseId = _spBaseIdForMark;
          combo.burstHudLoopLen = 0;
        } else {
          combo.burstHudReason = 'loop';
          combo.burstHudSpBaseId = null;
          combo.burstHudLoopLen = _loopDetectedLen;
        }
      }
      triggerHitstop(attack.hitstop);
      triggerShake(attack.shake, attack.shake * 2 + 4);
      anyHit = true;
      continue;  // 通常 dispatch ツリーをスキップ
    }
    // 通常 SP ヒット：この敵に対する「このベース ID の累計使用回数」を +1
    //   SPECIAL_USE_LIMIT 到達後の次ヒットで burst（_spDuplicateOnThisEnemy 経由）
    if (_spBaseIdForMark) {
      if (!e.specialHitBy || typeof e.specialHitBy.get !== 'function') e.specialHitBy = new Map();
      const _prev = e.specialHitBy.get(_spBaseIdForMark) ?? 0;
      e.specialHitBy.set(_spBaseIdForMark, _prev + 1);
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
      // 空中敵への launch は launchVyAirborne で控えめ値に切替可（2026-05-20）：
      //   既に浮いてる敵に大きな launchVy を入れると空コンボ場所から離脱してしまう。
      //   空中敵には小さい lift で「空中コンボ継続位置」に再セットアップする。
      const _wasAirborne = e.y > ENEMY_AIRBORNE_Y_THRESHOLD;
      e.vy = (_wasAirborne && attack.launchVyAirborne !== undefined)
        ? attack.launchVyAirborne
        : attack.launchVy;
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
      e.state === STATE.enemy_attacking ||  // Phase 2.4：敵 AI 攻撃中もカウンター被弾を受け付ける
      // 移動中（walk_fwd/back/dash）の敵も被弾を受け付ける（#14：被弾 state へ正しく遷移）
      e.state === STATE.walk_fwd || e.state === STATE.walk_back || e.state === STATE.dash ||
      // 防御/よろめき行動中（#14-B）。enemy_guard はガード成立判定、他は被弾再ディスパッチ可
      e.state === STATE.enemy_dodge || e.state === STATE.enemy_guard ||
      e.state === STATE.enemy_stagger || e.state === STATE.enemy_block_hit ||
      e.state === STATE.enraged_intro ||  // 興奮モーション中も被弾可（ロアを潰せる・#14-C）
      // 自発ジャンプ中の敵も被弾を受け付ける（空中ヒット → knockback_air01 等・プレイヤーと同期）
      e.state === STATE.jump_start || e.state === STATE.jump_loop || e.state === STATE.jump_end ||
      e.state === STATE.jump_d_start || e.state === STATE.jump_d_loop || e.state === STATE.jump_d_end ||
      // 壁バウンス中の super 飛行は通常ダウンへの再ディスパッチを許可（2026-05-18）
      (e.state === STATE.down_super_loop && e.isWallBounce)
    ) {
      // 敵 AI 攻撃中の被弾：AI 内部状態をクリーンアップしてからフリンチへ遷移
      if (e.state === STATE.enemy_attacking) {
        e.atkPhase     = null;
        e.atkTimer     = 0;
        e.atkCooldown  = (ENEMY_ATTACKS[e.curAtkId] ?? ENEMY_ATTACKS.e01_atk_01).cooldownFrames;
        e.hitDelivered = false;
        if (attackTokens) {
          const _cat = e.curAtkCategory ?? 'melee';
          const _tok = attackTokens[_cat];
          if (_tok && _tok.get() === e) _tok.set(null);  // トークン解放
        }
      }
      // === atk_lv 駆動の被弾ステート振り分け ===
      // 再発火許可ステート：
      //  - wait01（初動）
      //  - knockback*（フリンチ系・タイマーリフレッシュでコンボ持続）
      //  - fall_loop / land（空中→落下→着地モーション中も拾う）
      //  - down_up_start / down_up_loop（**打ち上げ juggle 中の追撃でフリンチへ移行**）
      // 再発火しない（既存ダウン保護）：
      //  - down_front_* / down_super_* / down_wall_* / down_roll_* / down_bas_*
      // 実効 lv：敵が空中（y > しきい値）かつ atk_lv_air が定義されていれば優先（例: c01_atk_l_01_air は空中ヒットで lv06）
      // しきい値で接地寸前の敵を地上扱いに固定し、バウンド瞬間や微小 y 値で誤って空中ルートに入るのを防ぐ
      const lv = (e.y > ENEMY_AIRBORNE_Y_THRESHOLD && attack.atk_lv_air !== undefined)
        ? attack.atk_lv_air
        : (attack.atk_lv ?? 1);
      if (lv === 6) {
        // 超吹き飛ばし回数上限チェック：FLIGHT_BURST_LIMIT 回到達で burst に置換（2026-05-20 統一）
        const _nextSuperCount = (e.superFlightCount ?? 0) + 1;
        if (_nextSuperCount >= FLIGHT_BURST_LIMIT) {
          e.superFlightCount = _nextSuperCount;
          triggerBurstState(e, facing);
          combo.burstHudFrames = Infinity;
          combo.burstHudRoute  = combo.aggregateRoute.slice();
          combo.burstHudReason = 'flight_limit';
          combo.burstHudSpBaseId = null;
          combo.burstHudLoopLen = 0;
        } else {
          // 通常：超吹き飛ばし — 専用ステート down_super_start（地上/空中共用）
          // 着地で down_roll_start、壁ヒットで down_wall_start に強制遷移
          // 攻撃側で kb_vy_lv6 / kb_vx_mult_lv6 / kb_vx_decay_lv6 を上書き可能（lv6 専用）
          // フォールバック：legacy 共通フィールド kb_vy / kb_vx_mult / kb_vx_decay → 既定 KB_LV06_*
          e.vy           = attack.kb_vy_lv6 ?? attack.kb_vy ?? KB_LV06_VY;
          e.knockbackVx *= attack.kb_vx_mult_lv6 ?? attack.kb_vx_mult ?? KB_LV06_VX_MULT;
          e.kbDecay      = attack.kb_vx_decay_lv6 ?? attack.kb_vx_decay ?? 0.78;
          e.state       = STATE.down_super_start;
          e.downTimer    = ENEMY_DOWN_SUPER_FRAMES;
          e.superFlightCount = _nextSuperCount;
        }
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
        // #14-B：連続被弾の累積が閾値超なら小フリンチを enemy_stagger に降格
        if (e.accumStagger > e.staggerThreshold) {
          e.state    = STATE.enemy_stagger;
          e.downTimer = ENEMY_STAGGER_FRAMES;
        } else {
          e.state    = STATE.knockback02;
          e.downTimer = Math.round(ENEMY_KB02_FRAMES * (attack.kbTimeMult ?? 1.0));
        }
      } else {
        // lv01 / それ以外（未指定）地上 → knockback01（accumStagger 閾値超で enemy_stagger）
        if (e.accumStagger > e.staggerThreshold) {
          e.state    = STATE.enemy_stagger;
          e.downTimer = ENEMY_STAGGER_FRAMES;
        } else {
          e.state    = STATE.knockback01;
          e.downTimer = Math.round(ENEMY_KB01_FRAMES * (attack.kbTimeMult ?? 1.0));
        }
      }
      applyHitInitialPitch(e);
    }
    // 空中の敵へのヒット：敵もホップで浮遊継続(非打ち上げ技共通・地上技でも適用)
    // ※叩きつけ/吹き飛ばし系はホップで vy を上書きされたくないので除外
    //   対象：down_super_start（lv6）／ down_front_start（lv3）／ down_rakka_*（lv5・kb_vy 維持必須）
    //   ／ down_bound_start（バウンド上向き vy 維持）
    const _slamState = (
      e.state === STATE.down_super_start  ||
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
    // 例：c01_add_02 は lv02 軽フリンチ + 斜め上の浮きでコンボ始動として使う。
    // launchVy 持ち（lv04 等）は既に強い上昇速度が入っているので、Math.max で潰さない。
    if (attack.knockbackY !== undefined && !_slamState) {
      e.vy = Math.max(e.vy, attack.knockbackY);
      e.peakHangTimer    = 0;
      e.launcherAirborne = false;
    }
    // プレイヤーの空中ホップ：攻撃側に aerialHop:true が立っている技で発動
    // 対象：c01_atk_01_air / 02_air / 03_air / c01_atk_l_01_air（aerialHop 持ち全般）
    // Math.max で「下降中なら浮き直す／上昇中はそのまま」→ cancel jump 直後の上昇vyを潰さない
    // - launcher 系（launchVy あり）は通常ホップ対象外だが、aerialHopVy が明示指定されている時は強制適用
    //   （例：c01_sp_02 を空中ヒットさせて、打ち上げた敵を上から拾うためにホップしたい）
    const _customHop = attack.aerialHopVy !== undefined;
    if (attack.aerialHop && !p.isGrounded && (!attack.launchVy || _customHop)) {
      // 対地上敵：hop 量を抑える（プレイヤーが自然に降下しつつ少し跳ねる感じ）
      //   空中敵への juggle 時は full hop + 減衰なし（拾い直し中の落下感を解消・2026-05-20）。
      //   対地上敵の減衰は緩和：旧 3wu/hit → 1wu/hit（5.4 → 4.4 → 3.4 → 2.4 → ...）2026-05-20 v2。
      const targetAirborne = e.y > ENEMY_AIRBORNE_Y_THRESHOLD;
      const groundHopMult = attack.aerialHopGroundMult ?? 0.6;
      const baseHopVy = (attack.aerialHopVy ?? PHYSICS.AERIAL_HOP_V) * (targetAirborne ? 1.0 : groundHopMult);
      const count = p.aerialHopCount ?? 0;
      const AERIAL_HOP_DECAY = 1;  // 旧 3 → 1：2 発目以降の急降下を抑制
      const decay = targetAirborne ? 0 : AERIAL_HOP_DECAY;
      const decayedHopVy = Math.max(0, baseHopVy - count * decay);
      if (decayedHopVy > 0) p.vy = Math.max(p.vy, decayedHopVy);
      // カウンタも空中敵相手では加算しない（次に地上敵を殴った時にリセットされた状態に近い扱い）
      if (!targetAirborne) p.aerialHopCount = count + 1;
    }
    // 演出（クリティカルはヒットストップ・シェイクを上乗せ）
    const _hitstop = (attack.hitstop ?? 0) + (_isCrit ? CRIT_CONFIG.HITSTOP_BONUS : 0);
    const _shake   = (attack.shake ?? 0) + (_isCrit ? CRIT_CONFIG.SHAKE_BONUS : 0);
    triggerHitstop(_hitstop);
    triggerShake(_shake, _shake * 2 + 4);
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
    // 同技補正カウンタ：攻撃インスタンスにつき 1 回だけ +1（複数敵巻き込みでも 1 加算）
    if (!p._sameAtkCounted && _sameAtkBaseId) {
      if (!p.attackHitCounts) p.attackHitCounts = new Map();
      p.attackHitCounts.set(_sameAtkBaseId, (p.attackHitCounts.get(_sameAtkBaseId) ?? 0) + 1);
      p._sameAtkCounted = true;
    }
    // Phase 3-C：lv06 killing hit → バーストダウン即爆散（黒フェード経由なし）
    //   dispatch 完了後に変換することで、attack の knockbackVx/vy/kbDecay（SP4 等の慣性）をそのまま継承
    //   state だけ down_burst_start にスワップしてスピンアニメへ
    {
      const _killLv = (e.y > ENEMY_AIRBORNE_Y_THRESHOLD && attack.atk_lv_air !== undefined)
        ? attack.atk_lv_air
        : (attack.atk_lv ?? 1);
      if (e.hp <= 0 && !e.dying && !e.instantRespawn && _killLv === 6) {
        enterEnemyDyingBurst(e, ctx, p.facing);
      }
    }
    anyHit = true;
  }
  return anyHit;
}

// ============================================================
//  連続ヒット技：1 ティックぶんのヒット判定（中間ヒット / 最終ヒット）
//  - 中間：軽フリンチ（knockback01 短）+ damagePerHit 適用 + コンボ +1
//  - 最終：通常の atk_lv 振り分け（tryHitEnemies 経由）+ damageLastHit
//  - 同一敵への再ヒットは p.multiHitNextHit Map で間隔制御
//  - 巻き込み複数敵：それぞれ独立タイマーで管理
//
//  Step D-2c-2 で分離。gameFrameCounter は ctx.getFrame() 経由で参照。
// ============================================================
export function tryHitEnemiesMultiHit(p, attack, isLastHit, ctx) {
  // multiHit の最初のヒットだけ壊れ物にも当てる（連打で何度も破壊シーケンス起動を防ぐ）
  if (!isLastHit && ctx.breakablesHitFn) ctx.breakablesHitFn(p, attack);
  const { enemies } = ctx;
  const facing = p.facing;
  const _DBG = window.SB?.DEBUG_MULTIHIT && p.attackId === 'c01_sp_01_air';
  // 最終ヒットは通常 dispatch に委譲（damage / hitstop を一時差し替え）
  if (isLastHit) {
    if (_DBG) {
      for (const e of enemies) if (e.isAlive) console.log(`[MH FINAL pre] e.state=${e.state} y=${e.y.toFixed(0)} dx=${(e.x-p.x).toFixed(0)} sfCount=${e.superFlightCount}`);
    }
    const _DBG_SP2 = window.SB?.DEBUG_SP2 && p.attackId === 'c01_sp_02';
    if (_DBG_SP2) {
      for (const e of enemies) {
        if (!e.isAlive) { console.log('[SP2 LAST] skip: !isAlive'); continue; }
        const dx = e.x - p.x, dz = e.z - p.z, dy = e.y - p.y;
        const alreadyHit = p.multiHitNextHit && p.multiHitNextHit.has(e);
        const spCount = (e.specialHitBy && typeof e.specialHitBy.get === 'function') ? (e.specialHitBy.get('c01_sp_02') ?? 0) : 0;
        console.log(`[SP2 LAST] state=${e.state} dx=${dx.toFixed(0)} dz=${dz.toFixed(0)} dy=${dy.toFixed(0)} pY=${p.y.toFixed(0)} eY=${e.y.toFixed(0)} alreadyHit=${alreadyHit} spCount=${spCount} dyingInv=${e.dyingInvincible} dodgeInvuln=${e.dodgeInvuln}`);
      }
    }
    const savedDamage = attack.damage;
    const savedHitstop = attack.hitstop;
    attack.damage = attack.damageLastHit ?? (attack.damagePerHit * 2);
    if (attack.hitstopLastHit !== undefined) {
      attack.hitstop = attack.hitstopLastHit;
    }
    const hit = tryHitEnemies(p, attack, ctx);
    if (_DBG_SP2) console.log(`[SP2 LAST] tryHitEnemies returned hit=${hit}`);
    attack.damage = savedDamage;
    attack.hitstop = savedHitstop;
    if (_DBG) {
      for (const e of enemies) if (e.isAlive) console.log(`[MH FINAL post] e.state=${e.state} hit=${hit} sfCount=${e.superFlightCount}`);
    }
    p.multiHitNextHit.clear();
    return hit;
  }
  const gameFrame = ctx.getFrame();
  // 中間ヒット：状態は軽フリンチで保持・dispatch list は通さない
  let anyHit = false;
  for (const e of enemies) {
    if (!e.isAlive) continue;
    if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) continue;
    // dyingInvincible（ゴア・クリティカル armed 等）は中間ヒット対象外（追撃禁止・2026-05-18）
    if (e.dyingInvincible) continue;
    // 同一敵への hitInterval ガード
    const nextHitFrame = p.multiHitNextHit.get(e) ?? -Infinity;
    if (gameFrame < nextHitFrame) continue;
    // 範囲判定（comboTarget は range ボーナス適用）
    const dx = e.x - p.x;
    const dz = e.z - p.z;
    if (!attack.omni && Math.sign(dx) === -facing) continue;
    const _isLockedTarget = (e === p.comboTarget);
    const _bonusX = _isLockedTarget ? HOMING_CONFIG.HIT_RANGE_BONUS_X : 0;
    const _bonusZ = _isLockedTarget ? HOMING_CONFIG.HIT_RANGE_BONUS_Z : 0;
    if (Math.abs(dx) > attack.rangeX + _bonusX) continue;
    if (Math.abs(dz) > attack.rangeZ + _bonusZ) continue;
    if (attack.rangeY !== undefined) {
      const dy = e.y - p.y;
      const maxDown = attack.rangeYDown ?? attack.rangeY;
      if (dy > attack.rangeY) continue;
      if (dy < -maxDown)      continue;
    }
    // ダウン中敵への中間ヒットは原則空振り（lv 5/7 のみ拾える既存ルールを踏襲）
    const _downedForWhiff = (
      e.state === STATE.down_bas_start ||
      e.state === STATE.down_bas_loop ||
      e.state === STATE.down_bas_end
    );
    if (_downedForWhiff) {
      const _lv = (attack.atk_lv_down !== undefined) ? attack.atk_lv_down : (attack.atk_lv ?? 1);
      if (_lv !== 5 && _lv !== 7) continue;
    }
    // ヒット適用（中間）。クリティカル判定は最終ヒット（tryHitEnemies 経由）に集約し、
    //   多段の中間ヒットは通常表示（毎ティック抽選で過剰クリにしない）。
    const _midDamage = attack.damagePerHit ?? 5;
    e.hp = Math.max(0, e.hp - _midDamage);
    spawnDamageNumber(e.x, e.y + 110, e.z, _midDamage, {});
    // 最終ヒッター記録（マルチヒットでも毎発上書き：最終ヒットの attackId が記録される）
    // 中間ヒットの lv は便宜上 attack.atk_lv（最終ヒットの想定値）を使う
    const _midLv = (e.y > ENEMY_AIRBORNE_Y_THRESHOLD && attack.atk_lv_air !== undefined)
      ? attack.atk_lv_air
      : (attack.atk_lv ?? 1);
    e.lastHitter = { attackId: p.attackId, profileKey: 'METEO', facing: p.facing, lv: _midLv, wasGrounded: e.y <= ENEMY_AIRBORNE_Y_THRESHOLD };
    // dying 中の中間ヒット：ゴアクリ抽選も回す（仕様：完全消滅まで毎ヒット抽選）
    if (e.dying) {
      handleEnemyDyingHit(e, e.x, e.y + 60, e.z, p.facing);
      // armed 発火：以降の flinch/state 上書きをスキップ（wall_blast setup を保護）
      if (e.goreCritical && e.goreCritical.armed) {
        bumpCombo(e);
        anyHit = true;
        continue;
      }
    }
    e.hitFlashTimer = 7;
    e.frozenByUlt = false;
    e.fallDir = (e.x !== p.x) ? Math.sign(e.x - p.x) : p.facing;
    if (e.state === STATE.wait01) {
      e.mesh.rotation.y = -e.fallDir * Math.PI / 2;
    }
    // 軽フリンチ：hitInterval よりやや長めに固定して中間ヒット間で「外れない」よう保持
    const flinchFrames = Math.max(ENEMY_KB01_FRAMES, (attack.hitInterval ?? 6) + 4);
    // ダウン系・打ち上げ系には上書きしない（_slamState 等で動かない方が良いケースも考慮）
    // 2026-05-20：打ち上げ系（down_up_start/loop）も保護リストに追加。
    //   旧仕様：SP1_air の中間ヒットが launcher 直後の敵を knockback01 に上書き →
    //   その後の最終ヒットで lv6 dispatch がうまく動かず、やられモーションが出ない問題があった。
    const _preserveState = (
      e.state === STATE.down_super_start ||
      e.state === STATE.down_super_loop  ||
      e.state === STATE.down_front_start ||
      e.state === STATE.down_up_start    ||
      e.state === STATE.down_up_loop     ||
      e.state === STATE.down_rakka_start ||
      e.state === STATE.down_rakka_loop  ||
      e.state === STATE.down_bound_start
    );
    if (_DBG) console.log(`[MH MID] e.state=${e.state} preserve=${_preserveState} y=${e.y.toFixed(0)}`);
    if (!_preserveState) {
      e.state    = STATE.knockback01;
      e.downTimer = flinchFrames;
      e.dodgeInvuln = false;  // dodge 中被弾：state が切り替わるので無敵フラグも解除（最終段が抜けるバグ対策）
      applyHitInitialPitch(e);
    }
    // 中間ノックバック：敵を facing 方向に少し押して「引き連れる」形にする
    //   通過させないために中間ヒットでも water-flow 程度の押し量を入れる
    //   毎ヒットで refresh するので、ヒット間隔の間に少しずつ前進し続ける
    const iKbVx = attack.intermediateKnockbackVx ?? Math.max(6, Math.floor((attack.knockback ?? 40) * 0.12));
    e.knockbackVx = facing * iKbVx;
    e.kbDecay     = attack.intermediateKbDecay ?? 0.92;  // 緩い減衰で「ライドアロング」
    // 多段ヒットの空中保持（multiHitVacuum）：空中の敵を毎ヒット プレイヤー側へ寄せ、
    //   落下・横ズレで最終段を取りこぼさない（ドリルで「つかんで」いるイメージ）。
    if (attack.multiHitVacuum && e.y > ENEMY_AIRBORNE_Y_THRESHOLD) {
      e.vy = 0;                       // 落下を止めて次ヒットまで滞空
      e.peakHangTimer = 0;
      e.launcherAirborne = false;
      e.knockbackVx = 0;              // 中間ノックバックの押し出しを打ち消す
      e.y += (p.y - e.y) * 0.5;       // 高さをプレイヤーへ寄せる
      e.z += (p.z - e.z) * 0.4;
      e.x += ((p.x + facing * 90) - e.x) * 0.4;  // 前方保持距離へ寄せる
    }
    // 演出：中間ヒットでも hitstop / shake をやや重めに（攻撃の手応えを優先）
    const hitColor = attack.hitColor ?? 0xffee44;
    spawnHitParticles(e.x, e.y + 60, e.z, hitColor,
      Math.max(6, Math.floor((attack.hitCount ?? 10) * 0.6)),
      { type: 'normal', dirX: dx, dirZ: dz });
    triggerHitstop(Math.max(2, Math.floor((attack.hitstop ?? 5) * 0.7)));
    triggerShake(Math.max(2, Math.floor((attack.shake ?? 4) * 0.6)),
                 Math.max(3, Math.floor((attack.shake ?? 4))));
    // 次ヒット可能フレーム記録
    p.multiHitNextHit.set(e, gameFrame + (attack.hitInterval ?? 6));
    // コンボ +1（ヒットごと）
    bumpCombo(e);
    if (!attack.noSpGain) {
      p.sp = Math.min(SP_CONFIG.MAX, p.sp + SP_CONFIG.GAIN_ON_HIT);
    }
    anyHit = true;
  }
  return anyHit;
}

// ============================================================
//  投擲ヒット（投げ敵 → 他敵への衝突連鎖）
//  Final Fight 系の定番。複数敵戦のクラウドコントロール手段。
//  - 投擲弾（e.thrownProjectile=true）は飛行中に他敵との距離をチェック
//  - 衝突したら受け手を atk_lv 3（down_front_start）にし、投げ手はその場で停止
//  - ヒットストップ強め（FF 風）・1 回当てたら投擲弾フラグ消費
//
//  Step D-2c-3 で分離。attackTokens は ctx 経由。
// ============================================================
const THROW_CHAIN_CONFIG = {
  hitRangeX:    80,   // 衝突判定距離（X 軸）
  hitRangeY:    120,  // Y 軸（投げ手はある程度上空にいるので広め）
  hitRangeZ:    60,   // Z 軸
  damage:       12,   // 受け手のダメージ
  kbVy:         12,   // 受け手の打ち上げ初速（KB_LV03_VY と同等）
  kbVxMult:     1.2,  // 投げ手の knockbackVx に対する受け手の倍率（少し弱め）
  hitstop:      12,   // FF 風強めヒットストップ（18→12 にトーンダウン）
  shake:        10,
  hitColor:     0xffaa44,
  hitCount:     20,
};

export function tryThrownChainHit(thrower, ctx) {
  const { enemies, attackTokens } = ctx;
  if (!thrower.thrownProjectile) return;
  if (!thrower.isAlive) return;
  // 着地したら投擲弾フラグ解除
  if (thrower.y <= 0 && thrower.vy <= 0 &&
      (thrower.state === STATE.down_front_start || thrower.state === STATE.down_front_loop)) {
    // まだ飛行中の判定は y>0 ベース。y<=0 になったら投擲解除
  }
  for (const other of enemies) {
    if (other === thrower) continue;
    if (!other.isAlive || other.frozenByUlt) continue;
    // ゴア・クリティカル armed 中は完全無敵：投擲チェーンの巻き込みも弾く
    if (other.goreCritical && other.goreCritical.armed) continue;
    if (other.state === STATE.grabbed) continue;
    // ダウン中・既に吹き飛び中の敵は対象外（巻き込みすぎ防止）
    if (other.state === STATE.down_front_start || other.state === STATE.down_front_loop ||
        other.state === STATE.down_bas_start || other.state === STATE.down_bas_loop ||
        other.state === STATE.down_bas_end ||
        other.state === STATE.down_super_start || other.state === STATE.down_super_loop ||
        other.state === STATE.down_roll_start || other.state === STATE.down_roll_loop ||
        other.state === STATE.down_rakka_start || other.state === STATE.down_rakka_loop ||
        other.state === STATE.down_bound_start ||
        other.state === STATE.down_burst_start || other.state === STATE.down_burst_loop) continue;
    const dx = Math.abs(other.x - thrower.x);
    const dy = Math.abs(other.y - thrower.y);
    const dz = Math.abs(other.z - thrower.z);
    if (dx > THROW_CHAIN_CONFIG.hitRangeX) continue;
    if (dy > THROW_CHAIN_CONFIG.hitRangeY) continue;
    if (dz > THROW_CHAIN_CONFIG.hitRangeZ) continue;
    // === 衝突発生 ===
    const dir = thrower.thrownDir;
    // 受け手：投げ手と同方向に吹き飛び
    other.hp = Math.max(0, other.hp - THROW_CHAIN_CONFIG.damage);
    // 投げ手 (thrower) の最終ヒッター情報を継承（chain death の attribute 用）
    other.lastHitter = { attackId: 'c01_thrown_chain', profileKey: 'METEO', facing: thrower.thrownDir, lv: 3, wasGrounded: other.y <= ENEMY_AIRBORNE_Y_THRESHOLD };
    other.hitFlashTimer = 7;
    other.fallDir       = dir;
    other.vy            = THROW_CHAIN_CONFIG.kbVy;
    other.knockbackVx   = dir * THROW_CHAIN_CONFIG.hitRangeX * 0.5; // 投げ手より少し弱い
    // 内部的に knockbackVx の参照値は thrower の現速度を流用
    other.knockbackVx   = thrower.knockbackVx * THROW_CHAIN_CONFIG.kbVxMult * 0.6;
    other.state         = STATE.down_front_start;
    other.downTimer     = ENEMY_DOWN_FRONT_FRAMES;
    other.peakHangTimer    = 0;
    other.launcherAirborne = false;
    // AI 攻撃中だった場合のクリーンアップ + トークン解放
    if (other.state === STATE.enemy_attacking) { /* 既に上書き済 */ }
    other.atkPhase    = null;
    other.atkTimer    = 0;
    other.atkCooldown = 30;
    other.hitDelivered = false;
    const _cat2 = other.curAtkCategory ?? 'melee';
    const _tok2 = attackTokens && attackTokens[_cat2];
    if (_tok2 && _tok2.get() === other) _tok2.set(null);
    applyHitInitialPitch(other);

    // 投げ手：投擲弾フラグ消費 + 軽くストップ（連鎖防止・1 ヒットで消費）
    thrower.thrownProjectile = false;
    thrower.knockbackVx *= 0.35;  // 一気には止めない（自然な減速）

    // 演出：強めのヒットストップ + シェイク + パーティクル
    const midX = (thrower.x + other.x) / 2;
    const midY = (thrower.y + other.y) / 2 + 50;
    const midZ = (thrower.z + other.z) / 2;
    spawnHitParticles(midX, midY, midZ, THROW_CHAIN_CONFIG.hitColor, THROW_CHAIN_CONFIG.hitCount,
      { type: 'normal' });
    triggerHitstop(THROW_CHAIN_CONFIG.hitstop);
    triggerShake(THROW_CHAIN_CONFIG.shake, THROW_CHAIN_CONFIG.shake * 2 + 4);

    // コンボ +1（投げ手のオーナーに帰属）
    if (thrower.thrownByPlayer) {
      // route 追加：投げ巻き込みヒットは ETC カテゴリで表示（弱攻撃と区別）
      if (!other.comboRoute) other.comboRoute = [];
      other.comboRoute.push('thrown_chain_hit');
      combo.aggregateRoute.push('thrown_chain_hit');
      bumpCombo(other);
      thrower.thrownByPlayer.sp = Math.min(SP_CONFIG.MAX,
        thrower.thrownByPlayer.sp + SP_CONFIG.GAIN_ON_HIT);
    }
    // 1 ヒットで終わり（多重ヒット防止）
    break;
  }
}

// 毎フレームの粒子更新（位置進行・寿命減・スケール縮小・消滅）
//   2026-05-20：sizeScale (initSize) を考慮して縮小開始サイズを保持
//   2026-05-20：material は per-particle なので消滅時に dispose（メモリリーク防止）
//   geometry はモジュール内キャッシュなので dispose しない
export function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.x += p.vx;
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz;
    p.vy -= 0.7;
    p.life--;
    const lifeRatio = Math.max(0, p.life / 22);
    const initSize = p.initSize ?? 1;
    p.mesh.scale.setScalar(lifeRatio * initSize);
    if (p.life <= 0 || p.mesh.position.y < 0) {
      _scene.remove(p.mesh);
      if (p.mesh.material && p.mesh.material.dispose) p.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}
