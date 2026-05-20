// 対車両地雷（PTKM-1R 風）
// 構造：4 本の傾斜スタビライザー脚 + 直立円筒胴体 + 上部センサーヘッド
// kind は 'breakable-canister' を流用（爆発・地雷ロジック共通）。

const R_BODY    = 18;   // 胴体半径
const H_BODY    = 50;   // 胴体高さ
const R_HEAD    = 14;   // センサーヘッド半径
const H_HEAD    = 18;   // センサーヘッド高さ
const LEG_LEN   = 42;   // 脚の長さ
const LEG_R_TOP = 1.8;  // 脚の上端太さ
const LEG_R_BOT = 3.2;  // 脚の下端太さ（接地側を太く）
const LEG_TILT  = Math.PI * 0.32;   // 鉛直からの開き角（≒58°）
const SEG       = 14;
const COLOR_BODY = 0x7a805a;   // オリーブ / カーキ（明るめ）
const COLOR_HEAD = 0x5a5f42;
const COLOR_LEG  = 0x40452e;
const COLOR_LENS = 0xff3030;

export function createMine({ THREE }) {
  const g = new THREE.Group();

  const matBody = new THREE.MeshLambertMaterial({ color: COLOR_BODY });
  const matHead = new THREE.MeshLambertMaterial({ color: COLOR_HEAD });
  const matLeg  = new THREE.MeshLambertMaterial({ color: COLOR_LEG });
  const matLens = new THREE.MeshLambertMaterial({ color: COLOR_LENS, emissive: COLOR_LENS, emissiveIntensity: 0.6 });

  // 4 本のスタビライザー脚（X 配置）
  // 各脚は wrap グループに入れて Y 軸まわりに 0/90/180/270° 回す。
  // 脚は wrap のローカル +X 方向に倒れる：rotation.z=-LEG_TILT で +X 側に頭が傾く。
  // CylinderGeometry はデフォルトで Y 軸方向に伸びる → 傾けた後で中心を持ち上げる。
  for (let i = 0; i < 4; i++) {
    const wrap = new THREE.Group();
    wrap.rotation.y = (i * Math.PI) / 2;

    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(LEG_R_TOP, LEG_R_BOT, LEG_LEN, 6),
      matLeg,
    );
    // 脚を +X 方向に倒す（rotation.z 負で右倒れ）
    leg.rotation.z = -LEG_TILT;
    // 上端ピボットを胴体下面 (0, H_ATTACH) に揃える。
    // CylinderGeometry は中心原点なので、z 回転後に中心を半長分オフセットする。
    const H_ATTACH = 8;   // 胴体下面への接続高さ
    leg.position.x = Math.sin(LEG_TILT) * (LEG_LEN / 2);
    leg.position.y = H_ATTACH - Math.cos(LEG_TILT) * (LEG_LEN / 2);
    wrap.add(leg);
    g.add(wrap);
  }

  // 胴体（円筒）— 脚の上端と同じ高さから上に伸ばす
  const H_BODY_BASE = 8;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R_BODY, R_BODY, H_BODY, SEG), matBody);
  body.position.y = H_BODY_BASE + H_BODY / 2;
  g.add(body);

  // 胴体上のリング装飾（PTKM の特徴的なフランジ）
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(R_BODY + 2, R_BODY + 2, 4, SEG), matHead);
  flange.position.y = H_BODY_BASE + H_BODY - 2;
  g.add(flange);

  // センサーヘッド
  const head = new THREE.Mesh(new THREE.CylinderGeometry(R_HEAD, R_HEAD, H_HEAD, SEG), matHead);
  head.position.y = H_BODY_BASE + H_BODY + H_HEAD / 2;
  g.add(head);

  // ヘッド上面の赤レンズ
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(R_HEAD * 0.4, R_HEAD * 0.4, 2, 10), matLens);
  lens.position.y = H_BODY_BASE + H_BODY + H_HEAD + 1;
  g.add(lens);

  // 影は重い・少数なので主要パーツのみ
  body.castShadow = true;
  head.castShadow = true;

  const TOTAL_H = H_BODY_BASE + H_BODY + H_HEAD + 2;
  g.userData.kind = 'breakable-canister';
  g.userData.size = { r: Math.max(R_BODY, Math.sin(LEG_TILT) * LEG_LEN), h: TOTAL_H };
  return g;
}

export const MINE_DIMS = { r: 36, h: 80 };
