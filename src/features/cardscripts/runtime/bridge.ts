import type { Chat, Message } from '@/features/chat';

/**
 * 卡片程式呼叫得到的 API（M13 第二期）。
 *
 * 🔴 **只做實掃出來真的被用到的 10 個。**
 * 那 2 MB 卡片腳本裡命中的就是這幾支；酒館助手的完整 API 面有上百個，
 * 照單全做是為一張卡建一座工廠。
 * ⚠️ 代價寫在 `plans/90-BACKLOG.md` GAP-74：卡片改用第 11 個函式就會壞，
 *    **而且要壞得說得出是哪一個** —— 所以下面用 Proxy 補了一層「叫到沒實作的會出聲」。
 *
 * 🔴 **`generate` 刻意不接真的生成。** 它會**花錢**，而且卡片可以在你沒看的時候呼叫。
 * 先回一個明確的拒絕字串，不要靜默失敗也不要偷偷花錢（要開放是另一次決定）。
 */

export type BridgeDeps = {
  chatId: string;
  characterId: string;
  /** 現在畫面上的訊息（已渲染版）。 */
  messages: () => Message[];
  /** 切某一則的候選 —— 卡片的「前往此場景」就是靠這條。 */
  swipe: (messageId: string, index: number) => Promise<unknown>;
  /** 重讀對話（卡片改完東西之後要讓畫面跟上）。 */
  refresh: () => Promise<unknown>;
};

type Listener = (...args: unknown[]) => void;

const listeners = new Map<string, Listener[]>();

/** 主頁自己也要能發事件給卡片（例如「訊息換了」）。 */
export function emitToCards(event: string, ...args: unknown[]): void {
  for (const fn of listeners.get(event) ?? []) {
    try {
      fn(...args);
    } catch (e) {
      console.error('[卡片腳本] 事件處理出錯', event, e);
    }
  }
}

const shaped = (m: Message, i: number) => ({
  message_id: i,
  role: m.role === 'user' ? 'user' : 'assistant',
  message: m.text,
  swipe_id: m.swipeIndex ?? 0,
  swipes: m.swipes ?? [m.text],
  data: {},
});

export function buildBridge(deps: BridgeDeps): Record<string, unknown> {
  const api: Record<string, unknown> = {
    eventOn(event: string, fn: Listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), fn]);
    },
    eventRemoveListener(event: string, fn: Listener) {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((f) => f !== fn),
      );
    },
    getChatMessages(range?: unknown) {
      const all = deps.messages().map(shaped);
      // 卡片常傳 `0`（只要第一則）或 `'0-{{lastMessageId}}'`。數字就當索引。
      if (typeof range === 'number') return all[range] ? [all[range]] : [];
      return all;
    },
    getLastMessageId: () => Math.max(0, deps.messages().length - 1),
    getCurrentMessageId: () => Math.max(0, deps.messages().length - 1),
    getAllVariables: () => ({}),
    getVariables: () => ({}),
    async setChatMessages(updates: unknown) {
      /**
       * 🔴 卡片用它做兩件事：改訊息文字、**切候選**。我們只接後者。
       * 改文字＝竄改對話紀錄，那是資料損毀等級的權限，不在這一期開放。
       */
      const list = Array.isArray(updates) ? updates : [updates];
      const msgs = deps.messages();
      for (const u of list as { message_id?: number; swipe_id?: number }[]) {
        const target = msgs[u?.message_id ?? 0];
        if (!target || typeof u?.swipe_id !== 'number') continue;
        await deps.swipe(target.id, u.swipe_id);
      }
      await deps.refresh();
    },
    setChatMessage(_content: unknown, id: number, opts?: { swipe_id?: number }) {
      return api['setChatMessages'] instanceof Function
        ? (api['setChatMessages'] as (u: unknown) => Promise<void>)({
            message_id: id,
            swipe_id: opts?.swipe_id,
          })
        : undefined;
    },
    getLorebookEntries: () => [],
    setLorebookEntries: () => undefined,
    updateWorldbookWith: () => undefined,
    generate() {
      // 見檔頭：不靜默失敗，也不偷偷花錢。
      throw new Error('Vellum 尚未開放卡片腳本自行呼叫生成（會計費）');
    },
  };
  return api;
}

/** 叫到沒實作的函式時要**說得出是哪一個**，不可以是一句 `undefined is not a function`。 */
export const withReporting = (api: Record<string, unknown>): Record<string, unknown> =>
  new Proxy(api, {
    get(t, k: string) {
      if (k in t) return t[k];
      return (...args: unknown[]) => {
        console.warn(`[卡片腳本] 這張卡呼叫了 Vellum 還沒實作的 TavernHelper.${k}()`, args);
        return undefined;
      };
    },
  });

export type { Chat };
