// 壊れ物プロップの共通配置ヘルパー
// 各ステージの decorate から配置リストを渡して呼ぶ。
//   list: [{ type, x, z }] — type は 'crate' | 'canister' | 'oc-container' | 'mine'
// 地雷は接近点火のため userData.proximityTrigger を立てる。

import { createCrate } from './factory/crate.js';
import { createCanister } from './factory/gas-canister.js';
import { createOcContainer } from './factory/oc-container.js';
import { createMine } from './factory/mine.js';
import { registerBreakable } from '../breakables.js';

const _FACTORY = {
  'crate':        (THREE) => createCrate({ THREE }),
  'canister':     (THREE) => createCanister({ THREE }),
  'oc-container': (THREE) => createOcContainer({ THREE }),
  'mine':         (THREE) => createMine({ THREE }),
};

export function placeBreakables(scene, THREE, list) {
  if (!scene || !THREE || !list) return;
  for (const p of list) {
    const make = _FACTORY[p.type];
    if (!make) continue;
    const mesh = make(THREE);
    mesh.position.set(p.x, 0, p.z ?? 0);
    if (p.type === 'mine') mesh.userData.proximityTrigger = true;
    scene.add(mesh);
    registerBreakable(mesh);
  }
}
