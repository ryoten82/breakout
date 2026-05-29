// 遅延実行キュー（2026-05-29）
//   「N フレーム後にコールバックを 1 回だけ実行する」小さな共通基盤。
//   solar-flare の遅延ドーム発火（_pending）と breakables のリスポーン待ち（_respawnQueue）が
//   同じ「後ろから iterate → 期限で実行 → splice」パターンだったので統合。
//
//   ※ update() を毎フレーム 1 回呼ぶ前提（カウントダウン方式）。呼び元の update ループ内で 1 回呼ぶ。
//   ※ 実行順は登録逆順（splice 都合）だが、同一フレームに複数期限到来しても副作用は独立想定。
//   ※ fn 内で更に schedule() しても、その回の update では実行されない（次フレーム以降）。
//
//   使い方:
//     const q = createDelayedQueue();
//     q.schedule(() => doThing(), 90);   // 90F 後に実行
//     // 毎フレーム:
//     q.update();
export function createDelayedQueue() {
  let _entries = [];
  return {
    schedule(fn, delayFrames) {
      _entries.push({ fn, timer: delayFrames });
    },
    update() {
      for (let i = _entries.length - 1; i >= 0; i--) {
        if (--_entries[i].timer <= 0) {
          const fn = _entries[i].fn;
          _entries.splice(i, 1);
          fn();
        }
      }
    },
    clear() { _entries = []; },
    get size() { return _entries.length; },
  };
}
