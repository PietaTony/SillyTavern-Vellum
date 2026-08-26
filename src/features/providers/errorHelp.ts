/**
 * 把後端分類過的錯誤變成「那怎麼辦」。
 *
 * 🔴 **這裡不再自己判斷錯誤種類** —— 判準只有一份，住在
 * `server/lib/providerError.ts`（那邊的分類結果會決定要不要存模型，
 * 存檔是後端的事）。前端只讀它回的 `reason`。
 * ⚠️ 之前兩邊各有一份 regex，那是「畫面說已存、實際沒存」的溫床。
 */
export type ErrorHelp = { text: string; url: string } | null;

/** 各家「儲值／帳單」頁。**查不到就退回該家的控制台網址**（呼叫端傳進來）。 */
const BILLING_URLS: Record<string, string> = {
  anthropic: 'https://console.anthropic.com/settings/billing',
  openai: 'https://platform.openai.com/settings/organization/billing',
  deepseek: 'https://platform.deepseek.com/top_up',
  openrouter: 'https://openrouter.ai/credits',
  google: 'https://aistudio.google.com/app/plan_information',
  mistralai: 'https://admin.mistral.ai/plateforme/billing',
  perplexity: 'https://www.perplexity.ai/account/api/billing',
  groq: 'https://console.groq.com/settings/billing',
  xai: 'https://console.x.ai/team/default/billing',
};

/**
 * 🔴 **要帶供應商的名字，不可以寫「這一家」**（Peter 2026-08-27）。
 * tips 是**離開這一頁之後也看得到**的東西（`ToastStack` 掛在 root）——
 * 使用者可能剛按過三家的測試鈕，一句「這一家」他分不出是哪一家。
 * ⚠️ `displayName` 沒給就退回 id：**寧可顯示 `openrouter` 也不要顯示「這一家」**。
 */
export function explainProviderError(
  reason: string | null | undefined,
  provider: { id: string; displayName?: string | undefined } | string,
  consoleUrl: string,
): ErrorHelp {
  if (reason !== 'no-credit') return null;
  const id = typeof provider === 'string' ? provider : provider.id;
  const name = typeof provider === 'string' ? provider : (provider.displayName ?? provider.id);
  return {
    text: `${name} 的餘額或額度用完了。`,
    url: BILLING_URLS[id] ?? consoleUrl,
  };
}
