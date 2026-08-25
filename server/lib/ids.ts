import { z } from 'zod';

/**
 * 允許的 id 形狀 —— **白名單，不是黑名單**。
 *
 * 🔴 這些 id 會被接進檔案路徑。黑名單（擋 `..`、擋 `/`）永遠會漏，
 * 因為編碼方式太多（`%2e%2e`、`..%2F`、`....//`…）。白名單只放行我們自己產的 UUID 形狀。
 * 資料層的 `pathFor` 是最後一道防線，這裡是第一道 —— **兩層都要有。**
 */
export const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** 合法就回傳 id，否則回 null（route 自己決定回 400 還是 404）。 */
export const safeId = (raw: string | undefined): string | null => {
  const r = IdSchema.safeParse(raw);
  return r.success ? r.data : null;
};
