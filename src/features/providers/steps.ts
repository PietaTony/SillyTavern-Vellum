/**
 * 「去哪裡拿金鑰」的逐步文案。**這是 onboarding 的文案，不是 registry。**
 *
 * 🔴 供應商本身（id／狀態／預設模型／控制台網址）的**唯一真相在後端**
 * `server/providers/registry.ts` —— 這裡只放那份沒有、也不該有的東西：
 * 給人看的操作步驟。
 *
 * ⚠️ **只有實際走過的那兩家有逐步文案。** 其餘 24 家刻意留空 ——
 * 憑想像寫 24 家的操作步驟，寫錯比沒寫更糟（使用者照著點，然後找不到那顆按鈕）。
 * `KeySteps` 對沒有文案的會回退成「控制台連結 ＋ 金鑰格式」。
 */
export const STEPS_BY_PROVIDER: Record<string, string[]> = {
  google: [
    '開啟 aistudio.google.com/apikey',
    '用 Google 帳號登入',
    '按「Create API key」，選一個專案（沒有就讓它新建）',
    '複製 AIza… 開頭的字，貼回這裡',
  ],
  anthropic: [
    '開啟 console.anthropic.com',
    '註冊或登入',
    'Settings → API Keys → Create Key',
    '先去 Plans & Billing 儲值（餘額 0 的話，金鑰驗證得過、但每次送出都會失敗）',
    '複製 sk-ant-… 開頭的字，貼回這裡',
  ],
};
