// Stage 2 ランナー（2026-05-23 独立化）
// 敵編成は Stage 1 と共用しつつ、独自 META（worldXMax / clearWalkX）と独自プロップ配置を持つ。
// 以前は stage01/index.js の薄ラッパーだったが、穴 3 個・OC 配置・プロップ差別化のため独立。
//
// 構成：
//   - ウェーブ系は共通ランナー（wave-runner.js）。waves は Stage 1 と共用
//   - 地面穴ギミックは汎用システム（hazards/floor-hole.js）を利用。Stage 2 固有の穴座標は
//     _STAGE2_HOLES で 3 個登録（W1-W2 / W2-W3 / W3-W4 の合間に分散）
//   - section-markers は Stage 1 と同じ境界値のため stage01 のものを流用

import { STAGE02_WAVES, STAGE02_ENEMY_TEMPLATES, STAGE02_META } from './waves.js';
import { addSectionMarkers } from '../stage01/section-markers.js';
import { placeBreakables } from '../../props/place-props.js';
import { createWaveRunner } from '../wave-runner.js';
import { initFloorHoleSystem, addFloorHole, tickFloorHoleSystem } from '../../hazards/floor-hole.js';
import { spawnOcGem } from '../../oc-gem.js';

// 壊れ物配置：序盤コンテナ → 後半ボンベ。
// 穴 3 個（x 1640-1980 / 3120-3460 / 4980-5320）に重ならないよう x をずらして配置する。
// 2026-05-23 改修：OC は boss 撃破時に直接ドロップ（onFinalWaveClear 経由）するため、
// 固定 OC コンテナ（x=6500）と clearWalkX 余白は廃止。
const _STAGE2_PROPS = [
  // W1–W2 合間（穴1 1640-1980 を回避）
  { type: 'crate',        x: 1300, z: -20 },
  { type: 'crate',        x: 1400, z:  25 },
  { type: 'crate',        x: 2050, z:   0 },
  { type: 'crate',        x: 2150, z: -15 },
  // W2–W3 合間（穴2 3120-3460 を回避・近接ボンベペア解消）
  { type: 'canister',     x: 2900, z:  20 },
  { type: 'crate',        x: 3600, z: -20 },
  { type: 'canister',     x: 3850, z: -25 },
  // W3–W4 合間（穴3 4980-5320 を回避・ボンベは穴前後に 1 個ずつ + crate で密度緩和）
  { type: 'canister',     x: 4700, z: -20 },
  { type: 'crate',        x: 4850, z:  20 },
  { type: 'canister',     x: 5500, z:  20 },
];

// Stage 2 固有の穴配置：ウェーブ合間に分散。敵スポーン x を一切含まない。
// 視覚色は FLOOR_HOLE_CONFIG のデフォルト（黄リム / 黒穴 / 青発光）を使う。
const _STAGE2_HOLES = [
  { xMin: 1640, xMax: 1980, zMin: -220, zMax: 220 },  // W1–W2 合間
  { xMin: 3120, xMax: 3460, zMin: -220, zMax: 220 },  // W2–W3 合間
  { xMin: 4980, xMax: 5320, zMin: -220, zMax: 220 },  // W3–W4 合間
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
  // 最終ウェーブ撃破時：boss 位置に OC ジェムを直接出現させる
  onFinalWaveClear: (bossPos) => {
    spawnOcGem(bossPos.x, bossPos.z ?? 0);
  },
});

export function initStage02(deps) {
  _runner.init(deps);
  // Stage 2 固有：汎用 floor-hole システムに 3 個登録
  initFloorHoleSystem(deps);
  for (const rect of _STAGE2_HOLES) addFloorHole(rect);
}

export function tickStage02() {
  _runner.tick();
  tickFloorHoleSystem();
}

export const getStage02DebugState = _runner.getDebug;
