// Stage 1 ランナー
// 仕様：stages/stage01/layout.md
// ロジック本体は ../wave-runner.js（共通）。本ファイルは stage01 固有の装飾と
// URL ベース遷移先解決だけを与える薄いアダプタ。

import { STAGE01_WAVES, ENEMY_TEMPLATES, STAGE01_META } from './waves.js';
import { addSectionMarkers } from './section-markers.js';
import { createCrate } from '../../props/factory/crate.js';
import { createCanister } from '../../props/factory/gas-canister.js';
import { createMine } from '../../props/factory/mine.js';
import { registerBreakable } from '../../breakables.js';
import { createWaveRunner } from '../wave-runner.js';

// 壊れ物の仮配置（破壊判定込み・見た目比較用）
// 配置：W1 終了〜W2 trigger（x=1100〜1600）と W3 終了〜W4 trigger（x=3000〜3400）の合間
function _placeBreakablesForTest(scene, THREE) {
  const placements = [
    { type: 'crate',    x: 1300, z:  -20 },
    { type: 'crate',    x: 1380, z:   20 },
    { type: 'canister', x: 1450, z:    0 },
    { type: 'canister', x: 3150, z:  -20 },
    { type: 'canister', x: 3220, z:   20 },
    { type: 'crate',    x: 3300, z:    0 },
  ];
  for (const p of placements) {
    const mesh = (p.type === 'crate') ? createCrate({ THREE }) : createCanister({ THREE });
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    registerBreakable(mesh);
  }
}

// ============================================================
//  【デバッグ】被弾 state テスト用 地雷列（2026-05-20）
//  開始地点付近・z=700（プレイ平面の奥端）に atk_lv 別の地雷を 4 基並べる。
//  各地雷は proximityTrigger でプレイヤー接近 → 自動点火 → 爆発で対応 lv のやられを適用：
//    lv3=吹っ飛ばし / lv4=打ち上げ / lv5=叩きつけ / lv6=超吹っ飛ばし。
//  地雷の真上に atk_lv 表記ラベル（Sprite）を出してデバッグ確認できる。
//  ※ x は開始時のカメラ追従壁内（≈0〜1300）に収める。外に置くと到達不可。
//  ※ proximityRange を狭め（150）にして、隣の地雷を巻き込まず個別に発火させる。
//  将来：アクション挙動テスト専用のデバッグルームとして分離する想定。
// ============================================================
const DEBUG_MINE_Z = 700;   // プレイ平面の奥端（player z クランプ上限）
const DEBUG_MINE_PROXIMITY = 150;  // 個別発火用の狭い接近半径（既定 400 だと隣を巻き込む）
const DEBUG_MINE_DAMAGE = 10;      // テスト用：被弾 state を繰り返し確認しやすい控えめダメージ
const DEBUG_MINES = [
  { x:  250, lv: 3, label: '吹っ飛ばし' },
  { x:  600, lv: 4, label: '打ち上げ' },
  { x:  950, lv: 5, label: '叩きつけ' },
  { x: 1250, lv: 6, label: '超吹っ飛ばし' },
];

// atk_lv 表記の Canvas テクスチャ Sprite を作る（常にカメラを向く・depthTest 無効で最前面）
function _makeDebugLabel(THREE, lv, caption) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(12,12,16,0.82)';
  ctx.fillRect(0, 0, 256, 128);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ff5050';
  ctx.strokeRect(2, 2, 252, 124);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 50px sans-serif';
  ctx.fillText('atk_lv ' + lv, 128, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = '30px sans-serif';
  ctx.fillText(caption, 128, 92);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(180, 90, 1);
  return sprite;
}

function _placeDebugMines(scene, THREE) {
  for (const m of DEBUG_MINES) {
    const mine = createMine({ THREE });
    mine.position.set(m.x, 0, DEBUG_MINE_Z);
    mine.userData.proximityTrigger = true;   // 接近で自動点火
    mine.userData.proximityRange = DEBUG_MINE_PROXIMITY;  // 狭め＝個別発火
    mine.userData.testAtkLv = m.lv;          // 爆発時にこの lv で被弾させる（breakables._explode が参照）
    mine.userData.explosionDamage = DEBUG_MINE_DAMAGE;    // テスト用に控えめなダメージ
    scene.add(mine);
    registerBreakable(mine);

    const label = _makeDebugLabel(THREE, m.lv, m.label);
    label.position.set(m.x, 150, DEBUG_MINE_Z);
    scene.add(label);
  }
}

// 遷移先：stage02 は stage01 を完全 wrap するため、stage01 自身の固定 nextStageId を
// 見ると stage02 → stage02 にループする。
// 2026-05-19：URL ?stage= から sessionStorage 経由の自動遷移に変更したため、
//   現在ステージは window.__SB_SELECTED_STAGE（index.html で公開）を参照する。
function _resolveNextStageId() {
  const cur = window.__SB_SELECTED_STAGE || 'stage01';
  const map = { stage01: 'stage02', stage02: 'stage03', stage03: null };
  return (cur in map) ? map[cur] : STAGE01_META.nextStageId;
}

const _runner = createWaveRunner({
  waves: STAGE01_WAVES,
  meta: STAGE01_META,
  enemyTpl: ENEMY_TEMPLATES,
  decorate: (deps) => {
    if (deps.scene && deps.THREE) {
      addSectionMarkers(deps.scene, deps.THREE);
      _placeBreakablesForTest(deps.scene, deps.THREE);
      _placeDebugMines(deps.scene, deps.THREE);
    }
  },
  resolveNextStageId: _resolveNextStageId,
});

export const initStage01           = _runner.init;
export const tickStage01           = _runner.tick;
export const getStage01DebugState  = _runner.getDebug;
