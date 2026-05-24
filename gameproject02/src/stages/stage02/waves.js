// Stage 2 — ウェーブデータ
// 敵編成の骨格は Stage 1 と共用しつつ、W4 のボスを midboss01（シールドガーダー）へ
// 差し替える。Stage 1 と完全な独立化は将来予定（stages/stage02/README.md「移管タスク」）。
//
// Stage 2 固有な META：
//   - worldXMax：ウェーブ拡張ぶん広い（6500→6900）
//   - clearWalkX：最終ウェーブ撃破後、ここまで歩くとクリア遷移
//     ※ 2026-05-23：boss 撃破時に OC ジェム直接ドロップ化したため clearWalkX 廃止

import { STAGE01_WAVES, ENEMY_TEMPLATES } from '../stage01/waves.js';

// midboss01（シールドガーダー）テンプレート追加。HP/性格/atkCooldown は action-test 既定に準拠。
export const STAGE02_ENEMY_TEMPLATES = {
  ...ENEMY_TEMPLATES,
  midboss01: { enemyType: 'midboss01', maxHp: 250, personality: 'berserker', atkCooldown: 75 },
};

// W4 のみ tier06 → midboss01 へ差し替え。他は Stage 1 と完全共用。
// （変更時は STAGE01_WAVES の構造に追従する。将来は専用配列へ独立化予定）
export const STAGE02_WAVES = STAGE01_WAVES.map(w => {
  if (w.id !== 'W4') return w;
  return {
    ...w,
    spawns: [
      { type: 'tier01',    x: 6000, variant: 'walkin_right' },
      { type: 'tier01',    x: 6100, variant: 'walkin_right' },
      { type: 'midboss01', x: 6200, variant: 'fall' },        // 仮ボス：シールドガーダー
    ],
  };
});

export const STAGE02_META = {
  totalWaves: STAGE02_WAVES.filter(w => !w.noLock).length,
  worldXMin: 0,
  worldXMax: 6900,
  sectionBoundaries: [1700, 5100],
  // 2026-05-23：boss 撃破時に OC ジェム直接ドロップに変更したため clearWalkX は廃止
  // （ボス位置で OC 取得 → triggerStageClear が OC 完了を待ってからバナー）
  nextStageId: 'stage03',
  // ミッション制限時間（秒）。0 到達で強制 GAMEOVER（撤退）
  timeLimitSec: 300,
};
