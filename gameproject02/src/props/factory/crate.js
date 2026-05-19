// 黄色コンテナ（折りたたみコンテナ風・廃工場プロップ）
// スケール：キャラ 1 体 ≒ 100wu。コンテナ実寸感覚は 1.5m × 0.8m × 0.8m → 75 × 40 × 40 wu
//
// 構造：本体（直方体）+ 上面の取手凹み 2 つ + 側面の縦リブ 4 本 + DECEPTICONS 風帯
// 配色：黄色ベース + 黒の補助線
//
// createCrate({ THREE }) → THREE.Group

const W = 75;  // 横幅
const H = 40;  // 高さ
const D = 40;  // 奥行
const COLOR_MAIN  = 0xf0c020;  // 黄
const COLOR_RIB   = 0xb88010;  // 暗い黄
const COLOR_FRAME = 0x202020;  // 黒帯

export function createCrate({ THREE }) {
  const g = new THREE.Group();

  const matMain  = new THREE.MeshLambertMaterial({ color: COLOR_MAIN });
  const matRib   = new THREE.MeshLambertMaterial({ color: COLOR_RIB });
  const matFrame = new THREE.MeshLambertMaterial({ color: COLOR_FRAME });

  // 本体
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), matMain);
  body.position.y = H / 2;
  g.add(body);

  // 黒帯（中央水平・側面表示）— 「DECEPTICONS」相当の意匠としての帯
  const beltH = 8;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, beltH, D + 0.5), matFrame);
  belt.position.y = H * 0.45;
  g.add(belt);

  // 縦リブ（4 本・側面の補強リブ）
  const ribW = 3;
  for (const fx of [-1, 1]) {
    for (const fz of [-0.55, 0.55]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, H + 1, ribW), matRib);
      rib.position.set(fx * (W / 2 - 6), H / 2, fz * (D / 2 - 6));
      g.add(rib);
    }
  }

  // 上面の取手凹み（2 つ・黒い四角でフェイク）
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
  for (const fx of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 6), handleMat);
    handle.position.set(fx * (W / 4), H + 0.5, 0);
    g.add(handle);
  }

  // 影
  for (const child of g.children) child.castShadow = true;

  g.userData.kind = 'breakable-crate';
  g.userData.size = { w: W, h: H, d: D };
  return g;
}

export const CRATE_DIMS = { w: W, h: H, d: D };
