/**
 * 受限運算式求值器。P1 的 `derived.expr`、P3 的 `exempt_when`、P4／P5 的 `when` 都用它。
 *
 * 🔴 **這支存在的唯一理由是「不准 `eval`」**（規格 §5 第 5 條、驗收 C3）。
 * 卡片作者寫的是設定不是程式；一旦用 `eval` 或 `new Function`，
 * 「宣告式設定」就變成「任意 code 執行」，方案丙就退化成方案乙。
 *
 * 允許：變數（點分路徑）、數字／字串／布林字面量、`+ - * / %`、比較、`&& || !`、三元、括號。
 * **禁止：函式呼叫、索引、正則、賦值、任何語句。** 看不懂就丟例外——
 * 🔴 **不可以靜默回 false**：那會讓「寫錯的條件」與「條件不成立」長得一模一樣。
 */

export class BadExpr extends Error {
  constructor(why: string) {
    super(why);
    this.name = 'BadExpr';
  }
}

type Tok = { t: 'num' | 'str' | 'name' | 'op'; v: string };

const OPS = ['&&', '||', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%', '!', '(', ')', '?', ':'];

export function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end < 0) throw new BadExpr('字串沒有收尾');
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i))!;
      out.push({ t: 'num', v: m[0] });
      i += m[0].length;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ t: 'op', v: op });
      i += op.length;
      continue;
    }
    // 變數名：允許中文與點分路徑。**點是名字的一部分，不是屬性存取運算子。**
    const m = /^[^\s()!?:+\-*/%<>=&|'"]+/.exec(src.slice(i));
    if (!m) throw new BadExpr(`看不懂的字元：${c}`);
    out.push({ t: 'name', v: m[0] });
    i += m[0].length;
  }
  return out;
}

type Node =
  | { k: 'lit'; v: unknown }
  | { k: 'var'; name: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'tern'; c: Node; a: Node; b: Node };

const PREC: Record<string, number> = {
  '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
};

export function parse(src: string): Node {
  const toks = lex(src);
  let p = 0;
  const peek = (): Tok | undefined => toks[p];
  const eat = (v: string): void => {
    if (peek()?.v !== v) throw new BadExpr(`少了 ${v}`);
    p += 1;
  };

  const primary = (): Node => {
    const t = toks[p];
    if (!t) throw new BadExpr('運算式提早結束');
    p += 1;
    if (t.t === 'num') return { k: 'lit', v: Number(t.v) };
    if (t.t === 'str') return { k: 'lit', v: t.v };
    if (t.t === 'name') {
      if (t.v === 'true' || t.v === 'false') return { k: 'lit', v: t.v === 'true' };
      // 🔴 名字後面接 `(` ＝ 函式呼叫 ＝ 明確拒絕，不要猜他想幹嘛。
      if (peek()?.v === '(') throw new BadExpr(`不允許函式呼叫：${t.v}(`);
      return { k: 'var', name: t.v };
    }
    if (t.v === '(') {
      const e = expr(0);
      eat(')');
      return e;
    }
    if (t.v === '!' || t.v === '-') return { k: 'un', op: t.v, a: primary() };
    throw new BadExpr(`不能放在這裡：${t.v}`);
  };

  const expr = (min: number): Node => {
    let left = primary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== 'op') break;
      if (t.v === '?') {
        if (min > 0) break;
        p += 1;
        const a = expr(0);
        eat(':');
        return { k: 'tern', c: left, a, b: expr(0) };
      }
      const prec = PREC[t.v];
      if (prec === undefined || prec < min) break;
      p += 1;
      left = { k: 'bin', op: t.v, a: left, b: expr(prec + 1) };
    }
    return left;
  };

  const node = expr(0);
  if (p !== toks.length) throw new BadExpr(`多餘的內容：${toks[p]?.v}`);
  return node;
}
