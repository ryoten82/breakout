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

let _built = false;

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
}

// 通常ステージの背景要素（床・柱・背景書割）を隠す。Group / Mesh / 配列いずれも可。
function _hide(obj) {
  if (!obj) return;
  if (Array.isArray(obj)) obj.forEach(o => { if (o) o.visible = false; });
  else obj.visible = false;
}

export function initActionTest(deps) {
  const { scene, THREE, spawnDummy, ground, backWallPillars, bgElements } = deps;
  if (!scene || !THREE) return;
  // 固定の広い壁でカメラ追従壁を上書き（lv6 が壁に当たらず地面転がりも観察可）
  levelWalls.length = 0;
  levelWalls.push({ side: 'left',  x: -ARENA_HALF_X });
  levelWalls.push({ side: 'right', x:  ARENA_HALF_X });
  // 通常ステージの背景要素を隠し、テスト部屋の仮床・仮壁だけにする（切り分け）
  _hide(ground);
  _hide(backWallPillars);
  _hide(bgElements);
  _buildRoom(scene, THREE);
  // ダミー敵 1 体（自分の攻撃・コンボの当て先）
  if (spawnDummy) spawnDummy(0, 150, { maxHp: 100, instantRespawn: true });
  _built = true;
}

export function tickActionTest() {
  // 自由移動テスト部屋：ウェーブ進行なし。地雷リスポーンは updateBreakables 側で進む。
}

export function getActionTestDebugState() {
  return { stage: 'actionTest', built: _built };
}
