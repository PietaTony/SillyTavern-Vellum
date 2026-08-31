import { get, patch } from '@/shared/lib/http';

/**
 * B5：這一輪最多回多長，使用者可調——後端形狀在
 * `server/services/maxResponseSettings.ts`，邊界常數在 `server/lib/maxResponseTokens.ts`。
 *
 * 🔴 跟 `historyBudgetApi.ts`（送出去的歷史）方向相反：這裡管**收回來**的一則多長，
 * 而且單位是**真的 token 數**，不是估的位元組——不要把兩邊的換算函式搞混。
 */
export type MaxResponseStatus = {
  tokens: number;
  isCustom: boolean;
  default: number;
  min: number;
  max: number;
};

export const fetchMaxResponseTokens = (): Promise<MaxResponseStatus> =>
  get('/api/settings/max-response');

export const setMaxResponseTokens = (tokens: number): Promise<MaxResponseStatus> =>
  patch('/api/settings/max-response', { tokens });
