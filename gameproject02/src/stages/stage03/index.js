// Stage 3 ランナー — プロト第一手（核機能のみ）
// 仕様：stages/stage03/deep-design.md
//
// MVP として：
//   - 4 mob waves + 1 BOSS の発火・進行ロック・全滅検知
//   - セクション境界マーカー（central-plant.js）
//   - 既存 stage01 の汎用モジュール（progress-lock / wave-hud / clear）を流用
//
// 別タスクで追加予定：
//   - 量産ライン（雑魚モデルをグレーアウト＋コンベア）
//   - D 段階の巨大発光球体＋ケーブル
//   - ボス台座（円形シャフトリフト）
//   - ボス intro 演出シーケンス（6 秒・暗→バツン→ブザー→赤→WARNING→せり上がり）

import { STAGE03_WAVES, ENEMY_TEMPLATES, STAGE03_META } from './waves.js';
import { lockArena, release as releaseLock } from '../stage01/progress-lock.js';
import { initWaveHud, updateWaveHud } from '../stage01/wave-hud.js';
import { triggerStageClear, isStageCleared } from '../stage01/clear.js';
import { addCentralPlant } from './central-plant.js';
import { addSfBackdrop } from './sf-backdrop.js';
import { showArrowHud, hideArrowHud } from '../arrow-hud.js';
import { levelWalls } from '../../camera.js';

let _spawnDummy = null;
let _players = null;
let _enemies = null;

let _nextWaveIndex = 0;
let _activeWave = null;
let _activeWaveEnemies = [];
let _started = false;

export function initStage03(deps) {
  _spawnDummy = deps.spawnDummy;
  _players = deps.players;
  _enemies = deps.enemies;
  initWaveHud();
  // ステージ範囲の静的壁を登録（左端 x=0 / 右端 x=6000）
  const hasLeft  = levelWalls.some(w => w.side === 'left'  && w.x === STAGE03_META.worldXMin);
  const hasRight = levelWalls.some(w => w.side === 'right' && w.x === STAGE03_META.worldXMax);
  if (!hasLeft)  levelWalls.push({ side: 'left',  x: STAGE03_META.worldXMin });
  if (!hasRight) levelWalls.push({ side: 'right', x: STAGE03_META.worldXMax });
  // SF 背景骨格（既存柱組を非表示にして青系パネル＋LED に差し替え＋床も SF 化）
  if (deps.scene && deps.THREE) {
    addSfBackdrop({
      scene: deps.scene,
      THREE: deps.THREE,
      backWallPillars: deps.backWallPillars,
      bgElements: deps.bgElements,
      ground: deps.ground,
    });
    // セクション境界マーカー
    addCentralPlant(deps.scene, deps.THREE);
  }
  _nextWaveIndex = 0;
  _activeWave = null;
  _activeWaveEnemies = [];
  _started = true;
  updateWaveHud(0, STAGE03_META.totalWaves, false);
}

function isEnemyDead(e) {
  return !e || e.removed === true || e.isAlive === false;
}

function spawnWave(wave) {
  _activeWaveEnemies = [];
  for (const s of wave.spawns) {
    const tpl = ENEMY_TEMPLATES[s.type] || {};
    const opts = {
      maxHp: tpl.maxHp,
      instantRespawn: false,
      _stageEnemyType: s.type,
      _isBossWave: wave.isBoss === true,
    };
    const e = _spawnDummy(s.x, s.z ?? 0, opts);
    _activeWaveEnemies.push(e);
  }
}

export function tickStage03() {
  if (!_started) return;
  if (!_players || _players.length === 0) return;
  const p = _players[0];
  if (!p) return;

  // 1) 未発火ウェーブの triggerX 到達チェック
  if (!_activeWave && _nextWaveIndex < STAGE03_WAVES.length) {
    const wave = STAGE03_WAVES[_nextWaveIndex];
    if (p.x >= wave.triggerX) {
      _activeWave = wave;
      // アリーナ右端 = ウェーブの最右端スポーン + 余白
      const maxEnemyX = wave.spawns.reduce((m, s) => Math.max(m, s.x), 0);
      lockArena(maxEnemyX + 200);
      // TODO: BOSS の場合はここで boss-intro シーケンスを呼ぶ（別タスク）
      spawnWave(wave);
      updateWaveHud(_nextWaveIndex + 1, STAGE03_META.totalWaves, true);
      hideArrowHud();
    }
  }

  // 2) 発火中ウェーブの全滅判定
  if (_activeWave) {
    const allDead = _activeWaveEnemies.every(isEnemyDead);
    if (allDead) {
      const wasLastWave = (_nextWaveIndex === STAGE03_WAVES.length - 1);
      _activeWave = null;
      _activeWaveEnemies = [];
      _nextWaveIndex++;
      releaseLock();
      if (wasLastWave) {
        if (!isStageCleared()) triggerStageClear({ nextStageId: STAGE03_META.nextStageId });
        updateWaveHud(STAGE03_META.totalWaves, STAGE03_META.totalWaves, false);
        hideArrowHud();
      } else {
        updateWaveHud(_nextWaveIndex, STAGE03_META.totalWaves, false);
        showArrowHud();
      }
    }
  }
}

// デバッグ用：window.SB.stage03() で内部状態を覗ける
export function getStage03DebugState() {
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
