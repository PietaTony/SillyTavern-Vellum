/**
 * 逐葉比對。**回傳差異與實際比到的葉節點數**——後者是「尺有沒有讀到東西」的證據。
 * 🔴 沒有葉節點數的比對結果不可信：比對 0 個欄位必然回報「沒有差異」。
 */
export type Diff = { path: string; a: unknown; b: unknown };

export function deepDiff(
  a: unknown,
  b: unknown,
  path = '$',
  out: Diff[] = [],
  seen = { leaves: 0 },
) {
  const isObj = (v: unknown) => v !== null && typeof v === 'object';
  if (!isObj(a) || !isObj(b)) {
    seen.leaves += 1;
    if (a !== b) out.push({ path, a, b });
    return { out, leaves: seen.leaves };
  }
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  for (const k of keys) {
    const av = (a as Record<string, unknown>)[k];
    const bv = (b as Record<string, unknown>)[k];
    if (av === undefined || bv === undefined) {
      seen.leaves += 1;
      out.push({
        path: `${path}.${k}`,
        a: av === undefined ? '(缺)' : '(有)',
        b: bv === undefined ? '(缺)' : '(有)',
      });
      continue;
    }
    deepDiff(av, bv, `${path}.${k}`, out, seen);
  }
  return { out, leaves: seen.leaves };
}
