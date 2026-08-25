import { describe, expect, it } from 'vitest';
import { maskKey } from '../model';

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
