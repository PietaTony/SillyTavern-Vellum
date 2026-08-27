import { afterEach, describe, expect, it, vi } from 'vitest';
// ⚠️ `registerFrame` 2026-08-27 從 `runtime/host` 搬到 `runtime/frames`（host 撞到 150 行）。
import { registerFrame } from '../runtime/frames';
import { installBridgeHost } from '../runtime/host';

/**
 * 🔴 **這支守的是那條鏈的中間段。**
 * `getCurrentMessageId` 的兩端（bridge 算得對、srcdoc 種得進去）都有測試，
 * 而**中間「host 把 frame 的歸屬代填進參數」那一步一個測試都沒有**——
 * 實測：把 `OWNER_AWARE` 清空（＝鏈中間斷掉），85 條測試**全綠**。
 * ⇒ 判準：**一條鏈要在每一段都有斷點測試**，兩端對不代表中間通。
 *
 * ⚠️ 順帶守住 host 的另外兩條既有行為：不是我們開的 frame 不回應、
 * 沒實作的要回 error（那是「誠實失敗」的落點）。
 */
type Reply = { __vellumReply?: number; result?: unknown; error?: string };

/** 假裝成一個 iframe 的 window：只要有 postMessage 就夠了。 */
function fakeFrame() {
  const replies: Reply[] = [];
  const win = { postMessage: (m: Reply) => replies.push(m) } as unknown as Window;
  return { win, replies };
}

const post = (src: Window, data: unknown): void => {
  window.dispatchEvent(new MessageEvent('message', { data, source: src as MessageEventSource }));
};

/** 等 host 那條 async 路徑跑完（它是 `void serve(...)`，不會回傳 Promise）。 */
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

describe('host 代填 frame 的歸屬', () => {
  it('🔴 getCurrentMessageId 收到的是 frame 的 owner，不是卡片送的參數', async () => {
    const seen: unknown[] = [];
    stop = installBridgeHost({
      getCurrentMessageId: (...a: unknown[]) => {
        seen.push(a);
        return 7;
      },
    });
    const { win, replies } = fakeFrame();
    registerFrame(win);
    // 卡片是不帶參數呼叫的；就算它亂送東西也要被覆蓋掉
    post(win, { __vellumCall: 'getCurrentMessageId', args: ['卡片亂送的'], id: 1, owner: 'm3' });
    await settle();
    expect(seen).toEqual([['m3']]);
    expect(replies[0]).toEqual({ __vellumReply: 1, result: 7 });
  });

  it('沒有 owner 時代填空字串，不是 undefined', async () => {
    const seen: unknown[] = [];
    stop = installBridgeHost({
      getCurrentMessageId: (...a: unknown[]) => {
        seen.push(a);
        return 0;
      },
    });
    const { win } = fakeFrame();
    registerFrame(win);
    post(win, { __vellumCall: 'getCurrentMessageId', args: [], id: 2 });
    await settle();
    expect(seen).toEqual([['']]);
  });

  it('🔴 其他函式的參數不可以被動到', async () => {
    const seen: unknown[] = [];
    stop = installBridgeHost({
      getChatMessages: (...a: unknown[]) => {
        seen.push(a);
        return [];
      },
    });
    const { win } = fakeFrame();
    registerFrame(win);
    post(win, { __vellumCall: 'getChatMessages', args: ['甲', '乙'], id: 3, owner: 'm3' });
    await settle();
    expect(seen).toEqual([['甲', '乙']]);
  });

  it('沒實作的要回 error —— 誠實失敗的落點就在這裡', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stop = installBridgeHost({});
    const { win, replies } = fakeFrame();
    registerFrame(win);
    post(win, { __vellumCall: 'getLorebookEntries', args: [], id: 4 });
    await settle();
    expect(replies[0]?.error).toContain('getLorebookEntries');
  });

  it('🔴 不是我們開的 frame ⇒ 完全不回應（回應本身就是存在證明）', async () => {
    stop = installBridgeHost({ getLastMessageId: () => 1 });
    const { win, replies } = fakeFrame(); // 刻意不 registerFrame
    post(win, { __vellumCall: 'getLastMessageId', args: [], id: 5 });
    await settle();
    expect(replies).toEqual([]);
  });
});
