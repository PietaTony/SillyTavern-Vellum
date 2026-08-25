// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isNewer } from '../lib/version.ts';

describe('isNewer', () => {
  it.each([
    ['0.1.0', '0.2.0', true],
    ['0.1.0', '0.1.1', true],
    ['0.1.0', '1.0.0', true],
    ['0.2.0', '0.1.0', false],
    ['0.1.0', '0.1.0', false],
    ['0.1.0', 'v0.2.0', true], // tag 常帶 v 前綴
    ['v0.2.0', '0.1.0', false],
    ['0.9.0', '0.10.0', true], // 🔴 字串比較會說 9 > 10，數字比較才對
    ['0.1.0', '0.1.0-beta', false], // 非數字段當 0 ⇒ 不會誤判成更新
  ])('%s → %s = %s', (a, b, want) => {
    expect(isNewer(a, b)).toBe(want);
  });

  it('位數不同也比得動', () => {
    expect(isNewer('1.2', '1.2.1')).toBe(true);
    expect(isNewer('1.2.1', '1.2')).toBe(false);
  });
});
