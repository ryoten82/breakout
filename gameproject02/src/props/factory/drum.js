// ガスボンベ（廃工場プロップ・旧ドラム缶から差し替え）
// 旧版はプレイヤーサイズに対してドラム缶 1 個が大き過ぎ＆「典型ドラム缶」が
// テーマに馴染まなかったため、円筒形ガスボンベに置き換え（2026-05-19）。
//
// スケール：直径 36wu × 高さ 90wu（≒ 0.7m × 1.8m）。プレイヤー機体長 100wu より低めで
// 「立っている円筒タンク」のシルエット。胴体スリム + 上にバルブ的ディテール。
//
// 構造：胴体（円筒・黄）+ 下底リング（暗黄）+ 中央警告帯（黒）+ 肩の絞り（短円錐）
//       + 上面の蓋 + バルブ（小円柱 + ハンドル輪）

// 2026-05-19：旧値の 1.3 倍（R 18→23 / H_BODY 70→91 / H_NECK 12→16 / H_TOP 4→5）
const R       = 23;   // 胴体半径
const H_BODY  = 91;   // 円筒胴体の高さ
const H_NECK  = 16;   // 肩の絞り
const H_TOP   = 5;    // 蓋の厚み
const SEG     = 18;
const COLOR_MAIN  = 0xf0c020;
const COLOR_RING  = 0xa07810;
const COLOR_BAND  = 0x202020;
const COLOR_VALVE = 0x606060;
const COLOR_KNOB  = 0x303030;

export function createDrum({ THREE }) {
  const g = new THREE.Group();

  const matMain  = new THREE.MeshLambertMaterial({ color: COLOR_MAIN });
  const matRing  = new THREE.MeshLambertMaterial({ color: COLOR_RING });
  const matBand  = new THREE.MeshLambertMaterial({ color: COLOR_BAND });
  const matValve = new THREE.MeshLambertMaterial({ color: COLOR_VALVE });
  const matKnob  = new THREE.MeshLambertMaterial({ color: COLOR_KNOB });

  // 胴体（メイン円筒）
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H_BODY, SEG), matMain);
  body.position.y = H_BODY / 2;
  g.add(body);

  // 下底リング（補強）
  const baseRing = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.5, R + 1.5, 6, SEG), matRing);
  baseRing.position.y = 3;
  g.add(baseRing);

  // 中央の警告帯（黒）— 1 本だけ・ドラム缶感を抑える幅
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 9, SEG), matBand);
  band.position.y = H_BODY * 0.55;
  g.add(band);

  // 肩の絞り（円錐）— ボンベらしい上部の絞り込み
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.55, R, H_NECK, SEG), matMain,
  );
  neck.position.y = H_BODY + H_NECK / 2;
  g.add(neck);

  // 蓋（短い円筒・暗め）
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.5, R * 0.5, H_TOP, SEG), matRing,
  );
  cap.position.y = H_BODY + H_NECK + H_TOP / 2;
  g.add(cap);

  // バルブ柄（中央の小円柱）
  const valve = new THREE.Mesh(
    new THREE.CylinderGeometry(3.5, 3.5, 8, 10), matValve,
  );
  valve.position.y = H_BODY + H_NECK + H_TOP + 4;
  g.add(valve);

  // ハンドル輪（回転バルブ）— トーラスじゃなく薄い円盤で簡易表現
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 1.5, 10), matKnob,
  );
  knob.position.y = H_BODY + H_NECK + H_TOP + 9;
  g.add(knob);

  for (const child of g.children) child.castShadow = true;

  g.userData.kind = 'breakable-canister';
  g.userData.size = { r: R, h: H_BODY + H_NECK + H_TOP + 10 };
  return g;
}

export const DRUM_DIMS = { r: R, h: H_BODY + H_NECK + H_TOP + 10 };
