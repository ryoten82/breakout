// Stage 2 工場内部 — テスト用確定実装（2026-05-19）
// 仕様：stages/stage02/README.md（概念整理） / stages/stage01/layout.md（流用仕様）
//
// 構成：
//   - stage01 のウェーブシステム（4 waves, tier01..tier06）をそのまま流用
//   - 内部装飾（buildBackWallPillars / 概日床 / bgElements）も既存のまま流用
//   - exterior は適用しない（index.html 側で SELECTED_STAGE='stage02' 時は initStage01Exterior をスキップ）
//
// 将来：buildBackWallPillars の props/ 切り出しと waves.js の独立化を行う際、
//       本ファイルを「stage01 ラッパー」から完全独立実装に置き換える。
// 移管詳細：stages/stage02/README.md「移管タスク」

import { initStage01, tickStage01, getStage01DebugState } from '../stage01/index.js';

export function initStage02(deps) {
  // 現状は stage01 と完全同一の初期化（waves/progress-lock/wave-hud/clear/section-markers）
  initStage01(deps);
}

export const tickStage02 = tickStage01;
export const getStage02DebugState = getStage01DebugState;
