/**
 * 卡片對著「ST 特有、Vellum 沒有的 DOM id」操作時，目前 100% 靜默（GAP，2026-08-28 稽核）。
 *
 * 🔴 **實查**：`測試卡A_世界書切換`（`tavern_helper.scripts[4]`）做的是
 * `$('#extensions_settings2').append(...)` —— 手動修復世界書的按鈕面板。
 * `extensions_settings2` 是 **ST 的 DOM id**，Vellum 前端沒有這個元素
 * （`grep -rn "extensions_settings" src/ server/` 零命中）。
 * jQuery 在空集合上 `.append()` 是合法 no-op ⇒ 不丟例外、不印任何東西、面板從來沒出現過。
 * 連 DevTools 都查不到 —— 這支要補的就是「查得到」。
 *
 * 🔴 **判準是白名單，不是「找不到就出聲」**：卡片對自己建立的元素做 DOM 操作
 * （例如先 `append` 進 body、之後才 `getElementById` 抓回來）是完全正常的用法，
 * 那種查詢在「還沒建立」的那一刻本來就該落空，不是相容性問題。
 * ⇒ 只有 id **命中這份白名單**（已知只存在於原版 ST、Vellum 從未有過的容器）
 * 而且查詢落空時才算數。白名單故意窄，寧可漏抓也不要對卡片自己的元素誤報。
 */
export const KNOWN_ST_IDS: readonly string[] = [
  // ST 的擴充設定兩欄（`測試卡A_世界書切換` 操作的就是這一個）。
  'extensions_settings',
  'extensions_settings2',
];

export type StCompatWarn = (id: string) => void;

/**
 * 🔴 **自足工廠**——會被 `toString()` 塞進 iframe（見 `globals.ts` 檔頭同款理由）：
 * 不可以引用模組範圍的任何東西，測試才能直接呼叫真的這一支，不必 `new Function`。
 *
 * 出聲分兩層，讀者不同：
 *   ① `warn(...)` —— 開發者診斷，經 `logShim.ts` 轉發到主頁 DevTools console。
 *   ② `notify(...)` —— **使用者該知道**：卡片承諾的介面（這裡是「修復世界書」按鈕）
 *      完全不會出現，使用者不該以為自己按錯或 Vellum 壞了。走 `__vellumToast`，
 *      但 `source: 'vellum-compat'`——**不是**卡片自己講的話，主頁那端
 *      （`cardToast.ts`）要用不同的前綴，不能套「角色卡：」誤導成卡片在講話。
 *
 * 每個 id 只出聲一次：卡片常見輪詢／`MutationObserver` 重試，同一句話洗版
 * 等於沒有警告（`vars.ts` 的 `warnOnce` 已經吃過這個教訓）。
 */
export function makeStCompatWarn(
  known: readonly string[],
  warn: (m: string) => void,
  notify: (text: string) => void,
): StCompatWarn {
  var seen: Record<string, boolean> = {};
  return function stCompatWarn(id) {
    if (known.indexOf(id) === -1) return;
    if (seen[id]) return;
    seen[id] = true;
    var msg =
      '這張卡想操作 #' +
      id +
      '——那是 SillyTavern 專屬的介面元件，Vellum 沒有，這部分功能不會出現。';
    warn('[卡片腳本] ' + msg);
    notify(msg);
  };
}

/**
 * 只認純 `#id` 選擇器（jQuery 對這種形狀本來就直接呼叫 `getElementById`，
 * 這是 Sizzle 引擎的快速路徑，不是我們自己發明的判斷）。複合選擇器
 * （`#extensions_settings2 .foo`）不在這裡處理，交給 `querySelector` 那條路徑。
 */
export function idFromPureSelector(sel: string): string | null {
  var m = /^#([\w-]+)$/.exec(sel.trim());
  return m ? (m[1] ?? null) : null;
}

/**
 * 前導程式本體。掛在 `document.getElementById`／`document.querySelector` 上，
 * 只在**查詢落空**時才問白名單——命中的查詢（卡片自己的元素）完全不受影響、
 * 回傳值也原封不動傳回去，卡片看不出這一層存在。
 */
export const ST_COMPAT_SHIM = /* js */ `
  var KNOWN_ST_IDS = ${JSON.stringify(KNOWN_ST_IDS)};
  var idFromPureSelector = ${idFromPureSelector.toString()};
  var stCompatWarn = (${makeStCompatWarn.toString()})(
    KNOWN_ST_IDS,
    function (m) { console.warn(m); },
    function (text) { parent.postMessage({ __vellumToast: { level: 'warning', text: text, source: 'vellum-compat' } }, '*'); }
  );
  var origGetById = document.getElementById.bind(document);
  document.getElementById = function (id) {
    var r = origGetById(id);
    if (!r) stCompatWarn(id);
    return r;
  };
  var origQuerySelector = document.querySelector.bind(document);
  document.querySelector = function (sel) {
    var r = origQuerySelector(sel);
    if (!r && typeof sel === 'string') {
      var id = idFromPureSelector(sel);
      if (id) stCompatWarn(id);
    }
    return r;
  };
`;
