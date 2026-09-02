import { useState } from 'react';

/**
 * 生成失敗的狀態，直接包成 `ChatFailure` 吃得下的 props（跨層票 B6，2026-08-31）。
 *
 * 🔴 **抽成獨立檔案的理由是行數**：`useChatStream.ts`／`$chatId.tsx` 都已經頂著
 * 150 行上限（`$chatId.tsx` 的呼叫端解構九個欄位就已經頂到 100 字元換行寬度，
 * 見那支檔頭同一個判準）——`failureBanner` 這顆物件跟 `generation` 一樣，
 * 是「包成一顆、呼叫端才不會被推過上限」，不是語意分組。
 *
 * 🔴 **物件的四個鍵刻意對齊 `ChatFailure` 的四個 props**（`message`／`retryable`／
 * `onRetry`／`onDismiss`），呼叫端可以直接 `<ChatFailure {...failureBanner} />`
 * 展開，不用逐個接——少一次「名字對不對」的手動核對。
 */
export type Failure = { message: string; retryable: boolean };

export function useFailureRetry(onRetry: () => void) {
  const [state, setFailure] = useState<Failure | null>(null);
  const failureBanner = state
    ? {
        message: state.message,
        retryable: state.retryable,
        onRetry,
        onDismiss: () => setFailure(null),
      }
    : null;
  return { failureBanner, setFailure };
}
