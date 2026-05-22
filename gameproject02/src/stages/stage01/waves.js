// Stage 1 (CRUSHER 廃工場) — テストプレイ最小構成のウェーブデータ
// 仕様：stages/stage01/layout.md §27
//
// 【命名規約】
//   tier01..tier06 = 敵の強度ティア（このファイルで定義）
//   lv01..lv06     = プレイヤー攻撃のヒットレベル（hit-engine 側・別概念）
//   両者は名前が紛らわしいので明確に分ける（2026-05-18 切り分け）。
//
// 敵 AI 本体は zealous-hertz 本流マター。本最小構成では既存 spawnDummy に
// パラメータ差替えで投入する想定。tier03/tier05/tier06 が AI 未対応なら tier01 同等で代用。

export const ENEMY_TEMPLATES = {
  tier01: { maxHp: 40 },
  tier02: { maxHp: 35, enemyType: 'enem02', personality: 'cunning', atkCooldown: 60 },  // enem02 ジャンパー
  tier03: { maxHp: 80 },
  tier05: { maxHp: 120 },
  // tier06：中ボス級。死亡は特殊化せず通常ゴアスクラップ範囲内。
  // 演出の派手さ／バリエは別所で開発中の「ゴア・クリティカル」が担う。
  tier06: { maxHp: 60 },
};

// ウェーブ間隔は「最終スポーン → 次 triggerX ≒ 1200wu（約 1 画面）」で設計。
// 戦闘の緩急を出すため各ウェーブの合間に歩く空間を確保する（2026-05-23 拡張）。
export const STAGE01_WAVES = [
  {
    id: 'W1',
    section: 'S1',
    triggerX: 800,
    spawns: [
      { type: 'tier01', x: 1000 },
      { type: 'tier01', x: 1100 },
    ],
  },
  {
    id: 'W2',
    section: 'S2',
    triggerX: 2300,
    spawns: [
      { type: 'tier01', x: 2500 },
      { type: 'tier01', x: 2600 },
      { type: 'tier02', x: 2700, z: -80 },  // enem02 ジャンパー初登場
      { type: 'tier03', x: 2800 },
    ],
  },
  {
    id: 'W3',
    section: 'S2',
    triggerX: 4000,
    spawns: [
      { type: 'tier01', x: 4300 },
      { type: 'tier02', x: 4400, z: 80 },   // ジャンパー 2 体目
      { type: 'tier05', x: 4500 },
    ],
  },
  {
    id: 'W4',
    section: 'S3',
    triggerX: 5700,
    spawns: [
      { type: 'tier01', x: 6000 },
      { type: 'tier01', x: 6100 },
      { type: 'tier06', x: 6200 },
    ],
  },
];

export const STAGE01_META = {
  totalWaves: STAGE01_WAVES.length,
  worldXMin: 0,
  worldXMax: 6500,
  sectionBoundaries: [1700, 5100],
  // クリア後の遷移先（null なら GAME CLEAR）
  nextStageId: 'stage02',
};
