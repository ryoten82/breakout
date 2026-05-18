// src/stages/index.js
// ステージ実装のエントリポイント。各ステージモジュールはここから登録する。
// 現状は雛形（実装未着手）。index.html からは将来このファイルを <script type="module"> で読み込む。

export const stageRegistry = {};

export function registerStage(id, module) {
  stageRegistry[id] = module;
}
