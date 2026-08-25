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

/** 狀態的說法。🔴 `untested` 不是免責聲明，是**讓「等回報」這個策略真的能運作**。 */
export const STATUS_COPY: Record<ProviderStatus, { label: string; note: string }> = {
  ready: { label: '', note: '' },
  untested: {
    label: '尚未實測',
    note: '邏輯照 SillyTavern 寫的，但還沒有人用真金鑰打過。連不上的話請把錯誤訊息原文貼給我們 —— 有原文才修得動。',
  },
  planned: { label: '還沒接上', note: 'Vellum 還沒接上這一家，選了也送不出去。' },
};
