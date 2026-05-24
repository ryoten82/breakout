// 壊れ物プロップの共通配置ヘルパー
// 各ステージの decorate から配置リストを渡して呼ぶ。
//   list: [{ type, x, z, loot?, lootTable? }]
//     type: 'crate' | 'canister' | 'oc-container' | 'mine'
//     loot（任意）: 'hp_apple' | 'hp_burger' | 'hp_meat' | 'sp_tank'
//                  破壊時に確率抽選を無視して 100% その item を確定ドロップ
//     lootTable（任意）: CONTAINER_LOOT_TABLE のキー（例 'pre_boss_hp'）
//                       破壊時にこのテーブルで抽選（kind 既定テーブルの代わり）
// loot と lootTable が両方ある場合は loot を優先。
// 地雷は接近点火のため userData.proximityTrigger を立てる。

import { createCrate } from './factory/crate.js';
import { createCanister } from './factory/gas-canister.js';
import { createOcContainer } from './factory/oc-container.js';
import { createMine } from './factory/mine.js';
import { registerBreakable } from '../breakables.js';

const _FACTORY = {
  'crate':        (THREE, p) => createCrate({ THREE, preset: p?.preset }),
  'canister':     (THREE)    => createCanister({ THREE }),
  'oc-container': (THREE)    => createOcContainer({ THREE }),
  'mine':         (THREE)    => createMine({ THREE }),
};

export function placeBreakables(scene, THREE, list) {
  if (!scene || !THREE || !list) return;
  for (const p of list) {
    const make = _FACTORY[p.type];
    if (!make) continue;
    const mesh = make(THREE, p);
    mesh.position.set(p.x, 0, p.z ?? 0);
    if (p.type === 'mine') mesh.userData.proximityTrigger = true;
    if (p.loot) mesh.userData.lootOverride = p.loot;       // 確定ドロップ（dropItem の kind）
    if (p.lootTable) mesh.userData.lootTable = p.lootTable; // 専用抽選テーブルキー
    scene.add(mesh);
    registerBreakable(mesh);
  }
}
