import { describe, expect, it } from 'vitest';
import { GLOBAL_WAIT_MS, GLOBALS_SHIM, makeWaitGlobal } from '../runtime/globals';

/**
 * 🔴 **這支直接呼叫真的那支函式**，不是比對字串、也不是 `new Function`
 *（`gate:no-eval` 守的就是後者，而繞過閘門去測試等於自己開洞）。
 * 做得到是因為 shim 是從 `makeWaitGlobal.toString()` 產生的 —— 同一份 code，兩個出口。
 *
 * 守的事情只有一件：**等不到的時候不可以永遠等下去**。
 * 上一版沒有逾時 ⇒ 標的卡的 `init()` 卡在第一行，
 * `populateCharacterData()`／`renderPage()`／`eventOn()` 一行都沒跑過，
 * 而症狀跟「這個功能沒做」一模一樣、沒有任何錯誤訊息。
 */
function make() {
  const win: Record<string, unknown> = {};
  const globals: Record<string, unknown> = {};
  const said: string[] = [];
  const wait = makeWaitGlobal(win, globals, GLOBAL_WAIT_MS, (m) => said.push(m));
  const init = (name: string, value: unknown): void => {
    globals[name] = value;
    win[name] = value;
  };
  return { wait, init, said };
}

describe('waitGlobalInitialized', () => {
  it('已經登記過的全域，馬上就回', async () => {
    const { wait, init } = make();
    init('Mvu', { events: {} });
    await expect(wait('Mvu', 200)).resolves.toEqual({ events: {} });
  });

  it('稍後才登記的也等得到（這是它原本的用途）', async () => {
    const { wait, init } = make();
    setTimeout(() => init('晚到的', 42), 60);
    await expect(wait('晚到的', 2000)).resolves.toBe(42);
  });

  /** 🔴 **這條就是 GAP-122**。等不到 `Mvu` 是常態，所以它必須收得了尾、說得出等不到什麼。 */
  it('🔴 等不到就逾時、出聲、回 undefined —— 不可以卡住', async () => {
    const { wait, said } = make();
    await expect(wait('Mvu', 120)).resolves.toBeUndefined();
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('Mvu');
    expect(said[0]).toContain('Vellum 沒有提供它');
  });

  /**
   * 🔴 **逾時之後是 resolve 不是 reject**：卡片的 `init()` 會接著跑不需要 `Mvu` 的那兩支
   *（畫面出得來），到真的用 `Mvu.events` 才炸。reject 的話那兩支也不會跑。
   */
  it('🔴 逾時是 resolve 不是 reject —— 讓卡片跑完不需要它的那一段', async () => {
    const { wait } = make();
    let rejected = false;
    await wait('不存在的', 80).catch(() => {
      rejected = true;
    });
    expect(rejected).toBe(false);
  });

  it('預設逾時是有限的數字，不是 Infinity', () => {
    expect(Number.isFinite(GLOBAL_WAIT_MS)).toBe(true);
    expect(GLOBAL_WAIT_MS).toBeGreaterThan(1000);
  });

  /**
   * 🔴 **shim 真的是從那支函式產生的**。這條防的是「有人改了函式卻另外維護一份字串」——
   * 那樣測試照樣全綠，而 iframe 裡跑的是舊的。
   */
  it('🔴 shim 內容來自 makeWaitGlobal，不是另外抄的一份', () => {
    expect(GLOBALS_SHIM).toContain('waitGlobalInitialized');
    expect(GLOBALS_SHIM).toContain(String(GLOBAL_WAIT_MS));
    // 函式本體的特徵字串要真的出現在 shim 裡
    expect(GLOBALS_SHIM).toContain('Vellum 沒有提供它');
  });
});
