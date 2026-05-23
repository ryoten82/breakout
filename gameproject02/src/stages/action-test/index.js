// アクションテスト部屋（id: actionTest）
// 被弾 state を一通り確認するためのデバッグ専用ステージ。wave-runner 非依存で
// init / tick / getDebug を直接実装する軽量モジュール。
//   - 広い仮床 + 固定の広い壁（±ARENA_HALF_X）→ lv6 超吹き飛ばしの地面転がり
//     ルートも壁に阻まれず観察できる（通常ステージはカメラ追従壁で狭い）
//   - atk_lv 1〜6 の地雷を横一列に敷設（リスポーン付き・atk_lv ラベル付き）
//   - ダミー敵 1 体（自分の攻撃・コンボの当て先）
// 開始画面の「アクションテスト」選択でこのステージが起動する。
// 将来：ガードクラッシュ等、他のアクション検証要素もここへ追加していく。

import { createMine } from '../../props/factory/mine.js';
import { createCrate } from '../../props/factory/crate.js';
import { registerBreakable } from '../../breakables.js';
import { levelWalls } from '../../camera.js';

const ARENA_HALF_X   = 3000;  // 固定壁の半幅（カメラ追従壁を上書きして広く取る）
const MINE_Z         = 700;   // 地雷の z（プレイ平面の奥端）
const MINE_PROXIMITY = 150;   // 個別発火用の狭い接近半径
const MINE_DAMAGE    = 10;    // 繰り返しテスト用の控えめなダメージ
const MINE_RESPAWN   = 180;   // 爆発 → リスポーンまでの待機F（3 秒）
const LABEL_Y        = 150;   // atk_lv ラベルの高さ

// atk_lv 別の地雷（吹っ飛ばし系やられを一通り）
const MINES = [
  { x: -1500, lv: 1, label: '小フリンチ' },
  { x:  -900, lv: 2, label: 'のけぞり' },
  { x:  -300, lv: 3, label: '吹っ飛ばし' },
  { x:   300, lv: 4, label: '打ち上げ' },
  { x:   900, lv: 5, label: '叩きつけ' },
  { x:  1500, lv: 6, label: '超吹っ飛ばし' },
];

// ダミー敵の配置スロット（性格・敵種別）。死亡フローに入ったら同スロットへ即リスポーンする。
const ENEMY_SLOTS = [
  // { personality: 'brave',    enemyType: 'enem01', x: -500, z: 150 },
  // { personality: 'cunning',  enemyType: 'enem01', x: -150, z: 150 },
  // { personality: 'cunning',  enemyType: 'enem02', x:  200, z: 150 },  // enem02 ジャンパー
  { personality: 'berserker', enemyType: 'midboss01', x:  0, z: 150 },  // midboss01 シールドガーダー
];

let _built = false;
let _spawnDummy = null;
let _enemies = null;   // 即リスポーン判定用の敵配列参照（initActionTest の deps 経由）

// 1 スロット分のダミーを生成。instantRespawn:false ＝ 死亡演出（ゴア）を最後まで再生させる。
function _spawnSlot(slot) {
  if (!_spawnDummy) return;
  const hp = slot.enemyType === 'enem02' ? 35
           : slot.enemyType === 'midboss01' ? 250
           : 100;
  const cd = slot.enemyType === 'enem02' ? 60
           : slot.enemyType === 'midboss01' ? 75
           : 90;
  _spawnDummy(slot.x, slot.z, {
    maxHp: hp, instantRespawn: false,
    personality: slot.personality,
    enemyType: slot.enemyType ?? 'enem01',
    atkCooldown: cd,
  });
}

// atk_lv 表記の Canvas テクスチャ Sprite（常にカメラを向く・depthTest 無効で最前面）
function _makeLabel(THREE, lv, caption) {
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
  ctx.font = '28px sans-serif';
  ctx.fillText(caption, 128, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(180, 90, 1);
  return sprite;
}

// 地雷 1 基を生成・登録する。爆発で消費されると respawn.factory が同設定で再生成。
function _spawnMine(scene, THREE, m) {
  const mine = createMine({ THREE });
  mine.position.set(m.x, 0, MINE_Z);
  mine.userData.proximityTrigger = true;
  mine.userData.proximityRange = MINE_PROXIMITY;
  mine.userData.testAtkLv = m.lv;          // 爆発時にこの lv で被弾させる
  mine.userData.explosionDamage = MINE_DAMAGE;
  mine.userData._proxWasInRange = true;    // 生成時に範囲内でも即爆しない（離れて入り直すと再武装）
  mine.userData.respawn = {
    delayFrames: MINE_RESPAWN,
    factory: () => _spawnMine(scene, THREE, m),
  };
  scene.add(mine);
  registerBreakable(mine);
  return mine;
}

function _buildRoom(scene, THREE) {
  // 仮床（広め・フラット）。本番の床装飾は将来の専用ルーム化時に差し替える。
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 2600),
    new THREE.MeshLambertMaterial({ color: 0x2b313b }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.5, 100);
  floor.receiveShadow = true;
  scene.add(floor);

  // 仮の奥壁（深度の手がかり）
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 1600),
    new THREE.MeshLambertMaterial({ color: 0x1b2027 }),
  );
  wall.position.set(0, 800, -650);
  scene.add(wall);

  // atk_lv 別の地雷 + ラベル
  for (const m of MINES) {
    _spawnMine(scene, THREE, m);
    const label = _makeLabel(THREE, m.lv, m.label);
    label.position.set(m.x, LABEL_Y, MINE_Z);
    scene.add(label);
  }

  // 確定ドロップ試験用クレート（HP 3 種 + SP）— player 初期位置の手前に並べる
  //   仕様書 §18：loot 指定された prop は確率抽選を無視して 100% その item を出す
  //   apple(20%) / burger(40%) / meat(100%・最大) / sp(エメラルド)
  _spawnTestCrate(scene, THREE, -800,  80, 'hp_apple');
  _spawnTestCrate(scene, THREE, -700,  80, 'hp_burger');
  _spawnTestCrate(scene, THREE, -600,  80, 'hp_meat');
  _spawnTestCrate(scene, THREE, -500,  80, 'sp_tank');
}

// テスト crate：lootOverride 動作確認用。爆発しても自動リスポーンしないシンプル版。
function _spawnTestCrate(scene, THREE, x, z, lootKind) {
  const crate = createCrate({ THREE });
  crate.position.set(x, 0, z);
  crate.userData.lootOverride = lootKind;
  scene.add(crate);
  registerBreakable(crate);
}

// 通常ステージの背景要素（床・柱・背景書割）を隠す。Group / Mesh / 配列いずれも可。
function _hide(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) obj.forEach(o => { if (o) o.visible = false; });
  else obj.visible = false;
}

export function initActionTest(deps) {
  const { scene, THREE, spawnDummy, enemies, ground, backWallPillars, bgElements } = deps;
  if (!scene || !THREE) return;
  _enemies = enemies;
  // 固定の広い壁でカメラ追従壁を上書き（lv6 が壁に当たらず地面転がりも観察可）
  levelWalls.length = 0;
  levelWalls.push({ side: 'left',  x: -ARENA_HALF_X });
  levelWalls.push({ side: 'right', x:  ARENA_HALF_X });
  // 通常ステージの背景要素を隠し、テスト部屋の仮床・仮壁だけにする（切り分け）
  _hide(ground);
  _hide(backWallPillars);
  _hide(bgElements);
  _buildRoom(scene, THREE);
  // ダミー敵 2 体：性格の挙動差（dodge/guard 頻度）を見比べる用に brave / cunning を 1 体ずつ。
  //   頭上ラベル＝橙 BRAVE / 紫 CUNNING。基本 brave 雑魚・基本 cunning 雑魚の調整起点。
  //   死亡したら tickActionTest が同スロットへ即リスポーンする。
  if (spawnDummy) {
    _spawnDummy = spawnDummy;
    for (const slot of ENEMY_SLOTS) _spawnSlot(slot);
  }
  _built = true;
}

let _chipDemoPlaced = false;
export function tickActionTest() {
  // 自由移動テスト部屋：ウェーブ進行なし。地雷リスポーンは updateBreakables 側で進む。
  // 敵の即リスポーン：死亡フロー（dying）に入ったスロットを毎フレーム検出し、すぐ補充する。
  //   → 死亡演出（ゴア）は別個体として最後まで再生されつつ、戦う相手は途切れない。
  if (!_spawnDummy || !_enemies) return;
  const enemies = _enemies;
  for (const slot of ENEMY_SLOTS) {
    const alive = enemies.some(e =>
      e.personality === slot.personality &&
      (e.enemyType ?? 'enem01') === (slot.enemyType ?? 'enem01') &&
      e.isAlive && !e.dying && !e.removed);
    if (!alive) _spawnSlot(slot);
  }
  // 起動直後に 5 レアリティのチップを並べる（item-system が init 済みの前提・1 回のみ）
  //   後ろ側（z=600 ≒ プレイヤーから少し離れた奥）に並べ、磁石範囲外で観察できる位置に
  //   SB.dropBossChips もコンソールから呼べる（ボス確定 3+α の動作確認用）
  if (!_chipDemoPlaced && window.SB && typeof window.SB.dropItem === 'function') {
    _chipDemoPlaced = true;
    const xs = [-1000, -500, 0, 500, 1000];
    const kinds = ['chip_common', 'chip_uncommon', 'chip_rare', 'chip_epic', 'chip_legendary'];
    // z=450：プレイヤー初期 z=300 と地雷 z=700 の間に並べる
    kinds.forEach((k, i) => window.SB.dropItem(k, xs[i], 450));
  }
}

export function getActionTestDebugState() {
  return { stage: 'actionTest', built: _built };
}
