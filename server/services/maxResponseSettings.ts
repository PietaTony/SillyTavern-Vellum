/**
 * B5：使用者調過的「這一輪最多回多長」，持久化。
 *
 * 🔴 **獨立檔案（`maxResponseSettings.json`），不擠進 `settings.json`／`Settings`
 * 型別**——理由、邊界數字的來源、跟歷史上限的方向差異，都記在
 * `../lib/maxResponseTokens.ts`，這裡不重複。
 */
import { readJson, writeJson } from '../adapters/storage.ts';
import {
  DEFAULT_MAX_OUTPUT_TOKENS,
  MAX_MAX_OUTPUT_TOKENS,
  MIN_MAX_OUTPUT_TOKENS,
} from '../lib/maxResponseTokens.ts';

const FILE = 'maxResponseSettings.json';
type Store = { maxOutputTokens?: number };

export type MaxResponseStatus = {
  tokens: number;
  /** 使用者真的動過這個值，還是仍在吃 `DEFAULT_MAX_OUTPUT_TOKENS`。 */
  isCustom: boolean;
  default: number;
  min: number;
  max: number;
};

/**
 * 沒設過就回預設值——同 `getHistoryByteBudget()` 的形狀（`min`／`max`／`default`
 * 一起回傳，前端不必自己硬記一份會跟後端漂移的數字）。
 */
export async function getMaxResponseTokens(): Promise<MaxResponseStatus> {
  const s = await readJson<Store>(FILE, {});
  return {
    tokens: s.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    isCustom: s.maxOutputTokens !== undefined,
    default: DEFAULT_MAX_OUTPUT_TOKENS,
    min: MIN_MAX_OUTPUT_TOKENS,
    max: MAX_MAX_OUTPUT_TOKENS,
  };
}

/** 🔴 邊界在路由層驗證過——這裡假設呼叫端已經驗過，不重複驗一次（同 `settings.ts` 的慣例）。 */
export async function setMaxResponseTokens(tokens: number): Promise<void> {
  await writeJson(FILE, { maxOutputTokens: tokens });
}
