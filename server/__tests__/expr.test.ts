import { describe, expect, it } from 'vitest';
import { BadExpr } from '../lib/expr.ts';
import { checkExpr, condition, evaluate } from '../lib/exprEval.ts';

const ctx = { 安全感: 40, 面具: 85, 樓層: 1, 時期: '成年', 開: true, stat_data: { 親密度: 20 } };
const ev = (s: string) => evaluate(s, ctx);

describe('受限運算式', () => {
  it('數字運算與優先序', () => {
    expect(ev('1 + 2 * 3')).toBe(7);
    expect(ev('(1 + 2) * 3')).toBe(9);
    expect(ev('7 % 3')).toBe(1);
  });

  it('變數用點分路徑取值', () => {
    expect(ev('安全感')).toBe(40);
    expect(ev('stat_data.親密度 + 1')).toBe(21);
  });

  it('比較與布林', () => {
    expect(ev('安全感 >= 40 && 面具 > 80')).toBe(true);
    expect(ev('安全感 < 25 || 開')).toBe(true);
    expect(ev('!開')).toBe(false);
  });

  it('三元', () => {
    expect(ev('安全感 >= 60 ? "高" : "低"')).toBe('低');
  });

  it('字串比較（時期是 enum）', () => {
    expect(ev('時期 == "成年"')).toBe(true);
    expect(ev('時期 != "童年"')).toBe(true);
  });

  it('數字與數字字串比較不會被判成不等', () => {
    expect(evaluate('n == 40', { n: '40' })).toBe(true);
  });

  it('&& 與 || 要短路（右邊可能引用不存在的變數）', () => {
    expect(evaluate('false && 不存在.深.路徑', {})).toBe(false);
    expect(evaluate('true || 不存在', {})).toBe(true);
  });

  it('🔴 禁止函式呼叫', () => {
    expect(() => ev('alert(1)')).toThrow(BadExpr);
    expect(() => ev('安全感.toString()')).toThrow(BadExpr);
  });

  it('🔴 語法錯誤要丟例外，不可以靜默回 false', () => {
    expect(() => ev('1 +')).toThrow(BadExpr);
    expect(() => ev('(1')).toThrow(BadExpr);
    expect(() => ev('1 2')).toThrow(BadExpr);
  });

  it('🔴 賦值不是合法運算式', () => {
    expect(() => ev('安全感 = 100')).toThrow(BadExpr);
  });

  it('取不到的變數是 undefined，當條件時是 false（但不是語法錯誤）', () => {
    expect(condition('不存在', ctx)).toBe(false);
    expect(condition('安全感 > 0', ctx)).toBe(true);
  });

  it('checkExpr 在載入設定時先擋下寫錯的條件', () => {
    expect(checkExpr('a && b')).toEqual({ ok: true });
    expect(checkExpr('a &&').ok).toBe(false);
  });

  it('除以零回 NaN 而不是丟例外或 Infinity', () => {
    expect(Number.isNaN(ev('1 / 0') as number)).toBe(true);
  });
});
