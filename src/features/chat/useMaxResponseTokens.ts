import { useQuery } from '@tanstack/react-query';
import { fetchMaxResponseTokens } from './maxResponseApi';

/**
 * B5：使用者調過的 AI 回應上限，快取給聊天頁用。
 *
 * 🔴 `staleTime: Infinity`——這個值只有使用者在設定頁的 `MaxResponseSection.tsx`
 * 存檔時才會變，那邊 `useMutation` 成功會 `setQueryData` 同一把 `['max-response']`
 * key，聊天頁自然跟著拿到新值，不需要每次進頁面都重打一次這支 API。
 *
 * 🔴 **抽成獨立 hook 而不是直接寫在 `useChatStream` 裡**：`useChatStream` 現有的
 * 一大批測試直接 `renderHook(() => useChatStream(...))`，沒包 `QueryClientProvider`——
 * 讓 `useChatStream` 自己 `useQuery` 會讓那整批測試炸掉。呼叫端（`$chatId.tsx`，
 * 本來就在 provider 底下）用這支拿值，再把 `.data?.tokens` 轉送給 `useChatStream`。
 */
export function useMaxResponseTokensQuery() {
  return useQuery({
    queryKey: ['max-response'],
    queryFn: fetchMaxResponseTokens,
    staleTime: Infinity,
  });
}
