// 黄色コンテナ（廃工場プロップ）
// スケール：プレイヤー機体長 ≒ 100wu。コンテナは 80×80×80 wu の正方体（壊れ箱）
//
// 構造：本体（立方体）+ 上面の取手凹み 2 つ + 側面の縦リブ 4 本 + 黒帯
// 配色：黄色ベース + 黒の補助線

// 2026-05-19：80 × 80 × 80 → 1.3 倍（104 × 104 × 104）でプレイヤー比の存在感を上げる
const W = 104;  // 横幅
const H = 104;  // 高さ
const D = 104;  // 奥行
const COLOR_MAIN  = 0xf0c020;
const COLOR_RIB   = 0xb88010;
const COLOR_FRAME = 0x202020;

export function createCrate({ THREE }) {
  const g = new THREE.Group();

  const matMain  = new THREE.MeshLambertMaterial({ color: COLOR_MAIN });
  const matRib   = new THREE.MeshLambertMaterial({ color: COLOR_RIB });
  const matFrame = new THREE.MeshLambertMaterial({ color: COLOR_FRAME });

  // 本体
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), matMain);
  body.position.y = H / 2;
  g.add(body);

  // 中央水平の黒帯（意匠線）
  const beltH = 12;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, beltH, D + 0.5), matFrame);
  belt.position.y = H * 0.5;
  g.add(belt);

  // 縦リブ（4 本・四隅）
  const ribW = 5;
  for (const fx of [-1, 1]) {
    for (const fz of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, H + 1, ribW), matRib);
      rib.position.set(fx * (W / 2 - 4), H / 2, fz * (D / 2 - 4));
      g.add(rib);
    }
  }

  // 上面の取手凹み（2 つ・黒い長方形）
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x101010 });
  for (const fx of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.BoxGeometry(22, 3, 8), handleMat);
    handle.position.set(fx * (W / 4), H + 1, 0);
    g.add(handle);
  }

  for (const child of g.children) child.castShadow = true;

  g.userData.kind = 'breakable-crate';
  g.userData.size = { w: W, h: H, d: D };
  return g;
}

export const CRATE_DIMS = { w: W, h: H, d: D };
