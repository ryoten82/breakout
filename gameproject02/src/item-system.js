// ============================================================
//  SCRAP BLITZ — アイテム pickup インフラ（HP 3 種 / SP タンク / 将来チップ等）
//
//  仕様書 §18 / chars/common01.md「Pickup マグネット仕様」準拠。
//
//  HP は 3 種：apple(20%) < burger(40%) < meat(100%) でサイズと回復量がスケール。
//  「肉ほど稀＝嬉しさ」のレアリティ表現（食べ物 mesh は意図的にメカ世界観と外す＝可読性優先）。
//  SP は 1 種（エメラルドグリーン・SP バーと色同期）。
//
//  ドロップ経路：
//    (1) breakables.js onContainerLoot → rollAndDropFromContainer(containerKind, x, z)
//        → CONTAINER_LOOT_TABLE で重み抽選 → dropItem(itemKind, x, z)
//    (2) ステージ配置 props に loot:'hp_meat' を書いた場合は確率抽選を経由しない
//
//  物理・マグネット・寿命は cr-system.js とほぼ同じ（CR_CONFIG.MAGNET_* を流用）。
//  取得演出は cr-system._spawnCoinPickupFX の色変え版（リング + sparkle 粒）。
//
//  ES Module：index.html から initItemSystem / updateItemSystem を import。
// ============================================================

import {
  ITEM_CONFIG, ITEM_KIND, CONTAINER_LOOT_TABLE, SP_CONFIG,
  CHIP_RARITY, CHIP_KIND_RARITY,
  CHIP_DROP_TABLE_NORMAL, CHIP_DROP_TABLE_RARE_PLUS, BOSS_CHIP_DROP_CONFIG,
} from './config.js';
import { CR_CONFIG } from './cr-system.js';

let _THREE = null;
let _scene = null;
let _players = null;
let _spawnEffect = null;   // sparkle 粒コールバック (x,y,z,color)
let _onPickupSE = null;    // 取得 SE コールバック (kind) — 将来 HP/SP/CR 別の SE を鳴らす窓口

const _pickups = [];   // { kind, mesh, _innerGroup, _pillar, x, y, z, vx, vy, vz, bounceCount, landed, magnetFrames, ageFrames, spinPhase }
const _rings   = [];   // 取得演出リング { mesh, timer, maxTimer }

export function initItemSystem({ THREE, scene, players, spawnEffect, onPickupSE }) {
  _THREE = THREE;
  _scene = scene;
  _players = players;
  _spawnEffect = spawnEffect ?? null;
  _onPickupSE  = onPickupSE  ?? null;
}

// kind が chip 系か判定
function _isChipKind(kind) { return !!CHIP_KIND_RARITY[kind]; }

// kind ごとの config 参照ヘルパー（chip は CHIP_RARITY から）
function _configForKind(kind) {
  switch (kind) {
    case ITEM_KIND.HP_APPLE:  return ITEM_CONFIG.HP_APPLE;
    case ITEM_KIND.HP_BURGER: return ITEM_CONFIG.HP_BURGER;
    case ITEM_KIND.HP_MEAT:   return ITEM_CONFIG.HP_MEAT;
    case ITEM_KIND.SP_TANK:   return ITEM_CONFIG.SP_TANK;
    default:
      if (_isChipKind(kind)) {
        const r = CHIP_RARITY[CHIP_KIND_RARITY[kind]];
        // chip 用に MESH_SIZE / COLOR を ITEM_CONFIG 互換キーで返す
        return { COLOR: r.color, MESH_SIZE: r.mesh, _chipRarity: CHIP_KIND_RARITY[kind] };
      }
      return null;
  }
}

// kind ごとの mesh ファクトリ振り分け（chip は共通ファクトリでレアリティ別装飾）
function _createMeshForKind(kind, THREE) {
  switch (kind) {
    case ITEM_KIND.HP_APPLE:  return _createAppleMesh(THREE);
    case ITEM_KIND.HP_BURGER: return _createBurgerMesh(THREE);
    case ITEM_KIND.HP_MEAT:   return _createMeatMesh(THREE);
    case ITEM_KIND.SP_TANK:   return _createSpTankMesh(THREE);
    default:
      if (_isChipKind(kind)) return _createChipMesh(THREE, CHIP_KIND_RARITY[kind]);
      return null;
  }
}

// 単発ドロップ：指定位置に 1 個 spawn。lootOverride / SB.dropItem / 将来 midboss 死亡フローから呼ぶ。
export function dropItem(kind, x, z, spawnY = 80) {
  if (!_THREE || !_scene) return;
  const cfg = _configForKind(kind);
  if (!cfg) { console.warn('[item-system] unknown kind:', kind); return; }
  const C = ITEM_CONFIG;
  const mesh = _createMeshForKind(kind, _THREE);
  if (!mesh) return;
  mesh.position.set(x, spawnY, z);
  _scene.add(mesh);
  // レジェンダリーチップは「茶柱」（上空に伸びる光の柱）を同時生成
  let pillar = null;
  if (kind === ITEM_KIND.CHIP_LEGENDARY) {
    pillar = _createPillarMesh(_THREE, CHIP_RARITY.legendary.glow);
    pillar.position.set(x, spawnY, z);
    _scene.add(pillar);
  }
  _pickups.push({
    kind, mesh, _innerGroup: mesh, _pillar: pillar,
    x, y: spawnY, z,
    vx: (Math.random() * 2 - 1) * C.SCATTER_VX,
    vy: C.SCATTER_VY * (0.7 + Math.random() * 0.6),
    vz: (Math.random() * 2 - 1) * C.SCATTER_VX * 0.7,
    bounceCount: 0,
    landed: false,
    magnetFrames: 0,
    ageFrames: 0,
    spawnFrames: 0,             // spawn 後経過 F（拾い不可猶予判定用）
    meshSize: cfg.MESH_SIZE,
    spinPhase: Math.random() * Math.PI * 2,
    isChip: _isChipKind(kind),
  });
}

// ボス専用ドロップ：確定 BASE_COUNT 個（うち 1 個レア以上確定）+ 上振れで追加
//   仕様 §1211：「ボスは最低 3 個 + レア以上 1 個確定 + 上振れ次第」（2026-05-25 ユーザー指示）
//   呼び出し例：onFinalWaveClear で boss 位置から呼ぶ
export function dropBossChips(x, z, spawnY = 80, opts = {}) {
  const C = BOSS_CHIP_DROP_CONFIG;
  const base = opts.baseCount ?? C.BASE_COUNT;
  const guaranteedRarePlus = opts.guaranteedRarePlus ?? C.GUARANTEED_RARE_PLUS;
  const drops = [];
  // (1) 確定レア以上：guaranteedRarePlus 個
  for (let i = 0; i < guaranteedRarePlus; i++) {
    drops.push(_rollChipFromTable(CHIP_DROP_TABLE_RARE_PLUS));
  }
  // (2) 残りは通常テーブル
  for (let i = guaranteedRarePlus; i < base; i++) {
    drops.push(_rollChipFromTable(CHIP_DROP_TABLE_NORMAL));
  }
  // (3) 上振れ：BONUS_CHANCE で +1、その後 × BONUS_HALF で逓減、最大 BONUS_MAX 個
  let chance = C.BONUS_CHANCE;
  for (let i = 0; i < C.BONUS_MAX; i++) {
    if (Math.random() < chance) {
      drops.push(_rollChipFromTable(CHIP_DROP_TABLE_NORMAL));
      chance *= C.BONUS_HALF;
    } else break;
  }
  // 円形 + 微 random 散布で同位置重複を避ける
  drops.forEach((kind, i) => {
    const a = (i / drops.length) * Math.PI * 2 + Math.random() * 0.3;
    const r = 30 + Math.random() * 20;
    dropItem(kind, x + Math.cos(a) * r, z + Math.sin(a) * r, spawnY);
  });
  return drops;
}

function _rollChipFromTable(table) {
  let total = 0;
  for (const e of table) total += e.w;
  let r = Math.random() * total;
  for (const e of table) {
    if (r < e.w) return e.kind;
    r -= e.w;
  }
  return table[table.length - 1].kind;
}

// container 破壊時の追加ロール抽選。CR は呼び出し側で別途 dropCR してから本関数を呼ぶ想定。
export function rollAndDropFromContainer(containerKind, x, z, spawnY = 80) {
  const table = CONTAINER_LOOT_TABLE[containerKind];
  if (!table || !table.length) return null;
  let total = 0;
  for (const e of table) total += e.w;
  let r = Math.random() * total;
  let chosen = 'miss';
  for (const e of table) {
    if (r < e.w) { chosen = e.kind; break; }
    r -= e.w;
  }
  if (chosen === 'miss' || chosen === 'buff') return chosen;
  dropItem(chosen, x, z, spawnY);
  return chosen;
}

export function updateItemSystem() {
  const p = (_players && _players[0]) || null;
  const C = ITEM_CONFIG;
  const M = (C.USE_CR_MAGNET ? CR_CONFIG : C);

  for (let i = _pickups.length - 1; i >= 0; i--) {
    const it = _pickups[i];
    it.spawnFrames++;
    // armed：着地済み or spawn から 1 秒経過のどちらか早い方
    const armed = it.landed || it.spawnFrames >= C.ARM_FRAMES_AFTER_SPAWN;
    if (!it.landed) {
      it.vy -= C.GRAVITY;
      it.x += it.vx; it.y += it.vy; it.z += it.vz;
      if (it.y <= 0) {
        it.y = 0;
        if (it.bounceCount < C.MAX_BOUNCES && Math.abs(it.vy) > C.BOUNCE_MIN_VY) {
          it.vy = -it.vy * C.BOUNCE_COEF;
          it.vx *= C.GROUND_FRICTION;
          it.vz *= C.GROUND_FRICTION;
          it.bounceCount++;
        } else {
          it.vy = 0;
          it.landed = true;
        }
      }
    } else {
      it.ageFrames++;
      let magnet = false;
      // armed まではマグネット OFF（広がる挙動を見せる）
      if (armed && p && p.hp > 0) {
        const dx = p.x - it.x, dz = p.z - it.z;
        const dist = Math.hypot(dx, dz);
        if (dist < M.MAGNET_RANGE && dist > 0.01) {
          magnet = true;
          it.magnetFrames++;
          const accel = M.MAGNET_ACCEL * (1 + it.magnetFrames * M.MAGNET_RAMP);
          it.vx += (dx / dist) * accel;
          it.vz += (dz / dist) * accel;
          it.vx *= M.MAGNET_DAMP;
          it.vz *= M.MAGNET_DAMP;
          const sp = Math.hypot(it.vx, it.vz);
          if (sp > M.MAGNET_MAX_SPEED) {
            it.vx = it.vx / sp * M.MAGNET_MAX_SPEED;
            it.vz = it.vz / sp * M.MAGNET_MAX_SPEED;
          }
        } else {
          it.magnetFrames = 0;
        }
      }
      if (!magnet) { it.vx *= C.GROUND_FRICTION; it.vz *= C.GROUND_FRICTION; }
      it.x += it.vx; it.z += it.vz;
      // 吸引中：y を player の胴体高（ABSORB_TARGET_Y）へ ease 上昇
      //   → 「足元に吸われる」感を解消し、胴体に吸い込まれる視覚に揃える
      if (magnet) {
        const targetY = (p ? p.y : 0) + C.ABSORB_TARGET_Y;
        it.y += (targetY - it.y) * C.ABSORB_Y_LERP;
      } else if (it.y > 0) {
        // マグネット外で空中保持されたケースの自由落下保険
        it.y = Math.max(0, it.y - 1.0);
      }

      // 時間消滅なし（2026-05-25 ユーザー指示：消えるのは CR のみ）
      //   HP / SP / チップは取得しない限りその場に残り続ける。
      //   LIFE_PERSIST_FRAMES / LIFE_BLINK_FRAMES / BLINK_PERIOD_FRAMES 定数は
      //   将来「ステージ進行で持ち越し制御したい時の窓口」として ITEM_CONFIG に残置。
    }
    // 回収判定（XZ 距離・Y 無視）
    //   armed まで（着地 or 1 秒経過）は接触取得不可
    if (armed && p && p.hp > 0) {
      const dx = p.x - it.x, dz = p.z - it.z;
      if (dx * dx + dz * dz < C.COLLECT_RANGE * C.COLLECT_RANGE) {
        _applyPickup(it.kind, p);
        const color = _configForKind(it.kind).COLOR;
        // 取得位置：吸引中なら it.y はもう胴体高なので、そのまま使うと演出が胴体で出る
        _spawnItemPickupFX(it.x, it.y, it.z, color);
        if (_onPickupSE) _onPickupSE(it.kind);  // 将来 HP/SP/CR/レジェンダリーで別 SE
        _disposeItem(it.mesh);
        if (it._pillar) _disposeItem(it._pillar);
        _pickups.splice(i, 1);
        continue;
      }
    }
    // 軽い回転 + position 同期（地面着地時のみ meshSize/2 を足す。吸引中は it.y 自体が浮く）
    //   chip は派手目に速回転 + 縦揺れ（重要アイテム感を出す）
    it.spinPhase = (it.spinPhase ?? 0) + (it.isChip ? 0.10 : (it.landed ? 0.05 : 0.10));
    it.mesh.rotation.y = it.spinPhase;
    if (it.isChip) it.mesh.rotation.x = Math.sin(it.spinPhase * 0.6) * 0.2;
    const meshYOffset = (it.landed && it.magnetFrames > 0) ? 0 : it.meshSize * 0.5;
    const bobY = it.isChip && it.landed ? Math.sin(it.ageFrames * 0.06) * 4 : 0;
    it.mesh.position.set(it.x, it.y + meshYOffset + bobY, it.z);
    // レジェンダリー「茶柱」：常にアイテム頭上に追従、回収まで継続
    if (it._pillar) {
      it._pillar.position.set(it.x, it.y + meshYOffset + 60, it.z);
      // 縦に流れる脈動：opacity を時間変化させる
      const pulse = 0.55 + 0.30 * Math.sin(it.ageFrames * 0.10);
      it._pillar.children.forEach(ch => { if (ch.material) ch.material.opacity = pulse; });
      it._pillar.rotation.y = it.ageFrames * 0.02;  // ゆっくり回す
    }
  }

  // 取得リング演出：拡大 + フェードアウト
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

export function resetItemSystem() {
  for (const it of _pickups) {
    _disposeItem(it.mesh);
    if (it._pillar) _disposeItem(it._pillar);
  }
  _pickups.length = 0;
  for (const r of _rings) {
    if (_scene) _scene.remove(r.mesh);
    r.mesh.geometry.dispose();
    r.mesh.material.dispose();
  }
  _rings.length = 0;
}

// ============================================================
//  内部：適用関数（kind 別に player ステータスへ加算）
// ============================================================
function _applyPickup(kind, p) {
  const max = p.maxHp || 100;
  if (kind === ITEM_KIND.HP_APPLE) {
    p.hp = Math.min(max, p.hp + max * ITEM_CONFIG.HP_APPLE.HEAL_RATIO);
  } else if (kind === ITEM_KIND.HP_BURGER) {
    p.hp = Math.min(max, p.hp + max * ITEM_CONFIG.HP_BURGER.HEAL_RATIO);
  } else if (kind === ITEM_KIND.HP_MEAT) {
    p.hp = max;   // 完全回復
  } else if (kind === ITEM_KIND.SP_TANK) {
    const gain = SP_CONFIG.STOCK_SIZE * ITEM_CONFIG.SP_TANK.GAIN_STOCKS;
    p.sp = Math.min(SP_CONFIG.MAX, (p.sp || 0) + gain);
  } else if (_isChipKind(kind)) {
    // チップ取得：効果適用は inventory システム実装後（現状は獲得通知のみ）
    //   将来 p.chipInventory.push({ kind, rarityKey, rolledStats... }) を想定
    const rarityKey = CHIP_KIND_RARITY[kind];
    const r = CHIP_RARITY[rarityKey];
    if (typeof window !== 'undefined' && window.SB?.DEBUG_CHIP) {
      console.log(`[chip] +1 ${r.label}`);
    }
    // legendary は将来 onPickupSE で別 SE 鳴らす窓口あり（kind で識別可能）
  }
}

// ============================================================
//  取得演出：CR コイン取得時の拡張リング + sparkle 粒の色変え版
//  cr-system._spawnCoinPickupFX とほぼ同じ構造。色だけ kind ごとに切り替え。
// ============================================================
function _spawnItemPickupFX(x, y, z, color) {
  if (_THREE && _scene) {
    const C = ITEM_CONFIG;
    const ring = new _THREE.Mesh(
      new _THREE.RingGeometry(C.PICKUP_RING_R_INNER, C.PICKUP_RING_R_OUTER, 24),
      new _THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.9,
        depthWrite: false, side: _THREE.DoubleSide,
      }),
    );
    // rotation なし＝XY 平面（コインと同じ向き）
    ring.position.set(x, y + 20, z);
    ring.scale.setScalar(0.2);
    _scene.add(ring);
    _rings.push({ mesh: ring, timer: 0, maxTimer: C.PICKUP_RING_FRAMES });
  }
  if (_spawnEffect) _spawnEffect(x, y + 20, z, color);
}

// ============================================================
//  内部：mesh ファクトリ（食べ物 mesh・暫定だがそれっぽい形）
//
//  - リンゴ：赤い球 + 緑の小葉 + 茶色の小柄
//  - ハンバーガー：バンズ（上下）+ チーズ + パティ の積層
//  - 骨付き肉：茶色の俵 + 白い骨が左右に突き出る
//  - SP タンク：エメラルドの六角柱 + 上面に黄色稲妻
// ============================================================
function _createAppleMesh(THREE) {
  const C = ITEM_CONFIG.HP_APPLE;
  const r = C.MESH_SIZE * 0.5;
  const group = new THREE.Group();
  // 赤い果実本体（球）
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(r, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xff3322 }),
  );
  group.add(body);
  // 茶色の柄（短い棒）
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.08, r * 0.08, r * 0.4, 8),
    new THREE.MeshBasicMaterial({ color: 0x6b3a1a }),
  );
  stem.position.y = r + r * 0.18;
  group.add(stem);
  // 緑の葉（細い板）
  const leaf = new THREE.Mesh(
    new THREE.BoxGeometry(r * 0.55, r * 0.15, r * 0.06),
    new THREE.MeshBasicMaterial({ color: 0x33aa44 }),
  );
  leaf.position.set(r * 0.25, r + r * 0.22, 0);
  leaf.rotation.z = -0.35;
  group.add(leaf);
  return group;
}

function _createBurgerMesh(THREE) {
  const C = ITEM_CONFIG.HP_BURGER;
  const s = C.MESH_SIZE;
  const r = s * 0.45;
  const group = new THREE.Group();
  // 下バンズ（薄い円柱・茶色）
  const lower = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, s * 0.18, 18),
    new THREE.MeshBasicMaterial({ color: 0xc78a3e }),
  );
  lower.position.y = s * 0.09;
  group.add(lower);
  // パティ（赤茶・少し小さい円柱）
  const patty = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.95, r * 0.95, s * 0.14, 18),
    new THREE.MeshBasicMaterial({ color: 0x7a3a18 }),
  );
  patty.position.y = s * 0.25;
  group.add(patty);
  // チーズ（黄・板状・少しはみ出す感じで角張った Box）
  const cheese = new THREE.Mesh(
    new THREE.BoxGeometry(r * 2.1, s * 0.05, r * 2.1),
    new THREE.MeshBasicMaterial({ color: 0xffcc33 }),
  );
  cheese.position.y = s * 0.34;
  cheese.rotation.y = Math.PI / 4;
  group.add(cheese);
  // 上バンズ（半球で「ふっくら」感）
  const upper = new THREE.Mesh(
    new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xe0a44d }),
  );
  upper.position.y = s * 0.38;
  group.add(upper);
  // ゴマ（白い小点・上バンズに 3 つ）
  const seedMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
  for (let i = 0; i < 3; i++) {
    const seed = new THREE.Mesh(new THREE.SphereGeometry(s * 0.035, 6, 4), seedMat);
    const a = (i / 3) * Math.PI * 2;
    seed.position.set(Math.cos(a) * r * 0.45, s * 0.55, Math.sin(a) * r * 0.45);
    group.add(seed);
  }
  return group;
}

function _createMeatMesh(THREE) {
  const C = ITEM_CONFIG.HP_MEAT;
  const s = C.MESH_SIZE;
  const group = new THREE.Group();
  // 肉本体（茶色の楕円体・SphereGeometry を scale）
  const meat = new THREE.Mesh(
    new THREE.SphereGeometry(s * 0.42, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0x8a3d20 }),
  );
  meat.scale.set(1.0, 0.8, 1.2);
  group.add(meat);
  // 表面のハイライト（少し赤い帯）
  const stripe = new THREE.Mesh(
    new THREE.SphereGeometry(s * 0.30, 18, 10),
    new THREE.MeshBasicMaterial({ color: 0xc24d28 }),
  );
  stripe.scale.set(1.05, 0.45, 1.25);
  stripe.position.y = s * 0.12;
  group.add(stripe);
  // 骨：白い円柱が左右に貫通
  const boneMat = new THREE.MeshBasicMaterial({ color: 0xf5eedd });
  const bone = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.10, s * 0.10, s * 1.30, 12),
    boneMat,
  );
  bone.rotation.z = Math.PI / 2;
  bone.position.y = s * 0.04;
  group.add(bone);
  // 骨の両端ノブ（球）
  for (const sx of [-1, 1]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(s * 0.16, 12, 8), boneMat);
    knob.position.set(sx * s * 0.65, s * 0.04, 0);
    group.add(knob);
  }
  return group;
}

function _createSpTankMesh(THREE) {
  const C = ITEM_CONFIG.SP_TANK;
  const s = C.MESH_SIZE;
  const r = s * 0.4;
  const group = new THREE.Group();
  // 六角柱の本体（エメラルドグリーン・「ジェムらしさ」）
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, s * 0.9, 6),
    new THREE.MeshBasicMaterial({ color: C.COLOR }),
  );
  group.add(body);
  // 上面のキャップ（少し明るい同系色）
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.95, r * 0.95, s * 0.06, 6),
    new THREE.MeshBasicMaterial({ color: 0x66ffaa }),
  );
  cap.position.y = s * 0.45;
  group.add(cap);
  // 黄稲妻代用（細長 box 2 本の斜め交差で「Z 字」感）
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xffee44 });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(s * 0.7, 3, s * 0.16), boltMat);
  b1.position.y = s * 0.52;
  b1.rotation.y = Math.PI / 4;
  group.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(s * 0.7, 3, s * 0.16), boltMat);
  b2.position.y = s * 0.52;
  b2.rotation.y = -Math.PI / 4;
  group.add(b2);
  return group;
}

function _disposeItem(group) {
  if (group.parent) group.parent.remove(group);
  group.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) obj.material.dispose();
  });
}

// ============================================================
//  チップ mesh：八面体ジェム本体 + 拡大半透明グロー殻 + 縁ワイヤフレーム
//  - 派手目装飾（最重要アイテム感）
//  - レアリティ色を本体に、明るい同系色をグローに
// ============================================================
function _createChipMesh(THREE, rarityKey) {
  const r = CHIP_RARITY[rarityKey];
  const s = r.mesh;
  const group = new THREE.Group();
  // コアジェム（八面体・不透明）
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(s * 0.40, 0),
    new THREE.MeshBasicMaterial({ color: r.color }),
  );
  group.add(core);
  // 縁ワイヤフレーム（明るい同系色・くっきり輪郭）
  const wire = new THREE.Mesh(
    new THREE.OctahedronGeometry(s * 0.41, 0),
    new THREE.MeshBasicMaterial({ color: r.glow, wireframe: true }),
  );
  group.add(wire);
  // 外側グロー殻（拡大・半透明・加算合成的に重ねる）
  const glow = new THREE.Mesh(
    new THREE.OctahedronGeometry(s * 0.55, 0),
    new THREE.MeshBasicMaterial({
      color: r.glow, transparent: true, opacity: 0.30,
      depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  group.add(glow);
  // 真上の小さい光点（チップの「アンテナ」のような目印）
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(s * 0.08, 8, 6),
    new THREE.MeshBasicMaterial({ color: r.glow }),
  );
  beacon.position.y = s * 0.55;
  group.add(beacon);
  return group;
}

// 茶柱（レジェンダリー専用）：上空に伸びる光の柱
//   細い CylinderGeometry × 3 重（内側ソリッド・中間半透明・外側さらに薄い）
//   updateItemSystem で opacity 脈動 + ゆっくり回転
function _createPillarMesh(THREE, color) {
  const group = new THREE.Group();
  const heights = [800, 800, 800];
  const radii   = [4,   10,  20];
  const opacs   = [0.85, 0.40, 0.18];
  for (let i = 0; i < 3; i++) {
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(radii[i], radii[i] * 1.4, heights[i], 12, 1, true),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: opacs[i],
        depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    cyl.position.y = heights[i] * 0.5;
    group.add(cyl);
  }
  return group;
}
