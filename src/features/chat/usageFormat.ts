import type { Usage } from './model';

/**
 * B4：把 `Usage` 排成人看得懂的一行。純函式，抽出來的理由跟 `swipeDisplay.ts`
 * 一樣——`model.ts` 已經有 `parseSse`／`shouldSubmitOnKey` 兩組不相干的規則，
 * 再塞一組格式化邏輯只是讓那支檔案變成雜物間。
 *
 * 🔴 **沒有任何欄位就回 `null`**——呼叫端（`UsageReadout`）拿 `null` 當「不畫」，
 * 不要畫一行空白的用量。
 * 🔴 `cacheRead` 才顯示，是因為那是 prompt cache 有沒有生效的唯一證據
 * （見 `server/providers/formats/anthropic.ts` 檔頭 V6）——沒有值就不是「沒省」，
 * 是這家供應商根本不回這個數字，硬顯示 0 會誤導成「快取沒命中」。
 */
export function formatUsage(u: Usage): string | null {
  const parts: string[] = [];
  if (u.inputTokens !== undefined) parts.push(`輸入 ${u.inputTokens}`);
  if (u.outputTokens !== undefined) parts.push(`輸出 ${u.outputTokens}`);
  if (u.cacheRead !== undefined) parts.push(`快取命中 ${u.cacheRead}`);
  return parts.length ? parts.join(' ・ ') : null;
}
