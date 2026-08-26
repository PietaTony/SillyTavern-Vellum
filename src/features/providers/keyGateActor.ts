import { fromPromise } from 'xstate';
import { pushToast } from '@/shared/ui/toastStore';
import { failureToast } from './failureToast';
import type { TestOutcome } from './keyGate.machine';
import { testAndSaveKey } from './registryApi';

/**
 * first-run 的「測金鑰」actor —— **打供應商的動作從外面注入，machine 本身不知道 api 存在**（X2）。
 *
 * 🔴 **與設定頁走同一份 client**（`testAndSaveKey`，同一個端點 `POST /api/secrets/test`）。
 * 在此之前 first-run 另有一份 `api.ts:testKey`，型別少了後端的 `reason`
 * ⇒ 餘額不足時**看不到帳單頁連結、也複製不了原文**（GAP-45，Peter 2026-08-26 裁定合併）。
 *
 * 🔴 **失敗在這裡就跳 tips**：actor 每次測試只跑一次，
 * 放這裡不會像 `useEffect` 那樣因為 re-render 重複推。
 */
export const makeTestKeyActor = (provider: string, consoleUrl: string) =>
  fromPromise<TestOutcome, { value: string }>(async ({ input }) => {
    const r = await testAndSaveKey(provider, input.value);
    if (r.ok) return { ok: true, models: r.models };
    pushToast(failureToast(r, provider, consoleUrl));
    // `exactOptionalPropertyTypes`：沒有 reason 就不要放這個鍵，不是放 undefined。
    return { ok: false, message: r.message, ...(r.reason ? { reason: r.reason } : {}) };
  });
