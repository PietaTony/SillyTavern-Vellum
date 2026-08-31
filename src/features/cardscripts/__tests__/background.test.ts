import { describe, expect, it } from 'vitest';
import { backgroundOf } from '../runtime/background';

/**
 * E1：桌寵開關關掉時，`background` 要直接是 `null`——跟「沒同意」走同一條
 * 「frame 根本不存在」的路（`CardBackground.tsx` 的 `!cards.background` 就不畫）。
 */
describe('backgroundOf', () => {
  it('關掉 ⇒ null，就算這張卡明明有背景腳本', () => {
    expect(backgroundOf([{ content: 'x' }], false)).toBeNull();
  });

  it('開著、沒有背景腳本 ⇒ null（跟開關無關的既有行為）', () => {
    expect(backgroundOf([], true)).toBeNull();
    expect(backgroundOf(undefined, true)).toBeNull();
  });

  it('開著、有背景腳本 ⇒ 逐支包好 <script> 接在一起', () => {
    const out = backgroundOf([{ content: 'a=1' }, { content: 'b=2' }], true);
    expect(out).toContain('a=1');
    expect(out).toContain('b=2');
    expect(out).toContain('<script');
  });
});
