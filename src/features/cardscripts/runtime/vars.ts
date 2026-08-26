/**
 * 卡片腳本的變數 —— **在 iframe 這一端存一份同步的快取**（M13 第三期）。
 *
 * 🔴 **這是修一個實機 bug 的根因**（Peter 2026-08-26：「桌寵目前調整大小沒有用」）。
 * ST 的 `getVariables({type:'chat'})` 是**同步回物件**；我們的橋每一支都走 `postMessage`
 * ⇒ 回的是 Promise。卡片是同步用的：
 *   `readPetState()` → `getVariables(...)['何思年桌寵']` → 在 Promise 上取鍵 → `undefined`
 * 於是尺寸永遠算成預設值。而桌寵改完大小**緊接著呼叫 `schedulePetLayout()`**，
 * 那支又會 `applyPetSize(petSizePercent(readPetState()))` ⇒ **下一幀就把你的調整蓋掉**。
 * ⚠️ 這條不只影響大小 —— **任何同步讀變數的卡片都會壞**，而且壞得沒有錯誤訊息。
 *
 * ⇒ 做法：主頁把「目前這段對話的變數」**種進 `srcdoc`**（見 `srcdoc.ts`），
 * 這一端讀寫都打在本地快取上（同步），寫入再非同步送回主頁存檔。
 *
 * ⚠️ **我們只有「這段對話」一種範圍。** ST 還有 global／character／message 範圍；
 * 卡片傳 `{type:'global'}` 進來時我們回同一份 —— **寧可讓它讀到東西，不要回空物件**
 * （回空物件的失敗方式是靜默的，而那正是這個 bug 的形狀）。這條寫在 `plans/90-BACKLOG.md`。
 */
export const VARS_SHIM = /* js */ `
  var VARS = window.__vellumVars || {};
  window.getAllVariables = function () { return VARS; };
  window.getVariables = function () { return VARS; };
  window.insertOrAssignVariables = function (patch) {
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(function (k) { VARS[k] = patch[k]; });
      call('setVariables', [patch]);
    }
    return VARS;
  };
  window.replaceVariables = function (next) {
    if (next && typeof next === 'object') {
      Object.keys(VARS).forEach(function (k) { delete VARS[k]; });
      window.insertOrAssignVariables(next);
    }
    return VARS;
  };
  /* 卡片有時用 updater 形式：拿到目前的變數、改完回傳。 */
  window.updateVariablesWith = function (updater) {
    try { return window.replaceVariables(updater(VARS)); } catch (e) { console.error('[卡片腳本] 變數更新出錯', e); return VARS; }
  };
`;
