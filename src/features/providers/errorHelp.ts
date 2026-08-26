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

export function explainProviderError(
  reason: string | null | undefined,
  provider: string,
  consoleUrl: string,
): ErrorHelp {
  if (reason !== 'no-credit') return null;
  return {
    text: '這一家的餘額或額度用完了。',
    url: BILLING_URLS[provider] ?? consoleUrl,
  };
}
