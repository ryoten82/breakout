// src/stages/index.js
// ステージ実装のエントリポイント。各ステージモジュールはここから登録する。
// index.html からは <script type="module"> で読み込む想定。

import * as stage01 from './stage01/index.js';
import * as stage02 from './stage02/index.js';
import * as stage03 from './stage03/index.js';
import * as actionTest from './action-test/index.js';
import * as bossTest from './boss-test/index.js';

export const stageRegistry = {
  stage01,
  stage02,
  stage03,
  actionTest,
  bossTest,
};

export function registerStage(id, module) {
  stageRegistry[id] = module;
}

// よく使うものは直 export しておく（呼び出し側の import を短く）
export const { initStage01, tickStage01, getStage01DebugState } = stage01;
export const { initStage02, tickStage02, getStage02DebugState } = stage02;
export const { initStage03, tickStage03, getStage03DebugState } = stage03;
export const { initActionTest, tickActionTest, getActionTestDebugState } = actionTest;
export const { initBossTest, tickBossTest, getBossTestDebugState } = bossTest;
