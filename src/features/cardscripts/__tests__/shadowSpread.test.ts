import { describe, expect, it } from 'vitest';
import { reportBox, shadowSpread } from '../runtime/reportBox';

/**
 * 🔴 **這支守的是「桌寵的陰影不會被 `clip-path` 切一刀」**（Peter 2026-08-27
 * 「桌寵有奇怪的陰影」）。
 *
 * `getBoundingClientRect()` **不含 `filter` 與 `box-shadow` 的外溢**，
 * 而 overlay 的可見範圍就是拿那個框去裁的 ⇒ 不自己把陰影加回去，
 * 畫面上就會出現一圈邊緣是直線的髒灰色。
 *
 * 🔴 **數字全部取自真實的卡片**（測試卡A V2 的 `.hsnr-pet-orb`／`.hsnr-pet-whisper`），
 * 不是我自己編的。編出來的值測得過，真卡照樣切到。
 */
describe('shadowSpread', () => {
  it('🔴 測試卡A桌寵：drop-shadow(0 13px 22px) ⇒ 要留 35px，不是舊版的 0', () => {
    expect(
      shadowSpread({
        filter:
          'drop-shadow(0 13px 22px rgba(0,0,0,.48)) drop-shadow(0 0 10px rgba(232,168,192,.12))',
        boxShadow: 'none',
      }),
    ).toBe(35);
  });

  it('話泡的 box-shadow 也要算（getComputedStyle 會回成色在前的寫法）', () => {
    expect(
      shadowSpread({ filter: 'none', boxShadow: 'rgba(0, 0, 0, 0.34) 0px 10px 28px 0px' }),
    ).toBe(38);
  });

  it('🔴 inset 一點都不外溢 ⇒ 不可以撐開（撐開就是白白多一塊死區）', () => {
    expect(
      shadowSpread({
        filter: 'none',
        boxShadow:
          'rgba(212,212,220,.34) 0px 0px 0px 1px inset, rgba(16,16,24,.18) 0px -18px 30px 0px inset',
      }),
    ).toBe(0);
  });

  it('spread 半徑要一起算進去', () => {
    expect(shadowSpread({ filter: 'none', boxShadow: 'rgba(0,0,0,.3) 0px 4px 8px 6px' })).toBe(18);
  });

  it('沒有陰影就一點都不多給', () => {
    expect(shadowSpread({ filter: 'none', boxShadow: 'none' })).toBe(0);
    expect(shadowSpread({})).toBe(0);
  });

  it('🔴 卡片寫爆也要封頂 —— 不可以讓半個畫面變成吃點擊的死區', () => {
    expect(shadowSpread({ filter: 'drop-shadow(0 0 9999px #000)', boxShadow: 'none' })).toBe(120);
  });
});

describe('reportBox 真的把 spread 帶進 iframe', () => {
  /**
   * 🔴 尺沒壞的證明：上面那六條測的是 `shadowSpread` 這個 export，
   * 但真正跑在 iframe 裡的是它的 `toString()`。少了這一條，
   * 有人把注入那行刪掉，上面六條照樣全綠。
   */
  it('注入的腳本裡有 spread，而且量測時真的拿它撐開', () => {
    const s = reportBox('pet');
    expect(s).toContain('var spread=');
    expect(s).toContain('drop-shadow');
    // 四個邊都要用 d 撐開，不是只有其中幾邊
    for (const edge of ['q.left-d', 'q.top-d', 'q.right+d', 'q.bottom+d']) {
      expect(s).toContain(edge);
    }
  });
});
