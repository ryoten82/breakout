// Stage 1 ランナー
// 仕様：stages/stage01/layout.md
// ロジック本体は ../wave-runner.js（共通）。本ファイルは stage01 固有の装飾と
// URL ベース遷移先解決だけを与える薄いアダプタ。

import { STAGE01_WAVES, ENEMY_TEMPLATES, STAGE01_META } from './waves.js';
import { addSectionMarkers } from './section-markers.js';
import { placeBreakables } from '../../props/place-props.js';
import { createWaveRunner } from '../wave-runner.js';

// 壊れ物配置：序盤コンテナ多め → 後半ボンベ多め。OC コンテナは W2 クリア後の合間に固定 1 個。
// すべてウェーブの合間（W1-W2 / W2-W3 / W3-W4）に分散させる。
const _STAGE1_PROPS = [
  // W1–W2 合間
  { type: 'crate',        x: 1450, z: -20 },
  { type: 'crate',        x: 1550, z:  25 },
  { type: 'crate',        x: 1700, z:   0 },
  { type: 'canister',     x: 1950, z: -15 },
  // W2–W3 合間（OC コンテナ：破壊で OC ジェム出現 → OC 選択へ）
  { type: 'oc-container', x: 3100, z:   0 },
  { type: 'crate',        x: 3450, z:  20 },
  { type: 'canister',     x: 3800, z:  15 },
  // W3–W4 合間（後半：ボンベ寄りだが密度は控えめに crate で間を空ける）
  { type: 'canister',     x: 4900, z: -20 },
  { type: 'crate',        x: 5200, z:   0 },
  { type: 'canister',     x: 5450, z:  20 },
];

// 被弾 state テスト用のデバッグ地雷は「アクションテスト部屋」（src/stages/action-test/）
// へ集約した（2026-05-20）。通しプレイの stage01 はクリーンな状態を維持する。

// 遷移先：stage02 は stage01 を完全 wrap するため、stage01 自身の固定 nextStageId を
// 見ると stage02 → stage02 にループする。
// 2026-05-19：URL ?stage= から sessionStorage 経由の自動遷移に変更したため、
//   現在ステージは window.__SB_SELECTED_STAGE（index.html で公開）を参照する。
function _resolveNextStageId() {
  const cur = window.__SB_SELECTED_STAGE || 'stage01';
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
      placeBreakables(deps.scene, deps.THREE, _STAGE1_PROPS);
    }
  },
  resolveNextStageId: _resolveNextStageId,
});

export const initStage01           = _runner.init;
export const tickStage01           = _runner.tick;
export const getStage01DebugState  = _runner.getDebug;
