/**
 * 腳本之間互相等待用的登記處（`initializeGlobal`／`waitGlobalInitialized`）。
 *
 * 🔴 **`waitGlobalInitialized` 一定要有逾時。** 上一版沒有，而那不是效能問題，是**功能整個不跑**：
 *
 * 實測 2026-08-27（標的卡「何思年」三個區塊全是這個形狀）：
 * ```js
 * async function init(){
 *   await waitGlobalInitialized('Mvu');   // ← 卡在這裡，永遠
 *   populateCharacterData(); renderPage();
 *   eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, ...);
 * }
 * ```
 * ⚠️ **這裡原本寫「卡片自己也沒 import ⇒ 全 repo 零命中」，那是錯的**（2026-08-27 更正）。
 * 那個 0 是**壞尺量出來的**：卡片的腳本存在 PNG 的 `tEXt` chunk 裡而且是 base64，
 * 拿 `grep` 掃二進位檔找明文必然 0 命中。解碼之後再數是 **17／17 張卡都 import 它**。
 * 真正的情況是：`Mvu` 由**卡片自己的腳本**從 CDN import 進來，而它假設沙箱裡有全域
 * `Vue` 與 `z`(zod) —— 我們沒有 ⇒ **它載進來了，但一執行就炸、從來沒初始化過**
 *（實機 stack：`ReferenceError: Vue is not defined at …/MagVarUpdate/artifact/bundle.js`）。
 * ⇒ 問題不在「沒載」，在「載了但初始化不了」。我們的解法是**自己扮演它**（`mvuShim.ts`），
 * 不把 Vue／zod 加進 `VENDOR`（那等於把產品的核心狀態押在別人的 CDN 上）。
 * ⇒ 那支 Promise 永遠不 resolve ⇒ **`init()` 一行都沒執行過**。
 *
 * ⚠️ 這解釋了兩個原本被誤讀的觀察：
 *   · 「這張卡沒有呼叫那些沒實作的 API」—— 不是它不需要，是**它還沒跑到那幾行**。
 *   · 「親密值好像沒有在更新」—— 更新的訂閱在 `init()` 裡，從來沒被掛上。
 * 🔴 **一個沒有逾時的等待，症狀跟「這個功能沒做」一模一樣**，而且不會有任何錯誤訊息。
 *
 * 🔴 **逾時之後 `resolve(undefined)` 而不是 reject**：卡片會接著跑
 * `populateCharacterData()` 與 `renderPage()`（那兩支不需要 `Mvu`），
 * 到 `Mvu.events` 才炸，被卡片自己的 `errorCatched` 接住並印出來。
 * 換來的是「畫面出得來、只有即時更新失效」，而不是「整張卡空白」。
 *
 * 🔴 **shim 從下面這支真函式 `toString()` 產生，不是另外抄一份字串。**
 * 理由有兩個：① 測試可以直接呼叫它，不必 `new Function`（`gate:no-eval` 守的就是那個）
 * ② **抄一份就會分岔**，而分岔的那一半只在 iframe 裡跑，本機測不到。
 * ⚠️ 因此這支**必須完全自足**：不可以引用模組範圍的任何東西（import、常數都不行），
 * 它會被序列化成字串送進 `srcdoc`。
 */

/** 等一個全域最多多久。CDN 那三支載完通常 <1s；等到這裡還沒有，就是真的沒有。 */
export const GLOBAL_WAIT_MS = 5000;

export type WaitGlobal = (name: string, timeoutMs?: number) => Promise<unknown>;

/** 🔴 自足工廠 —— 見檔頭最後一段，不可以引用模組範圍的東西。 */
export function makeWaitGlobal(
  win: Record<string, unknown>,
  globals: Record<string, unknown>,
  defaultMs: number,
  say: (m: string) => void,
): WaitGlobal {
  return function waitGlobalInitialized(name, timeoutMs) {
    const limit = typeof timeoutMs === 'number' ? timeoutMs : defaultMs;
    let waited = 0;
    return new Promise((resolve) => {
      const tick = (): void => {
        const v = globals[name] !== undefined ? globals[name] : win[name];
        if (v !== undefined) {
          resolve(v);
          return;
        }
        if (waited >= limit) {
          say(
            `[卡片腳本] 等不到全域 ${name}（已等 ${limit}ms）—— Vellum 沒有提供它。卡片會繼續往下跑，用到它的那一段會失敗。`,
          );
          resolve(undefined);
          return;
        }
        waited += 50;
        setTimeout(tick, 50);
      };
      tick();
    });
  };
}

export const GLOBALS_SHIM = /* js */ `
  var globals = {};
  window.initializeGlobal = function (name, value) { globals[name] = value; window[name] = value; };
  window.waitGlobalInitialized = (${makeWaitGlobal.toString()})(
    window, globals, ${GLOBAL_WAIT_MS}, function (m) { console.warn(m); }
  );
`;
