// Stage 1 ランナー — 最小構成
// 仕様：stages/stage01/layout.md
//
// フレーム毎に tickStage01() を呼ばれる。プレイヤーが triggerX を超えたら
// ウェーブをスポーン、camera 右端をロック、敵全滅でロック解除して次へ。
// 最後のウェーブを全滅させると STAGE CLEAR。

import { STAGE01_WAVES, ENEMY_TEMPLATES, STAGE01_META } from './waves.js';
import { lockArena, release as releaseLock } from './progress-lock.js';
import { initWaveHud, updateWaveHud } from './wave-hud.js';
import { triggerStageClear, isStageCleared } from './clear.js';
import { addSectionMarkers } from './section-markers.js';
import { showArrowHud, hideArrowHud } from '../arrow-hud.js';
import { createCrate } from '../../props/factory/crate.js';
import { createDrum } from '../../props/factory/drum.js';
import { levelWalls } from '../../camera.js';

let _spawnDummy = null;
let _players = null;
let _enemies = null;

let _nextWaveIndex = 0;            // 次に発火する候補 index
let _activeWave = null;            // 発火中のウェーブ
let _activeWaveEnemies = [];       // 発火中ウェーブで生んだ敵 ref（全滅判定用）
let _started = false;

export function initStage01(deps) {
  _spawnDummy = deps.spawnDummy;
  _players = deps.players;
  _enemies = deps.enemies;
  initWaveHud();
  // セクション境界マーカー（黄黒テープ × 2）— scene + THREE が渡された時だけ生成
  if (deps.scene && deps.THREE) {
    addSectionMarkers(deps.scene, deps.THREE);
    // 壊れ物（仮配置・破壊判定なし・見た目比較用）
    // - crate（コンテナ型）と drum（警告ドラム缶型）を交互に配置
    // - 配置位置は wave 間の「移動だけセクション」イメージ
    _placeBreakablesForTest(deps.scene, deps.THREE);
  }
  // ステージ範囲の静的壁を登録（左端 x=0 / 右端 x=4000）
  // 既に同条件で push 済みなら重複させない（複数回 init 対策）
  const hasLeft  = levelWalls.some(w => w.side === 'left'  && w.x === STAGE01_META.worldXMin);
  const hasRight = levelWalls.some(w => w.side === 'right' && w.x === STAGE01_META.worldXMax);
  if (!hasLeft)  levelWalls.push({ side: 'left',  x: STAGE01_META.worldXMin });
  if (!hasRight) levelWalls.push({ side: 'right', x: STAGE01_META.worldXMax });
  _nextWaveIndex = 0;
  _activeWave = null;
  _activeWaveEnemies = [];
  _started = true;
  // 初期表示：未発火状態（非表示）
  updateWaveHud(0, STAGE01_META.totalWaves, false);
}

// 壊れ物の仮配置（破壊判定なし・見た目比較用）
// 配置：W1 終了〜W2 trigger（x=1100〜1600）と W3 終了〜W4 trigger（x=3000〜3400）の合間に
function _placeBreakablesForTest(scene, THREE) {
  const placements = [
    // W1〜W2 セクション：コンテナ 2 個 + ドラム 1 個
    { type: 'crate', x: 1300, z:  -20 },
    { type: 'crate', x: 1380, z:   20 },
    { type: 'drum',  x: 1450, z:    0 },
    // W3〜W4 セクション：ドラム 2 個 + コンテナ 1 個
    { type: 'drum',  x: 3150, z:  -20 },
    { type: 'drum',  x: 3220, z:   20 },
    { type: 'crate', x: 3300, z:    0 },
  ];
  for (const p of placements) {
    const mesh = (p.type === 'crate') ? createCrate({ THREE }) : createDrum({ THREE });
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
  }
}

function isEnemyDead(e) {
  // dying プロセス完了 or 既に isAlive=false を死とみなす
  return !e || e.removed === true || e.isAlive === false;
}

function spawnWave(wave) {
  _activeWaveEnemies = [];
  for (const s of wave.spawns) {
    const tpl = ENEMY_TEMPLATES[s.type] || {};
    // mortal/instantRespawn 等の制御：ウェーブ敵は instantRespawn=false で 1 回だけ倒せばよい
    const opts = {
      maxHp: tpl.maxHp,
      instantRespawn: false,
      // 将来：lv 別 AI ハンドルが入ったら spawnDummy に渡す
      _stageEnemyType: s.type,
    };
    const e = _spawnDummy(s.x, s.z ?? 0, opts);
    _activeWaveEnemies.push(e);
  }
}

// デバッグ用：window.SB.stage で内部状態を覗ける
export function getStage01DebugState() {
  return {
    nextWaveIndex: _nextWaveIndex,
    activeWaveId: _activeWave ? _activeWave.id : null,
    activeEnemyStates: _activeWaveEnemies.map(e => ({
      x: e?.x, hp: e?.hp, isAlive: e?.isAlive, dying: e?.dying,
      dyingPhase: e?.dyingPhase, removed: e?.removed,
    })),
    playerX: _players?.[0]?.x,
    started: _started,
  };
}

export function tickStage01() {
  if (!_started) return;
  if (!_players || _players.length === 0) return;
  const p = _players[0];
  if (!p) return;

  // 1) 未発火ウェーブの triggerX 到達チェック（同時に複数走らせない・1 つずつ）
  if (!_activeWave && _nextWaveIndex < STAGE01_WAVES.length) {
    const wave = STAGE01_WAVES[_nextWaveIndex];
    if (p.x >= wave.triggerX) {
      _activeWave = wave;
      // アリーナ右端 = ウェーブの最右端スポーン + 余白。これで「敵から離れ過ぎる」感を抑える
      const maxEnemyX = wave.spawns.reduce((m, s) => Math.max(m, s.x), 0);
      lockArena(maxEnemyX + 200);
      spawnWave(wave);
      updateWaveHud(_nextWaveIndex + 1, STAGE01_META.totalWaves, true);
      hideArrowHud();
    }
  }

  // 2) 発火中ウェーブの全滅判定
  if (_activeWave) {
    const allDead = _activeWaveEnemies.every(isEnemyDead);
    if (allDead) {
      const wasLastWave = (_nextWaveIndex === STAGE01_WAVES.length - 1);
      _activeWave = null;
      _activeWaveEnemies = [];
      _nextWaveIndex++;
      releaseLock();
      if (wasLastWave) {
        if (!isStageCleared()) triggerStageClear({ nextStageId: STAGE01_META.nextStageId });
        updateWaveHud(STAGE01_META.totalWaves, STAGE01_META.totalWaves, false);
        hideArrowHud();
      } else {
        updateWaveHud(_nextWaveIndex, STAGE01_META.totalWaves, false);
        showArrowHud();
      }
    }
  }
}
