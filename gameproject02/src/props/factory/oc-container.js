// OVERCLOCK コンテナ（紫の特別コンテナ）
// 通常の黄色コンテナ（crate 104³）の約 2 倍サイズ・hp 3（3 発殴って破壊）。
// 破壊すると OC ジェムが出現する（breakables.js → onOcContainerBreak）。
//
// 構造：本体（立方体）+ 黒帯 + 縦リブ 4 本 + 前後面の発光コアパネル

const W = 190;  // crate 104 の約 1.8 倍（「2 倍近く」）
const H = 190;
const D = 190;
const COLOR_MAIN  = 0x6a2596;  // 紫ベース
const COLOR_RIB   = 0x3f1659;  // 濃い紫リブ
const COLOR_FRAME = 0x140520;  // ほぼ黒の意匠線
const COLOR_GLOW  = 0xcc66ff;  // OC を示す発光コア

export function createOcContainer({ THREE }) {
  const g = new THREE.Group();

  const matMain  = new THREE.MeshLambertMaterial({ color: COLOR_MAIN });
  const matRib   = new THREE.MeshLambertMaterial({ color: COLOR_RIB });
  const matFrame = new THREE.MeshLambertMaterial({ color: COLOR_FRAME });
  const matGlow  = new THREE.MeshLambertMaterial({
    color: COLOR_GLOW, emissive: COLOR_GLOW, emissiveIntensity: 0.85,
  });

  // 本体
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), matMain);
  body.position.y = H / 2;
  g.add(body);

  // 中央水平の黒帯
  const beltH = 20;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, beltH, D + 0.5), matFrame);
  belt.position.y = H * 0.5;
  g.add(belt);

  // 縦リブ（4 本・四隅）
  const ribW = 9;
  for (const fx of [-1, 1]) {
    for (const fz of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(ribW, H + 1, ribW), matRib);
      rib.position.set(fx * (W / 2 - 7), H / 2, fz * (D / 2 - 7));
      g.add(rib);
    }
  }

  // 前後面（±X）の発光コアパネル：中に OC エネルギーが入っている演出
  for (const fx of [-1, 1]) {
    const core = new THREE.Mesh(new THREE.BoxGeometry(6, 60, 60), matGlow);
    core.position.set(fx * (W / 2 + 2), H * 0.5, 0);
    g.add(core);
  }

  for (const child of g.children) child.castShadow = true;

  g.userData.kind = 'breakable-oc-container';
  g.userData.size = { w: W, h: H, d: D };
  g.userData.hp   = 3;   // 3 発殴って破壊
  return g;
}

export const OC_CONTAINER_DIMS = { w: W, h: H, d: D };
