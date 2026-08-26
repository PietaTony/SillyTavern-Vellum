/**
 * 26 家供應商的設定表。
 *
 * 🔴 **驗收 A2：加一家 OpenAI 相容的供應商 ＝ 在這個檔案加一行，不動 `formats/` 下任何檔案。**
 * 沒有這條，我們就是在重演 ST 複製 9 份的路
 * （它把 22 家拆成 13 家共用 ＋ **9 家各自複製一份**，
 * 而那 22 家的 request body、streaming delta、error 形狀**完全相同**）。
 *
 * ⚠️ `status` 大部分是 `untested`：邏輯抄自 ST，但**沒有人用真金鑰打過**。
 * 那不是偷懶，是誠實 —— 見 `types.ts` 的 `ProviderStatus`。
 * 🔴 連不上時要請使用者**貼錯誤訊息原文**（不是只說「壞了」），
 * 因為 22 家共用同一支適配器 ⇒ 剩餘風險集中在這張表的設定值（base URL／model 名／header），
 * 而那些**不需要金鑰也能對照供應商文件修**。
 */
import { consoleFor } from './consoles.ts';
import type { ProviderConfig } from './types.ts';

/** OpenAI 相容的一行工廠。**這就是「加一家＝加一行」的實作。** */
const oai = (
  id: string,
  displayName: string,
  base: string,
  defaultModel: string,
  extra: Partial<ProviderConfig> = {},
): ProviderConfig => ({
  id,
  displayName,
  format: 'openai',
  urlTemplate: `${base}/chat/completions`,
  modelsUrl: `${base}/models`,
  authStyle: 'bearer',
  defaultModel,
  status: 'untested',
  keyHint: 'sk-…',
  // 🔴 **不可以退回 `base`。** 舊版就是這樣，害 20 家的「開啟控制台」連到 API endpoint。
  consoleUrl: consoleFor(id),
  ...extra,
});

export const PROVIDERS: ProviderConfig[] = [
  // ── 格式③ Gemini（我們已經實打過的那家）────────────────────────────
  {
    id: 'google',
    displayName: 'Google Gemini',
    format: 'gemini',
    urlTemplate: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse',
    modelsUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    authStyle: 'query',
    defaultModel: 'gemini-3.1-flash-lite',
    // 🔴 唯一一家 `ready`：只有它被真的打通過（`plans/fork/07-gemini-facts.md`）。
    status: 'ready',
    keyHint: 'AIza…',
    consoleUrl: consoleFor('google'),
  },
  {
    id: 'vertexai',
    displayName: 'Google Vertex AI',
    format: 'gemini',
    urlTemplate: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse',
    authStyle: 'query',
    defaultModel: 'gemini-3.1-flash-lite',
    // Vertex 走 GCP 服務帳號而不是 API key，形狀與 AI Studio 不同 ⇒ 還沒實作。
    status: 'planned',
    keyHint: '（服務帳號）',
    consoleUrl: consoleFor('vertexai'),
  },

  // ── 格式② Anthropic ─────────────────────────────────────────────
  {
    id: 'anthropic',
    displayName: 'Anthropic Claude',
    format: 'anthropic',
    urlTemplate: 'https://api.anthropic.com/v1/messages',
    modelsUrl: 'https://api.anthropic.com/v1/models',
    authStyle: 'x-api-key',
    // 🔴 沒有這個 header 會直接被拒（複檢 F2）。
    extraHeaders: { 'anthropic-version': '2023-06-01' },
    defaultModel: 'claude-sonnet-4-5',
    status: 'untested',
    keyHint: 'sk-ant-…',
    consoleUrl: consoleFor('anthropic'),
  },

  // ── 格式④ Cohere ────────────────────────────────────────────────
  {
    id: 'cohere',
    displayName: 'Cohere',
    format: 'cohere',
    urlTemplate: 'https://api.cohere.com/v2/chat',
    modelsUrl: 'https://api.cohere.com/v1/models',
    authStyle: 'bearer',
    defaultModel: 'command-r-plus',
    status: 'untested',
    keyHint: '（Cohere key）',
    consoleUrl: consoleFor('cohere'),
  },

  // ── 格式① OpenAI 相容（22 家，一家一行）──────────────────────────
  oai('openai', 'OpenAI', 'https://api.openai.com/v1', 'gpt-4o'),
  oai('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', 'openai/gpt-4o', {
    // 🔴 沒帶這兩個會被降級或擋（複檢 F2）。
    extraHeaders: { 'HTTP-Referer': 'https://github.com/PietaTony/SillyTavern-Vellum', 'X-Title': 'Vellum' },
  }),
  oai('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', 'deepseek-chat'),
  oai('xai', 'xAI Grok', 'https://api.x.ai/v1', 'grok-2-latest'),
  oai('mistralai', 'Mistral AI', 'https://api.mistral.ai/v1', 'mistral-large-latest'),
  oai('groq', 'Groq', 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile'),
  oai('perplexity', 'Perplexity', 'https://api.perplexity.ai', 'sonar'),
  oai('fireworks', 'Fireworks', 'https://api.fireworks.ai/inference/v1', 'accounts/fireworks/models/llama-v3p3-70b-instruct'),
  oai('moonshot', 'Moonshot', 'https://api.moonshot.cn/v1', 'moonshot-v1-8k'),
  oai('zai', 'Z.ai', 'https://api.z.ai/api/paas/v4', 'glm-4-plus'),
  oai('siliconflow', 'SiliconFlow', 'https://api.siliconflow.cn/v1', 'deepseek-ai/DeepSeek-V3'),
  oai('ai21', 'AI21', 'https://api.ai21.com/studio/v1', 'jamba-1.5-large'),
  oai('nanogpt', 'NanoGPT', 'https://nano-gpt.com/api/v1', 'chatgpt-4o-latest'),
  oai('aimlapi', 'AI/ML API', 'https://api.aimlapi.com/v1', 'gpt-4o'),
  oai('cometapi', 'CometAPI', 'https://api.cometapi.com/v1', 'gpt-4o'),
  oai('electronhub', 'ElectronHub', 'https://api.electronhub.ai/v1', 'gpt-4o'),
  oai('chutes', 'Chutes', 'https://llm.chutes.ai/v1', 'deepseek-ai/DeepSeek-V3'),
  oai('minimax', 'MiniMax', 'https://api.minimax.chat/v1', 'abab6.5s-chat'),
  oai('pollinations', 'Pollinations', 'https://text.pollinations.ai/openai', 'openai'),
  // 🔴 不吃 `system` role（複檢 F7）⇒ 適配器要降級成併進第一則 user。
  oai('workers_ai', 'Cloudflare Workers AI', 'https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1', '@cf/meta/llama-3.1-8b-instruct', {
    systemPromptStyle: 'merge',
    status: 'planned', // URL 需要 account id，registry 還表達不了 ⇒ 誠實標 planned
  }),
  // 🔴 endpoint 結構與其他 21 家不同（複檢 F1）—— 這就是 `urlTemplate` 存在的理由。
  {
    id: 'azure_openai',
    displayName: 'Azure OpenAI',
    format: 'openai',
    urlTemplate: '{base}/openai/deployments/{model}/chat/completions?api-version=2024-10-21',
    authStyle: 'azure-key',
    defaultModel: 'gpt-4o',
    status: 'planned', // base 與 deployment 由使用者自己填，設定 UI 還沒做
    keyHint: '（Azure key）',
    consoleUrl: consoleFor('azure_openai'),
  },
  oai('custom', '自訂（OpenAI 相容）', 'http://localhost:5001/v1', 'local-model', {
    status: 'planned', // 要讓使用者自己填 base URL，設定 UI 還沒做
    keyHint: '（可留空）',
  }),
];

export const byId = (id: string): ProviderConfig | undefined => PROVIDERS.find((p) => p.id === id);
export const isSelectable = (p: ProviderConfig): boolean => p.status !== 'planned';
