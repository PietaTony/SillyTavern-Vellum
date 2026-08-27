/**
 * 把 iframe 裡的 `console.warn`／`console.error` 與沒接住的例外**轉發給主頁**。
 *
 * 🔴 **為什麼需要**（Peter 2026-08-27）：卡片跑在 opaque origin 的沙箱 iframe 裡，
 * 它的 console 在 DevTools 上是**另一個 frame 的**，自動化與遠端（手機）都讀不到。
 * 於是「MVU 有沒有在跑、它叫了哪一支我們沒實作的 API」完全是黑的 ——
 * 而 `preamble.ts` 那層 Proxy 的警告**正是印在這裡**。
 * ⇒ 沒有這條轉發，前一輪的結論「實機沒有任何『還沒實作』警告」其實只證明了
 * 「**打到主頁的**呼叫沒有缺」，卡片自己那一側完全沒看到。
 *
 * 🔴 **不能直接把 console 的參數 postMessage 出去。** 卡片會丟 DOM 節點、Error、
 * 有環的物件進來，那些過不了結構化複製 —— 一 throw 就連原本的 console 都不會印，
 * 等於**為了看見錯誤而弄丟錯誤**。⇒ 在這一端先自己轉成字串，而且每一步都 try 住。
 *
 * 🔴 **要有上限、要去重。** 卡片每收到一則訊息就跑一輪，同一句警告會洗版，
 * 而洗版的警告等於沒有警告（`messageEdit.ts` 已經吃過這個教訓）。
 * ⇒ 同樣的內容只講一次，超過 `CAP` 種就說一句「之後的省略」然後閉嘴。
 *
 * ⚠️ **原本的 console 照樣要印。** 這是加一條線，不是換一條線 ——
 * 在 DevTools 裡選到那個 frame 的人不該因此少看到東西。
 */
export const LOG_SHIM = /* js */ `
  var LOG_CAP = 40, logSeen = {}, logCount = 0;
  function logText(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i], s;
      try {
        if (a instanceof Error) s = a.name + ': ' + a.message + (a.stack ? ' | ' + String(a.stack).split('\\n')[1] : '');
        else if (typeof a === 'string') s = a;
        else if (a && a.nodeName) s = '<' + String(a.nodeName).toLowerCase() + '>';
        else s = JSON.stringify(a);
      } catch (e) { try { s = String(a); } catch (e2) { s = '[無法轉成字串]'; } }
      if (s === undefined) s = String(a);
      out.push(s.length > 300 ? s.slice(0, 300) + '…' : s);
    }
    return out.join(' ').slice(0, 600);
  }
  function sendLog(level, args) {
    try {
      var text = logText(args);
      if (!text || logSeen[text]) return;          /* 同一句只講一次 */
      logSeen[text] = 1;
      if (logCount >= LOG_CAP) return;
      logCount++;
      if (logCount === LOG_CAP) text += '（同一個 frame 的警告已達上限，之後的省略）';
      parent.postMessage({ __vellumLog: { level: level, text: text, frame: window.name || '' } }, '*');
    } catch (e) { /* 轉發失敗不可以影響卡片 —— 它只是診斷用的一條線 */ }
  }
  ['warn', 'error'].forEach(function (level) {
    var orig = console[level] ? console[level].bind(console) : function () {};
    console[level] = function () {
      sendLog(level, Array.prototype.slice.call(arguments));
      return orig.apply(null, arguments);          /* 原本的照樣印 */
    };
  });
  /* 🔴 沒接住的例外最重要 —— 卡片一支腳本掛掉，從主頁看是「什麼都沒發生」。 */
  addEventListener('error', function (e) {
    sendLog('error', ['未接住的例外：', e.error || e.message, '@', (e.filename || '') + ':' + e.lineno]);
  });
  addEventListener('unhandledrejection', function (e) {
    sendLog('error', ['沒有人接的 Promise：', e.reason]);
  });
`;
