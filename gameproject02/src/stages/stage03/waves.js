// Stage 3 (中央プラント / SF色のヤバい何か) — ウェーブデータ
// 仕様：stages/stage03/deep-design.md
//
// 構成：A〜E の 5 セクション、エレベーター降下戦 + 3 mob waves + 1 BOSS
//   A. 下りエレベーター降下戦  x=0-800   （elevator.js・撃破ノルマ式の閉所戦）
//   B. SF 転換               x=800-2000  W2
//   C. 量産ライン            x=2000-3400 W3 + W4
//   D. ヤバさのピーク        x=3400-4800 （敵なし・演出時間）
//   E. ボス戦                x=4800-6000 BOSS
//
// ※ Section A（旧 W1）は下りエレベーター降下戦に置換（elevator.js・deep-design §7）。
//    STAGE03_WAVES は B 段階以降のみを管理する。
//
// 命名規約：tier01..tier06 は敵の強度ティア（プレイヤー攻撃 lv01..lv06 とは別軸）

export const ENEMY_TEMPLATES = {
  tier01: { maxHp: 40 },
  tier03: { maxHp: 80 },
  tier05: { maxHp: 120 },
  tier06: { maxHp: 60 },  // 中ボス級（特殊化なし）
};

// ウェーブ間隔は「最終スポーン → 次 triggerX ≒ 1200wu（約 1 画面）」で設計（2026-05-23 拡張）。
export const STAGE03_WAVES = [
  {
    id: 'W2', section: 'B', triggerX: 1300,
    spawns: [
      { type: 'tier01', x: 1500 },
      { type: 'tier01', x: 1600 },
      { type: 'tier03', x: 1700 },
    ],
  },
  {
    id: 'W3', section: 'C', triggerX: 2900,
    spawns: [
      { type: 'tier01', x: 3100 },
      { type: 'tier01', x: 3200 },
      { type: 'tier01', x: 3300 },
      { type: 'tier03', x: 3400 },
    ],
  },
  {
    id: 'W4', section: 'C', triggerX: 4600,
    spawns: [
      { type: 'tier01', x: 4800 },
      { type: 'tier01', x: 4900 },
      { type: 'tier05', x: 5000 },
    ],
  },
  // BOSS：プロト第一手は tier06 を「ボス枠」として spawn（ボス intro 演出は別タスク）
  // ボスランダム化方針に従い特定キャラ依存せず、generic な強敵 1 体
  {
    id: 'BOSS', section: 'E', triggerX: 6100,
    isBoss: true,
    spawns: [
      { type: 'tier06', x: 6300 },
    ],
  },
];

export const STAGE03_META = {
  totalWaves: STAGE03_WAVES.length,
  worldXMin: 0,
  worldXMax: 7000,
  sectionBoundaries: [800, 2300, 5200, 6000],  // A/B, B/C, C/D, D/E
  // 各境界の色（A/B 普通工場・B/C SF 転換・C/D 警告・D/E ボス前赤予感）
  sectionBoundaryColors: [0xffaa22, 0x3399ff, 0xffaa22, 0xff3344],
  // クリア後の遷移先（null = GAME CLEAR で停止）
  nextStageId: null,
};
