/**
 * 世界書關鍵字比對。語意逐條對齊 ST `world-info.js:337 matchKeys`。
 *
 * 🔴 **三個容易做錯的地方**（都有 ST 行號佐證）：
 *   ① key 寫成 `/.../flags` 時走 regex，**完全略過 `caseSensitive` 與 `matchWholeWords`**（:339-342）
 *   ② `matchWholeWords` 開、但 key 含空白（多字詞）時，ST **不做邊界比對**，退回 `includes`（:353-356）
 *   ③ 不分大小寫時，**兩邊都要轉小寫**（haystack 與 key），只轉一邊等於永遠不中（:268-271）
 */

export type MatchOpts = { caseSensitive: boolean; matchWholeWords: boolean };

/** `/pattern/flags` → RegExp。未跳脫的斜線視為不合法（與 ST 的 `parseRegexFromString` 同判準）。 */
export function keyRegex(key: string): RegExp | null {
  const m = /^\/([\w\W]+?)\/([gimsuy]*)$/.exec(key);
  if (!m) return null;
  try {
    return new RegExp(m[1] ?? '', m[2] ?? '');
  } catch {
    return null;
  }
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 單一 key 有沒有命中。 */
export function matchKey(haystack: string, key: string, o: MatchOpts): boolean {
  if (!key) return false;
  const re = keyRegex(key);
  // ① regex key：略過大小寫與整字設定，直接測。
  if (re) return re.test(haystack);

  const hay = o.caseSensitive ? haystack : haystack.toLowerCase();
  const needle = o.caseSensitive ? key : key.toLowerCase();

  if (o.matchWholeWords) {
    // ② 多字詞（含空白）不做邊界比對 —— 這是 ST 的實際行為，不是疏漏。
    if (needle.split(/\s+/).length > 1) return hay.includes(needle);
    return new RegExp(`(?:^|\\W)(${escape(needle)})(?:$|\\W)`).test(hay);
  }
  return hay.includes(needle);
}

export const matchAny = (hay: string, keys: string[], o: MatchOpts): boolean =>
  keys.some((k) => matchKey(hay, k, o));

export const matchAll = (hay: string, keys: string[], o: MatchOpts): boolean =>
  keys.length > 0 && keys.every((k) => matchKey(hay, k, o));

/**
 * `selectiveLogic` 的四個值（ST `world-info.js:33` `world_info_logic`）。
 * 🔴 名字會騙人：`NOT_ALL` 是「**不是全部命中**」，不是「全部都沒命中」——後者是 `NOT_ANY`。
 */
export const WI_LOGIC = { AND_ANY: 0, NOT_ALL: 1, NOT_ANY: 2, AND_ALL: 3 } as const;

/** 次要關鍵字的判定。primary 已命中才會走到這裡。 */
export function secondaryOk(hay: string, secondary: string[], logic: number, o: MatchOpts): boolean {
  if (secondary.length === 0) return true;
  switch (logic) {
    case WI_LOGIC.AND_ALL:
      return matchAll(hay, secondary, o);
    case WI_LOGIC.NOT_ALL:
      return !matchAll(hay, secondary, o);
    case WI_LOGIC.NOT_ANY:
      return !matchAny(hay, secondary, o);
    default:
      return matchAny(hay, secondary, o);
  }
}
