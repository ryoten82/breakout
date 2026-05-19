// Stage 1 ランナー
// 仕様：stages/stage01/layout.md
// ロジック本体は ../wave-runner.js（共通）。本ファイルは stage01 固有の装飾と
// URL ベース遷移先解決だけを与える薄いアダプタ。

import { STAGE01_WAVES, ENEMY_TEMPLATES, STAGE01_META } from './waves.js';
import { addSectionMarkers } from './section-markers.js';
import { createCrate } from '../../props/factory/crate.js';
import { createCanister } from '../../props/factory/gas-canister.js';
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

// 遷移先：stage02 は stage01 を完全 wrap するため、stage01 自身の固定 nextStageId を
// 見ると stage02 → stage02 にループする。URL の ?stage= を見て決定する。
function _resolveNextStageId() {
  const cur = new URLSearchParams(window.location.search).get('stage') || 'stage01';
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
    }
  },
  resolveNextStageId: _resolveNextStageId,
});

export const initStage01           = _runner.init;
export const tickStage01           = _runner.tick;
export const getStage01DebugState  = _runner.getDebug;
