/**
 * 欄位層的常數與判定。**與 `model.ts` 分開**：那一支是「畫面怎麼呈現」的純函式，
 * 這一支是「哪些欄位真的有引擎」的事實表 —— 兩者的更新時機完全不同
 * （前者跟著設計走，後者跟著 `server/lib/` 走）。
 */

/** 次要關鍵字的配對邏輯。值對齊 ST（`world-info.js` 的 `selectiveLogic`）。 */
export const SELECTIVE_LOGIC = [
  { value: 0, label: '要有任一個次要關鍵字（AND ANY）' },
  { value: 1, label: '不可以有任何次要關鍵字（NOT ALL）' },
  { value: 2, label: '一個次要關鍵字都不能有（NOT ANY）' },
  { value: 3, label: '次要關鍵字要全部都有（AND ALL）' },
] as const;

/**
 * 🔴 **引擎完全不理的欄位**（規格總則五）。
 *
 * 判準是機械的：在 56 支 `server/**.ts`（不含測試）裡**零命中**。
 * 尺已驗 —— 同一批檔案 `caseSensitive` 8 次、`selectiveLogic` 6 次、`ignoreBudget` 5 次，
 * 所以零命中是真的零命中，不是 grep 壞掉。
 *
 * 它們的值**原樣留在 `raw` 裡跟著匯出走**（無資訊遺失），但畫成可編輯就是騙人：
 * 使用者會調了、存了、以為有作用，**而實際什麼都沒發生、且沒有任何跡象**。
 *
 * ⚠️ 補一個 arch 清單上沒有的：**`group`（互斥群組）**。
 * 它在 `WbEntry` 型別裡是正式欄位，看起來像有支援 —— 但一樣是零命中。
 */
export const DEAD_FIELDS: {
  key: string;
  label: string;
  present: (e: { group: string; raw?: Record<string, unknown> }) => boolean;
  show: (e: { group: string; raw?: Record<string, unknown> }) => string;
}[] = [
  {
    key: 'group',
    label: '互斥群組',
    present: (e) => Boolean(e.group),
    show: (e) => e.group,
  },
  /**
   * 🔴 **兩個位置都要找**：卡片複製來的書 `sticky`／`cooldown`／`delay` 藏在
   * `raw.extensions` 底下；**匯入的外部世界書檔沒有 `extensions`，這三個欄位在
   * `raw` 頂層**（`server/lib/worldbook.ts` 檔頭）。只查一邊的話，匯入的書會被
   * 看成「這些欄位都沒設」，即使原始檔案裡明明寫著 `sticky: 5`。
   */
  ...(['sticky', 'cooldown', 'delay'] as const).map((k) => ({
    key: k,
    label: { sticky: '黏著幾則', cooldown: '冷卻幾則', delay: '前幾則不觸發' }[k],
    present: (e: { raw?: Record<string, unknown> }) => Boolean(e.raw?.[k] ?? rawExt(e)[k]),
    show: (e: { raw?: Record<string, unknown> }) => String(e.raw?.[k] ?? rawExt(e)[k]),
  })),
];

/** `raw.extensions`，讀不到就回空物件。 */
function rawExt(e: { raw?: Record<string, unknown> }): Record<string, unknown> {
  const x = e.raw?.['extensions'];
  return typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {};
}

/**
 * 🔴 **插入位置裡，五個桶到最後都不會出現在 prompt 裡**（GAP-53／A1 2026-08-31／
 * outlet 補於 2026-08-31，見 `INBOX/20260831-outlet-hint-is-false.md`）。
 *
 * 這五個**成因分兩種，不要混為一談**：
 *
 * 1）`anTop`／`anBottom`（2／3）／`emTop`／`emBottom`（5／6）——**算出來了、沒人讀**。
 *    `wiInject.ts` 把它們裝進 `InjectionPlan` 對應的桶子，桶子是真的算出來的，
 *    只是 `promptWorld.ts` 從沒讀過那四個欄位。對照 ST 原碼查證過，這四個位置
 *    **都是相對某個我們沒有的東西定位的**：
 *    - `anTop`／`anBottom`：ST 接在「作者備註（Author's Note）」本文前後
 *      （`world-info.js:5149-5152`），且只在 AN 的 interval 機制判定要插時才進場
 *      （`authors-note.js` 的 `shouldWIAddPrompt`）。**我們沒有 Author's Note**——
 *      `server/lib/personaPrompt.ts:30-34` 處理 persona 的 `top_an`／`bottom_an`
 *      時已經講過同一句話。沒有 AN 就沒有錨點，插哪裡都是瞎猜。
 *    - `emTop`／`emBottom`：ST 接在角色卡「範例對話」（`mes_example`）陣列頭尾
 *      （`script.js:4580-4595`）。**我們整支 server 沒有範例對話這個概念**
 *      （`grep -rn mes_example server` 零命中）——不是位置算錯，是錨點本身不存在。
 *
 * 2）`outlet`（7）——**引擎根本沒有把它裝進任何桶**。`wiInject.ts` 的
 *    `switch (e.position)` 走到 `outlet` 時直接落 `default`，原樣塞進 `plan.unplaced`
 *    （見該檔 `// outlet: 7 要具名插槽，我們沒有那個概念；不猜、不亂塞，原樣回報`）——
 *    這是**刻意拒絕**，不是「算出來了漏讀」。而且舊版 UI hint 承諾「寫
 *    `{{outlet::名稱}}` 就會被放進去」是**假的**：全 repo 零命中同名巨集
 *    （`server/lib/macro.ts` 沒有、`promptWorld.ts` 沒有讀過 `plan.unplaced`）。
 *    `plans/ui/06-worldbook.md` 寫「引擎（`assemble.ts`）早就收集 outlets 了」——
 *    **這支 `assemble.ts`在這個 repo 裡不存在**，那句話是規劃文件先寫、引擎後來
 *    沒照著做出來，不是我們漏看了什麼。
 *
 * 兩種成因不同，但**使用者看到的後果一樣**：選了這個位置，文字進 `raw` 不遺失，
 * 但**不會出現在 prompt 裡**，而且沒有任何錯誤訊息。同一句「尚未接線」對使用者
 * 是誠實的；至於「為什麼」，上面兩段分開講。
 */
export const POSITION_UNIMPLEMENTED = new Set<number>([2, 3, 5, 6, 7]); // anTop, anBottom, emTop, emBottom, outlet

/** `POSITION_UNIMPLEMENTED` 的判斷式版本，給 UI 元件用。 */
export const isPositionImplemented = (position: number): boolean =>
  !POSITION_UNIMPLEMENTED.has(position);

/** 逗號分隔的關鍵字字串 → 陣列。空白與空項一律丟掉。 */
export const splitKeys = (v: string): string[] =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** 機率輸入夾在 0–100。非數字當 0，不要讓 NaN 進到資料裡。 */
export const clampPercent = (v: string): number => Math.max(0, Math.min(100, Number(v) || 0));
