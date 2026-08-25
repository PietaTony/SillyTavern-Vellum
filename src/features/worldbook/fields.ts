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
  ...(['sticky', 'cooldown', 'delay'] as const).map((k) => ({
    key: k,
    label: { sticky: '黏著幾則', cooldown: '冷卻幾則', delay: '前幾則不觸發' }[k],
    present: (e: { raw?: Record<string, unknown> }) => Boolean(rawExt(e)[k]),
    show: (e: { raw?: Record<string, unknown> }) => String(rawExt(e)[k]),
  })),
];

/** `raw.extensions`，讀不到就回空物件。 */
function rawExt(e: { raw?: Record<string, unknown> }): Record<string, unknown> {
  const x = e.raw?.['extensions'];
  return typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {};
}

/** 逗號分隔的關鍵字字串 → 陣列。空白與空項一律丟掉。 */
export const splitKeys = (v: string): string[] =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** 機率輸入夾在 0–100。非數字當 0，不要讓 NaN 進到資料裡。 */
export const clampPercent = (v: string): number => Math.max(0, Math.min(100, Number(v) || 0));
