// ============================================================
//  SCRAP BLITZ — CR（通貨）ドロップ＆回収（テスト版・14-F）
//
//  敵撃破時に CR をばらまき、プレイヤーが近寄ると磁力で吸い寄せ → 接触で回収。
//  まずは挙動確認用の最小実装。将来は HP/SP/チップ等のドロップへ拡張する
//  （enem01.md §アイテム回収システム仕様：光柱・フローティングテキスト・10秒消滅 等）。
//
//  ES Module：index.html から initCrSystem / updateCrSystem を import。
//  dropCR は enemy-system.js（敵死亡フロー突入時）から呼ばれる。
// ============================================================

let _THREE = null;
let _scene = null;
let _players = null;
let _crHudEl = null;
let _spawnEffect = null;   // コイン取得時のパーティクルコールバック（hit-engine.spawnHitParticles）

const _pickups = [];   // { mesh, x, y, z, vx, vy, vz, bounceCount, landed, value }
const _rings   = [];   // コイン取得時の拡張リング { mesh, timer, maxTimer }
const _barriers = [];  // コインが侵入できない XZ 矩形 { xMin, xMax, zMin, zMax }
let _crTotal = 0;

// 値はランタイム調整可：window.SB.CR_CONFIG.MAGNET_RANGE = 220 など
export const CR_CONFIG = {
  DROP_COUNT_MIN:   3,      // 1 撃破あたりの粒数（下限）
  DROP_COUNT_MAX:   5,      // 同（上限）
  VALUE_MIN:        4,      // 1 粒の CR 価値（下限）
  VALUE_MAX:        12,     // 同（上限）
  SCATTER_VX:       5.0,    // 散らばり水平初速（±）
  SCATTER_VY:       10,     // 散らばり上昇初速（バウンドが見えるよう少し高め）
  GRAVITY:          0.5,    // 落下重力（wu/F²）
  GROUND_FRICTION:  0.78,   // 着地後の水平減衰
  BOUNCE_COEF:      0.42,   // バウンド係数（毎回 42% の縦速度を維持）
  MAX_BOUNCES:      3,      // 最大バウンド回数
  BOUNCE_MIN_VY:    1.5,    // これ以下の縦速でバウンドせず着地確定
  MAGNET_RANGE:     260,    // この距離内でプレイヤーへ吸い寄せ開始
  MAGNET_ACCEL:     1.8,    // 吸い寄せ加速度（初期値）
  MAGNET_RAMP:      0.04,   // 磁力範囲内滞在フレームごとの加速増加率
  MAGNET_DAMP:      0.92,   // 磁力範囲内での速度全体減衰（周回軌道防止）
  MAGNET_MAX_SPEED: 22,     // 吸い寄せ中の最大速度
  COLLECT_RANGE:    55,     // この距離まで近づくと回収
  COIN_R:           14,     // コイン半径（wu）
  COIN_H:           5,      // コイン厚み（wu）
  COLOR:            0xffdd33, // CR 識別色（黄）
  // 残存タイマー：放置されたコインの掃除（手触り改善）
  LIFE_PERSIST_FRAMES: 600, // 10s @60FPS：着地後この間は完全永続表示
  LIFE_BLINK_FRAMES:   300, // 5s：以降この間は点滅して消滅予告
  BLINK_PERIOD_FRAMES: 10,  // 点滅 1 サイクルのフレーム数
};

export function initCrSystem({ THREE, scene, players, hudLayerEl, spawnEffect }) {
  _THREE = THREE;
  _scene = scene;
  _players = players;
  _spawnEffect = spawnEffect ?? null;
  // CR カウンタ HUD（左下・最小表示）
  const el = document.createElement('div');
  el.id = 'cr-counter';
  el.style.cssText =
    'position:absolute;left:24px;bottom:88px;z-index:83;' +
    'font-family:"Courier New",monospace;font-weight:bold;font-size:26px;' +
    'color:#ffdd33;text-shadow:0 0 6px #000,2px 2px 0 #000;pointer-events:none;';
  el.textContent = 'CR: 0';
  (hudLayerEl ?? document.body).appendChild(el);
  _crHudEl = el;
}

// 爆発地点 (x, spawnY, z) に CR コインをばらまく。_triggerFinalExplosion から呼ぶ。
// opts.countMin / countMax で粒数レンジを上書き可能（コンテナ別ドロップ量等）。
// 未指定時は CR_CONFIG.DROP_COUNT_MIN / MAX を継続使用。
export function dropCR(x, z, spawnY = 80, opts = {}) {
  if (!_THREE || !_scene) return;
  const C = CR_CONFIG;
  const cMin = opts.countMin ?? C.DROP_COUNT_MIN;
  const cMax = opts.countMax ?? C.DROP_COUNT_MAX;
  const n = cMin + Math.floor(Math.random() * (cMax - cMin + 1));
  for (let i = 0; i < n; i++) {
    // コイングループ：立てたシリンダーを Y 回転でスピン
    const group = new _THREE.Group();
    const inner = new _THREE.Mesh(
      new _THREE.CylinderGeometry(C.COIN_R, C.COIN_R, C.COIN_H, 16),
      new _THREE.MeshBasicMaterial({ color: C.COLOR, side: _THREE.DoubleSide }),
    );
    inner.rotation.x = Math.PI / 2;  // 立てる（面がカメラ方向を向く）
    group.add(inner);
    group.position.set(x, spawnY, z);
    _scene.add(group);
    _pickups.push({
      mesh: group, x, y: spawnY, z,
      vx: (Math.random() * 2 - 1) * C.SCATTER_VX,
      vy: C.SCATTER_VY * (0.7 + Math.random() * 0.6),
      vz: (Math.random() * 2 - 1) * C.SCATTER_VX * 0.7,
      bounceCount: 0,
      landed: false,
      magnetFrames: 0,
      ageFrames: 0,             // 着地後経過フレーム（残存タイマー判定用）
      forceMagnet: false,       // GAME CLEAR 自動回収などで強制吸引したい時に true
      _innerMesh: inner,        // 点滅で visible 切替する本体メッシュ参照
      value: C.VALUE_MIN + Math.floor(Math.random() * (C.VALUE_MAX - C.VALUE_MIN + 1)),
    });
  }
}

// コインが入れない XZ 矩形を登録する。穴ギミック等のステージ側から呼ぶ。
// cr-system は用途を知らない汎用バリア（コインを矩形の最寄り辺へ押し戻すだけ）。
export function registerCrBarrier(rect) {
  _barriers.push(rect);
}

export function updateCrSystem() {
  const p = (_players && _players[0]) || null;
  const C = CR_CONFIG;
  for (let i = _pickups.length - 1; i >= 0; i--) {
    const c = _pickups[i];
    if (!c.landed) {
      // 散らばり＆バウンド：重力で落下 → 地面で最大 MAX_BOUNCES 回跳ね返る
      c.vy -= C.GRAVITY;
      c.x += c.vx; c.y += c.vy; c.z += c.vz;
      if (c.y <= 0) {
        c.y = 0;
        if (c.bounceCount < C.MAX_BOUNCES && Math.abs(c.vy) > C.BOUNCE_MIN_VY) {
          c.vy = -c.vy * C.BOUNCE_COEF;
          c.vx *= C.GROUND_FRICTION;
          c.vz *= C.GROUND_FRICTION;
          c.bounceCount++;
        } else {
          c.vy = 0;
          c.landed = true;
        }
      }
    } else {
      // 着地後：プレイヤーが磁力範囲内（or 強制マグネット）なら吸い寄せ、外なら摩擦で減速
      c.ageFrames++;
      let magnet = false;
      if (p && p.hp > 0) {
        const dx = p.x - c.x, dz = p.z - c.z;
        const dist = Math.hypot(dx, dz);
        const inRange = (dist < C.MAGNET_RANGE && dist > 0.01);
        if ((inRange || c.forceMagnet) && dist > 0.01) {
          magnet = true;
          c.magnetFrames++;
          // 滞在時間とともに引力増加、速度全体を減衰して周回軌道を崩す
          const accel = C.MAGNET_ACCEL * (1 + c.magnetFrames * C.MAGNET_RAMP);
          c.vx += (dx / dist) * accel;
          c.vz += (dz / dist) * accel;
          c.vx *= C.MAGNET_DAMP;
          c.vz *= C.MAGNET_DAMP;
          const sp = Math.hypot(c.vx, c.vz);
          if (sp > C.MAGNET_MAX_SPEED) {
            c.vx = c.vx / sp * C.MAGNET_MAX_SPEED;
            c.vz = c.vz / sp * C.MAGNET_MAX_SPEED;
          }
        } else {
          c.magnetFrames = 0;  // 範囲外に出たらリセット
        }
      }
      if (!magnet) { c.vx *= C.GROUND_FRICTION; c.vz *= C.GROUND_FRICTION; }
      c.x += c.vx; c.z += c.vz;

      // 残存タイマー：プレイヤー範囲外なら経過時間で点滅 → 消滅
      // 強制マグネット中はタイマーを進めない（GAME CLEAR 回収中に消える事故防止）
      if (c.forceMagnet) {
        if (c._innerMesh) c._innerMesh.visible = true;
      } else {
        const expireFrame = C.LIFE_PERSIST_FRAMES + C.LIFE_BLINK_FRAMES;
        if (c.ageFrames >= expireFrame) {
          // 消滅
          _disposeCoinGroup(c.mesh);
          _pickups.splice(i, 1);
          continue;
        } else if (c.ageFrames >= C.LIFE_PERSIST_FRAMES) {
          // 点滅フェーズ：BLINK_PERIOD_FRAMES サイクルで visible 反転
          const phase = (c.ageFrames - C.LIFE_PERSIST_FRAMES) % C.BLINK_PERIOD_FRAMES;
          if (c._innerMesh) c._innerMesh.visible = (phase < C.BLINK_PERIOD_FRAMES / 2);
        }
      }
    }
    // ステージギミック（穴等）のバリアからコインを押し戻す
    _applyCrBarriers(c);
    // 回収判定（XZ 距離・Y 無視＝床のアイテム）
    if (p && p.hp > 0) {
      const dx = p.x - c.x, dz = p.z - c.z;
      if (dx * dx + dz * dz < C.COLLECT_RANGE * C.COLLECT_RANGE) {
        _crTotal += c.value;
        if (_crHudEl) _crHudEl.textContent = 'CR: ' + _crTotal;
        _spawnCoinPickupFX(c.x, c.y, c.z);
        _disposeCoinGroup(c.mesh);
        _pickups.splice(i, 1);
        continue;
      }
    }
    // 見た目：Y 回転スピン（空中は速め、着地後は遅め）+ グループ位置同期
    c.mesh.rotation.y += c.landed ? 0.10 : 0.18;
    c.mesh.position.set(c.x, c.y + C.COIN_R, c.z);
  }
  // 取得リングアニメーション：拡大 + フェードアウト
  for (let i = _rings.length - 1; i >= 0; i--) {
    const r = _rings[i];
    r.timer++;
    const t = r.timer / r.maxTimer;
    r.mesh.scale.setScalar(0.3 + t * 0.7);
    r.mesh.material.opacity = 0.85 * (1 - t);
    if (r.timer >= r.maxTimer) {
      if (_scene) _scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
      _rings.splice(i, 1);
    }
  }
}

export function getCrTotal() { return _crTotal; }

// コイン c を登録済みバリア矩形の外へ押し戻す（最寄りの辺へ・速度は軽く反射）。
// コインを半径 COIN_R の円として扱い、コイン graphic 全体が矩形外に出るよう
// 矩形を半径分だけ広げて判定する（縁へのめり込み防止）。
function _applyCrBarriers(c) {
  const r = CR_CONFIG.COIN_R;
  for (const b of _barriers) {
    const xMin = b.xMin - r, xMax = b.xMax + r;
    const zMin = b.zMin - r, zMax = b.zMax + r;
    if (c.x <= xMin || c.x >= xMax || c.z <= zMin || c.z >= zMax) continue;
    const dL = c.x - xMin, dR = xMax - c.x;
    const dN = c.z - zMin, dF = zMax - c.z;
    if (Math.min(dL, dR) <= Math.min(dN, dF)) {
      if (dL <= dR) { c.x = xMin; if (c.vx > 0) c.vx *= -0.3; }
      else          { c.x = xMax; if (c.vx < 0) c.vx *= -0.3; }
    } else {
      if (dN <= dF) { c.z = zMin; if (c.vz > 0) c.vz *= -0.3; }
      else          { c.z = zMax; if (c.vz < 0) c.vz *= -0.3; }
    }
  }
}

// コイン取得時演出：黄リング拡張 + sparkle パーティクル
function _spawnCoinPickupFX(x, y, z) {
  if (_THREE && _scene) {
    const C = CR_CONFIG;
    // コインと同じ縦向き（XY 平面・カメラ正面向き）で生成
    const ring = new _THREE.Mesh(
      new _THREE.RingGeometry(C.COIN_R, C.COIN_R * 3.0, 24),
      new _THREE.MeshBasicMaterial({
        color: C.COLOR, transparent: true, opacity: 0.9,
        depthWrite: false, side: _THREE.DoubleSide,
      }),
    );
    // rotation なし = XY 平面（コインと同じ向き）
    ring.position.set(x, y + C.COIN_R, z);
    ring.scale.setScalar(0.2);
    _scene.add(ring);
    _rings.push({ mesh: ring, timer: 0, maxTimer: 16 });
  }
  if (_spawnEffect) _spawnEffect(x, y + 20, z);
}

// Group（外枠）ごと scene から除去し、内部 Mesh の geometry/material を dispose
function _disposeCoinGroup(group) {
  if (group.parent) group.parent.remove(group);
  for (const child of group.children) {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  }
}

// GAME CLEAR 等で全コインを強制マグネット吸引する。
// プレイヤー位置に向けて吸引が始まり、updateCrSystem の通常回収判定でカウントされる。
// 残存タイマー（点滅・消滅）は forceMagnet 中は止まる。
export function collectAllCR() {
  for (const c of _pickups) {
    c.forceMagnet = true;
    if (c._innerMesh) c._innerMesh.visible = true;   // 点滅中だった分を強制表示
  }
}

// ステージ再構築時などのクリア用（現状はページリロードで足りるため任意）
export function resetCrSystem() {
  for (const c of _pickups) {
    _disposeCoinGroup(c.mesh);
  }
  _pickups.length = 0;
  _crTotal = 0;
  if (_crHudEl) _crHudEl.textContent = 'CR: 0';
}
