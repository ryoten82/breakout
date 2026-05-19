// Stage 3 ランナー — プロト第一手（核機能のみ）
// 仕様：stages/stage03/deep-design.md
// ロジック本体は ../wave-runner.js（共通）。本ファイルは stage03 固有の装飾と
// boss wave 用の spawn opts 拡張だけを与える薄いアダプタ。
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
    }
  },
  spawnOptsForWave: (wave) => ({ _isBossWave: wave.isBoss === true }),
});

export const initStage03           = _runner.init;
export const tickStage03           = _runner.tick;
export const getStage03DebugState  = _runner.getDebug;
