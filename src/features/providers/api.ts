import { get } from '@/shared/lib/http';

/**
 * 🔴 **`testKey` 已刪除。** 它與 `registryApi.testAndSaveKey` 打的是**同一個端點**
 * （`POST /api/secrets/test`），卻各有一份回應型別 ——
 * 而那份少了後端新加的 `reason`，於是 first-run 遇到「餘額不足」時
 * **看不到帳單頁連結、也複製不了原文**（GAP-45，Peter 2026-08-26 裁定合併）。
 * ⇒ 只留一份 client：`registryApi.testAndSaveKey`。
 */
export type ProviderId = 'google' | 'anthropic';
export type KeyStatus = Record<ProviderId, boolean>;

export const fetchKeyStatus = (): Promise<KeyStatus> => get<KeyStatus>('/api/secrets');
