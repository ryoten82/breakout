// ============================================================
//  SCRAP BLITZ — enemy-system（分離 Phase: Step E-3）
//
//  ダミー敵の構築・スポーン・更新（state machine / AI / 物理）を集約：
//    - buildDummyMesh()                敵メッシュ（胴体・頭・脚・ノーズ）構築
//    - spawnDummy(x, z, opts)          enemies[] にダミー敵を 1 体追加
//    - updateEnemies(ctx)              毎フレーム：ノックバック / 重力 / 状態遷移 /
//                                       敵 AI（wind→active→recover）/ tilt/pitch 計算 /
//                                       hitFlashTimer
//
//  ES Module として index.html から import される：
//    import {
//      initEnemySystem, buildDummyMesh, spawnDummy, updateEnemies,
//    } from './src/enemy-system.js';
//
//  initEnemySystem(deps) で依存を一括注入：
//    - THREE: Three.js モジュール
//    - scene: THREE.Scene
//    - players: プレイヤー配列
//    - enemies: 敵配列（モジュール内で push する）
//
//  updateEnemies(ctx) は呼び出し毎に hitCtx を受け取る：
//    - ctx.attackTokens: カテゴリ別攻撃トークン（melee/aerial 等・各カテゴリで独立1枠）
//    - tryThrownChainHit へそのまま受け渡す
// ============================================================

import {
  STATE, PLAYER_JUMP_STATES,
  STATE_TILT_TARGET, STATE_TILT_LERP,
  STATE_PITCH_TARGET, STATE_PITCH_LERP,
  ENEMY_JUMP_START_FRAMES, ENEMY_JUMP_D_START_FRAMES,
  ENEMY_JUMP_END_FRAMES, ENEMY_JUMP_D_END_FRAMES,
  ENEMY_STAGGER_FRAMES, ENEMY_DODGE_FRAMES, ENEMY_DODGE_INVULN,
  ENEMY_GUARD_FRAMES, ENEMY_BLOCK_HIT_FRAMES,
  ENEMY_FALL_FRAMES, ENEMY_RISE_FRAMES,
  ENEMY_DOWN_BAS_START_FRAMES, ENEMY_DOWN_BAS_LOOP_FRAMES,
  ENEMY_LAND_FRAMES, ENEMY_DOWN_FRONT_FRAMES,
  ENEMY_WALL_START_FRAMES, ENEMY_ROLL_START_FRAMES, ENEMY_ROLL_LOOP_FRAMES,
  ENEMY_WALL_BOUNCE_VY, ENEMY_WALL_BOUNCE_KB_VX, ENEMY_WALL_BOUNCE_KB_DECAY,
  ENEMY_ROLL_KB_VX, ENEMY_ROLL_KB_DECAY,
  ENEMY_DOWN_BURST_START_FRAMES, ENEMY_DOWN_BURST_LOOP_FRAMES, ENEMY_DOWN_BOUND_FRAMES,
  KB_BURST_VX, KB_BURST_VY, KB_BURST_SPIN_RATE, KB_BURST_GRAV_MULT,
  ENEMY_AIRBORNE_Y_THRESHOLD,
  KB_LV05_BOUNCE_VY,
  KB_LV06_VY, KB_LV06_VX_MULT,
  applyRollHipPivot,
} from './states.js';
import { PHYSICS, ENEMY_AI, DUMMY_ATK_CONFIG, ENEMY_ATTACKS, ENEMY_ATTACK_RELAY, SPECIAL_CONFIG, STATUS_STUN_CONFIG, GORE_CONFIG, GORE_CRITICAL_CONFIG, PLAYER_PROFILE, ENEMY_PERSONALITY, ENEMY_REACT_CONFIG, ENEMY_ENRAGE_CONFIG, MIDBOSS_SHIELD_CONFIG, BOSS01_CONFIG, BURN_CONFIG, BOSS_MEGA_CONFIG, SP_CONFIG } from './config.js';
import { spawnHitParticles, spawnTrailDot, triggerShake, triggerHitstop, triggerCharShake, tryThrownChainHit, triggerBurstState, combo, spawnDeathExplosion, spawnBlastSphere, spawnLaunchSmoke, fxState } from './hit-engine.js';
import { spawnBanner, spawnDamageNumber } from './hud-system.js';
import { tryPinballHit } from './pinball.js';
import { ATTACKS } from './attacks.js';
import { isHitstunState, tryHitPlayer, damagePlayer, tintBody, restoreBodyColor } from './damage-system.js';
import { getActiveWallX, getKnockbackWallX } from './camera.js';
import { dropCR, collectAllCR } from './cr-system.js';
import { dropSingleRandomChip, dropBossChips, collectAllItems } from './item-system.js';
import { recordKill, recordDamage } from './run-stats.js';

let _THREE = null;
let _scene = null;
let _players = null;
let _enemies = null;

// cunning の密集回避（14-D-3・enem01.md §性格軸 レイヤー3）。
//   cunning は個別の laneZ（プレイヤー Z からのオフセット）を狙って散開する。
const LANE_Z_MAX           = 55;  // laneZ の最大幅（±・rangeZ 80 内に収め攻撃は届く）
const LANE_HOMING_DEADZONE = 25;  // cunning が laneZ に乗ったとみなす許容 Z
const LANE_REROLL_FRAMES   = 90;  // laneZ 振り直し判定の間隔
const LANE_CLUSTER_Z       = 35;  // 「同レーン」とみなす laneZ 差
const LANE_CLUSTER_DIST    = 220; // 「近接」とみなす実距離

// 敵同士の攻撃テンポ（14-D-5）：直近の攻撃終了から次の攻撃が始められるまでの全体待ち。
// 0 になるまで誰も攻撃を開始できない。攻撃完了ごとにばらつき付きで再セットされる。
let _attackRelay = 0;
// タックル専用グローバルCD：誰かがタックル開始 → TACKLE_RELAY フレームは全員タックル禁止。
// コンボ中に連続タックルで割り込まれる状況を防ぐ。
let _globalTackleRelay = 0;

let _addStaticArea         = null;
let _addRectArea           = null;
let _addSemicircleArea     = null;
let _updateAreaPosition    = null;
let _updateAreaScale       = null;
let _updateAreaRotation    = null;
let _removeArea            = null;
let _triggerBossMegaCrashFX = null;  // fx-system から注入

export function initEnemySystem(deps) {
  _THREE = deps.THREE;
  _scene = deps.scene;
  _players = deps.players;
  _enemies = deps.enemies;
  _addStaticArea          = deps.addStaticArea         ?? null;
  _addRectArea            = deps.addRectArea           ?? null;
  _addSemicircleArea      = deps.addSemicircleArea     ?? null;
  _updateAreaPosition     = deps.updateAreaPosition    ?? null;
  _updateAreaScale        = deps.updateAreaScale       ?? null;
  _updateAreaRotation     = deps.updateAreaRotation    ?? null;
  _removeArea             = deps.removeArea            ?? null;
  _triggerBossMegaCrashFX = deps.triggerBossMegaCrashFX ?? null;
}

// ============================================================
//  汎用障害物回避（案B・2026-05-29）：歩行 chase で PL へ直進すると mid-arena 障害物
//  （落とし穴・将来の中央壁/柱 等）に阻まれてピン留めする問題への navigation-lite。
//   - 障害物 = 敵が回り込むべきブロック矩形。Phase1 は window.SB.FLOOR_HOLES（穴）。
//     将来の障害物源はここに足す（registerNavObstacle 的窓口へ拡張可）。
//   - PL への X 接近を阻む障害物があれば、近い Z 縁の外へ回り込む。回り込み方向は
//     X-span を抜けるまで保持（_navDetourObs / _navDetourZSign）＝ジッタ防止。
//   - 戻り値 true: X/Z 移動を本関数が処理した（呼び元の通常接近をスキップ）。
//   - 既知の Phase1 限界：PL が同 X で穴の Z 向こうに居る純 Z 経路は未対応（要なら拡張）。
// ============================================================
const NAV_AVOID_MARGIN = 80;   // 回り込み時に縁から離すクリアランス（block margin 50 の外を保つ）
const NAV_PATH_MARGIN  = 10;   // 経路交差判定に使う「実穴」マージン（小さく＝PL が穴脇に立っても往復しない）

// 線分 (x0,z0)-(x1,z1) が AABB[rxMin..rxMax, rzMin..rzMax] と交差するか（Liang-Barsky）。
function _segIntersectsRect(x0, z0, x1, z1, rxMin, rzMin, rxMax, rzMax) {
  if ((x0 >= rxMin && x0 <= rxMax && z0 >= rzMin && z0 <= rzMax) ||
      (x1 >= rxMin && x1 <= rxMax && z1 >= rzMin && z1 <= rzMax)) return true;
  let t0 = 0, t1 = 1;
  const dX = x1 - x0, dZ = z1 - z0;
  const p = [-dX, dX, -dZ, dZ];
  const q = [x0 - rxMin, rxMax - x0, z0 - rzMin, rzMax - z0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else          { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return t0 <= t1;
}

// 敵→PL の直線が「実穴（±NAV_PATH_MARGIN）」を横切るか。
function _pathBlockedByHole(e, p0, r) {
  const mb = NAV_PATH_MARGIN;
  return _segIntersectsRect(e.x, e.z, p0.x, p0.z, r.xMin - mb, r.zMin - mb, r.xMax + mb, r.zMax + mb);
}

// 障害物回避デバッグログ（SB.DEBUG_NAV_AVOID = true で START/CLEAR/ACTIVE を出力）。
//   暴走/往復/張り付きの再発を eval なしで追うため（finicky なので常設・安定後に削除可）。
function _navLog(e, label, obj) {
  if (typeof window !== 'undefined' && window.SB?.DEBUG_NAV_AVOID) {
    console.log(`[NAV ${label}] ${e.enemyType ?? '?'}`, obj ?? '');
  }
}

function _steerAroundNavObstacles(e, p0, dx, appSpd, zChaseFactor) {
  const holes = (typeof window !== 'undefined' && window.SB?.FLOOR_HOLES) || null;
  if (!holes || holes.length === 0) { e._navDetourObs = null; return false; }

  // 経路を阻む障害物を選ぶ：継続中があり、まだ直線が横切るなら保持（sticky）。さもなくば新規探索。
  const _wasDetouring = !!e._navDetourObs;
  let r = null;
  if (e._navDetourObs && _pathBlockedByHole(e, p0, e._navDetourObs)) {
    r = e._navDetourObs;
  } else {
    e._navDetourObs = null;
    for (const h of holes) {
      if (h.rect && _pathBlockedByHole(e, p0, h.rect)) { r = h.rect; break; }
    }
  }
  if (!r) {
    if (_wasDetouring) _navLog(e, 'CLEAR', { x: Math.round(e.x), z: Math.round(e.z) });
    return false;
  }

  // 回り込み側 Z をコミット（直線が抜けるまで保持）：PL が span 外ならその Z 側へ（最短）、
  //   span 内なら自分の近い側へ。
  if (e._navDetourObs !== r) {
    e._navDetourObs = r;
    const center = (r.zMin + r.zMax) / 2;
    const ref = (p0.z < r.zMin || p0.z > r.zMax) ? p0.z : e.z;
    e._navDetourZSign = (ref <= center) ? -1 : 1;
    // 目標角の X 側も detour 開始時にコミット（PL が穴中心付近をうろつくと毎フレーム Tx が
    //   左右フリップして角を往復するのを防ぐ＝抜けるまで固定）。
    e._navDetourTxSide = (p0.x >= (r.xMin + r.xMax) / 2) ? 1 : -1;
    e._navLogTick = 0;
    _navLog(e, 'START', {
      rect: `x${r.xMin}..${r.xMax} z${r.zMin}..${r.zMax}`, zSign: e._navDetourZSign, txSide: e._navDetourTxSide,
      ex: Math.round(e.x), ez: Math.round(e.z), px: Math.round(p0.x), pz: Math.round(p0.z),
    });
  }
  const zSign = e._navDetourZSign;
  const c = NAV_AVOID_MARGIN;
  const HxMin = r.xMin - c, HxMax = r.xMax + c;
  const HzMin = r.zMin - c, HzMax = r.zMax + c;
  // 目標コーナー：コミット済み X 側 × コミット Z 側の「穴の外角」（detour 中フリップしない）。
  const Tx = (e._navDetourTxSide > 0) ? HxMax : HxMin;
  // Tz は縁ちょうどでなく少し外側へ（z が縁で 1 足りず zCleared を満たさず X がロックする
  //   off-by-one デッドロック防止）。
  const Tz = (zSign < 0) ? HzMin - 6 : HzMax + 6;
  const zSpd = PHYSICS.SPEED * PHYSICS.Z_SPEED_MULT * zChaseFactor;
  // Z：コミット側の縁外へ寄せる
  const dZ = Tz - e.z;
  if (Math.abs(dZ) > 1) e.z += Math.sign(dZ) * Math.min(zSpd, Math.abs(dZ));
  // X：z が span 外なら目標角 Tx へ（Math.min で角を越えない＝画面端への暴走防止）。
  //    span 内はフリーズ/後退せず穴手前縁まで詰める。
  if (e.z <= HzMin || e.z >= HzMax) {
    const dX = Tx - e.x;
    if (Math.abs(dX) > 1) e.x += Math.sign(dX) * Math.min(appSpd, Math.abs(dX));
  } else {
    const dirX = Math.sign(Tx - e.x) || 1;
    const nearEdgeX = (dirX > 0) ? HxMin : HxMax;
    if (dirX > 0 && e.x < nearEdgeX)      e.x = Math.min(e.x + appSpd, nearEdgeX);
    else if (dirX < 0 && e.x > nearEdgeX) e.x = Math.max(e.x - appSpd, nearEdgeX);
  }
  // 継続中の throttled ログ（20F おき・かつ動いた時のみ＝停止中のスパム防止）：軌跡確認用
  if ((((e._navLogTick = (e._navLogTick ?? 0) + 1)) % 20) === 0) {
    const rx = Math.round(e.x), rz = Math.round(e.z);
    if (e._navLastLogX !== rx || e._navLastLogZ !== rz) {
      _navLog(e, 'ACTIVE', { x: rx, z: rz, Tx: Math.round(Tx), Tz: Math.round(Tz), zClr: (e.z <= HzMin || e.z >= HzMax) });
      e._navLastLogX = rx; e._navLastLogZ = rz;
    }
  }
  return true;
}

// ============================================================
//  敵ジャンプ — プレイヤーの jump_* state を共用（被弾の空中同期に必要）
// ============================================================
//  自発的にジャンプする敵は少ない想定だが、攻撃や AI で空中へ移行する敵を
//  カバーするための入口。物理は updateEnemies の重力ブロックが担い、
//  jump_loop 着地で jump_end → wait01 に戻る。
//  opts: { vy?: 上昇初速（既定 PHYSICS.JUMP_V）/ vx?: 水平初速 / dash?: ダッシュ版 }
export function jumpEnemy(e, opts = {}) {
  if (!e || !e.isAlive || e.state !== STATE.wait01) return false;
  if (e.y > ENEMY_AIRBORNE_Y_THRESHOLD) return false;  // 既に空中なら不可
  const dash = !!opts.dash;
  e.vy = opts.vy ?? PHYSICS.JUMP_V;
  if (opts.vx !== undefined) {
    e.knockbackVx = opts.vx;
    e.kbDecay     = opts.vxDecay ?? 0.98;  // ジャンプ移動は緩減衰（被弾 KB と区別）
  }
  e.state            = dash ? STATE.jump_d_start : STATE.jump_start;
  e.downTimer        = dash ? ENEMY_JUMP_D_START_FRAMES : ENEMY_JUMP_START_FRAMES;
  e.launcherAirborne = false;
  e.peakHangTimer    = 0;
  e.prevVy           = e.vy;
  return true;
}

// ============================================================
//  メッシュ構築：胴体 + 頭 + 脚 + 向き確認ノーズ
// ============================================================
export function buildDummyMesh() {
  const group = new _THREE.Group();
  // rotation.y（向き）と rotation.z（傾き）を同時に使うため ZYX 順序が必要。
  // XYZ のままだと R_y * R_z で tilt がカメラ奥行き方向に出る。
  // ZYX では R_z * R_y となりスクリーン左右方向に正しく傾く。
  group.rotation.order = 'ZYX';
  // 敵仮モデル：濃い緑系統（2026-05-20 METEO 赤との視認性確保）
  const baseMat = new _THREE.MeshToonMaterial({ color: 0x2d4a22 });    // ダーク オリーブグリーン
  const accentMat = new _THREE.MeshToonMaterial({ color: 0x77aa55 });  // 差し色：ミディアムグリーン

  // 胴体（やや大きめ）
  const body = new _THREE.Mesh(new _THREE.BoxGeometry(70, 130, 60), baseMat);
  body.position.y = 80;
  body.castShadow = true;
  group.add(body);

  // 頭
  const head = new _THREE.Mesh(new _THREE.BoxGeometry(45, 40, 40), accentMat);
  head.position.y = 165;
  head.castShadow = true;
  group.add(head);

  // 脚（一体化した台座風）
  const stand = new _THREE.Mesh(new _THREE.BoxGeometry(60, 30, 60), accentMat);
  stand.position.y = 15;
  stand.castShadow = true;
  group.add(stand);

  // 向き確認用ノーズ（頭前面 +Z にコーン）：赤は METEO と被るので黄に変更（2026-05-20）
  //   2026-05-20：head の子に配置（dying 抽選で「鼻だけ単独で飛ぶ」を防止）
  //   local 座標：head の local 原点 (0, 165, 0) からの差分 → (0, 0, 30)
  const noseMat = new _THREE.MeshToonMaterial({ color: 0xffdd22 });
  const nose = new _THREE.Mesh(new _THREE.ConeGeometry(6, 20, 8), noseMat);
  nose.rotation.x = -Math.PI / 2; // コーン先端を +Z（前方）に向ける
  nose.position.set(0, 0, 30);
  head.add(nose);

  // parts dict は body / head / stand のみ（nose は head のサブ）
  // → detachOnePart の抽選で nose 単独になることを排除
  // → head が detach されると Three.js 親子で nose も付いてくる
  group.userData.parts = { body, head, stand };
  group.userData.subParts = { nose };  // 参考用に残す（material 操作などで参照）
  group.userData.baseColors = { body: 0x2d4a22, head: 0x77aa55 };  // hitFlash 復元用

  // === HP バー（敵頭上・初回被弾でフェードイン・dying で消滅）===
  // 本実装も意識して：scene 直配置で敵の rotation を継承しない
  //   - bg（暗色背景・常時 full 幅）
  //   - fill（赤・左端アンカー：geometry.translate で原点を左端に移動 → scale.x = hp/maxHp で右端が左へ shrink）
  // 配置・visibility 更新は updateEnemies で毎フレーム sync
  const HP_BAR_W = 80;
  const HP_BAR_H = 6;
  const bgGeom = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  const bg = new _THREE.Mesh(
    bgGeom,
    new _THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.85 })
  );
  const fillGeom = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  fillGeom.translate(HP_BAR_W / 2, 0, 0);  // 原点を左端に → scale.x で右端だけ shrink
  const fill = new _THREE.Mesh(
    fillGeom,
    new _THREE.MeshBasicMaterial({ color: 0xff3322 })
  );
  bg.visible = false;
  fill.visible = false;
  group.userData.hpBar = { bg, fill, fullWidth: HP_BAR_W, yOffset: 220 };
  // scene への add は spawnDummy 側で行う（_scene 参照のため）
  return group;
}

// ============================================================
//  メッシュ構築：enem02 ジャンパー（小型・シアン系）
// ============================================================
export function buildDummy02Mesh() {
  const group = new _THREE.Group();
  group.rotation.order = 'ZYX';
  const baseMat   = new _THREE.MeshToonMaterial({ color: 0x1144cc });  // 青（基本色）
  const accentMat = new _THREE.MeshToonMaterial({ color: 0x4488ff });  // 明るい青（アクセント）
  const legMat    = new _THREE.MeshToonMaterial({ color: 0x0d3399 });  // 濃い青（脚）

  // 胴体（横広・低重心）
  const body = new _THREE.Mesh(new _THREE.BoxGeometry(75, 40, 65), baseMat);
  body.position.y = 75;
  body.castShadow = true;
  group.add(body);

  // 頭（前方にせり出す）
  const head = new _THREE.Mesh(new _THREE.BoxGeometry(50, 38, 48), accentMat);
  head.position.set(0, 112, -8);
  head.castShadow = true;
  group.add(head);

  // 4本足（前後2対）
  const legGeo = new _THREE.BoxGeometry(14, 55, 14);
  const legOffsets = [
    [-26, 27, -24],  // 前左
    [ 26, 27, -24],  // 前右
    [-26, 27,  24],  // 後左
    [ 26, 27,  24],  // 後右
  ];
  const legs = legOffsets.map(([lx, ly, lz]) => {
    const leg = new _THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    group.add(leg);
    return leg;
  });

  // センサー目（白発光）
  const eyeMat = new _THREE.MeshToonMaterial({
    color: 0xffffff, emissive: 0x88ccff, emissiveIntensity: 0.9,
  });
  const eye = new _THREE.Mesh(new _THREE.BoxGeometry(20, 9, 4), eyeMat);
  eye.position.set(0, 0, 26);
  head.add(eye);

  group.userData.parts = { body, head, legs };
  group.userData.subParts = { eye };
  group.userData.baseColors = { body: 0x1144cc, head: 0x4488ff, legs: 0x0d3399 };  // hitFlash 復元用

  // HP バー
  const HP_BAR_W = 70;
  const HP_BAR_H = 5;
  const bgGeom = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  const bg = new _THREE.Mesh(bgGeom, new _THREE.MeshBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.85,
  }));
  const fillGeom = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  fillGeom.translate(HP_BAR_W / 2, 0, 0);
  const fill = new _THREE.Mesh(fillGeom, new _THREE.MeshBasicMaterial({ color: 0xff3322 }));
  bg.visible = false;
  fill.visible = false;
  group.userData.hpBar = { bg, fill, fullWidth: HP_BAR_W, yOffset: 165 };
  return group;
}

// ============================================================
//  メッシュ構築：midboss01 シールドガーダー（中ボス相当・グレー系）
//  左腕：大型盾 / 右腕：マチェット
// ============================================================
export function buildMidboss01Mesh() {
  const group = new _THREE.Group();
  group.rotation.order = 'ZYX';
  const bodyMat   = new _THREE.MeshToonMaterial({ color: 0x888888 });  // 中グレー
  const darkMat   = new _THREE.MeshToonMaterial({ color: 0x555555 });  // 暗グレー（台座）
  const shieldMat = new _THREE.MeshToonMaterial({ color: 0xaaaaaa });  // 明るいグレー（盾面）
  const bladeMat  = new _THREE.MeshToonMaterial({ color: 0xdddddd });  // 刃色（マチェット）

  // 胴体（enem01 より一回り大きい）
  const body = new _THREE.Mesh(new _THREE.BoxGeometry(85, 145, 72), bodyMat);
  body.position.y = 87;
  body.castShadow = true;
  group.add(body);

  // 頭
  const head = new _THREE.Mesh(new _THREE.BoxGeometry(55, 52, 50), bodyMat);
  head.position.y = 188;
  head.castShadow = true;
  group.add(head);

  // 台座（足台）
  const stand = new _THREE.Mesh(new _THREE.BoxGeometry(75, 32, 72), darkMat);
  stand.position.y = 16;
  stand.castShadow = true;
  group.add(stand);

  // 左腕
  const larm = new _THREE.Mesh(new _THREE.BoxGeometry(22, 95, 22), bodyMat);
  larm.position.set(-70, 105, 0);
  larm.castShadow = true;
  group.add(larm);

  // 盾（左腕先端の大型フラット盾）
  const shield = new _THREE.Mesh(new _THREE.BoxGeometry(14, 120, 95), shieldMat);
  shield.position.set(-93, 105, 0);
  shield.castShadow = true;
  group.add(shield);

  // 右腕
  const rarm = new _THREE.Mesh(new _THREE.BoxGeometry(22, 90, 22), bodyMat);
  rarm.position.set(70, 105, 0);
  rarm.castShadow = true;
  group.add(rarm);

  // マチェット（右腕先端・縦長の刃）
  const machete = new _THREE.Mesh(new _THREE.BoxGeometry(9, 130, 25), bladeMat);
  machete.position.set(92, 82, 0);
  machete.castShadow = true;
  group.add(machete);

  group.userData.parts = { body, head, stand };
  group.userData.baseColors = { body: 0x888888, head: 0x888888 };
  // 盾 mesh の参照を保持（盾破壊時に visible=false にする。parts には入れない＝
  //   死亡時のパーツ分離抽選を汚染しないため）。
  group.userData.shield = shield;

  // ガードドーム（ガード時＝青 / SHIELD BREAK 時＝白拡大）
  //   プレイヤーの guardShield と同系の半球エフェクト。
  //   scene への add は spawnDummy() 側で実施（ここでは scene 参照なし）。
  const guardDome = new _THREE.Mesh(
    new _THREE.SphereGeometry(75, 24, 16, 0, Math.PI, 0, Math.PI),
    new _THREE.MeshBasicMaterial({
      color: 0x66ccff, transparent: true, opacity: 0,
      side: _THREE.DoubleSide, depthWrite: false,
    }),
  );
  guardDome.visible = false;
  group.userData.guardDome = guardDome;

  // HP バー（中ボス：幅広め）
  const HP_BAR_W = 100;
  const HP_BAR_H = 6;
  const bgGeom   = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  const bg       = new _THREE.Mesh(bgGeom, new _THREE.MeshBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.85,
  }));
  const fillGeom = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  fillGeom.translate(HP_BAR_W / 2, 0, 0);
  const fill = new _THREE.Mesh(fillGeom, new _THREE.MeshBasicMaterial({ color: 0xff3322 }));
  bg.visible   = false;
  fill.visible = false;
  group.userData.hpBar = { bg, fill, fullWidth: HP_BAR_W, yOffset: 248 };
  return group;
}

// ============================================================
//  メッシュ構築：boss01 CRUSHER（Stage1 本ボス・2 脚直立人型・スケール 4 倍）
//  仕様：chars/boss01.md / 議論：discussions/boss01-stage1-design.md
//  スタブ：midboss01 メッシュを BOSS01_CONFIG.MESH_SCALE 倍に拡大し色を CRUSHER 想定に変更
//  TODO: 専用モデル（クラッシャー腕 / 肩ランチャー / コア）を art-reference 連動で設計
// ============================================================
export function buildBoss01Mesh() {
  const group = new _THREE.Group();
  group.rotation.order = 'ZYX';
  const SCALE = BOSS01_CONFIG.MESH_SCALE;  // 4.0
  // CRUSHER の色：重工業感のあるダーク + 警告色のアクセント
  const bodyMat   = new _THREE.MeshToonMaterial({ color: 0x554444 });  // 暗い赤茶（鈍重感）
  const darkMat   = new _THREE.MeshToonMaterial({ color: 0x332222 });  // さらに暗い（脚部）
  const accentMat = new _THREE.MeshToonMaterial({ color: 0xcc4422 });  // 警告色アクセント
  const crusherMat = new _THREE.MeshToonMaterial({ color: 0x666666 }); // クラッシャー（金属）

  // 胴体（巨大）
  const body = new _THREE.Mesh(new _THREE.BoxGeometry(85 * SCALE, 145 * SCALE, 72 * SCALE), bodyMat);
  body.position.y = 87 * SCALE;
  body.castShadow = true;
  group.add(body);

  // 頭（小さめ・コア感）
  const head = new _THREE.Mesh(new _THREE.BoxGeometry(45 * SCALE, 42 * SCALE, 42 * SCALE), accentMat);
  head.position.y = 188 * SCALE;
  head.castShadow = true;
  group.add(head);

  // 台座 / 脚部基部
  const stand = new _THREE.Mesh(new _THREE.BoxGeometry(95 * SCALE, 40 * SCALE, 80 * SCALE), darkMat);
  stand.position.y = 20 * SCALE;
  stand.castShadow = true;
  group.add(stand);

  // 肩部アクセント（警告色）— ピボットより先に追加して奥に描画
  const lshoulder = new _THREE.Mesh(new _THREE.BoxGeometry(38 * SCALE, 32 * SCALE, 38 * SCALE), accentMat);
  lshoulder.position.set(-60 * SCALE, 160 * SCALE, 0);
  lshoulder.castShadow = true;
  group.add(lshoulder);

  const rshoulder = new _THREE.Mesh(new _THREE.BoxGeometry(38 * SCALE, 32 * SCALE, 38 * SCALE), accentMat);
  rshoulder.position.set(60 * SCALE, 160 * SCALE, 0);
  rshoulder.castShadow = true;
  group.add(rshoulder);

  // 左腕クラッシャー — ピボットGroup（肩頂点 = y:155*SCALE）で回転させることで腕振りアニメを実現
  // arm center offset from pivot: y = 100 - 155 = -55、crusher: 38 - 155 = -117
  const lArmPivot = new _THREE.Group();
  lArmPivot.position.set(-78 * SCALE, 155 * SCALE, 0);
  const larm = new _THREE.Mesh(new _THREE.BoxGeometry(32 * SCALE, 110 * SCALE, 32 * SCALE), bodyMat);
  larm.position.set(0, -55 * SCALE, 0);
  larm.castShadow = true;
  lArmPivot.add(larm);
  const lcrusher = new _THREE.Mesh(new _THREE.BoxGeometry(50 * SCALE, 45 * SCALE, 50 * SCALE), crusherMat);
  lcrusher.position.set(0, -117 * SCALE, 0);
  lcrusher.castShadow = true;
  lArmPivot.add(lcrusher);
  group.add(lArmPivot);

  // 右腕クラッシャー — 同上
  const rArmPivot = new _THREE.Group();
  rArmPivot.position.set(78 * SCALE, 155 * SCALE, 0);
  const rarm = new _THREE.Mesh(new _THREE.BoxGeometry(32 * SCALE, 110 * SCALE, 32 * SCALE), bodyMat);
  rarm.position.set(0, -55 * SCALE, 0);
  rarm.castShadow = true;
  rArmPivot.add(rarm);
  const rcrusher = new _THREE.Mesh(new _THREE.BoxGeometry(50 * SCALE, 45 * SCALE, 50 * SCALE), crusherMat);
  rcrusher.position.set(0, -117 * SCALE, 0);
  rcrusher.castShadow = true;
  rArmPivot.add(rcrusher);
  group.add(rArmPivot);

  group.userData.parts = { body, head, stand, lArmPivot, rArmPivot };
  group.userData.baseColors = { body: 0x554444, head: 0xcc4422 };

  // HP バー（本ボス：幅広・高位置）
  const HP_BAR_W = 140;
  const HP_BAR_H = 8;
  const bgGeom   = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  const bg       = new _THREE.Mesh(bgGeom, new _THREE.MeshBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.85,
  }));
  const fillGeom = new _THREE.PlaneGeometry(HP_BAR_W, HP_BAR_H);
  fillGeom.translate(HP_BAR_W / 2, 0, 0);
  const fill = new _THREE.Mesh(fillGeom, new _THREE.MeshBasicMaterial({ color: 0xff2211 }));
  bg.visible   = false;
  fill.visible = false;
  group.userData.hpBar = { bg, fill, fullWidth: HP_BAR_W, yOffset: 230 * SCALE };
  return group;
}

// ============================================================
//  ダミー敵を 1 体生成して enemies に追加する共通ヘルパ
//  Phase 2.4：複数体スポーンに対応。位置 (x, z) を指定して呼ぶ
// ============================================================
export function spawnDummy(x, z, opts = {}) {
  const _enemyType = opts.enemyType ?? 'enem01';
  const mesh = (_enemyType === 'enem02') ? buildDummy02Mesh()
             : (_enemyType === 'midboss01') ? buildMidboss01Mesh()
             : (_enemyType === 'boss01') ? buildBoss01Mesh()
             : buildDummyMesh();
  mesh.position.set(x, 0, z);
  // rotation.order='ZYX'：rotation.z（横倒し）と rotation.x（前後傾）両方を正しく見せる
  // YXZ/XYZ だと ry=±π/2 と rz の組み合わせで head が +Z 方向（カメラ手前）に倒れて見える
  // ZYX なら rz は player から見て横方向（±X 軸）に倒れる正しい挙動になる
  mesh.rotation.order = 'ZYX';
  mesh.rotation.y = -Math.PI / 2; // 初期向き：左向き（プレイヤー方向）
  _scene.add(mesh);
  // HP バー meshes を scene 直下に追加（敵 mesh の rotation/scale を継承しないため）
  if (mesh.userData.hpBar) {
    _scene.add(mesh.userData.hpBar.bg);
    _scene.add(mesh.userData.hpBar.fill);
  }
  // ガードドームも scene 直下に追加（enemy mesh の rotation を継承しないため）
  if (mesh.userData.guardDome) _scene.add(mesh.userData.guardDome);
  const _maxHp = (typeof opts.maxHp === 'number' && opts.maxHp > 0) ? opts.maxHp : 100;
  // 性格（#14）：opts 指定 → なければ既定（midboss01 は berserker / その他 brave）
  const _personality = ENEMY_PERSONALITY[opts.personality] ? opts.personality
                     : (_enemyType === 'midboss01' ? 'berserker' : 'brave');
  const _persona = ENEMY_PERSONALITY[_personality];
  const e = {
    mesh,
    x: x, y: 0, z: z,
    // Phase 3-B：リスポーン用に初期位置と opts を保存（mortal 自動リスポーン時に再利用）
    _spawnX: x,
    _spawnZ: z,
    _spawnOpts: { ...opts },
    hp:             _maxHp,
    maxHp:          _maxHp,
    hitFlashTimer:  0,
    knockbackVx:    0,
    knockbackVz:    0,
    vy:               0,
    prevVy:           0,
    peakHangTimer:    0,
    peakHangTotal:    0,
    launcherAirborne: false,
    kbFromMega:       false,
    pitchAngle:       0,
    frozenByUlt:      false,
    ultBurstInvincible: false,  // ULT 由来の burst-down 中フラグ：起き上がる（wait01 復帰）まで完全無敵・メガクラも受け付けない
    // 飛行系状態の再突入カウンタ（コンボ中累積・wait01 復帰でリセット・2026-05-18）
    launchResistTimer:     0,    // midboss01 打ち上げ耐性：> 0 でカウントダウン → 0 で強制着地
    passiveSaHp:           0,    // midboss01 恒常 SA：盾破壊後にセット、攻撃フェーズ問わず吸収
    passiveSaRecharge:     0,    // 吸収後のリチャージカウンタ（> 0 の間 passiveSaHp は 0）
    recoverSaTimer:        0,    // recover 前半 SA 継続カウンタ（> 0 の間は active SA が有効）
    superFlightCount:      0,    // down_super_* 突入回数
    wallHitCount:          0,    // down_wall_* 突入回数
    lateralCombatInvincible: false,  // 2 回目以降の飛行系突入で立つフラグ：wait01 まで完全無敵
    skipWallCollision:     false,  // 2 回目以降の down_super で壁ヒット遷移をスキップ → 地面で down_roll_start
    burstSpinRate:    0,
    burstGravMult:    0,
    burstRollAngle:   0,
    rollDebugAngle:   0,  // down_roll_start 中のデバッグ可視化用ロール角（2026-05-18）
    rollDir:          0,  // 転がり方向（±1・現在の knockbackVx 符号で決定・2026-05-18）
    isWallBounce:    false, // 壁バウンス中フラグ：被弾時に通常 knockback への遷移を許可（2026-05-18）
    grabbedBy:        null,
    state:            STATE.wait01,
    tiltAngle:        0,
    fallDir:          1,
    downTimer:        0,
    isAlive:          true,
    facing:           -1,
    enemyType:        _enemyType,           // 'enem01' / 'enem02' / 'midboss01' / 'boss01' etc.
    // ガード強度：atk_lv がこの値以下の前面攻撃をガード成立で受ける（per-enemy）
    guardStrength:    opts.guardStrength ?? (_enemyType === 'midboss01' ? 4 : 3),
    // ===== boss01 専用フィールド（仕様：chars/boss01.md / TODO: フェーズ移行ロジック実装は別セッション）=====
    isBoss:            (_enemyType === 'boss01'),
    // ボス大柄補正：e.x はボス中心だが体幅が大きいため
    // tryHitEnemies の rangeX/Z 判定に加算して「体端に当たる」を正しく検出する
    hitReceiveExpandX: (_enemyType === 'boss01') ? BOSS01_CONFIG.BODY_HALF_X : 0,
    hitReceiveExpandZ: (_enemyType === 'boss01') ? BOSS01_CONFIG.BODY_HALF_Z : 0,
    bossPhase:         (_enemyType === 'boss01') ? 1 : 0,  // 1 / 2 / 3
    bossPhaseGateHP:   (_enemyType === 'boss01')
                         ? [BOSS01_CONFIG.PHASE_1_TO_2_GATE_HP, BOSS01_CONFIG.PHASE_2_TO_3_GATE_HP, 0]
                         : null,
    bossPhaseTransitioning: false,  // フェーズ移行演出中フラグ
    bossFullSA:        (_enemyType === 'boss01'),  // 完全 SA フラグ（boss01 は常時 true）
    bossSAStunTimer:   0,           // SA 崩しスタン残 F（RC 成功 / ULT 命中 / 大技 recover で立つ）
    bossSAHitCount:    0,           // SA 吸収済みヒット数（THRESHOLD 到達で knockback01・リセット）
    bossSADecayTimer:  0,           // 最終ヒットからの経過 F（DECAY_FRAMES 超でカウントリセット）
    bossStun:       false,       // スタン（atk_06 recover 後 / SA 解除 + 黒点滅 + KB固定・ボス専用）
    bossStunTimer:  0,           // スタン残 F
    _bossStunFrame: 0,           // 点滅 sin 用フレームカウンタ
    _missiles:      null,        // boss1_atk_05 (missile_barrage) 個別ミサイル管理配列
    // 盾システム（midboss01 専用）：本体 HP と独立した盾 HP。0 で盾破壊。
    //   midboss01 以外は shieldBroken=true（最初から盾なし扱い）で hit-engine 側分岐を 1 条件に。
    shieldMaxHp:      (_enemyType === 'midboss01') ? MIDBOSS_SHIELD_CONFIG.SHIELD_MAX_HP : 0,
    shieldHp:         (_enemyType === 'midboss01') ? MIDBOSS_SHIELD_CONFIG.SHIELD_MAX_HP : 0,
    shieldBroken:     (_enemyType !== 'midboss01'),
    shieldBlockTimer:      0,   // ガードドーム表示残F（hit-engine でセット）
    shieldBreakDomeTimer:  0,   // SHIELD BREAK 拡大フェードドーム残F
    shieldBlockCount:      0,   // 連続前面ブロック数（閾値でガードカウンター発動）
    guardCounterArmed:     false, // ガードカウンター即反撃フラグ
    _blockDecayTimer:      0,   // ブロックカウント自然減衰タイマー
    atkSlotIdx:            0,   // slash_rush 複数ヒットスロットインデックス
    superArmor:            0,   // SA 値（berserker midboss01 は triggerShieldBreak でセット）
    saHp:                  0,   // 現SA残HP（_beginEnemyAttack ごとにリセット）
    repulseWindow:         false, // リパルスカウンター受付中（aim フェーズで true・hit-engine 参照）
    slashHitFlash:         0,   // slash_rush ヒット瞬間の hitbox フラッシュ残F
    _tick:                 0,   // 点滅・パルス計算用フレームカウンタ
    // === ミニマム AI（Phase 2.4）===
    aiEnabled:        opts.aiEnabled ?? true,
    atkPhase:         null,
    atkTimer:         0,
    curAtkId:         null,   // 発動中の攻撃 ID（ENEMY_ATTACKS のキー・14-D）
    atkPitchTarget:   0,      // enemy_attacking 中の rotation.x 目標（atkPhase 別に設定）
    atkDashDist:      0,      // 突進タックル（kind=dash）の累積突進距離（14-D-2）
    atkCooldown:      opts.atkCooldown ?? 90,  // 初期は少し溜め（同時カウントを避けるため敵ごとに変える）
    hitDelivered:     false,
    // === Phase 3 AI ステート明示化 ===
    // aiPhase: 'idle' / 'chase' / 'attack' / 'retreat' / 'hitstun'
    //   - e.state とは独立軸。物理・見た目は state、AI 意思決定は aiPhase。
    //   - hitstun は state が被弾系/grabbed/dying/status_stun 等のときに自動同期（読み取り専用ラベル）。
    aiPhase:          'idle',
    aiRetreatTimer:   0,    // retreat 残F
    // === #14 雑魚行動：性格・役割・行動傾向 ===
    personality:      _personality,            // 'brave' / 'cunning'
    role:             opts.role ?? 'standalone',// 'standalone' / 'carrier' / 'escort'
    guardTendency:    _persona.guardTendency,   // 攻撃検知でガード姿勢に入る確率（14-B）
    dodgeTendency:    _persona.dodgeTendency,   // 攻撃検知で回避する確率（14-B）
    accumStagger:     0,                        // 連続被弾累積（閾値超で enemy_stagger・14-B）
    staggerThreshold: _persona.staggerThreshold,// よろめき発火の累積閾値（性格差）
    reactCooldown:    0,                        // dodge/guard 再発動クールダウン残F
    _reactArmed:      true,                     // 現プレイヤー攻撃に未反応なら true（1 攻撃 1 判定）
    dodgeInvuln:      false,                    // enemy_dodge 前半の無敵フラグ
    dodgePunish:      false,                    // cunning：回避完了後に突進タックルへ連携（14-D-3）
    // ダッシュ追跡（14-D-4）：遭遇後に自機が離れたら、ワンテンポ置いてダッシュで詰める
    encountered:      false,                    // 一度でも approachRange 内に入ったか
    dashChasing:      false,                    // ダッシュ追跡中フラグ
    dashChaseBeat:    -1,                       // ダッシュ開始前のワンテンポ残F（-1=未武装）
    // cunning の密集回避（14-D-3）：個別 Z レーンオフセット + 振り直しタイマー
    laneZ:            (_personality === 'cunning') ? (Math.random() * 2 - 1) * LANE_Z_MAX : 0,
    laneReRollTimer:  Math.floor(Math.random() * LANE_REROLL_FRAMES),
    enraged:          false,                    // 興奮状態（HP 低下で 1 度だけ true・14-C）
    enragedHp:        _persona.enragedHp,        // この HP 割合以下で enraged 化
    // === #14-D-2 攻撃頻度（性格別・enem01.md §性格軸 レイヤー1-3）===
    atk02Weight:      _persona.atk02Weight,      // 近/中の重なり帯で突進タックルを選ぶ確率
    cooldownMult:     _persona.cooldownMult,     // 攻撃クールダウン倍率（brave 短い）
    retreatMult:      _persona.retreatMult,      // 攻撃後 retreat の長さ倍率（brave ≈0）
    punishesHitstun:  _persona.punishesHitstun,  // プレイヤー被弾中でも攻撃する（brave 追撃確定）
    // === Phase 3 ステータス系（status_stun）===
    statusStunTimer:  0,    // status_stun 残F
    // === Phase 3-A/3-B 敵死亡（gore-scrap・2026-05-20 フラグ方式へリファクタ）===
    // instantRespawn=true：従来の練習用「HP 0 で即復活」モード（既存スポーン互換）
    // instantRespawn=false：HP 0 → e.dying=true。state は変えず、被弾系/AI 抑制は dying フラグで判定
    instantRespawn:   opts.instantRespawn ?? true,
    dying:            false,    // dying プロセス進行中フラグ（state とは独立）
    dyingPhase:       null,     // 'reacting' | 'stunned' | 'burst' | 'final' | 'exploded'
    dyingFadeTimer:   0,        // 色フェード残F
    dyingHoldTimer:   0,        // フォールバック分解タイマー（reacting/stunned 中に並列消費・満了で強制 final）
    dyingStunnedTimer: 0,       // stunned フェーズ残F（約 2 秒・直立操作不能）
    dyingFinalTimer:  0,        // final フェーズ（後方吹き飛び→爆散）残F
    dyingInvincible:  false,    // final 中の完全無敵フラグ（hit-engine が skip）
    removed:          false,    // 最終消滅 → cleanup pass で配列除去
    // === HP バー（2026-05-18 導入・初回被弾でフェードイン・dying で消滅）===
    hpBarShown:       false,
    // === ゴア・クリティカル（2026-05-18 導入）===
    // 死亡フロー突入時に 1 回だけ抽選される armed フラグ。
    // armed なら通常 fade/hold タイマーを bypass し、専用シーケンスへ。
    //   { armed, profile, hitter, phase: 'crit_freeze'|'crit_red'|'crit_white'|'crit_explode', timer }
    goreCritical:     null,
    // 最終ヒッター記録（hit-engine 側で毎ヒット上書き）。enterEnemyDying で profile lookup に使う
    lastHitter:       null,
    // === Phase 3-B 爆散（パーツ飛散・逐次分離型 2026-05-20）===
    flyingParts:      null,    // Array<{ mesh, name, x/y/z, vx/vy/vz, bounced, fadeTimer, angV* }>
    // === 投擲弾（グラブ投げ → 他敵衝突連鎖）===
    thrownProjectile: false,  // 飛行中フラグ（true なら他敵との衝突判定が走る）
    thrownByPlayer:   null,   // ダメージ帰属（コンボ・SP 加算用）
    thrownDir:        0,      // 飛行方向（+1=右 / -1=左）
    // === 延焼（burn）===
    // OC カード「点火」取得後、SP 命中 / GC 撃破で igniteEnemy 経由で付与される
    burnTimer:        0,    // 残フレーム（0 = 燃えていない）
    burnTickAcc:      0,    // 次 DoT tick までの累積
    burnSpreadAcc:    0,    // 次伝播判定までの累積
    burnSpreadChain:  0,    // 自分が受け継いだチェーン段数（連鎖上限制御）
    burnBlastReady:     false, // OC IGNITE: SP1 で点火済み → もう一度 SP1 で起爆
    detonateTimer:      0,     // OC IGNITE Phase3: > 0 の間カウントダウン → 0 で detonateBurn
    burnAutoBlastTimer: 0,     // OC CHAIN_BLAST: 点火時にセット → 0 で自動 detonateBurn
    burnFlameAcc:       0,    // 炎パーティクル間引きカウンタ
    burnSourceId:      null,  // 点火源 attack id（将来分析用）
    burnShells:      null,  // burn 中の BackSide オレンジ shell mesh（body/head 別）
  };
  _enemies.push(e);
  return e;
}

// ============================================================
//  延焼（burn）付与 API
//  - 素では呼ばれない。OC「点火」カード取得後に hit-engine / enterEnemyDyingBurst から呼ぶ
//  - 再点火：REFRESH_ON_REIGNITE=true なら残時間を max で更新（chain は維持）
//  - 連鎖伝播・死亡時爆発の各機能は BURN_CONFIG.*_ENABLED が true のときのみ updateEnemies 側で起動
// ============================================================
export function igniteEnemy(e, opts = {}) {
  if (!e || !e.isAlive || e.dying) return false;
  const cfg = BURN_CONFIG;
  const dur = (typeof opts.duration === 'number') ? opts.duration : cfg.DURATION_FRAMES;
  if (e.burnTimer > 0 && cfg.REFRESH_ON_REIGNITE) {
    e.burnTimer = Math.max(e.burnTimer, dur);
    // chain は維持（既存連鎖の上限制御を壊さない）
  } else if (e.burnTimer <= 0) {
    e.burnTimer         = dur;
    e.burnTickAcc       = 0;
    e.burnSpreadAcc     = 0;
    e.burnFlameAcc      = 0;
    e.burnSpreadChain   = opts.chain ?? 0;
    // OC CHAIN_BLAST: 新規点火時に自動爆発タイマーをセット
    e.burnAutoBlastTimer = BURN_CONFIG.DEATH_BLAST_ENABLED ? BURN_CONFIG.AUTO_BLAST_DELAY : 0;
    _attachBurnOutline(e);  // 新規点火時のみ shell 生成（再点火では使い回し）
    // 点火フラッシュ：白→オレンジ→赤 の 3 層爆炎 + 軽い shake で「決まった感」を出す
    // （SPREAD/CHAIN_BLAST 由来の派生点火でも同等に発火させる：演出として地味さの主原因）
    const fy = e.y + 80;
    spawnHitParticles(e.x, fy, e.z, 0xffffff,           cfg.IGNITE_FLASH_WHITE,  { type: 'omni', sizeScale: 1.2, speedMul: 1.2 });
    spawnHitParticles(e.x, fy, e.z, cfg.OUTLINE_COLOR,  cfg.IGNITE_FLASH_ORANGE, { type: 'omni', sizeScale: 1.1, speedMul: 1.1 });
    spawnHitParticles(e.x, fy, e.z, 0xff3322,           cfg.IGNITE_FLASH_RED,    { type: 'omni', sizeScale: 1.0, speedMul: 1.0 });
    triggerShake(cfg.IGNITE_FLASH_SHAKE_STRENGTH, cfg.IGNITE_FLASH_SHAKE_FRAMES);
  }
  e.burnSourceId = opts.sourceId ?? null;
  return true;
}

// 延焼アウトライン（shell-outline 方式）：body/head の BackSide コピーを少し大きめに重ね、
// MeshBasicMaterial で平坦オレンジ色にする。既存の outline shader（プレイヤー専用 RT 経路）には
// 触らない。Body emissive とぶつからないよう、本体マテリアルには介入しない。
function _attachBurnOutline(e) {
  if (!_THREE_REF || !e.mesh || !e.mesh.userData || !e.mesh.userData.parts) return;
  if (e.burnShells && e.burnShells.length > 0) return;  // 既に装着済み
  const cfg = BURN_CONFIG;
  const parts = e.mesh.userData.parts;
  const shells = [];
  for (const key of ['body', 'head']) {
    const part = parts[key];
    if (!part || !part.geometry || part.parent !== e.mesh) continue;
    const mat = new _THREE_REF.MeshBasicMaterial({
      color:        cfg.OUTLINE_COLOR,
      side:         _THREE_REF.BackSide,
      transparent:  true,
      opacity:      cfg.OUTLINE_OPACITY_MAX,
      depthWrite:   false,
    });
    const shell = new _THREE_REF.Mesh(part.geometry, mat);
    shell.scale.setScalar(cfg.OUTLINE_SCALE);
    shell.userData._isBurnShell = true;  // detach 抽選 / outline mask から除外できるよう識別
    part.add(shell);
    shells.push(shell);
  }
  e.burnShells = shells;
}

function _detachBurnOutline(e) {
  if (!e.burnShells || e.burnShells.length === 0) return;
  for (const sh of e.burnShells) {
    if (sh.parent) sh.parent.remove(sh);
    if (sh.material) sh.material.dispose();
  }
  e.burnShells = null;
}

// 内部：burn DoT/伝播/演出 tick（updateEnemies 内から呼ぶ）
//   - dying / grabbed / frozenByUlt は呼び出し側で skip 済み前提
function _updateBurnTick(e, ctx) {
  if (e.burnTimer <= 0) return;
  const cfg = BURN_CONFIG;
  e.burnTimer--;
  // burnTimer が切れた瞬間に shell を解放（次の if(0) で early-return する前に処理）
  if (e.burnTimer <= 0) {
    _detachBurnOutline(e);
    e.burnBlastReady     = false;   // 延焼自然消滅時は起爆準備もリセット
    e.burnAutoBlastTimer = 0;
    return;
  }
  // OC CHAIN_BLAST: 自動爆発タイマー（新規点火時にセット済み）
  if (e.burnAutoBlastTimer > 0) {
    e.burnAutoBlastTimer--;
    if (e.burnAutoBlastTimer === 0) {
      detonateBurn(e);
      return;
    }
  }
  // アウトライン点滅（sin 正弦波で MIN→MAX を往復）
  if (e.burnShells && e.burnShells.length > 0) {
    const t = (e._tick ?? 0);
    const phase = (Math.sin((2 * Math.PI * t) / cfg.OUTLINE_PULSE_FRAMES) + 1) * 0.5;  // 0..1
    const op = cfg.OUTLINE_OPACITY_MIN + (cfg.OUTLINE_OPACITY_MAX - cfg.OUTLINE_OPACITY_MIN) * phase;
    for (const sh of e.burnShells) { if (sh.material) sh.material.opacity = op; }
  }
  // 炎パーティクル（HP バー直下から立ち上る）
  e.burnFlameAcc++;
  if (e.burnFlameAcc >= cfg.FLAME_PARTICLE_INTERVAL_FRAMES) {
    e.burnFlameAcc = 0;
    spawnHitParticles(e.x, e.y + 80, e.z, cfg.FLAME_PARTICLE_COLOR, cfg.FLAME_PARTICLE_COUNT, { type: 'omni' });
  }
  // DoT：noSpGain / noKnockback 相当（プレイヤー操作に依存しない時間ダメージ）
  e.burnTickAcc++;
  if (e.burnTickAcc >= cfg.TICK_INTERVAL_FRAMES) {
    e.burnTickAcc = 0;
    e.hp -= cfg.DAMAGE_PER_TICK;
    recordDamage(cfg.DAMAGE_PER_TICK, 'element');
    e.hitFlashTimer = Math.max(e.hitFlashTimer, 4);
    spawnDamageNumber(e.x, e.y + 130, e.z, cfg.DAMAGE_PER_TICK, { crit: true });
    // hp<=0 になっても updateEnemies の死亡判定が同フレーム後段で動くので、ここでは hp 削るだけで OK
  }
  // 伝播（OC SPREAD カードで ON）
  if (cfg.SPREAD_ENABLED && e.burnSpreadChain < cfg.SPREAD_MAX_CHAINS) {
    e.burnSpreadAcc++;
    if (e.burnSpreadAcc >= cfg.SPREAD_INTERVAL_FRAMES) {
      e.burnSpreadAcc = 0;
      _trySpreadBurn(e);
    }
  }
}

// 最近接の非 burn 敵に伝播（半径 SPREAD_RADIUS 以内・1 体のみ）
function _trySpreadBurn(src) {
  const cfg = BURN_CONFIG;
  const r2 = cfg.SPREAD_RADIUS * cfg.SPREAD_RADIUS;
  let best = null, bestD2 = r2 + 1;
  for (const o of _enemies) {
    if (o === src || !o.isAlive || o.dying) continue;
    if (o.burnTimer > 0) continue;  // 既に燃えてる対象は除外
    const dx = o.x - src.x, dz = o.z - src.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2 && d2 <= r2) { best = o; bestD2 = d2; }
  }
  if (best) {
    const nextChain = src.burnSpreadChain + 1;
    const inheritMul = Math.pow(cfg.SPREAD_DURATION_INHERIT, nextChain);
    igniteEnemy(best, { chain: nextChain, duration: cfg.DURATION_FRAMES * inheritMul, sourceId: 'spread' });
  }
}

// 内部：burn 状態で死亡した敵の周囲爆発（OC CHAIN_BLAST カードで ON）
//   - enterEnemyDying / enterEnemyDyingBurst から「burn 中 && DEATH_BLAST_ENABLED」の場合だけ呼ぶ
function _spawnBurnDeathBlast(e) {
  const cfg = BURN_CONFIG;
  spawnDeathExplosion(e.x, e.y + 60, e.z, { skipHitstop: true });
  const r2 = cfg.DEATH_BLAST_RADIUS * cfg.DEATH_BLAST_RADIUS;
  const nextChain = e.burnSpreadChain + 1;
  const inheritDur = cfg.DURATION_FRAMES * cfg.DEATH_BLAST_CHAIN_DURATION;
  for (const o of _enemies) {
    if (o === e || !o.isAlive || o.dying) continue;
    const dx = o.x - e.x, dz = o.z - e.z;
    if (dx * dx + dz * dz > r2) continue;
    o.hp -= cfg.DEATH_BLAST_DAMAGE;
    recordDamage(cfg.DEATH_BLAST_DAMAGE, 'element');
    o.hitFlashTimer = Math.max(o.hitFlashTimer, 6);
    if (cfg.DEATH_BLAST_IGNITES) {
      igniteEnemy(o, { chain: nextChain, duration: inheritDur, sourceId: 'death_blast' });
    }
  }
  triggerShake(10, 14);
}

// OC IGNITE: SP1 二打目で手動起爆（hit-engine 経由で呼ばれる）
//   _spawnBurnDeathBlast（死亡時自動）とは別経路・より派手な演出を意図
export function detonateBurn(e) {
  if (!e || e.burnTimer <= 0) return;
  const cfg = BURN_CONFIG;
  // 大爆発ビジュアル（death blast より一段大きい）
  spawnDeathExplosion(e.x, e.y + 60, e.z, { skipHitstop: false });
  spawnBlastSphere(e.x, e.y + 60, e.z);                                               // 外球（350r, 18F）
  spawnBlastSphere(e.x, e.y + 60, e.z, { maxRadius: 180, life: 12, color: 0xffaa22 }); // 内球（速め）
  spawnHitParticles(e.x, e.y + 60, e.z, 0xff2200, 40, { type: 'launch', speedMul: 1.3 });
  spawnHitParticles(e.x, e.y + 40, e.z, 0xff8800, 25, { type: 'omni',   speedMul: 1.0, sizeScale: 1.4 });
  // 放射花火スパーク（16方向 + 中間8方向で花火感を出す）
  for (let _si = 0; _si < 16; _si++) {
    const _a = (_si / 16) * Math.PI * 2;
    spawnHitParticles(
      e.x + Math.cos(_a) * 20, e.y + 60, e.z + Math.sin(_a) * 20,
      _si % 2 === 0 ? 0xff2200 : 0xff8800, 4,
      { type: 'normal', dirX: Math.cos(_a), dirZ: Math.sin(_a), speedMul: 3.2, sizeScale: 0.9 }
    );
  }
  spawnHitParticles(e.x, e.y + 60, e.z, 0xffcc44, 18, { type: 'omni', speedMul: 2.8, sizeScale: 0.6 }); // 高速黄金粒
  triggerShake(14, 20);
  // 本体へボーナスダメージ
  e.hp -= cfg.DEATH_BLAST_DAMAGE * 2;
  recordDamage(cfg.DEATH_BLAST_DAMAGE * 2, 'element');
  e.hitFlashTimer = Math.max(e.hitFlashTimer, 10);
  // 周囲の敵へ爆風ダメージ（+ OC CHAIN_BLAST 有効なら延焼）
  const r2 = cfg.DEATH_BLAST_RADIUS * cfg.DEATH_BLAST_RADIUS;
  const nextChain = (e.burnSpreadChain ?? 0) + 1;
  const inheritDur = cfg.DURATION_FRAMES * cfg.DEATH_BLAST_CHAIN_DURATION;
  for (const o of _enemies) {
    if (o === e || !o.isAlive || o.dying) continue;
    const dx = o.x - e.x, dz = o.z - e.z;
    if (dx * dx + dz * dz > r2) continue;
    o.hp -= cfg.DEATH_BLAST_DAMAGE;
    recordDamage(cfg.DEATH_BLAST_DAMAGE, 'element');
    o.hitFlashTimer = Math.max(o.hitFlashTimer, 6);
    if (cfg.DEATH_BLAST_ENABLED && cfg.DEATH_BLAST_IGNITES) {
      igniteEnemy(o, { chain: nextChain, duration: inheritDur, sourceId: 'detonate' });
    }
  }
  // burn 状態リセット
  e.burnTimer      = 0;
  e.burnBlastReady = false;
  _detachBurnOutline(e);
  // 爆発打ち上げ：生存中の敵を down_up_start へ移行（コンボ起点・頂点スロー有効）
  if (e.isAlive && !e.dying) {
    e.vy               = 18;
    e.knockbackVx      = 0;
    e.state            = STATE.down_up_start;
    e.downTimer        = ENEMY_FALL_FRAMES;
    e.launcherAirborne = true;   // 頂点付近で重力スロー（SP2 と同じ）
    e.peakHangTimer    = 0;      // カウンターをリセットして再発火準備
    e.peakHangTotal    = 0;
    spawnLaunchSmoke(e.x, e.y, e.z);
  }
}

// ============================================================
//  ステータス：スタン付与（Phase 3・将来 freeze / poison 等と同形）
//   - 地上の敵のみ（e.y > 5 なら無視・空中個体には付与しない）
//   - state===wait01 または enemy_attacking 以外（被弾系/status_stun中）は付与スキップ
//   - 付与時は進行中の攻撃を中断（atkPhase/Timer リセット・トークン解放）
//   - 返り値：付与した true / 無視した false（テスト/デバッグ用）
// ============================================================
export function applyStatusStun(e, frames, ctx) {
  if (!e || !e.isAlive) return false;
  if (e.y > 5) return false;                          // 空中無視
  if (e.state !== STATE.wait01 && e.state !== STATE.enemy_attacking) return false;
  // 進行中の攻撃を中断（トークン解放）
  if (e.state === STATE.enemy_attacking) {
    e.atkPhase = null;
    e.atkTimer = 0;
    e.hitDelivered = false;
    _clearAllTokens(ctx, e);
    // タックル赤発光等の charge color が残ってたらリセット
    if (e._chargeT > 0) { e._chargeT = 0; _setMeshChargeColor(e, 0); }
  }
  e.state           = STATE.status_stun;
  e.statusStunTimer = (typeof frames === 'number' && frames > 0) ? frames : STATUS_STUN_CONFIG.defaultDuration;
  return true;
}

// ============================================================
//  midboss01 盾破壊：盾 HP が 0 になった瞬間に hit-engine から呼ぶ。
//   - 盾 mesh を非表示・グレー粒子バースト・強ヒットストップ + シェイク
//   - "SHIELD BREAK!" バナー（hud-system）
//   - enraged_intro へ遷移し berserker（enraged）化
//   - 進行中の攻撃があれば中断しトークン解放（ctx 経由）
//   返り値：破壊した true / 既に破壊済みなら false
// ============================================================
export function triggerShieldBreak(e, ctx) {
  if (!e || e.shieldBroken) return false;
  const SC = MIDBOSS_SHIELD_CONFIG;
  e.shieldBroken = true;
  e.shieldHp = 0;
  e.shieldBreakDomeTimer = 18;  // SHIELD BREAK 拡大フェードドーム（プレイヤーのガードクラッシュと同系）
  // 盾 mesh を非表示（detach 機構は黒 material 化 + 非 dying で更新されないため使わない）
  if (e.mesh && e.mesh.userData && e.mesh.userData.shield) {
    e.mesh.userData.shield.visible = false;
  }
  // 盾飛散の代替＝グレー粒子バースト（盾のあった敵の正面側）
  spawnHitParticles(e.x + e.facing * 50, e.y + 110, e.z, 0xaaaaaa, 24, { type: 'omni' });
  triggerHitstop(SC.BREAK_HITSTOP);
  triggerShake(SC.BREAK_SHAKE, SC.BREAK_SHAKE * 2 + 6);
  spawnBanner('SHIELD BREAK!', { frames: SC.BANNER_FRAMES });
  // 進行中の攻撃を中断（トークン解放）
  if (e.state === STATE.enemy_attacking) {
    e.atkPhase     = null;
    e.atkTimer     = 0;
    e.hitDelivered = false;
    _clearAllTokens(ctx, e);
  }
  // enraged_intro へ直行 + berserker（enraged）化
  e.enraged      = true;
  e.superArmor   = MIDBOSS_SHIELD_CONFIG.BERSERKER_SA;   // 攻撃中のヒット吸収（SA）を付与
  e.saHp         = 0;   // 次の _beginEnemyAttack で superArmor 値から再セット
  e.passiveSaHp  = MIDBOSS_SHIELD_CONFIG.PASSIVE_SA_HP;  // 恒常 SA：フェーズ問わず常時 1 発吸収
  e.state     = STATE.enraged_intro;
  e.downTimer = ENEMY_ENRAGE_CONFIG.INTRO_FRAMES;
  e.aiPhase   = 'enraged';
  return true;
}

// ============================================================
//  boss01 フェーズ移行（HP ゲート到達時に hit-engine から呼ぶ）
//   - 仕様：chars/boss01.md §フェーズ移行演出 / handoff_scrapblitz_2026-05-26_boss-framework
//   - HP ゲートで境界 1 残しでダメージ停止 → これを呼ぶ → 次フェーズ開始
//   - MVP：banner + flash + shake + 進行中攻撃中断のみ。メガクラ流用本格演出は別セッション
//   - 戻り値：移行発火した true / 既に移行中・非ボスなら false
// ============================================================
// フェーズ移行イントロのタイミング（2026-05-29・tunable）
const PT_APPROACH_MAX   = 150;  // down/空中突入時：無敵のまま着地→起き上がりを待つ上限
const PT_POSE_FRAMES    = 48;   // 暗転＋大きく構える＋発光ランプ
const PT_ROAR_FRAMES    = 26;   // 咆哮（この頭でメガクラ発火）ホールド
const PT_RECOVER_FRAMES = 18;   // 発光フェード＋復帰

// ボス側メガクラ本体（咆哮の瞬間に発火）：AoE・FX・バナー
function _fireBossPhaseMegaCrash(e) {
  _triggerBossMegaCrashFX?.(e.x, e.y, e.z);
  if (_players?.length) {
    const _bmAtk = {
      damage:       BOSS_MEGA_CONFIG.DAMAGE,
      atk_lv:       BOSS_MEGA_CONFIG.ATK_LV,
      knockback:    BOSS_MEGA_CONFIG.KNOCKBACK,
      hitstop:      BOSS_MEGA_CONFIG.HITSTOP,
      hitboxRangeX: BOSS_MEGA_CONFIG.RADIUS,
      hitboxRangeY: 400,
      hitboxRangeZ: BOSS_MEGA_CONFIG.RADIUS,
      hitColor:     0xff2200,
      shake:        BOSS_MEGA_CONFIG.SHAKE,
    };
    if (tryHitPlayer(e, _bmAtk) && _players?.[0]) {
      triggerCharShake(_players[0], 14, 18);   // 大型衝撃の被弾感
    }
  }
  triggerHitstop(BOSS_MEGA_CONFIG.HITSTOP);
  triggerShake(BOSS_MEGA_CONFIG.SHAKE, 42);
  spawnHitParticles(e.x, e.y + 80, e.z, 0xff3300, 60, { type: 'omni' });
  spawnBanner(`PHASE ${e.bossPhase}!`, { frames: 70, color: '#ff5544', fontSize: 64 });
}

// pose 入り：暗転のみ（カメラ寄りは無し・amount 0。既存メガクラ暗転機構を流用）
function _ptEnterPose(e) {
  e._ptStage = 'pose';
  e._ptTimer = PT_POSE_FRAMES;
  window.SB?.applyCamZoomBoost?.(0, 14, PT_POSE_FRAMES + PT_ROAR_FRAMES, 0.5);
}

export function triggerBossPhaseTransition(e, ctx) {
  if (!e || !e.isBoss || e.bossPhaseTransitioning) return false;
  if ((e.bossPhase ?? 1) >= 3) return false;  // Phase 3 が最終
  e.bossPhase = Math.min(3, (e.bossPhase ?? 1) + 1);
  e.bossPhaseTransitioning = true;
  e.aiEnabled = false;   // イントロ中は移動 AI も停止（構えを保持・recover 完了で復帰）
  e.aiPhase   = 'idle';
  // 進行中の攻撃を中断（仕切り直し）
  if (e.state === STATE.enemy_attacking) {
    e.atkPhase     = null;
    e.atkTimer     = 0;
    e.hitDelivered = false;
    _clearAllTokens(ctx, e);
    _cleanupMissiles(e);  // missile_barrage 中断時の AOE/メッシュ取り残し防止
  }
  // ── フェーズ移行＝リセット（2026-05-29）─────────────────────────────
  //   状態異常・床設置系を一掃。火ドクトリン（時間で削る）はフェーズ内では効くが
  //   移行を跨いで持ち越さない（DoT で gate/フェイタルを素通りしないよう updateEnemies
  //   側にゲート安全網も併設）。一掃を移行開始時にやるのは、イントロ中も DoT が
  //   走り続けて hp がさらに削れるのを防ぐため。
  if (e.burnTimer > 0) {
    e.burnTimer          = 0;
    e.burnBlastReady     = false;
    e.burnAutoBlastTimer = 0;
    _detachBurnOutline(e);
  }
  window.SB?.clearAllSolarFlares?.();   // 床炎フィールド一掃
  window.SB?.clearAllMagmaVents?.();    // 床マグマ一掃
  // ── イントロ分岐（2026-05-29）：突入状態で「構え→咆哮」の入りを変える ──
  //   立ち/のけぞり：即 構え。ダウン/吹き飛び/空中：無敵のまま着地→起き上がりを
  //   待ってから構え（ワンクッション）。※移行中は hit-engine がダメージ 0 クランプ＝全期間無敵。
  e._ptMegaFired = false;
  const _down = (e.y > ENEMY_AIRBORNE_Y_THRESHOLD)
             || /^(down_|knockback)/.test(String(e.state || ''));
  if (_down) {
    e._ptStage = 'approach';
    e._ptTimer = PT_APPROACH_MAX;   // 着地待ち安全上限（超えたら強制 pose）
  } else {
    e.state     = STATE.wait01;
    e.downTimer = 0;
    _ptEnterPose(e);
  }
  return true;
}

// フェーズ移行イントロのステージ駆動（updateEnemies から毎フレーム呼ぶ）
function _stepBossPhaseTransition(e) {
  const _grounded = e.y <= ENEMY_AIRBORNE_Y_THRESHOLD;
  switch (e._ptStage) {
    case 'approach': {
      // 無敵のまま着地＋起き上がりを待つ（down/空中突入のワンクッション）
      e._ptTimer = (e._ptTimer ?? 0) - 1;
      const _settled = _grounded && (
        e.state === STATE.wait01 ||
        e.state === STATE.down_bas_end ||
        e.state === STATE.down_bas_start
      );
      if (_settled || e._ptTimer <= 0) {
        e.state = STATE.wait01; e.downTimer = 0; e.knockbackVx = 0;
        _ptEnterPose(e);
      }
      break;
    }
    case 'pose': {
      e._ptTimer = (e._ptTimer ?? 0) - 1;
      const _f = 1 - Math.max(0, e._ptTimer) / PT_POSE_FRAMES;  // 0→1 発光ランプ
      _setMeshChargeColor(e, _f, 0xff3300);
      if (e._ptTimer === Math.floor(PT_POSE_FRAMES * 0.5)) triggerShake(6, 10);  // ビルドアップ
      if (e._ptTimer <= 0) { e._ptStage = 'roar'; e._ptTimer = PT_ROAR_FRAMES; }
      break;
    }
    case 'roar': {
      if (!e._ptMegaFired) {
        e._ptMegaFired = true;
        _setMeshChargeColor(e, 1, 0xffaa33);   // 咆哮の瞬間：発光フラッシュ
        _fireBossPhaseMegaCrash(e);            // メガクラ AoE＝一掃と同期
      }
      e._ptTimer = (e._ptTimer ?? 0) - 1;
      if (e._ptTimer <= 0) { e._ptStage = 'recover'; e._ptTimer = PT_RECOVER_FRAMES; }
      break;
    }
    case 'recover':
    default: {
      e._ptTimer = (e._ptTimer ?? 0) - 1;
      const _f = Math.max(0, e._ptTimer) / PT_RECOVER_FRAMES;  // 1→0 発光フェード
      _setMeshChargeColor(e, _f, 0xffaa33);
      if (e._ptTimer <= 0) {
        _setMeshChargeColor(e, 0);
        e.bossPhaseTransitioning = false;
        e.aiEnabled = true;   // AI 復帰
        e._ptStage = null;
      }
      break;
    }
  }
}

// ============================================================
//  敵死亡フロー開始（Phase 3-A/B/C・gore-scrap-mob-prototype.md 仕様）
//   - 2026-05-20 フラグ方式：state は変更せず、e.dying=true を立てて並列にフェーズ管理
//   - 被弾モーション（knockback/down_* 等）はそのまま再生継続
//   - AI のみ抑制（aiEnabled=false）、token 解放
//   - 色は _applyDyingColorOverride() で毎フレーム lerp(current→black) を適用
//   - 既に dying なら何もしない
//   - 返り値：開始した true / 既に dying または無効なら false
// ============================================================
export function enterEnemyDying(e, ctx) {
  if (!e || e.dying) return false;
  recordKill();
  if (window.SB && window.SB.DEBUG_GORE_CRITICAL) {
    console.log(`[GORECRIT] enterEnemyDying called (hp=${e.hp}, y=${e.y|0}, lastHitter=${JSON.stringify(e.lastHitter)})`);
  }
  _removeJdMarkers(e);
  if (e.mesh) e.mesh.scale.y = 1.0;
  e._chargeT     = 0;
  e._hopLaunched = false;
  e._hopAirborne = false;
  _setMeshChargeColor(e, 0);  // チャージ黄色発光リセット
  e.dying            = true;
  e.dyingPhase       = 'reacting';   // 通常被弾モーション再生中（hold タイマー並列消費・wait01 到達待ち）
  e.dyingFadeTimer   = GORE_CONFIG.FADE_DURATION;
  e.dyingHoldTimer   = GORE_CONFIG.HOLD_DURATION;  // フォールバック：HOLD_DURATION（150F=2.5s）で強制 final
  e.dyingStunnedTimer = 0;
  e.dyingFinalTimer  = 0;
  e.dyingInvincible  = false;
  e.aiEnabled        = false;
  e.atkPhase         = null;
  e.hitDelivered     = false;
  e.repulseWindow    = false;   // dying 死体に「危↑」HUD が残るリーク防止
  e._jdDiveGrace     = 0;       // RC dive grace の残値クリア（デバッグログ汚染防止）
  // enemy_attacking state のまま dying に入ると、state machine が curAtkId+atkPhase=null で
  // どのフェーズブロックにも当てはまらずロックする（敵 mesh が attack ポーズで固まる）。
  // 例：ジャンパー jump_dive 中にバレル爆発で死亡 → 攻撃判定が画面に残って見える（D-3）。
  // enemy_attacking 限定で state を wait01 に解放し machine を素通りさせる。
  if (e.state === STATE.enemy_attacking) {
    e.state    = STATE.wait01;
    e.atkTimer = 0;
  }
  _clearAllTokens(ctx, e);
  // 延焼関連処理：burn shell は GC 抽選（パーツ detach 可能性あり）より前に剥がす
  const _burnActive = (e.burnTimer > 0);
  _detachBurnOutline(e);
  // ゴア・クリティカル抽選（基本構造・キャラ拡張で発火条件を絞る）
  _maybeArmGoreCritical(e);
  // 延焼中に死亡 → CHAIN_BLAST：周囲爆発 + 範囲内の生存敵に burn 付与
  if (BURN_CONFIG.DEATH_BLAST_ENABLED && _burnActive) _spawnBurnDeathBlast(e);
  e.burnTimer = 0;
  return true;
}

// 外部公開：RC 成立時など「敵が既に dying でも GC を強制再評価したい」ケース用。
// 2026-05-27：RC 直前の通常ヒットが敵を kill 済みだと enterEnemyDyingBurst が早期 return し
// _maybeArmGoreCritical が再評価されない → forceGc:true が反映されず GC 不発になる事象を防ぐ。
// 既に armed 済みなら上書きしない（演出途中での状態リセット回避）。
export function forceArmGoreCriticalIfPossible(e) {
  if (!e) return;
  if (e.goreCritical && e.goreCritical.armed) return;
  _maybeArmGoreCritical(e);
}

// ============================================================
//  ゴア・クリティカル抽選（基本構造・2026-05-18 導入）
//   - profile.goreCriticalParts のいずれかが残存
//   - profile.canArmGoreCritical(e, hitCtx) が true
//   - 確率 PROBABILITY を引いて当選
//   3 つすべて満たした時のみ armed。armed なら長めのヒットストップ＋強画ぶれが即発火
// ============================================================
function _maybeArmGoreCritical(e) {
  const DBG = window.SB && window.SB.DEBUG_GORE_CRITICAL;
  if (!e.lastHitter || !e.lastHitter.profileKey) {
    if (DBG) console.log('[GORECRIT] skip: no lastHitter', e.lastHitter);
    return;
  }
  const profile = PLAYER_PROFILE?.[e.lastHitter.profileKey]?.gore;
  if (!profile || !profile.variants) {
    if (DBG) console.log('[GORECRIT] skip: no profile/variants for', e.lastHitter.profileKey);
    return;
  }
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts) {
    if (DBG) console.log('[GORECRIT] skip: no parts');
    return;
  }
  // 候補 variant 探し：lastHitter.lv が variant.atk_lv と一致する gc を絞り、
  // triggers ホワイトリスト・パーツ残存・確率の順でチェック
  const hitLv = e.lastHitter.lv;
  const attackId = e.lastHitter.attackId;
  const candidates = Object.entries(profile.variants)
    .filter(([_id, v]) => v.atk_lv === hitLv);
  if (candidates.length === 0) {
    if (DBG) console.log(`[GORECRIT] skip: no variant for lv=${hitLv} (attackId=${attackId})`);
    return;
  }
  for (const [gcId, v] of candidates) {
    // triggers（attackId ホワイトリスト）
    const triggerOk = v.triggers ? v.triggers(attackId) : true;
    if (!triggerOk) {
      if (DBG) console.log(`[GORECRIT] ${gcId} skip: triggers false for ${attackId}`);
      continue;
    }
    // requiredParts（全部残存・every）
    const required = v.requiredParts || [];
    const partsAttached = required.map(k => ({ k, attached: parts[k] && parts[k].parent === e.mesh }));
    const partsOk = required.length === 0 || partsAttached.every(pp => pp.attached);
    if (!partsOk) {
      if (DBG) console.log(`[GORECRIT] ${gcId} skip: parts not attached`, partsAttached);
      continue;
    }
    // requireGrounded（被弾時に接地していた敵限定・打ち上げ系攻撃のために hit 時点の grounded を参照）
    //   現フレームの e.y は既に打ち上げ vy が適用された値（空中）になっているため使えない。
    //   hit-engine 側で「dispatch 前の e.y」を lastHitter.wasGrounded に記録してくれている。
    if (v.requireGrounded && e.lastHitter.wasGrounded !== true) {
      if (DBG) console.log(`[GORECRIT] ${gcId} skip: requireGrounded but wasGrounded=${e.lastHitter.wasGrounded}`);
      continue;
    }
    // 確率：lastHitter.forceGc=true なら確率スキップで強制成立（RC 成立時など）
    if (!e.lastHitter.forceGc) {
      const roll = Math.random();
      if (roll >= GORE_CRITICAL_CONFIG.PROBABILITY) {
        if (DBG) console.log(`[GORECRIT] ${gcId} skip: prob roll ${roll.toFixed(3)} >= ${GORE_CRITICAL_CONFIG.PROBABILITY}`);
        continue;
      }
    }
    if (DBG) console.log(`[GORECRIT] ARMED! gcId=${gcId}, attackId=${attackId}, lv=${hitLv}, explosionVariant=${v.explosionVariant}, eY=${e.y|0}`);
    // 当選
    e.goreCritical = _buildGoreCriticalState(e, profile, v, gcId);
    _setupArmedKinematics(e, v.explosionVariant);
    // variant.freezeFrames が指定されていれば優先（gc_03 等で hitstop を抑えたい時用）
    _kickGoreCriticalFx(v.freezeFrames);
    // OC「点火」取得済みなら GC 撃破を起点に周囲に延焼を撒く
    //   - 死体自身も burn 状態にして、CHAIN_BLAST 取得済みなら GC 爆散と burn death blast が連動
    if (window.SB && window.SB.OC_FLAGS && window.SB.OC_FLAGS.ignite) _igniteAroundGc(e);
    return;
  }
}

// OC「点火」フック：GC arm 成立時に周囲を延焼
//   半径は SPREAD_RADIUS を流用（伝播範囲と同じ感覚）
//   死体自身もマーク（CHAIN_BLAST 取得時は dying 進行と連動して死亡時爆発も発火）
function _igniteAroundGc(src) {
  igniteEnemy(src, { sourceId: 'gc_arm', chain: 0 });
  const r = BURN_CONFIG.SPREAD_RADIUS;
  const r2 = r * r;
  for (const o of _enemies) {
    if (o === src || !o.isAlive || o.dying) continue;
    const dx = o.x - src.x, dz = o.z - src.z;
    if (dx * dx + dz * dz <= r2) igniteEnemy(o, { sourceId: 'gc_arm', chain: 0 });
  }
}

// 抽選当選時に goreCritical オブジェクトを組み立てる
function _buildGoreCriticalState(e, profile, variantDef, gcId) {
  const explosionVariant = variantDef.explosionVariant || 'toward_player';
  // phase 初期値（variant 別）：
  //   wall_blast_toward_player → 'crit_fly'（壁/床到達まで飛行・赤発光継続）
  //   head_launch_delayed       → 'crit_head_fly'（頭部打ち上げ + 胴体スタン・HEAD_LAUNCH_DELAY 待機後爆発）
  //   slam_radial_split         → 'crit_slam_stick'（上半身放射 + 下半身突き刺し・SLAM_DELAY 待機後爆発）
  //   split_back_blast / toward_player / その他 → 'crit_red'（その場で赤発光 → 白 → 爆散）
  //   ※ 2026-05-18：赤発光をゴアクリの基本仕様に格上げ。split_back_blast も crit_red 経路に統合。
  let phase, timer;
  if (explosionVariant === 'wall_blast_toward_player') {
    phase = 'crit_fly';
    timer = GORE_CRITICAL_CONFIG.RED_LERP_FRAMES + GORE_CRITICAL_CONFIG.RED_HOLD_FRAMES;
  } else if (explosionVariant === 'head_launch_delayed') {
    phase = 'crit_head_fly';
    // airborneKill：待ち時間ゼロで即爆発（hitstop 明けに弾ける順序にする・2026-05-27）
    timer = (e.lastHitter && e.lastHitter.airborneKill) ? 1 : GORE_CRITICAL_CONFIG.HEAD_LAUNCH_DELAY;
  } else if (explosionVariant === 'slam_radial_split') {
    phase = 'crit_slam_stick';
    timer = GORE_CRITICAL_CONFIG.SLAM_DELAY;
  } else {
    phase = 'crit_red';
    timer = GORE_CRITICAL_CONFIG.RED_LERP_FRAMES + GORE_CRITICAL_CONFIG.RED_HOLD_FRAMES;
  }
  return {
    armed:   true,
    id:      gcId,                  // c01_gc_06 等の一意識別子
    profile,
    variantDef,
    variant: explosionVariant,      // 既存の dispatch キー（後方互換）
    hitter:  { ...e.lastHitter },
    phase,
    timer,
    redLerpRemaining: GORE_CRITICAL_CONFIG.RED_LERP_FRAMES,
  };
}

// armed 共通の FX キック（hitstop + shake）
function _kickGoreCriticalFx(freezeFramesOverride) {
  const fz = (freezeFramesOverride !== undefined)
    ? freezeFramesOverride
    : GORE_CRITICAL_CONFIG.FREEZE_FRAMES;
  triggerHitstop(fz);
  triggerShake(GORE_CRITICAL_CONFIG.SHAKE_MAG, GORE_CRITICAL_CONFIG.SHAKE_FRAMES);
}

// armed 時の物理セットアップ（variant 別）
//   goreCritical オブジェクト本体は _buildGoreCriticalState で組み立て済（呼び出し元で代入）。
//   ここは状態フラグ初期化 + variant 別 kinematics のみ。
function _setupArmedKinematics(e, variant) {
  // 通常 fade/hold は無効化（armed 中は専用シーケンスへ）
  e.dyingFadeTimer = 0;
  e.dyingHoldTimer = 0;
  e.dyingFinalTimer = 0;
  // hitFlash/burstFlash を消して赤発光と干渉しないように
  e.hitFlashTimer = 0;
  e.burstFlashTimer = 0;
  // armed 中は完全無敵（追撃を弾く）
  e.dyingInvincible = true;

  if (variant === 'wall_blast_toward_player') {
    // 通常 lv6 dispatch と同じ強度・方向で吹き飛ばす（hit-engine line 555/774-776 と同等の式）
    //   通常ヒット時の knockback を再現することで「ゴアクリ時だけ地味」を防ぐ
    //   床に当たれば ground_stick、壁に当たれば wall_stick で回収（どちらでもよい）
    let dir = e.fallDir;
    if (dir !== 1 && dir !== -1) dir = e.lastHitter.facing || 1;
    e.fallDir = dir;
    const atk = ATTACKS[e.lastHitter.attackId];
    const baseKb = (atk && typeof atk.knockback === 'number') ? atk.knockback : 50;
    const kbVxMult = atk?.kb_vx_mult_lv6 ?? atk?.kb_vx_mult ?? KB_LV06_VX_MULT;
    const kbVy     = atk?.kb_vy_lv6     ?? atk?.kb_vy     ?? KB_LV06_VY;
    const kbDecay  = atk?.kb_vx_decay_lv6 ?? atk?.kb_vx_decay ?? 0.92;
    e.knockbackVx = dir * (baseKb * 0.4 * kbVxMult);
    e.knockbackVz = 0;
    e.vy          = kbVy;
    e.kbDecay     = kbDecay;
    // 既存の super 飛び物理を流用：壁検出と down_wall_start 遷移が自動で走る
    e.state = STATE.down_super_start;
    e.downTimer = 999;   // 壁ヒットまで遷移は要らない（loop 中に wall hit で down_wall_start へ）
    e.burstSpinRate = 0;
    e.burstGravMult = 0;
    e.burstRollAngle = 0;
    e.tiltAngle = 0;
    e.pitchAngle = 0;
    e.peakHangTimer = 0;
    e.launcherAirborne = false;
    // skipWallCollision を確実に解除（重複コンボで立っているとそのまま地面まで滑ってしまう）
    e.skipWallCollision = false;
    e.lateralCombatInvincible = false;
  } else if (variant === 'split_back_blast') {
    // 即爆発バリアント：hitstop 明けで即 _triggerFinalExplosion → 胴体/下半身分裂飛び。
    //   状態リセットのみ（velocity 0 / 直立 / 状態クリア）。爆散物理は _explodeSplitBackBlast へ。
    e.knockbackVx = 0;
    e.knockbackVz = 0;
    e.vy = 0;
    // y はそのまま保持（空中ヒットなら空中で爆発、地上なら地上で爆発）
    e.burstSpinRate = 0;
    e.burstGravMult = 0;
    e.burstRollAngle = 0;
    e.tiltAngle = 0;
    e.pitchAngle = 0;
    e.downTimer = 0;
    e.state = STATE.wait01;
  } else if (variant === 'head_launch_delayed') {
    // gc_04：上半身（body+head+nose バンドル）が泣き別れて縦回転で上に吹き飛ぶ。
    //   2026-05-19 仕様変更：旧「頭だけ画面外突き抜け＋トレイル」→ 新「上半身バンドル＋やや上に飛ぶ」。
    //   下半身（stand）は e.mesh に残ったまま地上に居続け、爆発時に一緒に消える。
    //   順序：
    //     (1) 胴体 KB（1 キャラ分プレイヤーから離す）
    //     (2) mesh.position を新 e.x へ同期 + matrixWorld 更新
    //     (3) _detachBodyBundleNoExplode で body+head+nose を独立化 → velocity 上書き
    //   2026-05-27 追加：airborneKill（RC 空中撃破）時は y=0 リセットせず、下半身も上半身と同じ vy で飛ばす。
    //     地上に足が残らない「全部空中爆散」の絵にする。
    const _airborneKill = !!(e.lastHitter && e.lastHitter.airborneKill);
    let dir = e.fallDir;
    if (dir !== 1 && dir !== -1) dir = (e.lastHitter && e.lastHitter.facing) || 1;
    e.x += dir * GORE_CRITICAL_CONFIG.HEAD_LAUNCH_BODY_KB_X;
    e.knockbackVx = 0;
    e.knockbackVz = 0;
    e.vy = 0;
    if (!_airborneKill) {
      e.y = 0;                // 地上撃破：下半身は地面に静止
    }
    // _airborneKill: e.y そのまま（敵が居る高さで爆散）
    e.launcherAirborne = false;
    if (e.mesh) {
      e.mesh.position.x = e.x;
      e.mesh.position.y = e.y;
      e.mesh.position.z = e.z;
      e.mesh.updateMatrixWorld(true);
    }
    e.burstSpinRate = 0;
    e.burstGravMult = 0;
    e.burstRollAngle = 0;
    e.tiltAngle = 0;
    e.pitchAngle = 0;
    e.downTimer = 0;
    e.state = STATE.wait01;   // 下半身は無動。armed gate で AI/state machine を全凍結
    const cfg = GORE_CRITICAL_CONFIG;
    // === 上半身バンドル分離 + やや上に縦回転で吹き飛ばし ===
    const bundleName = _detachBodyBundleNoExplode(e, dir);
    if (bundleName && e.flyingParts && e.flyingParts.length > 0) {
      const fp = e.flyingParts[e.flyingParts.length - 1];
      // airborneKill：launch をスキップ（爆発で放射散乱させるため待機中は静止）
      fp.vx = _airborneKill ? 0 : (Math.random() - 0.5) * 2 * cfg.UPPER_LAUNCH_VX_JITTER;
      fp.vy = _airborneKill ? 0 : cfg.UPPER_LAUNCH_VY;
      fp.vz = 0;
      // 「アッパーの勢いを殺せずに後ろへ倒れ込みながら舞う」回転。
      // 回転軸 = 世界 Z 軸（奥行き）。body の Y 軸（直立）が自機反対側に倒れ込む方向に回す。
      // 世界 X 軸クォータニオンだとカメラ 20° 俯瞰の関係で「側転」に見えた（過去試行）→ Z 軸に変更。
      fp.angVx = 0;
      fp.angVy = 0;
      fp.angVz = 0;
      fp._worldAxisRot   = new _THREE_REF.Vector3(0, 0, 1);    // 世界 Z 軸（奥行き軸）
      fp._worldAxisSpeed = -dir * cfg.UPPER_LAUNCH_ANG_X;      // 符号反転：fallDir 方向（プレイヤーの反対）に頭が倒れる
      fp._critGravMult = cfg.UPPER_LAUNCH_GRAV_MULT;
      fp._critAirDecay = 1.0;
      // 赤発光：_detachBodyBundleNoExplode が unlit 黒にしているので塗り直し
      for (const mat of (fp._materials || [])) {
        if (mat && mat.color) mat.color.setRGB(1, 0.05, 0.05);
      }
    }
    // 下半身も浮かせる：part 名が enemy 種別で異なる（enem01/midboss01='stand' = 単一 mesh /
    //   enem02 ジャンパー='legs' = 4本足の Array）。両形態を扱う：
    //   - 単一 mesh: _detachOneNamed で 1 個 detach
    //   - 配列: _detachArrayNamed で各要素を個別 detach（4本それぞれ独立飛行）
    //   2026-05-27：airborneKill 時は下半身も上半身と同じ vy にして「足だけ地面に残る」絵を防ぐ
    const lowerVy = _airborneKill ? cfg.UPPER_LAUNCH_VY : cfg.LOWER_LAUNCH_VY;
    const _applyLowerParams = (sp) => {
      // airborneKill：launch スキップ（待機中静止 → 爆発時に放射散乱）
      sp.vx = _airborneKill ? 0 : (Math.random() - 0.5) * 2 * cfg.LOWER_LAUNCH_VX_JITTER;
      sp.vy = _airborneKill ? 0 : lowerVy;
      sp.vz = 0;
      sp.angVx = 0;
      sp.angVy = 0;
      sp.angVz = 0;
      sp._critGravMult = cfg.LOWER_LAUNCH_GRAV_MULT;
      sp._critAirDecay = 1.0;
      sp._worldAxisRot   = new _THREE_REF.Vector3(0, 0, 1);
      sp._worldAxisSpeed = -dir * cfg.LOWER_LAUNCH_ANG_X;
      for (const mat of (sp._materials || [])) {
        if (mat && mat.color) mat.color.setRGB(1, 0.05, 0.05);
      }
    };
    // 試行 1：単一 mesh の 'stand'
    const standOk = _detachOneNamed(e, 'stand', null);
    if (standOk && e.flyingParts.length > 0) {
      _applyLowerParams(e.flyingParts[e.flyingParts.length - 1]);
    } else {
      // 試行 2：配列の 'legs'（複数本）
      const legsCount = _detachArrayNamed(e, 'legs');
      if (legsCount && e.flyingParts.length >= legsCount) {
        for (let i = e.flyingParts.length - legsCount; i < e.flyingParts.length; i++) {
          _applyLowerParams(e.flyingParts[i]);
        }
      }
    }
  } else if (variant === 'slam_radial_split') {
    // gc_05：叩きつけ → 上半身（head + body）を放射状に分散 / 下半身（stand）を逆さま地面突き刺し
    //   要件：地上/空中問わず発動 → e.y を 0 に強制（地面叩きつけ感）。
    //   _detachOneNamed で各パーツを独立化し、velocity を上書きする方式（gc_03 と同パターン）。
    e.knockbackVx = 0;
    e.knockbackVz = 0;
    e.vy = 0;
    e.y = 0;                    // 空中ヒットでも地面に「叩きつけ」感を出すため強制 0
    e.launcherAirborne = false;
    e.burstSpinRate = 0;
    e.burstGravMult = 0;
    e.burstRollAngle = 0;
    e.tiltAngle = 0;
    e.pitchAngle = 0;
    e.downTimer = 0;
    e.state = STATE.wait01;
    // mesh.position 同期（detach の getWorldPosition 用）
    if (e.mesh) {
      e.mesh.position.x = e.x;
      e.mesh.position.y = e.y;
      e.mesh.position.z = e.z;
      e.mesh.updateMatrixWorld(true);
    }
    const cfg = GORE_CRITICAL_CONFIG;
    const deg2rad = Math.PI / 180;
    // 上半身放射：head（+nose subPart）と body をそれぞれ別方向に飛ばす
    //   head は上向き偏重、body は水平～斜め上のばらつき大きめ
    const _spawnRadial = (name, baseDeg, spreadDeg) => {
      const dName = _detachOneNamed(e, name, null);
      if (!dName || !e.flyingParts || e.flyingParts.length === 0) return;
      const fp = e.flyingParts[e.flyingParts.length - 1];
      // 垂直軸（+y 方向）から baseDeg ± spreadDeg の範囲で角度を引く
      // 左右どちらに飛ぶかはランダム（半数ずつ程度に散らす）
      const sign = Math.random() < 0.5 ? -1 : 1;
      const ang = (baseDeg + (Math.random() * 2 - 1) * spreadDeg) * deg2rad;
      const speed = cfg.SLAM_RADIAL_SPEED + (Math.random() * 2 - 1) * cfg.SLAM_RADIAL_SPEED_JITTER;
      fp.vx = sign * Math.sin(ang) * speed;
      fp.vy = Math.cos(ang) * speed;
      fp.vz = (Math.random() - 0.5) * 4;
      fp.angVx = (Math.random() - 0.5) * 0.6;
      fp.angVy = (Math.random() - 0.5) * 0.6;
      fp.angVz = (Math.random() - 0.5) * 0.6;
      // 赤発光：_detachOneNamed が unlit 黒に上書きしているので赤に塗り直し
      for (const mat of (fp._materials || [])) {
        if (mat && mat.color) mat.color.setRGB(1, 0.05, 0.05);
      }
    };
    // head：垂直から ±60° 扇形（より上向き）
    _spawnRadial('head', 30, cfg.SLAM_UP_SPREAD_DEG);
    // body：垂直から ±90°（水平方向にも開く）
    _spawnRadial('body', 60, cfg.SLAM_BODY_HORIZ_DEG);
    // 下半身（stand）：逆さまにして地面にめり込ませる
    const standName = _detachOneNamed(e, 'stand', null);
    if (standName && e.flyingParts && e.flyingParts.length > 0) {
      const sp = e.flyingParts[e.flyingParts.length - 1];
      sp.vx = 0; sp.vy = 0; sp.vz = 0;
      sp.angVx = 0; sp.angVy = 0; sp.angVz = 0;
      sp._critGravMult = 0;       // 重力 OFF（地面に固定）
      sp.y = cfg.SLAM_STAND_STICK_Y;   // めり込み量
      // mesh 位置 + 逆さま回転を即時反映
      if (sp.mesh) {
        sp.mesh.position.set(sp.x, sp.y, sp.z);
        sp.mesh.rotation.x = cfg.SLAM_STAND_ROT_X;
      }
      // 赤発光
      for (const mat of (sp._materials || [])) {
        if (mat && mat.color) mat.color.setRGB(1, 0.05, 0.05);
      }
    }
  } else {
    // toward_player：その場で直立赤発光 → 白 → 爆散
    e.knockbackVx = 0;
    e.knockbackVz = 0;
    e.vy = 0;
    e.y = 0;
    e.burstSpinRate = 0;
    e.burstGravMult = 0;
    e.burstRollAngle = 0;
    e.tiltAngle = 0;
    e.pitchAngle = 0;
    e.downTimer = 0;
    e.state = STATE.wait01;
  }
}

// ============================================================
//  Phase 3-C：lv06 ヒット時のバーストダウン即爆散ルート（黒フェード経由しない直行）
// ============================================================
//  SCRAP THEM!!! フェイタルフェーズ（§10）
//  ボスの HP が 0 到達後、即爆散させず段階的なフィニッシャー演出を挟む。
//  フェーズマシン：
//    A: 'slow_in'     入場スロー 3秒 + 真っ黒フェード（早々に完了）+ バナー
//    B: 'stun'        スタン期 10秒（プレイヤー自由コンボ・HP は 1 で固定）
//    C: 'pre_freeze'  爆発前フリーズ 1.5秒（hitstop で全停止）
//    D: 爆散          enterEnemyDyingBurst（hitstop 抜けた次ティック）
// ============================================================
export function enterBossFatal(e, p) {
  if (!e || e.dying || e.bossFatal) return false;
  const _CFG = BOSS01_CONFIG;
  e.bossFatal              = true;
  e.bossFatalPhase         = 'slow_in';
  e.bossFatalPhaseTimer    = _CFG.FATAL_SLOWIN_TIMER ?? 60;
  e.bossFatalBannerTimer   = _CFG.FATAL_BANNER_DELAY ?? 30;
  e._bossFatalFrame        = 0;
  e._bossFatalFadeProgress = 0;
  // HP を 1 に固定：フェイタル中の追加ダメージは見た目のみ（コンボ継続目的）
  e.hp                = 1;
  // AI とスタン：ボスは完全静止（既存 bossStun 機構を再利用）
  e.aiEnabled         = false;
  e.bossStun          = true;
  // bossStun はフェイタル全期間 + マージン
  e.bossStunTimer     = (_CFG.FATAL_SLOWIN_TIMER ?? 60) + (_CFG.FATAL_STUN_FRAMES ?? 600) + (_CFG.FATAL_FREEZE_FRAMES ?? 90) + 60;
  e._bossStunFrame    = 0;
  e.bossSAStunTimer   = 0;
  e.bossFullSA        = false;
  // SA カウンターも解除（フェイタル中は毎ヒット受ける演出のため）
  e.bossSACounter     = 0;
  // 攻撃停止
  e.atkPhase          = null;
  e.atkTimer          = 0;
  e.atkCooldown       = 99999;
  e.repulseWindow     = false;
  e._odSlotPhase      = null;
  e._odSlotAxis       = null;
  e._odSlotIdx        = null;
  e._odSlotTimer      = 0;
  e._odInitDone       = false;
  e._odComboRcLockedOut = false;
  e._odPerfectRcCount = 0;
  e.knockbackVx       = 0;  // 既存 KB を即停止（よろめきベース位置を確定するため）
  e.hitFlashTimer     = 0;  // 直前の被弾フラッシュ残り（シルエットを汚さないため）
  e._chargeT          = 0;  // 黄色チャージ発光（atk_06 等の予兆色を消す）
  // 状態異常解除：燃焼 DoT / shell-outline / status_stun を停止
  //   フェイタル中は HP=1 保護で DoT は無害だが、shell-outline がシルエット上に
  //   重なって絵が濁る + status_stun の演出が競合するため明示的に切る
  if (e.burnTimer > 0) {
    e.burnTimer         = 0;
    e.burnBlastReady    = false;
    e.burnAutoBlastTimer = 0;
    e.detonateTimer     = 0;
    _detachBurnOutline(e);
  }
  e.statusStunTimer   = 0;
  // missile_barrage 中断時の取り残し AOE/メッシュをクリア（フェイタル突入時）
  _cleanupMissiles(e);
  // よろめき位置をその場に固定
  e._bossFatalBaseX   = e.x;
  // パーツ脱落の予定順序（末端→中央）— GC を経由せず順次 _detachOneNamed で 1 個ずつ
  //   左右の腕どちらが先かはランダム / body は含めない（上半身泣き別れ回避）
  e._fatalDetachOrder = ['lArmPivot', 'rArmPivot', 'stand', 'head'];
  if (Math.random() < 0.5) {
    [e._fatalDetachOrder[0], e._fatalDetachOrder[1]] = [e._fatalDetachOrder[1], e._fatalDetachOrder[0]];
  }
  e._fatalDetachCooldown = _CFG.FATAL_DETACH_FIRST_DELAY ?? 60;
  // スローモーション（入場：3 秒・DIVISOR=3 で 60 update tick）
  if (typeof window !== 'undefined' && window.SB) {
    window.SB.megaSlow = Math.max(window.SB.megaSlow ?? 0, _CFG.FATAL_SLOWIN_FRAMES ?? 180);
  }
  // プレイヤー側：無敵点滅でシルエットがチラつかないよう invincibleFrames をクリア
  //   ボスはスタン中で攻撃しないので無敵は不要
  //   ＋ SP を完全回復（フェイタル＝隙に必殺技を叩き込むターン）
  if (_players) {
    for (const _p of _players) {
      if (_p) {
        _p.invincibleFrames = 0;
        _p.sp = SP_CONFIG.MAX;
      }
    }
  }
  return true;
}

// ============================================================
//  フェイタル update：毎ティック呼ばれる（boss update loop 内）
//   フェード進行・よろめき・フェーズ遷移を回す
// ============================================================
function _updateBossFatal(e) {
  if (!e.bossFatal || e.dying) return;
  const _CFG = BOSS01_CONFIG;
  e._bossFatalFrame = (e._bossFatalFrame ?? 0) + 1;
  // HP クランプ（フェイタル中の追加ダメージで爆散しないよう保護）
  if (e.hp <= 0) e.hp = 1;
  // 真っ黒フェード（早々に完了）：fade 完了後は固定で真っ黒オーバーレイ
  //   ボスのみ slow_in から fade。プレイヤーは small_explode 突入で別途 fade 開始。
  const _fadeDur = _CFG.FATAL_BLACK_FADE_FRAMES ?? 25;
  e._bossFatalFadeProgress = Math.min(1, (e._bossFatalFadeProgress ?? 0) + 1 / _fadeDur);
  _setMeshChargeColor(e, e._bossFatalFadeProgress, 0x000000);
  // プレイヤー黒フェード（small_explode/big_explode 限定。stun 中は通常色のまま）
  if (e.bossFatalPhase === 'small_explode' || e.bossFatalPhase === 'big_explode') {
    e._fatalPlayerFadeProgress = Math.min(1, (e._fatalPlayerFadeProgress ?? 0) + 1 / _fadeDur);
    if (_players) {
      for (const _p of _players) {
        if (_p && _p.mesh) tintBody(_p.mesh, 0, 0, 0, e._fatalPlayerFadeProgress);
      }
    }
  }
  // バナー遅延表示（slow_in 中の少し遅れたタイミング）
  if ((e.bossFatalBannerTimer ?? 0) > 0) {
    e.bossFatalBannerTimer--;
    if (e.bossFatalBannerTimer === 0) {
      spawnBanner('SCRAP THEM!!!', { frames: 150, color: '#ffcc00', fontSize: 80 });
    }
  }
  // 位置を完全ロック：knockback / wobble 起因の漂流を防ぐ
  //   旧 sin wave wobble は「ゆっくり歩いて見える」と指摘あり → 撤去
  //   毎フレーム baseX に強制スナップ + knockbackVx を 0 に潰す
  e.knockbackVx = 0;
  e.x = (e._bossFatalBaseX ?? e.x);
  if (e.mesh) e.mesh.position.x = e.x;
  // bossStun を強制 ON 維持（hit-engine の KB1/KB2 降格ロジックを確実に効かせる）
  //   タイマー自然減衰で false に切れるとフェイタル中のリアクションが打ち上げに戻る
  e.bossStun      = true;
  e.bossStunTimer = Math.max(e.bossStunTimer ?? 0, 999);
  // === フェーズ機械（A: slow_in → B: stun → C: small_explode → D: big_explode）===

  // ── フェーズ D: 大爆発（前ティックで megaSlow セット済み・このティックで爆散）──
  if (e.bossFatalPhase === 'big_explode') {
    e.bossFatal = false;
    e.hp        = 0;
    e.lastHitter = { lv: 6, facing: 1, forceGc: false };
    if (_players) {
      for (const _p of _players) {
        if (_p && _p.mesh) restoreBodyColor(_p.mesh);
      }
    }
    // プレイヤー固定解除（大爆発開始 → 後はリザルト/ステージ遷移へ）
    if (typeof window !== 'undefined' && window.SB) window.SB._fatalPlayerFreeze = false;
    enterEnemyDyingBurst(e, e.lastHitter, 1);
    return;
  }

  // ── フェーズ C: 小爆発ループ（ポーズ完全固定）──
  if (e.bossFatalPhase === 'small_explode') {
    // ポーズ完全固定：state / 位置 / 回転 すべてを snapshot に強制スナップ
    if (e._fatalLockState) {
      e.state = e._fatalLockState;
      e.downTimer = 99999;
      e.atkPhase  = null;
      e.atkTimer  = 0;
    }
    if (e._fatalLockY !== undefined) {
      e.y  = e._fatalLockY;
      e.vy = 0;
      if (e.mesh) e.mesh.position.y = e.y;
    }
    if (e._fatalLockRotX !== undefined && e.mesh) {
      e.mesh.rotation.x = e._fatalLockRotX;
      e.mesh.rotation.y = e._fatalLockRotY;
      e.mesh.rotation.z = e._fatalLockRotZ;
    }
    // 小爆発抽選：spawnDeathExplosion を流用（小スケール・hitstop なし）+ 二重 BlastSphere で派手に
    e._fatalSmallBlastCd = (e._fatalSmallBlastCd ?? 0) - 1;
    if (e._fatalSmallBlastCd <= 0) {
      const _ox = (Math.random() - 0.5) * 240;
      const _oy = 60 + Math.random() * 240;
      const _oz = (Math.random() - 0.5) * 100;
      const _bx = e.x + _ox, _by = e.y + _oy, _bz = e.z + _oz;
      // 多層 BlastSphere：外殻（大・オレンジ）+ 内殻（小・黄白）→ 視認性 MAX
      spawnBlastSphere(_bx, _by, _bz, { maxRadius: 220, life: 16, color: 0xff7722 });
      spawnBlastSphere(_bx, _by, _bz, { maxRadius: 130, life: 12, color: 0xffdd55 });
      // 粒子（外側に散らす）
      spawnHitParticles(_bx, _by, _bz, 0xff4422, 32, { type: 'omni' });
      spawnHitParticles(_bx, _by, _bz, 0xffaa33, 20, { type: 'omni' });
      spawnHitParticles(_bx, _by, _bz, 0xffffaa, 14, { type: 'omni' });
      triggerShake(8, 10);
      triggerHitstop(2);  // 1 ティック分の体感ストップで「爆発感」を補強
      e._fatalSmallBlastCd = _CFG.FATAL_SMALL_BLAST_INTERVAL ?? 14;
      if (window.SB?.DEBUG_FATAL) console.log(`[FATAL small_blast] x=${_bx.toFixed(0)} y=${_by.toFixed(0)} timer=${e.bossFatalPhaseTimer}`);
    }
    e.bossFatalPhaseTimer = (e.bossFatalPhaseTimer ?? 0) - 1;
    if (e.bossFatalPhaseTimer <= 0) {
      e.bossFatalPhase = 'big_explode';
      if (typeof window !== 'undefined' && window.SB) {
        window.SB.megaSlow = Math.max(window.SB.megaSlow ?? 0, _CFG.FATAL_BIG_SLOW_FRAMES ?? 90);
      }
      if (window.SB?.DEBUG_FATAL) console.log('[FATAL] → big_explode (megaSlow set)');
    }
    _updateFlyingParts(e);
    return;
  }

  // ── フェーズ B: スタン期（コンボ切れ / バーストダウン / タイムアウトで終了）──
  if (e.bossFatalPhase === 'stun') {
    // パーツ脱落（stun 期のみ）
    if (Array.isArray(e._fatalDetachOrder) && e._fatalDetachOrder.length > 0) {
      e._fatalDetachCooldown = (e._fatalDetachCooldown ?? 0) - 1;
      if (e._fatalDetachCooldown <= 0) {
        const _name = e._fatalDetachOrder.shift();
        _detachOneNamed(e, _name, null);
        spawnHitParticles(e.x, e.y + 90, e.z, 0x222222, 12, { type: 'omni' });
        triggerHitstop(4);
        e._fatalDetachCooldown = _CFG.FATAL_DETACH_INTERVAL ?? 90;
      }
    }
    // 終了トリガ判定：コンボ切れ / バーストダウン / タイムアウト
    const _prevCombo = e._fatalPrevCombo ?? 0;
    const _curCombo  = combo.count ?? 0;
    e._fatalPrevCombo = _curCombo;
    const _comboJustBroke = _prevCombo > 0 && _curCombo === 0;
    const _burstDown      = (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop);
    e.bossFatalPhaseTimer = (e.bossFatalPhaseTimer ?? 0) - 1;
    const _timeOut        = e.bossFatalPhaseTimer <= 0;
    if (_comboJustBroke || _burstDown || _timeOut) {
      // small_explode へ移行：ポーズ完全 snapshot + dyingInvincible で完全固定
      e.bossFatalPhase      = 'small_explode';
      e.bossFatalPhaseTimer = _CFG.FATAL_SMALL_EXPLODE_FRAMES ?? 120;
      e._fatalSmallBlastCd  = 0;
      e._fatalLockState     = e.state;
      e._fatalLockY         = e.y;
      if (e.mesh) {
        e._fatalLockRotX = e.mesh.rotation.x;
        e._fatalLockRotY = e.mesh.rotation.y;
        e._fatalLockRotZ = e.mesh.rotation.z;
      }
      e.dyingInvincible     = true;
      // プレイヤーも完全固定：小爆発フェーズ＝「終了」表明のため、入力・移動・攻撃を遮断
      //   player-system 側で window.SB._fatalPlayerFreeze を読んで updatePlayer を skip
      if (typeof window !== 'undefined' && window.SB) window.SB._fatalPlayerFreeze = true;
      if (window.SB?.DEBUG_FATAL) {
        const _reason = _burstDown ? 'burstDown' : (_comboJustBroke ? 'comboBreak' : 'timeOut');
        console.log(`[FATAL] stun → small_explode (reason=${_reason} prevCombo=${_prevCombo} curCombo=${_curCombo} state=${e.state})`);
      }
    }
    _updateFlyingParts(e);
    return;
  }

  // ── フェーズ A: slow_in（タイマーで stun へ）──
  e.bossFatalPhaseTimer = (e.bossFatalPhaseTimer ?? 0) - 1;
  if (e.bossFatalPhaseTimer <= 0 && e.bossFatalPhase === 'slow_in') {
    e.bossFatalPhase      = 'stun';
    e.bossFatalPhaseTimer = _CFG.FATAL_STUN_FRAMES ?? 600;
    e._fatalPrevCombo     = combo.count ?? 0;
    if (window.SB?.DEBUG_FATAL) console.log(`[FATAL] slow_in → stun (combo=${combo.count})`);
  }
  _updateFlyingParts(e);
}

//   - HP 0 を lv06 攻撃で達成した瞬間に呼ばれる
//   - 即座に色を黒に（fade=0）、hold=0、phase='burst' でカウントダウン開始
//   - 既存 down_burst_* state の物理を流用（きりもみ吹っ飛び）
//   - 完全無敵（dyingInvincible=true）
//   - BURST_SPIN_DURATION 経過 → _triggerFinalExplosion（爆散・パーツ全飛散）
//   - 進行中は _updateDyingTimers でオイルトレイル発生
// ============================================================
export function enterEnemyDyingBurst(e, ctx, hitFacing) {
  if (!e || e.dying) return false;
  recordKill();
  if (window.SB && window.SB.DEBUG_GORE_CRITICAL) {
    console.log(`[GORECRIT] enterEnemyDyingBurst called (hp=${e.hp}, y=${e.y|0}, lastHitter=${JSON.stringify(e.lastHitter)})`);
  }
  e.dying           = true;
  e.dyingPhase      = 'burst';
  e.dyingFadeTimer  = 0;   // フェード省略：即完全黒（色は _applyDyingColorOverride が t=1 で固定）
  e.dyingHoldTimer  = 0;
  e.dyingFinalTimer = GORE_CONFIG.BURST_SPIN_DURATION;
  e.dyingInvincible = true;
  e.aiEnabled       = false;
  e.atkPhase        = null;
  e.hitDelivered    = false;
  e.repulseWindow   = false;   // dying 死体に「危↑」HUD が残るリーク防止
  e._jdDiveGrace    = 0;       // RC dive grace の残値クリア
  // enemy_attacking state でこのフローに入った場合のロック回避（D-3）。
  // burst ルートは下で state を STATE.down_burst_start に上書きするので明示変更は不要だが、
  // 念のため atkTimer はクリアしておく（machine が再評価される事故防止）
  e.atkTimer        = 0;
  _clearAllTokens(ctx, e);
  // 速度は触らない：直前の hit-engine lv6 dispatch が attack 由来の値を既に設定済
  //   （knockbackVx = facing * attack.knockback * 0.4 * sameScale * kb_vx_mult_lv6）
  //   （vy = attack.kb_vy_lv6 or KB_LV06_VY、kbDecay = attack.kb_vx_decay_lv6 等）
  //   → SP4 の慣性などがそのままきりもみ飛行に反映される
  // フォールバック：コンソール手動発火で velocity 未設定の場合は KB_BURST_* を流し込む
  if (!e.knockbackVx && !e.vy) {
    const p0 = _players && _players[0];
    const backDir = (p0 && p0.x > e.x) ? -1 : (p0 ? 1 : ((typeof hitFacing === 'number') ? hitFacing : 1));
    e.knockbackVx = backDir * KB_BURST_VX;
    e.vy = KB_BURST_VY;
    e.fallDir = backDir;
  } else {
    // dispatch 由来の knockbackVx の符号で fallDir 決定（吹き飛び方向 = fallDir）
    e.fallDir = (e.knockbackVx >= 0) ? 1 : -1;
  }
  // スピン用パラメータ（既存 down_burst_* state 機械が rotation に使う）
  e.burstSpinRate = KB_BURST_SPIN_RATE;
  e.burstGravMult = KB_BURST_GRAV_MULT;
  e.burstRollAngle = 0;
  // state を down_burst_start にスワップ（lv6 dispatch が down_super_start にしていてもオーバーライド）
  e.state = STATE.down_burst_start;
  e.downTimer = ENEMY_DOWN_BURST_START_FRAMES;
  e.hitFlashTimer = 0;
  e.burstFlashTimer = 0;
  // 延焼関連処理：burn shell は GC 抽選より前に剥がす
  const _burnActive = (e.burnTimer > 0);
  _detachBurnOutline(e);
  // ゴア・クリティカル抽選（burst ルートも対象：SP4 lv06 killing hit 等）
  _maybeArmGoreCritical(e);
  // 延焼中に burst kill → CHAIN_BLAST：周囲爆発 + 範囲内の生存敵に burn 付与
  if (BURN_CONFIG.DEATH_BLAST_ENABLED && _burnActive) _spawnBurnDeathBlast(e);
  e.burnTimer = 0;
  return true;
}

// ============================================================
//  コンソール用：敵を強制的に死亡フローへ（テスト・デバッグ用）
//   SB.killEnemy(SB.enemies[0])
//   - instantRespawn フラグを無視して強制的に enemy_dying へ
// ============================================================
export function killEnemy(e, ctx) {
  if (!e || !e.isAlive || e.dying) return false;
  e.hp = 0;
  return enterEnemyDying(e, ctx);
}

// 黒色（フェード目標）— モジュールスコープで使い回し
let _BLACK = null;
let _RED = null;
let _THREE_REF = null;  // パーツ独立化時の mesh 親付け替えで Vector3 等に使う
export function initEnemyGoreBlack(THREE) {
  _BLACK = new THREE.Color(GORE_CONFIG.TARGET_COLOR);
  const [r, g, b] = GORE_CRITICAL_CONFIG.RED_COLOR;
  _RED = new THREE.Color(r, g, b);
  _THREE_REF = THREE;
}

// ============================================================
//  Phase 3-B：パーツ 1 つを抽選で分離（2026-05-20 逐次分離型）
//   - 本体 mesh から残存パーツのうち 1 つをランダムに抽選 → scene 直下へ独立化
//   - 残りは本体に付いたまま、fade/hold タイマーは継続
//   - 戻り値：分離した part 名 / 残パーツ無しなら null
//   - 共有 material は clone して個別化（detach 後の opacity 操作が本体に波及しないように）
// ============================================================
export function detachOnePart(e, hitFacing) {
  if (!e || !e.mesh || !e.mesh.userData || !e.mesh.userData.parts) return null;
  const parts = e.mesh.userData.parts;
  // 本体にまだ付いている part の名前リスト
  const attachedNames = Object.keys(parts).filter(name => {
    const m = parts[name];
    return m && m.parent === e.mesh;
  });
  if (attachedNames.length === 0) return null;
  // 胴体は最後に飛ぶ：head/stand 等が残っている間は body を抽選対象から除外。
  //   gs（gore-scrap）では「胴体ぶった切り」は gc に譲り、通常死亡では body 分離 = 最終フィニッシュ。
  //   2026-05-19 ユーザー指示：パーツ抽選優先順位変更。
  const nonBodyNames = attachedNames.filter(n => n !== 'body');
  const candidatePool = nonBodyNames.length > 0 ? nonBodyNames : attachedNames;
  const pickedName = candidatePool[Math.floor(Math.random() * candidatePool.length)];

  // body 抽選成立 = 残っているのが body だけ → 上半身バンドル分離（フラッシュ → 爆発の final シーケンスへ）
  if (pickedName === 'body') {
    return _detachBodyBundle(e, hitFacing);
  }

  // 通常：単一パーツのランダム分離
  return _detachOneNamed(e, pickedName, null);
}

// 内部ヘルパ：胴体バンドル（body + head + nose の親子構造を保持）として分離
//   - 全 part の material を MeshBasicMaterial(0x000000) に置換
//   - head + nose を body の子に reparent（Object3D.attach で world 座標保持）
//   - body 自体を scene 直下に attach（同じく world 座標保持）
//   - flyingParts に 1 つだけエントリ追加（mesh=body, _materials=[3 つ]）
//   - 残り（stand）は _triggerFinalExplosion で別途分離 + 即爆散
function _detachBodyBundle(e, hitFacing) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts || !parts.body || parts.body.parent !== e.mesh) return null;
  const body = parts.body;
  const head = (parts.head && parts.head.parent === e.mesh) ? parts.head : null;
  // nose は head の子（subParts.nose）として保持されている：head に付随して飛ぶ
  const nose = e.mesh.userData.subParts && e.mesh.userData.subParts.nose;
  // 全 part の material を unlit 黒へ
  const bundleMaterials = [];
  if (_THREE_REF) {
    body.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
    bundleMaterials.push(body.material);
    if (head) {
      head.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(head.material);
    }
    if (nose && nose.material) {
      nose.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(nose.material);
    }
  }
  // head を body の子に reparent（world 座標保持）— nose は head の子なので自動追従
  if (head) body.attach(head);
  // body 自体を scene 直下に attach（world 座標保持・head + nose は body の子のまま）
  const worldPos = new _THREE_REF.Vector3();
  body.getWorldPosition(worldPos);
  _scene.attach(body);
  // velocity：ランダム単発（後続パーツに合わせて散らかし）
  const rand = ([lo, hi]) => lo + Math.random() * (hi - lo);
  const sign = (hitFacing !== undefined) ? -Math.sign(hitFacing) : (Math.random() < 0.5 ? -1 : 1);
  if (!e.flyingParts) e.flyingParts = [];
  e.flyingParts.push({
    mesh: body, name: 'body+upper',
    x: worldPos.x, y: worldPos.y, z: worldPos.z,
    vx: sign * rand(GORE_CONFIG.PART_VX_RANGE),
    vy: rand(GORE_CONFIG.PART_VY_INITIAL),
    vz: rand(GORE_CONFIG.PART_VZ_RANGE),
    bounced: false, fadeTimer: 0,
    angVx: (Math.random() - 0.5) * 0.3,
    angVy: (Math.random() - 0.5) * 0.3,
    angVz: (Math.random() - 0.5) * 0.3,
    _materials: bundleMaterials,    // フェード時にまとめて opacity 操作
  });
  // 残り（stand）を「白フラッシュ → 爆散」の通常 final シーケンスに乗せる：
  //   旧コードは即 _triggerFinalExplosion で爆発させていたため、白フラッシュ window が
  //   発生せず "白光せずに爆ぜる" バグになっていた（2026-05-19 修正）。
  //   タイマー = PREEXPLODE_FLASH_FRAMES + 余白 → _updateDyingTimers の final 経路で
  //   フラッシュ → 爆発の流れに合流する。
  e.dyingPhase     = 'final';
  e.dyingFinalTimer = GORE_CONFIG.PREEXPLODE_FLASH_FRAMES + 2;
  e.dyingHoldTimer  = 0;
  e.dyingFadeTimer  = 0;
  e.dyingInvincible = true;
  return 'body+upper';
}

// 内部ヘルパ：1 パーツを「指定 velocity（null ならランダム）」で分離
// parts[name] が配列（例：enem02 の legs = 4本足の Array）の場合は配列内の各 mesh を
// 個別 detach。戻り値は配列で detach した数 (>0) ／ null（取れなかった or 単一 mesh）。
function _detachArrayNamed(e, name) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts) return null;
  const arr = parts[name];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let count = 0;
  // 元配列をスナップショットしてから順に detach（detach は parent から外すので元配列を破壊しない方が無難）
  const snapshot = arr.slice();
  for (const m of snapshot) {
    if (!m || m.parent !== e.mesh) continue;
    // 単一 mesh の detach 経路を流用するため、一時的に parts に名前付きで差し込む
    const tmpKey = `__tmp_${name}_${count}`;
    parts[tmpKey] = m;
    const ok = _detachOneNamed(e, tmpKey, null);
    delete parts[tmpKey];
    if (ok) count++;
  }
  return count > 0 ? count : null;
}

function _detachOneNamed(e, name, sharedVelocity) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts) return null;
  const partMesh = parts[name];
  if (!partMesh || partMesh.parent !== e.mesh) return null;
  // MeshBasicMaterial（unlit）で完全黒シルエットを保証
  const bundleMaterials = [];
  if (partMesh.material && _THREE_REF) {
    partMesh.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
    bundleMaterials.push(partMesh.material);
  }
  // head detach: nose は head の子なので Three.js 親子で自動追従
  //   nose の material も unlit 黒へ swap し、bundle 内に含めてフェード時にまとめて消す
  if (name === 'head') {
    const nose = e.mesh.userData.subParts && e.mesh.userData.subParts.nose;
    if (nose && nose.material && _THREE_REF) {
      nose.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(nose.material);
    }
  }
  // world 座標を保持して scene 直下へ
  const worldPos = new _THREE_REF.Vector3();
  partMesh.getWorldPosition(worldPos);
  const worldQuat = new _THREE_REF.Quaternion();
  partMesh.getWorldQuaternion(worldQuat);
  partMesh.parent.remove(partMesh);
  _scene.add(partMesh);
  partMesh.position.copy(worldPos);
  partMesh.quaternion.copy(worldQuat);
  // velocity 決定（shared なら共有・null ならランダム）
  let vx, vy, vz;
  if (sharedVelocity) {
    vx = sharedVelocity.vx;
    vy = sharedVelocity.vy;
    vz = sharedVelocity.vz;
  } else {
    const rand = ([lo, hi]) => lo + Math.random() * (hi - lo);
    const sign = (Math.random() < 0.5 ? -1 : 1);
    vx = sign * rand(GORE_CONFIG.PART_VX_RANGE);
    vy = rand(GORE_CONFIG.PART_VY_INITIAL);
    vz = rand(GORE_CONFIG.PART_VZ_RANGE);
  }
  if (!e.flyingParts) e.flyingParts = [];
  e.flyingParts.push({
    mesh: partMesh, name,
    x: worldPos.x, y: worldPos.y, z: worldPos.z,
    vx, vy, vz,
    bounced: false, fadeTimer: 0,
    angVx: (Math.random() - 0.5) * 0.3,
    angVy: (Math.random() - 0.5) * 0.3,
    angVz: (Math.random() - 0.5) * 0.3,
    _materials: bundleMaterials,    // 単一 part でも配列：head 時は nose も含む
  });
  return name;
}

// 後方互換：旧 enterEnemyExplode は「残り全パーツを一気に分離 + 共用爆発」として残す（テスト用）
// 非 dying でも強制的に dying 化してから爆散させ、flyingParts の cleanup が回るようにする
export function enterEnemyExplode(e, ctx, hitFacing) {
  if (!e) return false;
  if (!e.dying) enterEnemyDying(e, ctx);
  _triggerFinalExplosion(e);
  return true;
}

// 飛翔中パーツの毎フレーム更新（重力 + 1 回バウンド + フェード消滅）
// 注：empty/null でも何もしないだけ。消滅判定は _updateEnemyDying 側に集約
function _updateFlyingParts(e) {
  if (!e.flyingParts || e.flyingParts.length === 0) return;
  const alive = [];
  for (const p of e.flyingParts) {
    // 強制削除タイマー（airborneKill 等で「爆発から N F 後に必ず消す」用）：
    //   後半 1/3 で線形フェード → 0 で scene 除去。settle/fade 経路より優先。
    if (p._forceRemoveTimer !== undefined) {
      p._forceRemoveTimer--;
      const fadeStart = 10;  // 残 10F から透過フェード
      if (p._forceRemoveTimer <= fadeStart) {
        const opa = Math.max(0, p._forceRemoveTimer / fadeStart);
        if (p._materials) {
          for (const mat of p._materials) {
            if (!mat) continue;
            mat.transparent = true;
            mat.opacity = opa;
          }
        } else if (p.mesh.material) {
          p.mesh.material.transparent = true;
          p.mesh.material.opacity = opa;
        }
      }
      if (p._forceRemoveTimer <= 0) {
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        if (p._materials) {
          for (const mat of p._materials) if (mat && mat.dispose) mat.dispose();
        } else if (p.mesh.material && p.mesh.material.dispose) {
          p.mesh.material.dispose();
        }
        continue;
      }
    }
    // 物理進行
    p.x += p.vx;
    p.y += p.vy;
    p.z += p.vz;
    const gravMul = p._critGravMult ?? 1;
    p.vy -= GORE_CONFIG.PART_GRAVITY * gravMul;
    // クリ爆散専用：空気抵抗で水平速度を緩やかに減衰させ、プレイヤー位置近くで失速させる
    if (p._critAirDecay) {
      p.vx *= p._critAirDecay;
      p.vz *= p._critAirDecay;
    }
    // 着地判定：1 回バウンド → 第二着地で settled（フェード開始）
    if (p.y <= 0 && p.vy < 0) {
      if (!p.bounced) {
        p.y = 0;
        p.vy = -p.vy * GORE_CONFIG.PART_BOUNCE_DAMP;
        p.vx *= 0.7;
        p.vz *= 0.7;
        p.bounced = true;
        // fadeTimer は設定しない（バウンド中は full opacity を維持）
      } else if (!p.settled) {
        // 第二着地：完全静止 + フェード開始（0.3s = PART_FADE_AFTER_BOUNCE）
        p.y = 0;
        p.vy = 0;
        p.vx *= 0.7;
        p.vz *= 0.7;
        p.settled = true;
        p.fadeTimer = GORE_CONFIG.PART_FADE_AFTER_BOUNCE;
      }
    }
    // mesh 位置反映
    p.mesh.position.set(p.x, p.y, p.z);
    // 通常は Euler 軸毎の加算。_worldAxisRot が指定されてる時はその軸まわりにクォータニオン回転で世界軸固定。
    //   bundle が rotation.y=±π/2（facing）を持っている時、p.angVx を Euler で加算すると
    //   local X 軸 = world Z 軸方向への回転になってしまい、見た目が "奥に倒れ込む" になる。
    //   gc_04 の上半身バンドルでは _worldAxisRot を指定して常に世界 X 軸まわりに回す。
    if (p._worldAxisRot && _THREE_REF) {
      const q = new _THREE_REF.Quaternion().setFromAxisAngle(p._worldAxisRot, p._worldAxisSpeed || 0);
      p.mesh.quaternion.premultiply(q);
    } else {
      p.mesh.rotation.x += p.angVx;
      p.mesh.rotation.y += p.angVy;
      p.mesh.rotation.z += p.angVz;
    }
    // 第二着地（settled）後フェードタイマー：バウンド中はフルオパシティ、settled で 0.3s フェード
    if (p.settled) {
      p.fadeTimer--;
      const opacity = Math.max(0, p.fadeTimer / GORE_CONFIG.PART_FADE_AFTER_BOUNCE);
      // 透過フェード（バンドル時は複数 material をまとめて、単発時は mesh.material のみ）
      if (p._materials) {
        for (const mat of p._materials) {
          if (!mat) continue;
          mat.transparent = true;
          mat.opacity = opacity;
        }
      } else if (p.mesh.material) {
        p.mesh.material.transparent = true;
        p.mesh.material.opacity = opacity;
      }
      if (p.fadeTimer <= 0) {
        // 消滅：scene から外す + material dispose（メモリリーク防止）
        if (p.mesh.parent) p.mesh.parent.remove(p.mesh);
        if (p._materials) {
          for (const mat of p._materials) if (mat && mat.dispose) mat.dispose();
        } else if (p.mesh.material && p.mesh.material.dispose) {
          p.mesh.material.dispose();
        }
        continue;  // alive に加えない
      }
    }
    alive.push(p);
  }
  e.flyingParts = alive;
  // 注：flyingParts が空になっても e.dyingPhase==='exploded' でない限り removed を立てない。
  //   旧コードは phase 不問で removed=true にしていたため、「ヒットで head/stand を分離
  //   → 残った body 抽選前に flying parts が fade → 本体が爆発せず消滅」というバグになっていた
  //   （HOLD タイマー自動 final 経路に到達する前に消える・2026-05-19 修正）。
  //   final 経路の自動爆発まで残すには、phase==='exploded' を removed の必須条件にする。
  if (alive.length === 0 && e.dyingPhase === 'exploded') {
    e.removed = true;
    e.isAlive = false;
  }
}

// ============================================================
//  Phase 3-B：dying 中ヒットのハンドラ（hit-engine から divert・2026-05-20 逐次分離型）
//   - 必ず黒オイルパーティクルを発火（ヒット感）
//   - 確率判定 → 当選なら detachOnePart で残存パーツから 1 つ抽選分離
//   - 残パーツ無し時は何もしない（hold 満了まで本体は黒シルエットのまま）
// ============================================================
export function handleEnemyDyingHit(e, hitX, hitY, hitZ, hitFacing) {
  if (!e || !e.dying) return false;
  // 既に armed：何もしない（追撃保護・赤発光中の身体を維持）
  if (e.goreCritical && e.goreCritical.armed) return false;
  // ★ゴア・クリティカル抽選（仕様：dying 中の各ヒットごとに抽選）
  //   爆散・消滅するまで、攻撃ヒット毎にチャンスがある
  //   死亡直後の最初の killing hit（enterEnemyDying/Burst 内）と同じ抽選を走らせる
  _maybeArmGoreCritical(e);
  if (e.goreCritical && e.goreCritical.armed) {
    // armed 発火：パーツ分離抽選はスキップ（赤発光シーケンス開始）
    return true;
  }
  // stunned 中に殴られたら reacting に戻す（被弾モーション再生のため）
  //   → 通常被弾 dispatch（hit-engine 後段）で state が knockback などに変わる
  //   → wait01 復帰でまた stunned に入る
  if (e.dyingPhase === 'stunned') {
    e.dyingPhase = 'reacting';
    e.dyingStunnedTimer = 0;
  }
  // reacting 中のみパーツ分離抽選（final/burst/exploded はバラさず黒爆散）
  if (e.dyingPhase !== 'reacting') return false;
  // 黒オイルパーティクル（命中位置・常時）
  spawnHitParticles(hitX, hitY, hitZ, GORE_CONFIG.OIL_PARTICLE_COLOR, GORE_CONFIG.OIL_PARTICLE_COUNT);
  // 確率判定 → 抽選で 1 パーツ分離
  if (Math.random() < GORE_CONFIG.PART_BREAK_PROB) {
    const detached = detachOnePart(e, hitFacing);
    if (detached) {
      triggerShake(4, 8);  // 1 パーツ単位なので軽め
      return true;
    }
  }
  return false;
}

// ============================================================
//  Phase 3 dying タイマー進行（フェード/ホールド/最終フェーズ）
//   - 'fading'：fade と hold を並列で消費。hold 満了 → 'final' へ
//   - 'final'：state=down_front_start で後方吹き飛び＋無敵。FINAL_EXPLODE_DELAY 後 → 'exploded'
//   - 'exploded'：全パーツ分離・本体 mesh 除去済。flyingParts 消滅で removed=true
//   毎フレーム updateEnemies の冒頭で e.dying のときに呼ばれる（normal state machine は維持）
// ============================================================
function _updateDyingTimers(e, ctx) {
  // ゴア・クリティカル armed：通常 fade/hold/burst を bypass し専用シーケンスへ
  // toward_player variant は state machine を止めて直立赤発光、
  // wall_blast_toward_player variant は state machine を動かして壁まで吹き飛ぶ
  if (e.goreCritical && e.goreCritical.armed) {
    _advanceGoreCritical(e);
    _updateFlyingParts(e);
    if (e.dyingPhase === 'exploded' && (!e.flyingParts || e.flyingParts.length === 0)) {
      _clearAllTokens(ctx, e);
      e.removed = true;
      e.isAlive = false;
    }
    return;
  }
  if (e.dyingPhase === 'reacting') {
    // 通常被弾モーション中・color フェード進行・wait01 到達待ち
    // 分解タイマー（hold = 3.5s）が最優先：先に切れたらその時点で強制 final
    if (e.dyingFadeTimer > 0) e.dyingFadeTimer--;
    if (e.dyingHoldTimer > 0) e.dyingHoldTimer--;
    if (e.dyingHoldTimer <= 0) {
      // hold 優先：reacting 中でも分解タイマー切れで即 final
      _enterDyingFinal(e, ctx);
    } else if (e.state === STATE.wait01) {
      // wait01 到達 → stunned へ（直立操作不能・残留速度ゼロ化で完全静止）
      e.dyingPhase = 'stunned';
      e.dyingStunnedTimer = GORE_CONFIG.STUN_DURATION;
      e.knockbackVx = 0;
      e.knockbackVz = 0;
      if (e.y <= 0) e.vy = 0;
    }
  } else if (e.dyingPhase === 'stunned') {
    // 直立操作不能。hold 最優先（先に切れたら stun 残量関わらず final）／ 通常は stun 約 2 秒で final
    if (e.dyingFadeTimer > 0) e.dyingFadeTimer--;
    if (e.dyingHoldTimer > 0) e.dyingHoldTimer--;
    if (e.dyingStunnedTimer > 0) e.dyingStunnedTimer--;
    if (e.dyingHoldTimer <= 0 || e.dyingStunnedTimer <= 0) {
      _enterDyingFinal(e, ctx);
    }
  } else if (e.dyingPhase === 'final') {
    if (e.dyingFinalTimer > 0) e.dyingFinalTimer--;
    if (e.dyingFinalTimer <= 0) _triggerFinalExplosion(e);
  } else if (e.dyingPhase === 'burst') {
    // Phase 3-C：lv06 即きりもみ。BURST_SPIN_DURATION 経過で爆散へ
    if (e.dyingFinalTimer > 0) e.dyingFinalTimer--;
    // オイルトレイル：一定間隔で黒粒子を撒く（速度低めで漂う）
    if (e.dyingFinalTimer % GORE_CONFIG.OIL_TRAIL_INTERVAL === 0) {
      spawnHitParticles(e.x, e.y + 60, e.z,
        GORE_CONFIG.OIL_PARTICLE_COLOR,
        GORE_CONFIG.OIL_TRAIL_PER_FRAME,
        { type: 'omni', sizeScale: 0.9, speedMul: 0.45, lifeMul: 1.2 });
    }
    if (e.dyingFinalTimer <= 0) _triggerFinalExplosion(e);
  }
  // exploded フェーズは flying parts の自然消滅を待つだけ
  _updateFlyingParts(e);
  // 最終消滅判定
  if (e.dyingPhase === 'exploded' && (!e.flyingParts || e.flyingParts.length === 0)) {
    _clearAllTokens(ctx, e);
    e.removed = true;
    e.isAlive = false;
  }
}

// final フェーズ突入：後方へ強制 knockback + 完全無敵
function _enterDyingFinal(e, ctx) {
  e.dyingPhase = 'final';
  e.dyingFinalTimer = GORE_CONFIG.FINAL_EXPLODE_DELAY;
  e.dyingInvincible = true;
  // プレイヤー方向の逆を「後方」と定義
  const p0 = _players && _players[0];
  const backDir = (p0 && p0.x > e.x) ? -1 : (p0 ? 1 : (Math.random() < 0.5 ? -1 : 1));
  e.knockbackVx = backDir * GORE_CONFIG.FINAL_BACKWARD_VX;
  e.knockbackVz = 0;
  e.vy = GORE_CONFIG.FINAL_BACKWARD_VY;
  e.fallDir = backDir;
  // 既存の down_front_start 物理を流用（24F のランプで横倒し → down_front_loop へ自動遷移）
  e.state = STATE.down_front_start;
  e.downTimer = ENEMY_DOWN_FRONT_FRAMES;
  // hitFlash 解除（フラッシュが残ると色が浮く）
  e.hitFlashTimer = 0;
  e.burstFlashTimer = 0;
}

// 最終爆散：保持パーツ＋本体 mesh を瞬間消去 + 共用爆発エフェクト（2026-05-20 改修）
//   - ユーザー指示：「爆発時、保持しているパーツと下半身は瞬間的に消してください」
//   - つまり爆散時に残ってる attached parts（body/head/stand/nose）は飛ばさずに消す
//   - 既に飛翔中の flyingParts（hit で抽選分離済）はそのまま継続（自然にバウンド・フェード）
//   - 爆発感は spawnDeathExplosion に集約
function _triggerFinalExplosion(e) {
  // CR ドロップ：本ボスは派手にたくさん散らばる「ご褒美」モード（V11 比 90%）
  if (e.isBoss) {
    // メイン中央：45-63 枚を高散布
    dropCR(e.x, e.z, e.y + 80, { countMin: 45, countMax: 63, scatterMult: 2.4 });
    // 左右展開：両サイドにも追加散布（画面いっぱいに広がる絵作り）
    dropCR(e.x - 80, e.z, e.y + 100, { countMin: 18, countMax: 27, scatterMult: 1.8 });
    dropCR(e.x + 80, e.z, e.y + 100, { countMin: 18, countMax: 27, scatterMult: 1.8 });
  } else {
    dropCR(e.x, e.z, e.y + 80);
  }
  // 中ボス：チップ 1 枚確定（レアリティランダム）
  if (e.enemyType === 'midboss01') {
    dropSingleRandomChip(e.x, e.z, e.y + 80);
  }
  // 雑魚（!isBoss && !midboss01）：10% でチップ 1 枚ドロップ（2026-05-27 ユーザー指示）
  //   レアリティは CHIP_DROP_TABLE_NORMAL に従う（common 60% / uncommon 25% / rare 12% / epic 2.5% / legendary 0.5%）
  if (!e.isBoss && e.enemyType !== 'midboss01' && Math.random() < 0.10) {
    dropSingleRandomChip(e.x, e.z, e.y + 80);
  }
  // 本ボス（boss01 等 isBoss）：チップ複数散布（dropBossChips：確定レア+ + 通常 + ボーナス）
  if (e.isBoss) {
    dropBossChips(e.x, e.z, e.y + 80);
    // 10 秒後に画面全体回収（CR + 全アイテム）：取り残し回避・「最後のご褒美をすべて拾える」演出
    //   setTimeout は実時間ベース。megaSlow 中でもユーザーには 10 秒として伝わる
    //   ハンドルを window.SB._fatalCollectTimer に保持 → ステージ遷移 / リセット時に
    //   clearFatalCollectTimer() でキャンセル可能（リスポーン直後の新規アイテムを巻き込まないため）
    if (typeof window !== 'undefined' && window.SB) {
      if (window.SB._fatalCollectTimer) clearTimeout(window.SB._fatalCollectTimer);
      window.SB._fatalCollectTimer = setTimeout(() => {
        window.SB._fatalCollectTimer = null;
        collectAllCR();
        collectAllItems();
        console.log('[FATAL] auto-collect all CR + items (10s after boss death)');
      }, 10000);
    }
  }
  // ゴア・クリティカル armed：キャラ拡張バリアントで方向・追加 FX を上書き
  if (e.goreCritical && e.goreCritical.armed) {
    // variant は goreCritical 自身に格納されている値を使う（旧コードは profile.criticalExplosionVariant
    // を見ていたがそのフィールドは未定義で fallback ばかり走っていた・2026-05-18 修正）
    const variant = e.goreCritical.variant;
    // variant 別の爆散ディスパッチ
    if (variant === 'toward_player' || variant === 'wall_blast_toward_player') {
      // どちらも attached parts をプレイヤー方向へ弾く
      // wall_blast は壁位置（e.x が壁）で発火するので結果的に壁から内側（プレイヤー側）へ飛ぶ
      _explodeTowardPlayer(e);
    } else if (variant === 'split_back_blast') {
      // 胴体バンドル（body+head+nose）と下半身（stand）を分裂・逆回転で後方へ
      _explodeSplitBackBlast(e);
    } else if (variant === 'head_launch_delayed') {
      // gc_04：通常は既に launch 済みの parts を全消去して共用爆発のみ。
      //   airborneKill 時は「爆発 → 上半身が大きく上昇、下半身も少し遅れて上昇」の
      //   旧 gc_04 launch を爆発トリガーで再現（順序のみ変更）。
      const _airborneKill = !!(e.lastHitter && e.lastHitter.airborneKill);
      if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
      // airborneKill（RC ルート）：直前の RC + GC armed で既に長い hitstop が走っているため、
      //   爆発側の追加 hitstop はスキップ（「2 回ストップ」感を抑える・2026-05-27）。
      spawnDeathExplosion(e.x, e.y + 80, e.z, { skipHitstop: _airborneKill });
      if (e.flyingParts) {
        if (_airborneKill) {
          // 爆発のタイミングで launch velocity を後付け：旧 gc_04 と同じ「上半身泣き別れ + 下半身追従」の絵。
          //   - 上半身（name='body+upper'）：UPPER_LAUNCH_VY + 縦回転
          //   - それ以外（脚等）：LOWER_LAUNCH_VY + 弱い縦回転
          let dirRef = e.fallDir;
          if (dirRef !== 1 && dirRef !== -1) dirRef = (e.lastHitter && e.lastHitter.facing) || 1;
          const cfg2 = GORE_CRITICAL_CONFIG;
          for (const fp of e.flyingParts) {
            const isUpper = (fp.name === 'body+upper');
            if (isUpper) {
              // 上半身：強く上空へ「すっ飛ぶ」（contrast 重視で boost）
              fp.vx = (Math.random() - 0.5) * 2 * cfg2.UPPER_LAUNCH_VX_JITTER;
              fp.vy = 32;
              fp.vz = 0;
              fp.angVx = 0; fp.angVy = 0; fp.angVz = 0;
              fp._worldAxisRot   = new _THREE_REF.Vector3(0, 0, 1);
              fp._worldAxisSpeed = -dirRef * cfg2.UPPER_LAUNCH_ANG_X;
              fp._critGravMult   = cfg2.UPPER_LAUNCH_GRAV_MULT;
              fp._critAirDecay   = 1.0;
            } else {
              // 下半身：そこまで浮かない（少しだけポンと跳ねる感じ）
              fp.vx = (Math.random() - 0.5) * 2 * cfg2.LOWER_LAUNCH_VX_JITTER;
              fp.vy = 6;
              fp.vz = 0;
              fp.angVx = 0; fp.angVy = 0; fp.angVz = 0;
              fp._worldAxisRot   = new _THREE_REF.Vector3(0, 0, 1);
              fp._worldAxisSpeed = -dirRef * cfg2.LOWER_LAUNCH_ANG_X;
              fp._critGravMult   = cfg2.LOWER_LAUNCH_GRAV_MULT;
              fp._critAirDecay   = 1.0;
            }
            // airborneKill：爆発から 60F (1.0s) で強制削除する timer をセット。
            // 自然 fall + bounce + fade を待たず、空中でフェード消滅させる。
            fp._forceRemoveTimer = 60;
          }
        } else {
          for (const fp of e.flyingParts) {
            if (fp.mesh && fp.mesh.parent) fp.mesh.parent.remove(fp.mesh);
          }
          e.flyingParts = [];
        }
      }
    } else if (variant === 'slam_radial_split') {
      // gc_05：上半身パーツは放射飛行中・下半身は地面突き刺し中。全部消して共用爆発を地上で発火。
      if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
      spawnDeathExplosion(e.x, e.y + 80, e.z);
      if (e.flyingParts) {
        for (const fp of e.flyingParts) {
          if (fp.mesh && fp.mesh.parent) fp.mesh.parent.remove(fp.mesh);
        }
        e.flyingParts = [];
      }
    } else {
      // 未知バリアントは fallback：共用爆発のみ
      if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
      spawnDeathExplosion(e.x, e.y + 80, e.z);
    }
    // 本体 mesh が残っていれば除去（_explodeTowardPlayer は parts を独立化済なので mesh は空ガラ）
    if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
    e.dyingPhase = 'exploded';
    e.dyingInvincible = true;
    e.goreCritical.armed = false;  // シーケンス完了
    return;
  }
  e.dyingPhase = 'exploded';
  e.dyingInvincible = true;  // 念のため維持
  // 本体 mesh ごと scene から除去 → 子の attached parts も全て一括消去
  if (e.mesh && e.mesh.parent) e.mesh.parent.remove(e.mesh);
  // 共用死亡爆発（プレイヤー dying と同じ・多層パーティクル+shake+hitstop）
  spawnDeathExplosion(e.x, e.y + 80, e.z);
}

// ============================================================
//  Phase 3 dying 色オーバーレイ（毎フレーム最後に適用）
//   - hitFlash/burstFlash 等が設定した「現在の色」を起点に黒へ lerp
//   - fade 進行とともに t が 0→1。t=1 で完全黒
//   - 共有 material（accentMat 等）は同じ mat を 2 回 lerp しないようユニーク化
// ============================================================
function _applyDyingColorOverride(e) {
  if (!e.mesh || !e.mesh.userData || !e.mesh.userData.parts) return;
  // ゴア・クリティカル armed 中は黒 lerp をスキップして赤オーバーライドに委譲
  if (e.goreCritical && e.goreCritical.armed) {
    _applyGoreCriticalColorOverride(e);
    return;
  }
  // セーフガード（BLACK-WALKER 対策 2026-05-19）：dying でも armed でもない敵は本関数で
  // 色を触らない。何らかの呼び出し経路で誤って live 敵に到達した場合の保険。
  if (!e.dying) return;
  if (!_BLACK) return;
  const total = GORE_CONFIG.FADE_DURATION;
  const t = Math.min(1, Math.max(0, 1 - Math.max(0, e.dyingFadeTimer) / total));
  if (t <= 0) return;
  const parts = e.mesh.userData.parts;
  const seenMats = new Set();
  for (const m of Object.values(parts)) {
    if (!m || m.parent !== e.mesh || !m.material || !m.material.color) continue;
    if (seenMats.has(m.material)) continue;
    seenMats.add(m.material);
    m.material.color.lerp(_BLACK, t);
  }
  // subParts（nose 等・head の子）も同様に lerp（fade 中も nose の黄色が黒へ）
  const subParts = e.mesh.userData.subParts;
  if (subParts) {
    for (const m of Object.values(subParts)) {
      if (!m || !m.material || !m.material.color) continue;
      if (seenMats.has(m.material)) continue;
      seenMats.add(m.material);
      m.material.color.lerp(_BLACK, t);
    }
  }
}

// ============================================================
//  Phase 3 爆発直前の白フラッシュ（2026-05-20 ユーザー指示）
//   - final / burst フェーズの dyingFinalTimer が PREEXPLODE_FLASH_FRAMES 以下のとき発火
//   - 残存 attached パーツ + subParts の material.color を白（1,1,1）に上書き
//   - _applyDyingColorOverride の後に呼ばれるので、黒 lerp 結果を白で上書きする形
//   - 直後に _triggerFinalExplosion で本体 mesh 除去 + 爆発 → 視覚的に「光って → 爆発」
// ============================================================
function _applyPreExplodeFlash(e) {
  if (!e.mesh || !e.mesh.userData) return;
  const parts = e.mesh.userData.parts || {};
  const subParts = e.mesh.userData.subParts || {};
  const seenMats = new Set();
  // parts: 本体 mesh の直接子（detach 済 = scene 直下 / flyingParts はスキップ）
  for (const m of Object.values(parts)) {
    if (!m || !m.material || !m.material.color) continue;
    if (m.parent !== e.mesh) continue;     // 既に detach されたパーツは flash 対象外（白固定の事故防止）
    if (seenMats.has(m.material)) continue;
    seenMats.add(m.material);
    m.material.color.setRGB(1, 1, 1);
  }
  // subParts（例：nose）：親（head 等）が本体に attach されている時のみ flash
  for (const m of Object.values(subParts)) {
    if (!m || !m.material || !m.material.color) continue;
    if (!m.parent || m.parent.parent !== e.mesh) continue;  // 親パーツが detach 済なら flash 対象外
    if (seenMats.has(m.material)) continue;
    seenMats.add(m.material);
    m.material.color.setRGB(1, 1, 1);
  }
}

// ============================================================
//  ゴア・クリティカル：シーケンス進行（基本構造）
//   crit_freeze → crit_red（赤 lerp 完了後 RED_HOLD_FRAMES 維持）→ crit_white → crit_explode
//   crit_explode に達した時点で _triggerFinalExplosion を呼ぶ
// ============================================================
function _advanceGoreCritical(e) {
  const gc = e.goreCritical;
  if (!gc) return;
  // crit_explode：即爆発（split_back_blast 等で hitstop 明けに即発火）
  if (gc.phase === 'crit_explode') {
    _triggerFinalExplosion(e);
    return;
  }
  // crit_fly：wall_blast variant の壁まで飛行中。phase 遷移は壁ヒット検出側（updateEnemies）で行う
  //   ここではタイマー進行のみ（redLerp で赤完了まで進める）
  if (gc.phase === 'crit_fly') {
    if (gc.redLerpRemaining === undefined) {
      gc.redLerpRemaining = GORE_CRITICAL_CONFIG.RED_LERP_FRAMES;
    }
    if (gc.redLerpRemaining > 0) gc.redLerpRemaining--;
    return;
  }
  // crit_slam_stick：gc_05 の遅延爆発フェーズ。上半身パーツは放射飛行 + 下半身は地面突き刺し（静止）。
  //   赤発光 lerp を進め、SLAM_DELAY 経過で crit_white → crit_explode。
  if (gc.phase === 'crit_slam_stick') {
    if (gc.redLerpRemaining > 0) gc.redLerpRemaining--;
    if (gc.timer > 0) gc.timer--;
    if (gc.timer <= 0) {
      gc.phase = 'crit_white';
      gc.timer = GORE_CRITICAL_CONFIG.PREEXPLODE_WHITE_FRAMES;
    }
    return;
  }
  // crit_head_fly：gc_04 の遅延爆発フェーズ。上半身バンドルは flyingParts として独立飛行中、下半身は地面静止。
  //   赤発光 lerp を進めつつ、HEAD_LAUNCH_DELAY 経過で crit_white → crit_explode へ。
  if (gc.phase === 'crit_head_fly') {
    if (gc.redLerpRemaining > 0) gc.redLerpRemaining--;
    // カメラ持ち上げ要求：fxState 経由で camera にリフト量を渡す（毎フレーム更新が必要）
    fxState.camYLift = Math.max(fxState.camYLift, GORE_CRITICAL_CONFIG.HEAD_LAUNCH_CAM_LIFT);
    if (gc.timer > 0) gc.timer--;
    if (gc.timer <= 0) {
      gc.phase = 'crit_white';
      gc.timer = GORE_CRITICAL_CONFIG.PREEXPLODE_WHITE_FRAMES;
    }
    return;
  }
  // crit_wall_stick / crit_ground_stick：張り付き中。downTimer 進行は state machine 側で行うのでここは no-op
  if (gc.phase === 'crit_wall_stick' || gc.phase === 'crit_ground_stick') {
    return;
  }
  // crit_freeze 中は state machine 凍結（updateEnemies 側で continue）。velocity は維持
  if (gc.phase === 'crit_freeze') {
    if (gc.timer > 0) gc.timer--;
    if (gc.timer <= 0) {
      gc.phase = 'crit_red';
      gc.timer = GORE_CRITICAL_CONFIG.RED_LERP_FRAMES + GORE_CRITICAL_CONFIG.RED_HOLD_FRAMES;
      gc.redLerpRemaining = GORE_CRITICAL_CONFIG.RED_LERP_FRAMES;
    }
  } else if (gc.phase === 'crit_red') {
    if (gc.timer > 0) gc.timer--;
    if (gc.redLerpRemaining > 0) gc.redLerpRemaining--;
    if (gc.timer <= 0) {
      gc.phase = 'crit_white';
      gc.timer = GORE_CRITICAL_CONFIG.PREEXPLODE_WHITE_FRAMES;
    }
  } else if (gc.phase === 'crit_white') {
    if (gc.timer > 0) gc.timer--;
    if (gc.timer <= 0) {
      gc.phase = 'crit_explode';
      _triggerFinalExplosion(e);
    }
  }
  // crit_explode は _triggerFinalExplosion で dyingPhase='exploded' に遷移済
}

// ============================================================
//  ゴア・クリティカル：赤発光オーバーライド
//   crit_red 開始～crit_white 直前まで毎フレーム呼ばれ、全 attached part の color を赤に lerp
//   crit_white 時は _applyPreExplodeFlash が上書き（白）
// ============================================================
function _applyGoreCriticalColorOverride(e) {
  if (!e.mesh || !e.mesh.userData || !e.mesh.userData.parts) return;
  if (!_RED) return;
  const gc = e.goreCritical;
  if (!gc) return;
  // 赤発光フェーズ：crit_red（toward_player / split_back_blast）／ crit_fly・crit_wall_stick・crit_ground_stick（wall_blast）／ crit_head_fly（gc_04）／ crit_slam_stick（gc_05）
  if (gc.phase !== 'crit_red'
      && gc.phase !== 'crit_fly'
      && gc.phase !== 'crit_wall_stick'
      && gc.phase !== 'crit_ground_stick'
      && gc.phase !== 'crit_head_fly'
      && gc.phase !== 'crit_slam_stick') return;
  // 赤完了までは線形 lerp で迫り、その後は強制 setRGB で維持
  const lerpLeft = gc.redLerpRemaining ?? 0;
  const total = GORE_CRITICAL_CONFIG.RED_LERP_FRAMES;
  const t = total > 0 ? Math.min(1, Math.max(0, 1 - lerpLeft / total)) : 1;
  const parts = e.mesh.userData.parts;
  const seenMats = new Set();
  const applyRed = (mat) => {
    if (!mat || !mat.color) return;
    if (seenMats.has(mat)) return;
    seenMats.add(mat);
    if (t >= 1) mat.color.copy(_RED);
    else        mat.color.lerp(_RED, t);
    // emissive を赤に固定：MeshToonMaterial 等の lit shading でも完全に真っ赤に光らせる
    // （color だけだと頂点ライティングで暗部が残るため。emissive はライティング非依存の追加色）
    if (mat.emissive) {
      if (t >= 1) mat.emissive.copy(_RED);
      else        mat.emissive.lerp(_RED, t);
    }
  };
  for (const m of Object.values(parts)) {
    if (!m || m.parent !== e.mesh) continue;
    applyRed(m.material);
  }
  const subParts = e.mesh.userData.subParts;
  if (subParts) {
    for (const m of Object.values(subParts)) {
      if (!m) continue;
      applyRed(m.material);
    }
  }
}

// ============================================================
//  ゴア・クリティカル：プレイヤー方向爆散（METEO 第一弾 'toward_player' バリアント）
//   - attached parts を全部 _detachOneNamed で独立化し、flyingParts に注入
//   - 各 part の vx をプレイヤー方向に上書き（base ± jitter）
//   - 直後に共用 spawnDeathExplosion ＋ 指向性パーティクル
// ============================================================
function _explodeTowardPlayer(e) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts) return;
  const cfg = GORE_CRITICAL_CONFIG;
  // 方向決定：goreCritical._explodeDir が指定されていればそれを優先（ground_stick の慣性方向ばらまき）
  //   未指定なら通常通りプレイヤー方向を計算（wall_stick のプレイヤー方向ばらまき）
  const p0 = _players && _players[0];
  const dirX = (e.goreCritical && e.goreCritical._explodeDir)
    ? e.goreCritical._explodeDir
    : (p0 ? Math.sign(p0.x - e.x) || 1 : 1);
  // 残存パーツを全部独立化（body は bundle 化）。一旦既存ヘルパーで detach し、
  // その後 flyingParts の末尾を取って velocity を toward-player に上書きする方式
  const attachedNames = Object.keys(parts).filter(name =>
    parts[name] && parts[name].parent === e.mesh);
  for (const name of attachedNames) {
    let detachedName = null;
    if (name === 'body') {
      // bundle (body + head + nose) 化。注：内部で _triggerFinalExplosion を呼んでしまうため使えない
      // 代わりに同等の reparent 処理を inline で行う
      detachedName = _detachBodyBundleNoExplode(e, dirX);
    } else {
      detachedName = _detachOneNamed(e, name, null);
    }
    if (!detachedName || !e.flyingParts || e.flyingParts.length === 0) continue;
    const last = e.flyingParts[e.flyingParts.length - 1];
    const jitter = (Math.random() - 0.5) * 2 * cfg.TOWARD_PLAYER_JITTER;
    last.vx = dirX * (cfg.TOWARD_PLAYER_VX + jitter);
    last.vy = cfg.TOWARD_PLAYER_VY + (Math.random() - 0.5) * 4;
    last.vz = (Math.random() - 0.5) * 4;
    // クリ爆散パーツ専用の重力倍率と空気抵抗（_updateFlyingParts で参照）。
    // 重力倍率 1.0 = 通常 PART_GRAVITY のまま。空気抵抗 0.97 で水平速度を緩やか減衰
    last._critGravMult = cfg.TOWARD_PLAYER_GRAV_MULT;
    last._critAirDecay = cfg.TOWARD_PLAYER_AIR_DECAY;
  }
  // 共用爆発 ＋ プレイヤー方向の指向性パーティクル
  spawnDeathExplosion(e.x, e.y + 80, e.z);
  spawnHitParticles(e.x, e.y + 60, e.z, cfg.EXTRA_PARTICLE_COLOR, cfg.EXTRA_PARTICLE_COUNT,
    { type: 'normal', dirX, dirZ: 0, speedMul: 1.4 });
}

// 内部ヘルパ：胴体バンドルを「爆散を伴わずに」分離（_detachBodyBundle の no-explode 版）
function _detachBodyBundleNoExplode(e, hitFacing) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts || !parts.body || parts.body.parent !== e.mesh) return null;
  const body = parts.body;
  const head = (parts.head && parts.head.parent === e.mesh) ? parts.head : null;
  const nose = e.mesh.userData.subParts && e.mesh.userData.subParts.nose;
  const bundleMaterials = [];
  if (_THREE_REF) {
    body.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
    bundleMaterials.push(body.material);
    if (head) {
      head.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(head.material);
    }
    if (nose && nose.material) {
      nose.material = new _THREE_REF.MeshBasicMaterial({ color: 0x000000 });
      bundleMaterials.push(nose.material);
    }
  }
  if (head) body.attach(head);
  const worldPos = new _THREE_REF.Vector3();
  body.getWorldPosition(worldPos);
  _scene.attach(body);
  const sign = (hitFacing !== undefined) ? Math.sign(hitFacing) : (Math.random() < 0.5 ? -1 : 1);
  if (!e.flyingParts) e.flyingParts = [];
  e.flyingParts.push({
    mesh: body, name: 'body+upper',
    x: worldPos.x, y: worldPos.y, z: worldPos.z,
    vx: sign * 4, vy: 8, vz: 0,    // 後で _explodeTowardPlayer 側で上書きされる
    bounced: false, fadeTimer: 0,
    angVx: (Math.random() - 0.5) * 0.3,
    angVy: (Math.random() - 0.5) * 0.3,
    angVz: (Math.random() - 0.5) * 0.3,
    _materials: bundleMaterials,
  });
  return 'body+upper';
}

// ============================================================
//  ゴア・クリティカル：c01_gc_03 split_back_blast バリアント
//   後方吹き飛ばし（lv03）→ 爆発と同時に：
//   - 胴体バンドル（body+head+nose）：後方に飛びつつ X 軸正方向の「きりもみ」回転
//   - 下半身（stand）：後方に少し緩めで X 軸負方向の「きりもみ」回転（逆回転）
//   - 共用 spawnDeathExplosion で爆炎パーティクル
//   方向：e.fallDir（プレイヤーから離れる方向）。地上/空中問わず動作。
// ============================================================
function _explodeSplitBackBlast(e) {
  const parts = e.mesh && e.mesh.userData && e.mesh.userData.parts;
  if (!parts) return;
  // 後方向：プレイヤーから離れる方向。fallDir 未設定なら lastHitter.facing をフォールバック
  let dir = e.fallDir;
  if (dir !== 1 && dir !== -1) dir = e.lastHitter?.facing || 1;

  // 胴体バンドル（body + head + nose）：後方やや強め + 正回転きりもみ
  if (parts.body && parts.body.parent === e.mesh) {
    const bundleName = _detachBodyBundleNoExplode(e, dir);
    if (bundleName && e.flyingParts && e.flyingParts.length > 0) {
      const last = e.flyingParts[e.flyingParts.length - 1];
      last.vx = dir * 24;
      last.vy = 14 + (Math.random() - 0.5) * 3;
      last.vz = (Math.random() - 0.5) * 4;
      last.angVx = 0.45;            // 正回転（前方転倒方向のきりもみ）
      last.angVy = 0.15 * dir;
      last.angVz = 0;
    }
  }

  // 下半身（stand）：後方やや遅め + 逆回転きりもみ
  if (parts.stand && parts.stand.parent === e.mesh) {
    const standName = _detachOneNamed(e, 'stand', null);
    if (standName && e.flyingParts && e.flyingParts.length > 0) {
      const last = e.flyingParts[e.flyingParts.length - 1];
      last.vx = dir * 18;
      last.vy = 10 + (Math.random() - 0.5) * 3;
      last.vz = (Math.random() - 0.5) * 4;
      last.angVx = -0.45;           // 逆回転
      last.angVy = -0.15 * dir;
      last.angVz = 0;
    }
  }

  // 共用爆発（黄/橙/赤の多層パーティクル + shake + hitstop）
  spawnDeathExplosion(e.x, e.y + 80, e.z);
}

// ============================================================
//  ボス腕アニメーション（フェーズ別に lArmPivot / rArmPivot を LERP 制御）
//  bossAnim フィールド（config.js の ENEMY_ATTACKS 各エントリ）を参照し、
//  wind/active/recover それぞれの目標 rotation.x/z に向けてスムーズに補間する。
// ============================================================
function _updateBossAnim(e) {
  if (e.dying) return;  // dying 演出中は腕を rest(0) に戻さない
  if (e.bossFatal) return;  // フェイタル中もアニメ凍結（パーツ脱落 + シルエットを汚さない）
  const parts = e.mesh?.userData?.parts;
  if (!parts?.lArmPivot || !parts?.rArmPivot) return;
  const lp = parts.lArmPivot;
  const rp = parts.rArmPivot;

  // 攻撃フェーズに応じたターゲット決定
  let lTx = 0, lTz = 0, rTx = 0, rTz = 0;
  if (e.state === STATE.enemy_attacking && e.curAtkId) {
    const atk = ENEMY_ATTACKS[e.curAtkId];
    // boss1_atk_07 OVERDRIVE：スロット別 bossAnim を優先（_odSlotIdx / _odSlotPhase 駆動）
    //   各 comboSlot に bossAnim を定義しておけば、wind→active の腕モーションを個別指定可能。
    //   atkPhase（wind/active/recover）はトップレベル状態 — OD はスロット内で wind/active を回す。
    let ph = null;
    if (atk?.kind === 'boss_overdrive' && atk.comboSlots && e._odSlotPhase) {
      const slot = atk.comboSlots[e._odSlotIdx ?? 0];
      ph = slot?.bossAnim?.[e._odSlotPhase] ?? null;
    }
    // フォールバック：通常 attack の bossAnim[atkPhase]
    if (!ph && e.atkPhase) {
      ph = atk?.bossAnim?.[e.atkPhase] ?? null;
    }
    if (ph) {
      lTx = ph.lArm?.x ?? 0;  lTz = ph.lArm?.z ?? 0;
      rTx = ph.rArm?.x ?? 0;  rTz = ph.rArm?.z ?? 0;
    }
  }
  // それ以外（wait01 / hitstun / dying 等）は rest（0）へ戻す

  const LSPD = 0.25;
  lp.rotation.x += (lTx - lp.rotation.x) * LSPD;
  lp.rotation.z += (lTz - lp.rotation.z) * LSPD;
  rp.rotation.x += (rTx - rp.rotation.x) * LSPD;
  rp.rotation.z += (rTz - rp.rotation.z) * LSPD;
}

// ボス攻撃 AOE 二重表示管理
//
// 攻撃ごとに aoeDisplay.shape で形状を切り替える：
//   rect       : ① 背景矩形 + ② カーソルバー（wind 中に先端へ走る）
//   semicircle : ① 半円（弧状）のみ。カーソルバーなし（sweep 感を形で表現）
//
// サイズ：aoeDisplay.w / aoeDisplay.h（固定値）を優先。未定義時は hitboxRange * _AOE_SCALE。
// プロパティ：_bossAoePrevPhase / _bossAoeId / _bossAoeBar
const _AOE_SCALE     = 1.6;  // aoeDisplay 未定義時のフォールバック倍率
const _CURSOR_W_FRAC = 0.12; // rect カーソルバー幅 = 表示幅の 12%

function _aoeCleanAll(e) {
  if (e._bossAoeId  != null) { _removeArea(e._bossAoeId);  e._bossAoeId  = null; }
  if (e._bossAoeBar != null) { _removeArea(e._bossAoeBar); e._bossAoeBar = null; }
  // missiles 用：スポーン済みサークル群を一括除去
  if (e._bossAoeMissileIds?.length) {
    for (const id of e._bossAoeMissileIds) _removeArea(id);
    e._bossAoeMissileIds = [];
  }
}

function _updateBossAoe(e) {
  if (!_removeArea || !_updateAreaPosition) return;

  // dying 強制クリーン（ミサイル飛行中も含めて全消し）
  if (e.dying) { _aoeCleanAll(e); _cleanupMissiles(e); return; }

  const prevPhase    = e._bossAoePrevPhase ?? null;
  const curPhase     = (e.state === STATE.enemy_attacking) ? e.atkPhase : null;
  const phaseChanged = prevPhase !== curPhase;
  const atk          = e.curAtkId ? ENEMY_ATTACKS[e.curAtkId] : null;
  const facing       = e.facing ?? 1;

  // aoeDisplay から表示サイズ・形状を取得（未定義なら hitboxRange から計算）
  const disp   = atk?.aoeDisplay;
  const shape  = disp?.shape ?? 'rect';
  const rx     = disp?.w      ?? (atk?.hitboxRangeX ?? 0) * _AOE_SCALE;
  const ry     = disp?.h      ?? (atk?.hitboxRangeY ?? 0) * _AOE_SCALE;
  const radius = disp?.radius ?? rx;   // semicircle 用半径

  // ── フェーズ変化処理 ──────────────────────────────────────────
  if (phaseChanged) {
    if (curPhase === 'wind' && atk && (rx > 0 || radius > 0)) {
      _aoeCleanAll(e);

      if (shape === 'semicircle') {
        // 半円：cy = radius にすることで下端が y=0（床面）になる（0.5 だと床下に潜る）
        const cy = radius;
        e._bossAoeId = _addSemicircleArea?.({
          x: e.x, y: cy, z: e.z + 2,
          radius, facing,
          color: 0xff6600, opacity: 0.30,
        }) ?? null;
      } else if (shape === 'circle') {
        // 床面リング：フルサイズで即表示（scale アニメなし → ガビガビ回避）
        // thickness を radius の 40% に設定して太く視認性確保
        e._bossAoeId = _addStaticArea?.({
          x: e.x, y: 0, z: e.z,
          radius, color: 0xff6600, opacity: 0.40,
          thickness: radius * 0.40,
        }) ?? null;
      } else if (shape === 'missiles') {
        // ミサイル着弾 AOE：wind 中に 1 発ずつ逐次スポーン
        e._bossAoeMissileIds       = [];
        e._bossAoeMissilePositions = [];   // active 移行時に赤点滅で再スポーンするための位置記録
        const count   = disp?.count ?? 9;
        const wFrames = atk.windFrames ?? 120;
        e._bossAoeMissileSpawnInterval = Math.max(1, Math.floor(wFrames / count));
        e._bossAoeMissileRemaining     = count;
        e._bossAoeMissileTimer         = e._bossAoeMissileSpawnInterval; // 最初の 1 発を即スポーン
      } else if (shape === 'overdrive_track') {
        // boss 位置に固定（warp 廃止に合わせて追尾を停止：その場連続技）
        e._odTargetX    = e.x;
        e._odTargetZ    = e.z;
        e._odBossStartX = e.x;
        e._odBossStartZ = e.z;
        const mRadius = disp?.radius ?? 180;
        e._bossAoeId = _addStaticArea?.({
          x: e.x, y: 0, z: e.z,
          radius: mRadius, color: 0xff8800, opacity: 0.40,
          thickness: mRadius * 0.18,
          blink: true, blinkPeriodFn: () => 10,
        }) ?? null;
      } else if (shape === 'tackle_corridor') {
        // 全画面幅の突進危険ゾーン（wind：橙・遅め点滅）
        const wallL = getActiveWallX('left');
        const wallR = getActiveWallX('right');
        const cw    = wallR - wallL;
        const cx    = (wallR + wallL) / 2;
        const ch    = disp?.h ?? ry;
        e._bossAoeId = _addRectArea?.({
          x: cx, y: ch / 2, z: e.z,
          width: cw, height: ch,
          color: 0xff6600, opacity: 0.22,
          blink: true, blinkPeriodFn: () => 15,
        }) ?? null;
      } else {
        // 矩形：① 背景 + ② カーソルバー
        const bgCx = e.x + facing * (rx / 2);
        const cy   = ry / 2;
        const cw   = Math.max(10, rx * _CURSOR_W_FRAC);
        e._bossAoeId = _addRectArea?.({
          x: bgCx, y: cy, z: e.z,
          width: rx, height: ry,
          color: 0xff6600, opacity: 0.25,
        }) ?? null;
        e._bossAoeBar = _addRectArea?.({
          x: e.x + facing * (cw / 2), y: cy, z: e.z + 1,
          width: cw, height: ry,
          color: 0xffcc00, opacity: 0.85,
        }) ?? null;
      }
    }

    // active 移行：カーソル除去 → 赤点滅に差し替え
    // boss_double_tackle は precharge/rush を tackle active code が手動管理するためスキップ
    if (curPhase === 'active' && atk && (rx > 0 || radius > 0) && atk.kind !== 'boss_double_tackle') {
      _aoeCleanAll(e);

      if (shape === 'semicircle') {
        const cy = radius;
        e._bossAoeId = _addSemicircleArea?.({
          x: e.x, y: cy, z: e.z + 2,
          radius, facing,
          color: 0xff2200, opacity: 0.65,
          blink: true, blinkPeriodFn: () => 4,
        }) ?? null;
      } else if (shape === 'circle') {
        // active：赤点滅。厚みは wind と統一
        e._bossAoeId = _addStaticArea?.({
          x: e.x, y: 0, z: e.z,
          radius, color: 0xff2200, opacity: 0.65,
          thickness: radius * 0.40,
          blink: true, blinkPeriodFn: () => 4,
        }) ?? null;
      } else if (shape === 'overdrive_track') {
        // active 移行：target 位置で赤点滅に差し替え（コンボ開始）
        const mRadius = disp?.radius ?? 180;
        const tx = e._odTargetX ?? e.x;
        const tz = e._odTargetZ ?? e.z;
        _aoeCleanAll(e);
        e._bossAoeId = _addStaticArea?.({
          x: tx, y: 0, z: tz,
          radius: mRadius, color: 0xff2200, opacity: 0.60,
          thickness: mRadius * 0.18,
          blink: true, blinkPeriodFn: () => 4,
        }) ?? null;
      } else if (shape === 'tackle_corridor') {
        // active 移行：全画面幅 rect を赤点滅に差し替え
        const wallL = getActiveWallX('left');
        const wallR = getActiveWallX('right');
        const cw    = wallR - wallL;
        const cx    = (wallR + wallL) / 2;
        const ch    = disp?.h ?? ry;
        _aoeCleanAll(e);
        e._bossAoeId = _addRectArea?.({
          x: cx, y: ch / 2, z: e.z,
          width: cw, height: ch,
          color: 0xff2200, opacity: 0.50,
          blink: true, blinkPeriodFn: () => 4,
        }) ?? null;
      } else if (shape === 'missiles') {
        // active 移行：wind でスポーンした橙サークルを赤点滅サークルに差し替え
        const positions = e._bossAoeMissilePositions ?? [];
        _aoeCleanAll(e);   // 橙サークルを除去（_bossAoeMissileIds がクリアされる）
        const mRadius = disp?.radius ?? 120;
        e._bossAoeMissileIds = [];
        for (const pos of positions) {
          const id = _addStaticArea?.({
            x: pos.x, y: 0, z: pos.z,
            radius: mRadius, color: 0xff2200, opacity: 0.65,
            thickness: mRadius * 0.35,
            blink: true, blinkPeriodFn: () => 4,
          }) ?? null;
          if (id != null) e._bossAoeMissileIds.push(id);
        }
      } else {
        const bgCx = e.x + facing * (rx / 2);
        const cy   = ry / 2;
        e._bossAoeId = _addRectArea?.({
          x: bgCx, y: cy, z: e.z,
          width: rx, height: ry,
          color: 0xff2200, opacity: 0.55,
          blink: true, blinkPeriodFn: () => 4,
        }) ?? null;
      }
    }

    // recover / 終了：全除去（missiles の場合は位置記録もリセット）
    const leaving = (curPhase === 'recover' || curPhase === null)
                 && (prevPhase === 'wind' || prevPhase === 'active');
    if (leaving) { _aoeCleanAll(e); e._bossAoeMissilePositions = null; }

    e._bossAoePrevPhase = curPhase;
  }

  // ── 毎フレーム更新（ボス移動追従）────────────────────────────
  if (!atk) return;

  if (shape === 'overdrive_track') {
    // wind 中：boss 出発点 → target へ線形移動（t = wind 消費率）
    if (curPhase === 'wind' && e._bossAoeId != null) {
      const windF = atk.windFrames ?? 135;
      const t     = Math.max(0, Math.min(1, 1 - e.atkTimer / windF));
      const sx    = e._odBossStartX ?? e.x;
      const sz    = e._odBossStartZ ?? e.z;
      const tx    = e._odTargetX    ?? e.x;
      const tz    = e._odTargetZ    ?? e.z;
      _updateAreaPosition(e._bossAoeId, sx + (tx - sx) * t, undefined, sz + (tz - sz) * t);
    }
    // active 中：target 固定（移動しない）
  } else if (shape === 'tackle_corridor') {
    // wind 中のみ更新（active 中は tackle active code が AOE を直接管理）
    if (e._bossAoeId != null && curPhase !== 'active') {
      const wallL = getActiveWallX('left');
      const wallR = getActiveWallX('right');
      const cx    = (wallR + wallL) / 2;
      const ch    = disp?.h ?? ry;
      // wind 中はボス Z 固定（AOE がボスに付随している絵）
      _updateAreaPosition(e._bossAoeId, cx, ch / 2, e.z);
    }
  } else if (shape === 'missiles') {
    // wind 中：タイマーで 1 発ずつランダム着弾サークルをスポーン
    if (curPhase === 'wind' && (e._bossAoeMissileRemaining ?? 0) > 0) {
      e._bossAoeMissileTimer = (e._bossAoeMissileTimer ?? 0) + 1;
      const interval = e._bossAoeMissileSpawnInterval ?? 13;
      if (e._bossAoeMissileTimer >= interval) {
        e._bossAoeMissileTimer = 0;
        e._bossAoeMissileRemaining--;
        const mRadius = disp?.radius ?? 120;
        // ランダム着弾位置（ボスX中心に左右±500、Z±150 で散らす）
        const sx  = e.x + (Math.random() - 0.5) * 1000;
        const sz  = e.z + (Math.random() - 0.5) * 300;
        (e._bossAoeMissilePositions ??= []).push({ x: sx, z: sz });
        const id = _addStaticArea?.({
          x: sx, y: 0, z: sz,
          radius: mRadius, color: 0xff6600, opacity: 0.40,
          thickness: mRadius * 0.35,
          blink: true, blinkPeriodFn: () => 10,
        }) ?? null;
        if (id != null) (e._bossAoeMissileIds ??= []).push(id);
      }
    }
  } else if (shape === 'semicircle') {
    // 半円：cy = radius（下端が床面 y=0）
    const cy = radius;
    if (curPhase === 'wind'   && e._bossAoeId != null)
      _updateAreaPosition(e._bossAoeId, e.x, cy, e.z + 2);
    if (curPhase === 'active' && e._bossAoeId != null)
      _updateAreaPosition(e._bossAoeId, e.x, cy, e.z + 2);
  } else if (shape === 'circle') {
    // 床面リング：ボス中心追従のみ（スケールアニメなし）
    // y は addStaticArea 側が 0.5 に固定するため undefined で渡す（0 だと床面 z-fighting）
    if (e._bossAoeId != null)
      _updateAreaPosition(e._bossAoeId, e.x, undefined, e.z);
  } else {
    if (rx <= 0) return;
    const cy = ry / 2;
    // wind 中：背景はボス追従、カーソルは先端へ走る
    if (curPhase === 'wind') {
      if (e._bossAoeId != null)
        _updateAreaPosition(e._bossAoeId, e.x + facing * (rx / 2), cy, e.z);
      if (e._bossAoeBar != null) {
        const windFrames = atk.windFrames ?? 30;
        const progress   = Math.max(0, Math.min(1, 1 - (e.atkTimer / windFrames)));
        const cw         = Math.max(10, rx * _CURSOR_W_FRAC);
        const curCx      = e.x + facing * (progress * rx);
        _updateAreaPosition(e._bossAoeBar, curCx, cy, e.z + 1);
      }
    }
    if (curPhase === 'active' && e._bossAoeId != null)
      _updateAreaPosition(e._bossAoeId, e.x + facing * (rx / 2), cy, e.z);
  }
}

// ============================================================
//  ボス胴体コリジョン — プレイヤーがボス本体に貫通できないよう毎フレーム押し出す
//  ※ 水平（X 軸）のみ。ジャンプ回避は不可能な高さのため Y チェックは省略。
//  ※ 攻撃判定（hitbox）とは独立した純粋な「壁」処理。
// ============================================================
const _BOSS_COLL_GAP = 8;   // 壁端からの余白（px）

function _updateBossCollision(e) {
  if (!_players?.length || e.dying) return;
  const halfX = BOSS01_CONFIG.BODY_HALF_X;
  const halfZ = BOSS01_CONFIG.BODY_HALF_Z;

  for (const p of _players) {
    const adz = Math.abs(p.z - e.z);
    if (adz > halfZ) continue;           // Z 方向が外れていればスキップ

    const dx  = p.x - e.x;
    const adx = Math.abs(dx);
    if (adx >= halfX + _BOSS_COLL_GAP) continue;   // 当たっていない

    // 近い側へ押し出す（左右どちらが近いかで分岐）
    if (dx >= 0) {
      p.x = e.x + halfX + _BOSS_COLL_GAP;
      if ((p.vx ?? 0) < 0) p.vx = 0;   // 押し込み方向の速度を消す
    } else {
      p.x = e.x - halfX - _BOSS_COLL_GAP;
      if ((p.vx ?? 0) > 0) p.vx = 0;
    }
  }
}

// ============================================================
//  攻撃選択（14-D-2・enem01.md §距離別攻撃選択 + §性格軸 レイヤー1）
//   - 近距離（attackRange 以内）= 基本振り e01_atk_01
//   - 中距離（attackRange 〜 dashTackleRange）= 突進タックル e01_atk_02
//   - 境界の重なり帯（atkSelectOverlap 幅）だけ性格 atk02Weight で抽選
//   - 圏外（dashTackleRange 超）は null（攻撃せず接近継続）
// ============================================================
function _selectEnemyAtk(e, adx) {
  if (e.enemyType === 'enem02') {
    if (adx > DUMMY_ATK_CONFIG.approachRange) return null;
    // 55% の確率でジャンプ急降下（atklv5）、残りは小ジャンプ攻撃
    return (Math.random() < 0.55) ? 'e02_atk_02' : 'e02_atk_01';
  }
  if (e.enemyType === 'midboss01') {
    if (adx > DUMMY_ATK_CONFIG.approachRange) return null;
    if (!e.shieldBroken) {
      // 盾あり: 盾叩きのみ（シールドガード態勢）
      return 'mb01_atk_01';
    }
    // enraged（盾破壊後）: マチェット斬り or マチェットラッシュ（50:50）
    return (Math.random() < 0.5) ? 'mb01_atk_02' : 'mb01_atk_03';
  }
  if (e.enemyType === 'boss01') {
    // フェーズ移行演出中は攻撃不可（仕切り直し）
    if (e.bossPhaseTransitioning) return null;
    const phase = e.bossPhase ?? 1;
    // ── テスト用：Phase 3 で 100% 連続技 (atk_07) ──────────────
    //   far-tackle や対空より最優先で発動。本稼働時は BOSS01_CONFIG.PHASE3_FORCE_OVERDRIVE を false に
    if (phase >= 3 && BOSS01_CONFIG.PHASE3_FORCE_OVERDRIVE) {
      return 'boss1_atk_07';
    }
    // ── 遠距離タックル優先：自機が遠いほど atk_06 を選びやすく（距離詰め技として活用）──
    //   Phase 2 以降で atk_06 解禁後に発動。adx > FAR_TACKLE_RANGE で確率抽選。
    //   通常の接近圏外ゲート(approachRange*1.4)より先に判定するので、
    //   非常に遠い距離からでもタックルで詰めに行ける（dashMaxDist=1800 でアリーナ横断可）。
    if (phase >= 2) {
      const _farRange = BOSS01_CONFIG.FAR_TACKLE_RANGE ?? 500;
      const _farProb  = BOSS01_CONFIG.FAR_TACKLE_PROB  ?? 0.65;
      if (adx > _farRange && Math.random() < _farProb) {
        return 'boss1_atk_06';
      }
    }
    // 接近圏外は攻撃せず歩み寄り（boss01 は AOE 多彩なので拡大圏内まで待つ）
    if (adx > DUMMY_ATK_CONFIG.approachRange * 1.4) return null;
    // ── 対空優先：プレイヤーが一定時間空中にいたら atk01（縦軸叩きつけ）を優先選択 ──
    //   atk01 は hitboxRangeY=360 でジャンプ最高点をカバーしているため対空として機能する。
    //   SP2 連打・空中滞留への自然な抑止。閾値・確率は SB 経由でランタイム調整可。
    const _bossAntiAirThreshold = 50;   // この F 以上空中滞留で対空モード（約0.8秒）
    const _bossAntiAirProb      = 0.85; // 対空モード中の atk01 選択確率（残り15%は通常抽選）
    if ((e._playerAirFrames ?? 0) >= _bossAntiAirThreshold && Math.random() < _bossAntiAirProb) {
      return 'boss1_atk_01';
    }
    // Phase 1：拳のみ 3 種を均等抽選（完全 SA / 弱点なし）
    if (phase === 1) {
      const r = Math.random();
      if (r < 0.34) return 'boss1_atk_01';
      if (r < 0.67) return 'boss1_atk_02';
      return 'boss1_atk_03';
    }
    // Phase 2：拳 4 種 + ミサイル + 大技解禁（D 案再編 2026-05-26）
    //   背中装甲開放と同時にミサイル(atk_05) と 大技(atk_06) が使えるようになる
    //   atk_05/atk_06 は cooldown 長め（連打抑止）
    if (phase === 2) {
      // 2026-05-27 ミサイル選択率 25→18%（連射感抑制）、空いた 7% は他 5 技に均等 ≒ 各 +1.4%
      const r = Math.random();
      if (r < 0.18) return 'boss1_atk_05';   // ミサイル散布 18%
      if (r < 0.34) return 'boss1_atk_06';   // タックル大技 16.4%
      if (r < 0.51) return 'boss1_atk_04';   // 派生 二段フック 16.4%
      if (r < 0.67) return 'boss1_atk_01';   // 16.4%
      if (r < 0.84) return 'boss1_atk_02';   // 16.4%
      return 'boss1_atk_03';                  // 16.4%
    }
    // Phase 3：拳の必殺 atk_07 解禁（D 案再編 2026-05-26）
    //   ゼロ距離タメ突き・RC 対象。Phase 2 ミサイル避け（遠距離）の逆を突く
    const r = Math.random();
    if (r < 0.25) return 'boss1_atk_07';   // OVERDRIVE PUNCH 必殺
    if (r < 0.45) return 'boss1_atk_05';   // ミサイル
    if (r < 0.60) return 'boss1_atk_06';   // タックル大技
    if (r < 0.70) return 'boss1_atk_04';   // 派生
    if (r < 0.80) return 'boss1_atk_01';
    if (r < 0.90) return 'boss1_atk_02';
    return 'boss1_atk_03';
  }
  // enem01
  const C = DUMMY_ATK_CONFIG;
  const swingOnly = C.attackRange - C.atkSelectOverlap;  // ここ以下は基本振り確定
  if (adx <= swingOnly)        return 'e01_atk_01';
  if (adx >  C.attackRange)    return (adx >= C.minTackleRange && adx <= C.dashTackleRange) ? 'e01_atk_02' : null;
  // 重なり帯：性格 weight で抽選（minTackleRange 未満なら基本振り固定）
  return (adx >= C.minTackleRange && Math.random() < e.atk02Weight) ? 'e01_atk_02' : 'e01_atk_01';
}

// ============================================================
//  jump_dive AOE マーカー（照準フェーズの予兆表示）
//  一次 AOE：プレイヤー足元に固定赤リング（着弾地点）
//  二次リング：大→小に収束するリング（収束完了で急降下開始）
// ============================================================
function _spawnJdMarkers(e, atk, targetX, targetZ) {
  const Y = 0.5;
  const r1 = atk.aoeRadius ?? 120;
  // 一次 AOE：着弾地点を示す固定サイズの赤リング（ガイド）
  const aoeMesh = new _THREE.Mesh(
    new _THREE.RingGeometry(r1 * 0.80, r1, 40),
    new _THREE.MeshBasicMaterial({
      color: 0xff2200, transparent: true, opacity: 0.65,
      side: _THREE.DoubleSide, depthTest: false,
    }),
  );
  aoeMesh.rotation.x = -Math.PI / 2;
  aoeMesh.position.set(targetX, Y, targetZ);
  _scene.add(aoeMesh);
  // 二次リング：内側（小）から外側へ拡大し一次 AOE に重なった瞬間に急降下
  //   同じ r1 サイズで作成し scale 0.1 スタート → 1.0 まで拡大
  const ringMesh = new _THREE.Mesh(
    new _THREE.RingGeometry(r1 * 0.78, r1, 40),
    new _THREE.MeshBasicMaterial({
      color: 0xff6600, transparent: true, opacity: 0.30,
      side: _THREE.DoubleSide, depthTest: false,
    }),
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.set(targetX, Y + 0.3, targetZ);
  ringMesh.scale.setScalar(0.1);  // 内側（小）からスタート
  _scene.add(ringMesh);
  e._jdAoeMesh  = aoeMesh;
  e._jdRingMesh = ringMesh;
}

// 照準進行 t（1.0→0.0）に合わせて二次リングを内側から外側へ拡大
function _updateJdRing(e, atk, t) {
  if (!e._jdRingMesh) return;
  // t: 1.0（照準開始）→ 0.0（急降下）
  // scale: 0.1（中心の小さなリング）→ 1.0（一次 AOE と重なる）
  const s = 0.1 + (1.0 - t) * 0.9;
  e._jdRingMesh.scale.setScalar(s);
  // 外縁に近づくほど不透明に強調（攻撃直前が最も目立つ）
  e._jdRingMesh.material.opacity = 0.20 + (1.0 - t) * 0.75;
}

// AOE マーカーを scene から除去（攻撃終了・中断・死亡）
function _removeJdMarkers(e) {
  if (e._jdAoeMesh)  { _scene.remove(e._jdAoeMesh);  e._jdAoeMesh  = null; }
  if (e._jdRingMesh) { _scene.remove(e._jdRingMesh); e._jdRingMesh = null; }
}

// 攻撃 wind/active 中の発光（t=0:基本色 / t=1:targetColor フル）
// 各パーツの baseColors から linear 補間。リセット時は t=0 で呼ぶ。
// targetColor 省略時は黄色（後方互換：jump_dive 溜め用）。タックルは 0xff2222 を指定。
function _setMeshChargeColor(e, t, targetColor = 0xffff00) {
  if (!e.mesh) return;
  const _bc = e.mesh.userData.baseColors ?? { body: 0x2d4a22, head: 0x77aa55 };
  const parts = e.mesh.userData.parts;
  // legs が配列の場合に Set で高速 lookup
  const _legSet = (parts?.legs && Array.isArray(parts.legs))
    ? new Set(parts.legs) : null;
  const tR = ((targetColor >> 16) & 0xff) / 255;
  const tG = ((targetColor >>  8) & 0xff) / 255;
  const tB = ( targetColor        & 0xff) / 255;
  e.mesh.traverse((child) => {
    if (!child.isMesh) return;
    const isHead = parts && child === parts.head;
    const isLeg  = _legSet && _legSet.has(child);
    const base   = isHead ? _bc.head : isLeg ? (_bc.legs ?? _bc.body) : _bc.body;
    const bR = ((base >> 16) & 0xff) / 255;
    const bG = ((base >>  8) & 0xff) / 255;
    const bB = ( base        & 0xff) / 255;
    child.material.color.setRGB(
      bR + t * (tR - bR),
      bG + t * (tG - bG),
      bB + t * (tB - bB),
    );
  });
}

// ============================================================
//  ミサイルバラージ（boss1_atk_05）専用ヘルパー
//  - 各ミサイルは waiting → warning → done の3段階
//  - waiting: 出番待ち、見た目なし
//  - warning: AOE 警告表示 + 落下メッシュ可視（着弾点へ降下）
//  - done   : 着弾済み（damage 判定 + 爆発演出済み）
// ============================================================
function _buildMissileVisual(x, z, startY) {
  if (!_THREE || !_scene) return null;
  // 弾頭：赤色の小型ロケット（円錐 + 円柱）
  const grp = new _THREE.Group();
  const head = new _THREE.Mesh(
    new _THREE.ConeGeometry(10, 24, 8),
    new _THREE.MeshBasicMaterial({ color: 0xff5522 }),
  );
  head.position.y = 30;
  head.rotation.x = Math.PI;  // 先端を下に
  grp.add(head);
  const body = new _THREE.Mesh(
    new _THREE.CylinderGeometry(10, 10, 36, 8),
    new _THREE.MeshBasicMaterial({ color: 0xcccccc }),
  );
  grp.add(body);
  grp.position.set(x, startY, z);
  _scene.add(grp);
  return grp;
}

function _disposeMissileVisual(mesh) {
  if (!mesh || !_scene) return;
  _scene.remove(mesh);
  mesh.traverse(child => {
    if (child.isMesh) {
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  });
}

// ミサイル個別の radial 判定 → damagePlayer 直接呼び出し
function _tryMissileHit(missile, radius, attack) {
  const p = _players?.[0];
  if (!p || !p.mesh) return false;
  if (p.state === STATE.dying || p.state === STATE.dead) return false;
  if (p.invincible || p.invincibleFrames > 0) return false;
  if (p.y > 220) return false;  // 高くジャンプ中のプレイヤーは missile を回避（地上着弾）
  const dx = p.x - missile.x;
  const dz = p.z - missile.z;
  if (Math.hypot(dx, dz) > radius) return false;
  const facing = (p.x >= missile.x) ? 1 : -1;
  return damagePlayer(p, attack, { x: missile.x, y: 0, z: missile.z, facing });
}

// ミサイル一括クリーンアップ（recover 遷移 / dying / 強制中断時）
function _cleanupMissiles(e) {
  if (!e._missiles) return;
  for (const m of e._missiles) {
    if (m.aoeId != null) { _removeArea?.(m.aoeId); m.aoeId = null; }
    if (m.mesh) { _disposeMissileVisual(m.mesh); m.mesh = null; }
  }
  e._missiles = null;
}

// カテゴリトークン全解放：該当敵 e が保持しているトークンを全カテゴリから外す
function _clearAllTokens(ctx, e) {
  if (!ctx || !ctx.attackTokens) return;
  for (const tok of Object.values(ctx.attackTokens)) {
    if (tok.get() === e) tok.set(null);
  }
}

// 外部モジュール（hazards 等）からトークン解放するためのエクスポート版。
//   floor-hole などが「敵を removed 扱いにする」前に呼ぶ。呼ばないと
//   debug-invariants が「token が dead enemy を参照」を毎 F 警告し続ける。
export function releaseEnemyTokens(ctx, e) {
  _clearAllTokens(ctx, e);
}

// 攻撃開始：トークン取得 + enemy_attacking への遷移をまとめる
// （通常の chase 発動と cunning の punish-dodge 連携で共用）
function _beginEnemyAttack(e, atkId, ctx) {
  const atk = ENEMY_ATTACKS[atkId];
  e.curAtkCategory = atk.attackCategory ?? 'melee';
  const _tok = ctx.attackTokens[e.curAtkCategory];
  if (_tok) _tok.set(e);
  e.state          = STATE.enemy_attacking;
  e.atkPhase       = 'wind';
  e.curAtkId       = atkId;
  e.atkTimer       = atk.windFrames;
  e.atkPitchTarget = atk.pitchWind;
  e.atkDashDist    = 0;
  e.atkSlotIdx     = 0;       // slash_rush 複数ヒットインデックスをリセット
  e._tackleHitDone  = false;   // 現パスでのヒット済みフラグ（boss_double_tackle）
  e._tackleState    = null;    // 'precharge1'|'rush1'|'precharge2'|'rush2'
  e._tacklePreTimer = 0;       // precharge 残フレーム
  e._tackleTargetZ  = null;    // precharge 開始時に確定する突進レーン Z（追従せず固定＝Z 回避可）
  e._odInitDone    = false;   // boss_overdrive アクティブ初期化済みフラグ
  e._odSlotIdx     = 0;       // 現コンボスロットインデックス
  e._odSlotPhase   = null;    // 'wind' | 'active'
  e._odSlotTimer   = 0;       // 現スロットの残フレーム
  e._odSlotAxis    = null;    // RC 軸（hud / hit-engine で参照）
  e._odComboRcLockedOut = false; // 連続 RC ロックアウト：途中で 1 スロット失敗したら以降は RC 不可
  e._odPerfectRcCount = 0;       // 連続技中の Perfect RC（軸一致）成立回数。フィニッシュ damage 倍率に影響
  e._comboRcFinishHitPending = false; // 連続 RC フィニッシュ後の最初の player ヒット待ちフラグ
  e._comboRcFinishLockAttackId = null; // 単発化ロック：このフィニッシュ SP（player attackId）からの後続ヒットを抑止
  e._odTargetX     = null;    // 追尾サークルのターゲット X
  e._odTargetZ     = null;    // 追尾サークルのターゲット Z
  e._odBossStartX  = null;    // wind 開始時の boss X（サークル出発点）
  e._odBossStartZ  = null;
  e.saHp           = (e.superArmor > 0) ? e.superArmor : 0;   // SA を攻撃ごとにリセット
  e.hitDelivered   = false;
  e.aiPhase        = 'attack';
  e._jdPhase       = null;   // jump_dive サブフェーズをリセット（残存マーカー消去）
  _removeJdMarkers(e);
}

// cunning の密集回避（14-D-3）：laneReRollTimer 満了ごとに、近接する同レーンの
// cunning がいれば laneZ を振り直す → cunning 同士が同じ Z レーンに固まらず散開する。
function _updateLaneZ(e) {
  if (e.personality !== 'cunning') return;
  if (--e.laneReRollTimer > 0) return;
  e.laneReRollTimer = LANE_REROLL_FRAMES;
  for (const o of _enemies) {
    if (o === e || !o.isAlive || o.personality !== 'cunning') continue;
    if (Math.abs(o.laneZ - e.laneZ) < LANE_CLUSTER_Z &&
        Math.hypot(o.x - e.x, o.z - e.z) < LANE_CLUSTER_DIST) {
      e.laneZ = (Math.random() * 2 - 1) * LANE_Z_MAX;
      break;
    }
  }
}

// ============================================================
//  毎フレーム更新：state machine の遷移はここに集約（down_* / knockback* / bound 等）
//
//  ctx = { enemies, attackTokens: { melee, aerial, ... }, getFrame }
//   - attackTokens: カテゴリ別攻撃トークン（melee/aerial 等）
//   - tryThrownChainHit へ ctx をそのまま渡す
// ============================================================
export function updateEnemies(ctx) {
  if (_attackRelay > 0) _attackRelay--;             // 敵同士の攻撃テンポ待ち（14-D-5）
  if (_globalTackleRelay > 0) _globalTackleRelay--; // タックル専用グローバルCD
  for (const e of _enemies) {
    if (!e.isAlive) continue;
    _updateLaneZ(e);  // cunning の Z レーン振り直し（14-D-3・密集回避）
    // boss01 SA ヒットカウンター減衰（コンボが切れたらカウントリセット）
    if (e.bossFullSA && e.bossSADecayTimer > 0) {
      e.bossSADecayTimer--;
      if (e.bossSADecayTimer <= 0) {
        e.bossSAHitCount  = 0;
        e.bossSADecayTimer = 0;
      }
    }
    // boss01 SA スタンタイマー（ULT / RC 成功でセット → カウントダウンで SA 復帰）
    //   bossSAStunTimer > 0 の間は bossInSA=false（hit-engine 側の判定）
    //   カウントが 0 に戻れば SA が自動復帰する
    if (e.bossFullSA && (e.bossSAStunTimer ?? 0) > 0) {
      e.bossSAStunTimer--;
    }
    // スタンタイマー（atk_06 recover 開始でセット・ボス専用）
    if (e.bossStun) {
      e.bossStunTimer--;
      e._bossStunFrame = (e._bossStunFrame ?? 0) + 1;
      // スタン中の低速 KB tail をクランプ：「ゆっくり動き続ける」絵を防ぐ。
      //   旧 0.1 wu/F cutoff（共通）だと連続 RC フィニッシュ KB（初速 90 + decay 0.93）が
      //   長く尾を引く → スタン中ずっとジワジワ動いて見える。1.5 wu/F で snap stop。
      if (Math.abs(e.knockbackVx) < 1.5) {
        e.knockbackVx = 0;
      }
      if (e.bossStunTimer <= 0) {
        e.bossStun      = false;
        e.bossStunTimer = 0;
        _setMeshChargeColor(e, 0);  // 黒オーバーレイリセット
      } else {
        // 柔らかい黒点滅：sin 波で 0 〜 STUN_PULSE_OPACITY を往復
        const _pSpeed = BOSS01_CONFIG.STUN_PULSE_SPEED   ?? 0.045;
        const _pMax   = BOSS01_CONFIG.STUN_PULSE_OPACITY ?? 0.30;
        const _pFactor = _pMax * (0.5 + 0.5 * Math.sin(e._bossStunFrame * _pSpeed));
        _setMeshChargeColor(e, _pFactor, 0x000000);
      }
    }
    // boss01 フェーズ移行イントロ（triggerBossPhaseTransition で開始・ステージ駆動で自動解除）
    //   移行中は AI 攻撃停止（_selectEnemyAtk で null 返す）+ HP 削れない（hit-engine 側でクランプ＝無敵）
    //   approach（着地待ち）→ pose（暗転＋構え＋発光）→ roar（咆哮＝メガクラ発火）→ recover
    if (e.bossPhaseTransitioning) {
      _stepBossPhaseTransition(e);
    }
    // SCRAP THEM!!! フェイタルフェーズ（§10）— フェーズマシン
    if (e.bossFatal && !e.dying) {
      _updateBossFatal(e);
    }
    // Phase 3：dying タイマー進行（state machine は維持・色フェード/最終フェーズ遷移を回す）
    //   exploded フェーズに入ると mesh が無いので、その時点で本フレームの残処理は skip
    if (e.dying) {
      _updateDyingTimers(e, ctx);
      if (e.dyingPhase === 'exploded') continue;
    }
    // ゴア・クリティカル armed 中の AI/state machine skip：
    //   - split_back_blast / slam_radial_split / head_launch_delayed：state=wait01 のまま armed になると
    //     AI 接近で「赤いまま歩く」事故が起こる → 完全凍結（mesh は parts 抜けて空ガラだが state machine は止める）
    //   - wall_blast_toward_player：壁まで飛ぶ物理を必要とするため skip しない
    if (e.goreCritical && e.goreCritical.armed
        && (e.goreCritical.variant === 'split_back_blast'
            || e.goreCritical.variant === 'slam_radial_split'
            || e.goreCritical.variant === 'head_launch_delayed')) {
      // 位置同期（_setupArmedKinematics で y=0 等にした値を mesh に反映）
      if (e.mesh) {
        e.mesh.position.x = e.x;
        e.mesh.position.y = e.y;
        e.mesh.position.z = e.z;
      }
      // 赤発光オーバーライド：内部で armed を検出して _applyGoreCriticalColorOverride に委譲
      if (e.dyingPhase !== 'exploded') _applyDyingColorOverride(e);
      // 爆発直前の白フラッシュ
      if (e.goreCritical.phase === 'crit_white') _applyPreExplodeFlash(e);
      continue;
    }
    // ULT 発動中の時間停止：最初のヒットを受けるまで凍結（state / vy / downTimer すべて維持）
    if (e.frozenByUlt) continue;
    // グラブ被害中：position・state は処理側（processGrabInput）で固定維持
    if (e.state === STATE.grabbed) { e.aiPhase = 'hitstun'; continue; }
    // Phase 3 AI ステート明示化：state が AI 行動系（wait01 / 移動 / 攻撃）以外なら hitstun ラベル
    // 注：status_stun もここで hitstun ラベルになる（被弾意味の汎用 AI 非介入ラベル）
    if (e.state !== STATE.wait01 && e.state !== STATE.enemy_attacking &&
        e.state !== STATE.walk_fwd && e.state !== STATE.walk_back && e.state !== STATE.dash &&
        e.state !== STATE.enemy_dodge && e.state !== STATE.enemy_guard) {
      e.aiPhase = 'hitstun';
    }
    // wait01 復帰時：必殺技ヒット履歴 + コンボルートをクリア（敵単位の各種ループ制限のリセット）
    if (e.state === STATE.wait01) {
      if (e.specialHitBy && e.specialHitBy.size > 0) e.specialHitBy.clear();
      if (e.comboRoute && e.comboRoute.length > 0) e.comboRoute.length = 0;
      if (e.ultBurstInvincible) e.ultBurstInvincible = false;  // 起き上がり完了で ULT-burst 無敵解除
      // 飛行系状態カウンタ・関連フラグもリセット（2026-05-18）
      if (e.superFlightCount > 0) e.superFlightCount = 0;
      if (e.wallHitCount > 0) e.wallHitCount = 0;
      if (e.launchResistTimer > 0) e.launchResistTimer = 0;  // 着地復帰でリセット
      if (e.lateralCombatInvincible) e.lateralCombatInvincible = false;
      if (e.skipWallCollision) e.skipWallCollision = false;
      if (e.isWallBounce) e.isWallBounce = false;  // 壁バウンス中フラグもクリア
      if (e.accumStagger > 0) e.accumStagger = 0;  // 連続被弾累積リセット（#14-B・コンボ終了）
      // Phase 3：被弾→wait01 復帰検出（aiPhase が hitstun のまま wait01 に来た瞬間）→ retreat 発火
      if (e.aiPhase === 'hitstun') {
        e.aiPhase = 'retreat';
        // brave は retreatMult≈0 で被弾後もすぐ再交戦（前のめり・レイヤー3）
        e.aiRetreatTimer = Math.round(DUMMY_ATK_CONFIG.postHitRetreatFrames * e.retreatMult);
        // 攻撃中に被弾していた場合のトークン解放（保険）
        _clearAllTokens(ctx, e);
        e.atkPhase = null;
        e.hitDelivered = false;
        if (e.atkCooldown < 30) e.atkCooldown = 30;
        // missile_barrage の取り残しもここで掃除（被弾で攻撃中断時）
        _cleanupMissiles(e);
      }
    }
    // === 延焼（burn）tick（OC「点火」未取得なら e.burnTimer=0 で no-op）===
    // frozenByUlt / grabbed / armed-GC は既に上で continue 済み・dying は !e.isAlive まで進まない
    if (e.burnTimer > 0) _updateBurnTick(e, ctx);
    // === OC IGNITE Phase3 遅延起爆タイマー ===
    if (e.detonateTimer > 0) {
      e.detonateTimer--;
      if (e.detonateTimer === 0) detonateBurn(e);
    }
    // 恒常 SA リチャージ（midboss01 盾破壊後）
    if (e.passiveSaRecharge > 0) {
      if (--e.passiveSaRecharge === 0) {
        e.passiveSaHp = MIDBOSS_SHIELD_CONFIG.PASSIVE_SA_HP;
      }
    }
    // ボスゲート安全網（2026-05-29）：DoT / 床炎 / 床マグマ など hit-engine を経由しない
    //   全ダメージ源をここで受ける。通常ヒットは hit-engine 側でクランプ済み（移行中フラグで
    //   ここは skip されるので二重発火しない）。enterBossFatal は hp を 1 に固定するため、
    //   直後の汎用死亡判定（hp<=0）も発火しない。
    if (e.isBoss && !e.bossPhaseTransitioning && !e.bossFatal && !e.dying) {
      const _gates = e.bossPhaseGateHP;
      const _nextGate = _gates ? (_gates[(e.bossPhase ?? 1) - 1] ?? 0) : 0;
      if (_nextGate > 0 && e.hp <= _nextGate) {
        e.hp = _nextGate + 1;                 // 境界 +1 で停止 → 移行発火
        triggerBossPhaseTransition(e, ctx);
      } else if (_nextGate <= 0 && e.hp <= 0) {
        enterBossFatal(e, _players?.[0] ?? null);  // 最終フェーズ：フェイタル委譲（雑魚 death flow 回避）
      }
    }
    // 死亡判定（Phase 3-A/B：instantRespawn フラグで分岐 / 2026-05-20 e.dying へ）
    if (e.hp <= 0) {
      if (e.instantRespawn) {
        // 練習用：即復活で無限ループ（既存挙動・3 体スポーンの互換）
        // ★ステートは上書きしない：ダウン誘発技で hp 0 にした場合も
        //   そのフレームに dispatch された down_front_start 等のステートを残し、
        //   ダウン animation を最後まで見せる。
        //   各 down ステートは自分でタイマー満了して wait01 に戻るので
        //   ダミーは「ダウン演出 → 立ち直り」の自然なサイクルでループ復活する
        e.hp = e.maxHp;
        e.enraged = false;       // HP 全快で興奮解除（#14-C・即復活ダミーが興奮を持ち越さない）
        e.accumStagger = 0;
        spawnHitParticles(e.x, e.y + 100, e.z, 0xff8844, 24);
        triggerShake(8, 14);
      } else if (!e.dying) {
        // 本実装：死亡フロー開始（フラグだけ立てる・state は維持）
        // → 被弾モーション (knockback/down_*) は普通に再生されつつ、並列でフェード/分解進行
        spawnHitParticles(e.x, e.y + 100, e.z, 0xff8844, 24);
        triggerShake(8, 14);
        enterEnemyDying(e, ctx);
      }
    }
    // ノックバック減衰（水平）— 攻撃側で e.kbDecay 上書き可（lv06 c01_atk_l_01_air は 0.92 で直線軌道）
    e.x += e.knockbackVx;
    e.knockbackVx *= (e.kbDecay ?? 0.78);
    if (Math.abs(e.knockbackVx) < 0.1) {
      e.knockbackVx = 0;
      e.kbDecay = 0.78;  // ノックバック終了で減衰率を既定値に戻す
    }
    // === 投擲弾の衝突判定（Final Fight 風・グラブ投げ → 他敵連鎖）===
    // 飛行中（thrownProjectile=true）の敵が他敵に当たると両者吹き飛び
    if (e.thrownProjectile) {
      tryThrownChainHit(e, ctx);
      // 着地で投擲フラグ自動解除
      if (e.y <= 0) {
        e.thrownProjectile = false;
        e.thrownByPlayer   = null;
      }
    }
    // === ピンボール衝突（lv6 super / 空中 sp1_air 等で吹き飛び中の敵が他敵・壊れ物に当たる）===
    // mover の軌道変化（lv6→rakka, sp1_air→super 跳ね返り）+ target の後方吹き飛び
    tryPinballHit(e, ctx);
    // ステージバウンド壁ヒット
    // 超吹き飛ばし中（down_super_start/loop）に壁に到達 → 強制 down_wall_start
    //   ※ skipWallCollision フラグ（同コンボ 2 回目以降の super 飛行）は壁張り付きをスキップして
    //     ステージ端の x クランプも無視 → そのまま地面到達で down_roll_start に流す（2026-05-18）
    //   壁の x は getKnockbackWallX：画面端ベースの封じ込め壁（2026-05-21 改修）。
    //   敵が画面外へ長距離吹き飛ばないよう、進行ステージでも画面端側で止める。
    const wallL = Math.max(PHYSICS.STAGE_LEFT,  getKnockbackWallX('left'));
    const wallR = Math.min(PHYSICS.STAGE_RIGHT, getKnockbackWallX('right'));
    const hitLeft  = e.x < wallL;
    const hitRight = e.x > wallR;
    if ((hitLeft || hitRight) && !e.skipWallCollision) {
      e.x = hitLeft ? wallL : wallR;
      // ゴア・クリティカル（wall_blast variant）armed：wallHitCount を bypass し、
      // 専用の長い張り付き → 爆散シーケンスへ。下記の通常ロジックには進めない。
      if (e.goreCritical && e.goreCritical.armed
          && e.goreCritical.variant === 'wall_blast_toward_player'
          && e.goreCritical.phase === 'crit_fly') {
        e.state       = STATE.down_wall_start;
        e.downTimer   = GORE_CRITICAL_CONFIG.WALL_STICK_FRAMES;
        e.vy          = 0;
        e.knockbackVx = 0;
        e.goreCritical.phase = 'crit_wall_stick';
        e.goreCritical.timer = GORE_CRITICAL_CONFIG.WALL_STICK_FRAMES;
      } else if (e.state === STATE.down_super_start || e.state === STATE.down_super_loop) {
        // 壁突入カウンタ（2026-05-20）：3 回目到達でバーストダウン化（仕様統一）。
        //   旧：2 回目で lateralCombatInvincible（state 温存）。
        //   新：3 回目で burst へ遷移し、wallHit/superFlight の制限挙動を統一。
        e.wallHitCount = (e.wallHitCount ?? 0) + 1;
        if (e.wallHitCount >= 3) {
          // burst 方向：壁から離れる側＝-fallDir（プレイヤー方向）。
          // 通常 burst は「プレイヤーから遠ざかる」だが、壁突入瞬間にそれを使うと壁に戻ってループする。
          triggerBurstState(e, -e.fallDir);
          combo.burstHudFrames = Infinity;
          combo.burstHudRoute  = combo.aggregateRoute.slice();
          combo.burstHudReason = 'wall_limit';
          combo.burstHudSpBaseId = null;
          combo.burstHudLoopLen = 0;
        } else {
          // 通常：壁張り付き → タイマー満了で反作用バウンス（既存ロジック）
          e.state       = STATE.down_wall_start;
          e.downTimer   = ENEMY_WALL_START_FRAMES;
          e.vy          = 0;          // 壁にべたっと張り付き（一旦停止）
          e.knockbackVx = 0;
        }
        // tiltAngle は STATE_TILT_TARGET 経由で自動補間
      } else {
        e.knockbackVx = 0;
      }
    }
    // === 敵同士の分離（重なり回避）===
    //   攻撃中：強く押し合う（攻撃判定の重なりを防ぐ）
    //   wait01：中程度（自然に散らばる）
    //   被弾中：弱く（コンボ密着は許容・完全重なりだけ防ぐ）
    //   ダウン中・grabbed：ゼロ（位置は別ロジック管理）
    {
      let myStrength = 0;
      const s = e.state;
      if (s === STATE.enemy_attacking) myStrength = 2.5;
      // 走行（dash）はダッシュ追跡で速く動くため分離も強め（Z 方向に散らして重なり回避）
      else if (s === STATE.dash) myStrength = 3.0;
      else if (s === STATE.wait01 || s === STATE.walk_fwd || s === STATE.walk_back) myStrength = 1.5;
      // 立ち姿勢の防御・リアクション系（短いが重なると見栄えが悪いので分離する）
      else if (s === STATE.enemy_dodge || s === STATE.enemy_guard ||
               s === STATE.enemy_block_hit || s === STATE.enemy_stagger ||
               s === STATE.enraged_intro) myStrength = 1.5;
      else if (s === STATE.knockback01 || s === STATE.knockback02 ||
               s === STATE.knockback_air01 || s === STATE.knockback03 ||
               s === STATE.down_front_start || s === STATE.down_front_loop ||
               s === STATE.fall_loop || s === STATE.land) {
        myStrength = 0.7;
      }
      if (myStrength > 0 && !e.frozenByUlt) {
        for (let _j = 0; _j < _enemies.length; _j++) {
          const other = _enemies[_j];
          if (other === e || !other.isAlive || other.frozenByUlt) continue;
          if (other.state === STATE.grabbed) continue;
          const dx = e.x - other.x;
          const dz = e.z - other.z;
          const adx = Math.abs(dx);
          const adz = Math.abs(dz);
          // 攻撃中の敵がいたら最小距離を広め・それ以外は最小限（完全密着回避）
          const eitherAttacking = (e.state === STATE.enemy_attacking || other.state === STATE.enemy_attacking);
          const minDx = eitherAttacking ? 110 : 70;
          // Z 方向の最小距離。狭いと同 X で奥行きが被って「重なって」見えるため広めに取る
          // （90 → 敵はプレイヤー前後 ±45 程度に散る・攻撃の rangeZ 80 内に収まり手は届く）
          const minDz = 90;
          if (adx < minDx && adz < minDz) {
            // X 方向に押す。dx≈0 の場合はランダムで左右どちらかに
            const dxSign = (adx < 0.5) ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(dx);
            e.x += myStrength * dxSign;
            // Z 方向にも押す（2.5D 圧縮考慮で X の 0.7 倍）
            const dzSign = (adz < 0.5) ? (Math.random() < 0.5 ? 1 : -1) : Math.sign(dz);
            e.z += myStrength * 0.7 * dzSign;
          }
        }
      }
    }
    e.mesh.position.x = e.x;
    e.mesh.position.z = e.z;
    // 打ち上げ（垂直）
    // down_wall_start は壁張り付きで重力スキップ（vy/yは保持・タイマー満了で wall_loop が落下開始）
    if ((e.vy !== 0 || e.y > 0 || e.peakHangTimer > 0) && e.state !== STATE.down_wall_start) {
      // 頂点到達検出：LAUNCH_COMBO属性で打ち上げ中かつ上昇→下降に切り替わった瞬間
      if (e.launcherAirborne && e.prevVy > 0 && e.vy <= 0 && e.y > 0 && e.peakHangTimer === 0) {
        const hangF = PHYSICS.ENEMY_PEAK_HANG_FRAMES ?? 36;
        e.peakHangTimer = hangF;
        e.peakHangTotal = hangF;
        spawnHitParticles(e.x, e.y + 100, e.z, 0xffffff, 8);
      }
      e.prevVy = e.vy;

      let gravFactor;
      if (PLAYER_JUMP_STATES.has(e.state)) {
        // 敵の自発ジャンプはプレイヤー通常ジャンプと同じ等重力アーク（被弾の浮遊軽減は適用しない）
        gravFactor = 1.0;
      } else if (e.peakHangTimer > 0) {
        // フェードイン：最初の FADE F かけて重力を base→DEPTH へ滑らかに落とす
        // DEPTH を 0.05 → 0.2 に上げて peakHang 中も微速度で降下、終了時の段差を小さくする（2026-05-20）
        const elapsed  = e.peakHangTotal - e.peakHangTimer;
        const fadeF    = PHYSICS.ENEMY_PEAK_HANG_FADE ?? 12;
        const depth    = PHYSICS.ENEMY_PEAK_HANG_DEPTH ?? 0.05;
        const fadeT    = Math.min(1, elapsed / fadeF);
        const baseFactor = (e.vy < 0) ? (PHYSICS.ENEMY_LAUNCHER_GRAV ?? 0.6) : 1.0;
        gravFactor = baseFactor + (depth - baseFactor) * fadeT;
        e.peakHangTimer--;
      } else if (e.y > 0 && e.vy < 0) {
        // 打ち上げ直後は重い減速・壁バウンス後も同等扱い（ENEMY_WALL_BOUNCE_FALL）
        const wallBounceAsLauncher = PHYSICS.ENEMY_WALL_BOUNCE_FALL && e.isWallBounce;
        if (e.launcherAirborne || wallBounceAsLauncher) {
          gravFactor = PHYSICS.ENEMY_LAUNCHER_GRAV ?? 0.6;
        } else {
          gravFactor = PHYSICS.AERIAL_GRAV_FACTOR;
        }
      } else {
        gravFactor = 1.0;
      }
      // メガクラ被弾の knockback_air01 中は重力を半減（コンボ猶予を延ばす）
      if (e.kbFromMega && e.state === STATE.knockback_air01) {
        gravFactor *= 0.5;
      }
      // バースト離脱中は重力軽減で滞空延長（攻撃側で e.burstGravMult が立つ）
      if (e.burstGravMult !== undefined && e.burstGravMult > 0 &&
          (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop)) {
        gravFactor *= e.burstGravMult;
      }
      // ゴア・クリティカル wall_blast の crit_fly 中は重力半減で滞空延長
      //   → 通常 lv6 dispatch と同じ knockback でも「ヘロヘロ落下」に見えない
      //   → 斜め下軌道（SP1_air vy=-10）でも視覚的に長く滞空して見栄え確保
      if (e.goreCritical && e.goreCritical.armed && e.goreCritical.phase === 'crit_fly') {
        gravFactor *= GORE_CRITICAL_CONFIG.CRIT_FLY_GRAV_MULT;
      }
      e.vy -= PHYSICS.GRAVITY * gravFactor;
      e.y  += e.vy;
      if (e.y <= 0) {
        e.y = 0; e.vy = 0; e.prevVy = 0;
        e.peakHangTimer = 0; e.peakHangTotal = 0;
        e.launcherAirborne = false;
        // === ゴア・クリティカル armed crit_fly：壁到達前に地面に激突 → ground stick へ ===
        // 壁まで届かないケース（斜め下叩きつけの空中SP1 等）の救済：
        //   地面で WALL_STICK_FRAMES 張り付き → タイマー満了で爆散・パーツは慣性方向（fallDir）に弾ける
        if (e.goreCritical && e.goreCritical.armed && e.goreCritical.phase === 'crit_fly') {
          const inertiaDir = Math.sign(e.knockbackVx) || e.fallDir || 1;
          e.goreCritical._explodeDir = inertiaDir;  // パーツばらまき方向（慣性継承＝プレイヤーから離れる側）
          e.goreCritical.phase = 'crit_ground_stick';
          e.goreCritical.timer = GORE_CRITICAL_CONFIG.WALL_STICK_FRAMES;
          e.state = STATE.down_bas_loop;
          e.downTimer = GORE_CRITICAL_CONFIG.WALL_STICK_FRAMES;
          e.knockbackVx = 0;
          e.tiltAngle = 0;
          e.pitchAngle = 0;
          // 通常の down_bas_loop オートトランジションを下流で抑制する（down_bas_loop ケースで armed 分岐）
        }
        // === 地面到達時のステート分岐（挙動途中からでも次へ） ===
        // tiltAngle は STATE_TILT_TARGET 経由で自動補間（明示設定なし）
        if (e.state === STATE.down_up_start || e.state === STATE.down_up_loop) {
          // 打ち上げ → 着地で静止フェーズへ
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        } else if (e.state === STATE.knockback_air01) {
          // 空中フリンチ途中で着地 → land に直行
          e.state     = STATE.land;
          e.downTimer = ENEMY_LAND_FRAMES;
          e.kbFromMega = false;  // 着地で重力半減フラグ解除
        } else if (e.state === STATE.fall_loop) {
          // 自由落下 → 着地 land
          e.state     = STATE.land;
          e.downTimer = ENEMY_LAND_FRAMES;
        } else if (e.state === STATE.down_front_start) {
          // 吹き飛び立ち上がり途中で着地 → 静止フェーズへ（down_bas_start）
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        } else if (e.state === STATE.down_front_loop) {
          // 吹き飛び完走着地 → ダウン静止ループへ（bas_start イントロはスキップ）
          e.state     = STATE.down_bas_loop;
          e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
        } else if (e.state === STATE.down_super_start || e.state === STATE.down_super_loop) {
          // 超吹き飛ばし途中で地面に当たった → 強制 down_roll_start
          e.state     = STATE.down_roll_start;
          e.downTimer = ENEMY_ROLL_START_FRAMES;
          e.rollDebugAngle = 0;  // 転がり可視化用：角度リセット（2026-05-18）
          // 慣性引き継ぎ：現在の水平速度の符号で転がり方向を決定（2026-05-18 修正）。
          //   通常の super 飛行：knockbackVx は fallDir 方向 → 転がりも fallDir
          //   壁バウンス後の super 飛行：knockbackVx は -fallDir 方向 → 転がりも -fallDir（壁から離れる方向）
          const rollDir = Math.sign(e.knockbackVx) || e.fallDir;
          e.knockbackVx = rollDir * ENEMY_ROLL_KB_VX;
          e.kbDecay     = ENEMY_ROLL_KB_DECAY;
          e.rollDir     = rollDir;  // 回転方向（rotation.x 反映用）
          // バウンス由来の super 飛行はここで終了 → フラグクリア
          e.isWallBounce = false;
        } else if (e.state === STATE.down_wall_loop) {
          // うつ伏せ落下着地 → down_bas_start（静止フェーズへ）
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        } else if (e.state === STATE.down_rakka_start || e.state === STATE.down_rakka_loop) {
          // 叩きつけ落下着地 → 1回バウンド開始
          e.state     = STATE.down_bound_start;
          e.vy        = KB_LV05_BOUNCE_VY;  // 上向き初速で離地（e.vy=0 を上書き）
          e.downTimer = ENEMY_DOWN_BOUND_FRAMES;  // バウンド効果時間
        } else if (e.state === STATE.down_bound_start) {
          // バウンド再着地 → ダウン静止ループへ
          e.state     = STATE.down_bas_loop;
          e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
        } else if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) {
          // バースト離脱着地 → ダウン静止イントロへ合流
          e.state     = STATE.down_bas_start;
          e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
          e.burstSpinRate = 0;
          e.burstGravMult = 0;
          e.burstRollAngle = 0;
          // 累積した rotation.x/z をクリア（クォータニオン経由で設定していたものを Euler に戻す）
          e.mesh.rotation.x = 0;
          e.mesh.rotation.z = 0;
          e.tiltAngle = 0;
        } else if (e.state === STATE.jump_loop) {
          // 自発ジャンプ着地 → 短い着地モーション（プレイヤー jump_end と同等）
          e.state       = STATE.jump_end;
          e.downTimer   = ENEMY_JUMP_END_FRAMES;
          e.knockbackVx = 0;
        } else if (e.state === STATE.jump_d_loop) {
          e.state       = STATE.jump_d_end;
          e.downTimer   = ENEMY_JUMP_D_END_FRAMES;
          e.knockbackVx = 0;
        } else if (e.state === STATE.jump_start || e.state === STATE.jump_d_start) {
          // 離陸イントロ中に着地（極小ジャンプ）→ 直接 wait01
          e.state       = STATE.wait01;
          e.knockbackVx = 0;
        }
      }
      e.mesh.position.y = e.y;
    }

    // === Phase 3 AI: aiPhase 明示化（idle / chase / attack / retreat / stun）===
    // - e.state（物理・見た目）と e.aiPhase（AI 意思決定）を独立軸で運用
    // - state===wait01 のときに aiPhase で idle / chase / retreat を切り替え
    // - state===enemy_attacking のとき aiPhase='attack'（atkPhase が細部を制御）
    // - 被弾系 state（stun ラベル）は上部の同期で自動設定済
    // ローテーション攻撃：attackTokens のカテゴリ枠を取得した敵だけが attacking に遷移可能。
    // 被弾中追撃禁止：プレイヤーが isHitstunState の間は新規 attacking 遷移しない。
    // === 診断：黒くなった非 dying 敵が歩いてくるバグ調査（2026-05-18）===
    //   1 体ごとに 1 回だけ警告（_darkWarned）。診断情報を拡充：
    //   - material UUID（共有チェック）
    //   - 他敵が同じ material を持ってないか（共有事故）
    //   - 前フレームの material 色を比較（self-mutation vs 共有 mutation の判別）
    if (window.SB && window.SB.DEBUG_GORE_CRITICAL && !e._darkWarned) {
      const _b = e.mesh?.userData?.parts?.body;
      if (_b && _b.parent === e.mesh && _b.material?.color) {
        const c = _b.material.color;
        const lum = c.r + c.g + c.b;
        if (!e.dying && lum < 0.15) {
          // 同じ material を共有してる別敵を探す
          const matUuid = _b.material.uuid;
          const sharedWith = [];
          for (let j = 0; j < _enemies.length; j++) {
            if (_enemies[j] === e) continue;
            const ob = _enemies[j].mesh?.userData?.parts?.body;
            if (ob && ob.material?.uuid === matUuid) {
              sharedWith.push({ idx: j, dying: _enemies[j].dying, hp: _enemies[j].hp });
            }
          }
          console.warn(`[BLACK-WALKER] non-dying enemy body near black`, {
            color: { r: c.r.toFixed(3), g: c.g.toFixed(3), b: c.b.toFixed(3) },
            hp: e.hp, state: e.state, aiEnabled: e.aiEnabled, hpBarShown: e.hpBarShown,
            dying: e.dying, dyingPhase: e.dyingPhase, hitFlashTimer: e.hitFlashTimer,
            burstFlashTimer: e.burstFlashTimer,
            materialUuid: matUuid,
            materialType: _b.material.type,
            sharedWith,
            enemiesCount: _enemies.length,
            _spawnOpts: e._spawnOpts,
          });
          e._darkWarned = true;
        }
      }
    }
    if (ENEMY_AI.enabled && e.aiEnabled && !e.dying && _players[0] &&
        _players[0].state !== STATE.dying && _players[0].state !== STATE.dead) {
      const p0 = _players[0];
      const playerInHitstun = isHitstunState(p0);
      // ボス：プレイヤー滞空フレームを毎 F カウント（対空 AI 用）
      if (e.isBoss) {
        e._playerAirFrames = (p0.y > 20) ? (e._playerAirFrames ?? 0) + 1 : 0;
      }
      if (e.atkCooldown > 0) e.atkCooldown--;
      if (e.state === STATE.wait01 || e.state === STATE.walk_fwd ||
          e.state === STATE.walk_back || e.state === STATE.dash) {
        const _x0 = e.x, _z0 = e.z;  // 移動 state 判定用：AI 移動前の座標を退避（#14-A）
        let _chaseDash = false;      // 遠間合いの走行（state=dash）フラグ（14-D-2）
        const dx = p0.x - e.x;
        const dz = p0.z - e.z;
        const adx = Math.abs(dx);
        const adz = Math.abs(dz);
        // 向きはプレイヤー方向に揃える（retreat 中も含めて常に対面）
        if (dx !== 0) {
          e.facing = dx >= 0 ? 1 : -1;
          e.mesh.rotation.y = e.facing * Math.PI / 2;
        }

        // === 防御リアクション（#14-B）：プレイヤー攻撃の windup を読んで dodge / guard ===
        //   被弾時 RNG ではなく「攻撃を検知して先に防御へ入る」確率（先出し＝読ませる）。
        //   1 プレイヤー攻撃につき 1 回だけ判定（_reactArmed）。
        let _reacted = false;
        // 興奮トリガー（#14-C）：HP が閾値以下で 1 度だけ enraged 化 → enraged_intro モーション。
        //   berserker（midboss01）は HP% では興奮せず、盾破壊（triggerShieldBreak）でのみ enraged 化する。
        if (ENEMY_ENRAGE_CONFIG.ENABLE_HP_ENRAGE && e.personality !== 'berserker' &&
            !e.enraged && e.hp > 0 && e.hp <= e.maxHp * e.enragedHp) {
          e.enraged   = true;
          e.state     = STATE.enraged_intro;
          e.downTimer = ENEMY_ENRAGE_CONFIG.INTRO_FRAMES;
          e.aiPhase   = 'enraged';
          _reacted    = true;  // この frame の chase / 防御リアクションは走らせない
        }
        if (e.reactCooldown > 0) e.reactCooldown--;
        const _pAtk = (p0.state === STATE.attacking && p0.attackId) ? ATTACKS[p0.attackId] : null;
        const _pInWindup = !!_pAtk && (_pAtk.duration - p0.stateTimer) < _pAtk.hitFrame;
        if (!_pInWindup) {
          e._reactArmed = true;  // プレイヤー非 windup で再武装
        } else if (!_reacted && e._reactArmed && e.reactCooldown <= 0 &&
                   adx < ENEMY_REACT_CONFIG.DETECT_RANGE_X &&
                   adz < ENEMY_REACT_CONFIG.DETECT_RANGE_Z) {
          e._reactArmed = false;
          const _r = Math.random();
          if (_r < e.dodgeTendency) {
            // 回避：facing 逆方向へバックステップ + 前半無敵
            e.state         = STATE.enemy_dodge;
            e.downTimer     = ENEMY_DODGE_FRAMES;
            e.dodgeInvuln   = true;
            e.knockbackVx   = -e.facing * ENEMY_REACT_CONFIG.DODGE_VX;
            e.kbDecay       = ENEMY_REACT_CONFIG.DODGE_DECAY;
            e.reactCooldown = ENEMY_REACT_CONFIG.REACT_COOLDOWN;
            e.aiPhase       = 'dodge';
            // cunning レイヤー3：punish-dodge（回避→突進タックル連携）にするか。
            //   トークンを確保できた時だけ punish 化＝回避中にトークンを予約し、
            //   回避完了後のタックルを確実に出す（他敵が攻撃中なら通常回避に留める）。
            // punish-dodge 予約：突進タックルは melee カテゴリなので melee トークンを確認
            const _meleeTok = ctx.attackTokens && ctx.attackTokens.melee;
            const _tk = _meleeTok ? _meleeTok.get() : null;
            if (e.personality === 'cunning' &&
                Math.random() < ENEMY_REACT_CONFIG.DODGE_PUNISH_CHANCE &&
                _attackRelay <= 0 && (_tk === null || _tk === e)) {
              e.dodgePunish = true;
              if (_meleeTok) _meleeTok.set(e);
            } else {
              e.dodgePunish = false;
            }
            _reacted = true;
          } else if (_r < e.dodgeTendency + e.guardTendency) {
            // ガード：構えに入る（前面 lv≤3 のヒットは hit-engine で enemy_block_hit に降格）
            e.state         = STATE.enemy_guard;
            e.downTimer     = ENEMY_GUARD_FRAMES;
            e.reactCooldown = ENEMY_REACT_CONFIG.REACT_COOLDOWN;
            e.aiPhase       = 'guard';
            _reacted = true;
          }
        }

        if (_reacted) {
          // dodge / guard に遷移済み：この frame は chase/retreat を走らせない
        } else if (e.aiPhase === 'retreat') {
          // === retreat: プレイヤーから離れる方向に一定F 後退 ===
          if (e.aiRetreatTimer > 0) {
            e.aiRetreatTimer--;
            // 後退方向 = -sign(dx)（プレイヤー逆側）
            if (adx > 0) {
              e.x -= Math.sign(dx) * DUMMY_ATK_CONFIG.retreatSpeed;
            }
            // Z 軸はそのまま（前後ジリジリ感を保つ）
          } else {
            // タイマー満了 → X 距離で再判定（Z は chase 中に別途追従するので含めない）
            e.aiPhase = (adx < DUMMY_ATK_CONFIG.approachRange) ? 'chase' : 'idle';
          }
        } else if (e.isBoss && e.bossStun) {
          // === ボススタン中：完全停止（連続 RC フィニッシュ後の見せ場確保）===
          //   AI 判断・移動・攻撃選択をすべてスキップ。bossStunTimer 切れで自動復帰。
          //   atkCooldown は通常通り減衰するので、スタン明け直後に即攻撃可能。
          e.aiPhase = 'idle';
          if (e.state === STATE.walk_fwd || e.state === STATE.walk_back || e.state === STATE.dash) {
            e.state = STATE.wait01;
          }
        } else {
          // === ダッシュ追跡（14-D-4）+ idle / chase 判定 + 接近・攻撃発動 ===
          const C = DUMMY_ATK_CONFIG;
          // boss01 専用パラメータ上書き（D 案 Phase 1 基本行動 2026-05-26）
          //   重い・遅い・大柄 → APPROACH/ATTACK_RANGE 広め、APPROACH_SPEED 遅め
          //   boss 以外は従来通り DUMMY_ATK_CONFIG を使う
          const _approachRange = e.isBoss ? BOSS01_CONFIG.APPROACH_RANGE : C.approachRange;
          const _attackRange   = e.isBoss ? BOSS01_CONFIG.ATTACK_RANGE   : C.attackRange;
          const _approachSpd0  = e.isBoss ? BOSS01_CONFIG.APPROACH_SPEED : C.approachSpeed;
          const _zChaseFactor  = e.isBoss ? BOSS01_CONFIG.Z_CHASE_FACTOR : C.zChaseFactor;
          const _dashChaseSpd0 = e.isBoss ? BOSS01_CONFIG.DASH_CHASE_SPEED : C.dashChaseSpeed;
          // 遭遇フラグ：一度でも approachRange 内に入ったら立てる
          if (!e.encountered && adx < _approachRange) e.encountered = true;
          // ダッシュ追跡の状態更新（遭遇済みのみ）：自機が approachRange 外へ離れたら
          //   ワンテンポ置いてダッシュ開始。dashChaseStop まで詰めたら終了。
          if (e.encountered) {
            if (e.dashChasing) {
              if (adx <= C.dashChaseStop) e.dashChasing = false;
            } else if (adx > _approachRange) {
              if (e.dashChaseBeat < 0)      e.dashChaseBeat = C.dashChaseBeat;  // 武装
              else if (e.dashChaseBeat > 0) e.dashChaseBeat--;                  // ワンテンポ消化
              else { e.dashChasing = true; e.dashChaseBeat = -1; }              // ダッシュ開始
            } else {
              e.dashChaseBeat = -1;  // approachRange 内に戻った → 武装解除
            }
          }

          if (e.dashChasing) {
            // ダッシュ追跡中：自機方向へ高速移動（state=dash は移動量反映ブロックが付与）
            e.aiPhase = 'chase';
            _chaseDash = true;
            const _ds = _dashChaseSpd0 * (e.enraged ? ENEMY_ENRAGE_CONFIG.APPROACH_MULT : 1);
            // 案B 障害物回避：ダッシュ追跡でも穴等を回り込む（遠間合いはこの経路を通る）
            if (!_steerAroundNavObstacles(e, p0, dx, _ds, _zChaseFactor)) {
              e.x += Math.sign(dx) * _ds;
              if (adz > 80) {
                const _zSpd = PHYSICS.SPEED * PHYSICS.Z_SPEED_MULT * _zChaseFactor;
                e.z += Math.sign(dz) * Math.min(_zSpd, adz);
              }
            }
          } else if (e.dashChaseBeat >= 0) {
            // ワンテンポ待機中：その場で「溜め」（移動せず・move-state 反映で wait01）
            e.aiPhase = 'chase';
          } else {
            // === 通常 idle / chase 判定 + 接近・攻撃発動 ===
            // X 距離のみで判定（Z は chase 中に追従する。X 近・Z 遠でも idle にしない）
            const inRange = (adx < _approachRange);
            if (!inRange) {
              e.aiPhase = 'idle';
            } else {
              e.aiPhase = 'chase';
              // 攻撃発動条件：距離（基本振り/タックルの圏内）+ cooldown + relay + 接地。
              //   性格 punishesHitstun（brave）はプレイヤー被弾中でも攻撃可＝追撃確定（レイヤー3）
              //   トークンチェックは攻撃種別が確定してからカテゴリ別に行う（変更3d）
              // ガードカウンター（midboss01 専用）: 盾ブロック累積が閾値に達したら即反撃
              //   cooldown / relay を無視して発動（プレイヤーへのペナルティ）
              const _isGuardCounter = (e.guardCounterArmed ?? false) && e.enemyType === 'midboss01';
              if (_isGuardCounter) {
                e.guardCounterArmed = false;
                e.shieldBlockCount  = 0;
                e._blockDecayTimer  = 0;
              }
              // 攻撃発動 Z 距離条件：boss は hitboxRangeZ が大きいので緩和
              const _atkZThresh = e.isBoss ? 160 : 100;
              const basicCanAttack = _isGuardCounter || (adz < _atkZThresh && e.atkCooldown <= 0 && _attackRelay <= 0 &&
                e.y <= ENEMY_AIRBORNE_Y_THRESHOLD && (!playerInHitstun || e.punishesHitstun));
              let atkId = basicCanAttack
                ? (_isGuardCounter ? 'mb01_atk_gc' : _selectEnemyAtk(e, adx))
                : null;
              // タックル専用グローバルCD：CD 中はタックルを基本振りに差し替え（完全禁止より自然）
              if (atkId === 'e01_atk_02' && _globalTackleRelay > 0) atkId = 'e01_atk_01';
              // プレイヤー攻撃中はタックル禁止：コンボへの割り込みを抑制
              if (atkId === 'e01_atk_02' && p0.state === STATE.attacking) atkId = 'e01_atk_01';
              if (atkId) {
                const _atkDef = ENEMY_ATTACKS[atkId];
                const _cat = _atkDef.attackCategory ?? 'melee';
                const _catTok = ctx.attackTokens[_cat];
                const tokenAvailable = !_catTok || _catTok.get() === null || _catTok.get() === e;
                if (tokenAvailable) {
                  // タックル開始時にグローバルCDをセット
                  if (atkId === 'e01_atk_02') _globalTackleRelay = ENEMY_ATTACK_RELAY.TACKLE_RELAY;
                  // 攻撃発動（14-D-2：距離で振り/タックル選択）
                  _beginEnemyAttack(e, atkId, ctx);
                }
              } else {
                // 接近移動（歩き速度・X / Z 両軸）。興奮中は接近速度上昇（#14-C）
                const _appSpd = _approachSpd0 * (e.enraged ? ENEMY_ENRAGE_CONFIG.APPROACH_MULT : 1);
                // 案B 汎用障害物回避：PL へ直進が障害物（穴 等）に阻まれるなら縁を回り込む。
                //   歩行 chase のみ。回避中は X/Z をステアリング側で処理 → 通常接近スキップ。
                if (_steerAroundNavObstacles(e, p0, dx, _appSpd, _zChaseFactor)) {
                  // 回避ステアリング処理済み
                } else {
                  if (e.enemyType === 'enem02') {
                    // enem02 後方待機型：自分から前線に詰めない。
                    //   極端に遠い場合（> approachRange × 1.5）のみゆっくり詰め（攻撃圏に入るため）。
                    const _e02FarLimit = C.approachRange * 1.5;  // 600wu
                    if (adx > _e02FarLimit) {
                      e.x += Math.sign(dx) * _appSpd * 0.4;
                    }
                  } else {
                    if (adx > _attackRange) {
                      e.x += Math.sign(dx) * _appSpd;
                    }
                  }
                  // Z 追従（enem02 含む全タイプ共通）
                  // cunning は laneZ ぶんずらした位置を狙って散開（14-D-3 密集回避）。
                  const _goalZ  = p0.z + e.laneZ;
                  const _laneDz = (e.personality === 'cunning') ? LANE_HOMING_DEADZONE : 80;
                  const _dzGoal = _goalZ - e.z;
                  if (Math.abs(_dzGoal) > _laneDz) {
                    const _zSpd = PHYSICS.SPEED * PHYSICS.Z_SPEED_MULT * _zChaseFactor;
                    e.z += Math.sign(_dzGoal) * Math.min(_zSpd, Math.abs(_dzGoal));
                  }
                }
                // 攻撃圏内だが token 不可 / cooldown 中 → その場で待機（ジリジリ感）
              }
            }
          }
        }
        // 移動 state 反映（#14-A / 14-D-2）：AI で動いていれば dash/walk_fwd/walk_back、
        //   停止なら wait01。攻撃発動で enemy_attacking へ遷移済みのときは触らない。
        if (e.state === STATE.wait01 || e.state === STATE.walk_fwd ||
            e.state === STATE.walk_back || e.state === STATE.dash) {
          const _dxm = e.x - _x0;
          if (_dxm === 0 && e.z === _z0) {
            e.state = STATE.wait01;
          } else {
            const _toward = Math.sign(_dxm) === Math.sign(p0.x - _x0);
            if (_dxm !== 0 && !_toward) {
              e.state = STATE.walk_back;
            } else {
              e.state = _chaseDash ? STATE.dash : STATE.walk_fwd;
            }
          }
        }
        // 落とし穴の侵入ブロックは floor-hole.js（_blockFromHoleZone）に集約。
        //   enemy-system 側は AI 回避処理を持たない（2026-05-29 ブロック矩形方式へ統一）。
      } else if (e.state === STATE.enemy_attacking) {
        e.aiPhase = 'attack';
        const atk = ENEMY_ATTACKS[e.curAtkId] ?? ENEMY_ATTACKS.e01_atk_01;
        e.atkTimer--;
        if (e.atkPhase === 'wind') {
          // 溜め中もプレイヤーに追従（向き合わせ + X/Z 両軸で詰める）
          const dx = p0.x - e.x;
          const dz = p0.z - e.z;
          const adx = Math.abs(dx);
          const adz = Math.abs(dz);
          // ボスは攻撃開始時の向きを全フェーズで固定（振り向き禁止）
          if (dx !== 0 && !e.isBoss) {
            e.facing = dx > 0 ? 1 : -1;
            e.mesh.rotation.y = e.facing * Math.PI / 2;
          }
          if (atk.kind === 'jump_dive') {
            // jump_dive 溜め：完全静止。向きだけ維持（追跡はジャンプ後の照準フェーズで行う）
            const windProg = 1.0 - (e.atkTimer / atk.windFrames);  // 0→1
            e._chargeT = windProg;  // hitFlash 上書き対策用に保存
            if (e.mesh) {
              e.mesh.scale.y = 1.0 - windProg * 0.40;  // 1.0→0.60（しゃがみ）
              _setMeshChargeColor(e, windProg);          // 基本色→黄色へ漸変（チャージ予兆）
            }
            // 移動なし（静止）
          } else if (atk.freezePos) {
            // freezePos=true：完全静止。発動位置を固定して当てる攻撃（boss1_atk_03 地響き等）
          } else {
            // 通常攻撃の溜め：プレイヤーへ追従（向き合わせ + X/Z 詰め）
            // 距離が attackRange より外なら少しずつ追う（溜め中の追跡速度は控えめ）
            const _windAtkRange = e.isBoss ? BOSS01_CONFIG.ATTACK_RANGE   : DUMMY_ATK_CONFIG.attackRange;
            const _windAppSpd   = e.isBoss ? BOSS01_CONFIG.APPROACH_SPEED : DUMMY_ATK_CONFIG.approachSpeed;
            if (adx > _windAtkRange * 0.75) {
              e.x += Math.sign(dx) * _windAppSpd * 0.6;
            }
            // Z 追従：active で当てるため、溜め中にプレイヤー Z へしっかり寄せる。
            if (adz > 30) {
              const _wzSpd = PHYSICS.SPEED * PHYSICS.Z_SPEED_MULT * DUMMY_ATK_CONFIG.zChaseFactor;
              e.z += Math.sign(dz) * Math.min(_wzSpd, adz);
            }
            // タックル（dash）予兆中は赤発光で通常 swing と区別（2026-05-25 通しプレイ受け）
            if (atk.kind === 'dash') {
              const windProg = 1.0 - (e.atkTimer / atk.windFrames);
              e._chargeT = windProg;
              _setMeshChargeColor(e, windProg, 0xff2222);
            }
          }
          // approachRange を完全に超えたらキャンセルして wait01 復帰（jump_dive は発動後キャンセルしない）
          //   boss は wind 入り後の距離キャンセルを行わない（離れて中断＝何もできない問題の解消）
          const _windCancelRange = e.isBoss ? BOSS01_CONFIG.APPROACH_RANGE : DUMMY_ATK_CONFIG.approachRange;
          if (!e.isBoss &&
              atk.kind !== 'jump_dive' &&
              (adx > _windCancelRange || adz > _windCancelRange)) {
            e.state         = STATE.wait01;
            e.atkPhase      = null;
            e.atkCooldown   = 30;
            e.hitDelivered  = false;
            e.aiPhase       = 'idle';  // wind キャンセル → 次F に距離再判定
            _clearAllTokens(ctx, e);  // トークン解放
            if (e.mesh) e.mesh.scale.y = 1.0;
            e._chargeT = 0;
            _setMeshChargeColor(e, 0);  // 黄色発光リセット
            _removeJdMarkers(e);
          } else if (e.atkTimer <= 0) {
            e.atkPhase       = 'active';
            e.atkTimer       = atk.activeFrames;
            e.atkDashDist    = 0;
            // 溜め終了 → アクティブ：踏み込み + 振りは即スナップ（打撃感）
            e.atkPitchTarget = atk.pitchActive;
            e.pitchAngle     = atk.pitchActive;
            if (atk.kind === 'jump_dive') {
              e._jdPhase     = 'launch';
              e.vy           = atk.jumpVy ?? 35;
              e._chargeT     = 0;
              if (e.mesh) e.mesh.scale.y = 1.0;  // しゃがみ解除
              _setMeshChargeColor(e, 0);           // 黄色発光リセット（ジャンプ開始）
            } else if (atk.kind === 'boss_double_tackle') {
              // 突進直前の予備溜め（AOE が player Z へホーミングする間 boss 静止）
              e._tackleState    = 'precharge1';
              e._tacklePreTimer = atk.preChargeFrames ?? 15;
            } else {
              e.x += e.facing * (atk.lungeVx ?? 0);  // 突進タックル（dash）は lungeVx 無し
            }
          }
        } else if (e.atkPhase === 'active') {
          if (atk.kind === 'dash') {
            // 突進タックル：facing 方向へ dashSpeed で前進。
            //   終了条件＝ヒット成立 / 壁で停止 / dashMaxDist 到達 / activeFrames フォールバック
            // 突進中は赤フル発光を維持（hitFlash で上書きされる可能性あるため毎F適用）
            _setMeshChargeColor(e, 1.0, 0xff2222);
            const wallL = Math.max(PHYSICS.STAGE_LEFT,  getActiveWallX('left'));
            const wallR = Math.min(PHYSICS.STAGE_RIGHT, getActiveWallX('right'));
            const step  = atk.dashSpeed;
            const nx    = Math.min(wallR, Math.max(wallL, e.x + e.facing * step));
            const moved = Math.abs(nx - e.x);
            e.x = nx;
            e.atkDashDist += moved;
            let dashEnd = false;
            if (!e.hitDelivered && tryHitPlayer(e, atk)) { e.hitDelivered = true; dashEnd = true; }
            if (moved < step * 0.5)               dashEnd = true;  // 壁で停止
            if (e.atkDashDist >= atk.dashMaxDist) dashEnd = true;  // 最大距離到達
            if (e.atkTimer <= 0)                  dashEnd = true;  // 持続F フォールバック
            if (dashEnd) {
              e.atkPhase       = 'recover';
              e.atkTimer       = atk.recoverFrames;
              e.atkPitchTarget = 0;
              e._chargeT       = 0;
              _setMeshChargeColor(e, 0);  // 赤発光リセット
            }
          } else if (atk.kind === 'hop_strike') {
            // 小ジャンプ攻撃：短いホップで前進→空中でヒット→着地でリカバリー
            if (!e._hopLaunched) {
              e._hopLaunched = true;
              e._hopAirborne = false;
              e.vy           = atk.hopVy ?? 10;
            }
            // 水平移動（前方向に進む）
            const _hspd = atk.dashSpeed ?? 9;
            e.x += e.facing * _hspd;
            e.atkDashDist += _hspd;
            if (e.y > 0) e._hopAirborne = true;
            // 空中でヒット判定（1 回のみ）
            if (!e.hitDelivered && e._hopAirborne) {
              if (tryHitPlayer(e, atk)) e.hitDelivered = true;
            }
            // 着地またはタイムアウトでリカバリー
            const _hopEnd = (e._hopAirborne && e.y <= 0)
              || e.atkDashDist >= (atk.dashMaxDist ?? 200)
              || e.atkTimer <= 0;
            if (_hopEnd) {
              e.y = 0; e.vy = 0;
              e._hopLaunched   = false;
              e._hopAirborne   = false;
              e.atkPhase       = 'recover';
              e.atkTimer       = atk.recoverFrames;
              e.atkPitchTarget = 0;
            }
          } else if (atk.kind === 'jump_dive') {
            const _jdp = e._jdPhase;
            if (_jdp === 'launch') {
              // 上昇中：頂点付近（vy≤2）で照準フェーズへ移行
              if (e.vy <= 2) {
                e._jdPhase       = 'aim';
                e.repulseWindow  = true;   // リパルスカウンター受付開始
                e._jdDiveGrace   = 0;      // 前回 dive の残値をクリア
                e._jdHoldY       = e.y;
                e._jdAimTimer    = atk.aimFrames ?? 80;
                // 2026-05-27：AOE 初期位置を敵自身の足元に。以前はプレイヤー位置に
                // 即ワープしていたため「ジャンパーから離れた地点に AOE が湧く」絵だった
                e._jdTargetX  = e.x;
                e._jdTargetZ  = e.z;
                // 寄せ込み期間：強 lerp でプレイヤーまで素早く詰めるフェーズの残 F
                e._jdAimApproachFrames = 15;
                _spawnJdMarkers(e, atk, e._jdTargetX, e._jdTargetZ);
              }
            } else if (_jdp === 'aim') {
              // aim 中に被弾したら攻撃キャンセル → recover へ（AOE も消去）
              if (e.hitFlashTimer > 0) {
                e.atkPhase       = 'recover';
                e.atkTimer       = atk.recoverFrames;
                e.atkPitchTarget = 0;
                e._jdPhase       = null;
                e.repulseWindow  = false;  // リパルスカウンター受付終了（被弾キャンセル）
                e._jdDiveGrace   = 0;
                e._chargeT       = 0;
                _clearAllTokens(ctx, e);
              } else {
              // 照準フェーズ：空中位置凍結（物理を上書き）+ 二次リング収束 + プレイヤー追尾
              e.y  = e._jdHoldY;
              e.vy = 0;
              const t = --e._jdAimTimer / (atk.aimFrames ?? 80);  // 1.0→0.0
              _updateJdRing(e, atk, Math.max(0, t));
              // aim 中はプレイヤーを追尾（AOE・リングも一緒に移動）
              // 2026-05-26：敵実体も _jdTargetX/Z に同期させて「実体が AOE 真上に居る」絵に統一
              // 2026-05-27：寄せ込み期間（最初 15F）は強 lerp 0.25 でプレイヤー位置まで
              //   素早く詰める。それ以降は既存の 0.05 でゆっくり追従。
              //   AOE 初期位置はジャンパー足元 → 寄せ込みでプレイヤーへ → 追従、の三段階。
              const _aimP = _players && _players[0];
              if (_aimP) {
                const _lerp = (e._jdAimApproachFrames > 0) ? 0.25 : 0.05;
                if (e._jdAimApproachFrames > 0) e._jdAimApproachFrames--;
                e._jdTargetX += (_aimP.x - e._jdTargetX) * _lerp;
                e._jdTargetZ += (_aimP.z - e._jdTargetZ) * _lerp;
                e.x = e._jdTargetX;
                e.z = e._jdTargetZ;
                if (e._jdAoeMesh) {
                  e._jdAoeMesh.position.x = e._jdTargetX;
                  e._jdAoeMesh.position.z = e._jdTargetZ;
                }
                if (e._jdRingMesh) {
                  e._jdRingMesh.position.x = e._jdTargetX;
                  e._jdRingMesh.position.z = e._jdTargetZ;
                }
              }
              if (e._jdAimTimer <= 0) {
                // 急降下開始（この瞬間 _jdTargetX/Z が確定・追尾解除）
                e._jdPhase      = 'dive';
                // リパルスカウンター grace（2026-05-27）：dive 開始後も短時間 RC 受付。
                //   理由：人間反応は「降ってきた！」を見てから SP2 → aim 終端で即 OFF だと反応間に合わず抜ける。
                //   12F ≒ 0.2s 猶予で「dive 確認 → SP2」が成立可能になる。
                e._jdDiveGrace  = 12;
                _removeJdMarkers(e);
              }
              } // end else (no hitFlash)
            } else if (_jdp === 'dive') {
              // dive grace（2026-05-27）：dive 突入後も短時間 RC 受付（人間反応猶予）。
              //   grace 中は repulseWindow=true を維持、カウンタ尽きたら false。
              if (e._jdDiveGrace > 0) {
                e.repulseWindow = true;
                e._jdDiveGrace--;
                if (e._jdDiveGrace <= 0) e.repulseWindow = false;
              }
              // 超高速降下：物理を無視して直接 Y を更新
              e.x  = e._jdTargetX;
              e.z  = e._jdTargetZ;
              const _dspd = atk.diveSpeed ?? 80;
              e.y  = Math.max(0, e.y - _dspd);
              e.vy = -_dspd;
              if (!e.hitDelivered && e.y <= (atk.hitboxRangeY / 2)) {
                if (tryHitPlayer(e, atk)) e.hitDelivered = true;
              }
              if (e.y <= 0) {
                e.y = 0; e.vy = 0;
                e.atkPhase       = 'recover';
                e.atkTimer       = atk.recoverFrames + 60;  // +60F しゃがみ硬直（隙・反撃猶予）
                e.atkPitchTarget = 0;
                // dive 着地で RC grace を強制終了：grace 残値があるまま recover へ遷移すると
                // 次フレーム以降 dive 分岐が走らず repulseWindow=true が残置される
                e._jdDiveGrace   = 0;
                e.repulseWindow  = false;
                if (e.mesh) e.mesh.scale.y = 0.60;  // 着地しゃがみポーズ
                // === RC チャレンジ失敗時の強制ヒット（2026-05-27）===
                //   AOE 内に居座って RC も回避も成立しなかった場合、必ず敵の攻撃を食らわせる。
                //   仕様：
                //     - 敵を player 直上へワープして「外しても掴まれる」絵を作る
                //     - 0.2s（12F）ヒットストップで重みを出す
                //     - ガード中でも atk_lv 6 強制で guard クラッシュ
                //   AOE 半径外まで逃げ切ったプレイヤーは免除（既存挙動）。
                if (!e.hitDelivered) {
                  const _p = _players && _players[0];
                  if (_p && _p.hp > 0 && _p.state !== STATE.dying && _p.state !== STATE.dead) {
                    const _aoeR = atk.aoeRadius ?? 120;
                    const _ddx = _p.x - e._jdTargetX;
                    const _ddz = _p.z - e._jdTargetZ;
                    if (Math.hypot(_ddx, _ddz) <= _aoeR) {
                      // プレイヤー直上へワープ（被弾位置の視認性向上）
                      e.x = _p.x;
                      e.z = _p.z;
                      e.y = _p.y + 40;
                      if (e.mesh) e.mesh.position.set(e.x, e.y, e.z);
                      // 強制ヒット用 attack：hitbox を実質無限化 + atk_lv 6 で guard 抜け
                      const _forceAtk = { ...atk,
                        atk_lv: 6,
                        hitboxRangeX: 9999, hitboxRangeY: 9999, hitboxRangeZ: 9999,
                      };
                      tryHitPlayer(e, _forceAtk);
                      e.hitDelivered = true;
                      // 0.2s 時止め（12F at 60fps）
                      triggerHitstop(12);
                    }
                  }
                }
              }
            } else {
              // フォールバック：_jdPhase が null のまま active に入った場合
              e._jdPhase = 'launch';
              e.vy = atk.jumpVy ?? 35;
            }
            // タイムアウト保険
            if (e.atkTimer <= 0 && e.atkPhase === 'active') {
              _removeJdMarkers(e);
              e.y = 0; e.vy = 0;
              e.atkPhase       = 'recover';
              e.atkTimer       = atk.recoverFrames + 60;  // +60F しゃがみ硬直
              e.atkPitchTarget = 0;
              if (e.mesh) e.mesh.scale.y = 0.60;
            }
          } else if (atk.kind === 'slash_rush') {
            // マチェットラッシュ：突進しながら hitSlots 定義の複数フレームで当たり判定。
            //   突進自体は無攻撃。各スロットは atkSlotIdx で管理（hitDelivered 非使用）。
            const wallL = Math.max(PHYSICS.STAGE_LEFT,  getActiveWallX('left'));
            const wallR = Math.min(PHYSICS.STAGE_RIGHT, getActiveWallX('right'));
            const _step  = atk.dashSpeed ?? 5;
            const _nx    = Math.min(wallR, Math.max(wallL, e.x + e.facing * _step));
            const _moved = Math.abs(_nx - e.x);
            e.x = _nx;
            e.atkDashDist += _moved;
            // 経過フレーム数に応じて hitSlots を順番に発火
            const _elapsed = atk.activeFrames - e.atkTimer;
            const _slots   = atk.hitSlots ?? [];
            while ((e.atkSlotIdx ?? 0) < _slots.length &&
                   _elapsed >= _slots[e.atkSlotIdx ?? 0].frame) {
              const _slot    = _slots[e.atkSlotIdx];
              const _slotAtk = Object.assign({}, atk, _slot);
              tryHitPlayer(e, _slotAtk);
              e.slashHitFlash = 6;   // hitbox フラッシュ表示（6F）
              e.atkSlotIdx = (e.atkSlotIdx ?? 0) + 1;
            }
            const _rushEnd = e.atkTimer <= 0
                          || e.atkDashDist >= (atk.dashMaxDist ?? 500)
                          || _moved < _step * 0.5;
            if (_rushEnd) {
              e.atkPhase        = 'recover';
              e.atkTimer        = atk.recoverFrames;
              e.atkPitchTarget  = 0;
              e.atkSlotIdx      = 0;
              e.recoverSaTimer  = atk.recoverSaFrames ?? 0;  // recover 前半 SA
            }
          } else if (atk.kind === 'boss_double_tackle') {
            // 画面端往復タックル（precharge → rush × 2）
            //   _tackleState: 'precharge1' → 'rush1' → 'precharge2' → 'rush2' → recover
            //   precharge: 静止しながら AOE が player Z にホーミング（外部の tackle_corridor 更新で実施）
            //   rush: 壁まで突進 + 1 ヒット判定
            const wallL = Math.max(PHYSICS.STAGE_LEFT, getActiveWallX('left'));
            const wallR = Math.min(PHYSICS.STAGE_RIGHT, getActiveWallX('right'));
            const pf    = atk.preChargeFrames ?? 15;

            if (e._tackleState === 'precharge1' || e._tackleState === 'precharge2') {
              // ── 予備溜め ──────────────────────────────────────────────────
              // AOE をボス中心に配置し rotation.y でプレイヤー Z 方向へ回転（ホーミング演出）
              // 初回フレームは橙コリドーを生成（active 移行時の赤を上書き）
              const disp2 = atk.aoeDisplay;
              const ch2   = disp2?.h ?? 220;
              const arenaW2 = wallR - wallL;
              const p0pc = _players?.[0];

              if (e._tacklePreTimer === pf) {
                // 2026-05-29: precharge 開始の瞬間にレーンを確定（コミット）。以後は追従しない。
                //   旧：precharge 終盤までプレイヤー Z を毎フレーム追従→終了時スナップ＝直前まで
                //       吸い付くため Z 回避不能（100% 命中）。
                //   新：開始時の player Z にロック → 確定レーンを予兆表示。残り precharge + rush 接近の
                //       間に Z 移動でレーンから外れれば回避できる（z軸読み合い）。
                e._tackleTargetZ = p0pc?.z ?? e.z;
                _aoeCleanAll(e);
                e._bossAoeId = _addRectArea?.({
                  x: (wallL + wallR) / 2, y: 1, z: e._tackleTargetZ,
                  width: arenaW2, height: ch2,
                  color: 0xff6600, opacity: 0.35,
                  blink: true, blinkPeriodFn: () => 6,
                }) ?? null;
                // 床面に寝かせる（カメラ向き XY 平面を水平 XZ 平面へ）
                _updateAreaRotation?.(e._bossAoeId, -Math.PI / 2, 0, 0);
              }
              // チャージ発光（橙）
              _setMeshChargeColor(e, (pf - e._tacklePreTimer) / pf, 0xff8833);
              e._tacklePreTimer--;

              if (e._tacklePreTimer <= 0) {
                // 溜め完了：確定レーン（_tackleTargetZ）へスナップして突進開始
                e.z = e._tackleTargetZ ?? e.z;
                _aoeCleanAll(e);
                e._bossAoeId = _addRectArea?.({
                  x: (wallL + wallR) / 2, y: 1, z: e.z,
                  width: arenaW2, height: ch2,
                  color: 0xff2200, opacity: 0.55,
                  blink: true, blinkPeriodFn: () => 4,
                }) ?? null;
                _updateAreaRotation?.(e._bossAoeId, -Math.PI / 2, 0, 0);
                e._tackleState    = e._tackleState === 'precharge1' ? 'rush1' : 'rush2';
                e.atkDashDist     = 0;
                e._tackleHitDone  = false;
              }

            } else {
              // ── 突進（rush1 / rush2）──────────────────────────────────────
              const _step  = atk.dashSpeed ?? 10;
              const _nx    = Math.min(wallR, Math.max(wallL, e.x + e.facing * _step));
              const _moved = Math.abs(_nx - e.x);
              e.x = _nx;
              e.atkDashDist += _moved;
              _setMeshChargeColor(e, 1.0, 0xff8833);

              // 1 パス 1 ヒット
              if (!e._tackleHitDone) {
                if (tryHitPlayer(e, atk)) {
                  e._tackleHitDone = true;
                  e.slashHitFlash  = 6;
                }
              }

              // 壁到達 / dashMaxDist / タイムアウト → 次フェーズへ
              const _passEnd = _moved < _step * 0.5
                            || e.atkDashDist >= (atk.dashMaxDist ?? 1800)
                            || e.atkTimer <= 0;
              if (_passEnd) {
                if (e._tackleState === 'rush1') {
                  // rush1 完了 → 振り返り + precharge2
                  e.facing          = -e.facing;
                  if (e.mesh) e.mesh.rotation.y = e.facing * Math.PI / 2;
                  e._tackleState    = 'precharge2';
                  e._tacklePreTimer = pf;
                  _setMeshChargeColor(e, 0);
                } else {
                  // rush2 完了 → recover + 疲れ状態開始
                  e.atkPhase         = 'recover';
                  e.atkTimer         = atk.recoverFrames;
                  e.atkPitchTarget   = 0;
                  e.recoverSaTimer   = atk.recoverSaFrames ?? 0;
                  e.bossStun      = true;
                  e.bossStunTimer = BOSS01_CONFIG.STUN_FRAMES ?? 300;
                  e._bossStunFrame = 0;
                  _setMeshChargeColor(e, 0);
                }
              }
            }
          } else if (atk.kind === 'boss_overdrive') {
            // 追尾 4 連コンボ：各スロットに wind（RC 受付）→ hit → active（後隙）
            const slots = atk.comboSlots ?? [];
            const _DBG_OD = (typeof window !== 'undefined') && window.SB?.DEBUG_BOSS_OD;

            if (!e._odInitDone) {
              // アクティブ初回：その場で連続技開始（warp 廃止：自機の混乱を避ける）
              e._odInitDone = true;
              e._odComboRcLockedOut = false;  // 新コンボ：ロックアウトをリセット
              e._odPerfectRcCount = 0;        // 新コンボ：Perfect RC カウントもリセット
              if (_DBG_OD) console.log(`[OD INIT] slot 0 wind start (windF=${slots[0]?.windF}, axis=${slots[0]?.repulseAxis})`);
              // facing だけプレイヤー方向に更新
              const p0 = _players?.[0];
              if (p0) {
                e.facing = (p0.x >= e.x) ? 1 : -1;
                if (e.mesh) e.mesh.rotation.y = e.facing * Math.PI / 2;
              }
              if (slots.length === 0) {
                e.atkPhase = 'recover'; e.atkTimer = atk.recoverFrames; return;
              }
              e._odSlotIdx   = 0;
              e._odSlotPhase = 'wind';
              e._odSlotTimer = slots[0].windF ?? 20;
              e._odSlotAxis  = slots[0].repulseAxis ?? null;
              e.repulseWindow = true;
            }

            // 負数も許容（wind 終了後のグレース期間に使う）
            e._odSlotTimer = (e._odSlotTimer ?? 1) - 1;
            const slot = slots[e._odSlotIdx ?? 0];

            // ── ホーミング：プレイヤー方向へ間合いを詰める ──
            //   振り下ろし系の近距離技 → ボス側から寄らないと最後の一撃が届かない
            //   wind / active 両フェーズで継続。停止距離内ならその場で止まる
            const _p0od = _players?.[0];
            if (_p0od && !_p0od.dying && _p0od.state !== STATE.dead) {
              const _hSpdX = BOSS01_CONFIG.OVERDRIVE_HOMING_X ?? 12;
              const _hSpdZ = BOSS01_CONFIG.OVERDRIVE_HOMING_Z ?? 6;
              const _hTgtX = BOSS01_CONFIG.OVERDRIVE_TARGET_X ?? 180;
              const _hTgtZ = BOSS01_CONFIG.OVERDRIVE_TARGET_Z ?? 60;
              const _dxH = _p0od.x - e.x;
              const _adxH = Math.abs(_dxH);
              if (_adxH > _hTgtX) {
                e.x += Math.sign(_dxH) * Math.min(_hSpdX, _adxH - _hTgtX);
              }
              const _dzH = _p0od.z - e.z;
              const _adzH = Math.abs(_dzH);
              if (_adzH > _hTgtZ) {
                e.z += Math.sign(_dzH) * Math.min(_hSpdZ, _adzH - _hTgtZ);
              }
              // facing もプレイヤー方向へ更新（プレイヤーが背後に回り込んだら振り向く）
              //   旧 50wu 閾値 → 10wu に縮小：連続技中に反対側へ回り込まれても確実に振り向く
              if (_adxH > 10) {
                const _newFacing = _dxH >= 0 ? 1 : -1;
                if (e.facing !== _newFacing) {
                  e.facing = _newFacing;
                  if (e.mesh) e.mesh.rotation.y = e.facing * Math.PI / 2;
                }
              }
            }
            // wind 終了後の RC グレース：UI が「白丸ピーク」になった瞬間に押しても間に合うように
            //   timer が 0 まで来た後さらに N F 受付（その間 repulseWindow は true 維持）
            const _windGrace = atk.windGraceFrames ?? 14;

            if (!slot) {
              e.atkPhase = 'recover'; e.atkTimer = atk.recoverFrames;
              e.repulseWindow = false; e._odSlotAxis = null;
            } else if (e._odSlotPhase === 'wind') {
              // timer が -windGrace に達するまでは wind 扱い（RC 可）
              if (e._odSlotTimer <= -_windGrace) {
                if (_DBG_OD) console.log(`[OD wind→active] slot ${e._odSlotIdx} (no RC, grace expired) → hit fire / chain LOCKED OUT`);
                // wind + grace 完走 → ヒット判定 + active（後隙）へ
                //   RC 取り逃し：以降のスロットは RC 不可
                e._odComboRcLockedOut = true;
                // ヒット直前の facing 最終確認：プレイヤーが反対側にいたら強制反転（特に最終段ストレートで重要）
                if (_p0od) {
                  const _newFacing = (_p0od.x >= e.x) ? 1 : -1;
                  if (e.facing !== _newFacing) {
                    e.facing = _newFacing;
                    if (e.mesh) e.mesh.rotation.y = e.facing * Math.PI / 2;
                  }
                }
                e._odSlotPhase  = 'active';
                e._odSlotTimer  = slot.activeF ?? 10;
                e.repulseWindow = false;
                e._odSlotAxis   = null;
                const _hitAtk = Object.assign({}, atk, slot);  // スロット値で damage/knockback 上書き
                const _isLastSlot = (e._odSlotIdx ?? 0) === slots.length - 1;
                if (tryHitPlayer(e, _hitAtk) && _isLastSlot && _players?.[0]) {
                  // 連続技最終段（ストレート）命中：プレイヤーにキャラ単独シェイク
                  triggerCharShake(_players[0], 14, 16);
                }
                e.slashHitFlash = 6;
              }
              // else: wind 中 or grace 中（timer 0 ～ -_windGrace） → repulseWindow=true 維持で RC 受付継続
            } else {
              // active（後隙）終了 → 次スロットへ or recover
              if (e._odSlotTimer <= 0) {
                const nextIdx = (e._odSlotIdx ?? 0) + 1;
                if (nextIdx >= slots.length) {
                  if (_DBG_OD) console.log(`[OD] all slots done → recover`);
                  e.atkPhase       = 'recover';
                  e.atkTimer       = atk.recoverFrames;
                  e.atkPitchTarget = 0;
                } else {
                  if (_DBG_OD) console.log(`[OD active→wind] slot ${nextIdx} (windF=${slots[nextIdx]?.windF}, axis=${slots[nextIdx]?.repulseAxis}) lockedOut=${e._odComboRcLockedOut}`);
                  e._odSlotIdx    = nextIdx;
                  e._odSlotPhase  = 'wind';
                  const ns        = slots[nextIdx];
                  e._odSlotTimer  = ns.windF ?? 20;
                  e._odSlotAxis   = ns.repulseAxis ?? null;
                  // ロックアウト中は repulseWindow を立てない（UI / 検出ともに無効化）
                  e.repulseWindow = !e._odComboRcLockedOut;
                }
              }
            }
            // タイムアウト保険
            if (e.atkTimer <= 0 && e.atkPhase === 'active') {
              if (_DBG_OD) console.log(`[OD TIMEOUT] activeFrames 切れ → recover (slot=${e._odSlotIdx} phase=${e._odSlotPhase} timer=${e._odSlotTimer})`);
              e.atkPhase = 'recover'; e.atkTimer = atk.recoverFrames;
              e.repulseWindow = false; e._odSlotAxis = null;
            }
          } else if (atk.kind === 'missile_barrage') {
            // ── ミサイルバラージ：時間差で 1 発ずつ降ってきて個別 AOE 警告 → 着弾 ──
            //   1 発ごとに waiting → warning → done の状態機械。
            //   warning 中：AOE 警告リング表示 + ミサイル mesh を着弾点へ降下
            //   着弾時刻：t >= impactFrame で damage 判定 + 爆発演出
            //   将来 missileImpactWindow を延長すれば「他攻撃と重なる飽和攻撃」になる
            const af = atk.activeFrames;
            const t  = af - e.atkTimer;

            // 初回フレーム：着弾位置と時刻を生成
            if (!e._missiles) {
              const cnt   = atk.missileCount        ?? 9;
              const winF  = atk.missileImpactWindow ?? 180;
              const warnF = atk.missileWarningFrames?? 30;
              const spX   = atk.missileSpreadX      ?? 1400;
              const spZ   = atk.missileSpreadZ      ?? 600;
              const usePl = (atk.missileTargetMode ?? 'player') === 'player';
              const cx    = usePl ? (_players?.[0]?.x ?? e.x) : 0;
              const cz    = usePl ? (_players?.[0]?.z ?? e.z) : e.z;
              e._missiles = [];
              for (let i = 0; i < cnt; i++) {
                const baseT   = warnF + ((cnt > 1) ? (i / (cnt - 1)) * winF : 0);
                const jitter  = (Math.random() - 0.5) * (winF / cnt) * 0.5;
                const impactF = Math.max(warnF, Math.floor(baseT + jitter));
                const mx = cx + (Math.random() - 0.5) * spX;
                const mz = cz + (Math.random() - 0.5) * spZ;
                e._missiles.push({
                  x: mx, z: mz,
                  impactFrame: impactF,
                  warnFrame:   impactF - warnF,
                  state: 'waiting', aoeId: null, mesh: null, done: false,
                });
              }
            }

            const mRadius = atk.missileRadius     ?? 110;
            const fallH   = atk.missileFallHeight ?? 700;
            const warnF2  = atk.missileWarningFrames ?? 30;
            for (const m of e._missiles) {
              if (m.done) continue;
              // waiting → warning：AOE と落下メッシュをスポーン
              if (m.state === 'waiting' && t >= m.warnFrame) {
                m.aoeId = _addStaticArea?.({
                  x: m.x, y: 0, z: m.z,
                  radius: mRadius, color: 0xff6600, opacity: 0.45,
                  thickness: mRadius * 0.35,
                  blink: true, blinkPeriodFn: () => 8,
                }) ?? null;
                m.mesh = _buildMissileVisual(m.x, m.z, fallH);
                m.state = 'warning';
              }
              // warning フェーズ：mesh を着弾点へ降下（線形補間）
              if (m.state === 'warning' && m.mesh) {
                const remain = m.impactFrame - t;
                const ratio  = Math.max(0, Math.min(1, remain / warnF2));
                m.mesh.position.y = ratio * fallH;
              }
              // warning → done：着弾
              if (m.state === 'warning' && t >= m.impactFrame) {
                _tryMissileHit(m, mRadius, {
                  damage:    atk.missileDamage    ?? 16,
                  atk_lv:    atk.missileAtkLv     ?? 4,
                  knockback: atk.missileKnockback ?? 24,
                  hitstop:   atk.hitstop          ?? 6,
                  shake:     atk.shake            ?? 10,
                  hitColor:  atk.hitColor         ?? 0xff7733,
                });
                spawnHitParticles(m.x, 20, m.z, 0xffcc44, 18, { type: 'launch', speedMul: 1.4 });
                spawnHitParticles(m.x, 20, m.z, 0xff4422, 24, { type: 'omni',   speedMul: 1.0, sizeScale: 1.2 });
                triggerShake(6, 10);
                if (m.aoeId != null) { _removeArea?.(m.aoeId); m.aoeId = null; }
                if (m.mesh) { _disposeMissileVisual(m.mesh); m.mesh = null; }
                m.state = 'done';
                m.done  = true;
              }
            }

            // タイムアウト → recover
            if (e.atkTimer <= 0) {
              _cleanupMissiles(e);
              e.atkPhase       = 'recover';
              e.atkTimer       = atk.recoverFrames;
              e.atkPitchTarget = 0;
            }
          } else {
            // その場振り：active 中ずっとヒット判定（1 ヒットのみ）
            if (!e.hitDelivered) {
              if (tryHitPlayer(e, atk)) {
                e.hitDelivered = true;
              }
            }
            if (e.atkTimer <= 0) {
              e.atkPhase       = 'recover';
              e.atkTimer       = atk.recoverFrames;
              e.atkPitchTarget = 0;   // recover：直立へ戻す
            }
          }
        } else if (e.atkPhase === 'recover') {
          if (e.recoverSaTimer > 0) e.recoverSaTimer--;
          if (e.atkTimer <= 0) {
            e.state         = STATE.wait01;
            e.atkPhase      = null;
            // 攻撃クールダウン：性格 cooldownMult（brave 短い）× 興奮短縮（#14-C）
            e.atkCooldown   = Math.round(atk.cooldownFrames * e.cooldownMult *
              (e.enraged ? ENEMY_ENRAGE_CONFIG.COOLDOWN_MULT : 1));
            e.hitDelivered  = false;
            // Phase 3：recover 完了 → retreat フェーズへ（brave は retreatMult≈0 で退却拒否）
            e.aiPhase       = 'retreat';
            e.aiRetreatTimer = Math.round(DUMMY_ATK_CONFIG.retreatFrames * e.retreatMult);
            _clearAllTokens(ctx, e);  // トークン解放
            // 敵同士の攻撃テンポ（14-D-5）：次の攻撃まで「見合う」間をばらつき付きで確保
            _attackRelay = Math.round(ENEMY_ATTACK_RELAY.BASE * ENEMY_ATTACK_RELAY.DIFF_MULT *
              (1 + (Math.random() * 2 - 1) * ENEMY_ATTACK_RELAY.VARIANCE));
            if (e.mesh) e.mesh.scale.y = 1.0;  // スケール安全リセット
          }
        }
      }
    }

    // AOE マーカーリーク防止（被弾・死亡等で aim フェーズを抜けた場合に残存マーカーを消去）
    if ((e._jdAoeMesh || e._jdRingMesh) &&
        !(e.state === STATE.enemy_attacking && e.atkPhase === 'active' && e._jdPhase === 'aim')) {
      _removeJdMarkers(e);
    }

    // ステータス系：status_stun のタイマー駆動（duration 経過で wait01）
    if (e.state === STATE.status_stun) {
      if (--e.statusStunTimer <= 0) {
        e.state = STATE.wait01;
        e.statusStunTimer = 0;
        _setMeshChargeColor(e, 0);  // 黒オーバーレイ解除
      } else {
        // ボススタンと同じ黒点滅演出を status_stun にも適用（2026-05-29 追加）
        //   モデルに黒オーバーレイを sin 波でかけて「動けない」感を視覚化
        e._statusStunFrame = (e._statusStunFrame ?? 0) + 1;
        const _pSpeed = BOSS01_CONFIG.STUN_PULSE_SPEED   ?? 0.10;
        const _pMax   = BOSS01_CONFIG.STUN_PULSE_OPACITY ?? 0.65;
        const _pFactor = _pMax * (0.5 + 0.5 * Math.sin(e._statusStunFrame * _pSpeed));
        _setMeshChargeColor(e, _pFactor, 0x000000);
      }
    } else if ((e._statusStunFrame ?? 0) > 0) {
      // status_stun 外なら frame カウンタリセット
      e._statusStunFrame = 0;
    }
    // RP 経由の post-KB スタン follow-up（2026-05-27）：
    //   _triggerRepulseParry が _postKbStunFrames を立てる → KB 系 state（knockback02 /
    //   knockback_air01 → fall_loop → land）が完了して wait01 に戻った瞬間にここで拾い、
    //   status_stun を 120F (2 秒) かける。空中で発生した場合も着地→wait01 経由で同じ流れに乗る。
    if ((e._postKbStunFrames ?? 0) > 0 && e.state === STATE.wait01 && !e.dying) {
      e.state           = STATE.status_stun;
      e.statusStunTimer = e._postKbStunFrames;
      e._postKbStunFrames = 0;
    }
    // ダウン・被弾ステート機械（タイマー駆動の遷移のみ・tiltAngle は後段で一括計算）
    if (e.state === STATE.down_up_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_up_loop;
    } else if (e.state === STATE.down_up_loop) {
      // 横倒しのまま落下（着地は y<=0 ブロックで処理）
    } else if (e.state === STATE.down_bas_start) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_bas_loop) {
      // ゴア・クリティカル armed crit_ground_stick：地面張り付き中。
      // タイマー満了で _triggerFinalExplosion を発火（バウンドや起き上がりに遷移しない）
      if (e.goreCritical && e.goreCritical.armed
          && e.goreCritical.phase === 'crit_ground_stick') {
        if (e.goreCritical.timer > 0) e.goreCritical.timer--;
        if (--e.downTimer <= 0) {
          _triggerFinalExplosion(e);
        }
      } else if (--e.downTimer <= 0) {
        // dying 敵：ダウン loop 完了の瞬間に final 経路へ短絡し爆発（2026-05-19 仕様変更）：
        //   旧：起き上がり完了 → stunned → final → 爆発（待ち時間が長い）
        //   新：loop 完了タイミングで flash → 爆発（state は down_bas_loop のまま固定）
        //   注：downTimer を高値に bump し、次フレーム以降の state machine が同じブランチを
        //       再実行して state=down_bas_end（起き上がり）に流れるのを防ぐ
        if (e.dying && e.dyingPhase !== 'final' && e.dyingPhase !== 'exploded'
            && !(e.goreCritical && e.goreCritical.armed)) {
          e.dyingPhase     = 'final';
          e.dyingFinalTimer = GORE_CONFIG.PREEXPLODE_FLASH_FRAMES + 1;
          e.dyingInvincible = true;
          e.downTimer       = 9999;   // 起き上がり遷移を以後ブロック（爆発で消える前提）
        } else {
          e.state    = STATE.down_bas_end;
          e.downTimer = ENEMY_RISE_FRAMES;
        }
      }
    } else if (e.state === STATE.down_bas_end) {
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.knockback01 || e.state === STATE.knockback02) {
      if (--e.downTimer <= 0) {
        // OC BRN-l04 SOLAR FLARE：knockback02 復帰時に pending スタン適用（2026-05-29）。
        //   hit-engine で attack.solarFlareTrigger + !isBoss の場合のみフラグ立てる。
        //   SA 吸収時は hit-engine が continue するためフラグは立たない。
        if (e._solarPendingStun) {
          e._solarPendingStun = false;
          e.state = STATE.wait01;   // applyStatusStun の前提（wait01 / enemy_attacking）に合わせる
          applyStatusStun(e, undefined, ctx);   // 既定 1.5 秒
        } else {
          e.state = STATE.wait01;
        }
      }
    } else if (e.state === STATE.knockback03) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    } else if (e.state === STATE.knockback_air01) {
      if (--e.downTimer <= 0) {
        e.state = STATE.fall_loop;
        e.kbFromMega = false;  // 通常フリンチ終了で重力半減フラグ解除
      }
    } else if (e.state === STATE.fall_loop) {
      // 自由落下中（着地は y<=0 ブロック）
    } else if (e.state === STATE.land) {
      if (--e.downTimer <= 0) {
        // OC BRN-l04 SOLAR FLARE：空中ヒット → knockback_air01 → fall → land → wait01 経路でも pending stun を適用
        if (e._solarPendingStun) {
          e._solarPendingStun = false;
          e.state = STATE.wait01;
          applyStatusStun(e, undefined, ctx);
        } else {
          e.state = STATE.wait01;
        }
      }
    } else if (e.state === STATE.jump_start) {
      if (--e.downTimer <= 0) e.state = STATE.jump_loop;
    } else if (e.state === STATE.jump_d_start) {
      if (--e.downTimer <= 0) e.state = STATE.jump_d_loop;
    } else if (e.state === STATE.jump_loop || e.state === STATE.jump_d_loop) {
      // 空中（着地は y<=0 ブロックで jump_end / jump_d_end へ）
    } else if (e.state === STATE.jump_end || e.state === STATE.jump_d_end) {
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.enemy_dodge) {
      // バックステップ回避（#14-B）：水平移動は共通 KB ブロックが担当。前半のみ無敵。
      e.downTimer--;
      if (e.downTimer <= ENEMY_DODGE_FRAMES - ENEMY_DODGE_INVULN) e.dodgeInvuln = false;
      if (e.downTimer <= 0) {
        e.dodgeInvuln = false;
        // cunning レイヤー3：punish-dodge は回避完了直後に突進タックルへ連携（隙突き）。
        //   突進タックルは melee カテゴリなので melee トークンが空いている時のみ発動。
        const _meleeTok2 = ctx.attackTokens && ctx.attackTokens.melee;
        const _tk = _meleeTok2 ? _meleeTok2.get() : null;
        if (e.dodgePunish && (_tk === null || _tk === e)) {
          const _p = _players[0];
          if (_p && _p.x !== e.x) {  // 突進前にプレイヤー方向へ向き直す
            e.facing = _p.x > e.x ? 1 : -1;
            e.mesh.rotation.y = e.facing * Math.PI / 2;
          }
          const _punishAtkId = (e.enemyType === 'enem02') ? 'e02_atk_01' : 'e01_atk_02';
          _beginEnemyAttack(e, _punishAtkId, ctx);
        } else {
          e.state = STATE.wait01;
        }
        e.dodgePunish = false;
      }
    } else if (e.state === STATE.enemy_guard) {
      // ガード姿勢を保持 → タイマー満了で wait01（ガード成立処理は hit-engine 側）
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.enemy_block_hit) {
      // ガード成立硬直 → wait01（軽 KB は共通 KB ブロックが減衰）
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.enemy_stagger) {
      // 連続被弾よろめき → wait01
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.enraged_intro) {
      // 興奮発生モーション（#14-C）→ wait01。aiPhase は 'enraged' 維持（hitstun ラベル上書き）
      e.aiPhase = 'enraged';
      if (--e.downTimer <= 0) e.state = STATE.wait01;
    } else if (e.state === STATE.down_front_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_front_loop;
    } else if (e.state === STATE.down_front_loop) {
      // 吹き飛び中（着地は y<=0 ブロック）
    } else if (e.state === STATE.down_super_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_super_loop;
    } else if (e.state === STATE.down_super_loop) {
      // 吹き飛び中（壁/地面は前段ブロックで処理）
    } else if (e.state === STATE.down_wall_start) {
      // ゴア・クリティカル（wall_blast variant）armed：張り付き終了で反作用バウンスせず、
      // 壁位置で _triggerFinalExplosion を発火（_explodeTowardPlayer がパーツをプレイヤー方向へ）
      if (e.goreCritical && e.goreCritical.armed
          && e.goreCritical.phase === 'crit_wall_stick') {
        // タイマー満了で壁位置爆散（バウンスせず）
        if (e.goreCritical.timer > 0) e.goreCritical.timer--;
        if (--e.downTimer <= 0) {
          _triggerFinalExplosion(e);
        }
        // tilt は STATE_TILT_TARGET 経由で自動補間（壁張り付きの姿勢）
      } else
      // 壁張り付き 30F 経過 → 反作用バウンス：プレイヤー方向（-fallDir）に大きく飛び上がる（2026-05-18）
      //   既存の down_super_loop に再突入。地面到達で既存の down_roll_start 遷移が走る。
      //   ※ superFlightCount は lv 6 攻撃 hit 時のみ増加するため、ここでは増えない
      //     → 2 回目発動による無敵化ロジックには干渉しない
      if (--e.downTimer <= 0) {
        e.vy           = ENEMY_WALL_BOUNCE_VY;
        // 距離認識バウンス（2026-05-20 改）：プレイヤーまでの距離から到達飛距離を逆算し、
        //   「プレイヤー手前 80wu」で停止するように KB_VX を決める。
        //   累積飛距離 ≈ KB_VX / (1 - DECAY)。手前マージン 80wu でちょい届かない位置に着地。
        //   distToPlayer が極端に近い/遠い場合に備えて KB_VX を [6, 25] でクランプ。
        const p = _players[0];
        const distToPlayer = p ? Math.abs(p.x - e.x) : 200;
        const stopMargin = 80;  // プレイヤー手前で止めるマージン
        const targetDist = Math.max(0, distToPlayer - stopMargin);
        const kbVxFromDist = targetDist * (1 - ENEMY_WALL_BOUNCE_KB_DECAY);
        // 近距離は 0 まで許容（過剰バウンス防止）／遠距離は max でクランプ
        const kbVx = Math.min(ENEMY_WALL_BOUNCE_KB_VX, kbVxFromDist);
        e.knockbackVx  = -e.fallDir * kbVx;
        e.kbDecay      = ENEMY_WALL_BOUNCE_KB_DECAY;
        e.state        = STATE.down_super_loop;
        e.downTimer    = 999;  // 地面 / 壁 / カウンタ更新で次状態へ遷移するため大きな値で OK
        // 壁側を向いたまま飛ぶ：rotation.y を +fallDir 基準で設定（2026-05-18）
        //   ※ 通常の被弾 facing は -fallDir*π/2（プレイヤー側）。壁バウンスはそれの逆向き。
        //   rotation.y はその後の super 飛行 / down_roll_* / down_bas_loop に
        //   そのまま引き継がれる（mesh.rotation は明示再設定が無ければ持続）。
        e.mesh.rotation.y = e.fallDir * Math.PI / 2;
        // バウンス中フラグ：被弾時に通常 knockback 状態へ遷移可能にする（trajectory protect 解除）
        e.isWallBounce = true;
      }
    } else if (e.state === STATE.down_wall_loop) {
      // うつ伏せ落下中（着地は y<=0 ブロックで処理）
      // 保険：地上 (y=0) で壁ヒットして wall_loop に来た場合、落下するべき距離がないので
      // 着地ブロックが走らずハングする。ここで直接 down_bas_start へ抜ける（2026-05-16）
      if (e.y <= 0) {
        e.y         = 0;
        e.state     = STATE.down_bas_start;
        e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
      }
    } else if (e.state === STATE.down_roll_start) {
      if (--e.downTimer <= 0) {
        e.state     = STATE.down_roll_loop;
        e.downTimer = ENEMY_ROLL_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_roll_loop) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_rakka_start) {
      if (--e.downTimer <= 0) e.state = STATE.down_rakka_loop;
    } else if (e.state === STATE.down_rakka_loop) {
      // 真下落下中（着地は y<=0 ブロックで down_bound_start に遷移）
    } else if (e.state === STATE.down_burst_start) {
      if (--e.downTimer <= 0) {
        e.state    = STATE.down_burst_loop;
        e.downTimer = ENEMY_DOWN_BURST_LOOP_FRAMES;
      }
    } else if (e.state === STATE.down_burst_loop) {
      // 空中スピン中（着地で down_bas_start に合流・y<=0 ブロックで処理）
      // 滞空が長引いた場合のフォールバック（万一着地検知が抜けたら強制終了）
      if (--e.downTimer <= 0) {
        e.state     = STATE.down_bas_start;
        e.downTimer = ENEMY_DOWN_BAS_START_FRAMES;
        e.burstSpinRate = 0;
        e.burstGravMult = 0;
        e.burstRollAngle = 0;
        e.mesh.rotation.x = 0;
        e.mesh.rotation.z = 0;
        e.tiltAngle = 0;
      }
    } else if (e.state === STATE.down_bound_start) {
      // バウンド中：通常は再着地（y<=0）で down_bas_loop に遷移
      // 万一着地が発火しなかった場合のフォールバック
      if (--e.downTimer <= 0) {
        e.state     = STATE.down_bas_loop;
        e.downTimer = ENEMY_DOWN_BAS_LOOP_FRAMES;
      }
    }

    // === tiltAngle 一括計算（データテーブル + ランプ系特殊処理） ===
    if (e.state === STATE.down_up_start) {
      // 0 → π/2 ランプ（downTimer: ENEMY_FALL_FRAMES → 0）
      e.tiltAngle = (1 - e.downTimer / ENEMY_FALL_FRAMES) * (Math.PI / 2);
    } else if (e.state === STATE.down_front_start) {
      // 0 → π/2 後方ランプ（down_up_start と同じ仕組み・downTimer: ENEMY_DOWN_FRONT_FRAMES → 0）
      e.tiltAngle = (1 - e.downTimer / ENEMY_DOWN_FRONT_FRAMES) * (Math.PI / 2);
    } else if (e.state === STATE.down_bas_end) {
      // π/2 → 0 ランプ（downTimer: ENEMY_RISE_FRAMES → 0）
      e.tiltAngle = (e.downTimer / ENEMY_RISE_FRAMES) * (Math.PI / 2);
    } else if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) {
      // バースト離脱：きりもみ回転（鉄拳系の長軸ロール）
      //   Three.js Euler 順 'ZYX' では Rx が内側 → 単純な rotation.x 加算では
      //   「水平に倒した上で長軸まわりに回す」が表現できない。
      //   ここで直接クォータニオン合成： q = qX(roll) * qZ(tilt) * qY(face)
      //   これで Rx が一番外側になり、tilt 後の世界 X 軸（≒長軸）まわりに回せる
      e.burstRollAngle += e.fallDir * (e.burstSpinRate || 0);
      const _faceY = -e.fallDir * Math.PI / 2;  // 既存の wait01 facing と一致
      const _tiltZ = -e.fallDir * Math.PI / 2;  // 水平倒し（head が +fallDir 方向へ）
      const _rollX = e.burstRollAngle;
      const _qY = new _THREE.Quaternion().setFromAxisAngle(new _THREE.Vector3(0, 1, 0), _faceY);
      const _qZ = new _THREE.Quaternion().setFromAxisAngle(new _THREE.Vector3(0, 0, 1), _tiltZ);
      const _qX = new _THREE.Quaternion().setFromAxisAngle(new _THREE.Vector3(1, 0, 0), _rollX);
      e.mesh.quaternion.copy(_qX).multiply(_qZ).multiply(_qY);
      // tiltAngle は同期しておく（参考用・他系統が触らないようにするため）
      e.tiltAngle = Math.PI / 2;
    } else if (e.state === STATE.down_roll_start || e.state === STATE.down_roll_loop) {
      // 転がり中：直立姿勢のまま X 軸（前後方向）でごろごろ回転（2026-05-18 修正）
      //   tilt（rotation.z）は 0 のまま。rotation.x を連続加算で後転（back-flip）。
      //   θ は常に -0.35 単位で減少。rotation.y で世界座標への解釈が自動反転されるため、
      //   通常被弾（rotY=-π/2）も壁バウンス（rotY=+π/2）も θ 減少だけで自然な
      //   ローリング（頭が motion 方向に先行）になる。rollDir は kbVx 方向で別途管理。
      e.rollDebugAngle -= 0.35;  // ≒ 20°/F
      e.tiltAngle = 0;  // 同期（後段の rotation.z 反映で 0 になる）
    } else {
      const tiltTarget = STATE_TILT_TARGET[e.state] ?? 0;
      e.tiltAngle += (tiltTarget - e.tiltAngle) * STATE_TILT_LERP;
    }
    // rotation.z = -fallDir * tiltAngle で水平倒し方向を反映
    //   burst 中はクォータニオン直接合成しているのでスキップ（Euler を上書きすると壊れる）
    if (e.state !== STATE.down_burst_start &&
        e.state !== STATE.down_burst_loop) {
      e.mesh.rotation.z = -e.fallDir * e.tiltAngle;
    }
    // === rotation.x の用途分岐（優先順位：寝姿勢 > バースト累積 > pitch system > リセット）===
    // ZYX 順なので rx と rz が独立に作用する（YXZ/XYZ だと両方非ゼロで奇妙な傾きになる）
    // pitch system の対象外ステートでは rx を 0 に固定して z-tilt の純粋な見た目を維持
    if (e.state === STATE.down_burst_start || e.state === STATE.down_burst_loop) {
      // バースト離脱中：rotation.x は上の累積回転を保持（リセットしない）
      // pitchAngle は同期しない（次の状態でリセットされる）
    } else if (e.state === STATE.down_roll_start || e.state === STATE.down_roll_loop) {
      // 転がり中：rotation.x を rollDebugAngle で直接駆動（後方ごろごろ・2026-05-18）
      e.mesh.rotation.x = e.rollDebugAngle;
      e.pitchAngle = 0;
    } else if (e.state === STATE.down_rakka_start ||
        e.state === STATE.down_rakka_loop ||
        e.state === STATE.down_bound_start) {
      // あおむけ姿勢（lv05 系）：X 軸で背中を下に向ける
      e.mesh.rotation.x = -Math.PI / 2;
      e.pitchAngle = 0;
    } else if (e.state === STATE.enemy_attacking) {
      // 攻撃モーション（14-D）：atkPhase 別に設定した atkPitchTarget へ前後傾を補間。
      //   wind=溜めの予兆／active=前傾の踏み込み（active 突入で即スナップ済）／recover=直立へ。
      e.pitchAngle += (e.atkPitchTarget - e.pitchAngle) * STATE_PITCH_LERP;
      e.mesh.rotation.x = e.pitchAngle;
    } else if (STATE_PITCH_TARGET[e.state] !== undefined) {
      // pitch system 対象ステート（knockback01/02/_air01）：rx 駆動の前後傾
      const pitchTarget = STATE_PITCH_TARGET[e.state];
      e.pitchAngle += (pitchTarget - e.pitchAngle) * STATE_PITCH_LERP;
      e.mesh.rotation.x = e.pitchAngle;
    } else {
      // それ以外（down_front_* / down_up_* / wait01 など）：rx は即 0 にして
      // rotation.z の傾きを純粋に見せる
      e.pitchAngle = 0;
      e.mesh.rotation.x = 0;
    }

    // ボス専用：腕ピボットアニメーション + AOE 表示管理（攻撃フェーズ別）
    if (e.isBoss) { _updateBossAnim(e); _updateBossAoe(e); _updateBossCollision(e); }

    // キャラ単独シェイク：mesh.x にジグザグ offset（カメラ非影響・スマブラ風）
    //   triggerCharShake() で _charShakeTimer / _charShakeAmp が立つ。
    //   ピーク振幅から線形減衰しながら左右反転（時間と共に振幅が落ち、最後 0 で解除）。
    let _eShakeOffsetX = 0;
    if ((e._charShakeTimer ?? 0) > 0) {
      e._charShakeTimer--;
      const _t   = e._charShakeTimer;
      const _amp = e._charShakeAmp ?? 8;
      const _peak = Math.max(1, _amp);
      _eShakeOffsetX = (_t % 2 === 0 ? 1 : -1) * (_t / 8) * _peak;
    }
    // 転がり中は腰ピボット補正（敵・プレイヤー共用ヘルパ）。それ以外は素の座標。
    if (e.state === STATE.down_roll_start || e.state === STATE.down_roll_loop) {
      applyRollHipPivot(e.mesh, e.x, e.y, e.z, e.rollDebugAngle);
    } else {
      // 転がり以外の状態：オフセット解除（前フレームの補正値が残らないよう毎フレーム正規化）
      e.mesh.position.x = e.x + _eShakeOffsetX;
      e.mesh.position.y = e.y;
      e.mesh.position.z = e.z;
    }

    // ヒットフラッシュ（敵種ごとの元色を mesh.userData.baseColors から取得）
    //   detach 済（parent !== e.mesh）の part には書き込まない
    //   → MeshBasicMaterial(0x000000) で上書き済の飛翔中パーツが元色に戻るのを防止
    const _body = e.mesh.userData.parts.body;
    const _head = e.mesh.userData.parts.head;
    const _bodyAtt = _body && _body.parent === e.mesh;
    const _headAtt = _head && _head.parent === e.mesh;
    const _bc = e.mesh.userData.baseColors ?? { body: 0x2d4a22, head: 0x77aa55 };
    const _bR = ((_bc.body >> 16) & 0xff) / 255;
    const _bG = ((_bc.body >>  8) & 0xff) / 255;
    const _bB = ( _bc.body        & 0xff) / 255;
    const _hR = ((_bc.head >> 16) & 0xff) / 255;
    const _hG = ((_bc.head >>  8) & 0xff) / 255;
    const _hB = ( _bc.head        & 0xff) / 255;
    // state が enemy_attacking 外なら chargeT を強制クリア（地雷等の非ヒット経由 KB で
    // 黄色予兆色が残り続けるバグ修正・2026-05-28）。
    //   旧実装は hitFlashTimer > 0 のときしか chargeT を消していなかったため、
    //   プレイヤー攻撃以外の damage（地雷 AOE 等）で KB された時に色が残った。
    if (e._chargeT > 0 && e.state !== STATE.enemy_attacking) {
      e._chargeT = 0;
    }
    if (e.hitFlashTimer > 0) {
      e.hitFlashTimer--;
      // 被弾した瞬間にチャージ発光をキャンセル
      if (e._chargeT > 0) e._chargeT = 0;
      const t = e.hitFlashTimer / 7;  // 1→0（白 → 元色）
      if (_bodyAtt) _body.material.color.setRGB(_bR + t*(1-_bR), _bG + t*(1-_bG), _bB + t*(1-_bB));
      if (_headAtt) _head.material.color.setRGB(_hR + t*(1-_hR), _hG + t*(1-_hG), _hB + t*(1-_hB));
    } else if (e.enraged && !e.dying) {
      // berserker enraged: キャラ全体を赤く発光（50% 強度・脈動）
      const _pulse = 0.45 + Math.sin(e._tick * 0.12) * 0.13;  // 0.32～0.58 で脈動
      if (_bodyAtt) _body.material.color.setRGB(
        _bR * (1 - _pulse) + _pulse, _bG * (1 - _pulse), _bB * (1 - _pulse));
      if (_headAtt) _head.material.color.setRGB(
        _hR * (1 - _pulse) + _pulse, _hG * (1 - _pulse), _hB * (1 - _pulse));
    } else {
      if (_bodyAtt) _body.material.color.setHex(_bc.body);
      if (_headAtt) _head.material.color.setHex(_bc.head);
    }
    // チャージ発光が active な場合は hitFlash の上書きを戻す（最後に書いて勝つ）
    if (e._chargeT > 0) _setMeshChargeColor(e, e._chargeT);
    // SA 吸収フラッシュ（2026-05-28）：軽く白く光る・残量に応じて減衰
    if ((e._saFlashTimer ?? 0) > 0) {
      e._saFlashTimer--;
      const _t = Math.min(0.7, e._saFlashTimer / 12 * 0.7);  // ピーク 0.7 で「軽く白」
      _setMeshChargeColor(e, _t, 0xffffff);
    }
    // ボススタン中の黒点滅も同じく毎フレーム再適用（hitFlash 等で base color に戻された後）
    //   フィニッシュ RC 後の knockback02 + bossStun 中、視覚的にスタン状態を明示
    if (e.bossStun && (e.bossStunTimer ?? 0) > 0) {
      const _pSpeed  = BOSS01_CONFIG.STUN_PULSE_SPEED   ?? 0.045;
      const _pMax    = BOSS01_CONFIG.STUN_PULSE_OPACITY ?? 0.30;
      const _pFactor = _pMax * (0.5 + 0.5 * Math.sin((e._bossStunFrame ?? 0) * _pSpeed));
      _setMeshChargeColor(e, _pFactor, 0x000000);
    }
    // フェイタル中：真っ黒フェードを最終適用（bossStun pulse を上書きしてシルエット完成）
    //   bossStun との競合：bossStun は毎フレーム base color 復元後に弱い pulse を被せるため、
    //   ここで強い fade を再適用しないと黒くならない。
    if (e.bossFatal && !e.dying) {
      _setMeshChargeColor(e, e._bossFatalFadeProgress ?? 0, 0x000000);
    }

    // きりもみやられ突入フラッシュ：紫を「乗算」で body/head 色に被せる
    //   元色 × 紫 (0x6622ff) を t=1 とし、t=0 で元色へフェード復帰（敵種別色対応）
    if (e.burstFlashTimer > 0) {
      e.burstFlashTimer--;
      const t = e.burstFlashTimer / ENEMY_BURST_FLASH_FRAMES;
      const bMr = _bR * PURPLE_R, bMg = _bG * PURPLE_G, bMb = _bB * PURPLE_B;
      const hMr = _hR * PURPLE_R, hMg = _hG * PURPLE_G, hMb = _hB * PURPLE_B;
      if (_bodyAtt) _body.material.color.setRGB(
        _bR + (bMr - _bR) * t, _bG + (bMg - _bG) * t, _bB + (bMb - _bB) * t,
      );
      if (_headAtt) _head.material.color.setRGB(
        _hR + (hMr - _hR) * t, _hG + (hMg - _hG) * t, _hB + (hMb - _hB) * t,
      );
      e._burstFlashWasOn = true;
    } else if (e._burstFlashWasOn) {
      e._burstFlashWasOn = false;
    }
    // Phase 3：dying 色オーバーライ（毎フレーム最後・hitFlash/burstFlash 結果を黒へ lerp）
    if (e.dying && e.dyingPhase !== 'exploded') _applyDyingColorOverride(e);
    // Phase 3：爆発直前の白フラッシュ（final/burst の最後 N フレーム）
    if (e.dying
        && (e.dyingPhase === 'final' || e.dyingPhase === 'burst')
        && e.dyingFinalTimer > 0
        && e.dyingFinalTimer <= GORE_CONFIG.PREEXPLODE_FLASH_FRAMES) {
      _applyPreExplodeFlash(e);
    }
    // ゴア・クリティカル：crit_white フェーズ中は同じヘルパで白に上書き
    if (e.goreCritical && e.goreCritical.armed && e.goreCritical.phase === 'crit_white') {
      _applyPreExplodeFlash(e);
    }
    // === HP バー同期（2026-05-18）===
    // 初回被弾検出：hp < maxHp になったら shown=true（dying でない時のみ）
    // 位置：敵 (x, y+yOffset, z) に bg と fill を配置
    // フィル：scale.x = hp/maxHp（左端アンカーで右端だけ shrink）
    // visibility：shown && !dying
    const hpBar = e.mesh && e.mesh.userData && e.mesh.userData.hpBar;
    if (hpBar) {
      if (!e.hpBarShown && e.hp < e.maxHp && !e.dying) {
        e.hpBarShown = true;
      }
      const visible = e.hpBarShown && !e.dying && !e.removed;
      hpBar.bg.visible = visible;
      hpBar.fill.visible = visible;
      if (visible) {
        const by = e.y + hpBar.yOffset;
        hpBar.bg.position.set(e.x, by, e.z);
        // fill の左端 = bg の左端（geometry origin が左端なので position.x は左端ワールド座標）
        hpBar.fill.position.set(e.x - hpBar.fullWidth / 2, by, e.z + 0.5);
        hpBar.fill.scale.x = Math.max(0, Math.min(1, e.hp / e.maxHp));
      }
    }
    // フレームカウンタ（赤点滅・赤発光パルスの周期計算用）
    e._tick = ((e._tick ?? 0) + 1) | 0;
    if ((e.slashHitFlash ?? 0) > 0) e.slashHitFlash--;
    // 盾ブロックカウント自然減衰（90F 間ブロックがなければリセット）
    if (e.enemyType === 'midboss01' && !e.shieldBroken && (e.shieldBlockCount ?? 0) > 0) {
      e._blockDecayTimer = (e._blockDecayTimer ?? 0) + 1;
      if (e._blockDecayTimer >= 90) { e.shieldBlockCount = 0; e._blockDecayTimer = 0; }
    }

    // midboss01 盾 HP 低下時の赤点滅（50% 以下から開始・HP ゼロに近いほど高速）
    const _shMesh = !e.shieldBroken && e.mesh && e.mesh.userData.shield;
    if (_shMesh) {
      if (e.shieldHp < (e.shieldMaxHp ?? 60) * 0.5) {
        const _ratio = e.shieldHp / (e.shieldMaxHp ?? 60);
        const _period = Math.max(4, Math.round(4 + _ratio * 28));  // HP0=4F, 50%=18F
        const _blink  = (e._tick % _period) < Math.round(_period * 0.45);
        _shMesh.material.color.setHex(_blink ? 0xff3333 : 0xaaaaaa);
      } else {
        _shMesh.material.color.setHex(0xaaaaaa);  // 通常色（明グレー）
      }
      // ガード時に盾を前に出す（local +Z = 向き方向に押し出す）
      _shMesh.position.z = ((e.shieldBlockTimer ?? 0) > 0) ? 20 : 0;
    }

    // midboss01 ガードドーム（通常ガード＝青 / SHIELD BREAK 拡大フェード＝白）
    const _dome = e.mesh && e.mesh.userData.guardDome;
    if (_dome) {
      if ((e.shieldBreakDomeTimer ?? 0) > 0) {
        // SHIELD BREAK: プレイヤーのガードクラッシュと同系の白拡大フェード
        e.shieldBreakDomeTimer--;
        const _t = e.shieldBreakDomeTimer / 18;
        _dome.visible = true;
        _dome.position.set(e.x, e.y + 100, e.z);
        _dome.rotation.y = (e.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
        _dome.scale.setScalar(1 + (1 - _t) * 0.9);
        _dome.material.color.setHex(0xffffff);
        _dome.material.opacity = _t * 0.85;
      } else if ((e.shieldBlockTimer ?? 0) > 0) {
        // 通常ガード: 青ドーム（プレイヤーのガードシールドと同色）
        e.shieldBlockTimer--;
        _dome.visible = true;
        _dome.position.set(e.x, e.y + 100, e.z);
        _dome.rotation.y = (e.facing > 0) ? Math.PI * 0.5 : -Math.PI * 0.5;
        _dome.scale.setScalar(1);
        _dome.material.color.setHex(0x66ccff);
        _dome.material.opacity = 0.30;
      } else {
        _dome.visible = false;
      }
    }
  }
  // Phase 3-A：cleanup pass — フェード完了で removed=true の敵を scene + 配列から除去
  //   Phase 3-B（2026-05-20）：mortal モードなら同じ位置に即リスポーン
  const _respawnQueue = [];
  for (let i = _enemies.length - 1; i >= 0; i--) {
    if (_enemies[i].removed) {
      const dead = _enemies[i];
      _removeJdMarkers(dead);   // 照準マーカーが残っていれば除去
      if (dead.mesh) _scene.remove(dead.mesh);
      // HP バー meshes も scene から除去（mesh の子ではないため自動消去されない）
      const _hpBar = dead.mesh && dead.mesh.userData && dead.mesh.userData.hpBar;
      if (_hpBar) {
        if (_hpBar.bg && _hpBar.bg.parent) _hpBar.bg.parent.remove(_hpBar.bg);
        if (_hpBar.fill && _hpBar.fill.parent) _hpBar.fill.parent.remove(_hpBar.fill);
      }
      const _gdome = dead.mesh && dead.mesh.userData && dead.mesh.userData.guardDome;
      if (_gdome && _gdome.parent) _gdome.parent.remove(_gdome);
      // mortal モード時：元の spawn 位置に同条件で復活させる（HP は _spawnOpts.maxHp に従う）
      if (window.SB && window.SB.MORTAL_MODE && dead._spawnX !== undefined) {
        _respawnQueue.push({ x: dead._spawnX, z: dead._spawnZ, opts: dead._spawnOpts });
      }
      _enemies.splice(i, 1);
    }
  }
  for (const r of _respawnQueue) {
    spawnDummy(r.x, r.z, r.opts);
  }
}

// 紫乗算定数：0x6622ff の RGB ノーマライズ値
const PURPLE_R = 0x66 / 255;  // ≈ 0.40
const PURPLE_G = 0x22 / 255;  // ≈ 0.13
const PURPLE_B = 0xff / 255;  // 1.00
// きりもみフラッシュ持続：プレイヤー必殺技のフラッシュ（12F）の 1.5 倍
const ENEMY_BURST_FLASH_FRAMES = Math.round(SPECIAL_CONFIG.FLASH_FRAMES * 1.5);
