/**
 * 推論平台與聚合站 —— 「去哪裡拿金鑰」的逐步文案。
 *
 * 🔴 **與 `firstParty.ts` 分檔只是為了 150 行上限**，判準沒有兩套：
 * 每一條都要實查過，第一步一定是「開啟 <網址>」。
 */
export const PLATFORM_STEPS: Record<string, string[]> = {
  openrouter: [
    '開啟 openrouter.ai/settings/keys',
    '用 Email 或 OAuth 註冊／登入',
    '按「Create Key」，取個名字並設一個額度上限（建議先設小一點）',
    '複製 sk-or-… 開頭的字，貼回這裡（只會顯示這一次）',
  ],
  groq: [
    '開啟 console.groq.com/keys',
    '註冊或登入 —— 不用填付款資料，免費額度立刻可用',
    '按「Create API Key」，取個名字',
    '複製 gsk_… 開頭的字，貼回這裡（關掉對話框就看不到了）',
  ],
  fireworks: [
    '開啟 app.fireworks.ai/settings/users/api-keys',
    '註冊或登入',
    '按「Create API key」，取個名字',
    '複製整串貼回這裡（離開頁面就不再顯示）',
  ],
  siliconflow: [
    '開啟 cloud.siliconflow.cn/account/ak',
    '註冊或登入（手機號碼）',
    '按「新建 API 密鑰」',
    '複製 sk-… 開頭的字，貼回這裡',
  ],
  chutes: [
    '開啟 chutes.ai/app/api',
    '註冊或登入',
    '在 API keys 區塊建一把新的',
    '複製 cpk_… 開頭的字，貼回這裡',
  ],
  nanogpt: [
    '開啟 nano-gpt.com/api',
    '註冊或登入（也可以只儲值不註冊，但那樣拿不到金鑰）',
    '在 API 頁面按建立金鑰（最多 20 把）',
    '複製整串貼回這裡',
  ],
  aimlapi: [
    '開啟 aimlapi.com/app/keys',
    '註冊或登入',
    'Keys → API Keys → 「Create API Key」，取個名字',
    '複製整串貼回這裡（只會顯示這一次）',
  ],
  cometapi: [
    '開啟 api.cometapi.com/console/token',
    '用 Google、GitHub 或 Email 登入',
    '按「Create API Key」，取個名字',
    '按 Key 欄位的複製鈕，貼回這裡',
  ],
  electronhub: [
    '開啟 playground.electronhub.ai/console/api-keys',
    '註冊或登入',
    '建一把新的 API key',
    '複製 ek-… 開頭的字，貼回這裡',
  ],
  pollinations: [
    '開啟 enter.pollinations.ai',
    '註冊或登入（金鑰與 Pollen 額度都在這裡管）',
    '建一把 Secret key（sk_ 開頭；pk_ 開頭那種是給前端用的，不是這裡要的）',
    '複製 sk_… 開頭的字，貼回這裡',
  ],
};
