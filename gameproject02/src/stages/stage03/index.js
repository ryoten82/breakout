// Stage 3 ランナー — プロト第一手（核機能のみ）
// 仕様：stages/stage03/deep-design.md
// ロジック本体は ../wave-runner.js（共通）。本ファイルは stage03 固有の装飾と
// boss wave 用の spawn opts 拡張だけを与える薄いアダプタ。
// Section A（下りエレベーター降下戦）は elevator.js に分離し、
// isElevatorActive() が true の間 wave 進行を抑制する。
//
// 別タスクで追加予定：
//   - 量産ライン（雑魚モデルをグレーアウト＋コンベア）
//   - D 段階の巨大発光球体＋ケーブル
//   - ボス台座（円形シャフトリフト）
//   - ボス intro 演出シーケンス（6 秒・暗→バツン→ブザー→赤→WARNING→せり上がり）

import { STAGE03_WAVES, ENEMY_TEMPLATES, STAGE03_META } from './waves.js';
import { addCentralPlant } from './central-plant.js';
import { addSfBackdrop } from './sf-backdrop.js';
import { createWaveRunner } from '../wave-runner.js';
import { placeBreakables } from '../../props/place-props.js';
import { initElevator, tickElevator, isElevatorActive, getElevatorDebugState } from './elevator.js';

// 壊れ物配置：序盤コンテナ → 後半ボンベ＋地雷。OC コンテナはボス前（D 区画）に固定 1 個。
// 地雷はボンベと効果が似るため x 位置を重ねない（地雷 x と canister x は別系列）。
const _STAGE3_PROPS = [
  // W2–W3 合間（序盤：コンテナ）
  { type: 'crate',        x: 2050, z: -20 },
  { type: 'crate',        x: 2200, z:  25 },
  { type: 'crate',        x: 2350, z:   0 },
  { type: 'canister',     x: 2600, z: -15 },
  // W3–W4 合間（ボンベ＋地雷の導入）
  { type: 'canister',     x: 3700, z: -20 },
  { type: 'canister',     x: 3850, z:  20 },
  { type: 'crate',        x: 4000, z:   0 },
  { type: 'mine',         x: 4200, z: -30 },
  { type: 'mine',         x: 4350, z:  30 },
  // W4–BOSS（D 区画）：地雷散布＋ボス前 OC コンテナ
  { type: 'mine',         x: 5100, z: -20 },
  { type: 'mine',         x: 5250, z:  25 },
  { type: 'oc-container', x: 5550, z:   0 },
  { type: 'canister',     x: 5750, z: -20 },
  { type: 'mine',         x: 5900, z:  30 },
  { type: 'canister',     x: 6000, z:  15 },
];

const _runner = createWaveRunner({
  waves: STAGE03_WAVES,
  meta: STAGE03_META,
  enemyTpl: ENEMY_TEMPLATES,
  decorate: (deps) => {
    if (deps.scene && deps.THREE) {
      addSfBackdrop({
        scene: deps.scene,
        THREE: deps.THREE,
        backWallPillars: deps.backWallPillars,
        bgElements: deps.bgElements,
        ground: deps.ground,
      });
      addCentralPlant(deps.scene, deps.THREE);
      placeBreakables(deps.scene, deps.THREE, _STAGE3_PROPS);
    }
  },
  spawnOptsForWave: (wave) => ({ _isBossWave: wave.isBoss === true }),
});

export function initStage03(deps) {
  _runner.init(deps);
  // Section A：下りエレベーター降下戦を起動（ステージ開始時点で乗車済み）
  initElevator(deps);
}

export function tickStage03() {
  // Section A：下りエレベーター降下戦中は通常ウェーブ進行を抑制
  if (isElevatorActive()) {
    tickElevator();
    return;
  }
  _runner.tick();
}

export function getStage03DebugState() {
  return {
    elevator: getElevatorDebugState(),
    ..._runner.getDebug(),
  };
}
