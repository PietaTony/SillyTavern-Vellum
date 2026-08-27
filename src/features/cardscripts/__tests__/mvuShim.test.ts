import { describe, expect, it } from 'vitest';
import { MVU_SHIM, MVU_UPDATED } from '../runtime/mvuShim';
import { PREAMBLE } from '../runtime/preamble';
import { VARS_SHIM } from '../runtime/vars';

/**
 * 我們自己扮演 MVU（Peter 2026-08-27：「我們要相容這張卡，用我們的方式，安全地完成」
 * 「我不想要引入外部的 Vue」）。
 *
 * 🔴 背景：卡片載的 MVU 假設全域有 `Vue` 與 zod，我們的沙箱沒有 ⇒ 它一載入就炸
 * ⇒ `waitGlobalInitialized('Mvu')` 永遠等不到 ⇒ 狀態欄從來沒被填過。
 * 補外部依賴的代價是把產品的核心狀態押在別人的 CDN 上，所以改成補「卡片認得的介面」。
 *
 * ⚠️ shim 是要塞進 `srcdoc` 的字串，**跑在 iframe 裡** —— 這裡測不到它執行
 *（jsdom 起不了 opaque origin 的 srcdoc frame）。這支守的是**結構與順序**，
 * 行為面靠實機。
 */
describe('Mvu 相容殼', () => {
  it('🔴 要排在 VARS_SHIM 之後 —— 它要就地改 SCOPES，早一步就抓不到那個變數', () => {
    expect(PREAMBLE).toContain(MVU_SHIM);
    expect(PREAMBLE.indexOf(VARS_SHIM)).toBeLessThan(PREAMBLE.indexOf(MVU_SHIM));
  });

  it('卡片讀的是 Mvu.events.VARIABLE_UPDATE_ENDED，殼要給得出來', () => {
    expect(MVU_SHIM).toContain('VARIABLE_UPDATE_ENDED');
    expect(MVU_SHIM).toContain(MVU_UPDATED);
  });

  it('🔴 已經有人定義過就不要蓋 —— 真的 MVU 有天跑得起來時它該贏', () => {
    expect(MVU_SHIM).toContain('if (!window.Mvu)');
  });

  it('🔴 推變數要就地覆寫不換物件 —— 卡片抓著同步快取那個參考不放', () => {
    expect(MVU_SHIM).toContain('delete cur[x]');
    expect(MVU_SHIM).toContain('cur[x] = next[x]');
  });

  it('🔴 不可以把 Vue／zod 加進外連白名單 —— 那是這次刻意沒做的事', async () => {
    const { VENDOR } = await import('../runtime/preamble');
    const joined = VENDOR.join(' ');
    expect(joined).not.toContain('vue');
    expect(joined).not.toContain('zod');
  });
});
