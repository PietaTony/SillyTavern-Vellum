import { deleteMessage, editMessage, type Message, type MessageActions } from '@/features/chat';
import { pushToast } from '@/shared/ui/toastStore';

/**
 * 長按選單那四件事的接線（複製不在這裡，它純前端）。
 *
 * 🔴 **每一支都要把例外往上丟。** `useRowActions` 靠 reject 決定
 * 「編輯框不要關、字留著」；在這裡吞掉就變成「存失敗但看起來存好了」。
 *
 * 🔴 **這裡只剩接線，沒有 `fetch`** —— 端點怎麼打住在 `features/chat/api.ts`
 * （`editMessage`／`deleteMessage`）。這一支管的是「打完之後畫面要怎麼動」：
 * 重讀、丟掉樂觀暫存、要不要接著生成。
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
  /**
   * 🔴 **後端的話原文顯示。** 例如「這樣會把整段對話刪光」——那句是給使用者看的，
   * 翻成「沒做成」等於把唯一說得出原因的資訊丟掉。
   */
  const blame = (e: unknown): never => {
    pushToast({ severity: 'warning', text: e instanceof Error ? e.message : '沒做成' });
    throw e; // 🔴 一定要往上丟，見檔頭
  };

  /** 🔴 順序就是重點：先 `refetch()` 再 `reset()`，反過來會閃一下舊資料。 */
  const reread = async (): Promise<Message[]> => {
    const ms = await refetch();
    reset();
    return ms;
  };

  return {
    onEdit: async (messageId, text) => {
      await editMessage(chatId, messageId, text).catch(blame);
      await reread();
    },
    onDelete: async (messageId) => {
      await deleteMessage(chatId, messageId).catch(blame);
      await reread();
    },
    onRegenerate: async (messageId) => {
      // 🔴 `cascade` ＝ 連同這則之後的一起刪。不刪的話新生成的會接在舊回覆後面。
      await deleteMessage(chatId, messageId, { cascade: true }).catch(blame);
      regenerate(await reread());
    },
  };
}

/**
 * 對話頁的接線版：把 react-query 那幾支接進 `messageActions`。
 *
 * 🔴 **抽出來是為了 `gate:file-size`** —— `chat/$chatId.tsx` 卡在 150 行，
 * 而這四行是純接線（哪個 refetch、哪個 reset），跟「這一頁長什麼樣」無關。
 */
export const chatMessageActions = (
  chatId: string,
  refetchChat: () => Promise<{ data?: { messages?: Message[] } | undefined }>,
  reset: () => void,
  regenerate: (base: Message[]) => void,
): MessageActions =>
  messageActions({
    chatId,
    refetch: async () => (await refetchChat()).data?.messages ?? [],
    reset,
    regenerate,
  });
