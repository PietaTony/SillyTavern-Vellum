import { describe, expect, it } from 'vitest';
import { applyMaskedEdit, maskKey } from '../model';

describe('金鑰遮罩顯示', () => {
  it('空字串回空字串', () => {
    expect(maskKey('')).toBe('');
  });

  it('前四後四明碼，中間打點', () => {
    const out = maskKey('AIzaSyABCDEFGHIJKLMNOPQRSTUV1234');
    expect(out.startsWith('AIza')).toBe(true);
    expect(out.endsWith('1234')).toBe(true);
    expect(out).toContain('•');
  });

  it('🔴 太短的金鑰全遮罩 —— 露兩端會把整串露完', () => {
    expect(maskKey('AIza1234')).toBe('••••••••');
    expect(maskKey('AIza12345678')).toBe('••••••••••••');
  });

  it('🔴 點的數量有上限，不洩漏真實長度', () => {
    const short = maskKey(`AIza${'x'.repeat(30)}1234`);
    const long = maskKey(`AIza${'x'.repeat(300)}1234`);
    expect(long.length).toBe(short.length);
    expect(long.length).toBe(4 + 24 + 4);
  });

  it('原值不被改動（純函式）', () => {
    const v = 'AIzaSyABCDEFGHIJKLMNOP1234';
    maskKey(v);
    expect(v).toBe('AIzaSyABCDEFGHIJKLMNOP1234');
  });
});

describe('遮罩狀態下的編輯還原', () => {
  const real = 'AIzaSyABCDEFGHIJKLMNOP1234';
  const shown = maskKey(real);

  it('沒改動就不動真值', () => {
    expect(applyMaskedEdit(real, shown, shown)).toBe(real);
  });

  it('貼上一整串新的（不含遮罩字元）⇒ 直接採用', () => {
    expect(applyMaskedEdit(real, shown, 'AIzaNEWKEY0000')).toBe('AIzaNEWKEY0000');
  });

  it('在尾端接字 ⇒ 接到真值尾端', () => {
    expect(applyMaskedEdit(real, shown, `${shown}XY`)).toBe(`${real}XY`);
  });

  it('從尾端刪字 ⇒ 真值也從尾端刪掉同樣數量', () => {
    expect(applyMaskedEdit(real, shown, shown.slice(0, -3))).toBe(real.slice(0, -3));
  });

  it('🔴 推不出來就清空 —— 不猜。猜錯會產生一把「看起來對其實錯」的金鑰', () => {
    expect(applyMaskedEdit(real, shown, 'X•••Y')).toBe('');
  });
});
