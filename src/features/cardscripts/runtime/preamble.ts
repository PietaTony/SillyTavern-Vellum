/**
 * 注入進每個卡片 iframe 的前導程式（M13 第二期）。
 *
 * 🔴 **這裡與酒館助手有一個刻意的分歧，而且是本專案唯一沒有照抄的一條。**
 * 酒館助手的 iframe **不加 `sandbox`** ⇒ 與主頁同源，`predefine.js:1` 第一行就是
 * `window._ = window.parent._`，卡片因此拿到**整個頁面的權限**。
 * 我們加 `sandbox="allow-scripts"`（**不給** `allow-same-origin`）⇒
 * `window.parent` 變成跨來源 ⇒ **那條橋必須改成 `postMessage`**。
 *
 * 🔴 **為什麼這樣還能相容**：卡片程式找全域的寫法是掃
 * `[window, window.parent, window.top]`（實測 14 處）⇒ 把東西定義在 iframe 自己的
 * `window` 上，第一個 scope 就命中。⚠️ 真的要直接操作主頁 DOM／`localStorage` 的卡片會壞。
 *
 * 🔴 **`Mvu` 不在卡片裡** —— 那支全文只有一行 `import 'https://…/bundle.js'`，code 在 CDN 上。
 * 它載入後把自己掛到 window ⇒ 這裡提供 `waitGlobalInitialized()`／`initializeGlobal()`
 * 讓同一個 iframe 裡的腳本彼此對得上。
 */

/**
 * 卡片實際用到的第三方全域（實掃那 2 MB 得到）。與酒館助手同一個 CDN。
 * ⚠️ **`toastr` 不在這裡** —— 我們自己提供一個假的（見下面的 PREAMBLE），
 * 把卡片的提示轉給主頁的 `ToastStack` 顯示。少一支 CDN、少一條外連。
 */
export const VENDOR = [
  'https://testingcf.jsdelivr.net/npm/lodash/lodash.min.js',
  'https://testingcf.jsdelivr.net/npm/jquery/dist/jquery.min.js',
  'https://testingcf.jsdelivr.net/npm/js-yaml/dist/js-yaml.min.js',
];

/** 🔴 `VENDOR` 會去哪些網域 —— **同意視窗要照實講**，那也是我們自己的外連。 */
export const VENDOR_HOSTS = [...new Set(VENDOR.map((u) => new URL(u).host))];

/**
 * 前導程式本體。字串而不是模組檔，因為它要被塞進 `srcdoc`。
 *
 * ⚠️ **不要在這裡放產品邏輯。** 這一段是「橋」：把 API 名字擺到 iframe 的全域範圍，
 * 每一支都轉成一則 `postMessage` 丟給主頁去做。真正的實作在主頁的 `bridge.ts`。
 */
import { GLOBALS_SHIM } from './globals';
import { VARS_SHIM } from './vars';

export const PREAMBLE = /* js */ `
(function () {
  var pending = {}, seq = 0;
  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__vellumReply === undefined) return;
    var p = pending[d.__vellumReply];
    if (!p) return;
    delete pending[d.__vellumReply];
    d.error ? p.reject(new Error(d.error)) : p.resolve(d.result);
  });
  function call(fn, args) {
    var id = ++seq;
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      parent.postMessage({ __vellumCall: fn, args: args, id: id, frame: window.name }, '*');
    });
  }

  /*
   * 🔴 事件要**先**定義：舊版順序反過來，TavernHelper.eventOn 綁到的是
   * 「把參數 postMessage 出去」的版本 —— 參數裡有 callback，過不了結構化複製，一叫就 throw。
   * （window.eventOn 當時被後面覆寫成正確版，所以只有 TavernHelper. 那條壞掉，很難發現。）
   */
  var subs = {};
  window.eventOn = function (ev, fn) {
    (subs[ev] = subs[ev] || []).push(fn);
    call('eventOn', [ev]);   /* 只把「訂了哪個事件」告訴主頁，callback 留在這邊 */
  };
  window.eventRemoveListener = function (ev, fn) {
    subs[ev] = (subs[ev] || []).filter(function (f) { return f !== fn; });
    if (subs[ev].length === 0) call('eventRemoveListener', [ev]);
  };
  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.__vellumEvent) return;
    (subs[d.__vellumEvent] || []).forEach(function (fn) {
      try { fn.apply(null, d.args || []); } catch (err) { console.error('[卡片腳本] 事件處理出錯', err); }
    });
  });

  /* 🔴 事件名稱**照抄 ST**（實查 public/scripts/events.js:7,19,49）。拿不到 te 的卡片
     會在「輪詢等待 10 秒」裡空轉（實測「何思年_開場連動」就是這個寫法）。 */
  window.tavern_events = {
    MESSAGE_SWIPED: 'message_swiped',
    CHAT_CHANGED: 'chat_id_changed',
    CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
  };

  /* 🔴 變數要**同步**，理由與作法都在 vars.ts 的檔頭（那是一個實機 bug 的根因）。
     必須排在下面的 NAMES 迴圈之前，否則 H 會綁到非同步的那一版。 */
  ${VARS_SHIM}

  var NAMES = ['eventOn','eventRemoveListener','getChatMessages','getLastMessageId','getCurrentMessageId',
               'getAllVariables','getVariables','insertOrAssignVariables','replaceVariables',
               'updateVariablesWith','setChatMessages','setChatMessage',
               'getLorebookEntries','setLorebookEntries','updateWorldbookWith','generate'];
  var H = {};
  NAMES.forEach(function (n) {
    /* 已經在上面定義好的（事件那兩支）直接沿用，不要再包一層 postMessage。 */
    H[n] = typeof window[n] === 'function' ? window[n]
         : function () { return call(n, Array.prototype.slice.call(arguments)); };
    if (window[n] === undefined) window[n] = H[n];
  });
  /* 🔴 叫到沒實作的要說得出是哪一個，不可以是一句 undefined is not a function。 */
  window.TavernHelper = new Proxy(H, {
    get: function (t, k) {
      if (k in t) return t[k];
      return function () {
        console.warn('[卡片腳本] 這張卡呼叫了 Vellum 還沒實作的 TavernHelper.' + String(k) + '()');
        return Promise.resolve(undefined);
      };
    },
  });

  /* 登記處 ＋ 等待（🔴 有逾時，理由見 globals.ts 檔頭）。 */
  ${GLOBALS_SHIM}
  /* 卡片常把整段包在 errorCatched 裡；沒有它就整支不跑。 */
  window.errorCatched = function (fn) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) { console.error('[卡片腳本]', e); }
    };
  };
  /* 🔴 **卡片的提示不自己畫，轉給主頁**（理由與判準在 cardToast.ts 的檔頭）。 */
  var T = { options: {}, clear: function () {}, remove: function () {} };
  ['success', 'info', 'warning', 'error'].forEach(function (k) {
    T[k] = function (text, title) {
      parent.postMessage({ __vellumToast: { level: k, text: String(text), title: String(title || '') } }, '*');
      return T;
    };
  });
  window.toastr = T;
  window.getScriptId = function () { return window.name || 'vellum-script'; };
  /* 🔴 不回空物件：卡片會以為拿到 context，然後壞在很遠的地方。出聲＋丟例外，同 generate()。
     判準與測試在 __tests__/honestBridge.test.ts。⚠️ 這裡是 template literal，不可以有反引號。 */
  window.SillyTavern = { getContext: function () { console.warn('[卡片腳本] 這張卡呼叫了 Vellum 還沒實作的 SillyTavern.getContext()'); throw new Error('Vellum 還沒實作 SillyTavern.getContext()'); } };
})();
`;
