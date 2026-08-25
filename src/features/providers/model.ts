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
  /**
   * 🔴 **能力宣告**：這一家後端到底接上了沒。
   *
   * 為什麼要有這個欄位，而不是把還沒接上的那家從清單刪掉：
   * 專案原則是「ST 有 → 我們也要有，零例外」，而 ST 接了 26 家 ——
   * **這份清單遲早要列滿，所以現在就要有辦法誠實表達「列了但還沒通」**。
   * 刪掉的話，接上 Claude 時要再加回來，而且中間沒有任何機制擋住下一個人再犯。
   *
   * `ready`   ＝ 後端真的送得出去，正常可選
   * `planned` ＝ **列出來但不可選**，卡片上標明還沒接上
   */
  status: 'ready' | 'planned';
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
    status: 'ready',
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
    // 🔴 `server/routes/secrets.ts` 的 `/test` 目前只送得出 Google。
    //    接上之後把這裡改成 `ready` 即可，UI 一行都不用動。
    status: 'planned',
  },
];

/** fallback：找不到就回第一家。用 `?? PROVIDERS[0]` 會被 noUncheckedIndexedAccess 判成 undefined，
 *  所以把「至少有一家」這件事寫成型別上成立的形狀。 */
const [FIRST] = PROVIDERS as [ProviderInfo, ...ProviderInfo[]];

/** 真的送得出去的那幾家。UI 用它決定可不可以點。 */
export const isReady = (p: ProviderInfo): boolean => p.status === 'ready';

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

/**
 * 遮罩顯示狀態下的編輯還原。
 *
 * 🔴 金鑰**輸入當下就遮罩**（Peter 2026-08-25），所以輸入框顯示的是 `maskKey()` 的結果，
 * 真值另外存。使用者改動時，`onChange` 拿到的是「改過的遮罩字串」，
 * 要從差異推回真值 —— 這支就是那個推導。
 *
 * 判準（安全優先）：推不出來就**清空**，不要猜。
 * 猜錯會產生一把「看起來對、其實是錯的」金鑰，而那比重貼一次糟得多。
 */
export function applyMaskedEdit(real: string, shown: string, next: string): string {
  if (next === shown) return real;
  // 完全不含遮罩字元 ⇒ 使用者貼上／重打了一整串
  if (!next.includes('•')) return next;
  // 在尾端接了東西
  if (next.startsWith(shown)) return real + next.slice(shown.length);
  // 從尾端刪掉了東西
  if (shown.startsWith(next))
    return real.slice(0, Math.max(0, real.length - (shown.length - next.length)));
  return '';
}
