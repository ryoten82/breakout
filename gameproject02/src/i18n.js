// i18n 雛形（B案・ja のみ）
//
// 使い方:
//   import { t, setLocale, register, I18N } from './i18n.js';
//   t('hud.combo')                       // → 'COMBO'
//   t('chip.flavor.guardianModule')      // → 'このチップは再取得できないから大切にね'
//   t('debug.hitbox', { state: 'ON' })   // → '1: ヒットボックス / コリジョン [ON]'
//
// 設計方針:
// - 当面は ja のみ。en は将来 register('en', {...}) で差し込み
// - 未登録キーは key 文字列をそのまま返す（翻訳漏れの可視化）
// - パラメータは {name} 形式で補間
// - 既存の textContent 直書きは無理に置換しない。新規 UI 文字列から t() で書く運用

const DICTS = {
  ja: {
    // アプリ基本
    'app.title':              'SCRAP BLITZ',

    // HUD
    'hud.combo':              'COMBO',
    'hud.hp':                 'HP',
    'hud.sp':                 'SP',

    // ステート HUD
    'state.unset':            '未設定',
    'state.player':           'PLAYER',
    'state.enemy':            'ENEMY',

    // デバッグトグル（{state} に ON/OFF などを補間）
    'debug.hitbox':           '1: ヒットボックス / コリジョン [{state}]',
    'debug.pixelShader':      '2: ピクセルシェーダー [{state}]',
    'debug.slowmo':           '3: スロー再生 [{state}]',
    'debug.enemyAi':          '4: 敵AI [{state}]',
    'debug.singleEnemy':      '5: 敵 1 体モード [{state}]',
    'debug.fps':              '{value} FPS',

    // チップ：名前・効果概要・フレーバー（将来追加用の置き場）
    // 命名規則: chip.name.<id> / chip.desc.<id> / chip.flavor.<id>
    'chip.flavor.guardianModule': 'このチップは再取得できないから大切にね',
  },
};

let _locale = 'ja';
const FALLBACK = 'ja';

function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function setLocale(code) {
  if (DICTS[code]) _locale = code;
}

export function getLocale() {
  return _locale;
}

export function register(locale, entries) {
  if (!DICTS[locale]) DICTS[locale] = {};
  Object.assign(DICTS[locale], entries);
}

export function t(key, params) {
  const dict = DICTS[_locale] ?? {};
  const fallback = DICTS[FALLBACK] ?? {};
  const raw = (key in dict) ? dict[key]
            : (key in fallback) ? fallback[key]
            : key;
  return interpolate(raw, params);
}

export const I18N = { t, setLocale, getLocale, register };
