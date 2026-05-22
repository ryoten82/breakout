// Stage 2 ランナー（2026-05-23 独立化）
// 敵編成は Stage 1 と共用しつつ、独自 META（worldXMax / clearWalkX）と独自プロップ配置を持つ。
// 以前は stage01/index.js の薄ラッパーだったが、穴 3 個・OC 配置・プロップ差別化のため独立。
//
// 構成：
//   - ウェーブ系は共通ランナー（wave-runner.js）。waves は Stage 1 と共用
//   - 地面穴ギミック（floor-hazard.js）は Stage 2 固有
//   - section-markers は Stage 1 と同じ境界値のため stage01 のものを流用

import { STAGE02_WAVES, STAGE02_ENEMY_TEMPLATES, STAGE02_META } from './waves.js';
import { addSectionMarkers } from '../stage01/section-markers.js';
import { placeBreakables } from '../../props/place-props.js';
import { createWaveRunner } from '../wave-runner.js';
import { initFloorHazard, tickFloorHazard } from './floor-hazard.js';

// 壊れ物配置：序盤コンテナ多め → 後半ボンベ多め。OC コンテナは最終ウェーブ後（clearWalkX 手前）。
// 穴 3 個（x 1640-1980 / 3120-3460 / 4980-5320）に重ならないよう x をずらして配置する。
const _STAGE2_PROPS = [
  // W1–W2 合間（穴1 1640-1980 を回避）
  { type: 'crate',        x: 1300, z: -20 },
  { type: 'crate',        x: 1400, z:  25 },
  { type: 'crate',        x: 2050, z:   0 },
  { type: 'crate',        x: 2150, z: -15 },
  // W2–W3 合間（穴2 3120-3460 を回避）
  { type: 'canister',     x: 2900, z:  20 },
  { type: 'crate',        x: 3600, z: -20 },
  { type: 'canister',     x: 3750, z:  15 },
  { type: 'canister',     x: 3850, z: -25 },
  // W3–W4 合間（穴3 4980-5320 を回避・後半ボンベ多めの嫌がらせ帯）
  { type: 'canister',     x: 4700, z: -20 },
  { type: 'canister',     x: 4850, z:  20 },
  { type: 'canister',     x: 5450, z: -15 },
  { type: 'canister',     x: 5600, z:  20 },
  // 最終ウェーブ後（clearWalkX 6650 手前）：OC コンテナ
  { type: 'oc-container', x: 6500, z:   0 },
];

const _runner = createWaveRunner({
  waves: STAGE02_WAVES,
  meta: STAGE02_META,
  enemyTpl: STAGE02_ENEMY_TEMPLATES,
  decorate: (deps) => {
    if (deps.scene && deps.THREE) {
      addSectionMarkers(deps.scene, deps.THREE);
      placeBreakables(deps.scene, deps.THREE, _STAGE2_PROPS);
    }
  },
});

export function initStage02(deps) {
  _runner.init(deps);
  // Stage 2 固有：地面穴ギミック
  initFloorHazard(deps);
}

export function tickStage02() {
  _runner.tick();
  tickFloorHazard();
}

export const getStage02DebugState = _runner.getDebug;
