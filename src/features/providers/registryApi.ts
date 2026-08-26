/**
 * 供應商 registry 的**唯一真相在後端**（`server/providers/registry.ts`）。
 *
 * 🔴 前端不再自己維護一份 26 家的表 —— 兩份表遲早分岔，
 * 而分岔的症狀是「UI 說可以選、後端說不認得」，那看起來像 bug 但其實是資料不同步。
 * ⚠️ `features/providers/model.ts` 那份 `PROVIDERS` **只留 first-run 的兩家＋申請步驟文案**，
 * 那是 onboarding 的文案不是 registry。
 */

export type ProviderStatus = 'ready' | 'untested' | 'planned';

export type ProviderRow = {
  id: string;
  displayName: string;
  format: string;
  status: ProviderStatus;
  keyHint: string;
  consoleUrl: string;
  defaultModel: string;
  /** 這一家有沒有模型清單端點。沒有的話 UI 要退回手動輸入。 */
  hasModelList: boolean;
  /** 🔴 只回布林，永遠不回金鑰值。 */
  keySet: boolean;
  /** 選好的模型。**沒選過是 `null`**，不是 `defaultModel` —— 兩者在畫面上要分得出來。 */
  model: string | null;
};

export async function fetchProviderRows(): Promise<ProviderRow[]> {
  const r = await fetch('/api/secrets/providers');
  if (!r.ok) throw new Error('讀不到供應商清單');
  return (await r.json()) as ProviderRow[];
}

export type ModelsResult =
  | { ok: true; models: string[]; defaultModel: string }
  | { ok: false; message: string; manual?: boolean };

export async function fetchModels(provider: string): Promise<ModelsResult> {
  const r = await fetch(`/api/secrets/models/${provider}`);
  return (await r.json()) as ModelsResult;
}

/** 存下選好的模型。🔴 只動這一家那一格，後端保證不洗掉別家。 */
export async function saveModel(provider: string, model: string): Promise<void> {
  const r = await fetch(`/api/secrets/model/${provider}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  if (!r.ok) throw new Error('存不起來');
}

/** 寫入金鑰並測試連線。成功時後端會順便把金鑰存下來。 */
export async function testAndSaveKey(
  provider: string,
  value: string,
): Promise<{ ok: true; models: string[] } | { ok: false; message: string }> {
  const r = await fetch('/api/secrets/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, value }),
  });
  return (await r.json()) as { ok: true; models: string[] } | { ok: false; message: string };
}

/**
 * 每一家金鑰的遮罩預覽（前四後四）。
 * 🔴 **全專案唯一一個會回金鑰衍生資料的端點** —— 見 `server/lib/secrets.ts` 的亮線說明。
 * 沒設金鑰的那幾家不會出現在回傳裡。
 */
export async function fetchKeyPreviews(): Promise<Record<string, string>> {
  const r = await fetch('/api/secrets/preview');
  if (!r.ok) return {};
  return (await r.json()) as Record<string, string>;
}

/**
 * 測**已經存著的那把**金鑰。
 * 🔴 前端只送 provider id，**金鑰完全不離開伺服器** —— 比「重貼一次再測」少一次傳輸。
 */
export async function testStoredKey(
  provider: string,
): Promise<{ ok: true; models: string[] } | { ok: false; message: string }> {
  const r = await fetch(`/api/secrets/test-stored/${provider}`, { method: 'POST' });
  return (await r.json()) as { ok: true; models: string[] } | { ok: false; message: string };
}

/** 狀態的說法。🔴 `untested` 不是免責聲明，是**讓「等回報」這個策略真的能運作**。 */
export const STATUS_COPY: Record<ProviderStatus, { label: string; note: string }> = {
  ready: { label: '', note: '' },
  untested: {
    label: '尚未實測',
    note: '邏輯照 SillyTavern 寫的，但還沒有人用真金鑰打過。連不上的話請把錯誤訊息原文貼給我們 —— 有原文才修得動。',
  },
  planned: { label: '還沒接上', note: 'Vellum 還沒接上這一家，選了也送不出去。' },
};
