/**
 * 卡片腳本的變數 —— **在 iframe 這一端存一份同步的快取**（M13 第三期）。
 *
 * 🔴 **這是修一個實機 bug 的根因**（Peter 2026-08-26：「桌寵目前調整大小沒有用」）。
 * ST 的 `getVariables({type:'chat'})` 是**同步回物件**；我們的橋每一支都走 `postMessage`
 * ⇒ 回的是 Promise。卡片是同步用的：
 *   `readPetState()` → `getVariables(...)['測試卡A桌寵']` → 在 Promise 上取鍵 → `undefined`
 * 於是尺寸永遠算成預設值。而桌寵改完大小**緊接著呼叫 `schedulePetLayout()`**，
 * 那支又會 `applyPetSize(petSizePercent(readPetState()))` ⇒ **下一幀就把你的調整蓋掉**。
 * ⚠️ 這條不只影響大小 —— **任何同步讀變數的卡片都會壞**，而且壞得沒有錯誤訊息。
 *
 * ⇒ 做法：主頁把變數**種進 `srcdoc`**（見 `srcdoc.ts`），
 * 這一端讀寫都打在本地快取上（同步），寫入再非同步送回主頁存檔。
 *
 * 🔴 **四種範圍**（2026-08-27，照 ST）：`global`／`character`／`chat`／`message`。
 * 在此之前**四種全部回同一份對話變數** —— 卡片寫 `{type:'character'}` 的好感度
 * 會被下一段新對話清掉，而且失敗是靜默的。**範圍講錯 ＝ 資料寫錯地方。**
 * 現在 `global`／`character`／`chat` 各有各的桶子與各自的存檔端點。
 *
 * ⚠️ **`message` 這一種仍然沒有。** 它要能定位「哪一則訊息的哪一個候選」，
 * 那是對話檔的結構問題，不是多加一個鍵。處理方式是**退回 `chat` 並出聲**：
 * 退回是為了讓卡片讀得到東西（回空物件的失敗方式是靜默的，而那正是上面那個 bug 的形狀），
 * 出聲是為了不再有第二個「我以為存進去了」。**每種範圍只警告一次**，不然每輪洗版。
 */
export const VARS_SHIM = /* js */ `
  var SCOPES = window.__vellumVars || {};
  ['global','character','chat'].forEach(function (k) { if (!SCOPES[k]) SCOPES[k] = {}; });
  var WARNED = {};
  function warnOnce(scope, why) {
    if (WARNED[scope]) return;
    WARNED[scope] = 1;
    console.warn('[卡片腳本] 這張卡用了「' + scope + '」範圍的變數 —— ' + why);
  }
  /* 🔴 認不得的範圍也退回 chat 並出聲 —— 靜默當成 chat 就是下一個同形態的 bug。 */
  function scopeOf(opts) {
    var t = opts && typeof opts === 'object' ? opts.type : opts;
    if (t === 'global' || t === 'character' || t === 'chat') return t;
    if (t === 'message') {
      warnOnce('message', 'Vellum 還沒有單則訊息的變數，先當成這段對話的變數用。');
      return 'chat';
    }
    if (t !== undefined && t !== null) {
      warnOnce(String(t), 'Vellum 不認得這個範圍，先當成這段對話的變數用。');
      return 'chat';
    }
    return 'chat';
  }
  function bucket(opts) { return SCOPES[scopeOf(opts)]; }

  window.getAllVariables = function (opts) { return bucket(opts); };
  window.getVariables = function (opts) { return bucket(opts); };
  window.insertOrAssignVariables = function (patch, opts) {
    var scope = scopeOf(opts);
    var target = SCOPES[scope];
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(function (k) { target[k] = patch[k]; });
      call('setVariables', [patch, { type: scope }]);
    }
    return target;
  };
  /* 🔴 **整包覆寫，而且真的存得下去**（GAP-123，2026-08-27 修）。
     上一版本地快取真的清空了，但送出去的是 setVariables ＝ 淺層合併 ⇒
     刪掉的鍵在檔案裡還在，重新整理又冒回來。**本地與檔案兩份對不上，
     而且只有下一次載入才看得出來。** 現在走自己的那一支。 */
  window.replaceVariables = function (next, opts) {
    var scope = scopeOf(opts);
    var target = SCOPES[scope];
    if (next && typeof next === 'object') {
      Object.keys(target).forEach(function (k) { delete target[k]; });
      Object.keys(next).forEach(function (k) { target[k] = next[k]; });
      call('replaceVariables', [next, { type: scope }]);
    }
    return target;
  };
  /* 卡片有時用 updater 形式：拿到目前的變數、改完回傳。 */
  window.updateVariablesWith = function (updater, opts) {
    try { return window.replaceVariables(updater(bucket(opts)), opts); }
    catch (e) { console.error('[卡片腳本] 變數更新出錯', e); return bucket(opts); }
  };
`;
