/**
 * 注入進每個卡片 iframe 的前導程式（M13 第二期）。
 *
 * 🔴 **這裡與酒館助手有一個刻意的分歧，而且是本專案唯一沒有照抄的一條。**
 * 酒館助手的 iframe **不加 `sandbox`** ⇒ 與主頁同源，它的
 * `src/iframe/predefine.js:1` 第一行就是 `window._ = window.parent._`，
 * 直接把主頁的全域搬進來 —— 卡片程式因此拿到**整個頁面的權限**。
 * 我們加 `sandbox="allow-scripts"`（**不給** `allow-same-origin`）⇒
 * `window.parent` 變成跨來源，讀不到 ⇒ **那條橋必須改成 `postMessage`**。
 *
 * 🔴 **為什麼這樣還能相容**：卡片程式找全域的寫法是掃
 * `[window, window.parent, window.top]`（實測 14 處）。
 * 只要我們把該有的東西**定義在 iframe 自己的 `window` 上**，第一個 scope 就命中了。
 * ⚠️ 真的需要「直接操作主頁 DOM」或 `localStorage` 的卡片會壞 —— 這是這個選擇的代價，
 *    寫在驗收單第一排，不要假裝沒有。
 *
 * 🔴 **`Mvu` 不在卡片裡** —— 卡片的「MVU Zod 腳本」全文只有一行
 * `import 'https://testingcf.jsdelivr.net/…/bundle.js'`，那份 code 在 CDN 上。
 * 它載入後會把自己掛到 window，所以這裡提供 `waitGlobalInitialized()`／`initializeGlobal()`
 * 讓同一個 iframe 裡的腳本彼此對得上。
 */

/** 卡片實際用到的第三方全域（實掃那 2 MB 得到）。與酒館助手同一個 CDN。 */
export const VENDOR = [
  'https://testingcf.jsdelivr.net/npm/lodash/lodash.min.js',
  'https://testingcf.jsdelivr.net/npm/jquery/dist/jquery.min.js',
  'https://testingcf.jsdelivr.net/npm/toastr/build/toastr.min.js',
  'https://testingcf.jsdelivr.net/npm/js-yaml/dist/js-yaml.min.js',
];

/**
 * 前導程式本體。字串而不是模組檔，因為它要被塞進 `srcdoc`。
 *
 * ⚠️ **不要在這裡放產品邏輯。** 這一段是「橋」：把 API 名字擺到 iframe 的全域範圍，
 * 每一支都轉成一則 `postMessage` 丟給主頁去做。真正的實作在主頁的 `bridge.ts`。
 */
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
  var NAMES = ['eventOn','eventRemoveListener','getChatMessages','getLastMessageId','getCurrentMessageId',
               'getAllVariables','getVariables','setChatMessages','setChatMessage',
               'getLorebookEntries','setLorebookEntries','updateWorldbookWith','generate'];
  var H = {};
  NAMES.forEach(function (n) {
    H[n] = function () { return call(n, Array.prototype.slice.call(arguments)); };
    if (window[n] === undefined) window[n] = H[n];
  });
  // 🔴 叫到沒實作的要說得出是哪一個，不可以是一句 undefined is not a function。
  window.TavernHelper = new Proxy(H, {
    get: function (t, k) {
      if (k in t) return t[k];
      return function () {
        console.warn('[卡片腳本] 這張卡呼叫了 Vellum 還沒實作的 TavernHelper.' + String(k) + '()');
        return Promise.resolve(undefined);
      };
    },
  });
  // 事件：主頁把事件推進來，這裡分派給卡片註冊的 callback。
  var subs = {};
  window.eventOn = function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); call('eventOn', [ev]); };
  window.eventRemoveListener = function (ev, fn) {
    subs[ev] = (subs[ev] || []).filter(function (f) { return f !== fn; });
  };
  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.__vellumEvent) return;
    (subs[d.__vellumEvent] || []).forEach(function (fn) {
      try { fn.apply(null, d.args || []); } catch (err) { console.error('[卡片腳本] 事件處理出錯', err); }
    });
  });
  // 腳本之間互相等待用的登記處。沙箱下各 iframe 獨立，登記在自己身上就好。
  var globals = {};
  window.initializeGlobal = function (name, value) { globals[name] = value; window[name] = value; };
  window.waitGlobalInitialized = function (name) {
    return new Promise(function (resolve) {
      var tick = function () {
        var v = globals[name] !== undefined ? globals[name] : window[name];
        if (v !== undefined) { resolve(v); return; }
        setTimeout(tick, 50);
      };
      tick();
    });
  };
  // 卡片常把整段包在 errorCatched 裡；沒有它就整支不跑。
  window.errorCatched = function (fn) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) { console.error('[卡片腳本]', e); }
    };
  };
  window.getScriptId = function () { return window.name || 'vellum-script'; };
  window.SillyTavern = { getContext: function () { return {}; } };
})();
`;
