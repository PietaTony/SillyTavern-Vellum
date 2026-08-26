/**
 * 把供應商回來的錯誤原文分類成「我們能給出口的」與「只能照實顯示的」。
 *
 * 🔴 **餘額不足一定是最常見的那一種**（Peter 2026-08-26：
 * 「所有廠商遇到類似這個錯誤…讓我們直接引導，而非跳錯誤訊息」）。
 * 丟一句 `Your credit balance is too low to access the Anthropic API.` 給使用者，
 * 他要自己讀英文、自己猜去哪裡儲值 —— 那是本專案一直在修的那種死路。
 *
 * 🔴 **原文不丟掉**：判斷錯的時候使用者還是要能把原文複製給我們。
 * 引導只是**蓋在上面**，不是取代。
 *
 * ⚠️ **判準刻意寬鬆（多命中幾個沒關係）**：誤判成「去儲值」的代價是他點過去發現餘額還夠；
 * 漏判的代價是他卡在一句英文錯誤訊息前面。兩者不對稱。
 */
export type ErrorHelp = { text: string; action: string; url: string } | null;

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
 * 餘額／額度用完的說法在各家長得不一樣，這裡收集實際看過與文件寫過的形狀。
 * 🔴 **不要收斂成一條聰明的 regex** —— 那會很難看出漏了誰，也很難補。
 */
const NO_CREDIT = [
  /credit balance is too low/i,
  /insufficient[\s_-]*(credit|balance|quota|funds)/i,
  /exceeded your current quota/i,
  /billing[\s_-]*(hard[\s_-]*limit|not[\s_-]*active)/i,
  /payment[\s_-]*required/i,
  /quota[\s_-]*exceeded/i,
  /arrears|余额不足|餘額不足|欠费|欠費/,
];

export function explainProviderError(raw: string, provider: string, consoleUrl: string): ErrorHelp {
  if (!NO_CREDIT.some((re) => re.test(raw))) return null;
  return {
    text: '這一家的餘額或額度用完了 —— 金鑰是好的，儲值之後就能用。',
    action: '去儲值',
    url: BILLING_URLS[provider] ?? consoleUrl,
  };
}
