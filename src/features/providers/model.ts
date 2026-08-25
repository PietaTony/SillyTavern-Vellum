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

/**
 * 金鑰的遮罩顯示：**前四碼與後四碼明碼，中間打點**。
 *
 * 為什麼要露出兩端：使用者貼完之後唯一能自我確認「有沒有貼對／貼到哪一把」的線索就是這個。
 * 全遮罩的話，貼錯時他要到測試失敗才知道，而測試失敗看起來像是金鑰無效。
 *
 * 🔴 界線：這是**使用者自己剛輸入的值在自己瀏覽器裡的回顯**。
 * `00-FACTS` F3 擋的是「金鑰從伺服器回到前端／進 log／進錯誤訊息」——
 * 後端仍然永遠不回傳金鑰值（`/api/secrets` 只回布林表）。兩件事不要混。
 *
 * 太短的金鑰不露出任何一端 —— 露兩端會把整串都露完。
 */
export function maskKey(value: string, visible = 4): string {
  const v = value.trim();
  if (v.length === 0) return '';
  if (v.length <= visible * 2 + 4) return '•'.repeat(v.length);
  return `${v.slice(0, visible)}${'•'.repeat(Math.min(v.length - visible * 2, 24))}${v.slice(-visible)}`;
}
