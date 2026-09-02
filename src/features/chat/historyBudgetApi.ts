import { get, patch } from '@/shared/lib/http';

/**
 * A2/GAP-37（跨層票 2026-08-31，Peter 已簽）：對話歷史上限，使用者可調——
 * 後端形狀在 `server/services/settings.ts` 的 `getHistoryByteBudget()`／
 * `setHistoryByteBudget()`，邊界常數在 `server/lib/historyTruncation.ts`。
 *
 * 🔴 `min`／`max`／`default` 都從後端回傳，這支不硬記一份會跟後端漂移的數字。
 */
export type HistoryBudgetStatus = {
  bytes: number;
  isCustom: boolean;
  default: number;
  min: number;
  max: number;
};

export const fetchHistoryBudget = (): Promise<HistoryBudgetStatus> =>
  get('/api/settings/history-budget');

export const setHistoryBudget = (bytes: number): Promise<HistoryBudgetStatus> =>
  patch('/api/settings/history-budget', { bytes });

/**
 * 中文一字約 3 bytes——同 `historyTruncation.ts` 那套判準（沒有 tokenizer，只求
 * 「不低估的保守上界」）。這裡只是給使用者一個粗略的手感，不是精確字數。
 */
export const bytesToApproxChars = (bytes: number): number => Math.round(bytes / 3);

/**
 * 典型 RP 一輪（使用者＋角色各一段）約 1500 bytes——跟 `historyTruncation.ts`
 * 檔頭「數字怎麼來」那幾段用的是同一份估算，換算比例要跟著那邊一起改。
 */
export const bytesToApproxRounds = (bytes: number): number => Math.max(0, Math.floor(bytes / 1500));
