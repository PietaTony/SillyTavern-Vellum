import type { Chat, Message } from '@/features/chat';
import { makeApplyUpdates } from './messageEdit';
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
  /**
   * 切某一則的候選 —— 卡片的「前往此場景」就是靠這條。
   *
   * 🔴 **這支自己會重讀對話**（`useSwipeMessage` 的 `onSuccess` 裡 `await refetch()`），
   * 所以這裡**不可以再 refresh 一次**。上一版另外有一個 `refresh` dep，切完再叫一次
   * ⇒ **一次成功的 swipe ＝ 兩次 refetch，N 筆 ＝ N+1 次**（敵意驗收 2026-08-27 實測）。
   * ⚠️ 既有測試把 `swipe` mock 掉，所以完全看不到這件事 —— **那是假綠燈**。
   * ⇒ `refresh` 已移除。要加回來之前先確認 `swipe` 那條路真的不重讀了。
   */
  swipe: (messageId: string, index: number) => Promise<unknown>;
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
  // 卡片想動訊息時該發生什麼 —— 判準與文案全在 `messageEdit.ts`。
  const { applyUpdates, reportBlocked } = makeApplyUpdates(deps);
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
    setChatMessages: applyUpdates,
    /**
     * 🔴 **只想改文字的那一路，連 `applyUpdates` 都不要進。**
     * 進去只會多繞一圈再什麼都不做。
     * ⚠️ **不要把 `message` 往下傳** —— 傳了會讓同一次呼叫在
     * `setChatMessages` 名下再講一次（同一件事兩則訊息、而且署名錯人）。
     */
    setChatMessage(content: unknown, id: number, opts?: { swipe_id?: number }) {
      const swiping = typeof opts?.swipe_id === 'number';
      const texting = content !== undefined;
      if (!swiping) {
        reportBlocked('setChatMessage', id, {
          kind: texting ? 'text-only' : 'nothing',
        });
        return undefined;
      }
      // 🔴 有切到候選就**不可以**說「沒有任何變更」——那句話會是假的。
      if (texting) reportBlocked('setChatMessage', id, { kind: 'text-with-swipe' });
      return applyUpdates({ message_id: id, swipe_id: opts?.swipe_id });
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

export type { Chat };
