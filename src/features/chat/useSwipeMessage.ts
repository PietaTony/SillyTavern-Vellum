import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { type SwipeResult, swipeMessage } from './api';

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
    onSuccess: async () => {
      await refetch();
      reset();
    },
  });
}
