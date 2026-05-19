// 黄黒警告テープ柄ドラム缶（廃工場プロップ）
// スケール：直径 35wu × 高さ 60wu（≒ 0.7m × 1.2m スケール）
//
// 構造：円筒本体（黄）+ 上下リング（暗黄）+ 中央に黄黒斜線テープ巻き 1 周（複数のスラブで近似）
// 配色：黄色ベース + 黒の斜線

const R = 17;     // 半径
const H = 60;     // 高さ
const SEG = 16;   // 円周分割
const COLOR_MAIN  = 0xf0c020;
const COLOR_RING  = 0xa07810;
const COLOR_BAND  = 0x101010;
const COLOR_TOP   = 0x806020;  // 上面（蓋）

export function createDrum({ THREE }) {
  const g = new THREE.Group();

  const matMain = new THREE.MeshLambertMaterial({ color: COLOR_MAIN });
  const matRing = new THREE.MeshLambertMaterial({ color: COLOR_RING });
  const matBand = new THREE.MeshLambertMaterial({ color: COLOR_BAND });
  const matTop  = new THREE.MeshLambertMaterial({ color: COLOR_TOP });

  // 本体（円筒）
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, SEG), matMain);
  body.position.y = H / 2;
  g.add(body);

  // 上下のリング（補強帯）— 半径少し大きめ・短い
  for (const fy of [0.12, 0.88]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 1, R + 1, 4, SEG), matRing);
    ring.position.y = H * fy;
    g.add(ring);
  }

  // 中央の黒帯（警告テープの黒側） — 円筒で 1 周
  const beltY = H * 0.5;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.5, 10, SEG), matBand);
  belt.position.y = beltY;
  g.add(belt);

  // 黄色の斜線（黒帯の上から斜めの黄色スラブを 4 本巻きつけて警告柄を近似）
  // 完全な斜線ではないが「黄黒の警告」感は十分出る
  const slabCount = 4;
  for (let i = 0; i < slabCount; i++) {
    const angle = (i / slabCount) * Math.PI * 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(R * 1.3, 9, 4), matMain);
    slab.position.set(Math.cos(angle) * (R + 0.4), beltY, Math.sin(angle) * (R + 0.4));
    slab.rotation.y = -angle;
    slab.rotation.z = Math.PI / 6;  // 30 度傾き
    g.add(slab);
  }

  // 上面（蓋・少し暗めで陰影をつける）
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R - 1, R - 1, 2, SEG), matTop);
  top.position.y = H + 1;
  g.add(top);

  for (const child of g.children) child.castShadow = true;

  g.userData.kind = 'breakable-drum';
  g.userData.size = { r: R, h: H };
  return g;
}

export const DRUM_DIMS = { r: R, h: H };
