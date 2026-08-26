/**
 * 供應商清單的排序（Peter 2026-08-26：「按照截至今日最流行的排行排」）。
 *
 * 🔴 **這是一份會過期的判斷，所以它獨立成檔、帶日期、也帶依據。**
 * 沒有任何一個指標能單獨代表「流行」，下面是 2026-08-26 查到的四個一起看：
 * · 企業 API 支出：Anthropic 40%、OpenAI 27%
 * · lab power index：OpenAI 51.8%
 * · 消費端流量：ChatGPT 60.5%、Gemini 23.9%
 * · OpenRouter token 用量（2026-08）：DeepSeek V4 Flash 居首，中國模型佔前十的八席
 *
 * ⚠️ **要改就直接改這個陣列**，不要在別處插排序邏輯。
 * 🔴 **`planned` 的四家刻意排在最後** —— 它們送不出去，擺在前面只會讓人一直點到死路。
 * 🔴 新增供應商忘了排進來的話 **`gate:guides` 會 FAIL**，不會靜靜沉到底部。
 */
export const POPULARITY: string[] = [
  // 三大家
  'openai',
  'anthropic',
  'google',
  // 用量前段
  'deepseek',
  'openrouter',
  'xai',
  'minimax',
  'moonshot',
  'zai',
  'mistralai',
  // 推論平台與其他

  'groq',
  'perplexity',
  'cohere',
  'fireworks',
  'siliconflow',
  'chutes',
  'ai21',
  // 聚合站
  'nanogpt',
  'aimlapi',
  'cometapi',
  'electronhub',
  'pollinations',
  // 還沒接上的（送不出去，排最後）
  'vertexai',
  'azure_openai',
  'workers_ai',
  'custom',
];

const RANK = new Map(POPULARITY.map((id, i) => [id, i]));

/** 排不到的排最後 —— 但那是壞掉的狀態，`gate:guides` 會先擋下來。 */
export const rankOf = (id: string): number => RANK.get(id) ?? Number.MAX_SAFE_INTEGER;

/**
 * 清單順序：**已設定金鑰的在上面**（Peter 2026-08-26），其餘照流行度。
 * 🔴 **先複製再排** —— `sort` 是就地排序，直接排會改到 TanStack Query 的快取陣列。
 * （`toSorted` 在本專案的 TS lib 目標下還沒有型別。）
 */
export function byUsefulness<T extends { id: string; keySet: boolean }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => Number(b.keySet) - Number(a.keySet) || rankOf(a.id) - rankOf(b.id),
  );
}
