// Wave Runner — stage01 / stage03 共通の wave 進行ランナー
//
// stage 共通の挙動：
//   - フレーム毎に tick：プレイヤーが triggerX を超えたら spawn・camera 右端をロック
//   - 全滅で release・次の triggerX へ進行
//   - 最終 wave 全滅で STAGE CLEAR バナー + 次ステージへ遷移
//
// stage 固有部分は createWaveRunner の opts で注入：
//   - waves       : ウェーブデータ配列（waves.js の STAGE0N_WAVES）
//   - meta        : メタ情報（totalWaves / worldXMin / worldXMax / nextStageId）
//   - enemyTpl    : ENEMY_TEMPLATES（tier → maxHp 等）
//   - decorate    : 装飾セットアップ関数（init 時 1 回呼ばれる）
//   - resolveNextStageId : 最終 wave 時の遷移先解決（既定は meta.nextStageId）
//   - spawnOptsForWave   : 各 wave に応じた spawn opts 追加（boss 等の判別）

import { lockArena, release as releaseLock } from './stage01/progress-lock.js';
import { initWaveHud, updateWaveHud } from './stage01/wave-hud.js';
import { triggerStageClear, isStageCleared } from './stage01/clear.js';
import { showArrowHud, hideArrowHud } from './arrow-hud.js';
import { levelWalls } from '../camera.js';

function _isEnemyDead(e) {
  return !e || e.removed === true || e.isAlive === false;
}

export function createWaveRunner(opts) {
  const {
    waves,
    meta,
    enemyTpl,
    decorate = null,
    resolveNextStageId = null,
    spawnOptsForWave = null,
  } = opts;

  // クロージャ管理の内部状態
  let _spawnDummy = null;
  let _players = null;
  let _enemies = null;
  let _nextWaveIndex = 0;
  let _activeWave = null;
  let _activeWaveEnemies = [];
  let _started = false;
  let _onWaveClear = null;  // 非最終 wave クリア時コールバック（deps.onWaveClear から注入）

  function _spawnWave(wave) {
    _activeWaveEnemies = [];
    for (const s of wave.spawns) {
      const tpl = enemyTpl[s.type] || {};
      const base = {
        ...tpl,                       // tier テンプレートの全プロパティを展開（enemyType 等を含む）
        instantRespawn: false,
        _stageEnemyType: s.type,
      };
      const extra = spawnOptsForWave ? spawnOptsForWave(wave) : null;
      const finalOpts = extra ? { ...base, ...extra } : base;
      const e = _spawnDummy(s.x, s.z ?? 0, finalOpts);
      _activeWaveEnemies.push(e);
    }
  }

  function init(deps) {
    _spawnDummy = deps.spawnDummy;
    _players = deps.players;
    _enemies = deps.enemies;
    _onWaveClear = deps.onWaveClear ?? null;
    initWaveHud();
    if (decorate) decorate(deps);
    // ステージ範囲の静的壁を登録（重複防止）
    const hasLeft  = levelWalls.some(w => w.side === 'left'  && w.x === meta.worldXMin);
    const hasRight = levelWalls.some(w => w.side === 'right' && w.x === meta.worldXMax);
    if (!hasLeft)  levelWalls.push({ side: 'left',  x: meta.worldXMin });
    if (!hasRight) levelWalls.push({ side: 'right', x: meta.worldXMax });
    _nextWaveIndex = 0;
    _activeWave = null;
    _activeWaveEnemies = [];
    _started = true;
    updateWaveHud(0, meta.totalWaves, false);
  }

  function tick() {
    if (!_started) return;
    if (!_players || _players.length === 0) return;
    const p = _players[0];
    if (!p) return;

    // 1) 未発火ウェーブの triggerX 到達チェック
    if (!_activeWave && _nextWaveIndex < waves.length) {
      const wave = waves[_nextWaveIndex];
      if (p.x >= wave.triggerX) {
        _activeWave = wave;
        const maxEnemyX = wave.spawns.reduce((m, s) => Math.max(m, s.x), 0);
        lockArena(maxEnemyX + 200);
        _spawnWave(wave);
        updateWaveHud(_nextWaveIndex + 1, meta.totalWaves, true);
        hideArrowHud();
      }
    }

    // 2) 発火中ウェーブの全滅判定
    if (_activeWave) {
      const allDead = _activeWaveEnemies.every(_isEnemyDead);
      if (allDead) {
        const wasLastWave = (_nextWaveIndex === waves.length - 1);
        const completedWaveIndex = _nextWaveIndex;
        _activeWave = null;
        _activeWaveEnemies = [];
        _nextWaveIndex++;
        releaseLock();
        if (wasLastWave) {
          const nextId = resolveNextStageId ? resolveNextStageId() : (meta.nextStageId ?? null);
          if (!isStageCleared()) triggerStageClear({ nextStageId: nextId });
          updateWaveHud(meta.totalWaves, meta.totalWaves, false);
          hideArrowHud();
        } else {
          updateWaveHud(_nextWaveIndex, meta.totalWaves, false);
          showArrowHud();
          if (_onWaveClear) _onWaveClear(completedWaveIndex);
        }
      }
    }
  }

  function getDebug() {
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

  return { init, tick, getDebug };
}
