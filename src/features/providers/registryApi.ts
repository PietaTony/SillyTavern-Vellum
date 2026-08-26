/**
 * 供應商 registry 的**唯一真相在後端**（`server/providers/registry.ts`）。
 *
 * 🔴 前端不再自己維護一份 26 家的表 —— 兩份表遲早分岔，
 * 而分岔的症狀是「UI 說可以選、後端說不認得」，那看起來像 bug 但其實是資料不同步。
 * ⚠️ `features/providers/model.ts` 那份 `PROVIDERS` **只留 first-run 的兩家＋申請步驟文案**，
 * 那是 onboarding 的文案不是 registry。
 */

import { put } from '@/shared/lib/http';

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
  /** 對話現在打的是這一家。**26 家裡同時只有一個 `true`。** */
  active: boolean;
};

/**
 * 切換「目前使用中的供應商」。
 * 🔴 **失敗會丟 `ApiError`，而訊息就是後端寫好的那句人話**
 * （「還沒有金鑰 —— 先設定金鑰才能用它對話」）。呼叫端直接顯示，不要自己再編一句。
 */
export const setActiveProvider = (provider: string): Promise<{ ok: true; active: string }> =>
  put<{ ok: true; active: string }>(`/api/secrets/active/${provider}`, {});

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

/**
 * 測試這個模型 —— **成功才存**（與金鑰同一套邏輯）。
 *
 * 🔴 **後端會真的打一次**，不是檢查它在不在清單裡：
 * models 端點**會列出打不通的模型**（實測 `gemini-2.5-flash` 回 404
 * 「no longer available to new users」）。只檢查清單的話，
 * 正好存到一個用不了的，而使用者要到下一次對話才發現。
 */
export type TestFail = {
  ok: false;
  message: string;
  /** 後端分類的錯誤種類（目前只有 `'no-credit'`）。**前端不自己判**。 */
  reason?: string | null;
  /** 🔴 額度不足時模型**仍然存下來了** —— 那個失敗不是模型的問題。 */
  saved?: boolean;
};

export async function testModel(
  provider: string,
  model: string,
): Promise<{ ok: true; model: string } | TestFail> {
  const r = await fetch(`/api/secrets/test-model/${provider}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  return (await r.json()) as { ok: true; model: string } | TestFail;
}

/** 寫入金鑰並測試連線。成功時後端會順便把金鑰存下來。 */
export async function testAndSaveKey(
  provider: string,
  value: string,
): Promise<{ ok: true; models: string[] } | TestFail> {
  const r = await fetch('/api/secrets/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider, value }),
  });
  return (await r.json()) as { ok: true; models: string[] } | TestFail;
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
): Promise<{ ok: true; models: string[] } | TestFail> {
  const r = await fetch(`/api/secrets/test-stored/${provider}`, { method: 'POST' });
  return (await r.json()) as { ok: true; models: string[] } | TestFail;
}

/**
 * 狀態的說法。🔴 `untested` 不是免責聲明，是**讓「等回報」這個策略真的能運作**。
 *
 * 🔴 **`planned` 用紅底**（Peter 2026-08-26：「『還沒接上』換成紅底『尚未支援』」）——
 * 它與 `untested` 是兩種不同的「不保證」：`untested` 你可以試，`planned` 你試也沒用。
 * 兩個都用灰底的話，使用者要讀完字才分得出來。
 */
export const STATUS_COPY: Record<ProviderStatus, { label: string; note: string; color?: 'error' }> =
  {
    ready: { label: '', note: '' },
    untested: {
      // 🔴 「作者未測」不是「尚未實測」（Peter 2026-08-26）——
      // 後者聽起來像**使用者**還沒測，前者說得出「是我們沒測過」。責任歸屬不一樣。
      label: '作者未測',
      note: '邏輯照 SillyTavern 寫的，但還沒有人用真金鑰打過。連不上的話請把錯誤訊息原文貼給我們 —— 有原文才修得動。',
    },
    planned: {
      label: '尚未支援',
      note: 'Vellum 尚未支援這一家，選了也送不出去。',
      color: 'error',
    },
  };
