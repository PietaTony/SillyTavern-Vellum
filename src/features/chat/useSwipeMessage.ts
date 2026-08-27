import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { pushToast } from '@/shared/ui/toastStore';
import { type SwipeResult, swipeMessage } from './api';

/**
 * 🔴 **換開場白會動世界書，那件事一定要說出來**（Peter 2026-08-27）。
 * 在此之前它是完全靜默的：使用者換一則開場，背後有十幾條世界書被開關，
 * 畫面上沒有任何跡象 —— 而那正是這個 repo 最貴的缺陷形狀。
 *
 * 🔴 **文案要講「切換」這個邏輯本身**，不只報數字。使用者需要知道
 * 「換一條線 ＝ 上一條會被關掉」，否則他會以為自己弄丟了設定。
 * ⚠️ 也要講**沒被動到的那些**：共用的背景設定與他自己調的開關都留著，
 * 不然「關掉 8 條」聽起來像把他的世界書拆了。
 */
function loreToast(lore: SwipeResult['lore']): void {
  if (!lore || lore.changed === 0) return;
  const on = lore.include.length;
  const off = lore.turnedOff.length;
  pushToast({
    severity: 'info',
    text: off
      ? `世界書換成這條線：開 ${on} 條、關掉別條線的 ${off} 條。共用的與你自己調的不動。`
      : `世界書換成這條線：開 ${on} 條。共用的與你自己調的不動。`,
  });
}

/**
 * 切候選（換一則回覆／換開場）。
 *
 * 🔴 **`reset()` 不可以省**（敵意審查 2026-08-26 B1）：畫面讀「樂觀暫存 ?? 伺服器那份」，
 * 送過訊息後暫存不是 null ⇒ `refetch()` 的新資料被 `??` 短路，
 * 三個入口同時「按了沒反應」。
 * ⚠️ 先 `await refetch()` 再 `reset()`；反過來會閃一下舊資料。**順序就是這條的重點。**
 */
export function useSwipeMessage(
  chatId: string,
  refetch: () => Promise<unknown>,
  reset: () => void,
): UseMutationResult<SwipeResult, Error, { messageId: string; index: number }> {
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      swipeMessage(chatId, messageId, index),
    onSuccess: async (r) => {
      await refetch();
      reset();
      loreToast(r.lore);
    },
  });
}
