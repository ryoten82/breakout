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
import { createMine } from '../../props/factory/mine.js';
import { registerBreakable } from '../../breakables.js';

// 終盤（BOSS triggerX=5400 手前）に地雷を散布。
// プレイヤー接近 400wu で点火 → 2 秒カウントダウン → 爆発で lv4 打ち上げ。
function _placeMinesForTest(scene, THREE) {
  // BOSS triggerX=5400 周辺に 3 個（boss アリーナの導入で踏みやすい位置）
  const placements = [
    { x: 5500, z:  -50 },
    { x: 5650, z:   40 },
    { x: 5800, z:  -10 },
  ];
  for (const p of placements) {
    const mesh = createMine({ THREE });
    mesh.position.set(p.x, 0, p.z);
    mesh.userData.proximityTrigger = true;
    scene.add(mesh);
    registerBreakable(mesh);
  }
}

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
      _placeMinesForTest(deps.scene, deps.THREE);
    }
  },
  spawnOptsForWave: (wave) => ({ _isBossWave: wave.isBoss === true }),
});

export const initStage03           = _runner.init;
export const tickStage03           = _runner.tick;
export const getStage03DebugState  = _runner.getDebug;
