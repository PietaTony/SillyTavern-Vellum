/**
 * 「去哪裡辦一把金鑰」的網址 —— **每一家一條，不可以缺**。
 *
 * 🔴 **這個檔存在的唯一理由是修掉一個真實的 bug**：`registry.ts` 的 `oai()` 工廠
 * 原本預設 `consoleUrl: base`，於是 20 家供應商的「開啟控制台」按鈕
 * 連到的是 **API endpoint**（例：DeepSeek 連到 `https://api.deepseek.com/v1`，
 * 一個回 JSON 的網址）。UI 看起來完全正常，按下去才知道。
 *
 * 🔴 **所以這裡刻意不給任何 fallback。** 少一家就在載入時炸掉，
 * 而不是安靜地退回 base URL —— 那正是上一版的壞法。
 */
export const CONSOLE_URLS: Record<string, string> = {
  // ── 自家模型 ───────────────────────────────────────────────────
  google: 'https://aistudio.google.com/apikey',
  vertexai: 'https://console.cloud.google.com/vertex-ai',
  anthropic: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  cohere: 'https://dashboard.cohere.com/api-keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  xai: 'https://console.x.ai/team/default/api-keys',
  mistralai: 'https://console.mistral.ai/api-keys',
  moonshot: 'https://platform.moonshot.cn/console/api-keys',
  zai: 'https://z.ai/manage-apikey/apikey-list',
  ai21: 'https://studio.ai21.com/account/api-key',
  minimax: 'https://platform.minimax.io/user-center/basic-information/interface-key',
  perplexity: 'https://www.perplexity.ai/account/api/keys',
  // ── 推論平台與聚合站 ────────────────────────────────────────────
  openrouter: 'https://openrouter.ai/settings/keys',
  groq: 'https://console.groq.com/keys',
  fireworks: 'https://app.fireworks.ai/settings/users/api-keys',
  siliconflow: 'https://cloud.siliconflow.cn/account/ak',
  chutes: 'https://chutes.ai/app/api',
  nanogpt: 'https://nano-gpt.com/api',
  aimlapi: 'https://aimlapi.com/app/keys',
  cometapi: 'https://api.cometapi.com/console/token',
  electronhub: 'https://playground.electronhub.ai/console/api-keys',
  pollinations: 'https://enter.pollinations.ai',
  // ── 還沒接上的那幾家 ────────────────────────────────────────────
  workers_ai: 'https://dash.cloudflare.com/profile/api-tokens',
  azure_openai: 'https://portal.azure.com',
  custom: 'https://github.com/PietaTony/SillyTavern-Vellum',
};

/** 🔴 **查不到就炸**，不要退回 API base URL —— 那是上一版那個 bug 的形狀。 */
export function consoleFor(id: string): string {
  const url = CONSOLE_URLS[id];
  if (!url) {
    throw new Error(`registry：供應商 ${id} 沒有控制台網址。不可以用 API base URL 頂替。`);
  }
  return url;
}
