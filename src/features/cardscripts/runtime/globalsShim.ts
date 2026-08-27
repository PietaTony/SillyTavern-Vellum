/**
 * 卡片腳本之間互相協作用的雜項全域。
 *
 * 🔴 **抽成獨立檔案是因為 `gate:file-size`**：`preamble.ts` 撞到 150 行。
 * 這一段的共通點是「**跟我們的橋無關**」—— 它們不轉發任何東西給主頁，
 * 純粹是卡片彼此（或卡片與它從 CDN 載進來的框架）約定好的全域介面。
 * 真正的橋（`call()`／API 名單／事件）留在 `preamble.ts`。
 */
export const GLOBALS_SHIM = /* js */ `
  /* 腳本之間互相等待用的登記處。沙箱下各 iframe 獨立，登記在自己身上就好。 */
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
  /* 卡片常把整段包在 errorCatched 裡；沒有它就整支不跑。 */
  window.errorCatched = function (fn) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) { console.error('[卡片腳本]', e); }
    };
  };
  window.getScriptId = function () { return window.name || 'vellum-script'; };
  /*
   * ⚠️ **這是一個空殼**：回一個空物件，卡片會以為自己拿到了 context。
   * 目前實掃的卡片沒有人用它（SillyTavern.getContext() 0 命中），
   * 但它與那三支世界書 API 同一類「看起來有、其實沒有」的缺口 ——
   * 已列進交給主執行線的清單（scratchpad/prompt-cardscripts-gaps.md）。
   */
  window.SillyTavern = { getContext: function () { return {}; } };
`;
