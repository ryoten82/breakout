// 壊れ物（crate / canister）の破壊システム
//
// 種別：
// - crate（箱型）：ヒット即爆散
// - canister（ガスボンベ）：環境効果型・ヒットで点火 → 2 秒カウントダウン（赤明滅・頻度↑）
//   → 爆発で範囲 400wu 内の敵・プレイヤーに 50 ダメージ + ヒットストップ + パーツ飛び散り
//
// 物理：1 バウンド → 着地と同時にフェード開始（18F）→ 除去
// 重力は gs より弱め（0.5）でふわっと飛ばす

import { GORE_CONFIG } from './config.js';
import { STATE, ENEMY_FALL_FRAMES, EXPLOSION_LAUNCH_VY } from './states.js';

// 物理：壊れ物パーツは gs より「軽く・短く」収まる肌感
const GRAVITY      = 0.5;                                        // gs の PART_GRAVITY=0.7 より弱く
const FLOOR_BOUNCE = GORE_CONFIG.PART_BOUNCE_DAMP;               // 0.45（gs と同じ）
const FADE_FRAMES  = GORE_CONFIG.PART_FADE_AFTER_BOUNCE;         // 18F（gs と同じ）
const FLOOR_Y = 0;

// canister の爆発パラメータ
const FUSE_FRAMES        = 120;   // 点火 → 爆発までの時間（2 秒）
const CANISTER_IGNITE_VY = 12;    // 点火時の小ジャンプ初速（≒ ↑J 食らった程度）
const EXPLOSION_RANGE    = 400;   // AoE 半径
const EXPLOSION_DAMAGE   = 50;    // 敵・プレイヤー共通ダメージ
const EXPLOSION_HITSTOP  = 12;    // 爆発時のヒットストップ
const FUSE_BLINK_MIN     = 2;     // 爆発直前の点滅周期（F）
const FUSE_BLINK_MAX     = 12;    // 点火直後の点滅周期（F）
const PROXIMITY_TRIGGER_RANGE = 400;  // 地雷モード：プレイヤー接近で点火する半径（爆発範囲と同値）
const PROXIMITY_TRIGGER_RANGE_SQ = PROXIMITY_TRIGGER_RANGE * PROXIMITY_TRIGGER_RANGE;  // 毎フレーム判定用（sqrt 回避）
// 攻撃ヒット時の壊れ物用ヒットストップ（attack.hitstop が無い場合のフォールバック）
const HIT_DEFAULT_HITSTOP = 6;
// 複数 hp 壊れ物（OC コンテナ等）：1 ヒット登録ごとの無敵 F。
//   tryHitBreakables は攻撃の hit 窓中ほぼ毎フレーム呼ばれるため、
//   これが無いと 1 振りで hp を一気に削り切ってしまう。連撃の間隔より短く取る。
const MULTIHIT_HIT_COOLDOWN = 16;
const MULTIHIT_FLASH_FRAMES = 5;   // 非致命ヒット時の白フラッシュ F
const MULTIHIT_BOUNCE_VY    = 7;   // 非致命ヒット時の軽い跳ね初速

const breakables = [];
const flyingParts = [];
// 爆発後リスポーン待ち（{ factory, timer }）。userData.respawn 指定の breakable 用。
const _respawnQueue = [];

let _scene = null;
let _THREE = null;
let _vec3Tmp = null;
// 依存注入：ヒットストップ・ダメージ・kill 経路 + damage-area 可視化（循環 import 回避）
let _triggerHitstop = null;
let _damagePlayer = null;
let _killEnemy = null;
let _enemies = null;
let _players = null;
let _damageArea = null;  // { addStaticArea, updateAreaPosition, removeArea, spawnExpandPulse }
let _isHitstunState = null;  // 被弾中判定（proximity 点火を被弾中プレイヤーで誘発させないため）
let _onOcContainerBreak = null;  // OC コンテナ破壊時コールバック（x, y, z）
let _onContainerLoot = null;     // crate / 非地雷 canister 破壊時コールバック
                                 //   (kind, x, y, z, lootOverride, lootTable)
                                 // lootOverride：確定ドロップ指定（item-system.js dropItem の kind 文字列）
                                 // lootTable：CONTAINER_LOOT_TABLE のキー（'pre_boss_hp' 等の専用抽選）
                                 // どちらも null なら kind 既定テーブルで抽選。両方ある時は lootOverride 優先。

export function initBreakables({ scene, THREE, triggerHitstop, damagePlayer, killEnemy, enemies, players, damageArea, isHitstunState, onOcContainerBreak, onContainerLoot }) {
  _scene = scene;
  _THREE = THREE;
  _vec3Tmp = new THREE.Vector3();
  _triggerHitstop = triggerHitstop || null;
  _damagePlayer   = damagePlayer || null;
  _killEnemy      = killEnemy || null;
  _enemies        = enemies || null;
  _players        = players || null;
  _damageArea     = damageArea || null;
  _isHitstunState = isHitstunState || null;
  _onOcContainerBreak = onOcContainerBreak || null;
  _onContainerLoot    = onContainerLoot || null;
}

// 配置済の mesh（group）を破壊可能オブジェクトとして登録する
export function registerBreakable(mesh) {
  mesh.userData = mesh.userData || {};
  // hp は factory 側で事前指定があれば尊重（OC コンテナ等の複数ヒット）。未指定は 1。
  mesh.userData.hp = mesh.userData.hp || 1;
  mesh.userData.hitCooldown   = 0;   // 複数 hp 用：ヒット登録後の無敵 F
  mesh.userData.hitFlashTimer = 0;   // 非致命ヒットの白フラッシュ残 F
  mesh.userData.alive = true;
  mesh.userData.dying = false;
  mesh.userData.aabb = _computeAABB(mesh);
  // canister は爆発タイプ：点火カウントダウンを経て爆発
  mesh.userData.isExplosive = (mesh.userData.kind === 'breakable-canister');
  mesh.userData.fuseTimer = 0;
  // 物理：点火時の小ジャンプ用（mesh 全体の vy）
  mesh.userData.vy = 0;
  mesh.userData.groundY = mesh.position.y;
  // 元色の保存（赤明滅の lerp で参照）
  mesh.userData.origColors = new Map();
  mesh.traverse(c => {
    if (c.material && c.material.color) {
      mesh.userData.origColors.set(c.material, c.material.color.getHex());
    }
  });
  breakables.push(mesh);
}

export function getBreakables() { return breakables; }
export function getFlyingPartsCount() { return flyingParts.length; }

// 外部（敵の衝突など）からの強制ヒット：プレイヤー attack を介さずに破壊シーケンスを開始
// 既に dying なら何もしない。AABB 内のチェックなしで「当たり前提」で呼ぶ
export function hitBreakableExternal(mesh, opts = {}) {
  if (!mesh || !mesh.userData) return false;
  if (!mesh.userData.alive || mesh.userData.dying) return false;
  if (!breakables.includes(mesh)) return false;
  const hit = _applyBreakableHit(mesh);
  if (hit && opts.hitstop && _triggerHitstop) _triggerHitstop(opts.hitstop);
  return hit;
}

// AABB 矩形での 1 個衝突判定（mover の位置・半径から見て一番近い壊れ物を返す）
// 衝突しなかったら null。mover は敵 e（{x, y, z}）等の最小インタフェース
export function findBreakableHitBy(x, y, z, radiusX = 60, radiusY = 80, radiusZ = 50) {
  for (const b of breakables) {
    if (!b.userData.alive || b.userData.dying) continue;
    const dx = Math.abs(b.position.x - x);
    const dy = Math.abs((b.position.y + b.userData.aabb.hh) - y);
    const dz = Math.abs(b.position.z - z);
    if (dx > radiusX + b.userData.aabb.hw) continue;
    if (dy > radiusY + b.userData.aabb.hh) continue;
    if (dz > radiusZ + b.userData.aabb.hd) continue;
    return b;
  }
  return null;
}

function _computeAABB(mesh) {
  const s = mesh.userData?.size || {};
  // box（w,h,d）/ cylinder（r,h）どちらにも対応
  const hw = s.w != null ? s.w / 2 : (s.r != null ? s.r : 30);
  const hh = s.h != null ? s.h / 2 : 40;
  const hd = s.d != null ? s.d / 2 : (s.r != null ? s.r : 30);
  return { hw, hh, hd };
}

// === ヒット判定 ===
// 攻撃発火時に hit-engine から呼ばれる：プレイヤー p と attack の range で AABB 矩形ヒット判定
// 当たった breakable を破壊シーケンスへ。攻撃ヒット時と同じヒットストップも仕掛ける
// 戻り値：当たったかどうか
export function tryHitBreakables(p, attack) {
  if (!breakables.length) return false;
  let any = false;
  const facing = p.facing;
  for (const b of breakables) {
    // 既に点火中（fuseTimer 動作中）でも追加ヒットは無視
    if (!b.userData.alive || b.userData.dying) continue;
    const dx = b.position.x - p.x;
    const dz = b.position.z - p.z;
    const bCenterY = b.position.y + b.userData.aabb.hh;
    const dy = bCenterY - p.y;
    // 前方判定（omni 攻撃は全方向）
    if (!attack.omni && Math.sign(dx) === -facing && Math.abs(dx) > 1) continue;
    // range チェック（attack.rangeX/Y/Z はプレイヤー中心の半幅）
    const xReach = attack.rangeX + b.userData.aabb.hw;
    const zReach = attack.rangeZ + b.userData.aabb.hd;
    if (Math.abs(dx) > xReach) continue;
    if (Math.abs(dz) > zReach) continue;
    if (attack.rangeY !== undefined) {
      const maxDown = attack.rangeYDown ?? attack.rangeY;
      const yReachUp = attack.rangeY + b.userData.aabb.hh;
      const yReachDn = maxDown + b.userData.aabb.hh;
      if (dy >  yReachUp) continue;
      if (dy < -yReachDn) continue;
    }
    if (_applyBreakableHit(b)) any = true;
  }
  // ヒットストップ：1 つでも当たれば攻撃側 hitstop（or 既定 6F）を発火
  if (any && _triggerHitstop) {
    _triggerHitstop(attack.hitstop ?? HIT_DEFAULT_HITSTOP);
  }
  return any;
}

// 壊れ物への 1 ヒット適用。hp>1 は非致命（減算・軽い跳ね・白フラッシュ・無敵 F）、
// hp が尽きたら破壊シーケンスへ。戻り値＝ヒットが登録されたか。
function _applyBreakableHit(mesh) {
  if (!mesh.userData.alive || mesh.userData.dying) return false;
  if (mesh.userData.hitCooldown > 0) return false;   // 同一攻撃の連続フレームを弾く
  if (mesh.userData.hp > 1) {
    mesh.userData.hp--;
    mesh.userData.hitCooldown   = MULTIHIT_HIT_COOLDOWN;
    mesh.userData.hitFlashTimer = MULTIHIT_FLASH_FRAMES;
    mesh.userData.vy            = MULTIHIT_BOUNCE_VY;
    return true;
  }
  _startBreakSequence(mesh);
  return true;
}

// 爆発予告：jump_dive と同じ二重 AOE リング（地面平行）を生成する。
// 一次 AOE（固定サイズ赤リング）: 爆発半径を常時表示。
// 二次リング（収束オレンジ）: fuse 残量に応じてスケール 2.0→1.0・不透明度↑。
function _spawnExplosionRings(mesh) {
  if (!_scene || !_THREE) return;
  const cx = mesh.position.x;
  const cz = mesh.position.z;
  const r  = EXPLOSION_RANGE;

  // 一次 AOE：固定サイズ赤リング
  const aoeMat = new _THREE.MeshBasicMaterial({
    color: 0xff2200, transparent: true, opacity: 0.55, side: _THREE.DoubleSide, depthWrite: false,
  });
  const aoeMesh = new _THREE.Mesh(new _THREE.RingGeometry(r * 0.82, r, 48), aoeMat);
  aoeMesh.rotation.x = -Math.PI / 2;
  aoeMesh.position.set(cx, 1, cz);
  _scene.add(aoeMesh);
  mesh.userData._explosionAoeRing = aoeMesh;

  // 二次リング：内側（小）から外側（AOE端）へ拡大するオレンジ
  const warnMat = new _THREE.MeshBasicMaterial({
    color: 0xff6600, transparent: true, opacity: 0.20, side: _THREE.DoubleSide, depthWrite: false,
  });
  const warnMesh = new _THREE.Mesh(new _THREE.RingGeometry(r * 0.80, r, 48), warnMat);
  warnMesh.rotation.x = -Math.PI / 2;
  warnMesh.scale.setScalar(0.05);  // 内側（小）から拡大開始
  warnMesh.position.set(cx, 1, cz);
  _scene.add(warnMesh);
  mesh.userData._explosionWarnRing = warnMesh;
}

function _removeExplosionRings(mesh) {
  for (const key of ['_explosionAoeRing', '_explosionWarnRing']) {
    const m = mesh.userData[key];
    if (m) {
      _scene.remove(m);
      m.geometry?.dispose();
      m.material?.dispose();
      mesh.userData[key] = null;
    }
  }
}

function _startBreakSequence(mesh) {
  mesh.userData.dying = true;
  if (mesh.userData.isExplosive) {
    // canister：点火カウントダウン開始（爆散は爆発時 _explode で）
    mesh.userData.fuseTimer = FUSE_FRAMES;
    // 点火の瞬間にちょこっと跳ねる（↑J 食らったくらいの軽い vy）
    mesh.userData.vy = CANISTER_IGNITE_VY;
    // 二重 AOE リング（jump_dive と同じスタイル）
    _spawnExplosionRings(mesh);
  } else {
    // crate：即爆散
    _detonate(mesh);
  }
}

// 赤明滅：k=0 で元色 / k=1 で純赤に lerp
function _setRedTint(mesh, k) {
  const origMap = mesh.userData.origColors;
  if (!origMap) return;
  // k は周期内で一定（赤 0.85 / 元色 0.0 を period F ごとに切替）。
  // 同じ k の再適用は traverse を丸ごと省ける。
  if (mesh.userData._lastTintK === k) return;
  mesh.userData._lastTintK = k;
  mesh.traverse(c => {
    if (!c.material || !c.material.color) return;
    const orig = origMap.get(c.material);
    if (orig == null) return;
    const oR = ((orig >> 16) & 0xff) / 255;
    const oG = ((orig >>  8) & 0xff) / 255;
    const oB = ( orig        & 0xff) / 255;
    // 純赤 (1.0, 0.05, 0.05)
    c.material.color.setRGB(
      oR + (1.0  - oR) * k,
      oG + (0.05 - oG) * k,
      oB + (0.05 - oB) * k,
    );
  });
}

// 白フラッシュ：k=0 で元色 / k=1 で純白に lerp（複数 hp 壊れ物の非致命ヒット用）
function _setWhiteTint(mesh, k) {
  const origMap = mesh.userData.origColors;
  if (!origMap) return;
  mesh.traverse(c => {
    if (!c.material || !c.material.color) return;
    const orig = origMap.get(c.material);
    if (orig == null) return;
    const oR = ((orig >> 16) & 0xff) / 255;
    const oG = ((orig >>  8) & 0xff) / 255;
    const oB = ( orig        & 0xff) / 255;
    c.material.color.setRGB(
      oR + (1.0 - oR) * k,
      oG + (1.0 - oG) * k,
      oB + (1.0 - oB) * k,
    );
  });
}

// fuse 進行：残り時間に応じて点滅周期を短縮、0 で爆発
function _updateFuse(mesh) {
  const ud = mesh.userData;
  if (ud.fuseTimer <= 0) return;
  ud.fuseTimer--;
  if (ud.fuseTimer === 0) {
    _explode(mesh);
    return;
  }
  // 残り時間比 t: 1（点火直後）→ 0（爆発直前）
  const t = ud.fuseTimer / FUSE_FRAMES;
  // 点滅周期：t=1 で MAX(12F)、t=0 で MIN(2F)
  const period = Math.max(FUSE_BLINK_MIN, Math.round(FUSE_BLINK_MIN + t * (FUSE_BLINK_MAX - FUSE_BLINK_MIN)));
  // 周期内で前半=赤 / 後半=元色
  const phase = Math.floor(ud.fuseTimer / period) % 2;
  _setRedTint(mesh, phase === 0 ? 0.85 : 0.0);
  // 拡大リング：内側(0.05)→端(1.0)、不透明度 0.20→0.75
  if (ud._explosionWarnRing) {
    ud._explosionWarnRing.scale.setScalar(0.05 + (1 - t) * 0.95);
    ud._explosionWarnRing.material.opacity = 0.20 + (1 - t) * 0.55;
  }
}

// 爆発：AoE で敵・プレイヤーにダメージ + ヒットストップ + 爆散
function _explode(mesh) {
  const cx = mesh.position.x;
  const cy = mesh.position.y + (mesh.userData.aabb?.hh ?? 50);
  const cz = mesh.position.z;
  // 爆発ダメージは個体上書き可（デバッグ地雷など）。未指定は通常値。
  const dmg = mesh.userData.explosionDamage ?? EXPLOSION_DAMAGE;
  // 敵
  if (_enemies) {
    for (const e of _enemies) {
      if (!e || !e.isAlive) continue;
      if (e.dying) continue;
      const dx = e.x - cx;
      const dy = (e.y || 0) - cy;
      const dz = (e.z || 0) - cz;
      if (Math.hypot(dx, dy, dz) > EXPLOSION_RANGE) continue;
      e.hp = Math.max(0, e.hp - dmg);
      if (e.hp <= 0 && _killEnemy) {
        _killEnemy(e);
      } else {
        // 生存敵は lv4 打ち上げ（player 側と同等の挙動・敵 down_up_* state machine に委譲）
        const dir = (dx >= 0) ? 1 : -1;          // 爆発中心から見た敵の側（+ なら右にいる）
        e.vy           = 18;
        e.knockbackVx  = dir * 6;
        e.fallDir      = dir;
        e.launcherAirborne = false;
        e.state        = STATE.down_up_start;
        e.downTimer    = ENEMY_FALL_FRAMES;
        // 爆心側を向く（ボンベを攻撃源として facing を強制）
        e.facing = -dir;
        if (e.mesh) e.mesh.rotation.y = e.facing * Math.PI / 2;
      }
    }
  }
  // プレイヤー
  if (_players && _damagePlayer) {
    for (const p of _players) {
      if (!p || !p.mesh) continue;
      const dx = p.x - cx;
      const dy = (p.y || 0) - cy;
      const dz = (p.z || 0) - cz;
      if (Math.hypot(dx, dy, dz) > EXPLOSION_RANGE) continue;
      // damagePlayer 用に最小限の attack オブジェクトと source を用意。
      // testAtkLv が指定された個体（被弾 state テスト用デバッグ地雷）はその lv で被弾させる。
      const atkLv = mesh.userData.testAtkLv ?? 4;
      _damagePlayer(
        p,
        { damage: dmg, atk_lv: atkLv, knockback: 30, launchVy: EXPLOSION_LAUNCH_VY },
        { x: cx, y: cy, z: cz },
      );
    }
  }
  // ヒットストップ（爆発の重み）
  if (_triggerHitstop) _triggerHitstop(EXPLOSION_HITSTOP);
  // 二重 AOE リング除去 + 拡張パルス
  _removeExplosionRings(mesh);
  if (_damageArea?.spawnExpandPulse) {
    _damageArea.spawnExpandPulse({
      x: cx, y: 0, z: cz,
      radius: EXPLOSION_RANGE,
      color: 0xffaa33,
      opacity: 0.85,
      life: 16,
    });
  }
  // パーツ爆散（爆発の散らかし）
  _detonate(mesh);
}

// 子パーツを爆散させる
function _detonate(mesh) {
  const groupX = mesh.position.x;
  const groupY = mesh.position.y;
  const groupZ = mesh.position.z;
  // 子要素を借りる（配列コピーで iterate 中の add 競合回避）
  const children = [...mesh.children];
  for (const child of children) {
    // world 座標を取って scene 直下へ移管
    child.getWorldPosition(_vec3Tmp);
    mesh.remove(child);
    child.position.copy(_vec3Tmp);
    _scene.add(child);
    // 中心からの向き
    const lx = child.position.x - groupX;
    const lz = child.position.z - groupZ;
    const lenH = Math.hypot(lx, lz) || 0.001;
    const dirX = lx / lenH;
    const dirZ = lz / lenH;
    // 速度（中心から外向き + 上向き + ランダムジッタ）
    const speedH = 4 + Math.random() * 5;
    const speedV = 9 + Math.random() * 7;
    flyingParts.push({
      mesh: child,
      vx: dirX * speedH + (Math.random() - 0.5) * 3,
      vy: speedV,
      vz: dirZ * speedH + (Math.random() - 0.5) * 3,
      rotX: (Math.random() - 0.5) * 0.45,
      rotY: (Math.random() - 0.5) * 0.45,
      rotZ: (Math.random() - 0.5) * 0.45,
      // gs と同じバウンド・フェード進行：bounced 経由 → settled でフェード開始
      bounced: false,
      settled: false,
      fadeTimer: 0,
    });
  }
  _scene.remove(mesh);
  mesh.userData.alive = false;
  const idx = breakables.indexOf(mesh);
  if (idx >= 0) breakables.splice(idx, 1);
  // リスポーン指定（デバッグ地雷）：一定F後に factory で再生成
  const rs = mesh.userData.respawn;
  if (rs && typeof rs.factory === 'function') {
    _respawnQueue.push({ factory: rs.factory, timer: rs.delayFrames ?? 180 });
  }
  // OC コンテナ：破壊位置に OC ジェムを出現させる
  if (mesh.userData.kind === 'breakable-oc-container' && _onOcContainerBreak) {
    _onOcContainerBreak(groupX, groupY, groupZ);
  }
  // crate / 非地雷 canister：戦利品（CR コイン等）をドロップ。地雷は proximityTrigger で除外
  // lootOverride / lootTable：placeBreakables 経由で mesh.userData にセット済みなら配線側で利用
  if (_onContainerLoot) {
    const lootOverride = mesh.userData.lootOverride || null;
    const lootTable    = mesh.userData.lootTable    || null;
    if (mesh.userData.kind === 'breakable-crate') {
      _onContainerLoot('crate', groupX, groupY, groupZ, lootOverride, lootTable);
    } else if (mesh.userData.kind === 'breakable-canister' && !mesh.userData.proximityTrigger) {
      _onContainerLoot('canister', groupX, groupY, groupZ, lootOverride, lootTable);
    }
  }
}

// 毎フレーム呼ばれる：fuse 進行 + mesh 物理（点火ジャンプ） + 飛び散りパーツ物理
export function updateBreakables() {
  // canister の点火カウントダウン + 点火直後の小ジャンプ物理
  for (const b of breakables) {
    // 複数 hp 壊れ物：ヒット無敵 F の消化 + 非致命ヒットの白フラッシュ進行
    if (b.userData.hitCooldown > 0) b.userData.hitCooldown--;
    if (b.userData.hitFlashTimer > 0) {
      b.userData.hitFlashTimer--;
      const fk = b.userData.hitFlashTimer / MULTIHIT_FLASH_FRAMES;  // 1→0
      _setWhiteTint(b, b.userData.hitFlashTimer > 0 ? fk * 0.85 : 0);
    }
    // 地雷モード：未点火 canister のうち proximityTrigger フラグ持ちは
    //   プレイヤーが範囲外 → 範囲内に「入った瞬間」に自動点火（エッジ判定）。
    //   - 被弾中（吹き飛び・ダウン中）のプレイヤーでは点火しない（co-trigger 防止）。
    //   - エッジ判定：ノックバックで範囲内に投げ込まれて居座っても誤爆せず、
    //     一度範囲外へ出て入り直すと再武装する。
    if (b.userData.proximityTrigger && b.userData.alive && !b.userData.dying && b.userData.fuseTimer === 0 && _players) {
      // 個体ごとの proximityRange 上書き対応（デバッグ地雷は狭めにして個別発火させる）
      const rangeSq = (b.userData.proximityRange !== undefined)
        ? b.userData.proximityRange * b.userData.proximityRange
        : PROXIMITY_TRIGGER_RANGE_SQ;
      let anyInRange = false;
      let fire = false;
      for (const pp of _players) {
        if (!pp || !pp.mesh) continue;
        const dx = pp.x - b.position.x;
        const dz = (pp.z || 0) - b.position.z;
        if (dx * dx + dz * dz > rangeSq) continue;
        anyInRange = true;
        if (_isHitstunState && _isHitstunState(pp)) continue;  // 被弾中は点火させない
        if (!b.userData._proxWasInRange) fire = true;           // 範囲外→内のエッジでのみ点火
      }
      b.userData._proxWasInRange = anyInRange;
      if (fire) _startBreakSequence(b);
    }
    if (b.userData.fuseTimer > 0) _updateFuse(b);
    // mesh 全体の物理：vy が非ゼロなら浮上 → 重力で落下 → 床で停止
    if (b.userData.vy !== 0 || b.position.y > b.userData.groundY) {
      b.position.y += b.userData.vy;
      b.userData.vy -= GRAVITY;
      if (b.position.y <= b.userData.groundY) {
        b.position.y = b.userData.groundY;
        b.userData.vy = 0;
      }
    }
  }
  // 飛び散りパーツ（1 バウンド → 着地と同時に settled で 18F フェード開始）
  for (let i = flyingParts.length - 1; i >= 0; i--) {
    const fp = flyingParts[i];
    const m = fp.mesh;
    m.position.x += fp.vx;
    m.position.y += fp.vy;
    m.position.z += fp.vz;
    fp.vy -= GRAVITY;
    m.rotation.x += fp.rotX;
    m.rotation.y += fp.rotY;
    m.rotation.z += fp.rotZ;
    // 着地：1 バウンドと同時に settled（フェード開始を早めて長居させない）
    if (m.position.y <= FLOOR_Y && fp.vy < 0) {
      if (!fp.bounced) {
        m.position.y = FLOOR_Y;
        fp.vy = -fp.vy * FLOOR_BOUNCE;
        fp.vx *= 0.7;
        fp.vz *= 0.7;
        fp.bounced = true;
        // フェード開始（フェード中も慣性で動き続けるが、見た目は薄れていく）
        fp.settled = true;
        fp.fadeTimer = FADE_FRAMES;
      }
    }
    if (fp.settled) {
      fp.fadeTimer--;
      const opacity = Math.max(0, fp.fadeTimer / FADE_FRAMES);
      m.traverse(c => {
        if (c.material) {
          if (!c.material.transparent) c.material.transparent = true;
          c.material.opacity = opacity;
        }
      });
      if (fp.fadeTimer <= 0) {
        _scene.remove(m);
        m.traverse(c => {
          if (c.geometry) c.geometry.dispose?.();
          if (c.material) c.material.dispose?.();
        });
        flyingParts.splice(i, 1);
      }
    }
  }
  // リスポーン待ちの消化（タイマー満了で factory 実行 → 新しい breakable を生成）
  for (let i = _respawnQueue.length - 1; i >= 0; i--) {
    if (--_respawnQueue[i].timer <= 0) {
      const fn = _respawnQueue[i].factory;
      _respawnQueue.splice(i, 1);
      fn();
    }
  }
}
