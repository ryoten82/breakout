// ============================================================
//  SCRAP BLITZ — input-system（分離 Phase: Step E-6）
//
//  入力ポーリング層を集約：
//    - keys / padKeys 状態（モジュール内に閉じる）
//    - inp(code)        キーボード OR ゲームパッドの統合参照
//    - action(name)     KEY_CONFIG 経由のアクション判定
//    - pollGamepad()    ゲームパッド毎フレームポーリング
//
//  ES Module として index.html から import される：
//    import {
//      initInputSystem, inp, action, pollGamepad,
//    } from './src/input-system.js';
//
//  initInputSystem(deps) で依存を一括注入：
//    - onPadStartPressed: () => void   ゲームパッド START rising edge コールバック（一時停止用）
//
//  KEY_CONFIG は src/config.js から ESM import。
//  keydown/keyup リスナーは初期化時にこのモジュール内で window に登録する。
//  方向キー（Arrow*/Space）はブラウザのスクロールを抑止するため preventDefault する。
// ============================================================

import { KEY_CONFIG } from './config.js';

const keys = {};
const padKeys = {};

let _onPadStartPressed = null;

export function initInputSystem(deps) {
  _onPadStartPressed = deps.onPadStartPressed;
  // keys[] を更新するベースリスナーをここで登録（debug toggle / ESC pause は別途リスナー）
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });
}

// ============================================================
//  キーボード OR ゲームパッドの統合参照
// ============================================================
export function inp(code) {
  return !!(keys[code] || padKeys[code]);
}

// アクション判定（KEY_CONFIG 参照・将来リバインド対応の統合口）
export function action(name) {
  const cfg = KEY_CONFIG[name];
  if (!cfg) return false;
  return !!(inp(cfg.kb) || (cfg.kb2 && inp(cfg.kb2)));
}

// ============================================================
//  ゲームパッド入力（標準マッピング）
//  キーボードと並列動作。padKeys に書き込み、inp() で統合参照する。
// ============================================================

// 標準ゲームパッドボタン → keys コード変換テーブル
const PAD_BUTTON_MAP = {
  0:  'Space',     // A / Cross    → ジャンプ
  2:  'KeyJ',      // X / Square   → 弱攻撃
  3:  'KeyK',      // Y / Triangle → 強攻撃
  4:  'KeyL',      // LB / L1      → セカンダリ（Lキー）
  5:  'KeyU',      // RB / R1      → メガクラッシュ専用
  7:  'KeyI',      // RT / R2      → ULT専用
  12: 'ArrowUp',   // D-pad ↑
  13: 'ArrowDown', // D-pad ↓
  14: 'ArrowLeft', // D-pad ←
  15: 'ArrowRight',// D-pad →
};

const PAD_AXIS_DEAD = 0.25; // スティックデッドゾーン
const PAD_START_BUTTON = 9; // 標準ゲームパッドの START ボタン（Options / Plus）
let _padStartWas = false;   // rising edge 検出用（一時停止トグル）

export function pollGamepad() {
  // padKeys をいったんリセット
  for (const k in padKeys) padKeys[k] = false;

  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  // インデックス固定だと再接続時にずれるため、最初の有効なパッドを使う
  const gp = Array.from(gamepads).find(g => g && g.connected);
  if (!gp) { _padStartWas = false; return; }

  // ボタン
  for (const [idx, code] of Object.entries(PAD_BUTTON_MAP)) {
    const btn = gp.buttons[idx];
    if (btn && btn.pressed) padKeys[code] = true;
  }

  // START ボタン：一時停止トグル（rising edge 検出・押しっぱなしで連発しない）
  const startBtn = gp.buttons[PAD_START_BUTTON];
  const startPressed = !!(startBtn && startBtn.pressed);
  if (startPressed && !_padStartWas) {
    if (_onPadStartPressed) _onPadStartPressed();
  }
  _padStartWas = startPressed;

  // 左スティック → 移動（Axis 0 = X, Axis 1 = Y）
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  if (ax < -PAD_AXIS_DEAD) padKeys['ArrowLeft']  = true;
  if (ax >  PAD_AXIS_DEAD) padKeys['ArrowRight'] = true;
  if (ay < -PAD_AXIS_DEAD) padKeys['ArrowUp']    = true;
  if (ay >  PAD_AXIS_DEAD) padKeys['ArrowDown']  = true;
}
