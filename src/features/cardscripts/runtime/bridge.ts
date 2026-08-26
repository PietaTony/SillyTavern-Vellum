import type { Chat, Message } from '@/features/chat';
import { type CardVarScope, type CardVarScopes, scopeOf } from './scopes';

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
  /**
   * 🔴 存變數（淺層合併）。卡片是**同步**寫的，所以 iframe 那端先打自己的快取、
   * 再非同步呼叫這支存檔 —— 回傳值沒有人在等（見 `runtime/vars.ts`）。
   * 🔴 **`scope` 決定存到哪裡**（三個端點各一）。在此之前四種範圍全存進同一份對話變數。
   */
  saveVariables: (patch: Record<string, unknown>, scope: CardVarScope) => Promise<unknown>;
  /** 建立 iframe 時要種進去的三份變數（見 `useCardScripts` 的 `vars`）。 */
  initialVars?: CardVarScopes | undefined;
};

/**
 * 🔴 **事件訂閱不在這裡** —— 搬去 `host.ts` 了（2026-08-26）。
 * 原因：這一層拿不到「是哪一個 frame 在訂」，而 iframe 傳過來的參數裡
 * **不可能**有 callback（函式過不了 `postMessage` 的結構化複製）。
 * 舊版把 `eventOn(event, fn)` 放在這裡 ⇒ `fn` 永遠是 `undefined`，
 * `emitToCards` 一發就會去呼叫 `undefined`。
 */

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
    getChatMessages(range?: unknown) {
      const all = deps.messages().map(shaped);
      // 卡片常傳 `0`（只要第一則）或 `'0-{{lastMessageId}}'`。數字就當索引。
      if (typeof range === 'number') return all[range] ? [all[range]] : [];
      return all;
    },
    getLastMessageId: () => Math.max(0, deps.messages().length - 1),
    getCurrentMessageId: () => Math.max(0, deps.messages().length - 1),
    /**
     * ⚠️ 這兩支**幾乎不會被呼叫**：iframe 那端已經用同步快取蓋掉了（`runtime/vars.ts`）。
     * 留著是為了「萬一有卡片走 TavernHelper.getVariables()」時不會掉進「沒實作」那條。
     */
    getAllVariables: () => ({}),
    getVariables: () => ({}),
    /**
     * 🔴 **第二個參數是範圍**（iframe 那端一定會送，見 `vars.ts` 的 `call('setVariables', …)`）。
     * 沒送就是 `chat` —— 與 iframe 那端同一套判準，兩邊不可以各判各的。
     */
    setVariables(patch: unknown, opts?: unknown) {
      return patch !== null && typeof patch === 'object'
        ? deps.saveVariables(patch as Record<string, unknown>, scopeOf(opts))
        : undefined;
    },
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
