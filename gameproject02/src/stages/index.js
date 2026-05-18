// src/stages/index.js
// ステージ実装のエントリポイント。各ステージモジュールはここから登録する。
// index.html からは <script type="module"> で読み込む想定。

import * as stage01 from './stage01/index.js';

export const stageRegistry = {
  stage01,
};

export function registerStage(id, module) {
  stageRegistry[id] = module;
}

// よく使うものは直 export しておく（呼び出し側の import を短く）
export const { initStage01, tickStage01, getStage01DebugState } = stage01;
