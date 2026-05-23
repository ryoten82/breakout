// Stage 2 — ウェーブデータ
// 敵編成は Stage 1 と完全共用（STAGE01_WAVES / ENEMY_TEMPLATES を再 export）。
// Stage 2 固有なのは META のみ：
//   - worldXMax：ウェーブ拡張ぶん広い
//   - clearWalkX：最終ウェーブ撃破後、ここまで歩くとクリア遷移（手前に OC コンテナを置く余白）

import { STAGE01_WAVES, ENEMY_TEMPLATES } from '../stage01/waves.js';

export const STAGE02_WAVES = STAGE01_WAVES;
export const STAGE02_ENEMY_TEMPLATES = ENEMY_TEMPLATES;

export const STAGE02_META = {
  totalWaves: STAGE01_WAVES.length,
  worldXMin: 0,
  worldXMax: 6900,
  sectionBoundaries: [1700, 5100],
  // 最終ウェーブ撃破後、ここまで歩くとステージクリア（手前の OC コンテナを取る余白）
  clearWalkX: 6650,
  nextStageId: 'stage03',
};
