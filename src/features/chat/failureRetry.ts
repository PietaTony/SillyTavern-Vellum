import { useState } from 'react';

/**
 * 生成失敗的結構化狀態——`retryable` 跟 `message` 一起搬（跨層票 B6，2026-08-31）。
 *
 * 🔴 **抽成獨立檔案的理由是行數**：`useChatStream.ts` 動工前已經 146 行，直接把
 * `useState<string|null>` 換成結構化的 `Failure` 會推過 150 行上限——跟
 * `streamEventHandler.ts` 當初被抽出來的理由一樣（見那支檔頭）。
 *
 * 🔴 **對外仍然只用一顆 `setFailure`**：`$chatId.tsx` 現有的 `setFailure(null)`
 * 呼叫方式（不在這輪授權清單裡的那支）傳的一律是 `null`，跟這裡的
 * `Failure | null` 型別相容，不用另外包一層字串轉接。
 */
export type Failure = { message: string; retryable: boolean };

export function useFailureRetry() {
  const [state, setFailure] = useState<Failure | null>(null);
  return {
    failure: state?.message ?? null,
    failureRetryable: state?.retryable ?? false,
    setFailure,
  };
}
