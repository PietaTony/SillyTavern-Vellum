import type { Message, MessageActions } from '@/features/chat';
import { ApiError, del, patch } from '@/shared/lib/http';
import { pushToast } from '@/shared/ui/toastStore';

/**
 * 長按選單那四件事的接線（複製不在這裡，它純前端）。
 *
 * 🔴 **後端目前沒有這兩支端點。** `server/routes/chats.ts` 只有
 * `POST /messages`（append）與 `PATCH /messages/:id/swipe`；改內容與刪除都還沒有。
 * `server/` 是 UI 線的禁區 ⇒ 規格已寫成 prompt 交給主執行線（見 `TASKS.md`）：
 *   · `PATCH  /api/chats/:id/messages/:messageId`            body `{ text }`
 *   · `DELETE /api/chats/:id/messages/:messageId[?cascade=1]`
 * ⚠️ **端點到位前按下去會拿到 404**，而這裡把 404 翻成一句說得出原因的 tips ——
 * 這是刻意的：這個 repo 最貴的缺陷形狀是「按了、靜靜地什麼都沒發生」。
 *
 * 🔴 **每一支都要把例外往上丟。** `useRowActions` 靠 reject 決定
 * 「編輯框不要關、字留著」；在這裡吞掉就變成「存失敗但看起來存好了」。
 *
 * 🔴 這一支住 `app/screens/` 不住 `features/chat/`：每個 feature 的 `api.ts` 是主執行線的地盤，
 * 端點落地之後這幾個 `fetch` 應該搬進 `features/chat/api.ts`，這裡只留呼叫。
 */
export function messageActions({
  chatId,
  refetch,
  reset,
  regenerate,
}: {
  chatId: string;
  /** 重讀這段對話，回傳**重讀之後**那一份訊息串。 */
  refetch: () => Promise<Message[]>;
  /** 丟掉樂觀暫存，改讀伺服器那份（見 `useChatStream` 檔頭 B1）。 */
  reset: () => void;
  /** 不加新訊息、直接再生成一次。`base` 是刪完重讀回來的那一份。 */
  regenerate: (base: Message[]) => void;
}): MessageActions {
  const blame = (e: unknown): never => {
    const text =
      e instanceof ApiError && e.status === 404
        ? '後端還沒有這支端點 —— 改／刪訊息要等主執行線補上 server/routes/chats.ts'
        : e instanceof Error
          ? e.message
          : '沒做成';
    pushToast({ severity: 'warning', text });
    throw e; // 🔴 一定要往上丟，見檔頭
  };

  /** 🔴 順序就是重點：先 `refetch()` 再 `reset()`，反過來會閃一下舊資料。 */
  const reread = async (): Promise<Message[]> => {
    const ms = await refetch();
    reset();
    return ms;
  };

  const path = (messageId: string) => `/api/chats/${chatId}/messages/${messageId}`;

  return {
    onEdit: async (messageId, text) => {
      await patch(path(messageId), { text }).catch(blame);
      await reread();
    },
    onDelete: async (messageId) => {
      await del(path(messageId)).catch(blame);
      await reread();
    },
    onRegenerate: async (messageId) => {
      // `cascade=1` ＝ 連同這則之後的一起刪。不刪的話新生成的會接在舊回覆後面。
      await del(`${path(messageId)}?cascade=1`).catch(blame);
      regenerate(await reread());
    },
  };
}
