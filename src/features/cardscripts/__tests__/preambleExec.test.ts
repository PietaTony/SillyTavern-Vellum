import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { PREAMBLE } from '../runtime/preamble';

/**
 * 🔴 **在此之前，組裝後的 `PREAMBLE` 從沒被任何測試真的執行過**（2026-08-28 稽核挖出來的）。
 *
 * ```
 * scripts/gate-preamble.ts:13   檔頭自己寫「node --check（只解析、不執行）」
 * 碰 PREAMBLE 的 4 支測試        cardLog / honestBridge / mvuShim / currentMessageId
 *                               → 全部是 PREAMBLE.toContain(...) 字串比對
 * 唯一真的執行的                 varScopes.test.ts 用 runInNewContext
 *                               → 但只跑 VARS_SHIM 那一段，不是組裝後的 PREAMBLE
 * ```
 * ⇒「卡片呼叫 `getChatMessages()` → 解析到我們的函式」這一跳，最高等級的證據
 * 曾經只是逐行讀 `NAMES` 陣列的字面量。反向那一跳（`host.ts`→`bridge.ts`）有
 * `hostOwner.test.ts` 的 jsdom 真執行背書，正向這一跳沒有——這支補上。
 *
 * ⚠️ 用 `node:vm` 而不是 jsdom `<script>`：理由跟 `varScopes.test.ts` 完全一樣
 * （jsdom 預設 `runScripts` 關掉；開全域 `runScripts:'dangerously'` 代價比這裡大）。
 * 這不違反 `gate:no-eval`——那條守的是「產品程式碼不動態執行卡片內容」，
 * 這裡執行的是**我們自己出貨的那段字串**，而且只在測試裡。
 *
 * 造一個最小、但形狀跟真的 iframe 一致的 sandbox：`window` 自己指向自己
 * （這樣 `window.x = …` 跟裸的 `x` 是同一個東西，跟瀏覽器裡 `window === globalThis`
 * 的語意一致）；`Object`／`Array`／`Promise`／`Proxy`／`JSON` 這些是
 * `vm.createContext` 自帶的全新一份內建物件，不用自己補。
 */
function runPreamble() {
  const posted: unknown[] = [];
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const domIds: Record<string, unknown> = {};
  const sandbox: Record<string, unknown> = {};
  sandbox['window'] = sandbox; // window === globalThis，跟真的 iframe 一致
  sandbox['console'] = console;
  sandbox['setTimeout'] = setTimeout;
  sandbox['parent'] = { postMessage: (msg: unknown) => posted.push(msg) };
  sandbox['addEventListener'] = (type: string, fn: (...args: unknown[]) => void) => {
    listeners[type] ??= [];
    listeners[type].push(fn);
  };
  sandbox['document'] = {
    getElementById: (id: string) => domIds[id] ?? null,
    querySelector: () => null,
  };
  runInNewContext(PREAMBLE, sandbox);
  return { sandbox, posted, listeners };
}

const NAMES = [
  'eventOn',
  'eventRemoveListener',
  'getChatMessages',
  'getLastMessageId',
  'getCurrentMessageId',
  'getAllVariables',
  'getVariables',
  'insertOrAssignVariables',
  'replaceVariables',
  'updateVariablesWith',
  'setChatMessages',
  'setChatMessage',
  'getLorebookEntries',
  'setLorebookEntries',
  'updateWorldbookWith',
  'generate',
];

describe('組裝後的 PREAMBLE 真的執行（node:vm）', () => {
  it('🔴 ① NAMES 裡的每一個名字，執行後真的變成 window 上的 function——不是字串裡有這個名字', () => {
    const { sandbox } = runPreamble();
    const win = sandbox['window'] as Record<string, unknown>;
    for (const n of NAMES) {
      expect(typeof win[n], `window.${n} 應該是 function`).toBe('function');
    }
  });

  it('🔴 ② 呼叫沒有原生實作的名字，真的送出正確形狀的 postMessage', async () => {
    const { sandbox, posted } = runPreamble();
    const win = sandbox['window'] as Record<string, (...a: unknown[]) => unknown>;
    win['getChatMessages']?.(1, 3);
    expect(posted).toHaveLength(1);
    const msg = posted[0] as Record<string, unknown>;
    expect(msg['__vellumCall']).toBe('getChatMessages');
    expect(msg['args']).toEqual([1, 3]);
    expect(typeof msg['id']).toBe('number');
    expect('owner' in msg).toBe(true);
    expect('frame' in msg).toBe(true);
  });

  it('🔴 ③ VARS_SHIM 排在 NAMES.forEach 之前這件事真的成立——TavernHelper.getVariables 是同步版，不是 postMessage 包裝', () => {
    const posted: unknown[] = [];
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    const sandbox: Record<string, unknown> = {};
    sandbox['window'] = sandbox;
    sandbox['console'] = console;
    sandbox['setTimeout'] = setTimeout;
    sandbox['parent'] = { postMessage: (msg: unknown) => posted.push(msg) };
    sandbox['addEventListener'] = (type: string, fn: (...args: unknown[]) => void) => {
      listeners[type] ??= [];
      listeners[type].push(fn);
    };
    sandbox['document'] = { getElementById: () => null, querySelector: () => null };
    // 種一份變數——跟 srcdoc.ts 的 seedGlobal('__vellumVars', …) 同一個鍵。
    sandbox['__vellumVars'] = { global: {}, character: {}, chat: { 好感度: 42 } };
    runInNewContext(PREAMBLE, sandbox);
    const win = sandbox['window'] as Record<string, unknown> & {
      getVariables: (opts?: unknown) => unknown;
      TavernHelper: Record<string, (...a: unknown[]) => unknown>;
    };
    // 🔴 **裸的 `window.getVariables` 不能證明順序對不對**：VARS_SHIM 本身會
    // `window.getVariables = function (opts) { return bucket(opts); }`，
    // 不管排在 NAMES 迴圈前後，跑完之後裸的那一個永遠是它自己最後蓋上去的那一份，
    // 兩種順序都會綠燈、測不出差異——這是這支測試第一版踩到的坑（見這輪回報）。
    // ⇒ **真正受順序影響的是 `H`**（`preamble.ts` 註解自己講的：「否則 H 會綁到
    // 非同步的那一版」）——`H` 是 `TavernHelper` 這個 Proxy 的底，`NAMES.forEach`
    // 執行的當下 `window.getVariables` 是不是還沒定義，決定了 `H.getVariables`
    // 綁到同步版還是 `call()` 包裝，而且**之後不會再被覆寫**（`H` 是一次性建好的
    // 物件，VARS_SHIM 事後改 `window.getVariables` 對它沒有任何影響）。
    const direct = win.getVariables({ type: 'chat' });
    expect(direct).not.toBeInstanceOf(Promise);
    expect((direct as Record<string, unknown>)['好感度']).toBe(42);

    const viaHelper = win.TavernHelper['getVariables']?.({ type: 'chat' });
    expect(typeof (viaHelper as { then?: unknown } | undefined)?.then).not.toBe('function');
    expect((viaHelper as Record<string, unknown>)['好感度']).toBe(42);
    // 同步取值不會經過 call()，不會有任何 postMessage 送出。
    expect(posted).toHaveLength(0);
  });

  it('🔴 ④ TavernHelper 對沒實作的名字：console.warn 一次 ＋ resolve(undefined)，不是 undefined is not a function', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { sandbox } = runPreamble();
    const win = sandbox['window'] as Record<string, Record<string, (...a: unknown[]) => unknown>>;
    const th = win['TavernHelper'];
    const result = th?.['某個還沒實作的方法']?.() as { then?: unknown } | undefined;
    // 🔴 不能用 `instanceof Promise`：`vm.createContext` 是**新的一份內建物件**，
    // 裡面的 `Promise` 建構子跟外層測試的 `Promise` 不是同一個——thenable 才是
    // 跨 realm 也成立的判準。
    expect(typeof result?.then).toBe('function');
    await expect(result).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls.at(-1)?.[0])).toContain('某個還沒實作的方法');
    warn.mockRestore();
  });
});

/**
 * 🔴 **先讓尺量一個知道會被抓到的東西**——這四條斷言的「紅燈證明」是手動複驗，
 * 記錄在這輪的回報裡（不寫進正式套件：那會在綠色 CI 裡放一段永遠紅的死代碼）：
 *
 *   · 把 `preamble.ts` 的 `NAMES` 陣列拿掉 `'getChatMessages'` → 上面①在那個名字上
 *     FAIL（`window.getChatMessages` 變成 `undefined`，`typeof` 不是 `'function'`）。
 *   · 把 `preamble.ts` 裡 `${VARS_SHIM}` 搬到 `${MVU_SHIM}`／`NAMES.forEach` **之後**
 *     → 上面③ FAIL：`getVariables` 回傳值變成 `Promise`（落到 `call()` 包裝），
 *     `posted` 也不再是 0。
 * 兩個都手動驗過、改回來後全線變綠——見這輪的回報。
 */
