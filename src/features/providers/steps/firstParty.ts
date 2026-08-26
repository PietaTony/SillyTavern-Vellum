/**
 * 自家模型的供應商 —— 「去哪裡拿金鑰」的逐步文案。
 *
 * 🔴 **每一條都是實查過控制台流程寫的，不是憑印象**（Peter 2026-08-26：「每一個都要做」）。
 * 寫錯比沒寫更糟：使用者照著點，然後找不到那顆按鈕。
 * 🔴 **第一步一定是「開啟 <網址>」** —— `KeySteps` 只在第 0 步旁邊掛「開啟」按鈕。
 */
export const FIRST_PARTY_STEPS: Record<string, string[]> = {
  google: [
    '開啟 aistudio.google.com/apikey',
    '用 Google 帳號登入',
    '按「Create API key」，選一個專案（沒有就讓它新建）',
    '複製 AIza… 開頭的字，貼回這裡',
  ],
  anthropic: [
    '開啟 console.anthropic.com/settings/keys',
    '註冊或登入',
    'Settings → API Keys → Create Key',
    '先去 Plans & Billing 儲值（餘額 0 的話，金鑰驗證得過、但每次送出都會失敗）',
    '複製 sk-ant-… 開頭的字，貼回這裡',
  ],
  openai: [
    '開啟 platform.openai.com/api-keys',
    '註冊或登入',
    '按「Create new secret key」，取個名字',
    '先去 Billing 儲值 —— OpenAI 沒有免費額度，餘額 0 會在送出時才失敗',
    '複製 sk-… 開頭的字，貼回這裡（只會顯示這一次）',
  ],
  cohere: [
    '開啟 dashboard.cohere.com/api-keys',
    '註冊或登入',
    '用預設的 Trial key 就能開始（有速率限制、不能商用）',
    '要正式用就按「New Production Key」',
    '複製整串貼回這裡',
  ],
  deepseek: [
    '開啟 platform.deepseek.com/api_keys',
    '用 Email 或 Google 註冊／登入',
    '按「創建 API key」（Create API key），取個名字',
    '複製 sk-… 開頭的字，貼回這裡（關掉視窗就看不到了）',
  ],
  xai: [
    '開啟 console.x.ai/team/default/api-keys',
    '註冊或登入，完成用途與條款那段簡短設定',
    '按「Create API Key」，取個名字',
    '複製 xai-… 開頭的字，貼回這裡（只會顯示這一次）',
  ],
  mistralai: [
    '開啟 console.mistral.ai/api-keys',
    '註冊或登入，先啟用 Studio',
    '按「Create new key」，可以設到期日',
    '複製整串貼回這裡（關掉對話框就拿不回來）',
  ],
  moonshot: [
    '開啟 platform.moonshot.cn/console/api-keys',
    '註冊或登入（國際版在 platform.moonshot.ai，兩邊的金鑰不通用）',
    '按「新建 API Key」',
    '先儲值 —— Moonshot 要預付額度才打得動',
    '複製 sk-… 開頭的字，貼回這裡（只會顯示這一次）',
  ],
  zai: [
    '開啟 z.ai/manage-apikey/apikey-list',
    '用 Email 或 Google 登入',
    '按「Create a new API key」',
    '複製整串貼回這裡（這家可以隨時回來重看，不像其他家只顯示一次）',
  ],
  ai21: [
    '開啟 studio.ai21.com/account/api-key',
    '註冊或登入',
    '左下角 Settings → API Keys → 右上角「Create new key」',
    '複製整串貼回這裡（只會顯示這一次）',
  ],
  minimax: [
    '開啟 platform.minimax.io（右上角 Console）',
    '用 Email 註冊或登入，並加上付款方式',
    '左側 Access → 「Create new API key」',
    '複製 eyJ… 開頭的那串 JWT，貼回這裡（只會顯示這一次）',
  ],
  perplexity: [
    '開啟 perplexity.ai/account/api/keys',
    '註冊或登入',
    '先在 Billing 加付款方式 —— 沒有付款方式就產不出金鑰，也沒有免費方案',
    '按「Generate」／「Create API Key」',
    '複製 pplx-… 開頭的字，貼回這裡',
  ],
};
