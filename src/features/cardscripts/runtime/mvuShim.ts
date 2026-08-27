/**
 * 讓這張卡的狀態欄活過來 —— **不載入 MVU，改自己扮演它**（Peter 2026-08-27：
 * 「我們要相容這張卡，用我們的方式，安全地完成」「我不想要引入外部的 Vue」）。
 *
 * 🔴 **背景**：卡片載入 CDN 上的 MVU（MagVarUpdate），而它假設全域有 `Vue` 與 `z`(zod)。
 * 我們的沙箱沒有那兩個 ⇒ 實機當場兩發未接住的例外（轉發線抓到的）：
 *   `ReferenceError: Vue is not defined`  …/MagVarUpdate/artifact/bundle.js
 *   `ReferenceError: z is not defined`    …/tavern_resource/dist/util/mvu_zod.js
 * ⇒ MVU 從來沒初始化 ⇒ 卡片的 `await waitGlobalInitialized('Mvu')` **永遠等不到**
 * ⇒ `init()` 卡在那一行、狀態欄從來沒被填過。
 *
 * 🔴 **為什麼不是把 Vue／zod 加進 `VENDOR`**：那等於把產品的核心狀態
 *（親密度／安全感／面具）押在別人的 CDN 上 —— 斷網或對方改版就沒有狀態，而且測不到。
 * 而 MVU 要做的事**我們早就寫好了**：`server/lib/varUpdate.ts` 解析
 * `<UpdateVariable><JSONPatch>`（含這張卡自己擴充的 `delta` op，標準 RFC 6902 沒有），
 * `server/lib/varApply.ts` 套用時還會夾持約束並留痕跡 —— 那是 MVU **不會**幫我們做的。
 * 拿真卡跑 `pnpm verify:vars` 是過的（安全感 15→18、想要 35 被夾回）。
 * 那台引擎在此之前有**零個產品端呼叫端**。
 *
 * ⇒ 這一支只補「卡片認得的那個介面」：一個最小的 `Mvu` 殼 ＋ 一條把新變數推進來的線。
 *
 * ⚠️ **實掃 4 張卡：`Mvu.` 只出現一種用法**（`Mvu.events.VARIABLE_UPDATE_ENDED`，8 次）
 * ⇒ 殼只要有 `events` 就夠，不要為了像而多做。
 * ⚠️ **事件名是我們自己定的**，跟真的 MVU 不保證一樣 —— 沒關係，訂閱與發送兩端都讀
 * 同一個常數。⚠️ 但卡片若把字串**寫死**而不是讀 `Mvu.events.…` 就會漏接（這張卡沒有）。
 * ⚠️ **`window.Mvu` 只在沒有人定義過時才裝**：真的 MVU 有天跑得起來時它該贏。
 */
export const MVU_UPDATED = 'mag_variable_update_ended';

/** 🔴 必須排在 `VARS_SHIM` **之後** —— 它要就地改 `SCOPES`。 */
export const MVU_SHIM = /* js */ `
  if (!window.Mvu) window.Mvu = { events: { VARIABLE_UPDATE_ENDED: '${MVU_UPDATED}' } };
  addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d.__vellumVars || typeof d.__vellumVars !== 'object') return;
    /*
     * 🔴 **就地覆寫，不換物件。** 卡片可能抓著 getVariables() 回來的那個參考不放
     *（同步快取的整個重點就是「拿到的是真的那一份」）—— 換掉物件等於它手上那份永遠停在舊值。
     */
    ['global', 'character', 'chat'].forEach(function (k) {
      var next = d.__vellumVars[k];
      if (!next || typeof next !== 'object') return;
      var cur = SCOPES[k];
      Object.keys(cur).forEach(function (x) { delete cur[x]; });
      Object.keys(next).forEach(function (x) { cur[x] = next[x]; });
    });
  });
`;
