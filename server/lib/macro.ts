/**
 * G5 · 變數替換（macro）。`{{路徑}}` → 值。狀態列模板與世界書條件都要用到。
 *
 * 🔴 **不是模板引擎，是查表。** 只做「取值、格式化」，**不執行任何運算式**——
 * 需要條件的地方走 P1 的受限運算式求值器（`expr.ts`），那支也一樣不碰 `eval`。
 *
 * 🔴 **取不到值時的行為要明確**：預設留下原本的 `{{...}}` 而不是換成空字串。
 * 換成空字串會讓「打錯變數名」與「這個變數現在是空的」長得一模一樣，
 * 而前者是設定錯誤、後者是正常狀態，混在一起就沒人會發現打錯。
 */

export type MacroCtx = Record<string, unknown>;

/** 點分路徑取值：`stat_data.安全感`。中途遇到非物件就停，回 undefined。 */
export function getPath(ctx: MacroCtx, path: string): unknown {
  let cur: unknown = ctx;
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

const render = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export type MacroOpts = {
  /** 取不到值時：`keep` 留下原文（預設）、`blank` 換成空字串。 */
  missing?: 'keep' | 'blank';
  /** 回報哪些名字沒查到 —— 打錯字要看得見。 */
  onMissing?: (name: string) => void;
};

/**
 * 把 `{{名稱}}` 換掉。名稱允許點分路徑與 `::預設值`
 * （`{{stat_data.安全感::0}}` —— 取不到就用 `0`，這是**明示**的預設，與「靜默空字串」不同）。
 */
export function substitute(text: string, ctx: MacroCtx, opts: MacroOpts = {}): string {
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, body: string) => {
    const [name = '', fallback] = body.split('::');
    const key = name.trim();
    const value = getPath(ctx, key);
    if (value !== undefined) return render(value);
    if (fallback !== undefined) return fallback;
    opts.onMissing?.(key);
    return opts.missing === 'blank' ? '' : whole;
  });
}

/** 這段文字用到哪些變數 —— 檢查卡片設定有沒有引用到不存在的變數時用。 */
export function macrosUsed(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
    const name = (m[1] ?? '').split('::')[0]?.trim();
    if (name) out.add(name);
  }
  return [...out];
}
