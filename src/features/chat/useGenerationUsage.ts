import { useState } from 'react';
import type { Usage } from './model';

/**
 * B4：這一輪生成的用量讀數。**抽出來的理由**跟 `stopGeneration.ts` 一樣——
 * `useChatStream.ts` 在動工前就已經卡在 150 行上限（`origin/staging` 量過，149
 * 行），新邏輯塞不進去，唯一乾淨的路是另開檔案（`src/features/chat/**` 是我已
 * 認領的 glob，開新檔不會變孤兒），不是把既有註解砍薄。
 *
 * 🔴 **只留「最近一輪」，不是逐則訊息的帳本**：使用者要看的是「剛剛那次花了
 * 多少」，不是完整歷史。下一次送出／重生成就該清空，不然舊數字會被誤讀成
 * 這一輪的（尤其是失敗重試：上一輪成功的用量還掛在畫面上，看起來像是這次的）。
 */
export function useGenerationUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);

  const clear = () => setUsage(null);

  /** 供應商沒回任何欄位時 `payload.usage` 是 `undefined`（見 `model.ts` 的 parseSse）。 */
  const record = (u: Usage | undefined) => setUsage(u ?? null);

  return { usage, clear, record };
}
