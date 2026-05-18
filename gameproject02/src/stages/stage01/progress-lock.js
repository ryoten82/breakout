// Stage 1 — 進行ロック（SOR 方式・最小版）
// 仕様：stages/stage01/layout.md §38-43
//
// ウェーブ発火時に「その時点のカメラ右端付近」で camera 右端をロックし、
// ウェーブ全滅で解除する。プレイヤーは左へは戻れる（camera 側のクランプだけ）。

import { setCamRightLimit, levelWalls } from '../../camera.js';

let _isLocked = false;
let _lockedAt = null;
let _arenaRightWall = null;  // ロック中だけ levelWalls に積む一時的な右壁

// アリーナを「右端 = arenaRightX」で閉じる。
// - 敵脱走防止の右壁を levelWalls に push（プレイヤーも越えられない）
// - カメラ右端は arenaRightX をベースに DEAD_ZONE 分手前に設定
//   （カメラが壁より少し手前で止まり、壁が画面右端に張り付いて見える）
export function lockArena(arenaRightX, deadzoneX = 380) {
  const wallX = arenaRightX;
  const camLimit = arenaRightX - deadzoneX;
  _isLocked = true;
  _lockedAt = camLimit;
  setCamRightLimit(camLimit);
  _arenaRightWall = { side: 'right', x: wallX };
  levelWalls.push(_arenaRightWall);
}

// 旧 API：後方互換。playerX 起点で固定幅のアリーナを作る用途
export function lockAtPlayer(playerX, deadzoneX = 380, arenaHalfWidth = 600) {
  lockArena(playerX + deadzoneX + arenaHalfWidth, deadzoneX);
}

export function release() {
  if (!_isLocked) return;
  _isLocked = false;
  _lockedAt = null;
  setCamRightLimit(null);
  if (_arenaRightWall) {
    const idx = levelWalls.indexOf(_arenaRightWall);
    if (idx >= 0) levelWalls.splice(idx, 1);
    _arenaRightWall = null;
  }
}

export function isLocked() { return _isLocked; }
export function getLockX() { return _lockedAt; }
