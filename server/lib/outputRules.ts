/**
 * P6 · 輸出後處理規則表。**這是卡片那 12 條 regex 的一般化。**
 *
 * 🔴 **核心語意是「顯示版本」與「送回 prompt 的版本」分開處理**（規格 §4 P6）。
 * 同一段 AI 輸出：使用者看到的是排版過的，送回模型的是拿掉狀態欄與變數區塊的。
 * 少了這個分離，卡片的狀態欄會被當成對話內容一路餵回去。
 *
 * 語意對齊 ST `public/scripts/extensions/regex/engine.js:334 getRegexedString`：
 *   `markdownOnly` → 只作用於顯示｜`promptOnly` → 只作用於 prompt｜兩者皆否 → 兩邊都作用
 *   `minDepth`／`maxDepth` 以**訊息深度**過濾（深度不在範圍內就跳過這條規則）
 */

export type RuleTarget = 'display' | 'prompt' | 'both';

export type OutputRule = {
  name: string;
  find: string;
  replace: string;
  target: RuleTarget;
  minDepth: number | null;
  maxDepth: number | null;
  trim: string[];
  enabled: boolean;
};

type Bag = Record<string, unknown>;
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {});
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** ST 的 `regex_scripts` → 我們的規則表。 */
export function fromRegexScripts(scripts: unknown): OutputRule[] {
  if (!Array.isArray(scripts)) return [];
  return scripts.map((raw) => {
    const s = bag(raw);
    const md = s['markdownOnly'] === true;
    const pr = s['promptOnly'] === true;
    return {
      name: str(s['scriptName'], '(未命名)'),
      find: str(s['findRegex']),
      replace: str(s['replaceString']),
      // 🔴 兩個旗標都沒開＝兩邊都套。這是 ST 的預設，不是「沒設定所以不套」。
      target: md && !pr ? 'display' : pr && !md ? 'prompt' : 'both',
      minDepth: numOrNull(s['minDepth']),
      maxDepth: numOrNull(s['maxDepth']),
      trim: Array.isArray(s['trimStrings']) ? s['trimStrings'].filter((t): t is string => typeof t === 'string') : [],
      enabled: s['disabled'] !== true,
    };
  });
}

/**
 * `"/pattern/flags"` → RegExp。
 * 🔴 **看不懂的一律回 null，由呼叫端決定怎麼辦——不要靜默當成「不比對」。**
 * ST 的旗標集合含 PCRE 才有的 `xXUAJ`，JS 的 RegExp 不吃；那種規則我們跳過並回報。
 */
export function regexFrom(input: string): RegExp | null {
  const m = /^\/(.+)\/([a-z]*)$/is.exec(input);
  try {
    if (!m) return new RegExp(input);
    const flags = (m[2] ?? '').replace(/[^gimsuy]/g, '');
    return new RegExp(m[1] ?? '', flags);
  } catch {
    return null;
  }
}

const trimAll = (text: string, trim: string[]): string =>
  trim.reduce((acc, t) => (t ? acc.split(t).join('') : acc), text);

/** 這條規則這一輪要不要套（目標端 ＋ 深度）。 */
export function applies(rule: OutputRule, target: 'display' | 'prompt', depth: number | null): boolean {
  if (!rule.enabled) return false;
  if (rule.target !== 'both' && rule.target !== target) return false;
  if (depth === null) return true;
  if (rule.minDepth !== null && rule.minDepth >= -1 && depth < rule.minDepth) return false;
  if (rule.maxDepth !== null && rule.maxDepth >= 0 && depth > rule.maxDepth) return false;
  return true;
}

/**
 * 套用一條規則。`{{match}}` 等同 `$0`；`$1`／`$<name>` 取捕獲群組，
 * 每個取出來的群組要先被 `trim` 清過（與 ST 的 `filterString` 同語意）。
 */
export function applyRule(text: string, rule: OutputRule): string {
  const re = regexFrom(rule.find);
  if (!re) return text;
  const template = rule.replace.replace(/\{\{match\}\}/gi, '$0');
  return text.replace(re, (...args: unknown[]) => {
    // replace 的參數是 [match, p1..pn, offset, wholeString] ＋（有具名群組時）groups 物件。
    // 🔴 **不可以用「挑出所有 string」來取群組**：沒參與比對的群組是 undefined 會被濾掉，
    // 後面的編號整個位移；而且 wholeString 自己也是 string，會被誤當成一個群組。
    const last = args.at(-1);
    const hasNamed = last !== null && typeof last === 'object';
    const caps = args.slice(0, args.length - (hasNamed ? 3 : 2)) as (string | undefined)[];
    const groups = hasNamed ? (last as Record<string, string | undefined>) : undefined;
    return template.replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_m, n?: string, name?: string) => {
      const got = n !== undefined ? caps[Number(n)] : groups?.[name ?? ''];
      return got ? trimAll(got, rule.trim) : '';
    });
  });
}

/** 依序套用。**每條規則吃的是上一條的輸出**（與 ST 一致）。 */
export function applyRules(
  text: string,
  rules: OutputRule[],
  opts: { target: 'display' | 'prompt'; depth?: number | null },
): string {
  const depth = opts.depth ?? null;
  return rules.reduce((acc, r) => (applies(r, opts.target, depth) ? applyRule(acc, r) : acc), text);
}
