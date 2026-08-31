/**
 * 條目編輯（C3）。**純函式**：把一份 patch 套到一條 entry 上。
 *
 * 🔴 **同時更新上層欄位與 `raw`。** 上層是給引擎讀的，`raw` 是「無資訊遺失」那條契約
 * 跟著匯出走的那一份（`worldbook.ts` 檔頭，匯出端見 `worldList.ts` 的 `toWorldFile`）。
 * 只改上層的話，**匯出時使用者的編輯會被 `raw` 裡的舊值靜默蓋掉** ——
 * 那正是〈正規化寫回＝資料損毀〉的鏡像：這次不是丟掉別人的鍵，是丟掉自己的編輯。
 *
 * 🔴 **`raw` 有兩套鍵名，要看 `entry.rawSchema` 選對照表**（`worldbook.ts` 匯入時定案）：
 * 卡片複製來的（`fromCharacterBook`）用卡內 `character_book` 那一套
 * （`keys`／`insertion_order`／`extensions.depth`…）；**匯入的外部世界書檔**
 * （`fromWorldFile`）用它自己那一套（`key`／`order`／`depth`，全部在頂層，沒有
 * `extensions`，`enabled` 反過來寫成 `disable`）。兩套名字不同，選錯表會把兩套
 * 鍵名混進同一個 `raw` 物件、也會漏寫使用者剛剛做的編輯。
 *
 * ⚠️ 2026-08-27 之前的現況：`raw` **沒有任何匯出路徑在讀**（掃 95 檔，只有測試碰它）。
 * `worldList.ts` 的 `toWorldFile()` 接上之後，`raw` 第一次真的被匯出消費 ——
 * 上面兩套對照表也是從那一刻起才看得出「選錯了」的後果，之前看不出來正是因為沒人在讀。
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

/** 上層欄位 → 卡內 `character_book` 那套 `raw` 的鍵。`ext: true` 代表它住在 `extensions` 底下。 */
const RAW_KEY_CHAR_BOOK: Record<keyof EntryPatch, { key: string; ext: boolean }> = {
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

/**
 * 上層欄位 → 外部世界書檔那套 `raw` 的鍵。**全部在頂層**，沒有 `extensions` 這回事
 * （那是卡內 v3 embedding 才有的巢狀）。`enabled` 寫回時要**反過來**存進 `disable`。
 */
const RAW_KEY_WORLD_FILE: Record<keyof EntryPatch, string> = {
  comment: 'comment',
  content: 'content',
  keys: 'key',
  secondaryKeys: 'keysecondary',
  constant: 'constant',
  enabled: 'disable',
  selective: 'selective',
  order: 'order',
  selectiveLogic: 'selectiveLogic',
  position: 'position',
  depth: 'depth',
  role: 'role',
  caseSensitive: 'caseSensitive',
  matchWholeWords: 'matchWholeWords',
  probability: 'probability',
  useProbability: 'useProbability',
  ignoreBudget: 'ignoreBudget',
};

export function applyEntryEdit(entry: WbEntry, patch: EntryPatch): WbEntry {
  const raw = { ...entry.raw };
  const isWorldFile = entry.rawSchema === 'worldFile';
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
    if (isWorldFile) {
      // 外部檔沒有 extensions、`enabled` 要反過來寫成 `disable`。
      raw[RAW_KEY_WORLD_FILE[field]] = field === 'enabled' ? !(value as boolean) : value;
      continue;
    }
    const target = RAW_KEY_CHAR_BOOK[field];
    if (target.ext) ext[target.key] = value;
    else raw[target.key] = value;
  }
  // 🔴 只在真的動過 extensions 時才寫回去 —— 沒有 extensions 的條目不要無中生有一個空物件，
  // 那會讓「匯出後與匯入前逐欄位相同」這條驗收多出一個鍵。外部檔schema 本來就不用 extensions。
  if (!isWorldFile && Object.keys(ext).length > 0) raw['extensions'] = ext;

  return { ...entry, ...defined, raw } as WbEntry;
}
