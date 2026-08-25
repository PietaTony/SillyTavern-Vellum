/**
 * 條目編輯（C3）。**純函式**：把一份 patch 套到一條 entry 上。
 *
 * 🔴 **同時更新上層欄位與 `raw`。** 上層是給引擎讀的，`raw` 是「無資訊遺失」那條契約
 * 跟著匯出走的那一份（`worldbook.ts` 檔頭）。只改上層的話，
 * **哪天接上世界書匯出，使用者的編輯會被 `raw` 裡的舊值靜默蓋掉** ——
 * 那正是〈正規化寫回＝資料損毀〉的鏡像：這次不是丟掉別人的鍵，是丟掉自己的編輯。
 * ⚠️ 現況實查：`raw` **還沒有任何匯出路徑在讀**（掃 95 檔，只有測試碰它）。
 *    所以這一步現在看不出效果 —— **正因為看不出來，才要現在做**。
 *
 * 🔴 `worlds/*.json` 一律是 `fromCharacterBook` 產出的，所以 `raw` 的鍵名固定是
 * **卡內 `character_book` 那一套**（`keys`／`insertion_order`／`extensions.depth`…），
 * 不是外部世界書檔那一套（`key`／`order`／`depth`）。兩套名字不同，不可以混用。
 */
import type { WbEntry } from './worldbook.ts';

type PartialUndef<T> = { [K in keyof T]?: T[K] | undefined };

/**
 * 可以編輯的欄位 —— **只列引擎真的會讀的**（規格總則五）。
 * 🔴 明寫 `| undefined`：`exactOptionalPropertyTypes` 開著，
 * zod 的 `.partial()` 產出的型別帶 `undefined`，不寫的話呼叫端塞不進來。
 */
export type EntryPatch = PartialUndef<
  Pick<
    WbEntry,
    | 'comment'
    | 'content'
    | 'keys'
    | 'secondaryKeys'
    | 'constant'
    | 'enabled'
    | 'selective'
    | 'selectiveLogic'
    | 'order'
    | 'position'
    | 'depth'
    | 'role'
    | 'caseSensitive'
    | 'matchWholeWords'
    | 'probability'
    | 'useProbability'
    | 'ignoreBudget'
  >
>;

/** 上層欄位 → `raw` 的鍵。`ext: true` 代表它住在 `extensions` 底下。 */
const RAW_KEY: Record<keyof EntryPatch, { key: string; ext: boolean }> = {
  comment: { key: 'comment', ext: false },
  content: { key: 'content', ext: false },
  keys: { key: 'keys', ext: false },
  secondaryKeys: { key: 'secondary_keys', ext: false },
  constant: { key: 'constant', ext: false },
  enabled: { key: 'enabled', ext: false },
  selective: { key: 'selective', ext: false },
  order: { key: 'insertion_order', ext: false },
  selectiveLogic: { key: 'selectiveLogic', ext: true },
  position: { key: 'position', ext: true },
  depth: { key: 'depth', ext: true },
  role: { key: 'role', ext: true },
  caseSensitive: { key: 'case_sensitive', ext: true },
  matchWholeWords: { key: 'match_whole_words', ext: true },
  probability: { key: 'probability', ext: true },
  useProbability: { key: 'useProbability', ext: true },
  ignoreBudget: { key: 'ignore_budget', ext: true },
};

export function applyEntryEdit(entry: WbEntry, patch: EntryPatch): WbEntry {
  const raw = { ...entry.raw };
  const ext = { ...(typeof raw['extensions'] === 'object' && raw['extensions'] !== null
    ? (raw['extensions'] as Record<string, unknown>)
    : {}) };

  // 🔴 `undefined` 的鍵要**整個丟掉**，不可以往下傳。
  // `{...entry, ...patch}` 會把 `{keys: undefined}` 蓋到 entry 上，
  // 把一個必填欄位變成 undefined —— 那是「沒送這個欄位」被解讀成「把它清空」。
  const defined: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(patch) as [keyof EntryPatch, unknown][]) {
    if (value === undefined) continue;
    defined[field] = value;
    const target = RAW_KEY[field];
    if (target.ext) ext[target.key] = value;
    else raw[target.key] = value;
  }
  // 🔴 只在真的動過 extensions 時才寫回去 —— 沒有 extensions 的條目不要無中生有一個空物件，
  // 那會讓「匯出後與匯入前逐欄位相同」這條驗收多出一個鍵。
  if (Object.keys(ext).length > 0) raw['extensions'] = ext;

  return { ...entry, ...defined, raw } as WbEntry;
}
