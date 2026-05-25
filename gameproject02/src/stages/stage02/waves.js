// Stage 2 — ウェーブデータ
// 敵編成の骨格は Stage 1 と共用しつつ、W4 のボスを midboss01（シールドガーダー）へ
// 差し替える。Stage 1 と完全な独立化は将来予定（stages/stage02/README.md「移管タスク」）。
//
// Stage 2 固有な META：
//   - worldXMax：ウェーブ拡張ぶん広い（6500→6900）
//   - clearWalkX：最終ウェーブ撃破後、ここまで歩くとクリア遷移
//     ※ 2026-05-23：boss 撃破時に OC ジェム直接ドロップ化したため clearWalkX 廃止

import { STAGE01_WAVES, ENEMY_TEMPLATES } from '../stage01/waves.js';

// midboss01（シールドガーダー）テンプレート追加。HP 300 に統一。
export const STAGE02_ENEMY_TEMPLATES = {
  ...ENEMY_TEMPLATES,
  midboss01: { enemyType: 'midboss01', maxHp: 300, personality: 'berserker', atkCooldown: 75 },
};

// W4：midboss01 + 雑魚 4 体の乱戦構成。シールドガーダーを単体封殺できないよう包囲圧力を追加。
export const STAGE02_WAVES = STAGE01_WAVES.map(w => {
  if (w.id !== 'W4') return w;
  return {
    ...w,
    spawns: [
      { type: 'midboss01', x: 6200, variant: 'fall' },            // 中ボス：正面から降臨
      { type: 'tier01',    x: 6050, variant: 'walkin_right' },    // 左側から歩き込み
      { type: 'tier01',    x: 6350, variant: 'walkin_left' },     // 右側から歩き込み（挟み）
      { type: 'tier01',    x: 6100, z: -50, variant: 'fall' },    // 奥から落下（奥行き圧力）
      { type: 'tier01',    x: 6300, z:  50, variant: 'fall' },    // 手前から落下
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
