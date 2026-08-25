/** 純函式。不碰 api／store／ui（A4，由 gate:boundaries 守）。 */
export type ProviderId = 'google' | 'anthropic';

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  /** 🔴 撞牆警告，刻意不收合（SPEC：誠實標示差別）*/
  badge: string;
  badgeTone: 'good' | 'warn';
  /** focus 才展開的細節 */
  detail: string;
  consoleUrl: string;
  steps: string[];
  keyHint: string;
};

/** 依據：SPEC §1 D20「② 該廠商的詳細金鑰引導（帶連結）」 */
export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'google',
    name: 'Google Gemini',
    badge: '有免費額度',
    badgeTone: 'good',
    detail: '在 Google AI Studio 建一把 key，免費層不需要信用卡。幾分鐘就好。',
    consoleUrl: 'https://aistudio.google.com/apikey',
    steps: [
      '開啟 aistudio.google.com/apikey',
      '用 Google 帳號登入',
      '按「Create API key」，選一個專案（沒有就讓它新建）',
      '複製 AIza… 開頭的字，貼回這裡',
    ],
    keyHint: 'AIza…',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    badge: '需要先儲值',
    badgeTone: 'warn',
    detail:
      '在 Anthropic Console 建 key。沒有免費額度——帳戶餘額為 0 時，key 是有效的但每一次請求都會被擋下來。',
    consoleUrl: 'https://console.anthropic.com',
    steps: [
      '開啟 console.anthropic.com',
      '註冊或登入',
      'Settings → API Keys → Create Key',
      '先去 Plans & Billing 儲值（餘額 0 的話，金鑰驗證得過、但每次送出都會失敗）',
      '複製 sk-ant-… 開頭的字，貼回這裡',
    ],
    keyHint: 'sk-ant-…',
  },
];

/** fallback：找不到就回第一家。用 `?? PROVIDERS[0]` 會被 noUncheckedIndexedAccess 判成 undefined，
 *  所以把「至少有一家」這件事寫成型別上成立的形狀。 */
const [FIRST] = PROVIDERS as [ProviderInfo, ...ProviderInfo[]];

export const providerById = (id: ProviderId): ProviderInfo =>
  PROVIDERS.find((p) => p.id === id) ?? FIRST;
