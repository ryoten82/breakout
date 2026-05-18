// Stage 3 (中央プラント / SF色のヤバい何か) — ウェーブデータ
// 仕様：stages/stage03/deep-design.md
//
// 構成：A〜E の 5 セクション、4 mob waves + 1 BOSS
//   A. 普通の廃工場（接続）  x=0-800     W1
//   B. SF 転換               x=800-2000  W2
//   C. 量産ライン            x=2000-3400 W3 + W4
//   D. ヤバさのピーク        x=3400-4800 （敵なし・演出時間）
//   E. ボス戦                x=4800-6000 BOSS
//
// 命名規約：tier01..tier06 は敵の強度ティア（プレイヤー攻撃 lv01..lv06 とは別軸）

export const ENEMY_TEMPLATES = {
  tier01: { maxHp: 40 },
  tier03: { maxHp: 80 },
  tier05: { maxHp: 120 },
  tier06: { maxHp: 60 },  // 中ボス級（特殊化なし）
};

export const STAGE03_WAVES = [
  {
    id: 'W1', section: 'A', triggerX: 500,
    spawns: [
      { type: 'tier01', x: 700 },
      { type: 'tier01', x: 750 },
    ],
  },
  {
    id: 'W2', section: 'B', triggerX: 1300,
    spawns: [
      { type: 'tier01', x: 1500 },
      { type: 'tier01', x: 1600 },
      { type: 'tier03', x: 1700 },
    ],
  },
  {
    id: 'W3', section: 'C', triggerX: 2400,
    spawns: [
      { type: 'tier01', x: 2700 },
      { type: 'tier01', x: 2800 },
      { type: 'tier01', x: 2900 },
      { type: 'tier03', x: 3000 },
    ],
  },
  {
    id: 'W4', section: 'C', triggerX: 3000,
    spawns: [
      { type: 'tier01', x: 3200 },
      { type: 'tier01', x: 3300 },
      { type: 'tier05', x: 3400 },
    ],
  },
  // BOSS：プロト第一手は tier06 を「ボス枠」として spawn（ボス intro 演出は別タスク）
  // ボスランダム化方針に従い特定キャラ依存せず、generic な強敵 1 体
  {
    id: 'BOSS', section: 'E', triggerX: 5400,
    isBoss: true,
    spawns: [
      { type: 'tier06', x: 5600 },
    ],
  },
];

export const STAGE03_META = {
  totalWaves: STAGE03_WAVES.length,
  worldXMin: 0,
  worldXMax: 6000,
  sectionBoundaries: [800, 2000, 3400, 4800],  // A/B, B/C, C/D, D/E
  // 各境界の色（A/B 普通工場・B/C SF 転換・C/D 警告・D/E ボス前赤予感）
  sectionBoundaryColors: [0xffaa22, 0x3399ff, 0xffaa22, 0xff3344],
};
