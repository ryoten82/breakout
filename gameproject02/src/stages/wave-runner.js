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
import { STATE } from '../states.js';

// 画面外スポーン用オフセット（walkin variant）：1 画面 ≒ 1244wu の概ね 2/3
const WALKIN_OFFSET_X = 800;
// 落下スポーン開始 Y（fall variant）：エレベーター（elevator.js spawnYHigh:760）と同等の高さ
const FALL_SPAWN_Y = 600;

function _isEnemyDead(e) {
  return !e || e.removed === true || e.isAlive === false;
}

// spawn variant の適用：spawnDummy 直後に位置/state を書き換える。
//   'ground'        : 既定（その場で出現）
//   'fall'          : 高所 y に持ち上げ fall_loop（updateEnemies の重力で着地）
//   'walkin_left'   : 目標 x より左にオフセット（プレイヤー後方/左奥から歩いてくる）
//   'walkin_right'  : 目標 x より右にオフセット（前方から歩いてくる）
function _applySpawnVariant(e, s) {
  const v = s.variant || 'ground';
  if (v === 'fall') {
    e.y = FALL_SPAWN_Y;
    e.vy = 0;
    e.state = STATE.fall_loop;
    if (e.mesh) e.mesh.position.y = e.y;   // 初フレームの地上チラ見え防止
  } else if (v === 'walkin_left') {
    e.x = s.x - WALKIN_OFFSET_X;
    if (e.mesh) e.mesh.position.x = e.x;
  } else if (v === 'walkin_right') {
    e.x = s.x + WALKIN_OFFSET_X;
    if (e.mesh) e.mesh.position.x = e.x;
  }
}

export function createWaveRunner(opts) {
  const {
    waves,
    meta,
    enemyTpl,
    decorate = null,
    resolveNextStageId = null,
    spawnOptsForWave = null,
    // 最終 wave 全滅時のフック。引数：{ x, z } = 最後の敵の最終位置（ボス位置として使える）
    onFinalWaveClear = null,
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
  // 最終ウェーブ撃破後、meta.clearWalkX 指定時はそこへ歩くまでクリアを保留する
  let _pendingClear = false;
  let _pendingClearNextId = null;

  // HUD 表示用：waves[0..idx-1] の中の !noLock wave 数（filler を除外したカウント）。
  // meta.totalWaves は呼び出し側で waves.filter(w => !w.noLock).length と一致させる。
  function _mainWavesUpTo(idx) {
    let n = 0;
    for (let i = 0; i < idx && i < waves.length; i++) if (!waves[i].noLock) n++;
    return n;
  }

  function _spawnWave(wave) {
    const spawned = [];
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
      _applySpawnVariant(e, s);
      spawned.push(e);
    }
    // noLock の filler wave は撃破追跡に積まない（残置 OK・進行を止めない）
    if (!wave.noLock) _activeWaveEnemies = spawned;
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
    _pendingClear = false;
    _pendingClearNextId = null;
    _started = true;
    updateWaveHud(0, meta.totalWaves, false);
  }

  function tick() {
    if (!_started) return;
    if (!_players || _players.length === 0) return;
    const p = _players[0];
    if (!p) return;

    // 0) 最終ウェーブ撃破後の保留クリア：clearWalkX へ歩き切ったら遷移
    if (_pendingClear) {
      if (p.x >= meta.clearWalkX) {
        _pendingClear = false;
        if (!isStageCleared()) triggerStageClear({ nextStageId: _pendingClearNextId });
      }
      return;
    }

    // 1) 未発火ウェーブの triggerX 到達チェック
    if (!_activeWave && _nextWaveIndex < waves.length) {
      const wave = waves[_nextWaveIndex];
      if (p.x >= wave.triggerX) {
        if (wave.noLock) {
          // フィラー wave：spawn だけして即進行（arena lock せず・撃破追跡しない）
          _spawnWave(wave);
          _nextWaveIndex++;
        } else {
          _activeWave = wave;
          // walkin_right の実スポーン位置（s.x + offset）が arena 右壁外にならないよう広げる
          const maxSpawnX = wave.spawns.reduce((m, s) => {
            const x = (s.variant === 'walkin_right') ? (s.x + WALKIN_OFFSET_X) : s.x;
            return Math.max(m, x);
          }, 0);
          lockArena(maxSpawnX + 200);
          _spawnWave(wave);
          updateWaveHud(_mainWavesUpTo(_nextWaveIndex + 1), meta.totalWaves, true);
          hideArrowHud();
        }
      }
    }

    // 2) 発火中ウェーブの全滅判定
    if (_activeWave) {
      const allDead = _activeWaveEnemies.every(_isEnemyDead);
      if (allDead) {
        const wasLastWave = (_nextWaveIndex === waves.length - 1);
        const completedWaveIndex = _nextWaveIndex;
        // 最終 wave 撃破時は敵リストクリア前にボス（最後の敵）位置を保存
        let bossPos = null;
        if (wasLastWave && _activeWaveEnemies.length > 0) {
          const last = _activeWaveEnemies[_activeWaveEnemies.length - 1];
          if (last && typeof last.x === 'number') {
            bossPos = { x: last.x, z: last.z ?? 0 };
          }
        }
        _activeWave = null;
        _activeWaveEnemies = [];
        _nextWaveIndex++;
        releaseLock();
        if (wasLastWave) {
          const nextId = resolveNextStageId ? resolveNextStageId() : (meta.nextStageId ?? null);
          updateWaveHud(meta.totalWaves, meta.totalWaves, false);
          hideArrowHud();
          // ステージ固有のボス撃破フック（OC ドロップ等）。triggerStageClear は OC 待ちなので順序は問題なし
          if (onFinalWaveClear) onFinalWaveClear(bossPos || { x: p.x, z: 0 });
          if (meta.clearWalkX != null) {
            // 最終ウェーブ後の「歩いて OC を取る余白」：到達までクリアを保留
            _pendingClear = true;
            _pendingClearNextId = nextId;
          } else if (!isStageCleared()) {
            triggerStageClear({ nextStageId: nextId });
          }
        } else {
          updateWaveHud(_mainWavesUpTo(_nextWaveIndex), meta.totalWaves, false);
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
