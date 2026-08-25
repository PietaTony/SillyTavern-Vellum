/**
 * 受限運算式的求值。語法樹由 `expr.ts` 產出；**這支只走樹，不碰任何動態執行**。
 *
 * 🔴 驗收 C3 要求原始碼裡 `eval(` 與 `new Function(` 出現次數 = 0。
 * 這兩支加起來就是那條規定的實作面：**求值器是自己寫的，不是包一層 `eval`。**
 */
import { BadExpr, parse } from './expr.ts';
import { getPath, type MacroCtx } from './macro.ts';

const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return Number.NaN;
};

const truthy = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return v !== '';
  return v !== null && v !== undefined;
};

type Node = ReturnType<typeof parse>;

function walk(n: Node, ctx: MacroCtx): unknown {
  switch (n.k) {
    case 'lit':
      return n.v;
    case 'var':
      return getPath(ctx, n.name);
    case 'un':
      return n.op === '!' ? !truthy(walk(n.a, ctx)) : -num(walk(n.a, ctx));
    case 'tern':
      return truthy(walk(n.c, ctx)) ? walk(n.a, ctx) : walk(n.b, ctx);
    default: {
      // `&&` / `||` 要短路 —— 右邊可能引用不存在的變數。
      if (n.op === '&&') return truthy(walk(n.a, ctx)) ? truthy(walk(n.b, ctx)) : false;
      if (n.op === '||') return truthy(walk(n.a, ctx)) ? true : truthy(walk(n.b, ctx));
      const a = walk(n.a, ctx);
      const b = walk(n.b, ctx);
      switch (n.op) {
        // 🔴 相等一律用嚴格比較的語意，但先讓「數字 vs 數字字串」對齊 ——
        // 卡片設定裡的 `安全感 == 40` 與 JSON 來的 "40" 不該被判為不等。
        case '==':
          return typeof a === typeof b ? a === b : num(a) === num(b);
        case '!=':
          return typeof a === typeof b ? a !== b : num(a) !== num(b);
        case '+':
          return typeof a === 'string' || typeof b === 'string' ? `${a ?? ''}${b ?? ''}` : num(a) + num(b);
        case '-':
          return num(a) - num(b);
        case '*':
          return num(a) * num(b);
        case '/':
          return num(b) === 0 ? Number.NaN : num(a) / num(b);
        case '%':
          return num(b) === 0 ? Number.NaN : num(a) % num(b);
        case '<':
          return num(a) < num(b);
        case '<=':
          return num(a) <= num(b);
        case '>':
          return num(a) > num(b);
        default:
          return num(a) >= num(b);
      }
    }
  }
}

/** 求值。語法錯誤丟 `BadExpr`，**不靜默回 false**。 */
export function evaluate(src: string, ctx: MacroCtx): unknown {
  return walk(parse(src), ctx);
}

/** 當條件用。求值失敗照樣丟例外 —— 條件寫錯必須讓人看見。 */
export function condition(src: string, ctx: MacroCtx): boolean {
  return truthy(evaluate(src, ctx));
}

/** 設定載入時先驗一遍：語法不合法就不要讓它上線。 */
export function checkExpr(src: string): { ok: true } | { ok: false; why: string } {
  try {
    parse(src);
    return { ok: true };
  } catch (e) {
    return { ok: false, why: e instanceof BadExpr ? e.message : String(e) };
  }
}
